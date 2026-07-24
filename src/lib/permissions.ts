import type { UserRole } from "@/types";
import type { SettingsSectionKey } from "@/types/settings";
import { getSettingsSectionMeta } from "@/lib/settings/sections";

// This app has no real auth/backend — CURRENT_USER stands in for "the signed-in
// user" everywhere a role check is needed (nav visibility, page gating). It
// replaces the hardcoded display-only MOCK_USER that used to live directly in
// AppTopbar. Defaults to an admin so existing behavior is unchanged; flip
// `role` to "teacher" or "guardian" to see the financial nav/pages gate shut.
export const CURRENT_USER: { name: string; email: string; initials: string; role: UserRole } = {
  name: "Yönetici",
  email: "admin@ornekokul.com",
  initials: "YN",
  role: "institution_admin",
};

/** Financial data (Finans nav group, /app/finance) is owner/admin-only —
 *  teachers and guardians never see revenue, payables, or receivables. */
export function canViewFinance(role: UserRole): boolean {
  return role === "super_admin" || role === "institution_admin";
}

/**
 * The one centralized settings-access check — every Settings page/nav item
 * calls this instead of hardcoding its own role comparison. There is no real
 * roles/permissions engine yet (see SETTINGS_SECTIONS in lib/settings/sections.ts
 * for the permission-ready metadata this reads), so today's rule is
 * intentionally simple: owner/admin (super_admin/institution_admin) can reach
 * every section; every other role is limited to non-owner-only sections.
 * When a real engine exists, it replaces this function's body — every call
 * site (nav, layout guard, page guard) stays unchanged since they only ever
 * call canAccessSettingsSection(role, key), never inspect role directly.
 */
export function canAccessSettingsSection(role: UserRole, key: SettingsSectionKey): boolean {
  if (role === "super_admin" || role === "institution_admin") return true;
  const meta = getSettingsSectionMeta(key);
  return !meta.ownerOnly;
}
