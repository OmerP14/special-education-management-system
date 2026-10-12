import type { AuditLogEntry } from "@/types/settings";
import type { Account, AuthSession, AuthUser, Credential } from "@/types/auth";
import type { AuthService } from "@/lib/auth/auth-service";
import { validatePasswordPolicy, hashPassword, verifyPassword } from "@/lib/auth/password";
import { LOCKOUT_MINUTES, MAX_FAILED_LOGIN_ATTEMPTS } from "@/lib/auth/security-policy";

// ─── LocalAuthService ────────────────────────────────────────────────────────
//
// Today's only AuthService implementation — backed entirely by the mock
// store's single `account` + `credential` and the fixed rules in
// lib/auth/security-policy.ts, no network involved. A backend-backed service
// implements the same AuthService interface; nothing outside this file (and
// AuthProvider, which instantiates it) changes for that swap.
//
// A factory, not a class with its own state — it always closes over the
// CURRENT store snapshot passed in by AuthProvider.
//
// Several devices may hold a session for the one account at once. A session
// remembers which password it was opened with (`credentialVersion`), so a
// password change ends every OTHER device's session while the device that
// made the change stays signed in.

export interface LocalAuthDeps {
  account: Account;
  credential: Credential;
  session: AuthSession | null;
  /** Writes login counters/lockout without an audit entry. */
  saveAccountState: (account: Account) => void;
  setCredential: (credential: Credential) => void;
  setAuthSession: (session: AuthSession | null) => void;
  logAuditEvent: (entry: Omit<AuditLogEntry, "id" | "tenantId" | "occurredAt">) => void;
}

const INVALID_MESSAGE = "Kullanıcı adı veya şifre hatalı.";

function toAuthUser(account: Account): AuthUser {
  return { username: account.username, name: account.name };
}

/** Case-insensitive in Turkish and English alike: "ADMIN" lowercases to
 *  "admın" under tr rules, so dotted and dotless i are folded together. */
function normalizeUsername(value: string): string {
  return value.trim().toLocaleLowerCase("tr").replace(/ı/g, "i");
}

function minutesUntil(iso: string): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}

function isLockActive(account: Account): boolean {
  return !!account.lockedUntil && new Date(account.lockedUntil).getTime() > Date.now();
}

function lockedMessage(minutes: number): string {
  return `Çok sayıda hatalı giriş yapıldı. ${minutes} dakika sonra tekrar deneyin.`;
}

export function createLocalAuthService(deps: LocalAuthDeps): AuthService {
  /** Counts one wrong password; `lockedUntil` is set when this one locks. */
  const registerFailure = (): { attempts: number; lockedUntil?: string } => {
    const { account } = deps;
    const expired = !!account.lockedUntil && !isLockActive(account);
    const attempts = (expired ? 0 : account.failedLoginAttempts ?? 0) + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : undefined;
    deps.saveAccountState({ ...account, failedLoginAttempts: attempts, lockedUntil, updatedAt: new Date().toISOString() });
    return { attempts, lockedUntil };
  };

  return {
    async signIn({ username, password, remember }) {
      const { account, credential } = deps;
      const normalized = normalizeUsername(username);

      if (isLockActive(account) && account.lockedUntil) {
        return {
          success: false,
          error: "account_locked",
          lockedUntil: account.lockedUntil,
          errorMessage: lockedMessage(minutesUntil(account.lockedUntil)),
        };
      }

      const usernameOk = normalized === normalizeUsername(account.username);
      // Always verify, so a wrong username and a wrong password take the same path.
      const passwordOk = await verifyPassword(password, credential);

      if (!usernameOk || !passwordOk) {
        const { lockedUntil } = registerFailure();
        if (lockedUntil) {
          deps.logAuditEvent({ userName: account.name, action: "account_locked", module: "auth", recordLabel: normalized });
          return { success: false, error: "account_locked", lockedUntil, errorMessage: lockedMessage(LOCKOUT_MINUTES) };
        }
        deps.logAuditEvent({ userName: account.name, action: "login_failed", module: "auth", recordLabel: normalized });
        return { success: false, error: "invalid_credentials", errorMessage: INVALID_MESSAGE };
      }

      const now = new Date().toISOString();
      deps.saveAccountState({ ...account, failedLoginAttempts: 0, lockedUntil: undefined, lastLoginAt: now, updatedAt: now });
      const session: AuthSession = { loginAt: now, remember: !!remember, credentialVersion: credential.updatedAt };
      deps.setAuthSession(session);
      deps.logAuditEvent({ userName: account.name, action: "login_success", module: "auth" });
      return { success: true, data: { user: toAuthUser(account), session } };
    },

    async signOut() {
      const hadSession = !!deps.session;
      deps.setAuthSession(null);
      if (hadSession) deps.logAuditEvent({ userName: deps.account.name, action: "logout", module: "auth" });
    },

    getSession() {
      return deps.session;
    },

    getCurrentUser() {
      const { session, credential, account } = deps;
      if (!session || session.credentialVersion !== credential.updatedAt) return null;
      return toAuthUser(account);
    },

    async changePassword({ currentPassword, newPassword }) {
      const { session, credential, account } = deps;
      if (!session || session.credentialVersion !== credential.updatedAt) {
        return { success: false, error: "unknown", errorMessage: "Oturum bulunamadı. Lütfen yeniden giriş yapın." };
      }
      if (!(await verifyPassword(currentPassword, credential))) {
        // A wrong current password counts like a failed sign-in, so an open
        // session can't be used to guess the password.
        const { attempts, lockedUntil } = registerFailure();
        if (lockedUntil) {
          deps.logAuditEvent({ userName: account.name, action: "account_locked", module: "auth" });
          deps.setAuthSession(null);
          return {
            success: false,
            error: "account_locked",
            errorMessage: `Mevcut şifre ${MAX_FAILED_LOGIN_ATTEMPTS} kez hatalı girildi. Giriş ${LOCKOUT_MINUTES} dakika kilitlendi.`,
          };
        }
        const left = MAX_FAILED_LOGIN_ATTEMPTS - attempts;
        return { success: false, error: "invalid_credentials", errorMessage: `Mevcut şifre hatalı. ${left} deneme hakkınız kaldı.` };
      }
      if (await verifyPassword(newPassword, credential)) {
        return { success: false, error: "unknown", errorMessage: "Yeni şifre mevcut şifreyle aynı olamaz." };
      }
      const policyError = validatePasswordPolicy(newPassword);
      if (policyError) return { success: false, error: "unknown", errorMessage: policyError };

      const { salt, hash } = await hashPassword(newPassword);
      const now = new Date().toISOString();
      deps.setCredential({ salt, hash, updatedAt: now });
      // This device stays signed in; every other device's session is now stale.
      deps.setAuthSession({ ...session, credentialVersion: now });
      if (account.failedLoginAttempts) deps.saveAccountState({ ...account, failedLoginAttempts: 0, updatedAt: now });
      deps.logAuditEvent({ userName: account.name, action: "password_changed", module: "auth" });
      return { success: true };
    },
  };
}
