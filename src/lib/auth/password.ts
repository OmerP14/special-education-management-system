import { PASSWORD_MIN_LENGTH, PASSWORD_RULES_TEXT } from "@/lib/auth/security-policy";
// ─── Browser-only password hashing ──────────────────────────────────────────
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

/** The fixed password policy (lib/auth/security-policy.ts). Returns a
 *  Turkish error message, or null when the password satisfies every rule. */
export function validatePasswordPolicy(password: string): string | null {
  const missing: string[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) missing.push(`en az ${PASSWORD_MIN_LENGTH} karakter`);
  if (!/[A-ZÇĞİÖŞÜ]/.test(password)) missing.push("bir büyük harf");
  if (!/\d/.test(password)) missing.push("bir rakam");
  if (!/[^A-Za-z0-9ÇĞİÖŞÜçğıöşü\s]/.test(password)) missing.push("bir özel karakter (. ! @ # gibi)");
  return missing.length > 0 ? `Şifre ${missing.join(", ")} içermelidir.` : null;
}

/** Hint text for new-password fields. */
export function describePasswordPolicy(): string {
  return PASSWORD_RULES_TEXT;
}
