// ─── Auth / Roles / Permissions — canonical model ───────────────────────────
//
// Kept in its own file (not types/index.ts or types/settings.ts) for the same
// reason settings.ts documents its own separation: a large, self-contained
// new domain. This is the ONE role/permission system for the whole app —
// see src/lib/auth/roles.ts (seeded system roles), permission-catalog.ts
// (the full key catalog), permissions.ts (hasPermission/canAccessRoute/...),
// local-auth-service.ts (LocalAuthService) and AuthProvider.tsx (useAuth()).
//
// Replaces both UserRole (formerly types/index.ts) and AppUserRole (formerly
// types/settings.ts) — there is deliberately only one role list now.

import type { AppUserStatus } from "@/types/settings";

// ─── Roles ───────────────────────────────────────────────────────────────────

// Phase 3 simplified the system roles down to these 4 (Muhasebe/Danışma/
// Görüntüleyici removed — see src/lib/auth/roles.ts's migration notes). An
// institution that needs those roles back creates them as CUSTOM roles via
// the Roller tab instead — Role.key is `string`, not this union, precisely
// so a custom role was never blocked by this list even before Phase 3.
export type RoleKey = "owner" | "admin" | "teacher" | "guardian";

export type PermissionModule =
  | "dashboard"
  | "students"
  | "guardians"
  | "teachers"
  | "sessions"
  | "calendar"
  | "finance"
  | "reports"
  | "import"
  | "data"
  | "settings"
  | "notifications"
  | "profile";

// The full catalog lives in src/lib/auth/permission-catalog.ts (data, not
// types) — PERMISSION_KEYS there is the single source of truth this type is
// derived from. Declared here as `string` (not re-imported) to avoid a
// types->lib->types circular import; the catalog file re-exports the
// precise literal union it derives from this same list.
export type PermissionKey = string;

/** Owner-only wildcard — hasPermission() treats this as "every key". */
export const WILDCARD_PERMISSION: PermissionKey = "*";

export interface PermissionMeta {
  key: PermissionKey;
  module: PermissionModule;
  label: string;
  description: string;
  /** Flags a key whose grant should be shown with extra emphasis in a future
   *  permission editor (financial/security/data-destructive actions). Not
   *  enforced by any guard today — presentation metadata only. */
  sensitive?: boolean;
}

export interface Role {
  id: string;
  /** RoleKey for the 7 seeded system roles; a generated slug for custom
   *  roles (Phase 2 Roller tab) — never switched on with `=== "owner"`
   *  anywhere, see isOwnerRole below and hasPermission/canAccessRoute. */
  key: string;
  name: string;
  description: string;
  /** System roles (the 7 seeded ones) can't be deleted once a real Role
   *  management UI exists — not enforced anywhere yet since there's no
   *  mutator for `roles` in Phase 1 (read-only, seeded once). */
  isSystemRole: boolean;
  /** The one bit `isOwner()` reads — never a `role.key === "owner"` string
   *  check anywhere else in the app. */
  isOwnerRole: boolean;
  isActive: boolean;
  permissions: PermissionKey[];
  createdAt: string;
  updatedAt: string;
}

// ─── Auth identity / session ─────────────────────────────────────────────────

/** The resolved, UI-facing identity useAuth() exposes — never the raw
 *  AppUser record (which may carry lockout/invite bookkeeping the UI has no
 *  reason to see) and never a credential. */
export interface AuthUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  roleId: string;
  roleKey: string;
  status: AppUserStatus;
  teacherId?: string;
  guardianId?: string;
}

export interface AuthSession {
  userId: string;
  loginAt: string;
  lastActivityAt: string;
  expiresAt: string;
  remember: boolean;
}

export type AuthErrorCode =
  | "invalid_credentials"
  | "account_inactive"
  | "account_locked"
  | "account_invited"
  | "unknown";

export interface AuthResult<T = void> {
  success: boolean;
  data?: T;
  error?: AuthErrorCode;
  /** Turkish, user-facing — built once by LocalAuthService, never re-derived
   *  from `error` in a component. */
  errorMessage?: string;
}

/** Lives ONLY in the store's `credentials` slice — read/write exclusively
 *  from src/lib/auth/local-auth-service.ts. Never attached to an AppUser
 *  object that flows through the Users settings UI. */
export interface Credential {
  userId: string;
  salt: string;
  hash: string;
  updatedAt: string;
}

// ─── Invitations (Phase 2) ───────────────────────────────────────────────────
// Email delivery is mock-only — no provider is connected. inviteAppUser
// creates the AppUser (status "invited") AND one Invitation row with a
// single-use token; the Davetler tab surfaces a "copy link" action instead
// of actually emailing anything. See LocalAuthService.acceptInvitation.

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export interface Invitation {
  id: string;
  tenantId: string;
  token: string;
  userId: string;
  email: string;
  roleId: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  createdAt: string;
  createdBy: string;
}

// ─── Password reset tokens (Phase 2) ─────────────────────────────────────────
// Same mock-delivery reasoning as Invitation above — requestPasswordReset
// generates a token and the UI shows/copies the link instead of emailing it.

export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}
