import type { Credential } from "@/types/auth";

// ─── Seed credentials for the 4 demo QA accounts ────────────────────────────
//
// Every seeded account (see app-users.ts) shares the password "1" for QA
// convenience. Sign-in never re-checks the password policy, so the seed can
// be shorter than the policy allows; new passwords still follow it. Hashes below were
// generated once via the exact same salt+password -> SHA-256 digest
// LocalAuthService/password.ts uses at runtime (see hashPassword/verifyPassword)
// — never store plaintext in this file, only the resulting salt+hash.

const now = "2024-01-01T00:00:00Z";

export const mockCredentials: Credential[] = [
  { userId: "user-owner", salt: "1b504046b2749939f41cd71cb4f90b5c", hash: "db172bc64be7d53917d0e7947da88719acb3dfaa24e5d6e7b8a6669f279419c5", updatedAt: now },
  { userId: "user-admin", salt: "123957f19fa985fd187a7cb4a72c6253", hash: "05adc4fdc104866226617b29bd9e392a360234280d3562bd9abed368f8bfc7f2", updatedAt: now },
  { userId: "user-teacher", salt: "4a23ce44aed00d6731d5c96018af68ed", hash: "0849d16d50a00db1ff35854b507349c790d33b5a066fafd2b9b13cdfd0e632f2", updatedAt: now },
  { userId: "user-guardian", salt: "fa24d2e8225d5fab44873f0e1c2e400a", hash: "3c32515401efc06e0fbf85dc46f355b0b1aa524ee42df9da1ded10252f12ac1d", updatedAt: now },
];
