import { createHash, randomBytes } from "node:crypto";
import type { AccountRole, AuthResult, AuthUser, StaffAccountInfo } from "@/types/auth";
import { validatePasswordPolicy } from "@/lib/auth/password";
import {
  ACCOUNT_LOCKOUT_MINUTES,
  ACCOUNT_MAX_FAILED_ATTEMPTS,
  LOCKOUT_MINUTES,
  MAX_FAILED_LOGIN_ATTEMPTS,
} from "@/lib/auth/security-policy";
import { hashPassword, verifyPassword } from "@/lib/server/password-hash";

// ─── Sign-in rules ──────────────────────────────────────────────────────────
//
// Storage-agnostic: everything goes through AuthRepo, so the rules are tested
// against an in-memory repo (__tests__/auth-core.test.ts) and run against
// Postgres in production (auth-repo.ts).
//
// Two logins at most: the institution's admin account (id 1, full access),
// created by the first-run setup, and an optional staff account (id 2) the
// admin opens for people who only schedule lessons. What staff may see and
// change is decided on the server (staff-view.ts).
//
// Several devices may hold a session for an account at once. A session
// remembers which password it was opened with (`credentialVersion`), so a
// password change ends every OTHER device's session of that account while the
// device that made the change stays signed in. The browser only ever holds a
// random token; the database keeps its SHA-256, so a leaked table can't be
// replayed.
//
// Wrong passwords lock the CLIENT that typed them (its network address), not
// the account: two or three people share a login, and one person's typos must
// not lock the others out. Failures from every client together (kept on the
// admin row) still lock all sign-ins past a much higher bar, so guessing from
// many addresses gets nowhere either.

export const ADMIN_ACCOUNT_ID = 1;
export const STAFF_ACCOUNT_ID = 2;

export interface AccountRow {
  id: number;
  role: AccountRole;
  username: string;
  name: string;
  passwordHash: string;
  /** ISO time of the last password change. */
  credentialVersion: string;
  /** On the admin row: wrong passwords from all clients (the global guard). */
  failedAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
}

export interface SessionRow {
  tokenHash: string;
  accountId: number;
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
  getAccounts(): Promise<AccountRow[]>;
  /** Inserts an account; false when that id already exists. */
  createAccount(account: AccountRow): Promise<boolean>;
  updateAccount(id: number, patch: Partial<AccountRow>): Promise<void>;
  /** Removes the account and every session it has. */
  deleteAccount(id: number): Promise<void>;
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
const ADMIN_ONLY_MESSAGE = "Bu işlem yalnızca yönetici hesabıyla yapılabilir.";
const USERNAME_TAKEN_MESSAGE = "Bu kullanıcı adı diğer hesapta kullanılıyor.";

/** Case-insensitive in Turkish and English alike: "ADMIN" lowercases to
 *  "admın" under tr rules, so dotted and dotless i are folded together. */
export function normalizeUsername(value: string): string {
  return value.trim().toLocaleLowerCase("tr").replace(/ı/g, "i");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAuthUser(account: AccountRow, session: SessionRow): AuthUser {
  return { username: account.username, name: account.name, role: account.role, loginAt: session.createdAt };
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
  const accounts = async () => {
    const all = await repo.getAccounts();
    return { all, admin: all.find((a) => a.id === ADMIN_ACCOUNT_ID) ?? null, staff: all.find((a) => a.id === STAFF_ACCOUNT_ID) ?? null };
  };

  const usernameTaken = (all: AccountRow[], username: string, exceptId: number) =>
    all.some((a) => a.id !== exceptId && normalizeUsername(a.username) === normalizeUsername(username));

  const openSession = async (account: AccountRow, remember: boolean): Promise<{ user: AuthUser; token: string }> => {
    const now = new Date();
    const token = randomBytes(32).toString("base64url");
    const session: SessionRow = {
      tokenHash: hashToken(token),
      accountId: account.id,
      credentialVersion: account.credentialVersion,
      remember,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(),
    };
    await repo.createSession(session);
    return { user: toAuthUser(account, session), token };
  };

  /** The lock that currently refuses this client, if any (its own, or the
   *  global one on the admin row). */
  const activeLock = async (admin: AccountRow, clientKey: string): Promise<string | null> => {
    if (isActive(admin.lockedUntil)) return admin.lockedUntil;
    const client = await repo.getClientLock(clientKey);
    return isActive(client?.lockedUntil) ? client.lockedUntil : null;
  };

  /** Counts one wrong password for this client and globally. `attempts` is
   *  this client's count; `lockedUntil` is set when this one locked the
   *  client (or everyone). */
  const registerFailure = async (admin: AccountRow, clientKey: string): Promise<{ attempts: number; lockedUntil?: string }> => {
    const client = await repo.getClientLock(clientKey);
    const clientExpired = !!client?.lockedUntil && !isActive(client.lockedUntil);
    const attempts = (client && !clientExpired ? client.failures : 0) + 1;
    const clientLock = attempts >= MAX_FAILED_LOGIN_ATTEMPTS ? minutesFromNow(LOCKOUT_MINUTES) : null;
    await repo.saveClientLock(clientKey, { failures: attempts, lockedUntil: clientLock });

    const globalExpired = !!admin.lockedUntil && !isActive(admin.lockedUntil);
    const total = (globalExpired ? 0 : admin.failedAttempts) + 1;
    const globalLock = total >= ACCOUNT_MAX_FAILED_ATTEMPTS ? minutesFromNow(ACCOUNT_LOCKOUT_MINUTES) : null;
    await repo.updateAccount(admin.id, { failedAttempts: total, lockedUntil: globalLock });
    return { attempts, lockedUntil: globalLock ?? clientLock ?? undefined };
  };

  /** The session behind a token, or null when it is unknown, expired, its
   *  account is gone, or it was opened with a password that has since changed. */
  const resolve = async (token: string | undefined): Promise<{ account: AccountRow; admin: AccountRow; session: SessionRow } | null> => {
    if (!token) return null;
    const session = await repo.getSession(hashToken(token));
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await repo.deleteSession(session.tokenHash);
      return null;
    }
    const { all, admin } = await accounts();
    const account = all.find((a) => a.id === session.accountId);
    if (!account || !admin || session.credentialVersion !== account.credentialVersion) return null;
    return { account, admin, session };
  };

  const resolveAdmin = async (token: string | undefined) => {
    const found = await resolve(token);
    if (!found) return { error: NO_SESSION_MESSAGE } as const;
    if (found.account.role !== "admin") return { error: ADMIN_ONLY_MESSAGE } as const;
    return found;
  };

  const staffInfo = (staff: AccountRow | null): StaffAccountInfo | null =>
    staff ? { username: staff.username, name: staff.name, lastLoginAt: staff.lastLoginAt } : null;

  return {
    async needsSetup(): Promise<boolean> {
      return (await accounts()).admin === null;
    },

    /** First run only: creates the institution's admin account and signs this
     *  device in. Refused once it exists. */
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
        id: ADMIN_ACCOUNT_ID,
        role: "admin",
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
      await repo.updateAccount(account.id, { lastLoginAt: user.loginAt });
      return { result: { success: true, data: { user } }, token };
    },

    /** `clientKey` identifies who is typing (see clientKeyFor in the route). */
    async signIn(input: {
      username: string;
      password: string;
      remember: boolean;
      clientKey: string;
    }): Promise<{ result: AuthResult<{ user: AuthUser }>; token?: string }> {
      const { all, admin } = await accounts();
      if (!admin) return { result: { success: false, error: "unknown", errorMessage: NOT_SET_UP_MESSAGE } };

      const locked = await activeLock(admin, input.clientKey);
      if (locked) {
        return {
          result: { success: false, error: "account_locked", lockedUntil: locked, errorMessage: lockedMessage(minutesUntil(locked)) },
        };
      }

      const typed = normalizeUsername(input.username);
      const account = all.find((a) => normalizeUsername(a.username) === typed);
      // Always verify a hash, so a wrong username and a wrong password take the same path.
      const passwordOk = await verifyPassword(input.password, (account ?? admin).passwordHash);

      if (!account || !passwordOk) {
        const { lockedUntil } = await registerFailure(admin, input.clientKey);
        if (lockedUntil) {
          return { result: { success: false, error: "account_locked", lockedUntil, errorMessage: lockedMessage(minutesUntil(lockedUntil)) } };
        }
        return { result: { success: false, error: "invalid_credentials", errorMessage: INVALID_MESSAGE } };
      }

      const { user, token } = await openSession(account, input.remember);
      await repo.clearClientLock(input.clientKey);
      await repo.updateAccount(admin.id, { failedAttempts: 0, lockedUntil: null });
      await repo.updateAccount(account.id, { lastLoginAt: user.loginAt });
      return { result: { success: true, data: { user } }, token };
    },

    async signOut(token: string | undefined): Promise<void> {
      if (token) await repo.deleteSession(hashToken(token));
    },

    async getUser(token: string | undefined): Promise<AuthUser | null> {
      const found = await resolve(token);
      return found ? toAuthUser(found.account, found.session) : null;
    },

    /** Own password, for either role. `signedOut` tells the route to clear
     *  this device's cookie. */
    async changePassword(
      token: string | undefined,
      input: { currentPassword: string; newPassword: string; clientKey: string }
    ): Promise<AuthResult & { signedOut?: boolean }> {
      const found = await resolve(token);
      if (!found) return { success: false, error: "unknown", errorMessage: NO_SESSION_MESSAGE, signedOut: true };
      const { account, admin, session } = found;

      if (!(await verifyPassword(input.currentPassword, account.passwordHash))) {
        // A wrong current password counts like a failed sign-in, so an open
        // session can't be used to guess the password.
        const { attempts, lockedUntil } = await registerFailure(admin, input.clientKey);
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
      await repo.updateAccount(account.id, { passwordHash: await hashPassword(input.newPassword), credentialVersion });
      await repo.clearClientLock(input.clientKey);
      // This device stays signed in; every other device's session is now stale.
      await repo.updateSession(session.tokenHash, { credentialVersion });
      return { success: true };
    },

    /** Profil page: the admin's own display name and username. Staff names
     *  are set by the admin (saveStaff). */
    async updateProfile(token: string | undefined, input: { name: string; username: string }): Promise<AuthResult<{ user: AuthUser }>> {
      const found = await resolveAdmin(token);
      if ("error" in found) return { success: false, error: "unknown", errorMessage: found.error };
      const name = cleanText(input.name);
      const username = cleanText(input.username);
      const error = validateProfile(name, username);
      if (error) return { success: false, error: "unknown", errorMessage: error };
      const { all } = await accounts();
      if (usernameTaken(all, username, found.account.id)) return { success: false, error: "unknown", errorMessage: USERNAME_TAKEN_MESSAGE };
      await repo.updateAccount(found.account.id, { name, username });
      return { success: true, data: { user: toAuthUser({ ...found.account, name, username }, found.session) } };
    },

    /** Admin only: the staff account, or null when there is none. */
    async getStaff(token: string | undefined): Promise<AuthResult<{ staff: StaffAccountInfo | null }>> {
      const found = await resolveAdmin(token);
      if ("error" in found) return { success: false, error: "unknown", errorMessage: found.error };
      return { success: true, data: { staff: staffInfo((await accounts()).staff) } };
    },

    /** Admin only: opens the staff account or changes it. A password is
     *  required to open it; on an existing account a new password signs every
     *  staff device out. */
    async saveStaff(
      token: string | undefined,
      input: { name: string; username: string; password?: string }
    ): Promise<AuthResult<{ staff: StaffAccountInfo | null }>> {
      const found = await resolveAdmin(token);
      if ("error" in found) return { success: false, error: "unknown", errorMessage: found.error };
      const name = cleanText(input.name);
      const username = cleanText(input.username);
      const password = input.password || undefined;
      const error = validateProfile(name, username) ?? (password ? validatePasswordPolicy(password) : null);
      if (error) return { success: false, error: "unknown", errorMessage: error };
      const { all, staff } = await accounts();
      if (usernameTaken(all, username, STAFF_ACCOUNT_ID)) return { success: false, error: "unknown", errorMessage: USERNAME_TAKEN_MESSAGE };

      if (!staff) {
        if (!password) return { success: false, error: "unknown", errorMessage: "Personel hesabı için bir şifre belirleyin." };
        const created: AccountRow = {
          id: STAFF_ACCOUNT_ID,
          role: "staff",
          username,
          name,
          passwordHash: await hashPassword(password),
          credentialVersion: new Date().toISOString(),
          failedAttempts: 0,
          lockedUntil: null,
          lastLoginAt: null,
        };
        await repo.createAccount(created);
        return { success: true, data: { staff: staffInfo(created) } };
      }
      const patch: Partial<AccountRow> = { name, username };
      if (password) {
        patch.passwordHash = await hashPassword(password);
        patch.credentialVersion = new Date().toISOString();
      }
      await repo.updateAccount(STAFF_ACCOUNT_ID, patch);
      return { success: true, data: { staff: staffInfo({ ...staff, ...patch }) } };
    },

    /** Admin only: closes the staff account; its devices are signed out. */
    async deleteStaff(token: string | undefined): Promise<AuthResult> {
      const found = await resolveAdmin(token);
      if ("error" in found) return { success: false, error: "unknown", errorMessage: found.error };
      await repo.deleteAccount(STAFF_ACCOUNT_ID);
      return { success: true };
    },
  };
}

export type AuthCore = ReturnType<typeof createAuthCore>;
