import { beforeEach, describe, expect, it } from "vitest";
import { createAuthCore, hashToken, type AccountRow, type AuthRepo, type ClientLockRow, type SessionRow } from "@/lib/server/auth-core";
import { hashPassword, verifyPassword } from "@/lib/server/password-hash";
import { ACCOUNT_MAX_FAILED_ATTEMPTS, MAX_FAILED_LOGIN_ATTEMPTS } from "@/lib/auth/security-policy";
import { validatePasswordPolicy } from "@/lib/auth/password";

// An in-memory AuthRepo standing in for Postgres. Each "device" is the token
// its cookie would hold, and its name doubles as its network address.

const PASSWORD = "Demo1234!";

let stored: AccountRow | null;
let sessions: Map<string, SessionRow>;
let clientLocks: Map<string, ClientLockRow>;
const tokens: Record<string, string | undefined> = {};

const repo: AuthRepo = {
  getAccount: async () => (stored ? { ...stored } : null),
  createAccount: async (a) => {
    if (stored) return false;
    stored = { ...a };
    return true;
  },
  updateAccount: async (patch) => {
    if (stored) stored = { ...stored, ...patch };
  },
  createSession: async (s) => void sessions.set(s.tokenHash, { ...s }),
  getSession: async (h) => sessions.get(h) ?? null,
  updateSession: async (h, patch) => {
    const s = sessions.get(h);
    if (s) sessions.set(h, { ...s, ...patch });
  },
  deleteSession: async (h) => void sessions.delete(h),
  getClientLock: async (k) => clientLocks.get(k) ?? null,
  saveClientLock: async (k, lock) => void clientLocks.set(k, { ...lock }),
  clearClientLock: async (k) => void clientLocks.delete(k),
};

const auth = createAuthCore(repo);

async function signIn(device = "laptop", password = PASSWORD, username = "admin") {
  const { result, token } = await auth.signIn({ username, password, remember: true, clientKey: device });
  if (token) tokens[device] = token;
  return result;
}

const userOn = (device = "laptop") => auth.getUser(tokens[device]);

beforeEach(async () => {
  stored = {
    username: "admin",
    name: "Yönetici",
    passwordHash: await hashPassword(PASSWORD),
    credentialVersion: "2026-01-01T00:00:00.000Z",
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
  };
  sessions = new Map();
  clientLocks = new Map();
  for (const k of Object.keys(tokens)) delete tokens[k];
});

describe("password hashing", () => {
  it("verifies the right password, rejects a wrong one, and salts each hash", async () => {
    const a = await hashPassword("Gizli1!");
    expect(await verifyPassword("Gizli1!", a)).toBe(true);
    expect(await verifyPassword("gizli1!", a)).toBe(false);
    expect(a).not.toBe(await hashPassword("Gizli1!"));
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
  });
});

describe("first-run setup", () => {
  beforeEach(() => {
    stored = null;
  });

  it("needs setup until an account exists; sign-in is refused meanwhile", async () => {
    expect(await auth.needsSetup()).toBe(true);
    const result = await signIn();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("kurulmadı");
  });

  it("creates the account, signs this device in, and then can't run again", async () => {
    const { result, token } = await auth.setup({ name: " Ali Veli ", username: "merkez", password: "Kurum1!" });
    expect(result.success).toBe(true);
    expect(await auth.getUser(token)).toMatchObject({ name: "Ali Veli", username: "merkez" });
    expect(await auth.needsSetup()).toBe(false);
    expect((await signIn("x", "Kurum1!", "MERKEZ")).success).toBe(true);

    const again = await auth.setup({ name: "Kötü", username: "ele", password: "Gecir1!" });
    expect(again.result.success).toBe(false);
    expect(again.token).toBeUndefined();
    expect(stored?.username).toBe("merkez");
  });

  it("checks the fields and the password policy", async () => {
    expect((await auth.setup({ name: "", username: "a", password: "Kurum1!" })).result.success).toBe(false);
    expect((await auth.setup({ name: "a", username: "a b", password: "Kurum1!" })).result.success).toBe(false);
    expect((await auth.setup({ name: "a", username: "a", password: "1" })).result.errorMessage).toContain("en az 6");
    expect(await auth.needsSetup()).toBe(true);
  });
});

describe("signIn", () => {
  it("signs in case-insensitively, trims, and resets the failure counter", async () => {
    stored!.failedAttempts = 2;
    expect((await signIn("laptop", PASSWORD, "  ADMIN ")).success).toBe(true);
    expect(stored!.failedAttempts).toBe(0);
    expect(await userOn()).toMatchObject({ username: "admin", name: "Yönetici" });
  });

  it("matches dotted and dotless i in either case", async () => {
    for (const typed of ["ADMIN", "Admin", "admın", "ADMİN"]) {
      expect((await signIn("laptop", PASSWORD, typed)).success).toBe(true);
    }
    stored!.username = "yılmaz";
    expect((await signIn("laptop", PASSWORD, "YILMAZ")).success).toBe(true);
  });

  it("gives the same message for a wrong username and a wrong password", async () => {
    const wrongUser = await signIn("laptop", PASSWORD, "yok");
    const wrongPassword = await signIn("laptop", "Yanlis123");
    expect(wrongUser.errorMessage).toBe(wrongPassword.errorMessage);
  });

  it("locks the device for 5 minutes after 5 wrong passwords and rejects even the right one", async () => {
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) await signIn("laptop", "Yanlis1!");
    const lockedFor = new Date(clientLocks.get("laptop")!.lockedUntil!).getTime() - Date.now();
    expect(lockedFor).toBeGreaterThan(4 * 60_000);
    expect(lockedFor).toBeLessThanOrEqual(5 * 60_000);
    const result = await signIn();
    expect(result.error).toBe("account_locked");
    expect(result.lockedUntil).toBeDefined();
  });

  it("one person's wrong passwords don't lock the others sharing the account", async () => {
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) await signIn("laptop", "Yanlis1!");
    expect((await signIn("laptop")).success).toBe(false);
    expect((await signIn("phone")).success).toBe(true);
    expect((await signIn("tablet")).success).toBe(true);
  });

  it("locks the whole account when wrong passwords pile up from many addresses", async () => {
    for (let i = 0; i < ACCOUNT_MAX_FAILED_ATTEMPTS; i++) await signIn(`attacker-${i}`, "Yanlis1!");
    expect(stored!.lockedUntil).not.toBeNull();
    expect((await signIn("office")).error).toBe("account_locked");
  });

  it("unlocks silently once the lock has expired, with a fresh attempt count", async () => {
    clientLocks.set("laptop", { failures: 5, lockedUntil: new Date(Date.now() - 1000).toISOString() });
    await signIn("laptop", "Yanlis1!");
    expect(clientLocks.get("laptop")!.failures).toBe(1);
    expect((await signIn()).success).toBe(true);
    expect(clientLocks.has("laptop")).toBe(false);
  });

  it("keeps only a hash of the token in the database", async () => {
    await signIn();
    expect(sessions.has(tokens.laptop!)).toBe(false);
    expect(sessions.has(hashToken(tokens.laptop!))).toBe(true);
  });
});

describe("sessions", () => {
  it("treats a missing, unknown or expired token as signed out", async () => {
    expect(await auth.getUser(undefined)).toBeNull();
    expect(await auth.getUser("made-up")).toBeNull();
    await signIn();
    const s = sessions.get(hashToken(tokens.laptop!))!;
    s.expiresAt = new Date(Date.now() - 1000).toISOString();
    expect(await userOn()).toBeNull();
  });

  it("lets two devices hold a session; signing out one leaves the other", async () => {
    await signIn("laptop");
    await signIn("phone");
    await auth.signOut(tokens.phone);
    expect(await userOn("phone")).toBeNull();
    expect(await userOn("laptop")).not.toBeNull();
  });

  it("a password change keeps this device signed in and signs every other device out", async () => {
    await signIn("laptop");
    await signIn("phone");
    expect((await auth.changePassword(tokens.laptop, { currentPassword: PASSWORD, newPassword: "Yeni123!", clientKey: "laptop" })).success).toBe(true);
    expect(await userOn("laptop")).not.toBeNull();
    expect(await userOn("phone")).toBeNull();
    expect((await signIn("phone", "Yeni123!")).success).toBe(true);
  });
});

describe("changePassword", () => {
  const NEW = "Yeni123!";

  it("changes the password; the old one stops working", async () => {
    await signIn();
    expect((await auth.changePassword(tokens.laptop, { currentPassword: PASSWORD, newPassword: NEW, clientKey: "laptop" })).success).toBe(true);
    expect((await signIn("x", PASSWORD)).success).toBe(false);
    expect((await signIn("x", NEW)).success).toBe(true);
  });

  it("refuses without a session", async () => {
    const result = await auth.changePassword(undefined, { currentPassword: PASSWORD, newPassword: NEW, clientKey: "laptop" });
    expect(result.success).toBe(false);
    expect(result.signedOut).toBe(true);
  });

  it("rejects reusing the current password and passwords outside the policy", async () => {
    await signIn();
    expect((await auth.changePassword(tokens.laptop, { currentPassword: PASSWORD, newPassword: PASSWORD, clientKey: "laptop" })).errorMessage).toContain("aynı olamaz");
    expect((await auth.changePassword(tokens.laptop, { currentPassword: PASSWORD, newPassword: "kisa", clientKey: "laptop" })).success).toBe(false);
  });

  it("counts down the remaining attempts on a wrong current password", async () => {
    await signIn();
    const result = await auth.changePassword(tokens.laptop, { currentPassword: "Yanlis1!", newPassword: NEW, clientKey: "laptop" });
    expect(result.errorMessage).toContain(`${MAX_FAILED_LOGIN_ATTEMPTS - 1} deneme`);
  });

  it("locks sign-in and ends the session after too many wrong current passwords", async () => {
    await signIn();
    let last;
    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      last = await auth.changePassword(tokens.laptop, { currentPassword: "Yanlis1!", newPassword: NEW, clientKey: "laptop" });
    }
    expect(clientLocks.get("laptop")?.lockedUntil).toBeTruthy();
    expect(last?.signedOut).toBe(true);
    expect(await userOn()).toBeNull();
  });
});

describe("updateProfile", () => {
  it("renames the account; sign-in then uses the new username", async () => {
    await signIn();
    const result = await auth.updateProfile(tokens.laptop, { name: " Kurum ", username: "merkez" });
    expect(result.data?.user).toMatchObject({ name: "Kurum", username: "merkez" });
    expect((await signIn("x", PASSWORD, "MERKEZ")).success).toBe(true);
  });

  it("drops control characters such as NUL from the name and username", async () => {
    await signIn();
    const result = await auth.updateProfile(tokens.laptop, { name: "Ku\u0000rum", username: "mer\u0000kez" });
    expect(result.data?.user).toMatchObject({ name: "Kurum", username: "merkez" });
  });

  it("rejects empty values and spaces in the username", async () => {
    await signIn();
    expect((await auth.updateProfile(tokens.laptop, { name: "", username: "a" })).success).toBe(false);
    expect((await auth.updateProfile(tokens.laptop, { name: "a", username: "a b" })).success).toBe(false);
    expect((await auth.updateProfile(undefined, { name: "a", username: "b" })).success).toBe(false);
  });
});

describe("validatePasswordPolicy", () => {
  it("accepts Turkish uppercase letters and lists every missing rule", () => {
    expect(validatePasswordPolicy("şifreĞ1.")).toBeNull();
    expect(validatePasswordPolicy("abc")).toBe("Şifre en az 6 karakter, bir büyük harf, bir rakam, bir özel karakter (. ! @ # gibi) içermelidir.");
  });
});
