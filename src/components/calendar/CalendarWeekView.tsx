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

const HOUR_HEIGHT = 64; // px per hour
// A trailing row for the end-of-day label, so the timeline has a visible
// close instead of the last hour block just stopping at the container edge.
const END_LABEL_HEIGHT = 28;

function formatHourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

const DAY_LABELS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

function getEventTop(event: CalendarEvent, hourStart: number, hourEnd: number): number {
  const h = event.date.getHours();
  const m = event.date.getMinutes();
  const clampedH = Math.max(hourStart, Math.min(h, hourEnd - 1));
  const minutes = (clampedH - hourStart) * 60 + (clampedH === h ? m : 0);
  return (minutes / 60) * HOUR_HEIGHT;
}

function getEventHeight(durationMinutes: number): number {
  return Math.max((durationMinutes / 60) * HOUR_HEIGHT, 28);
}

// ─── Event block ───────────────────────────────────────────────────────────────

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

  return (
    <button
      onClick={onClick}
      style={{
        top,
        height,
        left: `calc(${col * widthPct}% + 2px)`,
        width: `calc(${widthPct}% - ${totalCols > 1 ? 3 : 4}px)`,
        borderLeft: `3px solid ${event.educationTypeColor}`,
      }}
      className={cn(
        "absolute rounded-lg pl-1 pr-1.5 py-1 text-left overflow-hidden z-0",
        "transition-all duration-200 ease-out hover:z-10 hover:shadow-md hover:scale-[1.015]",
        "focus:outline-none focus:ring-2 focus:ring-primary/50",
        SESSION_STATUS_BLOCK_COLORS[event.status]
      )}
    >
      {event.billingMode === "historical_non_billable" && (
        <History className="absolute right-1 top-1 h-2.5 w-2.5 opacity-60">
          <title>Geçmiş kayıt — borca dahil değil</title>
        </History>
      )}
      <p className="text-[10px] font-bold leading-none truncate">{event.timeStr}</p>
      <p className="text-[11px] font-semibold leading-tight mt-0.5 truncate">
        {event.studentName}
      </p>
      {height > 40 && totalCols === 1 && (
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
  hours,
  totalHeight,
  hourStart,
  hourEnd,
  onEventClick,
}: {
  date: Date;
  events: CalendarEvent[];
  isToday: boolean;
  hours: number[];
  totalHeight: number;
  hourStart: number;
  hourEnd: number;
  onEventClick: (id: string) => void;
}) {
  const eventLayout = layoutOverlappingEvents(events);

  return (
    <div className="relative flex-1 border-l border-border/60 min-w-0">
      {/* Hour grid lines */}
      <div style={{ height: totalHeight }} className="relative">
        {hours.map((h) => (
          <div
            key={h}
            style={{ height: HOUR_HEIGHT }}
            className="border-b border-border/40"
          />
        ))}
        {/* Matches the time column's closing label height so every day
            column stays the same total height and the gridlines line up. */}
        <div style={{ height: END_LABEL_HEIGHT }} />

        {/* Events */}
        {events.map((event) => (
          <EventBlock
            key={event.id}
            event={event}
            layout={eventLayout.get(event.id) ?? { col: 0, totalCols: 1 }}
            hourStart={hourStart}
            hourEnd={hourEnd}
            onClick={() => onEventClick(event.id)}
          />
        ))}

        {/* Current time indicator (only for today) */}
        {isToday && <CurrentTimeBar hourStart={hourStart} hourEnd={hourEnd} />}
      </div>
    </div>
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
      <div className="h-2.5 w-2.5 rounded-full bg-primary ml-[-5px] shrink-0 shadow-[0_0_0_3px] shadow-primary/20" />
      <div className="flex-1 h-px bg-primary/70" />
    </div>
  );
}

// ─── Props & component ─────────────────────────────────────────────────────────

const DATE_LABEL_FMT = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" });

interface CalendarWeekViewProps {
  weekDays: Date[];
  events: CalendarEvent[];
  onEventClick: (eventId: string) => void;
  /** Called when a day header ("PZT 20") is clicked — the page switches to
   *  Daily view for that date. */
  onDayHeaderClick: (date: Date) => void;
  /** Configured work-day hour range (Ayarlar → Takvim ve Çalışma Saatleri). */
  hourStart: number;
  hourEnd: number;
}

export function CalendarWeekView({
  weekDays,
  events,
  onEventClick,
  onDayHeaderClick,
  hourStart,
  hourEnd,
}: CalendarWeekViewProps) {
  const today = new Date();
  const hourCount = Math.max(hourEnd - hourStart, 1);
  const totalHeight = hourCount * HOUR_HEIGHT + END_LABEL_HEIGHT;
  const hours = Array.from({ length: hourCount }, (_, i) => hourStart + i);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Day headers */}
      <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div className="border-r border-border" />
        {weekDays.map((day, i) => {
          const isToday = isSameDay(day, today);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onDayHeaderClick(day)}
              aria-label={`${DATE_LABEL_FMT.format(day)} — Günlük görünümde aç`}
              className={cn(
                "cursor-pointer py-2.5 text-center border-r border-border last:border-r-0 outline-none",
                "transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50",
                isToday && "bg-primary/8"
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {DAY_LABELS[i]}
              </p>
              <p
                className={cn(
                  "mx-auto mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold",
                  isToday ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground"
                )}
              >
                {day.getDate()}
              </p>
            </button>
          );
        })}
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
          {/* Time labels column */}
          <div className="w-12 shrink-0 border-r border-border/60">
            {hours.map((h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="flex items-start justify-end pr-2 border-b border-border/40"
              >
                <span className="text-[10px] text-muted-foreground tabular-nums -mt-2">
                  {formatHourLabel(h)}
                </span>
              </div>
            ))}
            {/* Closing label — marks where the visible range ends */}
            <div style={{ height: END_LABEL_HEIGHT }} className="flex items-start justify-end pr-2">
              <span className="text-[10px] text-muted-foreground tabular-nums -mt-2">
                {formatHourLabel(hourEnd)}
              </span>
            </div>
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
                  hours={hours}
                  totalHeight={totalHeight}
                  hourStart={hourStart}
                  hourEnd={hourEnd}
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
