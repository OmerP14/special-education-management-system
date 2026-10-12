import { beforeEach, describe, expect, it } from "vitest";
import { createLocalAuthService } from "@/lib/auth/local-auth-service";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "@/lib/auth/password";
import { MAX_FAILED_LOGIN_ATTEMPTS } from "@/lib/auth/security-policy";
import { mockAccount, mockCredential } from "@/lib/mock/account";
import type { AuditLogEntry } from "@/types/settings";
import type { Account, AuthSession, Credential } from "@/types/auth";

// A tiny in-memory stand-in for the mock store. Each "device" has its own
// session, while the account and credential are shared — the same split the
// app has once several devices sign in to the one account.

const PASSWORD = "Demo1234!";

interface Db {
  account: Account;
  credential: Credential;
  sessions: Record<string, AuthSession | null>;
  audit: Omit<AuditLogEntry, "id" | "tenantId" | "occurredAt">[];
}

let db: Db;

function service(device = "laptop") {
  return createLocalAuthService({
    account: db.account,
    credential: db.credential,
    session: db.sessions[device] ?? null,
    saveAccountState: (a) => (db.account = a),
    setCredential: (c) => (db.credential = c),
    setAuthSession: (s) => (db.sessions[device] = s),
    logAuditEvent: (e) => db.audit.push(e),
  });
}

beforeEach(async () => {
  const { salt, hash } = await hashPassword(PASSWORD);
  db = {
    account: { username: "admin", name: "Yönetici" },
    credential: { salt, hash, updatedAt: "2026-01-01T00:00:00.000Z" },
    sessions: {},
    audit: [],
  };
});

describe("seed account", () => {
  it("signs in as admin with password 1", async () => {
    expect(mockAccount.username).toBe("admin");
    expect(await verifyPassword("1", mockCredential)).toBe(true);
  });
});

describe("signIn", () => {
  it("signs in case-insensitively, trims, and resets the failure counter", async () => {
    db.account = { ...db.account, failedLoginAttempts: 2 };
    const result = await service().signIn({ username: "  ADMIN ", password: PASSWORD });
    expect(result.success).toBe(true);
    expect(db.sessions.laptop).not.toBeNull();
    expect(db.account.failedLoginAttempts).toBe(0);
    expect(service().getCurrentUser()).toEqual({ username: "admin", name: "Yönetici" });
  });

  it("matches dotted and dotless i in either case (Turkish keyboards, phone auto-capitalisation)", async () => {
    for (const typed of ["ADMIN", "Admin", "admın", "ADMİN"]) {
      expect((await service().signIn({ username: typed, password: PASSWORD })).success).toBe(true);
    }
    db.account = { ...db.account, username: "yılmaz" };
    expect((await service().signIn({ username: "YILMAZ", password: PASSWORD })).success).toBe(true);
  });

  it("gives the same message for a wrong username and a wrong password", async () => {
    const wrongUser = await service().signIn({ username: "yok", password: PASSWORD });
    const wrongPassword = await service().signIn({ username: "admin", password: "Yanlis123" });
    expect(wrongUser.errorMessage).toBe(wrongPassword.errorMessage);
  });

  it("locks after the threshold and rejects even the right password while locked", async () => {
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      await service().signIn({ username: "admin", password: "Yanlis123" });
    }
    const result = await service().signIn({ username: "admin", password: PASSWORD });
    expect(result.error).toBe("account_locked");
    expect(result.lockedUntil).toBeDefined();
  });

  it("locks for 5 minutes after 3 wrong passwords", async () => {
    for (let i = 0; i < 3; i++) await service().signIn({ username: "admin", password: "Yanlis1!" });
    const lockedFor = new Date(db.account.lockedUntil!).getTime() - Date.now();
    expect(lockedFor).toBeGreaterThan(4 * 60_000);
    expect(lockedFor).toBeLessThanOrEqual(5 * 60_000);
  });

  it("unlocks silently once the lock has expired, with a fresh attempt count", async () => {
    db.account = { ...db.account, failedLoginAttempts: 3, lockedUntil: new Date(Date.now() - 1000).toISOString() };
    await service().signIn({ username: "admin", password: "Yanlis1!" });
    expect(db.account.failedLoginAttempts).toBe(1);
    expect((await service().signIn({ username: "admin", password: PASSWORD })).success).toBe(true);
  });
});

describe("several devices", () => {
  it("lets two devices hold a session at the same time", async () => {
    await service("laptop").signIn({ username: "admin", password: PASSWORD });
    await service("phone").signIn({ username: "admin", password: PASSWORD });
    expect(service("laptop").getCurrentUser()).not.toBeNull();
    expect(service("phone").getCurrentUser()).not.toBeNull();
  });

  it("signing out on one device leaves the other signed in", async () => {
    await service("laptop").signIn({ username: "admin", password: PASSWORD });
    await service("phone").signIn({ username: "admin", password: PASSWORD });
    await service("phone").signOut();
    expect(service("phone").getCurrentUser()).toBeNull();
    expect(service("laptop").getCurrentUser()).not.toBeNull();
  });

  it("a password change keeps this device signed in and signs every other device out", async () => {
    await service("laptop").signIn({ username: "admin", password: PASSWORD });
    await service("phone").signIn({ username: "admin", password: PASSWORD });
    expect((await service("laptop").changePassword({ currentPassword: PASSWORD, newPassword: "Yeni123!" })).success).toBe(true);
    expect(service("laptop").getCurrentUser()).not.toBeNull();
    expect(service("phone").getCurrentUser()).toBeNull();
    expect((await service("phone").signIn({ username: "admin", password: "Yeni123!" })).success).toBe(true);
  });

  it("a session from before the account existed (no version) counts as signed out", () => {
    db.sessions.laptop = { loginAt: "", remember: true } as unknown as AuthSession;
    expect(service().getCurrentUser()).toBeNull();
  });
});

describe("changePassword", () => {
  const NEW = "Yeni123!";
  const signedIn = () => service().signIn({ username: "admin", password: PASSWORD });

  it("changes the password; the old one stops working", async () => {
    await signedIn();
    expect((await service().changePassword({ currentPassword: PASSWORD, newPassword: NEW })).success).toBe(true);
    await service().signOut();
    expect((await service().signIn({ username: "admin", password: PASSWORD })).success).toBe(false);
    expect((await service().signIn({ username: "admin", password: NEW })).success).toBe(true);
  });

  it("refuses without a session", async () => {
    expect((await service().changePassword({ currentPassword: PASSWORD, newPassword: NEW })).success).toBe(false);
  });

  it("rejects reusing the current password and passwords outside the policy", async () => {
    await signedIn();
    expect((await service().changePassword({ currentPassword: PASSWORD, newPassword: PASSWORD })).errorMessage).toContain("aynı olamaz");
    expect((await service().changePassword({ currentPassword: PASSWORD, newPassword: "kisa" })).success).toBe(false);
  });

  it("counts down the remaining attempts on a wrong current password", async () => {
    await signedIn();
    const result = await service().changePassword({ currentPassword: "Yanlis1!", newPassword: NEW });
    expect(result.errorMessage).toContain(`${MAX_FAILED_LOGIN_ATTEMPTS - 1} deneme`);
  });

  it("locks sign-in and ends the session after too many wrong current passwords", async () => {
    await signedIn();
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      await service().changePassword({ currentPassword: "Yanlis1!", newPassword: NEW });
    }
    expect(db.account.lockedUntil).toBeDefined();
    expect(db.sessions.laptop).toBeNull();
  });
});

describe("validatePasswordPolicy", () => {
  it("accepts Turkish uppercase letters", () => {
    expect(validatePasswordPolicy("şifreĞ1.")).toBeNull();
  });

  it("lists every missing rule", () => {
    expect(validatePasswordPolicy("abc")).toBe("Şifre en az 6 karakter, bir büyük harf, bir rakam, bir özel karakter (. ! @ # gibi) içermelidir.");
  });
});
