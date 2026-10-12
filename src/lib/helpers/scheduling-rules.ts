import type { Session } from "@/types";
import type { CalendarSettings, InstitutionSettings, SessionSettings } from "@/types/settings";
import { CONFLICT_BLOCKING_STATUSES, type CheckSessionConflictParams } from "@/lib/helpers/session-conflict";

// ─── Institution scheduling rules (Ayarlar → Seans / Takvim) ─────────────────
// Pure helpers shared by the session form, weekly plans and plan extension, so
// working days, holidays, hours and lesson lengths are judged the same way
// everywhere a session can be created.

// ─── Lessons and breaks ──────────────────────────────────────────────────────
// A lesson is always 40 minutes. A block lesson is two lessons back to back
// in ONE session (80 minutes, no break inside, sessionCount 2) — price and
// teacher earning are per lesson, so every total multiplies by sessionCount.
// Between two separate sessions of the same teacher or student the
// institution's "Mola" (Ayarlar → Seans, 0–20 min) is kept.

export const LESSON_MINUTES = 40;

/** 1 = tek ders, 2 = blok ders. */
export const LESSON_COUNT_OPTIONS = [1, 2] as const;
export type LessonCount = (typeof LESSON_COUNT_OPTIONS)[number];

export const BREAK_MINUTE_OPTIONS = [0, 5, 10, 15, 20] as const;

/** Session length for a number of back-to-back lessons. */
export function lessonDuration(lessonCount: number): number {
  return LESSON_MINUTES * lessonCount;
}

export function lessonCountLabel(lessonCount: number): string {
  return lessonCount >= 2
    ? `Blok ders (${lessonCount} × ${LESSON_MINUTES} = ${lessonDuration(lessonCount)} dk)`
    : `Tek ders (${LESSON_MINUTES} dk)`;
}

/** Any saved break value → the nearest allowed choice (0–20, step 5). */
export function normalizeBreakMinutes(value: number): number {
  if (!Number.isFinite(value)) return 10;
  const clamped = Math.min(20, Math.max(0, value));
  return Math.round(clamped / 5) * 5;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** "YYYY-MM-DD" of a Date in local time. */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export function getHoliday(dateKey: string, calendar: CalendarSettings) {
  return calendar.holidays.find((h) => h.date === dateKey) ?? null;
}

export function isWorkingDay(date: Date, calendar: CalendarSettings): boolean {
  return calendar.workingDays.includes(date.getDay());
}

/**
 * Human-readable reasons a session at `start` (lasting `durationMinutes`) falls
 * outside the institution's calendar: a holiday, a non-working day, outside
 * working hours, or across the lunch break. Empty when everything fits.
 */
export function getScheduleIssues(start: Date, durationMinutes: number, calendar: CalendarSettings): string[] {
  const issues: string[] = [];
  const holiday = getHoliday(toLocalDateKey(start), calendar);
  if (holiday) issues.push(`Bu tarih resmi tatil olarak tanımlı: ${holiday.label}.`);
  if (!isWorkingDay(start, calendar)) issues.push(`${DAY_NAMES[start.getDay()]} kurumun çalışma günleri arasında değil.`);

  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = startMin + durationMinutes;
  if (startMin < toMinutes(calendar.dayStartTime) || endMin > toMinutes(calendar.dayEndTime)) {
    issues.push(`Seans, çalışma saatlerinin (${calendar.dayStartTime}–${calendar.dayEndTime}) dışına taşıyor.`);
  }
  if (calendar.lunchBreakStart && calendar.lunchBreakEnd) {
    const lunchStart = toMinutes(calendar.lunchBreakStart);
    const lunchEnd = toMinutes(calendar.lunchBreakEnd);
    if (startMin < lunchEnd && lunchStart < endMin) {
      issues.push(`Seans öğle arasıyla (${calendar.lunchBreakStart}–${calendar.lunchBreakEnd}) çakışıyor.`);
    }
  }
  return issues;
}

/**
 * "HH:MM" where the next session can start on `dateKey`: the end of the last
 * session (of this teacher or this student) that day plus the break. Null
 * when neither has a session that day. Only slot-holding sessions count
 * (CONFLICT_BLOCKING_STATUSES); `excludeSessionId` keeps a session being edited out of its own way.
 */
export function getNextStartAfterBreak(params: {
  sessions: Session[];
  dateKey: string;
  teacherId?: string;
  studentId?: string;
  breakMinutes: number;
  excludeSessionId?: string;
}): string | null {
  const { sessions, dateKey, teacherId, studentId, breakMinutes, excludeSessionId } = params;
  let lastEnd: number | null = null;
  for (const s of sessions) {
    if (s.id === excludeSessionId) continue;
    if (!CONFLICT_BLOCKING_STATUSES.includes(s.status)) continue;
    if (!((teacherId && s.teacherId === teacherId) || (studentId && s.studentId === studentId))) continue;
    const start = new Date(s.date);
    if (toLocalDateKey(start) !== dateKey) continue;
    const end = start.getHours() * 60 + start.getMinutes() + (s.durationMinutes || LESSON_MINUTES);
    if (lastEnd === null || end > lastEnd) lastEnd = end;
  }
  if (lastEnd === null) return null;
  const next = lastEnd + breakMinutes;
  if (next >= 24 * 60) return null;
  return `${pad(Math.floor(next / 60))}:${pad(next % 60)}`;
}

/**
 * True when cancelling a session that starts at `start` now would break the
 * minimum notice rule (Ayarlar → Seans → İptal İçin Minimum Bildirim). Only
 * upcoming sessions count — recording an already-past cancellation is data
 * entry, not a late cancellation. 0 hours disables the rule.
 */
export function isLateCancellation(start: Date, sessions: SessionSettings, now: Date = new Date()): boolean {
  if (sessions.cancellationMinNoticeHours <= 0) return false;
  const msUntilStart = start.getTime() - now.getTime();
  return msUntilStart > 0 && msUntilStart < sessions.cancellationMinNoticeHours * 3_600_000;
}

/** The conflict options interactive forms derive from Ayarlar → Seans. */
export function getConflictOptions(
  settings: InstitutionSettings
): Pick<CheckSessionConflictParams, "preventStudentConflict" | "preventTeacherConflict" | "blockPartialOverlap" | "breakMinutes"> {
  const s = settings.sessions;
  return {
    preventStudentConflict: s.preventStudentConflict,
    preventTeacherConflict: s.preventTeacherConflict,
    blockPartialOverlap: s.conflictBehavior === "block_full_and_partial",
    breakMinutes: s.breakMinutes,
  };
}

/**
 * Splits generated plan dates into the ones to create and the ones skipped
 * because they fall on a holiday (Ayarlar → Takvim → Resmi Tatiller).
 */
export function partitionDatesByHoliday(
  dates: string[],
  calendar: CalendarSettings
): { datesToKeep: string[]; holidaySkips: { date: string; label: string }[] } {
  const datesToKeep: string[] = [];
  const holidaySkips: { date: string; label: string }[] = [];
  for (const date of dates) {
    const holiday = getHoliday(toLocalDateKey(new Date(date)), calendar);
    if (holiday) holidaySkips.push({ date, label: holiday.label });
    else datesToKeep.push(date);
  }
  return { datesToKeep, holidaySkips };
}

/** Calendar notes for recurring weekly slots (non-working day, outside hours,
 *  lunch break) — one line per slot with a problem. Holidays are handled per
 *  date by partitionDatesByHoliday instead. */
export function getWeeklySlotIssues(
  slots: { dayOfWeek: number; time: string }[],
  durationMinutes: number,
  calendar: CalendarSettings
): string[] {
  const noHolidays = { ...calendar, holidays: [] };
  const issues: string[] = [];
  for (const slot of slots) {
    if (!slot.time) continue;
    const [h, m] = slot.time.split(":").map(Number);
    // 2026-01-04 is a Sunday, so +dayOfWeek lands on the right weekday.
    const sample = new Date(2026, 0, 4 + slot.dayOfWeek, h ?? 0, m ?? 0);
    for (const issue of getScheduleIssues(sample, durationMinutes, noHolidays)) {
      issues.push(`${DAY_NAMES[slot.dayOfWeek]} ${slot.time}: ${issue}`);
    }
  }
  return issues;
}
