"use client";

import { useMemo } from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { getSessionDisplayStatus } from "@/lib/helpers/finance";
import type { Session, Student, Teacher } from "@/types";
import { cn } from "@/lib/utils";

interface TodaysScheduleCardProps {
  sessions: Session[];
  students: Student[];
  teachers: Teacher[];
}

const TIME_FMT = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

export function TodaysScheduleCard({ sessions, students, teachers }: TodaysScheduleCardProps) {
  const now = useMemo(() => new Date(), []);

  const todaysSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        const d = new Date(s.date);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [sessions, now]);

  const completedCount = todaysSessions.filter((s) => s.status === "completed").length;

  return (
    <Card className="flex h-[440px] flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Bugünkü Program</CardTitle>
          {todaysSessions.length > 0 && (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {completedCount}/{todaysSessions.length} tamamlandı
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", weekday: "long" }).format(now)}
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {todaysSessions.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Bugün için seans yok"
            description="Bugüne planlanmış bir seans bulunmuyor."
            className="flex-1 border-none bg-transparent py-0"
          />
        ) : (
          <div className="scrollbar-thin -mr-1 min-h-0 flex-1 overflow-y-auto pr-1">
            <ol className="relative space-y-0.5 border-l border-border pl-4">
              {todaysSessions.map((session) => {
                const displayStatus = getSessionDisplayStatus(session, now);
                const isLive = displayStatus === "in_progress";
                const student = students.find((s) => s.id === session.studentId);
                const teacher = teachers.find((t) => t.id === session.teacherId);
                return (
                  <li key={session.id} className="relative py-2">
                    <span
                      className={cn(
                        "absolute -left-[21px] top-3.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                        isLive
                          ? "bg-primary ring-4 ring-primary/15"
                          : displayStatus === "completed"
                          ? "bg-emerald-500"
                          : displayStatus === "cancelled" || displayStatus === "no_show"
                          ? "bg-muted-foreground/40"
                          : "bg-blue-500"
                      )}
                    />
                    <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-foreground">
                          {TIME_FMT.format(new Date(session.date))}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {student?.fullName ?? "—"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {teacher?.fullName ?? "—"}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={displayStatus} className="shrink-0" />
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
        <div className="mt-3 shrink-0 border-t border-border/60 pt-3">
          <Link href="/app/calendar" className="text-xs font-medium text-primary hover:underline">
            → Takvimde Aç
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
