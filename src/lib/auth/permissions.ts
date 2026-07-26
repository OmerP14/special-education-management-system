// ─── Centralized authorization helpers ──────────────────────────────────────
//
// Replaces src/lib/permissions.ts (deleted). Every access check in the app —
// route guard, nav filtering, page guard — goes through one of these instead
// of comparing a role string directly. See src/lib/auth/AuthProvider.tsx for
// where `permissions`/`role` actually come from (useAuth()).

import type { NavItem } from "@/lib/nav";
import type { PermissionKey, Role } from "@/types/auth";
import { WILDCARD_PERMISSION } from "@/types/auth";
import { getSettingsSectionMeta } from "@/lib/settings/sections";
import type { SettingsSectionKey } from "@/types/settings";

export function hasPermission(permissions: PermissionKey[], key: PermissionKey): boolean {
  return permissions.includes(WILDCARD_PERMISSION) || permissions.includes(key);
}

export function hasAnyPermission(permissions: PermissionKey[], keys: PermissionKey[]): boolean {
  return keys.some((k) => hasPermission(permissions, k));
}

export function hasAllPermissions(permissions: PermissionKey[], keys: PermissionKey[]): boolean {
  return keys.every((k) => hasPermission(permissions, k));
}

/** The one bit that means "this person is an institution owner" — never a
 *  `role.key === "owner"` string comparison anywhere else in the app. */
export function isOwner(role: Role | null | undefined): boolean {
  return role?.isOwnerRole === true;
}

export function isSelf(currentUserId: string | null | undefined, targetUserId: string): boolean {
  return !!currentUserId && currentUserId === targetUserId;
}

/** Migrated from the old role-string version in lib/permissions.ts — same
 *  call-site shape (every settings page/nav still just passes a section key),
 *  now resolved through the section's real `permissionKey` instead of the
 *  `ownerOnly` flag. */
export function canAccessSettingsSection(
  permissions: PermissionKey[],
  key: SettingsSectionKey
): boolean {
  const meta = getSettingsSectionMeta(key);
  return hasPermission(permissions, meta.permissionKey);
}

export function canViewNavigationItem(permissions: PermissionKey[], item: NavItem): boolean {
  return !item.permissionKey || hasPermission(permissions, item.permissionKey);
}
