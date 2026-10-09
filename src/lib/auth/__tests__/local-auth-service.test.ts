import { beforeEach, describe, expect, it } from "vitest";
import { createLocalAuthService, type LocalAuthDeps } from "@/lib/auth/local-auth-service";
import { hashPassword, validatePasswordPolicy } from "@/lib/auth/password";
import { MAX_FAILED_LOGIN_ATTEMPTS } from "@/lib/auth/security-policy";
import type { AppUser, AuditLogEntry } from "@/types/settings";
import type { AuthSession, Credential, Invitation, PasswordResetToken, Role } from "@/types/auth";

// A tiny in-memory stand-in for the mock store: every setter mutates `db`,
// and `service()` rebuilds the service over the latest snapshot — the same
// way AuthProvider re-creates it whenever store state changes.

const PASSWORD = "Demo1234!";


const role: Role = { id: "role-admin", key: "admin", name: "Yönetici", permissions: [], isActive: true } as unknown as Role;

interface Db {
  appUsers: AppUser[];
  credentials: Credential[];
  invitations: Invitation[];
  passwordResets: PasswordResetToken[];
  session: AuthSession | null;
  audit: Omit<AuditLogEntry, "id" | "tenantId" | "occurredAt">[];
}

let db: Db;

function user(overrides: Partial<AppUser> = {}): AppUser {
  return {
    id: "u1",
    tenantId: "tenant-1",
    name: "Ayşe",
    email: "ayse@ornek.com",
    roleId: role.id,
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as AppUser;
}

function service() {
  const deps: LocalAuthDeps = {
    appUsers: db.appUsers,
    credentials: db.credentials,
    roles: [role],
    invitations: db.invitations,
    passwordResets: db.passwordResets,
    session: db.session,
    saveAuthUserState: (u) => (db.appUsers = db.appUsers.map((x) => (x.id === u.id ? u : x))),
    setCredential: (c) => (db.credentials = [...db.credentials.filter((x) => x.userId !== c.userId), c]),
    setAuthSession: (s) => (db.session = s),
    setInvitation: (i) => (db.invitations = db.invitations.map((x) => (x.id === i.id ? i : x))),
    setPasswordReset: (t) => (db.passwordResets = [...db.passwordResets.filter((x) => x.token !== t.token), t]),
    logAuditEvent: (e) => db.audit.push(e),
  };
  return createLocalAuthService(deps);
}

beforeEach(async () => {
  const { salt, hash } = await hashPassword(PASSWORD);
  db = {
    appUsers: [user()],
    credentials: [{ userId: "u1", salt, hash, updatedAt: "" }],
    invitations: [],
    passwordResets: [],
    session: null,
    audit: [],
  };
});

describe("signIn", () => {
  it("signs in case-insensitively and resets the failure counter", async () => {
    db.appUsers = [user({ failedLoginAttempts: 2 })];
    const result = await service().signIn({ email: "  AYSE@ornek.com ", password: PASSWORD });
    expect(result.success).toBe(true);
    expect(db.session?.userId).toBe("u1");
    expect(db.appUsers[0].failedLoginAttempts).toBe(0);
  });

  it("gives the same message for an unknown email and a wrong password", async () => {
    const unknown = await service().signIn({ email: "yok@ornek.com", password: PASSWORD });
    const wrong = await service().signIn({ email: "ayse@ornek.com", password: "Yanlis123" });
    expect(unknown.errorMessage).toBe(wrong.errorMessage);
  });

  it("locks after the threshold and rejects even the right password while locked", async () => {
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      await service().signIn({ email: "ayse@ornek.com", password: "Yanlis123" });
    }
    expect(db.appUsers[0].status).toBe("locked");
    const result = await service().signIn({ email: "ayse@ornek.com", password: PASSWORD });
    expect(result.error).toBe("account_locked");
  });

  it("unlocks silently once the lock has expired", async () => {
    db.appUsers = [user({ status: "locked", failedLoginAttempts: 3, lockedUntil: new Date(Date.now() - 1000).toISOString() })];
    const result = await service().signIn({ email: "ayse@ornek.com", password: PASSWORD });
    expect(result.success).toBe(true);
    expect(db.appUsers[0].status).toBe("active");
  });

  it("rejects inactive and invited accounts", async () => {
    db.appUsers = [user({ status: "inactive" })];
    expect((await service().signIn({ email: "ayse@ornek.com", password: PASSWORD })).error).toBe("account_inactive");
    db.appUsers = [user({ status: "invited" })];
    expect((await service().signIn({ email: "ayse@ornek.com", password: PASSWORD })).error).toBe("account_invited");
  });

  it("does not let a wrong password on an inactive account reactivate it", async () => {
    db.appUsers = [user({ status: "inactive" })];
    await service().signIn({ email: "ayse@ornek.com", password: "Yanlis123" });
    expect(db.appUsers[0].status).toBe("inactive");
  });
});

describe("getCurrentUser", () => {
  it("drops the session user once the account is deactivated", async () => {
    await service().signIn({ email: "ayse@ornek.com", password: PASSWORD });
    db.appUsers = [user({ status: "inactive" })];
    expect(service().getCurrentUser()).toBeNull();
  });
});

describe("password reset", () => {
  async function requestToken() {
    const result = await service().requestPasswordReset("ayse@ornek.com");
    return (result.data as { token: string }).token;
  }

  it("resets the password once and refuses to reuse the token", async () => {
    const token = await requestToken();
    expect((await service().resetPassword({ token, newPassword: "Yeni123!" })).success).toBe(true);
    expect((await service().signIn({ email: "ayse@ornek.com", password: "Yeni123!" })).success).toBe(true);
    expect((await service().resetPassword({ token, newPassword: "Baska12345" })).success).toBe(false);
  });

  it("enforces the password policy", async () => {
    const token = await requestToken();
    expect((await service().resetPassword({ token, newPassword: "kisa" })).success).toBe(false);
  });

  it("invalidates older reset links once one has been used", async () => {
    const first = await requestToken();
    const second = await requestToken();
    await service().resetPassword({ token: second, newPassword: "Yeni123!" });
    expect((await service().resetPassword({ token: first, newPassword: "Baska12345" })).success).toBe(false);
  });

  it("lets a locked-out user sign in after resetting the password", async () => {
    db.appUsers = [user({ status: "locked", failedLoginAttempts: 3, lockedUntil: new Date(Date.now() + 600_000).toISOString() })];
    const token = await requestToken();
    await service().resetPassword({ token, newPassword: "Yeni123!" });
    expect((await service().signIn({ email: "ayse@ornek.com", password: "Yeni123!" })).success).toBe(true);
  });
});

describe("acceptInvitation", () => {
  function invite(overrides: Partial<Invitation> = {}): Invitation {
    return {
      id: "inv1",
      tenantId: "tenant-1",
      token: "tok",
      userId: "u1",
      email: "ayse@ornek.com",
      roleId: role.id,
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: "",
      createdBy: "Sahip",
      ...overrides,
    };
  }

  it("activates the invited user and signs them in", async () => {
    db.appUsers = [user({ status: "invited" })];
    db.credentials = [];
    db.invitations = [invite()];
    const result = await service().acceptInvitation({ token: "tok", password: "Yeni123!" });
    expect(result.success).toBe(true);
    expect(db.appUsers[0].status).toBe("active");
    expect(db.invitations[0].status).toBe("accepted");
    expect(db.session?.userId).toBe("u1");
  });

  it("rejects expired and revoked invitations", async () => {
    db.appUsers = [user({ status: "invited" })];
    db.invitations = [invite({ expiresAt: new Date(Date.now() - 1).toISOString() })];
    expect((await service().acceptInvitation({ token: "tok", password: "Yeni123!" })).success).toBe(false);
    db.invitations = [invite({ status: "revoked" })];
    expect((await service().acceptInvitation({ token: "tok", password: "Yeni123!" })).success).toBe(false);
  });

  it("does not reactivate a user who was deactivated after being invited", async () => {
    db.appUsers = [user({ status: "inactive" })];
    db.invitations = [invite()];
    const result = await service().acceptInvitation({ token: "tok", password: "Yeni123!" });
    expect(result.success).toBe(false);
    expect(db.appUsers[0].status).toBe("inactive");
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

describe("changePassword", () => {
  const NEW = "Yeni123!";
  async function signedIn() {
    await service().signIn({ email: "ayse@ornek.com", password: PASSWORD });
  }

  it("changes the signed-in user's own password; the old one stops working", async () => {
    await signedIn();
    expect((await service().changePassword({ userId: "u1", currentPassword: PASSWORD, newPassword: NEW })).success).toBe(true);
    await service().signOut();
    expect((await service().signIn({ email: "ayse@ornek.com", password: PASSWORD })).success).toBe(false);
    expect((await service().signIn({ email: "ayse@ornek.com", password: NEW })).success).toBe(true);
  });

  it("refuses to change another user's password, or without a session", async () => {
    expect((await service().changePassword({ userId: "u1", currentPassword: PASSWORD, newPassword: NEW })).success).toBe(false);
    await signedIn();
    expect((await service().changePassword({ userId: "u2", currentPassword: PASSWORD, newPassword: NEW })).success).toBe(false);
  });

  it("rejects reusing the current password and passwords outside the policy", async () => {
    await signedIn();
    expect((await service().changePassword({ userId: "u1", currentPassword: PASSWORD, newPassword: PASSWORD })).errorMessage).toContain("aynı olamaz");
    expect((await service().changePassword({ userId: "u1", currentPassword: PASSWORD, newPassword: "kisa" })).success).toBe(false);
  });

  it("locks the account and ends the session after too many wrong current passwords", async () => {
    await signedIn();
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      await service().changePassword({ userId: "u1", currentPassword: "Yanlis1!", newPassword: NEW });
    }
    expect(db.appUsers[0].status).toBe("locked");
    expect(db.session).toBeNull();
  });

  it("invalidates reset links requested before the change", async () => {
    await signedIn();
    db.passwordResets = [{ token: "r1", userId: "u1", expiresAt: new Date(Date.now() + 60_000).toISOString(), createdAt: "" }];
    await service().changePassword({ userId: "u1", currentPassword: PASSWORD, newPassword: NEW });
    expect((await service().resetPassword({ token: "r1", newPassword: "Baska1!x" })).success).toBe(false);
  });
});

describe("fixed lockout policy", () => {
  it("locks for 5 minutes after 3 wrong passwords", async () => {
    for (let i = 0; i < 3; i++) await service().signIn({ email: "ayse@ornek.com", password: "Yanlis1!" });
    const lockedFor = new Date(db.appUsers[0].lockedUntil!).getTime() - Date.now();
    expect(db.appUsers[0].status).toBe("locked");
    expect(lockedFor).toBeGreaterThan(4 * 60_000);
    expect(lockedFor).toBeLessThanOrEqual(5 * 60_000);
  });
});
