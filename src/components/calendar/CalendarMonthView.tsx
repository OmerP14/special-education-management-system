"use client";

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

// ─── Day cell ──────────────────────────────────────────────────────────────────

function DayCell({
  date,
  isCurrentMonth,
  isToday,
  events,
  onEventClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  onEventClick: (id: string) => void;
}) {
  const visible = events.slice(0, MAX_CHIPS);
  const overflow = events.length - MAX_CHIPS;

  return (
    <div
      className={cn(
        "min-h-[96px] border-b border-r border-border p-1.5",
        !isCurrentMonth && "bg-muted/30"
      )}
    >
      {/* Date number */}
      <div className="mb-1 flex justify-end">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
            isToday
              ? "bg-primary text-primary-foreground"
              : isCurrentMonth
              ? "text-foreground"
              : "text-muted-foreground/50"
          )}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Event chips */}
      <div className="space-y-0.5">
        {visible.map((event) => (
          <button
            key={event.id}
            onClick={() => onEventClick(event.id)}
            className={cn(
              "w-full truncate rounded px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-opacity hover:opacity-80",
              SESSION_STATUS_PILL_COLORS[event.status]
            )}
          >
            {event.timeStr} {event.studentName}
          </button>
        ))}
        {overflow > 0 && (
          <p className="px-1.5 text-[10px] font-medium text-muted-foreground">
            +{overflow} daha
          </p>
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
}

export function CalendarMonthView({
  year,
  month,
  events,
  onEventClick,
}: CalendarMonthViewProps) {
  const today = new Date();
  const days = getMonthDays(year, month);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground border-r border-border last:border-r-0"
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
            />
          );
        })}
      </div>
    </div>
  );
}
