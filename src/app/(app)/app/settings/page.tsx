"use client";

import Link from "next/link";
import {
  Building2,
  GraduationCap,
  UserCog,
  Mail,
  Bell,
  Database,
  History,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useMockStore } from "@/lib/mock/store";
import { formatDateTime } from "@/lib/helpers/finance";
import { getSettingsSectionStatus } from "@/lib/settings/status";
import { cn } from "@/lib/utils";

interface OverviewCard {
  href: string;
  icon: typeof Building2;
  label: string;
  value: string;
  tone: "primary" | "success" | "warning" | "danger";
}

export default function SettingsOverviewPage() {
  const store = useMockStore();
  const { institutionSettings, educationTypes, appUsers, auditLog } = store;

  const institutionComplete =
    getSettingsSectionStatus("institution", store) === "complete";
  const activeEducationTypes = educationTypes.filter((et) => et.status === "active").length;
  const activeUsers = appUsers.filter((u) => u.status === "active").length;
  const pendingInvites = appUsers.filter((u) => u.status === "invited").length;

  const enabledNotificationEvents = Object.values(institutionSettings.notifications.events).filter(
    (e) => e.enabled
  ).length;
  const totalNotificationEvents = Object.keys(institutionSettings.notifications.events).length;

  const lastBackup = institutionSettings.dataManagement.lastBackupAt;

  const lastUpdateEntry = Object.values(institutionSettings.metadata)
    .filter((m): m is NonNullable<typeof m> => !!m)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  // Missing-critical-settings banner — the only things that actually block a
  // clean bill of health today; everything else has a working default.
  const missing: string[] = [];
  if (!institutionSettings.institution.name.trim()) missing.push("Kurum adı girilmemiş");
  if (!institutionSettings.institution.phone.trim()) missing.push("Kurum telefonu girilmemiş");
  if (!institutionSettings.institution.email.trim()) missing.push("Kurum e-postası girilmemiş");
  if (activeEducationTypes === 0) missing.push("Aktif eğitim türü yok");
  if (!appUsers.some((u) => store.roles.find((r) => r.id === u.roleId)?.isOwnerRole && u.status === "active")) {
    missing.push("Aktif sahip (owner) kullanıcı yok");
  }

  const cards: OverviewCard[] = [
    {
      href: "/app/settings/institution",
      icon: Building2,
      label: "Kurum Profili",
      value: institutionComplete ? "Tamamlandı" : "Eksik bilgi var",
      tone: institutionComplete ? "success" : "warning",
    },
    {
      href: "/app/settings/education-types",
      icon: GraduationCap,
      label: "Eğitim Türleri",
      value: `${activeEducationTypes} aktif`,
      tone: activeEducationTypes > 0 ? "primary" : "warning",
    },
    {
      href: "/app/settings/users",
      icon: UserCog,
      label: "Aktif Kullanıcı",
      value: String(activeUsers),
      tone: "primary",
    },
    {
      href: "/app/settings/users",
      icon: Mail,
      label: "Bekleyen Davet",
      value: String(pendingInvites),
      tone: pendingInvites > 0 ? "warning" : "success",
    },
    {
      href: "/app/settings/notifications",
      icon: Bell,
      label: "Bildirim Olayları",
      value: `${enabledNotificationEvents}/${totalNotificationEvents} aktif`,
      tone: "primary",
    },
    {
      href: "/app/settings/data",
      icon: Database,
      label: "Son Yedek",
      value: lastBackup ? formatDateTime(lastBackup) : "Hiç yedek alınmadı",
      tone: lastBackup ? "success" : "warning",
    },
    {
      href: "/app/settings/audit",
      icon: History,
      label: "Son Ayar Değişikliği",
      value: lastUpdateEntry ? formatDateTime(lastUpdateEntry.updatedAt) : "Henüz değişiklik yok",
      tone: "primary",
    },
    {
      href: "/app/settings/data",
      icon: missing.length === 0 ? CheckCircle2 : AlertTriangle,
      label: "Veri Sağlığı",
      value: missing.length === 0 ? "İyi durumda" : `${missing.length} eksik kontrol`,
      tone: missing.length === 0 ? "success" : "warning",
    },
  ];

  return (
    <div className="space-y-5">
      {missing.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
            <p className="text-sm font-semibold text-amber-800">Eksik ayarlar</p>
          </div>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 pl-1 text-xs text-amber-800">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-3 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Kritik ayarların tümü tamam — kurum kullanıma hazır.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
          >
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                card.tone === "primary" && "bg-primary/10 text-primary",
                card.tone === "success" && "bg-emerald-500/10 text-emerald-600",
                card.tone === "warning" && "bg-amber-500/10 text-amber-600",
                card.tone === "danger" && "bg-destructive/10 text-destructive"
              )}
            >
              <card.icon className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {card.label}
              </p>
              <p className="truncate text-sm font-semibold text-foreground">{card.value}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {auditLog.length} işlem geçmişte kayıtlı ·{" "}
        <Link href="/app/settings/audit" className="text-primary hover:underline">
          İşlem Geçmişini Gör
        </Link>
      </p>
    </div>
  );
}
