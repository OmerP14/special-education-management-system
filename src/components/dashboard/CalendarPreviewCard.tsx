"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildCalendarEvents,
  getWeekDays,
  getSessionsForDate,
  isSameDay,
} from "@/lib/helpers/calendar";
import type { Session, Student, Teacher, EducationType } from "@/types";
import { cn } from "@/lib/utils";

interface CalendarPreviewCardProps {
  sessions: Session[];
  students: Student[];
  teachers: Teacher[];
  educationTypes: EducationType[];
}

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MAX_DOTS = 4;

export function CalendarPreviewCard({ sessions, students, teachers, educationTypes }: CalendarPreviewCardProps) {
  const today = useMemo(() => new Date(), []);
  const weekDays = useMemo(() => getWeekDays(today), [today]);
  const events = useMemo(
    () => buildCalendarEvents(sessions, students, teachers, educationTypes),
    [sessions, students, teachers, educationTypes]
  );

  return (
    <Card className="flex h-[320px] flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Bu Hafta</CardTitle>
        <p className="text-sm text-muted-foreground">Haftalık takvim önizlemesi</p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col justify-center gap-2">
        <div className="grid grid-cols-7 gap-1.5">
          {weekDays.map((day, i) => {
            const dayEvents = getSessionsForDate(events, day);
            const isToday = isSameDay(day, today);
            const visibleDots = dayEvents.slice(0, MAX_DOTS);
            return (
              <div
                key={i}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-lg py-2 transition-colors",
                  isToday ? "bg-primary/8" : "hover:bg-muted/50"
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {DAY_LABELS[i]}
                </span>
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                    isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                  )}
                >
                  {day.getDate()}
                </span>
                <div className="flex h-1.5 items-center gap-0.5">
                  {visibleDots.map((event) => (
                    <span
                      key={event.id}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: event.educationTypeColor }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {dayEvents.length > 0 ? dayEvents.length : ""}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 shrink-0 border-t border-border/60 pt-3">
          <Link href="/app/calendar" className="text-xs font-medium text-primary hover:underline">
            → Takvimi Aç
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
