"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import type { Session, Student, Teacher } from "@/types";

interface UpcomingSessionsCardProps {
  sessions: Session[];
  students: Student[];
  teachers: Teacher[];
}

const VISIBLE_LIMIT = 6;

const DAY_FMT = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short" });
const TIME_FMT = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

export function UpcomingSessionsCard({ sessions, students, teachers }: UpcomingSessionsCardProps) {
  const now = useMemo(() => new Date(), []);

  const upcoming = useMemo(() => {
    const nowMs = now.getTime();
    return sessions
      .filter((s) => s.status === "planned" && new Date(s.date).getTime() > nowMs)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, VISIBLE_LIMIT);
  }, [sessions, now]);

  return (
    <Card className="flex h-[320px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Yaklaşan Seanslar</CardTitle>
        <p className="text-sm text-muted-foreground">Planlanmış sıradaki seanslar</p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="Yaklaşan seans yok"
            description="Planlanmış bekleyen bir seans bulunmuyor."
            className="flex-1 border-none bg-transparent py-0"
          />
        ) : (
          <div className="scrollbar-thin -mr-1 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {upcoming.map((session) => {
              const student = students.find((s) => s.id === session.studentId);
              const teacher = teachers.find((t) => t.id === session.teacherId);
              const date = new Date(session.date);
              return (
                <div
                  key={session.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-primary/8 py-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                      {DAY_FMT.format(date)}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-primary">
                      {TIME_FMT.format(date)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {student?.fullName ?? "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{teacher?.fullName ?? "—"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="mt-3 shrink-0 border-t border-border/60 pt-3">
          <Link href="/app/sessions" className="text-xs font-medium text-primary hover:underline">
            → Tüm Seansları Gör
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
