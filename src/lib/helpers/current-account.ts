import type { Session, Payment, StudentCurrentAccount } from "@/types";

// Must match BILLABLE_STATUSES in finance.ts
const BILLABLE: Session["status"][] = ["completed", "no_show", "makeup"];

// ─── Date helpers ──────────────────────────────────────────────────────────────

function yearMonth(dateStr: string): { y: number; m: number } {
  const d = new Date(dateStr);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function isBeforeMonth(dateStr: string, year: number, month: number): boolean {
  const { y, m } = yearMonth(dateStr);
  return y < year || (y === year && m < month);
}

function isInMonth(dateStr: string, year: number, month: number): boolean {
  const { y, m } = yearMonth(dateStr);
  return y === year && m === month;
}

// ─── Core helpers ──────────────────────────────────────────────────────────────

/** Total billed – total paid for a student in all months before `year/month`. */
export function getPreviousBalance(
  studentId: string,
  sessions: Session[],
  payments: Payment[],
  year: number,
  month: number
): number {
  const prevBilled = sessions
    .filter(
      (s) =>
        s.studentId === studentId &&
        BILLABLE.includes(s.status) &&
        isBeforeMonth(s.date, year, month)
    )
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);

  const prevPaid = payments
    .filter((p) => p.studentId === studentId && isBeforeMonth(p.date, year, month))
    .reduce((sum, p) => sum + p.amount, 0);

  return prevBilled - prevPaid;
}

/** Session billing total for a student in `year/month`. */
export function getCurrentMonthBilled(
  studentId: string,
  sessions: Session[],
  year: number,
  month: number
): number {
  return sessions
    .filter(
      (s) =>
        s.studentId === studentId &&
        BILLABLE.includes(s.status) &&
        isInMonth(s.date, year, month)
    )
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);
}

/** Payment total received from a student in `year/month`. */
export function getCurrentMonthPaid(
  studentId: string,
  payments: Payment[],
  year: number,
  month: number
): number {
  return payments
    .filter((p) => p.studentId === studentId && isInMonth(p.date, year, month))
    .reduce((sum, p) => sum + p.amount, 0);
}

// ─── Full current account ──────────────────────────────────────────────────────

export function buildStudentCurrentAccount(
  studentId: string,
  sessions: Session[],
  payments: Payment[],
  year: number,
  month: number
): StudentCurrentAccount {
  const previousBalance = getPreviousBalance(studentId, sessions, payments, year, month);
  const currentMonthBilled = getCurrentMonthBilled(studentId, sessions, year, month);
  const currentMonthPaid = getCurrentMonthPaid(studentId, payments, year, month);
  const currentBalance = previousBalance + currentMonthBilled - currentMonthPaid;

  const totalBilled = sessions
    .filter((s) => s.studentId === studentId && BILLABLE.includes(s.status))
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);

  const totalPaid = payments
    .filter((p) => p.studentId === studentId)
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    year,
    month,
    previousBalance,
    currentMonthBilled,
    currentMonthPaid,
    currentBalance,
    totalBilled,
    totalPaid,
    remainingDebt: Math.max(0, totalBilled - totalPaid),
  };
}

// ─── Guardian aggregate ────────────────────────────────────────────────────────

export function buildGuardianCurrentAccountSummary(
  guardianStudentIds: string[],
  sessions: Session[],
  payments: Payment[],
  year: number,
  month: number
): {
  previousBalance: number;
  currentMonthBilled: number;
  currentMonthPaid: number;
  currentBalance: number;
  totalDebt: number;
} {
  let previousBalance = 0;
  let currentMonthBilled = 0;
  let currentMonthPaid = 0;
  let totalBilled = 0;
  let totalPaid = 0;

  for (const id of guardianStudentIds) {
    previousBalance += getPreviousBalance(id, sessions, payments, year, month);
    currentMonthBilled += getCurrentMonthBilled(id, sessions, year, month);
    currentMonthPaid += getCurrentMonthPaid(id, payments, year, month);
    totalBilled += sessions
      .filter((s) => s.studentId === id && BILLABLE.includes(s.status))
      .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);
    totalPaid += payments
      .filter((p) => p.studentId === id)
      .reduce((sum, p) => sum + p.amount, 0);
  }

  return {
    previousBalance,
    currentMonthBilled,
    currentMonthPaid,
    currentBalance: previousBalance + currentMonthBilled - currentMonthPaid,
    totalDebt: Math.max(0, totalBilled - totalPaid),
  };
}
