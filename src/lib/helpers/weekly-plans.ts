import type { Session, Student, EducationType, WeeklySessionPlan, WeeklyScheduleSlot } from "@/types";
import { getSessionDisplayStatus } from "@/lib/helpers/finance";

// ─── Date generation ────────────────────────────────────────────────────────────

/**
 * Generates ISO datetime strings for every weekly-schedule slot that falls
 * between startDate and endDate (inclusive), sorted chronologically.
 */
export function generateSessionDates(
  startDate: string,
  endDate: string,
  slots: Pick<WeeklyScheduleSlot, "dayOfWeek" | "time">[]
): string[] {
  if (!startDate || !endDate || slots.length === 0) return [];
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T23:59:59");
  if (end <= start) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  let safety = 0;

  while (cursor <= end && dates.length < 365 && safety < 800) {
    safety++;
    for (const slot of slots) {
      if (cursor.getDay() === slot.dayOfWeek) {
        const [h, m] = slot.time.split(":").map(Number);
        const d = new Date(cursor);
        d.setHours(h ?? 9, m ?? 0, 0, 0);
        dates.push(d.toISOString());
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates.sort();
}

/** Adds one calendar day to a "YYYY-MM-DD" string and returns the same format. */
export function nextDayString(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Duplicate protection ───────────────────────────────────────────────────────

/**
 * Returns the set of timestamps (from `dates`) that already have an identical
 * session recorded (same studentId + teacherId + educationTypeId + instant).
 * Comparison is instant-based (getTime()) so it is resilient to differing
 * date-string formats between manually-created and plan-generated sessions.
 */
export function findDuplicateDateTimestamps(
  dates: string[],
  studentId: string,
  teacherId: string,
  educationTypeId: string,
  sessions: Session[]
): Set<number> {
  const existingTimestamps = new Set(
    sessions
      .filter(
        (s) =>
          s.studentId === studentId &&
          s.teacherId === teacherId &&
          s.educationTypeId === educationTypeId
      )
      .map((s) => new Date(s.date).getTime())
  );

  const result = new Set<number>();
  for (const d of dates) {
    const t = new Date(d).getTime();
    if (existingTimestamps.has(t)) result.add(t);
  }
  return result;
}

// ─── Conflict detection ─────────────────────────────────────────────────────────

export interface WeeklyPlanConflictRow {
  date: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  educationTypeId: string;
  educationTypeName: string;
}

export interface WeeklyPlanConflictResult {
  teacherConflicts: WeeklyPlanConflictRow[];
  studentConflicts: WeeklyPlanConflictRow[];
}

/**
 * Checks whether the given teacher or student already has another
 * planned/in_progress session at any of the candidate `dates`.
 * Exact duplicates (same student+teacher+educationType+instant) are excluded
 * here — those are handled by duplicate protection, not conflict warnings.
 */
export function findWeeklyPlanConflicts(
  dates: string[],
  studentId: string,
  teacherId: string,
  educationTypeId: string,
  sessions: Session[],
  students: Student[],
  educationTypes: EducationType[]
): WeeklyPlanConflictResult {
  const dateTimestamps = new Set(dates.map((d) => new Date(d).getTime()));
  const teacherConflicts: WeeklyPlanConflictRow[] = [];
  const studentConflicts: WeeklyPlanConflictRow[] = [];

  for (const s of sessions) {
    if (!dateTimestamps.has(new Date(s.date).getTime())) continue;

    const display = getSessionDisplayStatus(s);
    if (display !== "planned" && display !== "in_progress") continue;

    const isExactDuplicate =
      s.studentId === studentId &&
      s.teacherId === teacherId &&
      s.educationTypeId === educationTypeId;
    if (isExactDuplicate) continue;

    const isTeacherMatch = s.teacherId === teacherId;
    const isStudentMatch = s.studentId === studentId;
    if (!isTeacherMatch && !isStudentMatch) continue;

    const student = students.find((st) => st.id === s.studentId);
    const et = educationTypes.find((e) => e.id === s.educationTypeId);
    const row: WeeklyPlanConflictRow = {
      date: s.date,
      sessionId: s.id,
      studentId: s.studentId,
      studentName: student?.fullName ?? "—",
      teacherId: s.teacherId,
      educationTypeId: s.educationTypeId,
      educationTypeName: et?.name ?? "—",
    };
    if (isTeacherMatch) teacherConflicts.push(row);
    if (isStudentMatch) studentConflicts.push(row);
  }

  const byDate = (a: WeeklyPlanConflictRow, b: WeeklyPlanConflictRow) =>
    new Date(a.date).getTime() - new Date(b.date).getTime();
  teacherConflicts.sort(byDate);
  studentConflicts.sort(byDate);

  return { teacherConflicts, studentConflicts };
}

// ─── Plan status ────────────────────────────────────────────────────────────────

export type WeeklyPlanStatus = "active" | "paused" | "completed";

export function computeWeeklyPlanStatus(
  plan: Pick<WeeklySessionPlan, "isActive" | "endDate">,
  now: Date = new Date()
): WeeklyPlanStatus {
  if (!plan.isActive) return "paused";
  const end = new Date(plan.endDate + "T23:59:59");
  if (end < now) return "completed";
  return "active";
}

// ─── Plan session stats ─────────────────────────────────────────────────────────

export interface WeeklyPlanSessionStats {
  total: number;
  completed: number;
  planned: number;
  inProgress: number;
  cancelled: number;
  noShow: number;
  makeup: number;
  /** Sessions still ahead: planned + in_progress. */
  remaining: number;
}

export function computeWeeklyPlanSessionStats(
  planId: string,
  sessions: Session[],
  now: Date = new Date()
): WeeklyPlanSessionStats {
  const stats: WeeklyPlanSessionStats = {
    total: 0,
    completed: 0,
    planned: 0,
    inProgress: 0,
    cancelled: 0,
    noShow: 0,
    makeup: 0,
    remaining: 0,
  };

  for (const s of sessions) {
    if (s.weeklyPlanId !== planId) continue;
    stats.total++;
    const display = getSessionDisplayStatus(s, now);
    switch (display) {
      case "completed": stats.completed++; break;
      case "planned": stats.planned++; break;
      case "in_progress": stats.inProgress++; break;
      case "cancelled": stats.cancelled++; break;
      case "no_show": stats.noShow++; break;
      case "makeup": stats.makeup++; break;
    }
  }

  stats.remaining = stats.planned + stats.inProgress;
  return stats;
}
