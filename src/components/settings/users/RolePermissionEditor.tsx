"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_CATALOG } from "@/lib/auth/permission-catalog";
import type { PermissionKey, PermissionModule } from "@/types/auth";
import { cn } from "@/lib/utils";

const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: "Panel",
  students: "Öğrenciler",
  guardians: "Veliler",
  teachers: "Öğretmenler",
  sessions: "Seanslar",
  calendar: "Takvim",
  finance: "Finans",
  reports: "Raporlar",
  import: "İçe Aktarım",
  data: "Veri Yönetimi",
  settings: "Ayarlar",
  notifications: "Bildirimler",
  profile: "Profil",
};

const MODULE_ORDER: PermissionModule[] = [
  "dashboard",
  "students",
  "guardians",
  "teachers",
  "sessions",
  "calendar",
  "finance",
  "reports",
  "import",
  "data",
  "settings",
  "notifications",
  "profile",
];

interface RolePermissionEditorProps {
  value: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  /** Owner's "*" wildcard renders read-only — never editable, matches
   *  isOwnerRole never having its permission SET edited, only revoked by
   *  changing role assignment on the user instead. */
  readOnly?: boolean;
}

/** Grouped-by-module permission checklist with search + "select all in
 *  module" — shared by the create/edit role forms in RollerTab. */
export function RolePermissionEditor({ value, onChange, readOnly }: RolePermissionEditorProps) {
  const [search, setSearch] = useState("");

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MODULE_ORDER.map((module) => ({
      module,
      items: PERMISSION_CATALOG.filter(
        (p) =>
          p.module === module &&
          (!q || p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))
      ),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  if (value.includes("*")) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground">
        Bu rol tüm izinlere sahiptir (Sahip joker izni — <code className="font-mono text-xs">*</code>). Ayrı ayrı
        düzenlenemez.
      </p>
    );
  }

  const toggle = (key: PermissionKey) => {
    if (readOnly) return;
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  };

  const toggleModule = (module: PermissionModule, items: typeof PERMISSION_CATALOG) => {
    if (readOnly) return;
    const keys = items.map((i) => i.key);
    const allSelected = keys.every((k) => value.includes(k));
    onChange(allSelected ? value.filter((k) => !keys.includes(k)) : [...new Set([...value, ...keys])]);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="İzin ara…"
          className="h-9 pl-8"
        />
      </div>

      <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
        {groups.map(({ module, items }) => {
          const keys = items.map((i) => i.key);
          const allSelected = keys.every((k) => value.includes(k));
          const someSelected = keys.some((k) => value.includes(k));
          return (
            <div key={module} className="space-y-1.5">
              <label className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground", !readOnly && "cursor-pointer")}>
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() => toggleModule(module, items)}
                  disabled={readOnly}
                />
                {MODULE_LABELS[module]}
              </label>
              <div className="grid gap-1 pl-6 sm:grid-cols-2">
                {items.map((item) => (
                  <label
                    key={item.key}
                    className={cn(
                      "flex items-start gap-2 rounded-md px-1.5 py-1 text-sm",
                      !readOnly && "cursor-pointer hover:bg-muted/60"
                    )}
                  >
                    <Checkbox
                      checked={value.includes(item.key)}
                      onCheckedChange={() => toggle(item.key)}
                      disabled={readOnly}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="text-foreground">{item.label}</span>
                      {item.sensitive && (
                        <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          Hassas
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
