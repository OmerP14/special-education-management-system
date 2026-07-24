import type { AppUser } from "@/types/settings";

// Matches CURRENT_USER in lib/permissions.ts by name/email — conceptually
// the same signed-in person, just seen here as a row in the future
// users/roles system rather than the topbar's hardcoded display identity.
export const mockAppUsers: AppUser[] = [
  {
    id: "user-1",
    tenantId: "tenant-1",
    name: "Yönetici",
    email: "admin@ornekokul.com",
    role: "owner",
    status: "active",
    lastLoginAt: new Date().toISOString(),
    createdAt: "2024-01-01T00:00:00Z",
  },
];
