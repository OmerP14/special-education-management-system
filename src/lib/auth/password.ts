import { PASSWORD_MIN_LENGTH, PASSWORD_RULES_TEXT } from "@/lib/auth/security-policy";

// ─── Password policy ────────────────────────────────────────────────────────
//
// Shared by the Profil form (instant feedback) and the server, which enforces
// it again before saving. Hashing lives only on the server
// (src/lib/server/password-hash.ts).

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
