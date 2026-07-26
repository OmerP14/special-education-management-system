// Random single-use tokens for invitations/password resets — same Web
// Crypto primitive password.ts uses for salts, just named for its own
// purpose so callers don't read "hashPassword's salt generator" out of
// context.

export function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
