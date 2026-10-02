import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const credential = await hashPassword("Demo1234!");
    expect(await verifyPassword("Demo1234!", credential)).toBe(true);
    expect(await verifyPassword("demo1234!", credential)).toBe(false);
  });

  it("salts each hash", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });
});
