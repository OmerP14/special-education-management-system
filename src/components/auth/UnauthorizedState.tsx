import { ShieldAlert } from "lucide-react";

interface UnauthorizedStateProps {
  title?: string;
  description?: string;
}

/** The shared "Bu bölüme/sayfaya erişim yetkiniz yok" block — extracted from
 *  SettingsAccessGuard/FinancePage's previously-duplicated inline markup.
 *  Used by both PermissionGuard and SettingsAccessGuard (a thin wrapper
 *  around it). RouteGuard, by contrast, navigates away instead of rendering
 *  this — see RouteGuard.tsx. */
export function UnauthorizedState({
  title = "Bu bölüme erişim yetkiniz yok",
  description = "Bu alan yalnızca yetkili roller içindir.",
}: UnauthorizedStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-24 text-center">
      <div className="rounded-full bg-muted p-3">
        <ShieldAlert className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
