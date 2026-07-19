"use client";

import { CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  isSameDay,
  SESSION_STATUS_BLOCK_COLORS,
  type CalendarEvent,
} from "@/lib/helpers/calendar";
import { cn } from "@/lib/utils";

// ─── Day header ─────────────────────────────────────────────────────────────────

const TODAY = new Date();

function DayGroupHeader({ date }: { date: Date }) {
  const isToday = isSameDay(date, TODAY);
  const label = new Intl.DateTimeFormat("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  return (
    <div className="flex items-center gap-2 mb-2 mt-5 first:mt-0">
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          isToday
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {date.getDate()}
      </div>
      <span
        className={cn(
          "text-sm font-semibold capitalize",
          isToday ? "text-primary" : "text-foreground"
        )}
      >
        {label}
        {isToday && (
          <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-primary/70">
            Bugün
          </span>
        )}
      </span>
    </div>
  );
}

// ─── Event row ─────────────────────────────────────────────────────────────────

function AgendaEventRow({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ borderLeft: `3px solid ${event.educationTypeColor}` }}
      className={cn(
        "w-full text-left rounded-lg pl-2.5 pr-3 py-2.5 mb-1.5 transition-all",
        "flex items-center gap-3",
        SESSION_STATUS_BLOCK_COLORS[event.status]
      )}
    >
      <span className="text-xs font-semibold tabular-nums shrink-0 w-10">
        {event.timeStr}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{event.studentName}</p>
        <p className="text-xs opacity-75 truncate">
          {event.teacherName} · {event.educationTypeName}
        </p>
      </div>
      <StatusBadge status={event.status} className="shrink-0 text-[10px]" />
    </button>
  );
}

// ─── Props & component ─────────────────────────────────────────────────────────

interface CalendarAgendaViewProps {
  events: CalendarEvent[];
  onEventClick: (eventId: string) => void;
}

export function CalendarAgendaView({ events, onEventClick }: CalendarAgendaViewProps) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Seans bulunamadı"
        description="Bu dönemde seçili kriterlere uyan seans yok."
      />
    );
  }

  // Group by calendar date
  const grouped = new Map<string, CalendarEvent[]>();
  [...events]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((e) => {
      const key = `${e.date.getFullYear()}-${e.date.getMonth()}-${e.date.getDate()}`;
      const arr = grouped.get(key) ?? [];
      arr.push(e);
      grouped.set(key, arr);
    });

  return (
    <div>
      {[...grouped.entries()].map(([key, dayEvents]) => (
        <div key={key}>
          <DayGroupHeader date={dayEvents[0]!.date} />
          {dayEvents.map((event) => (
            <AgendaEventRow
              key={event.id}
              event={event}
              onClick={() => onEventClick(event.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
