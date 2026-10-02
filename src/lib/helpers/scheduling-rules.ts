import type { EducationType } from "@/types";
import type { CalendarSettings, InstitutionSettings, SessionSettings } from "@/types/settings";
import type { CheckSessionConflictParams } from "@/lib/helpers/session-conflict";

// ─── Institution scheduling rules (Ayarlar → Seans / Takvim) ─────────────────
// Pure helpers shared by the session form, weekly plans and plan extension, so
// working days, holidays, hours and duration limits are judged the same way
// everywhere a session can be created.

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

/** Error text when a duration is outside Ayarlar → Seans min/max, else null. */
export function getDurationError(durationMinutes: number, sessions: SessionSettings): string | null {
  if (durationMinutes < sessions.minDurationMinutes) {
    return `Seans süresi en az ${sessions.minDurationMinutes} dakika olmalıdır.`;
  }
  if (durationMinutes > sessions.maxDurationMinutes) {
    return `Seans süresi en fazla ${sessions.maxDurationMinutes} dakika olabilir.`;
  }
  return null;
}

/** Duration a new session/plan starts with: the education type's own default
 *  when it has one, otherwise Ayarlar → Seans → Varsayılan Süre. */
export function getDefaultSessionDuration(
  educationTypeId: string | undefined,
  educationTypes: EducationType[],
  sessions: SessionSettings
): number {
  const fromType = educationTypes.find((et) => et.id === educationTypeId)?.defaultDurationMinutes;
  return fromType && fromType > 0 ? fromType : sessions.defaultDurationMinutes;
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
): Pick<CheckSessionConflictParams, "preventStudentConflict" | "preventTeacherConflict" | "blockPartialOverlap" | "teacherBreakMinutes"> {
  const s = settings.sessions;
  return {
    preventStudentConflict: s.preventStudentConflict,
    preventTeacherConflict: s.preventTeacherConflict,
    blockPartialOverlap: s.conflictBehavior === "block_full_and_partial",
    teacherBreakMinutes: s.defaultBreakMinutes,
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
