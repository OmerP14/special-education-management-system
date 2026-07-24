"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarPlus, UserPlus, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionFormDrawer } from "@/components/sessions/SessionFormDrawer";
import { StudentFormDrawer } from "@/components/students/StudentFormDrawer";

function getGreeting(hour: number): string {
  if (hour < 6) return "İyi geceler";
  if (hour < 12) return "Günaydın";
  if (hour < 18) return "İyi günler";
  return "İyi akşamlar";
}

export function DashboardHero() {
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);
  const [studentDrawerOpen, setStudentDrawerOpen] = useState(false);

  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.06] via-card to-card p-6 sm:p-7">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {dateLabel}
            </p>
            <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {getGreeting(now.getHours())} 👋
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Kurumunuzun bugünkü durumuna hızlıca göz atın.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setStudentDrawerOpen(true)}>
              <UserPlus className="mr-1.5 h-3.5 w-3.5" />
              Öğrenci Ekle
            </Button>
            <Link href="/app/calendar">
              <Button size="sm" variant="outline">
                <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                Takvimi Aç
              </Button>
            </Link>
            <Button size="sm" onClick={() => setSessionDrawerOpen(true)}>
              <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
              Seans Ekle
            </Button>
          </div>
        </div>
      </div>

      <SessionFormDrawer open={sessionDrawerOpen} onOpenChange={setSessionDrawerOpen} />
      <StudentFormDrawer open={studentDrawerOpen} onOpenChange={setStudentDrawerOpen} />
    </>
  );
}
