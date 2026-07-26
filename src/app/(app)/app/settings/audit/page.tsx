"use client";

import { useMemo, useState } from "react";
import { Search, Download, X, History } from "lucide-react";
import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
import { useMockStore } from "@/lib/mock/store";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/helpers/finance";
import { downloadCsv } from "@/lib/helpers/export";
import { cn } from "@/lib/utils";
import type { AuditLogEntry, AuditModule } from "@/types/settings";

const MODULE_LABELS: Record<AuditModule, string> = {
  settings: "Ayarlar",
  education_types: "Eğitim Türleri",
  sessions: "Seanslar",
  payments: "Ödemeler",
  teacher_earnings: "Öğretmen Hakedişleri",
  import: "İçe Aktarım",
  users: "Kullanıcılar",
  data: "Veri Yönetimi",
  auth: "Kimlik Doğrulama",
};

// Falls back to the raw action string for anything not in this map, so a
// future logAuditEvent call site never silently produces an unreadable row.
const ACTION_LABELS: Record<string, string> = {
  education_type_created: "Eğitim türü oluşturuldu",
  education_type_updated: "Eğitim türü güncellendi",
  session_edited: "Seans düzenlendi",
  payment_created: "Ödeme oluşturuldu",
  import_performed: "İçe aktarım yapıldı",
  settings_changed: "Ayar değiştirildi",
  settings_reset: "Ayar varsayılana sıfırlandı",
  user_invited: "Kullanıcı davet edildi",
  backup_created: "Yedek alındı",
  backup_restored: "Yedek geri yüklendi",
  data_exported: "Veri dışa aktarıldı",
  login_success: "Giriş yapıldı",
  login_failed: "Giriş denemesi başarısız",
  account_locked: "Hesap kilitlendi",
  logout: "Çıkış yapıldı",
  password_changed: "Şifre değiştirildi",
  user_updated: "Kullanıcı güncellendi",
  user_deactivated: "Kullanıcı devre dışı bırakıldı",
  user_activated: "Kullanıcı etkinleştirildi",
  role_changed: "Rol değiştirildi",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const selectClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

interface AuditFilters {
  search: string;
  startDate: string;
  endDate: string;
  module: AuditModule | "all";
  userName: string | "all";
}

const EMPTY_FILTERS: AuditFilters = { search: "", startDate: "", endDate: "", module: "all", userName: "all" };

function matchesFilters(entry: AuditLogEntry, filters: AuditFilters): boolean {
  if (filters.module !== "all" && entry.module !== filters.module) return false;
  if (filters.userName !== "all" && entry.userName !== filters.userName) return false;
  if (filters.startDate && entry.occurredAt.slice(0, 10) < filters.startDate) return false;
  if (filters.endDate && entry.occurredAt.slice(0, 10) > filters.endDate) return false;
  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    const haystack = [actionLabel(entry.action), entry.recordLabel, entry.userName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function AuditDetailDrawer({ entry, onOpenChange }: { entry: AuditLogEntry | null; onOpenChange: (open: boolean) => void }) {
  return (
    <FormDrawer
      open={!!entry}
      onOpenChange={onOpenChange}
      title="İşlem Detayı"
      description={entry ? formatDateTime(entry.occurredAt) : undefined}
    >
      {entry && (
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-[100px_1fr] gap-y-2">
            <span className="text-muted-foreground">Kullanıcı</span>
            <span className="font-medium text-foreground">{entry.userName}</span>
            <span className="text-muted-foreground">İşlem</span>
            <span className="font-medium text-foreground">{actionLabel(entry.action)}</span>
            <span className="text-muted-foreground">Modül</span>
            <span className="font-medium text-foreground">{MODULE_LABELS[entry.module]}</span>
            {entry.recordLabel && (
              <>
                <span className="text-muted-foreground">Kayıt</span>
                <span className="font-medium text-foreground">{entry.recordLabel}</span>
              </>
            )}
          </div>

          {(entry.oldValueSummary || entry.newValueSummary) && (
            <div className="space-y-2 border-t border-border/60 pt-4">
              {entry.oldValueSummary && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Önceki Değer</p>
                  <p className="mt-0.5 text-sm text-foreground">{entry.oldValueSummary}</p>
                </div>
              )}
              {entry.newValueSummary && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Yeni Değer</p>
                  <p className="mt-0.5 text-sm text-foreground">{entry.newValueSummary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </FormDrawer>
  );
}

function AuditLogContent() {
  const { auditLog } = useMockStore();
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  const userOptions = useMemo(
    () => Array.from(new Set(auditLog.map((e) => e.userName))).sort(),
    [auditLog]
  );

  const filtered = useMemo(
    () => auditLog.filter((e) => matchesFilters(e, filters)),
    [auditLog, filters]
  );

  const hasActiveFilters =
    !!filters.search || !!filters.startDate || !!filters.endDate || filters.module !== "all" || filters.userName !== "all";

  const handleExport = () => {
    downloadCsv(
      `islem-gecmisi-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Tarih/Saat", "Kullanıcı", "İşlem", "Modül", "Kayıt", "Önceki Değer", "Yeni Değer"],
      filtered.map((e) => [
        formatDateTime(e.occurredAt),
        e.userName,
        actionLabel(e.action),
        MODULE_LABELS[e.module],
        e.recordLabel ?? "",
        e.oldValueSummary ?? "",
        e.newValueSummary ?? "",
      ])
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">İşlem Geçmişi</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Kurum genelindeki ayar, eğitim türü, seans, ödeme ve kullanıcı değişikliklerinin kaydı.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0} className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            CSV Dışa Aktar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3">
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Ara</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder="İşlem, kayıt veya kullanıcı ara…"
              className="h-9 w-56 pl-8"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Başlangıç</label>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
            className="h-9 w-[150px]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bitiş</label>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
            className="h-9 w-[150px]"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Modül</label>
          <select
            value={filters.module}
            onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value as AuditModule | "all" }))}
            className={cn(selectClass, "block")}
          >
            <option value="all">Tüm Modüller</option>
            {(Object.keys(MODULE_LABELS) as AuditModule[]).map((m) => (
              <option key={m} value={m}>
                {MODULE_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Kullanıcı</label>
          <select
            value={filters.userName}
            onChange={(e) => setFilters((f) => ({ ...f, userName: e.target.value }))}
            className={cn(selectClass, "block")}
          >
            <option value="all">Tüm Kullanıcılar</option>
            {userOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        {hasActiveFilters && (
          <button
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="inline-flex h-9 items-center gap-1 rounded-lg border border-destructive/40 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/5"
          >
            <X className="h-3 w-3" />
            Filtreleri Temizle
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center">
          <History className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {auditLog.length === 0 ? "Henüz kayıtlı işlem yok." : "Filtrelere uyan işlem bulunamadı."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Tarih/Saat</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Kullanıcı</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">İşlem</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Modül</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">Kayıt</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b border-border/60 last:border-b-0 hover:bg-muted/20">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDateTime(entry.occurredAt)}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{entry.userName}</td>
                  <td className="px-4 py-2.5 text-foreground">{actionLabel(entry.action)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{MODULE_LABELS[entry.module]}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-foreground">{entry.recordLabel ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(entry)}>
                      Detay
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AuditDetailDrawer entry={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <SettingsAccessGuard sectionKey="audit">
      <AuditLogContent />
    </SettingsAccessGuard>
  );
}
