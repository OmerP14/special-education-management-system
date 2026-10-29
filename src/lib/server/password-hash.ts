import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// ─── Server-side password hashing ───────────────────────────────────────────
//
// scrypt from Node's own crypto — memory-hard, no npm dependency. Stored as
// "scrypt$<salt hex>$<hash hex>" so the format can change later without a
// migration: verifyPassword rejects anything it doesn't recognise.

const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFC"), salt, KEY_LENGTH, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const key = await derive(password, Buffer.from(saltHex, "hex"));
  return key.length === expected.length && timingSafeEqual(key, expected);
}
