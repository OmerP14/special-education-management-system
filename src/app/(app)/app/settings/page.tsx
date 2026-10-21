"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { useStore } from "@/lib/data/store";
import { SETTINGS_SECTIONS } from "@/lib/settings/sections";

export default function SettingsOverviewPage() {
  const { institutionSettings, educationTypes } = useStore();
  const { institution, dataManagement } = institutionSettings;

  // The few things worth flagging; everything else works on its default.
  const missing: { text: string; href: string }[] = [];
  if (!institution.name.trim()) missing.push({ text: "Kurum adı girilmemiş", href: "/app/settings/institution" });
  if (!institution.phone.trim()) missing.push({ text: "Kurum telefonu girilmemiş", href: "/app/settings/institution" });
  if (!educationTypes.some((et) => et.status === "active")) {
    missing.push({ text: "Hiç eğitim türü yok", href: "/app/settings/education-types" });
  }
  if (!dataManagement.lastBackupAt) missing.push({ text: "Henüz yedek alınmadı", href: "/app/settings/data" });

  return (
    <div className="space-y-5">
      {missing.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
            <p className="text-base font-semibold text-amber-900">Tamamlanması gerekenler</p>
          </div>
          <ul className="mt-2 space-y-1.5 pl-7">
            {missing.map((m) => (
              <li key={m.text}>
                <Link href={m.href} className="text-sm font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950">
                  {m.text}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-base font-medium text-emerald-800">Ayarlar tamam, kurum kullanıma hazır.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <Link
            key={section.key}
            href={section.href}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <section.icon className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-foreground">{section.label}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{section.description}</p>
            </div>
            <ChevronRight
              className="h-5 w-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
