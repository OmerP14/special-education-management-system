import type {
  Session,
  Payment,
  Student,
  Guardian,
  StudentCurrentAccount,
  StudentMonthlyAccountRow,
  OpeningBalance,
} from "@/types";
import { getStudentLastActivityDate, getStudentDebtActivityDate, getOpeningBalanceNet, isBillableSession } from "./finance";

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

/** Total billed – total paid for a student in all months before `year/month`,
 *  plus any migrated opening balance dated before `year/month` (Devir Bakiyesi —
 *  never counted as billed/paid, only as a carried-in net balance). */
export function getPreviousBalance(
  studentId: string,
  sessions: Session[],
  payments: Payment[],
  year: number,
  month: number,
  openingBalances: OpeningBalance[] = []
): number {
  const prevBilled = sessions
    .filter(
      (s) =>
        s.studentId === studentId &&
        isBillableSession(s) &&
        isBeforeMonth(s.date, year, month)
    )
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);

  const prevPaid = payments
    .filter((p) => p.studentId === studentId && isBeforeMonth(p.date, year, month))
    .reduce((sum, p) => sum + p.amount, 0);

  const prevOpeningBalance = getOpeningBalanceNet(
    studentId,
    openingBalances.filter((b) => isBeforeMonth(b.date, year, month))
  );

  return prevBilled - prevPaid + prevOpeningBalance;
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
        isBillableSession(s) &&
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
  month: number,
  openingBalances: OpeningBalance[] = []
): StudentCurrentAccount {
  const previousBalance = getPreviousBalance(studentId, sessions, payments, year, month, openingBalances);
  const currentMonthBilled = getCurrentMonthBilled(studentId, sessions, year, month);
  const currentMonthPaid = getCurrentMonthPaid(studentId, payments, year, month);
  const currentBalance = previousBalance + currentMonthBilled - currentMonthPaid;

  const totalBilled = sessions
    .filter((s) => s.studentId === studentId && isBillableSession(s))
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
    remainingDebt: Math.max(0, totalBilled - totalPaid + getOpeningBalanceNet(studentId, openingBalances)),
  };
}

// ─── Report row builder ────────────────────────────────────────────────────────

/**
 * Month-scoped account rows for every student with activity relevant to `year/month`
 * — the same Önceki Devir / Bu Ay Tahakkuk / Bu Ay Tahsilat / Güncel Bakiye split
 * Student Detail already shows, reused here (via buildStudentCurrentAccount) so Reports
 * never re-derives the carryover math. A student is included if they carry a balance
 * into the month, or have billing/collection activity within it.
 */
export function buildStudentMonthlyAccountRows(
  students: Student[],
  guardians: Guardian[],
  sessions: Session[],
  payments: Payment[],
  year: number,
  month: number,
  openingBalances: OpeningBalance[] = []
): StudentMonthlyAccountRow[] {
  return students
    .map((student) => {
      const guardian = guardians.find((g) => student.guardianIds.includes(g.id)) ?? null;
      const account = buildStudentCurrentAccount(student.id, sessions, payments, year, month, openingBalances);
      return {
        studentId: student.id,
        studentName: student.fullName,
        guardianId: guardian?.id ?? null,
        guardianName: guardian?.fullName ?? null,
        previousBalance: account.previousBalance,
        currentMonthBilled: account.currentMonthBilled,
        currentMonthPaid: account.currentMonthPaid,
        // A receivables report shows "how much is owed", never a negative number —
        // an advance/overpayment is a credit, not debt, and floors at 0 here. Student/
        // Guardian Detail's own Cari Hesap keeps the signed value (with an explicit
        // "Alacak devri" label) since that view is a full running statement, not a
        // debt report; this wrapper is the only place the two diverge on purpose.
        currentBalance: Math.max(0, account.currentBalance),
        lastActivityDate: getStudentLastActivityDate(student.id, sessions, payments),
        lastDebtActivityDate: getStudentDebtActivityDate(student.id, sessions, payments),
      } satisfies StudentMonthlyAccountRow;
    })
    .filter(
      (row) => row.previousBalance !== 0 || row.currentMonthBilled > 0 || row.currentMonthPaid > 0
    )
    .sort((a, b) => b.currentBalance - a.currentBalance);
}

// ─── Guardian aggregate ────────────────────────────────────────────────────────

export function buildGuardianCurrentAccountSummary(
  guardianStudentIds: string[],
  sessions: Session[],
  payments: Payment[],
  year: number,
  month: number,
  openingBalances: OpeningBalance[] = []
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
  let openingBalanceNet = 0;

  for (const id of guardianStudentIds) {
    previousBalance += getPreviousBalance(id, sessions, payments, year, month, openingBalances);
    currentMonthBilled += getCurrentMonthBilled(id, sessions, year, month);
    currentMonthPaid += getCurrentMonthPaid(id, payments, year, month);
    totalBilled += sessions
      .filter((s) => s.studentId === id && isBillableSession(s))
      .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);
    totalPaid += payments
      .filter((p) => p.studentId === id)
      .reduce((sum, p) => sum + p.amount, 0);
    openingBalanceNet += getOpeningBalanceNet(id, openingBalances);
  }

  return {
    previousBalance,
    currentMonthBilled,
    currentMonthPaid,
    currentBalance: previousBalance + currentMonthBilled - currentMonthPaid,
    totalDebt: Math.max(0, totalBilled - totalPaid + openingBalanceNet),
  };
}

// ─── Monthly movements ─────────────────────────────────────────────────────────

export type MovementType = "session" | "payment" | "installment_payment";

export interface CurrentAccountMovement {
  id: string;
  date: string;
  type: MovementType;
  description: string;
  /** Positive = debit (billed). Negative = credit (payment). */
  amount: number;
  studentName?: string;
}

/**
 * Returns individual debit/credit movements for a guardian's students in
 * the given year/month, sorted newest-first.
 */
export function buildGuardianCurrentAccountMovements(
  guardianStudentIds: string[],
  students: { id: string; fullName: string }[],
  sessions: Session[],
  payments: Payment[],
  year: number,
  month: number
): CurrentAccountMovement[] {
  const movements: CurrentAccountMovement[] = [];

  for (const studentId of guardianStudentIds) {
    const studentName =
      students.find((s) => s.id === studentId)?.fullName ?? undefined;

    // Billable sessions this month → debit
    sessions
      .filter(
        (s) =>
          s.studentId === studentId &&
          isBillableSession(s) &&
          isInMonth(s.date, year, month)
      )
      .forEach((s) => {
        movements.push({
          id: `session-${s.id}`,
          date: s.date,
          type: "session",
          description: "Seans tahakkuku",
          amount: s.studentPrice * s.sessionCount,
          studentName,
        });
      });

    // Payments this month → credit
    payments
      .filter((p) => p.studentId === studentId && isInMonth(p.date, year, month))
      .forEach((p) => {
        const isInstallment = p.paymentSource === "installment";
        movements.push({
          id: `payment-${p.id}`,
          date: p.date,
          type: isInstallment ? "installment_payment" : "payment",
          description: isInstallment ? "Taksit ödemesi" : "Ödeme",
          amount: -p.amount,
          studentName,
        });
      });
  }

  return movements.sort((a, b) => b.date.localeCompare(a.date));
}
