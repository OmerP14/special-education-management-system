import type { Credential } from "@/types/auth";

// ─── Seed credentials for the 4 demo QA accounts ────────────────────────────
//
// Every seeded account (see app-users.ts) shares the password "Demo1234!"
// for QA convenience — satisfies institutionSettings.security's default
// complexity rules (min length 8, uppercase, number). Hashes below were
// generated once via the exact same salt+password -> SHA-256 digest
// LocalAuthService/password.ts uses at runtime (see hashPassword/verifyPassword)
// — never store plaintext in this file, only the resulting salt+hash.

const now = "2024-01-01T00:00:00Z";

export const mockCredentials: Credential[] = [
  { userId: "user-owner", salt: "1b504046b2749939f41cd71cb4f90b5c", hash: "4ea74103830f0fd818ff36cb1e09fd54f4f61b40336dc6dcdea15fbe19280157", updatedAt: now },
  { userId: "user-admin", salt: "123957f19fa985fd187a7cb4a72c6253", hash: "6159799e60c6a02760ef7376aa19b3531c039fd6b413ea65c7c07d923cc2bf5f", updatedAt: now },
  { userId: "user-teacher", salt: "4a23ce44aed00d6731d5c96018af68ed", hash: "d0d31403a25e9efebe3870d74bc6c4577c73d4fd73526411c1c9eb23c4e164c9", updatedAt: now },
  { userId: "user-guardian", salt: "fa24d2e8225d5fab44873f0e1c2e400a", hash: "a7e55065aa3230287ede2af57a5d84731be8fe34e68b87744b788a73b3d134cd", updatedAt: now },
];
