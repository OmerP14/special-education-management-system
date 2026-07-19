"use client";

import { History } from "lucide-react";
import {
  isSameDay,
  getSessionsForDate,
  layoutOverlappingEvents,
  SESSION_STATUS_BLOCK_COLORS,
  type CalendarEvent,
  type EventLayout,
} from "@/lib/helpers/calendar";
import { cn } from "@/lib/utils";

// ─── Time grid constants ────────────────────────────────────────────────────────

const HOUR_START = 8;
const HOUR_END = 21;
const HOUR_COUNT = HOUR_END - HOUR_START;
const HOUR_HEIGHT = 72; // slightly taller for single-day view
const TOTAL_HEIGHT = HOUR_COUNT * HOUR_HEIGHT;

const HOURS = Array.from({ length: HOUR_COUNT }, (_, i) => HOUR_START + i);

function getEventTop(event: CalendarEvent): number {
  const h = event.date.getHours();
  const m = event.date.getMinutes();
  const clampedH = Math.max(HOUR_START, Math.min(h, HOUR_END - 1));
  const minutes = (clampedH - HOUR_START) * 60 + (clampedH === h ? m : 0);
  return (minutes / 60) * HOUR_HEIGHT;
}

function getEventHeight(durationMinutes: number): number {
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 36);
}

// ─── Event block ───────────────────────────────────────────────────────────────

function EventBlock({
  event,
  layout,
  onClick,
}: {
  event: CalendarEvent;
  layout: EventLayout;
  onClick: () => void;
}) {
  const top = getEventTop(event);
  const height = getEventHeight(event.durationMinutes);
  const { col, totalCols } = layout;
  const widthPct = 100 / totalCols;

  return (
    <button
      onClick={onClick}
      style={{
        top,
        height,
        left: `calc(${col * widthPct}% + 4px)`,
        width: `calc(${widthPct}% - ${totalCols > 1 ? 6 : 8}px)`,
        borderLeft: `3px solid ${event.educationTypeColor}`,
      }}
      className={cn(
        "absolute rounded-lg pl-2 pr-2.5 py-1.5 text-left transition-all overflow-hidden z-0 hover:z-10",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        SESSION_STATUS_BLOCK_COLORS[event.status]
      )}
    >
      {event.billingMode === "historical_non_billable" && (
        <History
          className="absolute right-1.5 top-1.5 h-3 w-3 opacity-60"
          aria-label="Geçmiş kayıt — borca dahil değil"
        >
          <title>Geçmiş kayıt — borca dahil değil</title>
        </History>
      )}
      <p className="text-xs font-bold leading-none">{event.timeStr}</p>
      <p className="text-sm font-semibold leading-tight mt-0.5 truncate">{event.studentName}</p>
      {height > 52 && totalCols === 1 && (
        <p className="text-xs opacity-70 leading-tight mt-0.5 truncate">{event.teacherName}</p>
      )}
      {height > 68 && totalCols === 1 && (
        <p className="text-[10px] opacity-60 leading-tight mt-0.5 truncate">
          {event.educationTypeName}
        </p>
      )}
    </button>
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
      <div className="h-2 w-2 rounded-full bg-primary ml-0 shrink-0" />
      <div className="flex-1 h-px bg-primary" />
    </div>
  );
}

// ─── Props & component ─────────────────────────────────────────────────────────

interface CalendarDayViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (eventId: string) => void;
}

export function CalendarDayView({ date, events, onEventClick }: CalendarDayViewProps) {
  const today = new Date();
  const isToday = isSameDay(date, today);
  const dayEvents = getSessionsForDate(events, date);
  const eventLayout = layoutOverlappingEvents(dayEvents);

  const dateLabel = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Day header */}
      <div
        className={cn(
          "py-3 px-4 border-b border-border bg-muted/30 text-center",
          isToday && "bg-primary/5"
        )}
      >
        <p
          className={cn(
            "text-sm font-semibold capitalize",
            isToday ? "text-primary" : "text-foreground"
          )}
        >
          {dateLabel}
          {isToday && (
            <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-primary/70">
              Bugün
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {dayEvents.length} seans
        </p>
      </div>

      {/* Time grid */}
      <div
        className="overflow-y-auto"
        style={{ maxHeight: "calc(100vh - 420px)", minHeight: "400px" }}
      >
        <div className="flex" style={{ height: TOTAL_HEIGHT }}>
          {/* Time labels */}
          <div className="w-14 shrink-0 border-r border-border/60">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-3 border-b border-border/40"
              >
                <span className="text-[10px] text-muted-foreground tabular-nums -mt-2">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Event column */}
          <div className="flex-1 relative border-b border-border/40">
            {HOURS.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="border-b border-border/30"
              />
            ))}

            {dayEvents.map((event) => (
              <EventBlock
                key={event.id}
                event={event}
                layout={eventLayout.get(event.id) ?? { col: 0, totalCols: 1 }}
                onClick={() => onEventClick(event.id)}
              />
            ))}

            {isToday && <CurrentTimeBar />}
          </div>
        </div>
      </div>
    </div>
  );
}
