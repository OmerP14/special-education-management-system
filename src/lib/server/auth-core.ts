import { createHash, randomBytes } from "node:crypto";
import type { AuthResult, AuthUser } from "@/types/auth";
import { validatePasswordPolicy } from "@/lib/auth/password";
import {
  ACCOUNT_LOCKOUT_MINUTES,
  ACCOUNT_MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "@/lib/auth/security-policy";
import { hashPassword, verifyPassword } from "@/lib/server/password-hash";

// ─── Sign-in rules for the single institution account ──────────────────────
//
// Storage-agnostic: everything goes through AuthRepo, so the rules are tested
// against an in-memory repo (__tests__/auth-core.test.ts) and run against
// Postgres in production (auth-repo.ts).
//
// There is no built-in account: on a fresh database needsSetup() is true and
// the first visitor creates the institution's own account with setup().
//
// Several devices may hold a session for the one account at once. A session
// remembers which password it was opened with (`credentialVersion`), so a
// password change ends every OTHER device's session while the device that
// made the change stays signed in. The browser only ever holds a random
// token; the database keeps its SHA-256, so a leaked table can't be replayed.
//
// Wrong passwords lock the CLIENT that typed them (its network address), not
// the account: two or three people share this one login, and one person's
// typos must not lock the others out. Failures from every client together
// still lock the whole account past a much higher bar, so guessing from many
// addresses gets nowhere either.

export interface AccountRow {
  username: string;
  name: string;
  passwordHash: string;
  /** ISO time of the last password change. */
  credentialVersion: string;
  failedAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
}

export interface SessionRow {
  tokenHash: string;
  credentialVersion: string;
  remember: boolean;
  createdAt: string;
  expiresAt: string;
}

/** Wrong-password bookkeeping for one client (hashed network address). */
export interface ClientLockRow {
  failures: number;
  lockedUntil: string | null;
}

export interface AuthRepo {
  /** Null until the first-run setup has created the account. */
  getAccount(): Promise<AccountRow | null>;
  /** Inserts the one account; false when one already exists. */
  createAccount(account: AccountRow): Promise<boolean>;
  updateAccount(patch: Partial<AccountRow>): Promise<void>;
  createSession(session: SessionRow): Promise<void>;
  getSession(tokenHash: string): Promise<SessionRow | null>;
  updateSession(tokenHash: string, patch: Partial<SessionRow>): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
  getClientLock(clientKey: string): Promise<ClientLockRow | null>;
  saveClientLock(clientKey: string, lock: ClientLockRow): Promise<void>;
  clearClientLock(clientKey: string): Promise<void>;
}

/** Sessions are refreshed on every sign-in; this only bounds a forgotten one. */
export const SESSION_DAYS = 30;

const INVALID_MESSAGE = "Kullanıcı adı veya şifre hatalı.";
const NO_SESSION_MESSAGE = "Oturum bulunamadı. Lütfen yeniden giriş yapın.";
const NOT_SET_UP_MESSAGE = "Sistem henüz kurulmadı. Önce kurulumu tamamlayın.";

/** Case-insensitive in Turkish and English alike: "ADMIN" lowercases to
 *  "admın" under tr rules, so dotted and dotless i are folded together. */
export function normalizeUsername(value: string): string {
  return value.trim().toLocaleLowerCase("tr").replace(/ı/g, "i");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(account: AccountRow, session: SessionRow): AuthUser {
  return { username: account.username, name: account.name, loginAt: session.createdAt };
}

function minutesUntil(iso: string): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}

function isActive(lockedUntil: string | null | undefined): lockedUntil is string {
  return !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();
}

const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

function lockedMessage(minutes: number): string {
  return `Çok sayıda hatalı giriş yapıldı. ${minutes} dakika sonra tekrar deneyin.`;
}

/** Trims and drops control characters (NUL, line breaks…) from a name or
 *  username before it is stored. */
function cleanText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200);
}

/** Turkish error for the account form fields, or null when they are fine. */
function validateProfile(name: string, username: string): string | null {
  if (!name) return "Ad boş bırakılamaz.";
  if (!username) return "Kullanıcı adı boş bırakılamaz.";
  if (/\s/.test(username)) return "Kullanıcı adı boşluk içeremez.";
  return null;
}

export function createAuthCore(repo: AuthRepo) {
  const openSession = async (account: AccountRow, remember: boolean): Promise<{ user: AuthUser; token: string }> => {
    const now = new Date();
    const token = randomBytes(32).toString("base64url");
    const session: SessionRow = {
      tokenHash: hashToken(token),
      credentialVersion: account.credentialVersion,
      remember,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(),
    };
    await repo.createSession(session);
    return { user: toAuthUser(account, session), token };
  };

  /** The lock that currently refuses this client, if any (its own, or the
   *  account-wide one). */
  const activeLock = async (account: AccountRow, clientKey: string): Promise<string | null> => {
    if (isActive(account.lockedUntil)) return account.lockedUntil;
    const client = await repo.getClientLock(clientKey);
    return isActive(client?.lockedUntil) ? client.lockedUntil : null;
  };

  /** Counts one wrong password for this client and for the account.
   *  `attempts` is this client's count; `lockedUntil` is set when this one
   *  locked the client (or the whole account). */
  const registerFailure = async (account: AccountRow, clientKey: string): Promise<{ attempts: number; lockedUntil?: string }> => {
    const client = await repo.getClientLock(clientKey);
    const clientExpired = !!client?.lockedUntil && !isActive(client.lockedUntil);
    const attempts = (client && !clientExpired ? client.failures : 0) + 1;
    const clientLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? minutesFromNow(LOCKOUT_MINUTES) : null;
    await repo.saveClientLock(clientKey, { failures: attempts, lockedUntil: clientLock });

    const accountExpired = !!account.lockedUntil && !isActive(account.lockedUntil);
    const total = (accountExpired ? 0 : account.failedAttempts) + 1;
    const accountLock = total >= ACCOUNT_MAX_FAILED_ATTEMPTS ? minutesFromNow(ACCOUNT_LOCKOUT_MINUTES) : null;
    await repo.updateAccount({ failedAttempts: total, lockedUntil: accountLock });
    return { attempts, lockedUntil: accountLock ?? clientLock ?? undefined };
  };

  /** The session behind a token, or null when it is unknown, expired or was
   *  opened with a password that has since changed. */
  const resolve = async (token: string | undefined): Promise<{ account: AccountRow; session: SessionRow } | null> => {
    if (!token) return null;
    const session = await repo.getSession(hashToken(token));
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await repo.deleteSession(session.tokenHash);
      return null;
    }
    const account = await repo.getAccount();
    if (!account || session.credentialVersion !== account.credentialVersion) return null;
    return { account, session };
  };

  return {
    async needsSetup(): Promise<boolean> {
      return (await repo.getAccount()) === null;
    },

    /** First run only: creates the institution's account and signs this
     *  device in. Refused once an account exists. */
    async setup(input: {
      name: string;
      username: string;
      password: string;
    }): Promise<{ result: AuthResult<{ user: AuthUser }>; token?: string }> {
      const name = cleanText(input.name);
      const username = cleanText(input.username);
      const error = validateProfile(name, username) ?? validatePasswordPolicy(input.password);
      if (error) return { result: { success: false, error: "unknown", errorMessage: error } };
      const account: AccountRow = {
        username,
        name,
        passwordHash: await hashPassword(input.password),
        credentialVersion: new Date().toISOString(),
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
      };
      if (!(await repo.createAccount(account))) {
        return { result: { success: false, error: "unknown", errorMessage: "Kurulum zaten yapılmış. Giriş ekranından girin." } };
      }
      const { user, token } = await openSession(account, true);
      await repo.updateAccount({ lastLoginAt: user.loginAt });
      return { result: { success: true, data: { user } }, token };
    },

    /** `clientKey` identifies who is typing (see clientKeyFor in the route). */
    async signIn(input: {
      username: string;
      password: string;
      remember: boolean;
      clientKey: string;
    }): Promise<{ result: AuthResult<{ user: AuthUser }>; token?: string }> {
      const account = await repo.getAccount();
      if (!account) return { result: { success: false, error: "unknown", errorMessage: NOT_SET_UP_MESSAGE } };

      const locked = await activeLock(account, input.clientKey);
      if (locked) {
        return {
          result: { success: false, error: "account_locked", lockedUntil: locked, errorMessage: lockedMessage(minutesUntil(locked)) },
        };
      }

      const usernameOk = normalizeUsername(input.username) === normalizeUsername(account.username);
      // Always verify, so a wrong username and a wrong password take the same path.
      const passwordOk = await verifyPassword(input.password, account.passwordHash);

      if (!usernameOk || !passwordOk) {
        const { lockedUntil } = await registerFailure(account, input.clientKey);
        if (lockedUntil) {
          return { result: { success: false, error: "account_locked", lockedUntil, errorMessage: lockedMessage(minutesUntil(lockedUntil)) } };
        }
        return { result: { success: false, error: "invalid_credentials", errorMessage: INVALID_MESSAGE } };
      }

      const { user, token } = await openSession(account, input.remember);
      await repo.clearClientLock(input.clientKey);
      await repo.updateAccount({ failedAttempts: 0, lockedUntil: null, lastLoginAt: user.loginAt });
      return { result: { success: true, data: { user } }, token };
    },

    async signOut(token: string | undefined): Promise<void> {
      if (token) await repo.deleteSession(hashToken(token));
    },

    async getUser(token: string | undefined): Promise<AuthUser | null> {
      const found = await resolve(token);
      return found ? toAuthUser(found.account, found.session) : null;
    },

    /** `signedOut` tells the route to clear this device's cookie. */
    async changePassword(
      token: string | undefined,
      input: { currentPassword: string; newPassword: string; clientKey: string }
    ): Promise<AuthResult & { signedOut?: boolean }> {
      const found = await resolve(token);
      if (!found) return { success: false, error: "unknown", errorMessage: NO_SESSION_MESSAGE, signedOut: true };
      const { account, session } = found;

      if (!(await verifyPassword(input.currentPassword, account.passwordHash))) {
        // A wrong current password counts like a failed sign-in, so an open
        // session can't be used to guess the password.
        const { attempts, lockedUntil } = await registerFailure(account, input.clientKey);
        if (lockedUntil) {
          await repo.deleteSession(session.tokenHash);
          return {
            success: false,
            error: "account_locked",
            signedOut: true,
            errorMessage: `Mevcut şifre ${MAX_FAILED_LOGIN_ATTEMPTS} kez hatalı girildi. Bu cihazdan giriş ${LOCKOUT_MINUTES} dakika kilitlendi.`,
          };
        }
        const left = MAX_FAILED_LOGIN_ATTEMPTS - attempts;
        return { success: false, error: "invalid_credentials", errorMessage: `Mevcut şifre hatalı. ${left} deneme hakkınız kaldı.` };
      }
      if (input.newPassword === input.currentPassword) {
        return { success: false, error: "unknown", errorMessage: "Yeni şifre mevcut şifreyle aynı olamaz." };
      }
      const policyError = validatePasswordPolicy(input.newPassword);
      if (policyError) return { success: false, error: "unknown", errorMessage: policyError };

      const credentialVersion = new Date().toISOString();
      await repo.updateAccount({ passwordHash: await hashPassword(input.newPassword), credentialVersion, failedAttempts: 0 });
      await repo.clearClientLock(input.clientKey);
      // This device stays signed in; every other device's session is now stale.
      await repo.updateSession(session.tokenHash, { credentialVersion });
      return { success: true };
    },

    /** Profil page: display name and username. */
    async updateProfile(token: string | undefined, input: { name: string; username: string }): Promise<AuthResult<{ user: AuthUser }>> {
      const found = await resolve(token);
      if (!found) return { success: false, error: "unknown", errorMessage: NO_SESSION_MESSAGE };
      const name = cleanText(input.name);
      const username = cleanText(input.username);
      const error = validateProfile(name, username);
      if (error) return { success: false, error: "unknown", errorMessage: error };
      await repo.updateAccount({ name, username });
      return { success: true, data: { user: toAuthUser({ ...found.account, name, username }, found.session) } };
    },
  };
}

export type AuthCore = ReturnType<typeof createAuthCore>;
