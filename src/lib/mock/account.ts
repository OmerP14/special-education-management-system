import type { Account, Credential } from "@/types/auth";

// ─── The single institution account (seed) ──────────────────────────────────
//
// Username "admin", password "1" for QA convenience. Sign-in never re-checks
// the password policy, so the seed can be shorter than the policy allows; a
// new password set from the Profil page still follows it. The hash was made
// with the same salt+password -> SHA-256 digest password.ts uses at runtime —
// never store plaintext here.

export const mockAccount: Account = {
  username: "admin",
  name: "Yönetici",
};

export const mockCredential: Credential = {
  salt: "1b504046b2749939f41cd71cb4f90b5c",
  hash: "db172bc64be7d53917d0e7947da88719acb3dfaa24e5d6e7b8a6669f279419c5",
  updatedAt: "2024-01-01T00:00:00Z",
};
