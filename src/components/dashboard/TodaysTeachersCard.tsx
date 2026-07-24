"use client";

import { useMemo } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/shared/EmptyState";
import { getSessionDisplayStatus } from "@/lib/helpers/finance";
import type { Session, Teacher } from "@/types";
import { cn } from "@/lib/utils";

interface TodaysTeachersCardProps {
  sessions: Session[];
  teachers: Teacher[];
}

const TIME_FMT = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

export function TodaysTeachersCard({ sessions, teachers }: TodaysTeachersCardProps) {
  const now = useMemo(() => new Date(), []);

  const rows = useMemo(() => {
    const activeTeachers = teachers.filter((t) => t.status === "active");
    return activeTeachers
      .map((teacher) => {
        const todaysSessions = sessions
          .filter((s) => {
            if (s.teacherId !== teacher.id) return false;
            const d = new Date(s.date);
            return (
              d.getFullYear() === now.getFullYear() &&
              d.getMonth() === now.getMonth() &&
              d.getDate() === now.getDate() &&
              s.status !== "cancelled"
            );
          })
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const liveSession = todaysSessions.find(
          (s) => getSessionDisplayStatus(s, now) === "in_progress"
        );
        const nextSession = todaysSessions.find((s) => new Date(s.date).getTime() > now.getTime());

        return { teacher, count: todaysSessions.length, liveSession, nextSession };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [sessions, teachers, now]);

  return (
    <Card className="flex h-[320px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Bugünkü Öğretmenler</CardTitle>
        <p className="text-sm text-muted-foreground">{rows.length} öğretmen bugün ders veriyor</p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {rows.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Bugün ders yok"
            description="Hiçbir öğretmenin bugün planlı seansı yok."
            className="flex-1 border-none bg-transparent py-0"
          />
        ) : (
          <div className="scrollbar-thin -mr-1 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {rows.map(({ teacher, count, liveSession, nextSession }) => (
              <div
                key={teacher.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
              >
                <div className="relative shrink-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                      {teacher.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")}
                    </AvatarFallback>
                  </Avatar>
                  {liveSession && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{teacher.fullName}</p>
                  <p
                    className={cn(
                      "truncate text-xs",
                      liveSession ? "font-medium text-emerald-600" : "text-muted-foreground"
                    )}
                  >
                    {liveSession
                      ? "Şu an derste"
                      : nextSession
                      ? `Sıradaki: ${TIME_FMT.format(new Date(nextSession.date))}`
                      : "Bugünkü dersleri bitti"}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                  {count} seans
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 shrink-0 border-t border-border/60 pt-3">
          <Link href="/app/teachers" className="text-xs font-medium text-primary hover:underline">
            → Tüm Öğretmenleri Gör
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
