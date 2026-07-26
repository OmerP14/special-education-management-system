"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { canAccessSettingsSection } from "@/lib/auth/permissions";
import { UnauthorizedState } from "@/components/auth/UnauthorizedState";
import type { SettingsSectionKey } from "@/types/settings";

/**
 * Every settings section page wraps its content in this instead of checking
 * canAccessSettingsSection itself — the nav already hides sections a role
 * can't reach (see SettingsShell), but a direct URL visit must respect the
 * same boundary, same reasoning as FinancePage's own guard (PermissionGuard).
 * A thin wrapper around the shared UnauthorizedState + the real permission
 * check now driven by useAuth() instead of a hardcoded role.
 */
export function SettingsAccessGuard({
  sectionKey,
  children,
}: {
  sectionKey: SettingsSectionKey;
  children: ReactNode;
}) {
  const { permissions } = useAuth();

  if (!canAccessSettingsSection(permissions, sectionKey)) {
    return (
      <UnauthorizedState
        title="Bu bölüme erişim yetkiniz yok"
        description="Bu ayar yalnızca yetkili roller içindir."
      />
    );
  }
  return <>{children}</>;
}
