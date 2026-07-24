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
// Hour range comes from Ayarlar → Takvim ve Çalışma Saatleri (dayStartTime/
// dayEndTime) via the hourStart/hourEnd props below — nothing here is
// hardcoded anymore, these are just the layout constants that don't vary.

const HOUR_HEIGHT = 72; // slightly taller for single-day view
// A trailing row for the end-of-day label, so the timeline has a visible
// close instead of the last hour block just stopping at the container edge.
const END_LABEL_HEIGHT = 28;

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

function getEventTop(event: CalendarEvent, hourStart: number, hourEnd: number): number {
  const h = event.date.getHours();
  const m = event.date.getMinutes();
  const clampedH = Math.max(hourStart, Math.min(h, hourEnd - 1));
  const minutes = (clampedH - hourStart) * 60 + (clampedH === h ? m : 0);
  return (minutes / 60) * HOUR_HEIGHT;
}

function getEventHeight(durationMinutes: number): number {
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 36);
}

// ─── Event block ───────────────────────────────────────────────────────────────

// Turkish status labels for the tooltip fallback — mirrors StatusBadge's
// wording so hovering a narrow card matches what the badge elsewhere says.
const STATUS_LABELS: Record<CalendarEvent["status"], string> = {
  planned: "Planlandı",
  completed: "Tamamlandı",
  cancelled: "İptal",
  no_show: "Gelmedi",
  makeup: "Telafi",
};

function EventBlock({
  event,
  layout,
  hourStart,
  hourEnd,
  onClick,
}: {
  event: CalendarEvent;
  layout: EventLayout;
  hourStart: number;
  hourEnd: number;
  onClick: () => void;
}) {
  const top = getEventTop(event, hourStart, hourEnd);
  const height = getEventHeight(event.durationMinutes);
  const { col, totalCols } = layout;
  const widthPct = 100 / totalCols;
  // Narrow (overlapping) cards still show everything that fits vertically —
  // duration determines available height regardless of how many columns
  // split the width, so the previous totalCols === 1 gate hid teacher/
  // education-type info from every overlapping session, not just the very
  // narrowest ones. Each line already truncates on its own.
  const tooltip = `${event.timeStr} · ${event.studentName} · ${event.teacherName} · ${event.educationTypeName} · ${STATUS_LABELS[event.status]}`;

  return (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        top,
        height,
        left: `calc(${col * widthPct}% + 4px)`,
        width: `calc(${widthPct}% - ${totalCols > 1 ? 6 : 8}px)`,
        borderLeft: `3px solid ${event.educationTypeColor}`,
      }}
      className={cn(
        "absolute rounded-xl pl-2 pr-2.5 py-1.5 text-left overflow-hidden z-0",
        "transition-all duration-200 ease-out hover:z-10 hover:shadow-md hover:scale-[1.015]",
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
      {height > 52 && (
        <p className="text-xs opacity-70 leading-tight mt-0.5 truncate">{event.teacherName}</p>
      )}
      {height > 68 && (
        <p className="text-[10px] opacity-60 leading-tight mt-0.5 truncate">
          {event.educationTypeName}
        </p>
      )}
    </button>
  );
}

// ─── Current time bar ──────────────────────────────────────────────────────────

function CurrentTimeBar({ hourStart, hourEnd }: { hourStart: number; hourEnd: number }) {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  if (h < hourStart || h >= hourEnd) return null;
  const top = ((h - hourStart) * 60 + m) * (HOUR_HEIGHT / 60);

  return (
    <div
      style={{ top }}
      className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
    >
      <div className="h-2.5 w-2.5 rounded-full bg-primary ml-[-1px] shrink-0 shadow-[0_0_0_3px] shadow-primary/20" />
      <div className="flex-1 h-px bg-primary/70" />
    </div>
  );
}

// ─── Props & component ─────────────────────────────────────────────────────────

interface CalendarDayViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (eventId: string) => void;
  /** Configured work-day hour range (Ayarlar → Takvim ve Çalışma Saatleri). */
  hourStart: number;
  hourEnd: number;
}

export function CalendarDayView({ date, events, onEventClick, hourStart, hourEnd }: CalendarDayViewProps) {
  const today = new Date();
  const isToday = isSameDay(date, today);
  const dayEvents = getSessionsForDate(events, date);
  const eventLayout = layoutOverlappingEvents(dayEvents);
  const hourCount = Math.max(hourEnd - hourStart, 1);
  const totalHeight = hourCount * HOUR_HEIGHT + END_LABEL_HEIGHT;
  const hours = Array.from({ length: hourCount }, (_, i) => hourStart + i);

  const dateLabel = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Day header */}
      <div
        className={cn(
          "py-3 px-4 border-b border-border bg-muted/40 text-center",
          isToday && "bg-primary/8"
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
            <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
              Bugün
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {dayEvents.length} seans
        </p>
      </div>

      {/* Time grid — pt-2 gives the "08:00" label's -mt-2 alignment offset
          somewhere to sit without being clipped by this container's own top
          edge (padding is inside the scrollable area, so it's never cut off,
          unlike a plain negative margin with nothing above it). pb-3 plus the
          closing "21:00" row below give the last session equivalent room at
          the bottom instead of ending flush against the container edge. */}
      <div
        className="overflow-y-auto pt-2 pb-3"
        style={{ maxHeight: "calc(100vh - 300px)", minHeight: "480px" }}
      >
        <div className="flex" style={{ height: totalHeight }}>
          {/* Time labels */}
          <div className="w-14 shrink-0 border-r border-border/60">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-3 border-b border-border/40"
              >
                <span className="text-[10px] text-muted-foreground tabular-nums -mt-2">
                  {formatHourLabel(h)}
                </span>
              </div>
            ))}
            {/* Closing label — marks where the visible range ends */}
            <div style={{ height: END_LABEL_HEIGHT }} className="flex items-start justify-end pr-3">
              <span className="text-[10px] text-muted-foreground tabular-nums -mt-2">
                {formatHourLabel(hourEnd)}
              </span>
            </div>
          </div>

          {/* Event column */}
          <div className="flex-1 relative border-b border-border/40">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="border-b border-border/30"
              />
            ))}
            {/* Matches the closing label's height so both columns stay the
                same total height and the grid lines stay aligned. */}
            <div style={{ height: END_LABEL_HEIGHT }} />

            {dayEvents.map((event) => (
              <EventBlock
                key={event.id}
                event={event}
                layout={eventLayout.get(event.id) ?? { col: 0, totalCols: 1 }}
                hourStart={hourStart}
                hourEnd={hourEnd}
                onClick={() => onEventClick(event.id)}
              />
            ))}

            {isToday && <CurrentTimeBar hourStart={hourStart} hourEnd={hourEnd} />}
          </div>
        </div>
      </div>
    </div>
  );
}
