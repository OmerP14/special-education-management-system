import type { Role, RoleKey } from "@/types/auth";
import { WILDCARD_PERMISSION } from "@/types/auth";
import { PERMISSION_KEYS } from "@/lib/auth/permission-catalog";

// ─── Seeded system roles ─────────────────────────────────────────────────────
//
// Phase 3 simplified this down to 4 system roles (was 7 in Phase 1/2) — see
// REMOVED_SYSTEM_ROLE_IDS below for the migration path for any AppUser still
// pointing at a removed role's id. An institution that needs a Muhasebe/
// Danışma/Görüntüleyici-equivalent role back creates it as a CUSTOM role
// (Settings → Kullanıcılar ve Roller → Roller → Yeni Rol) with whatever
// permission set fits — nothing about custom roles changed in this phase.
//
// `permissions` for a SYSTEM role is only mutated via updateRole from the
// Roller tab (Phase 2) — this file is just the seed / reset-to-demo source
// of truth, not read on every render.

const ALL_EXCEPT_SECURITY = PERMISSION_KEYS.filter((k) => k !== "settings.security.manage");

const now = "2024-01-01T00:00:00Z";

function role(input: Omit<Role, "createdAt" | "updatedAt">): Role {
  return { ...input, createdAt: now, updatedAt: now };
}

export const SYSTEM_ROLES: Role[] = [
  role({
    id: "role-owner",
    key: "owner",
    name: "Sahip",
    description: "Tam yetki — güvenlik, veri sıfırlama ve kullanıcı/rol yönetimi dahil her şeyi yönetebilir.",
    isSystemRole: true,
    isOwnerRole: true,
    isActive: true,
    permissions: [WILDCARD_PERMISSION],
  }),
  role({
    id: "role-admin",
    key: "admin",
    name: "Yönetici",
    description: "Geniş operasyonel ve finansal yetki. Güvenlik ayarlarını yönetemez; son sahibi devre dışı bırakamaz.",
    isSystemRole: true,
    isOwnerRole: false,
    isActive: true,
    permissions: ALL_EXCEPT_SECURITY,
  }),
  role({
    id: "role-teacher",
    key: "teacher",
    name: "Öğretmen",
    description: "Kendi takvimi, seansları ve (izin verilirse) kendi hakedişi. Kurum finansına erişemez.",
    isSystemRole: true,
    isOwnerRole: false,
    isActive: true,
    permissions: [
      "dashboard.view",
      "dashboard.operational.view",
      "calendar.view",
      "calendar.view_own",
      "sessions.view",
      "sessions.view_own",
      "sessions.create",
      "sessions.edit",
      "sessions.complete",
      "sessions.cancel",
      "students.view",
      "teachers.view_earnings",
      "notifications.view",
      "profile.view",
      "profile.edit",
      "profile.change_password",
    ],
  }),
  role({
    id: "role-guardian",
    key: "guardian",
    name: "Veli",
    description: "Yalnızca bağlı öğrenci(ler)inin bilgileri. Kurum genelindeki kayıtlara erişemez.",
    isSystemRole: true,
    isOwnerRole: false,
    isActive: true,
    // No calendar.view — the phase spec's guardian nav is Panel/Çocuklarım/
    // Seanslar/Ödemeler/Bildirimler/Profil, deliberately not the full
    // multi-teacher Takvim page (staff-oriented filters/views a guardian
    // has no use for); "when is my child's next session" is already
    // covered by sessions.view + the Guardian Dashboard's upcoming list.
    permissions: [
      "dashboard.view",
      "sessions.view",
      // Phase 3 resource scoping: these are the same generic view keys any
      // other role uses, but src/lib/auth/scope.ts's getScopedStudents/
      // getScopedPayments always reduce them to "linked children only" for
      // a guardian-scoped user — the permission key alone never means
      // "see everyone" here.
      "students.view",
      "finance.student_payments.view",
      "notifications.view",
      "profile.view",
      "profile.edit",
      "profile.change_password",
    ],
  }),
];

export function getRoleByKey(key: RoleKey): Role | undefined {
  return SYSTEM_ROLES.find((r) => r.key === key);
}

export function getRoleById(id: string, roles: Role[] = SYSTEM_ROLES): Role | undefined {
  return roles.find((r) => r.id === id);
}

// ─── Removed-role migration (Phase 3) ────────────────────────────────────────
//
// Muhasebe/Danışma/Görüntüleyici were removed as system roles. All three are
// deliberately ambiguous fits for the remaining 4 (none is "obviously" a
// teacher or a guardian), so every one maps to Yönetici (role-admin) — the
// broadest remaining operational role — per the phase spec's "if truly
// ambiguous default to Yönetici and flag via audit log" rule. This is a
// function (not just a static lookup export) so store.tsx's migration pass
// can call it uniformly whether the removed-role ids ever expand later.
const REMOVED_SYSTEM_ROLE_IDS: Record<string, string> = {
  "role-accounting": "role-admin",
  "role-front-desk": "role-admin",
  "role-viewer": "role-admin",
};

/** Returns the replacement roleId if `roleId` belonged to a role removed in
 *  Phase 3, otherwise null (nothing to migrate). Store-agnostic — callers
 *  decide what to do with the result (write the AppUser, log an audit
 *  entry, etc.) so this stays a pure function. */
export function migrateRemovedRoleId(roleId: string): string | null {
  return REMOVED_SYSTEM_ROLE_IDS[roleId] ?? null;
}
