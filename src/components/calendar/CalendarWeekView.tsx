"use client";

import {
  isSameDay,
  getSessionsForDate,
  SESSION_STATUS_BLOCK_COLORS,
  type CalendarEvent,
} from "@/lib/helpers/calendar";
import { cn } from "@/lib/utils";

// ─── Time grid constants ────────────────────────────────────────────────────────

const HOUR_START = 8;
const HOUR_END = 21;
const HOUR_COUNT = HOUR_END - HOUR_START;
const HOUR_HEIGHT = 64; // px per hour
const TOTAL_HEIGHT = HOUR_COUNT * HOUR_HEIGHT;

const HOURS = Array.from({ length: HOUR_COUNT }, (_, i) => HOUR_START + i);

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function getEventTop(event: CalendarEvent): number {
  const h = event.date.getHours();
  const m = event.date.getMinutes();
  const clampedH = Math.max(HOUR_START, Math.min(h, HOUR_END - 1));
  const minutes = (clampedH - HOUR_START) * 60 + (clampedH === h ? m : 0);
  return (minutes / 60) * HOUR_HEIGHT;
}

function getEventHeight(durationMinutes: number): number {
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 28);
}

// ─── Event block ───────────────────────────────────────────────────────────────

function EventBlock({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  const top = getEventTop(event);
  const height = getEventHeight(event.durationMinutes);

  return (
    <button
      onClick={onClick}
      style={{ top, height, left: 2, right: 2 }}
      className={cn(
        "absolute rounded-md px-1.5 py-1 text-left transition-all overflow-hidden",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        SESSION_STATUS_BLOCK_COLORS[event.status]
      )}
    >
      <p className="text-[10px] font-bold leading-none truncate">{event.timeStr}</p>
      <p className="text-[11px] font-semibold leading-tight mt-0.5 truncate">
        {event.studentName}
      </p>
      {height > 40 && (
        <p className="text-[10px] opacity-70 leading-tight truncate">
          {event.teacherName}
        </p>
      )}
    </button>
  );
}

// ─── Day column ─────────────────────────────────────────────────────────────────

function DayColumn({
  date,
  events,
  isToday,
  onEventClick,
}: {
  date: Date;
  events: CalendarEvent[];
  isToday: boolean;
  onEventClick: (id: string) => void;
}) {
  return (
    <div className="relative flex-1 border-l border-border/60 min-w-0">
      {/* Hour grid lines */}
      <div style={{ height: TOTAL_HEIGHT }} className="relative">
        {HOURS.map((h) => (
          <div
            key={h}
            style={{ height: HOUR_HEIGHT }}
            className="border-b border-border/40"
          />
        ))}

        {/* Events */}
        {events.map((event) => (
          <EventBlock
            key={event.id}
            event={event}
            onClick={() => onEventClick(event.id)}
          />
        ))}

        {/* Current time indicator (only for today) */}
        {isToday && <CurrentTimeBar />}
      </div>
    </div>
  );
}

// ─── Current time bar ──────────────────────────────────────────────────────────

function CurrentTimeBar() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (h < HOUR_START || h >= HOUR_END) return null;
  const top = ((h - HOUR_START) * 60 + m) * (HOUR_HEIGHT / 60);

  return (
    <div
      style={{ top }}
      className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
    >
      <div className="h-2 w-2 rounded-full bg-primary ml-[-4px] shrink-0" />
      <div className="flex-1 h-px bg-primary" />
    </div>
  );
}

// ─── Props & component ─────────────────────────────────────────────────────────

interface CalendarWeekViewProps {
  weekDays: Date[];
  events: CalendarEvent[];
  onEventClick: (eventId: string) => void;
}

export function CalendarWeekView({
  weekDays,
  events,
  onEventClick,
}: CalendarWeekViewProps) {
  const today = new Date();

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b border-border bg-muted/30" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div className="border-r border-border" />
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <div
              key={i}
              className={cn(
                "py-2 text-center border-r border-border last:border-r-0",
                isToday && "bg-primary/5"
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {DAY_LABELS[i]}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-bold",
                  isToday ? "text-primary" : "text-foreground"
                )}
              >
                {day.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 420px)", minHeight: "400px" }}
      >
        <div className="flex" style={{ height: TOTAL_HEIGHT }}>
          {/* Time labels column */}
          <div className="w-12 shrink-0 border-r border-border/60">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-2 border-b border-border/40"
              >
                <span className="text-[10px] text-muted-foreground tabular-nums -mt-2">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex flex-1 min-w-0">
            {weekDays.map((day, i) => {
              const dayEvents = getSessionsForDate(events, day);
              const isToday = isSameDay(day, today);
              return (
                <DayColumn
                  key={i}
                  date={day}
                  events={dayEvents}
                  isToday={isToday}
                  onEventClick={onEventClick}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
