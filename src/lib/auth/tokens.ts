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

/** The /accept-invite link an admin hands to an invited user (no email
 *  delivery yet — see the Davetler tab). */
export function buildInviteLink(token: string): string {
  return typeof window !== "undefined" ? `${window.location.origin}/accept-invite?token=${token}` : `/accept-invite?token=${token}`;
}
