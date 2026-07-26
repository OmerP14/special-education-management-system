"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { hasAllPermissions, hasAnyPermission, hasPermission } from "@/lib/auth/permissions";
import { UnauthorizedState } from "@/components/auth/UnauthorizedState";
import type { PermissionKey } from "@/types/auth";

interface PermissionGuardProps {
  permission?: PermissionKey;
  anyOf?: PermissionKey[];
  allOf?: PermissionKey[];
  title?: string;
  description?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/** Generic page/section-level guard — renders an inline UnauthorizedState
 *  (never navigates away; see RouteGuard for the redirect-on-unauthorized
 *  case) when the current user lacks the required permission(s). Used by
 *  FinancePage (replacing its inline canViewFinance block) and available to
 *  any future page-level guard so the check is never duplicated. */
export function PermissionGuard({
  permission,
  anyOf,
  allOf,
  title,
  description,
  fallback,
  children,
}: PermissionGuardProps) {
  const { permissions } = useAuth();

  const allowed =
    (!permission || hasPermission(permissions, permission)) &&
    (!anyOf || hasAnyPermission(permissions, anyOf)) &&
    (!allOf || hasAllPermissions(permissions, allOf));

  if (!allowed) {
    return fallback ?? <UnauthorizedState title={title} description={description} />;
  }
  return <>{children}</>;
}
