import type { CSSProperties } from "react";
import type { CalendarSettings } from "@/types/settings";
import { formatTime } from "@/lib/helpers/finance";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";
import { cn } from "@/lib/utils";
import { getStudentGuardianContact } from "@/lib/helpers/student-rules";
import type {
  Session,
  Student,
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
  guardian: { fullName: string; phone: string } | null;
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

/** Weeks always start on Monday. */
const WEEK_STARTS_ON = 1;

/** Weekday indexes in display order (Monday first). */
export function getOrderedWeekdays(): number[] {
  const weekStartsOn = WEEK_STARTS_ON;
  return Array.from({ length: 7 }, (_, i) => (weekStartsOn + i) % 7);
}

/** Returns the 7 days (Monday to Sunday) of the week containing referenceDate. */
export function getWeekDays(referenceDate: Date): Date[] {
  const weekStartsOn = WEEK_STARTS_ON;
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

/** Returns 42 Date objects (6 full weeks, Monday first) for a month grid. */
export function getMonthDays(year: number, month: number): Date[] {
  const weekStartsOn = WEEK_STARTS_ON;
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

export function getCalendarEventRelations(
  sessionId: string,
  sessions: Session[],
  students: Student[],
  teachers: Teacher[],
  educationTypes: EducationType[]
): CalendarEventRelations | null {
  const session = sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const student = students.find((s) => s.id === session.studentId) ?? null;
  const teacher = teachers.find((t) => t.id === session.teacherId) ?? null;
  const educationType =
    educationTypes.find((et) => et.id === session.educationTypeId) ?? null;
  const guardian = getStudentGuardianContact(student);
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
  calendar: CalendarSettings;
}

/** Classes + inline style for a time-grid/agenda event card: the education
 *  type's color, muted when cancelled or a no-show, struck through when
 *  cancelled. */
export function getEventBlockAppearance(event: CalendarEvent): { className: string; style: CSSProperties } {
  const accent = event.educationTypeColor;
  const muted = event.status === "cancelled" || event.status === "no_show";
  return {
    className: cn("text-foreground hover:brightness-95", muted && "opacity-60", event.status === "cancelled" && "line-through"),
    style: { backgroundColor: `${accent}1f`, borderLeft: `3px solid ${accent}` },
  };
}

/** Classes + inline style for a compact month-view pill. */
export function getEventPillAppearance(event: CalendarEvent): { className: string; style: CSSProperties } {
  return {
    className: cn("text-white", event.status === "cancelled" && "line-through opacity-70"),
    style: { backgroundColor: event.educationTypeColor },
  };
}

/** Legend entries: one per active education type. */
export function getCalendarLegend(educationTypes: EducationType[]): { key: string; label: string; color: string }[] {
  return educationTypes.filter((et) => et.status === "active").map((et) => ({ key: et.id, label: et.name, color: et.color }));
}

/** Position of an event inside its overlap cluster: side-by-side columns. */
export function getOverlapPosition(layout: EventLayout, gutterPx: number): { left: string; width: string } {
  const { col, totalCols } = layout;
  const widthPct = 100 / totalCols;
  return {
    left: `calc(${col * widthPct}% + ${gutterPx}px)`,
    width: `calc(${widthPct}% - ${totalCols > 1 ? gutterPx * 1.5 : gutterPx * 2}px)`,
  };
}

/** Hour range for Week/Day grids: the configured working hours, widened to
 *  fit any shown lesson outside them — a 19:00 lesson must sit at 19:00, not be
 *  squeezed against the bottom edge of an 08–18 grid. */
export function getVisibleHourRange(
  calendar: CalendarSettings,
  events: { date: Date; durationMinutes?: number }[] = []
): { hourStart: number; hourEnd: number } {
  let hourStart = Number(calendar.dayStartTime.split(":")[0]);
  const [endH, endM] = calendar.dayEndTime.split(":").map(Number);
  let hourEnd = (endH ?? 21) + ((endM ?? 0) > 0 ? 1 : 0);
  for (const e of events) {
    const start = e.date.getHours() + e.date.getMinutes() / 60;
    const end = start + (e.durationMinutes ?? 40) / 60;
    hourStart = Math.min(hourStart, Math.floor(start));
    hourEnd = Math.max(hourEnd, Math.min(24, Math.ceil(end)));
  }
  return { hourStart, hourEnd };
}
