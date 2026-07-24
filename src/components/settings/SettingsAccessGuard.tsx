"use client";

import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { CURRENT_USER, canAccessSettingsSection } from "@/lib/permissions";
import type { SettingsSectionKey } from "@/types/settings";

/**
 * Every settings section page wraps its content in this instead of checking
 * canAccessSettingsSection itself — the nav already hides sections a role
 * can't reach (see SettingsShell), but a direct URL visit must respect the
 * same boundary, same reasoning as FinancePage's own guard.
 */
export function SettingsAccessGuard({
  sectionKey,
  children,
}: {
  sectionKey: SettingsSectionKey;
  children: ReactNode;
}) {
  if (!canAccessSettingsSection(CURRENT_USER.role, sectionKey)) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-24 text-center">
        <div className="rounded-full bg-muted p-3">
          <ShieldAlert className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Bu bölüme erişim yetkiniz yok</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Bu ayar yalnızca yetkili roller içindir.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
