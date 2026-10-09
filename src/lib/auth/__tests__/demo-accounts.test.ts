import { describe, expect, it } from "vitest";
import { verifyPassword } from "@/lib/auth/password";
import { migrateLegacyDemoAccounts, mockAppUsers } from "@/lib/mock/app-users";
import { mockCredentials } from "@/lib/mock/credentials";
import type { AppUser } from "@/types/settings";
import type { Credential } from "@/types/auth";

describe("demo accounts", () => {
  it("every seed account signs in with its username and password 1", async () => {
    for (const name of ["admin", "mudur", "ayse.kaya@egitim.com", "ahmet@gmail.com"]) {
      const user = mockAppUsers.find((u) => u.email === name)!;
      const credential = mockCredentials.find((c) => c.userId === user.id)!;
      expect(await verifyPassword("1", credential)).toBe(true);
    }
  });

  it("moves a persisted legacy seed account to the new username and password, clearing a lockout", async () => {
    const legacyUser: AppUser = {
      ...mockAppUsers[3],
      email: "veli@ornekokul.com",
      status: "locked",
      failedLoginAttempts: 3,
      lockedUntil: "2099-01-01T00:00:00.000Z",
    };
    const legacyCredential: Credential = { userId: legacyUser.id, salt: "x", hash: "old", updatedAt: "2024-01-01T00:00:00Z" };
    const custom: AppUser = { ...mockAppUsers[0], id: "user-custom", email: "zeynep@kurum.com" };
    const customCredential: Credential = { userId: "user-custom", salt: "y", hash: "keep", updatedAt: "2024-01-01T00:00:00Z" };

    const { users, credentials } = migrateLegacyDemoAccounts([legacyUser, custom], [legacyCredential, customCredential]);

    const veli = users.find((u) => u.id === legacyUser.id)!;
    expect(veli).toMatchObject({ email: "ahmet@gmail.com", status: "active", failedLoginAttempts: 0, lockedUntil: undefined });
    expect(await verifyPassword("1", credentials.find((c) => c.userId === veli.id)!)).toBe(true);
    expect(users.find((u) => u.id === "user-custom")!.email).toBe("zeynep@kurum.com");
    expect(credentials.find((c) => c.userId === "user-custom")!.hash).toBe("keep");
  });

  it("leaves already-migrated data untouched", () => {
    const input = { users: [...mockAppUsers], credentials: [...mockCredentials] };
    const out = migrateLegacyDemoAccounts(input.users, input.credentials);
    expect(out.users).toBe(input.users);
    expect(out.credentials).toBe(input.credentials);
  });
});
