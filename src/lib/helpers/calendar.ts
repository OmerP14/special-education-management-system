import type { CSSProperties } from "react";
import type { CalendarSettings, CalendarColorSource } from "@/types/settings";
import { formatTime } from "@/lib/helpers/finance";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";
import { cn } from "@/lib/utils";
import { getActiveSettings } from "@/lib/settings/runtime";
import type {
  Session,
  Student,
  Guardian,
  Teacher,
  EducationType,
  SessionStatus,
  SessionBillingMode,
} from "@/types";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CalendarEvent {
  id: string;
  date: Date;
  timeStr: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  educationTypeId: string;
  educationTypeName: string;
  /** Falls back to a neutral gray when the education type is missing/unresolved
   *  — never leaves a session card with no accent at all. */
  educationTypeColor: string;
  status: SessionStatus;
  studentPrice: number;
  teacherEarning: number;
  sessionCount: number;
  durationMinutes: number;
  notes?: string;
  /** Carried straight from Session.billingMode so grid tiles (not just the
   *  detail drawer) can mark a historical, non-billable import — see
   *  isBillableSession() in finance.ts for the accounting-side rule this
   *  labels. Purely a display concern; never read by scheduling/conflict logic. */
  billingMode?: SessionBillingMode;
}

export interface CalendarEventRelations {
  session: Session;
  student: Student | null;
  guardian: Guardian | null;
  teacher: Teacher | null;
  educationType: EducationType | null;
}

export interface CalendarStats {
  todayCount: number;
  weekCount: number;
  plannedCount: number;
  cancelledCount: number;
}

// ─── Date utilities ─────────────────────────────────────────────────────────────

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

const WEEKDAY_SHORT_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

/** "Pzt", "Sal", … for a JS weekday index (0 = Sunday). */
export function getWeekdayShortLabel(dayOfWeek: number): string {
  return WEEKDAY_SHORT_LABELS[dayOfWeek] ?? "";
}

/** Weekday indexes in display order for Ayarlar → Takvim → Haftanın İlk Günü. */
export function getOrderedWeekdays(
  weekStartsOn: 0 | 1 = getActiveSettings().calendar.weekStartsOn
): number[] {
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

/** Returns the 7 days of the week containing referenceDate, starting on
 *  Monday (1) or Sunday (0) — Ayarlar → Takvim → Haftanın İlk Günü by default. */
export function getWeekDays(
  referenceDate: Date,
  weekStartsOn: 0 | 1 = getActiveSettings().calendar.weekStartsOn
): Date[] {
  const dow = referenceDate.getDay(); // 0=Sun
  const diff = -((dow - weekStartsOn + 7) % 7);
  const first = new Date(referenceDate);
  first.setDate(referenceDate.getDate() + diff);
  first.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    return d;
  });
}

/** Returns 42 Date objects (6 full weeks) for a month grid starting on
 *  Monday (1) or Sunday (0) — Ayarlar → Takvim → Haftanın İlk Günü by default. */
export function getMonthDays(
  year: number,
  month: number,
  weekStartsOn: 0 | 1 = getActiveSettings().calendar.weekStartsOn
): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay(); // 0=Sun
  const leadCount = (startDow - weekStartsOn + 7) % 7;
  const startDate = new Date(year, month, 1 - leadCount);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    return d;
  });
}

// ─── Event builders ─────────────────────────────────────────────────────────────

export function buildCalendarEvents(
  sessions: Session[],
  students: Student[],
  teachers: Teacher[],
  educationTypes: EducationType[]
): CalendarEvent[] {
  return sessions.map((session) => {
    const date = new Date(session.date);
    const student = students.find((s) => s.id === session.studentId);
    const teacher = teachers.find((t) => t.id === session.teacherId);
    const et = educationTypes.find((e) => e.id === session.educationTypeId);
    const timeStr = formatTime(session.date);
    return {
      id: session.id,
      date,
      timeStr,
      studentId: session.studentId,
      studentName: student?.fullName ?? "—",
      teacherId: session.teacherId,
      teacherName: teacher?.fullName ?? "—",
      educationTypeId: session.educationTypeId,
      educationTypeName: et?.name ?? "—",
      educationTypeColor: et?.color ?? "#9ca3af",
      status: session.status,
      studentPrice: session.studentPrice,
      teacherEarning: session.teacherEarning,
      sessionCount: session.sessionCount,
      durationMinutes: session.durationMinutes,
      notes: session.notes,
      billingMode: session.billingMode,
    };
  });
}

export function getSessionsForDate(events: CalendarEvent[], date: Date): CalendarEvent[] {
  return events
    .filter((e) => isSameDay(e.date, date))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getSessionsForWeek(
  events: CalendarEvent[],
  weekDays: Date[]
): CalendarEvent[] {
  if (weekDays.length === 0) return [];
  const first = weekDays[0]!;
  const last = new Date(weekDays[weekDays.length - 1]!);
  last.setHours(23, 59, 59, 999);
  return events
    .filter((e) => e.date >= first && e.date <= last)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getSessionsForMonth(
  events: CalendarEvent[],
  year: number,
  month: number // 0-indexed
): CalendarEvent[] {
  return events
    .filter((e) => e.date.getFullYear() === year && e.date.getMonth() === month)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function getCalendarEventRelations(
  sessionId: string,
  sessions: Session[],
  students: Student[],
  teachers: Teacher[],
  educationTypes: EducationType[],
  guardians: Guardian[]
): CalendarEventRelations | null {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const student = students.find((s) => s.id === session.studentId) ?? null;
  const teacher = teachers.find((t) => t.id === session.teacherId) ?? null;
  const educationType =
    educationTypes.find((et) => et.id === session.educationTypeId) ?? null;
  const guardian = student
    ? (guardians.find((g) => student.guardianIds.includes(g.id)) ?? null)
    : null;
  return { session, student, teacher, educationType, guardian };
}

export function buildCalendarStats(
  events: CalendarEvent[],
  today: Date
): CalendarStats {
  const weekDays = getWeekDays(today);
  return {
    todayCount: getSessionsForDate(events, today).length,
    weekCount: getSessionsForWeek(events, weekDays).length,
    plannedCount: events.filter((e) => e.status === "planned").length,
    cancelledCount: events.filter(
      (e) => e.status === "cancelled" || e.status === "no_show"
    ).length,
  };
}

// ─── Overlap layout (time-grid day/week views) ─────────────────────────────────

export interface EventLayout {
  /** 0-indexed column this event sits in within its overlap cluster. */
  col: number;
  /** Total columns in this event's overlap cluster — width = 100 / totalCols. */
  totalCols: number;
}

/**
 * Assigns each event a column so overlapping sessions render side-by-side instead of
 * stacking on top of each other (which made every card but the last one unclickable).
 * Two allowed same-time sessions (different student + different teacher) still need to
 * both be visible and clickable — this is the layout that makes that possible.
 *
 * Classic calendar greedy-column algorithm: events are grouped into clusters of mutually
 * overlapping time ranges, then packed into the fewest columns via interval coloring.
 * All events in a cluster share the same `totalCols` so columns line up evenly.
 */
export function layoutOverlappingEvents(events: CalendarEvent[]): Map<string, EventLayout> {
  const layout = new Map<string, EventLayout>();
  const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime());

  let cluster: CalendarEvent[] = [];
  let clusterEnd = -Infinity;
  const clusters: CalendarEvent[][] = [];

  for (const ev of sorted) {
    const start = ev.date.getTime();
    const end = start + ev.durationMinutes * 60_000;
    if (cluster.length === 0 || start < clusterEnd) {
      cluster.push(ev);
      clusterEnd = Math.max(clusterEnd, end);
    } else {
      clusters.push(cluster);
      cluster = [ev];
      clusterEnd = end;
    }
  }
  if (cluster.length > 0) clusters.push(cluster);

  for (const cl of clusters) {
    const columnEndTimes: number[] = [];
    const colOf = new Map<string, number>();
    for (const ev of cl) {
      const start = ev.date.getTime();
      const end = start + ev.durationMinutes * 60_000;
      let placedCol = -1;
      for (let i = 0; i < columnEndTimes.length; i++) {
        if (columnEndTimes[i]! <= start) {
          columnEndTimes[i] = end;
          placedCol = i;
          break;
        }
      }
      if (placedCol === -1) {
        columnEndTimes.push(end);
        placedCol = columnEndTimes.length - 1;
      }
      colOf.set(ev.id, placedCol);
    }
    const totalCols = columnEndTimes.length;
    for (const ev of cl) {
      layout.set(ev.id, { col: colOf.get(ev.id)!, totalCols });
    }
  }

  return layout;
}

// ─── Status colour maps ─────────────────────────────────────────────────────────

/** Tailwind classes for time-grid event blocks (left-border accent). */
export const SESSION_STATUS_BLOCK_COLORS: Record<SessionStatus, string> = {
  planned: "bg-blue-50 border-l-2 border-l-blue-500 text-blue-800 hover:bg-blue-100",
  completed:
    "bg-emerald-50 border-l-2 border-l-emerald-500 text-emerald-800 hover:bg-emerald-100",
  cancelled: "bg-gray-100 border-l-2 border-l-gray-400 text-gray-500 hover:bg-gray-200",
  no_show: "bg-red-50 border-l-2 border-l-red-500 text-red-800 hover:bg-red-100",
  makeup: "bg-purple-50 border-l-2 border-l-purple-500 text-purple-800 hover:bg-purple-100",
};

/** Tailwind classes for compact month-view pills. */
export const SESSION_STATUS_PILL_COLORS: Record<SessionStatus, string> = {
  planned: "bg-blue-500 text-white",
  completed: "bg-emerald-500 text-white",
  cancelled: "bg-gray-400 text-white",
  no_show: "bg-red-500 text-white",
  makeup: "bg-purple-500 text-white",
};

// ─── Institution calendar overlays (Ayarlar → Takvim) ──────────────────────────

export interface CalendarDayMeta {
  /** Holiday label when the date is a configured holiday. */
  holiday: string | null;
  /** Not one of the configured working days. */
  closed: boolean;
}

export function getCalendarDayMeta(date: Date, calendar: CalendarSettings): CalendarDayMeta {
  const holiday = calendar.holidays.find((h) => h.date === toLocalDateKey(date));
  return { holiday: holiday?.label ?? null, closed: !calendar.workingDays.includes(date.getDay()) };
}

/** Lunch break as fractional hours ({ start: 12.5, end: 13.5 }), or null when unset. */
export function getLunchBreakHours(calendar: CalendarSettings): { start: number; end: number } | null {
  if (!calendar.lunchBreakStart || !calendar.lunchBreakEnd) return null;
  const toHours = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return (h ?? 0) + (m ?? 0) / 60;
  };
  const start = toHours(calendar.lunchBreakStart);
  const end = toHours(calendar.lunchBreakEnd);
  return end > start ? { start, end } : null;
}

/** Everything the time-grid views need from the institution settings. */
export interface CalendarDisplayOptions {
  colorSource: CalendarColorSource;
  overlapDisplay: CalendarSettings["overlapDisplay"];
  calendar: CalendarSettings;
}

const STATUS_ACCENT_COLORS: Record<SessionStatus, string> = {
  planned: "#3b82f6",
  completed: "#10b981",
  cancelled: "#9ca3af",
  no_show: "#ef4444",
  makeup: "#a855f7",
};

const TEACHER_PALETTE = [
  "#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed",
  "#0891b2", "#ca8a04", "#dc2626", "#4f46e5", "#0d9488",
];

/** Stable color per teacher (Ayarlar → Takvim → Seans Renklendirme: Öğretmene Göre). */
export function getTeacherColor(teacherId: string): string {
  let hash = 0;
  for (let i = 0; i < teacherId.length; i++) hash = (hash * 31 + teacherId.charCodeAt(i)) | 0;
  return TEACHER_PALETTE[Math.abs(hash) % TEACHER_PALETTE.length]!;
}

/** Accent color of an event for the configured color source. */
export function getEventAccentColor(event: CalendarEvent, colorSource: CalendarColorSource): string {
  if (colorSource === "educationType") return event.educationTypeColor;
  if (colorSource === "teacher") return getTeacherColor(event.teacherId);
  return STATUS_ACCENT_COLORS[event.status];
}

/** Classes + inline style for a time-grid/agenda event card. */
export function getEventBlockAppearance(
  event: CalendarEvent,
  colorSource: CalendarColorSource
): { className: string; style: CSSProperties } {
  const accent = getEventAccentColor(event, colorSource);
  if (colorSource === "status") {
    return { className: SESSION_STATUS_BLOCK_COLORS[event.status], style: { borderLeft: `3px solid ${accent}` } };
  }
  const muted = event.status === "cancelled" || event.status === "no_show";
  return {
    className: cn("text-foreground hover:brightness-95", muted && "opacity-60", event.status === "cancelled" && "line-through"),
    style: { backgroundColor: `${accent}1f`, borderLeft: `3px solid ${accent}` },
  };
}

/** Classes + inline style for a compact month-view pill. */
export function getEventPillAppearance(
  event: CalendarEvent,
  colorSource: CalendarColorSource
): { className: string; style: CSSProperties } {
  if (colorSource === "status") return { className: SESSION_STATUS_PILL_COLORS[event.status], style: {} };
  return {
    className: cn("text-white", event.status === "cancelled" && "line-through opacity-70"),
    style: { backgroundColor: getEventAccentColor(event, colorSource) },
  };
}

/** Legend entries matching the configured color source. */
export function getCalendarLegend(
  colorSource: CalendarColorSource,
  educationTypes: EducationType[],
  teachers: Teacher[]
): { key: string; label: string; color: string }[] {
  if (colorSource === "educationType") {
    return educationTypes.filter((et) => et.status === "active").map((et) => ({ key: et.id, label: et.name, color: et.color }));
  }
  if (colorSource === "teacher") {
    return teachers.filter((t) => t.status === "active").map((t) => ({ key: t.id, label: t.fullName, color: getTeacherColor(t.id) }));
  }
  return [
    { key: "planned", label: "Planlandı", color: STATUS_ACCENT_COLORS.planned },
    { key: "completed", label: "Tamamlandı", color: STATUS_ACCENT_COLORS.completed },
    { key: "cancelled", label: "İptal", color: STATUS_ACCENT_COLORS.cancelled },
    { key: "no_show", label: "Gelmedi", color: STATUS_ACCENT_COLORS.no_show },
    { key: "makeup", label: "Telafi", color: STATUS_ACCENT_COLORS.makeup },
  ];
}

/** Position of an event inside its overlap cluster for the configured
 *  "Çakışan Seans Görünümü": side by side columns, or cascaded cards that
 *  keep full width with a small offset per overlap. */
export function getOverlapPosition(
  layout: EventLayout,
  overlapDisplay: CalendarSettings["overlapDisplay"],
  gutterPx: number
): { left: string; width: string; zIndex?: number } {
  const { col, totalCols } = layout;
  if (overlapDisplay === "compact" && totalCols > 1) {
    const offset = col * 10;
    return { left: `${offset + gutterPx}px`, width: `calc(100% - ${offset + gutterPx * 2}px)`, zIndex: col };
  }
  const widthPct = 100 / totalCols;
  return {
    left: `calc(${col * widthPct}% + ${gutterPx}px)`,
    width: `calc(${widthPct}% - ${totalCols > 1 ? gutterPx * 1.5 : gutterPx * 2}px)`,
  };
}

/**
 * Hour range for Week/Day grids. Normally the configured working hours; with
 * "Boş saatleri gizle" it shrinks to just the hours that hold sessions in the
 * visible days (falling back to working hours when there are none).
 */
export function getVisibleHourRange(
  calendar: CalendarSettings,
  visibleEvents: CalendarEvent[]
): { hourStart: number; hourEnd: number } {
  const hourStart = Number(calendar.dayStartTime.split(":")[0]);
  const [endH, endM] = calendar.dayEndTime.split(":").map(Number);
  const hourEnd = (endH ?? 21) + ((endM ?? 0) > 0 ? 1 : 0);
  if (!calendar.hideEmptyHours || visibleEvents.length === 0) return { hourStart, hourEnd };
  let min = 24;
  let max = 0;
  for (const ev of visibleEvents) {
    const start = ev.date.getHours() + ev.date.getMinutes() / 60;
    min = Math.min(min, Math.floor(start));
    max = Math.max(max, Math.ceil(start + ev.durationMinutes / 60));
  }
  return { hourStart: Math.max(0, min), hourEnd: Math.min(24, Math.max(max, min + 1)) };
}
