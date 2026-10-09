// ─── Who may change which users and roles ────────────────────────────────────
//
// One set of rules for the Kullanıcılar / Roller / Yetki Matrisi tabs (to
// disable buttons and explain why) and for the store mutators (to refuse the
// write even if a UI path forgot to check). Each returns null when allowed,
// otherwise the Turkish reason to show.
//
// The point is that settings.users.manage / settings.roles.manage can't be
// used to climb: a non-owner can't touch owners or the owner role, can't
// change their own role, and can't hand out a permission they don't hold
// themselves — so Yönetici can't grant itself "settings.security.manage".

import type { PermissionKey, Role } from "@/types/auth";
import type { AppUser } from "@/types/settings";
import { hasPermission, isOwner } from "@/lib/auth/permissions";

export interface ManagementActor {
  userId: string;
  role: Role | null;
}

const roleOf = (roles: Role[], roleId: string | undefined) => roles.find((r) => r.id === roleId);

function isSoleActiveOwner(target: AppUser, users: AppUser[], roles: Role[]): boolean {
  if (!roleOf(roles, target.roleId)?.isOwnerRole || target.status !== "active") return false;
  return !users.some((u) => u.id !== target.id && u.status === "active" && roleOf(roles, u.roleId)?.isOwnerRole);
}

function exceedsActor(actor: ManagementActor, permissions: PermissionKey[]): boolean {
  if (isOwner(actor.role)) return false;
  const own = actor.role?.permissions ?? [];
  return permissions.some((p) => !hasPermission(own, p));
}

/** Editing an existing user's record (name, email, links) at all. */
export function canEditUser(actor: ManagementActor, target: AppUser, roles: Role[]): string | null {
  if (!actor.role) return "Oturum bulunamadı.";
  if (!isOwner(actor.role) && roleOf(roles, target.roleId)?.isOwnerRole) {
    return "Sahip hesaplarını yalnızca bir sahip düzenleyebilir.";
  }
  return null;
}

/** Giving `nextRole` to `target` (null = a new invitation). */
export function canAssignRole(
  actor: ManagementActor,
  target: AppUser | null,
  nextRole: Role | undefined,
  users: AppUser[],
  roles: Role[]
): string | null {
  if (!actor.role) return "Oturum bulunamadı.";
  if (!nextRole) return "Rol bulunamadı.";
  if (target) {
    const editError = canEditUser(actor, target, roles);
    if (editError) return editError;
    if (target.roleId === nextRole.id) return null; // role unchanged
    if (target.id === actor.userId) return "Kendi rolünüzü değiştiremezsiniz.";
    if (isSoleActiveOwner(target, users, roles)) return "Tek aktif sahibin rolü değiştirilemez.";
  }
  if (nextRole.isOwnerRole && !isOwner(actor.role)) return "Sahip rolünü yalnızca bir sahip atayabilir.";
  if (exceedsActor(actor, nextRole.permissions)) return "Kendi yetkilerinizden geniş bir rol atayamazsınız.";
  return null;
}

export function canDeactivateUser(actor: ManagementActor, target: AppUser, users: AppUser[], roles: Role[]): string | null {
  if (!actor.role) return "Oturum bulunamadı.";
  if (target.id === actor.userId) return "Kendi hesabınızı devre dışı bırakamazsınız.";
  const editError = canEditUser(actor, target, roles);
  if (editError) return editError;
  if (isSoleActiveOwner(target, users, roles)) return "Tek aktif sahip devre dışı bırakılamaz.";
  return null;
}

/** Saving `nextPermissions` on `role` (an existing role, or a new one when
 *  `role` is null). */
export function canSaveRole(actor: ManagementActor, role: Role | null, nextPermissions: PermissionKey[]): string | null {
  if (!actor.role) return "Oturum bulunamadı.";
  if (role?.isOwnerRole && !isOwner(actor.role)) return "Sahip rolünü yalnızca bir sahip düzenleyebilir.";
  if (role && role.id === actor.role.id && !isOwner(actor.role)) return "Kendi rolünüzü düzenleyemezsiniz.";
  if (exceedsActor(actor, nextPermissions)) return "Sahip olmadığınız bir yetkiyi bir role veremezsiniz.";
  return null;
}
