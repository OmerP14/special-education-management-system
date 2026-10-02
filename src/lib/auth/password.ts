import type { SecuritySettings } from "@/types/settings";
// ─── Mock-only password hashing ─────────────────────────────────────────────
//
// SHA-256 via the browser's native Web Crypto API — no npm dependency. This
// is NOT how a real backend should ever hash passwords (no bcrypt/argon2,
// no configurable work factor) — it exists solely so Phase 1's LocalAuthService
// doesn't store plaintext passwords in localStorage. Must be replaced
// wholesale by Supabase Auth (or any real backend auth) before production;
// see the plan's "Deferred to later phases" / production migration notes.

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes.buffer);
}

async function digest(salt: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(hashBuffer);
}

export async function hashPassword(
  password: string,
  salt: string = randomSalt()
): Promise<{ salt: string; hash: string }> {
  const hash = await digest(salt, password);
  return { salt, hash };
}

export async function verifyPassword(
  password: string,
  credential: { salt: string; hash: string }
): Promise<boolean> {
  const hash = await digest(credential.salt, password);
  return hash === credential.hash;
}

/** Ayarlar → Güvenlik ve Sistem → Parola Politikası. Returns a Turkish error
 *  message, or null when the password satisfies every rule. */
export function validatePasswordPolicy(
  password: string,
  policy: Pick<SecuritySettings, "passwordMinLength" | "requireUppercase" | "requireNumber" | "requireSpecialChar">
): string | null {
  const missing: string[] = [];
  if (password.length < policy.passwordMinLength) missing.push(`en az ${policy.passwordMinLength} karakter`);
  if (policy.requireUppercase && !/[A-ZÇĞİÖŞÜ]/.test(password)) missing.push("bir büyük harf");
  if (policy.requireNumber && !/\d/.test(password)) missing.push("bir rakam");
  if (policy.requireSpecialChar && !/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü]/.test(password)) missing.push("bir özel karakter");
  return missing.length > 0 ? `Şifre ${missing.join(", ")} içermelidir.` : null;
}

/** Human-readable summary of the current policy, for form hints. */
export function describePasswordPolicy(
  policy: Pick<SecuritySettings, "passwordMinLength" | "requireUppercase" | "requireNumber" | "requireSpecialChar">
): string {
  const parts = [`En az ${policy.passwordMinLength} karakter`];
  if (policy.requireUppercase) parts.push("büyük harf");
  if (policy.requireNumber) parts.push("rakam");
  if (policy.requireSpecialChar) parts.push("özel karakter");
  return parts.join(", ") + ".";
}
