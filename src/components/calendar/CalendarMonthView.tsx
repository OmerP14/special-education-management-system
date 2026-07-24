"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import { History } from "lucide-react";
import {
  isSameDay,
  getMonthDays,
  getSessionsForDate,
  SESSION_STATUS_PILL_COLORS,
  type CalendarEvent,
} from "@/lib/helpers/calendar";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────────

const DAY_HEADERS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const MAX_CHIPS = 3;

const DATE_LABEL_FMT = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
});

// ─── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({
  date,
  isCurrentMonth,
  isToday,
  events,
  onEventClick,
  onDayClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  onEventClick: (id: string) => void;
  onDayClick: (date: Date) => void;
}) {
  const visible = events.slice(0, MAX_CHIPS);
  const overflow = events.length - MAX_CHIPS;

  // Clicking anywhere in the cell — the day number or the empty background —
  // drills into Daily view for this date. Event chips (and "+N daha") stop
  // propagation so they keep their own click behavior instead of also
  // triggering this. A <div role="button"> rather than a real <button>
  // because the cell contains its own nested buttons, which a <button>
  // can't legally contain.
  const openDay = () => onDayClick(date);
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openDay();
    }
  };
  const stopAnd = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openDay}
      onKeyDown={handleKeyDown}
      aria-label={`${DATE_LABEL_FMT.format(date)} — Günlük görünümde aç`}
      className={cn(
        "min-h-[100px] cursor-pointer border-b border-r border-border p-1.5 outline-none transition-colors",
        "hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-inset",
        !isCurrentMonth && "bg-muted/20"
      )}
    >
      {/* Date number */}
      <div className="mb-1 flex justify-end">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-transform",
            isToday
              ? "bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/20 ring-offset-1 ring-offset-card"
              : isCurrentMonth
              ? "text-foreground"
              : "text-muted-foreground/50"
          )}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Event chips */}
      <div className="space-y-1">
        {visible.map((event) => (
          <button
            key={event.id}
            onClick={stopAnd(() => onEventClick(event.id))}
            className={cn(
              "flex w-full items-center gap-1 truncate rounded-full px-2 py-0.5 text-left text-[10px] font-medium leading-tight",
              "transition-all duration-200 ease-out hover:scale-[1.03] hover:shadow-sm",
              SESSION_STATUS_PILL_COLORS[event.status]
            )}
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full ring-1 ring-white/40"
              style={{ backgroundColor: event.educationTypeColor }}
            />
            {event.billingMode === "historical_non_billable" && (
              <History className="h-2.5 w-2.5 shrink-0 opacity-60">
                <title>Geçmiş kayıt — borca dahil değil</title>
              </History>
            )}
            <span className="truncate">
              {event.timeStr} {event.studentName}
            </span>
          </button>
        ))}
        {overflow > 0 && (
          <button
            onClick={stopAnd(openDay)}
            className="w-full truncate rounded-full px-2 text-left text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            +{overflow} daha
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Props & component ─────────────────────────────────────────────────────────

interface CalendarMonthViewProps {
  year: number;
  month: number; // 0-indexed
  events: CalendarEvent[];
  onEventClick: (eventId: string) => void;
  /** Called when a day number, a day cell's empty area, or its "+N daha"
   *  indicator is clicked — the page switches to Daily view for that date. */
  onDayClick: (date: Date) => void;
}

export function CalendarMonthView({
  year,
  month,
  events,
  onEventClick,
  onDayClick,
}: CalendarMonthViewProps) {
  const today = new Date();
  const days = getMonthDays(year, month);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-r border-border last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells (42 cells = 6 weeks) */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const dayEvents = getSessionsForDate(events, day);
          return (
            <DayCell
              key={i}
              date={day}
              isCurrentMonth={day.getMonth() === month}
              isToday={isSameDay(day, today)}
              events={dayEvents}
              onEventClick={onEventClick}
              onDayClick={onDayClick}
            />
          );
        })}
      </div>
    </div>
  );
}
