"use client";

import { useMemo, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { useMockStore } from "@/lib/mock/store";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PERMISSION_CATALOG } from "@/lib/auth/permission-catalog";
import type { PermissionModule } from "@/types/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export function YetkiMatrisiTab() {
  const store = useMockStore();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState<PermissionModule | "all">("all");

  const visibleRoles = store.roles.filter((r) => r.isActive);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PERMISSION_CATALOG.filter(
      (p) =>
        (moduleFilter === "all" || p.module === moduleFilter) &&
        (!q || p.label.toLowerCase().includes(q) || p.key.toLowerCase().includes(q))
    );
  }, [search, moduleFilter]);

  const toggle = (roleId: string, key: string) => {
    const role = store.roles.find((r) => r.id === roleId);
    if (!role || role.permissions.includes("*")) return; // owner wildcard — read-only
    const next = role.permissions.includes(key)
      ? role.permissions.filter((k) => k !== key)
      : [...role.permissions, key];
    store.updateRole({ ...role, permissions: next, updatedAt: new Date().toISOString() });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-base font-semibold text-foreground">Yetki Matrisi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Her rolün her izne sahip olup olmadığını tek bakışta görün ve doğrudan değiştirin. Sahip rolü (joker
          izin) düzenlenemez.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="İzin ara…" className="h-9 w-56 pl-8" />
        </div>
        <Select value={moduleFilter} onValueChange={(v) => { if (v) setModuleFilter(v as PermissionModule | "all"); }}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue>{() => (moduleFilter === "all" ? "Tüm Modüller" : MODULE_LABELS[moduleFilter])}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Modüller</SelectItem>
            {(Object.keys(MODULE_LABELS) as PermissionModule[]).map((m) => (
              <SelectItem key={m} value={m}>
                {MODULE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr className="border-b border-border">
              <th className="sticky left-0 z-20 bg-muted/60 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                İzin
              </th>
              {visibleRoles.map((role) => (
                <th key={role.id} className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    {role.isOwnerRole && <ShieldCheck className="h-3 w-3 text-primary" />}
                    {role.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((perm) => (
              <tr key={perm.key} className="border-b border-border/60 last:border-b-0 hover:bg-muted/20">
                <td className="sticky left-0 z-10 bg-card px-4 py-2 text-foreground">
                  {perm.label}
                  {perm.sensitive && (
                    <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      Hassas
                    </span>
                  )}
                </td>
                {visibleRoles.map((role) => {
                  const wildcard = role.permissions.includes("*");
                  const checked = wildcard || role.permissions.includes(perm.key);
                  return (
                    <td key={role.id} className={cn("px-3 py-2 text-center", wildcard && "opacity-60")}>
                      <Checkbox
                        checked={checked}
                        disabled={wildcard}
                        onCheckedChange={() => toggle(role.id, perm.key)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
