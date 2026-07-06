// ─── Reports module: filter model + generic entity filtering ──────────────────
// This is the composition layer on top of finance.ts/cash.ts's proven calculations.
// It never re-implements a calculation — every report builds its rows/summary by
// filtering the raw entity arrays here, then handing them to the existing
// build*/calculate*/get* helpers in finance.ts and cash.ts.

import type { Session, Payment, TeacherPayment, CashMovement } from "@/types";
import { parseDateOnly, parseDateOnlyEndOfDay, formatDateOnly } from "@/lib/helpers/finance";

export interface ReportFilters {
  /** "YYYY-M" from getMonthKey(), or null. Ignored when startDate/endDate is set. */
  monthKey: string | null;
  /** Custom range, "YYYY-MM-DD". Takes precedence over monthKey when set. */
  startDate: string | null;
  endDate: string | null;
  teacherId: string | null;
  studentId: string | null;
  educationTypeId: string | null;
}

export const EMPTY_REPORT_FILTERS: ReportFilters = {
  monthKey: null,
  startDate: null,
  endDate: null,
  teacherId: null,
  studentId: null,
  educationTypeId: null,
};

export function isReportFiltersEmpty(filters: ReportFilters): boolean {
  return (
    !filters.monthKey &&
    !filters.startDate &&
    !filters.endDate &&
    !filters.teacherId &&
    !filters.studentId &&
    !filters.educationTypeId
  );
}

/** Resolves the effective [start, end] date bounds from monthKey/startDate/endDate. */
export function resolveReportDateRange(
  filters: ReportFilters
): { start: string | null; end: string | null } {
  if (filters.startDate || filters.endDate) {
    return { start: filters.startDate, end: filters.endDate };
  }
  if (filters.monthKey) {
    const [y, m] = filters.monthKey.split("-").map(Number) as [number, number];
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0); // last day of month
    // formatDateOnly (never toISOString) — toISOString converts to UTC first, which
    // silently shifts the date back a day for any timezone ahead of UTC (e.g. Turkey, UTC+3).
    return {
      start: formatDateOnly(start),
      end: formatDateOnly(end),
    };
  }
  return { start: null, end: null };
}

/** Parses either a full ISO datetime (Session.date) or a date-only "YYYY-MM-DD" string
 *  (Payment/TeacherPayment/CashMovement.date) as a local Date, never UTC-shifted. */
function parseEntityDate(dateStr: string): Date {
  return dateStr.includes("T") ? new Date(dateStr) : parseDateOnly(dateStr);
}

/** Generic date-range check for any already-built row that has a `.date` field
 *  (CashMovementRow, TeacherPaymentReportRow, SessionListItem, …). */
export function isWithinReportRange(dateStr: string, filters: ReportFilters): boolean {
  const { start, end } = resolveReportDateRange(filters);
  return isDateWithinRange(dateStr, start, end);
}

function isDateWithinRange(dateStr: string, start: string | null, end: string | null): boolean {
  const d = parseEntityDate(dateStr);
  if (start && d < parseDateOnly(start)) return false;
  if (end && d > parseDateOnlyEndOfDay(end)) return false;
  return true;
}

export function filterSessionsByReportFilters(
  sessions: Session[],
  filters: ReportFilters
): Session[] {
  const { start, end } = resolveReportDateRange(filters);
  return sessions.filter((s) => {
    if (!isDateWithinRange(s.date, start, end)) return false;
    if (filters.teacherId && s.teacherId !== filters.teacherId) return false;
    if (filters.studentId && s.studentId !== filters.studentId) return false;
    if (filters.educationTypeId && s.educationTypeId !== filters.educationTypeId) return false;
    return true;
  });
}

export function filterPaymentsByReportFilters(
  payments: Payment[],
  filters: ReportFilters
): Payment[] {
  const { start, end } = resolveReportDateRange(filters);
  return payments.filter((p) => {
    if (!isDateWithinRange(p.date, start, end)) return false;
    if (filters.studentId && p.studentId !== filters.studentId) return false;
    return true;
  });
}

export function filterTeacherPaymentsByReportFilters(
  teacherPayments: TeacherPayment[],
  filters: ReportFilters
): TeacherPayment[] {
  const { start, end } = resolveReportDateRange(filters);
  return teacherPayments.filter((p) => {
    if (!isDateWithinRange(p.date, start, end)) return false;
    if (filters.teacherId && p.teacherId !== filters.teacherId) return false;
    return true;
  });
}

export function filterCashMovementsByReportFilters(
  movements: CashMovement[],
  filters: ReportFilters
): CashMovement[] {
  const { start, end } = resolveReportDateRange(filters);
  return movements.filter((m) => isDateWithinRange(m.date, start, end));
}

// ─── Report catalog (nav metadata only — no data/calculation here) ────────────

export type ReportCategory = "financial" | "education" | "students" | "teachers";

export interface ReportCatalogEntry {
  id: string;
  label: string;
}

export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  financial: "Finansal",
  education: "Eğitim",
  students: "Öğrenciler",
  teachers: "Öğretmenler",
};

export const REPORT_CATALOG: Record<ReportCategory, ReportCatalogEntry[]> = {
  financial: [
    { id: "income", label: "Gelir Raporu" },
    { id: "teacher-payments", label: "Öğretmen Ödeme Raporu" },
    { id: "daily-cash", label: "Günlük Kasa Raporu" },
  ],
  education: [{ id: "session-status", label: "Seans Durum Raporu" }],
  students: [
    { id: "student-debt", label: "Öğrenci Borç Raporu" },
    { id: "student-payments", label: "Öğrenci Ödeme Raporu" },
    { id: "attendance", label: "Devam Özeti" },
  ],
  teachers: [
    { id: "teacher-earnings", label: "Öğretmen Hakedişleri" },
    { id: "teacher-payments", label: "Öğretmen Ödemeleri" },
    { id: "teacher-session-counts", label: "Öğretmen Seans Sayıları" },
    { id: "teacher-performance", label: "Öğretmen Performansı" },
  ],
};
