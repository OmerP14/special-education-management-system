"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Circle, FileSpreadsheet } from "lucide-react";
import { useStore } from "@/lib/data/store";
import { useAccess } from "@/lib/auth/access";
import { staffAccountService } from "@/lib/auth/http-auth-service";
import { cn } from "@/lib/utils";

/**
 * First-use guide on the dashboard: the order a new institution has to set
 * things up in (a lesson needs a student, an education type
 * and a teacher). Each step ticks itself off from the data; the card goes
 * away once every required step is done. The staff account is offered last,
 * as an optional step, so the institution at least knows it exists.
 */
export function SetupChecklist() {
  const { institutionSettings, educationTypes, teachers, students, sessions } = useStore();
  // Setting the institution up is the admin's job.
  const { isAdmin } = useAccess();
  const { institution } = institutionSettings;
  // The staff account lives on the server, not in the store.
  const [hasStaff, setHasStaff] = useState(false);
  useEffect(() => {
    if (!isAdmin) return;
    void staffAccountService.get().then((r) => setHasStaff(!!r.data?.staff));
  }, [isAdmin]);

  const steps = [
    { label: "Kurum adını ve telefonunu girin", href: "/app/settings/institution", done: !!institution.name.trim() && !!institution.phone.trim() },
    { label: "Verdiğiniz eğitimleri ve ücretlerini ekleyin", href: "/app/settings/education-types", done: educationTypes.length > 0 },
    { label: "Öğretmenleri ekleyin", href: "/app/teachers", done: teachers.length > 0 },
    { label: "Öğrencileri ekleyin", href: "/app/students", done: students.length > 0 },
    { label: "İlk dersi planlayın", href: "/app/sessions", done: sessions.length > 0 },
    {
      label: "Personel hesabı açın (isteğe bağlı) — sadece ders ve takvimi görür",
      href: "/app/settings/staff",
      done: hasStaff,
      optional: true,
    },
  ];
  if (!isAdmin || steps.every((s) => s.done || s.optional)) return null;
  const next = steps.findIndex((s) => !s.done);

  return (
    <section className="rounded-xl border border-primary/30 bg-card p-5" aria-labelledby="setup-title">
      <h2 id="setup-title" className="text-lg font-semibold text-foreground">
        Başlarken
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Sistemi kullanmaya başlamak için bu adımları sırayla tamamlayın. Bitirdiğiniz adımlar kendiliğinden işaretlenir.
      </p>
      <ol className="mt-4 space-y-2">
        {steps.map((step, i) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                i === next ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : "border-border hover:bg-muted/40"
              )}
            >
              {step.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className={cn("flex-1 text-base", step.done ? "text-muted-foreground line-through" : "font-medium text-foreground")}>
                {i + 1}. {step.label}
                <span className="sr-only">{step.done ? " (tamamlandı)" : ""}</span>
              </span>
              {!step.done && <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />}
            </Link>
          </li>
        ))}
      </ol>
      <Link
        href="/app/import"
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden />
        Bilgileriniz Excel&apos;de mi? Hepsini tek seferde aktarın
      </Link>
    </section>
  );
}
