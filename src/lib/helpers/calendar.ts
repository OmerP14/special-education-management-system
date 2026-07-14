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

/** Returns 7 Date objects Mon–Sun for the week containing referenceDate. */
export function getWeekDays(referenceDate: Date): Date[] {
  const dow = referenceDate.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Returns 42 Date objects (6 full weeks) for a Mon-start month grid. */
export function getMonthDays(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay(); // 0=Sun
  const leadCount = startDow === 0 ? 6 : startDow - 1;
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
    const timeStr = new Intl.DateTimeFormat("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
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
