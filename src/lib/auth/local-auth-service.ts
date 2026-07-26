import type { AppUser, AuditLogEntry, SecuritySettings } from "@/types/settings";
import type { AuthSession, AuthUser, Credential, Invitation, PasswordResetToken, Role } from "@/types/auth";
import type { AuthService } from "@/lib/auth/auth-service";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateToken } from "@/lib/auth/tokens";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── LocalAuthService ────────────────────────────────────────────────────────
//
// Today's only AuthService implementation — backed entirely by the mock
// store (appUsers/credentials/roles/institutionSettings.security), no
// network/backend involved. A future SupabaseAuthService implements the same
// AuthService interface; nothing outside this file (and AuthProvider, which
// instantiates it) would need to change for that swap.
//
// A factory (createLocalAuthService), not a class with its own state — it
// always closes over the CURRENT store snapshot passed in by AuthProvider,
// matching this codebase's existing ref-based "always read the latest value"
// pattern in store.tsx (see e.g. appUsersRef there).

export interface LocalAuthDeps {
  appUsers: AppUser[];
  credentials: Credential[];
  roles: Role[];
  invitations: Invitation[];
  passwordResets: PasswordResetToken[];
  security: SecuritySettings;
  session: AuthSession | null;
  updateAppUser: (user: AppUser) => void;
  setCredential: (credential: Credential) => void;
  setAuthSession: (session: AuthSession | null) => void;
  setInvitation: (invitation: Invitation) => void;
  setPasswordReset: (token: PasswordResetToken) => void;
  logAuditEvent: (entry: Omit<AuditLogEntry, "id" | "tenantId" | "occurredAt">) => void;
}

function resolveRole(deps: LocalAuthDeps, roleId: string): Role | undefined {
  return deps.roles.find((r) => r.id === roleId);
}

function toAuthUser(user: AppUser, role: Role): AuthUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    roleId: user.roleId,
    roleKey: role.key,
    status: user.status,
    teacherId: user.teacherId,
    guardianId: user.guardianId,
  };
}

function minutesUntil(iso: string): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}

export function createLocalAuthService(deps: LocalAuthDeps): AuthService {
  return {
    async signIn({ email, password, remember }) {
      const normalizedEmail = email.trim().toLowerCase();
      const user = deps.appUsers.find((u) => u.email.toLowerCase() === normalizedEmail);

      if (!user) {
        // Never reveal whether the email exists — same generic message as a
        // wrong password. recordLabel carries the attempted email (not a
        // user name, since none resolved) for the audit trail only.
        deps.logAuditEvent({ userName: email, action: "login_failed", module: "auth", recordLabel: normalizedEmail });
        return { success: false, error: "invalid_credentials", errorMessage: "E-posta veya şifre hatalı." };
      }

      // A lock that has already expired unlocks silently on the next attempt
      // rather than requiring a separate admin "unlock" action.
      if (user.status === "locked" && user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
        return {
          success: false,
          error: "account_locked",
          errorMessage: `Hesabınız çok sayıda başarısız girişten sonra kilitlendi. ${minutesUntil(user.lockedUntil)} dakika sonra tekrar deneyin.`,
        };
      }
      const isExpiredLock = user.status === "locked" && (!user.lockedUntil || new Date(user.lockedUntil).getTime() <= Date.now());
      const effectiveStatus = isExpiredLock ? "active" : user.status;

      if (effectiveStatus === "invited") {
        return { success: false, error: "account_invited", errorMessage: "Hesabınız henüz aktifleştirilmemiş." };
      }
      if (effectiveStatus === "inactive") {
        return { success: false, error: "account_inactive", errorMessage: "Hesabınız pasif durumda. Yöneticinizle iletişime geçin." };
      }

      const credential = deps.credentials.find((c) => c.userId === user.id);
      const passwordOk = credential ? await verifyPassword(password, credential) : false;

      if (!passwordOk) {
        const attempts = (isExpiredLock ? 0 : user.failedLoginAttempts ?? 0) + 1;
        const willLock = attempts >= deps.security.failedLoginThreshold;
        const lockedUntil = willLock
          ? new Date(Date.now() + deps.security.lockoutDurationMinutes * 60_000).toISOString()
          : undefined;

        deps.updateAppUser({
          ...user,
          failedLoginAttempts: attempts,
          status: willLock ? "locked" : "active",
          lockedUntil,
          updatedAt: new Date().toISOString(),
        });

        if (willLock) {
          deps.logAuditEvent({ userName: user.name, action: "account_locked", module: "auth", recordLabel: user.email });
          return {
            success: false,
            error: "account_locked",
            errorMessage: `Hesabınız çok sayıda başarısız girişten sonra kilitlendi. ${deps.security.lockoutDurationMinutes} dakika sonra tekrar deneyin.`,
          };
        }
        deps.logAuditEvent({ userName: user.name, action: "login_failed", module: "auth", recordLabel: user.email });
        return { success: false, error: "invalid_credentials", errorMessage: "E-posta veya şifre hatalı." };
      }

      const role = resolveRole(deps, user.roleId);
      if (!role) {
        return { success: false, error: "unknown", errorMessage: "Hesabınıza bağlı rol bulunamadı." };
      }

      const now = new Date().toISOString();
      deps.updateAppUser({
        ...user,
        status: "active",
        failedLoginAttempts: 0,
        lockedUntil: undefined,
        lastLoginAt: now,
        updatedAt: now,
      });

      const session: AuthSession = {
        userId: user.id,
        loginAt: now,
        lastActivityAt: now,
        expiresAt: new Date(Date.now() + deps.security.sessionTimeoutMinutes * 60_000).toISOString(),
        remember: !!remember,
      };
      deps.setAuthSession(session);
      deps.logAuditEvent({ userName: user.name, action: "login_success", module: "auth", recordLabel: user.email });

      return { success: true, data: { user: toAuthUser(user, role), session } };
    },

    async signOut() {
      const userName = deps.session
        ? deps.appUsers.find((u) => u.id === deps.session!.userId)?.name ?? "Bilinmeyen kullanıcı"
        : null;
      deps.setAuthSession(null);
      if (userName) {
        deps.logAuditEvent({ userName, action: "logout", module: "auth" });
      }
    },

    getSession() {
      return deps.session;
    },

    getCurrentUser() {
      if (!deps.session) return null;
      const user = deps.appUsers.find((u) => u.id === deps.session!.userId);
      if (!user) return null;
      const role = resolveRole(deps, user.roleId);
      if (!role) return null;
      return toAuthUser(user, role);
    },

    async refreshSession() {
      if (!deps.session) return null;
      const now = new Date().toISOString();
      const refreshed: AuthSession = {
        ...deps.session,
        lastActivityAt: now,
        expiresAt: new Date(Date.now() + deps.security.sessionTimeoutMinutes * 60_000).toISOString(),
      };
      deps.setAuthSession(refreshed);
      return refreshed;
    },

    async changePassword({ userId, currentPassword, newPassword }) {
      const user = deps.appUsers.find((u) => u.id === userId);
      const credential = deps.credentials.find((c) => c.userId === userId);
      if (!user || !credential) {
        return { success: false, error: "unknown", errorMessage: "Kullanıcı bulunamadı." };
      }
      const ok = await verifyPassword(currentPassword, credential);
      if (!ok) {
        return { success: false, error: "invalid_credentials", errorMessage: "Mevcut şifre hatalı." };
      }
      const { salt, hash } = await hashPassword(newPassword);
      deps.setCredential({ userId, salt, hash, updatedAt: new Date().toISOString() });
      deps.logAuditEvent({ userName: user.name, action: "password_changed", module: "auth", recordLabel: user.email });
      return { success: true };
    },

    async requestPasswordReset(email) {
      const normalizedEmail = email.trim().toLowerCase();
      const user = deps.appUsers.find((u) => u.email.toLowerCase() === normalizedEmail);
      // Always return success — never reveal whether the email exists. If it
      // does, a token is generated; the /forgot-password page shows a mock
      // "link" either way so the UI can't be used to enumerate accounts.
      if (user) {
        const token: PasswordResetToken = {
          token: generateToken(),
          userId: user.id,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
          createdAt: new Date().toISOString(),
        };
        deps.setPasswordReset(token);
        return { success: true, data: { token: token.token } };
      }
      return { success: true };
    },

    async resetPassword({ token, newPassword }) {
      const entry = deps.passwordResets.find((t) => t.token === token);
      if (!entry || entry.usedAt || new Date(entry.expiresAt).getTime() <= Date.now()) {
        return { success: false, error: "unknown", errorMessage: "Bağlantının süresi dolmuş veya geçersiz." };
      }
      const user = deps.appUsers.find((u) => u.id === entry.userId);
      if (!user) {
        return { success: false, error: "unknown", errorMessage: "Kullanıcı bulunamadı." };
      }
      const { salt, hash } = await hashPassword(newPassword);
      deps.setCredential({ userId: user.id, salt, hash, updatedAt: new Date().toISOString() });
      deps.setPasswordReset({ ...entry, usedAt: new Date().toISOString() });
      deps.logAuditEvent({ userName: user.name, action: "password_changed", module: "auth", recordLabel: user.email });
      return { success: true };
    },

    async acceptInvitation({ token, password }) {
      const invitation = deps.invitations.find((i) => i.token === token);
      if (!invitation || invitation.status !== "pending" || new Date(invitation.expiresAt).getTime() <= Date.now()) {
        return { success: false, error: "unknown", errorMessage: "Davet bağlantısının süresi dolmuş veya geçersiz." };
      }
      const user = deps.appUsers.find((u) => u.id === invitation.userId);
      const role = user ? resolveRole(deps, user.roleId) : undefined;
      if (!user || !role) {
        return { success: false, error: "unknown", errorMessage: "Kullanıcı bulunamadı." };
      }

      const now = new Date().toISOString();
      const { salt, hash } = await hashPassword(password);
      deps.setCredential({ userId: user.id, salt, hash, updatedAt: now });
      const activatedUser: AppUser = { ...user, status: "active", invitationAcceptedAt: now, updatedAt: now };
      deps.updateAppUser(activatedUser);
      deps.setInvitation({ ...invitation, status: "accepted", acceptedAt: now });

      const session: AuthSession = {
        userId: user.id,
        loginAt: now,
        lastActivityAt: now,
        expiresAt: new Date(Date.now() + deps.security.sessionTimeoutMinutes * 60_000).toISOString(),
        remember: true,
      };
      deps.setAuthSession(session);
      deps.logAuditEvent({ userName: user.name, action: "login_success", module: "auth", recordLabel: user.email });

      return { success: true, data: { user: toAuthUser(activatedUser, role), session } };
    },

    getInvitationByToken(token) {
      return deps.invitations.find((i) => i.token === token) ?? null;
    },
  };
}
