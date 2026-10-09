import type { AppUser } from "@/types/settings";
import type { Credential } from "@/types/auth";
import { mockCredentials } from "@/lib/mock/credentials";

// One seeded account per system role (see src/lib/auth/roles.ts) so every
// role can be exercised end-to-end against the real route/nav guards. All
// share the password "1". Unlinked staff use plain usernames (admin, mudur);
// teacher/guardian accounts use their linked record's e-mail — see credentials.ts. "user-owner" is the
// same identity the app previously hardcoded as CURRENT_USER (now replaced
// by real sign-in via useAuth()).
//
// Phase 3 note: the seeded Muhasebe/Danışma/Görüntüleyici accounts (user-
// accounting/user-front-desk/user-viewer) were removed alongside their
// system roles — see migrateRemovedRoleId in lib/auth/roles.ts for how a
// REAL (non-seed) AppUser still pointing at one of those roleIds is
// migrated instead of just deleted.
export const mockAppUsers: AppUser[] = [
  {
    id: "user-owner",
    tenantId: "tenant-1",
    name: "Yönetici",
    email: "admin",
    roleId: "role-owner",
    status: "active",
    lastLoginAt: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-admin",
    tenantId: "tenant-1",
    name: "Kurum Müdürü",
    email: "mudur",
    roleId: "role-admin",
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-teacher",
    tenantId: "tenant-1",
    name: "Ayşe Kaya",
    // Linked to teacher-1 — signs in with that record's e-mail (linked-account.ts).
    email: "ayse.kaya@egitim.com",
    roleId: "role-teacher",
    status: "active",
    teacherId: "teacher-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-guardian",
    tenantId: "tenant-1",
    name: "Ahmet Yıldırım",
    // Linked to guardian-1 — signs in with that record's e-mail.
    email: "ahmet@gmail.com",
    roleId: "role-guardian",
    status: "active",
    guardianId: "guardian-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
];

// ─── Legacy demo-account migration ───────────────────────────────────────────
//
// The seed accounts used to be "<name>@ornekokul.com" / "Demo1234!". A browser
// that already persisted that snapshot would never see the new seed (the
// store only reads mockAppUsers when nothing is persisted), so on load any
// seed account still carrying its old address is moved to the new username,
// its credential reset to the new seed one, and any lockout from failed
// attempts against the new password cleared.
const LEGACY_DEMO_DOMAIN = "@ornekokul.com";

export function migrateLegacyDemoAccounts(
  users: AppUser[],
  credentials: Credential[]
): { users: AppUser[]; credentials: Credential[] } {
  const migratedIds = new Set<string>();
  const nextUsers = users.map((u) => {
    const seed = mockAppUsers.find((s) => s.id === u.id);
    if (!seed || !u.email.toLowerCase().endsWith(LEGACY_DEMO_DOMAIN)) return u;
    migratedIds.add(u.id);
    return {
      ...u,
      email: seed.email,
      status: u.status === "locked" ? "active" : u.status,
      failedLoginAttempts: 0,
      lockedUntil: undefined,
    };
  });
  if (migratedIds.size === 0) return { users, credentials };
  const nextCredentials = [
    ...credentials.filter((c) => !migratedIds.has(c.userId)),
    ...mockCredentials.filter((c) => migratedIds.has(c.userId)),
  ];
  return { users: nextUsers, credentials: nextCredentials };
}
