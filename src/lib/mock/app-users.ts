import type { AppUser } from "@/types/settings";

// One seeded account per system role (see src/lib/auth/roles.ts) so every
// role can be exercised end-to-end against the real route/nav guards. All
// share the password "Demo1234!" — see credentials.ts. "user-owner" is the
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
    email: "admin@ornekokul.com",
    roleId: "role-owner",
    status: "active",
    lastLoginAt: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-admin",
    tenantId: "tenant-1",
    name: "Kurum Müdürü",
    email: "mudur@ornekokul.com",
    roleId: "role-admin",
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-teacher",
    tenantId: "tenant-1",
    name: "Ayşe Kaya",
    email: "ogretmen@ornekokul.com",
    roleId: "role-teacher",
    status: "active",
    teacherId: "teacher-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "user-guardian",
    tenantId: "tenant-1",
    name: "Ahmet Yıldırım",
    email: "veli@ornekokul.com",
    roleId: "role-guardian",
    status: "active",
    guardianId: "guardian-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
];
