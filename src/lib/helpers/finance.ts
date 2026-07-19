import type {
  Session,
  SessionStatus,
  Payment,
  TeacherEarning,
  TeacherPayment,
  TeacherPaymentType,
  TeacherCustomPrice,
  DashboardStats,
  StudentSummary,
  StudentListItem,
  StudentDetail,
  TeacherSummary,
  TeacherListItem,
  TeacherDetail,
  TeacherStudentRow,
  TeacherPriceRow,
  SessionListItem,
  SessionPageStats,
  PaymentListItem,
  StudentDebtItem,
  PaymentPageStats,
  DebtStatus,
  PaymentMethod,
  TeacherEarningListItem,
  TeacherEarningOverviewItem,
  TeacherEarningPageStats,
  MonthlyTeacherEarningSummary,
  TeacherReportRow,
  TeacherPaymentReportRow,
  TeacherMonthAccountSummary,
  SessionStatusBreakdown,
  StudentAttendanceRow,
  TeacherSessionCountRow,
  GuardianListItem,
  GuardianDetail,
  Student,
  Guardian,
  Teacher,
  EducationType,
  PlannedSessionsSummary,
  StudentStatus,
  TeacherStatus,
  OpeningBalance,
  TeacherEarningCalculationStatus,
} from "@/types";
import { normalizeName } from "./import-match";

const BILLABLE_STATUSES: Session["status"][] = ["completed", "no_show", "makeup"];
export const EARNING_STATUSES: Session["status"][] = ["completed", "makeup"];

/** The single source of truth for "does this session count toward student/
 *  guardian debt, tahakkuk, or receivables". A session must both be in a
 *  billable STATUS (completed/no_show/makeup) and NOT be flagged
 *  billingMode: "historical_non_billable" — a historical migration import the
 *  user explicitly chose to bring in as pure session history, never billed.
 *  `billingMode` undefined (every manually-created/pre-existing session) is
 *  always billable, so this changes nothing for normal session behavior.
 *  Teacher earning/hakediş calculations intentionally do NOT use this — see
 *  EARNING_STATUSES — historical-non-billable is a student-billing concept only. */
export function isBillableSession(session: Session): boolean {
  return BILLABLE_STATUSES.includes(session.status) && session.billingMode !== "historical_non_billable";
}

/** True when a student's session history exists but is entirely
 *  historical_non_billable — the "no debt yet has session history" case a plain
 *  zero-activity check can't distinguish from "no history at all". Used to
 *  decide whether to show the "Geçmiş ders kayıtları borca dahil değil"
 *  explanation alongside an otherwise all-₺0 account. */
export function hasOnlyHistoricalNonBillableSessions(studentId: string, sessions: Session[]): boolean {
  const studentSessions = sessions.filter((s) => s.studentId === studentId);
  return studentSessions.length > 0 && studentSessions.every((s) => s.billingMode === "historical_non_billable");
}

/** Signed net of a student's opening balances (debt = +amount, credit = -amount).
 *  Never counted as Tahakkuk/Tahsilat — only folded into the net debt/balance figure. */
export function getOpeningBalanceNet(studentId: string, openingBalances: OpeningBalance[]): number {
  return openingBalances
    .filter((b) => b.studentId === studentId)
    .reduce((sum, b) => sum + (b.balanceType === "debt" ? b.amount : -b.amount), 0);
}

/** Signed all-time balance — billed minus paid, plus opening-balance net — never
 *  floored at 0. Positive = student owes; negative = student has overpaid/holds a
 *  credit. `getStudentDebt` (the canonical "how much is owed" figure used
 *  everywhere) is a thin floor over this; UI that needs to distinguish debt from
 *  credit/overpayment (never showing an ambiguous unlabeled "X / Y") should read
 *  this instead of re-deriving billed-minus-paid itself. */
export function getStudentNetBalance(
  studentId: string,
  sessions: Session[],
  payments: Payment[],
  openingBalances: OpeningBalance[] = []
): number {
  const charged = sessions
    .filter((s) => s.studentId === studentId && isBillableSession(s))
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);

  const paid = payments
    .filter((p) => p.studentId === studentId)
    .reduce((sum, p) => sum + p.amount, 0);

  return charged - paid + getOpeningBalanceNet(studentId, openingBalances);
}

export function getStudentDebt(
  studentId: string,
  sessions: Session[],
  payments: Payment[],
  openingBalances: OpeningBalance[] = []
): number {
  return Math.max(0, getStudentNetBalance(studentId, sessions, payments, openingBalances));
}

export function getStudentTotalPaid(studentId: string, payments: Payment[]): number {
  return payments
    .filter((p) => p.studentId === studentId)
    .reduce((sum, p) => sum + p.amount, 0);
}

export function getStudentCompletedSessions(studentId: string, sessions: Session[]): number {
  return sessions.filter(
    (s) => s.studentId === studentId && s.status === "completed"
  ).length;
}

export function getTeacherTotalEarnings(
  teacher: Teacher,
  sessions: Session[],
  teacherPayments: TeacherPayment[]
): number {
  return getTeacherEarningTotals(teacher, sessions, teacherPayments).totalEarning;
}

export function getTeacherPendingEarnings(
  teacher: Teacher,
  sessions: Session[],
  teacherPayments: TeacherPayment[]
): number {
  return getTeacherEarningTotals(teacher, sessions, teacherPayments).pendingEarning;
}

export function getTeacherCompletedSessions(teacherId: string, sessions: Session[]): number {
  return sessions.filter(
    (s) => s.teacherId === teacherId && EARNING_STATUSES.includes(s.status)
  ).length;
}

export function getMonthlyRevenue(sessions: Session[], year: number, month: number): number {
  return sessions
    .filter((s) => {
      const d = new Date(s.date);
      return (
        d.getFullYear() === year &&
        d.getMonth() + 1 === month &&
        isBillableSession(s)
      );
    })
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);
}

export function getMonthlySessionCount(sessions: Session[], year: number, month: number): number {
  return sessions.filter((s) => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  }).length;
}

/** Tahsilat — actual guardian payments received in a given month, across all students.
 *  Never derived from billing; a payment-only month with zero sessions still counts here. */
export function getMonthlyCollected(payments: Payment[], year: number, month: number): number {
  return payments
    .filter((p) => {
      const d = new Date(p.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .reduce((sum, p) => sum + p.amount, 0);
}

export function buildDashboardStats(
  sessions: Session[],
  payments: Payment[],
  teacherPayments: TeacherPayment[],
  students: Student[],
  teachers: Teacher[],
  openingBalances: OpeningBalance[] = [],
  teacherCustomPrices: TeacherCustomPrice[] = []
): DashboardStats {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const activeStudents = students.filter((s) => s.status === "active").length;
  const activeTeachers = teachers.filter((t) => t.status === "active").length;

  const totalDebt = students.reduce(
    (sum, s) => sum + getStudentDebt(s.id, sessions, payments, openingBalances),
    0
  );

  // Teacher earnings are owed the moment a session is completed/salary is entitled —
  // never derived from whether the student/parent has paid. "Paid" comes from actual
  // TeacherPayment records, never from the TeacherEarning ledger.
  const teacherTotals = teachers.map((t) => getTeacherEarningTotals(t, sessions, teacherPayments, teacherCustomPrices));
  const pendingEarnings = teacherTotals.reduce((sum, t) => sum + t.pendingEarning, 0);
  const unknownEarningSessionCount = teacherTotals.reduce((sum, t) => sum + t.unknownSessionCount, 0);

  return {
    activeStudents,
    activeTeachers,
    sessionsThisMonth: getMonthlySessionCount(sessions, year, month),
    revenueThisMonth: getMonthlyRevenue(sessions, year, month),
    collectedThisMonth: getMonthlyCollected(payments, year, month),
    pendingPayments: totalDebt,
    unknownEarningSessionCount,
    pendingEarnings,
  };
}

export function buildStudentSummaries(
  sessions: Session[],
  payments: Payment[],
  students: Student[],
  openingBalances: OpeningBalance[] = []
): StudentSummary[] {
  return students.map((student) => ({
    ...student,
    totalDebt: getStudentDebt(student.id, sessions, payments, openingBalances),
    totalPaid: getStudentTotalPaid(student.id, payments),
    completedSessions: getStudentCompletedSessions(student.id, sessions),
  }));
}

export function buildTeacherSummaries(
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  teachers: Teacher[]
): TeacherSummary[] {
  return teachers.map((teacher) => ({
    ...teacher,
    totalEarnings: getTeacherTotalEarnings(teacher, sessions, teacherPayments),
    pendingEarnings: getTeacherPendingEarnings(teacher, sessions, teacherPayments),
    completedSessions: getTeacherCompletedSessions(teacher.id, sessions),
  }));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Imported/hand-entered data can carry a malformed or empty date string (a bad
 *  Excel cell, an emptied optional field, …) — every date formatter below MUST
 *  degrade to a visible placeholder instead of throwing `RangeError: Invalid time
 *  value`, since a single bad record must never crash Student/Guardian detail,
 *  Sessions, Reports, or the Dashboard. */
function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

/** "-" for a genuinely blank/never-entered value (not an error); the more explicit
 *  "Geçersiz Tarih" only when there WAS a value and it failed to parse — so a student
 *  with no birth date on file doesn't read as "corrupted" next to one that actually is. */
function invalidDateFallback(raw: string): string {
  return raw.trim() === "" ? "-" : "Geçersiz Tarih";
}

export function formatDate(dateStr: string | null | undefined): string {
  const raw = dateStr ?? "";
  const d = new Date(raw);
  if (!isValidDate(d)) return invalidDateFallback(raw);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(dateStr: string | null | undefined): string {
  const raw = dateStr ?? "";
  const d = new Date(raw);
  if (!isValidDate(d)) return invalidDateFallback(raw);
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatTime(dateStr: string | null | undefined): string {
  const d = new Date(dateStr ?? "");
  if (!isValidDate(d)) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** "06.07.2026" — day.month.year, for report "Tarih" columns. Handles both full ISO
 *  datetime strings (Session.date) and date-only "YYYY-MM-DD" strings (Payment.date)
 *  safely, same as parseDateOnly, so the displayed day never shifts by timezone. */
export function formatDateDMY(dateStr: string | null | undefined): string {
  const raw = dateStr ?? "";
  const d = raw.includes("T") ? new Date(raw) : parseDateOnly(raw);
  if (!isValidDate(d)) return invalidDateFallback(raw);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

// ─── Student-specific helpers ──────────────────────────────────────────────────

export function getStudentTotalBilled(studentId: string, sessions: Session[]): number {
  return sessions
    .filter((s) => s.studentId === studentId && isBillableSession(s))
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);
}

/**
 * Most relevant financial activity date for a student — the latest payment date if
 * any payment exists, otherwise the latest billed/completed session date. Purely for
 * report readability (a "when did something last happen here" column); never fed into
 * any accrual/collection/debt calculation.
 */
export function getStudentLastActivityDate(
  studentId: string,
  sessions: Session[],
  payments: Payment[]
): string | null {
  const studentPayments = payments.filter((p) => p.studentId === studentId);
  if (studentPayments.length > 0) {
    return studentPayments.reduce((latest, p) => (p.date > latest ? p.date : latest), studentPayments[0]!.date);
  }
  const billableSessions = sessions.filter(
    (s) => s.studentId === studentId && isBillableSession(s)
  );
  if (billableSessions.length === 0) return null;
  return billableSessions.reduce((latest, s) => (s.date > latest ? s.date : latest), billableSessions[0]!.date);
}

/**
 * Debt-report activity date — the reverse priority of getStudentLastActivityDate: leads
 * with "when was the service delivered" (latest billed session date), falling back to the
 * latest payment date only when no billed session exists yet (e.g. an advance payment).
 * Purely for report readability, never fed into any debt calculation.
 */
export function getStudentDebtActivityDate(
  studentId: string,
  sessions: Session[],
  payments: Payment[]
): string | null {
  const billableSessions = sessions.filter(
    (s) => s.studentId === studentId && isBillableSession(s)
  );
  if (billableSessions.length > 0) {
    return billableSessions.reduce((latest, s) => (s.date > latest ? s.date : latest), billableSessions[0]!.date);
  }
  const studentPayments = payments.filter((p) => p.studentId === studentId);
  if (studentPayments.length === 0) return null;
  return studentPayments.reduce((latest, p) => (p.date > latest ? p.date : latest), studentPayments[0]!.date);
}

export function getStudentSessionCount(studentId: string, sessions: Session[]): number {
  return sessions.filter((s) => s.studentId === studentId).length;
}

export function getStudentSessions(studentId: string, sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.studentId === studentId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ─── Planned session summaries (informational only — never billed) ────────────
//
// Planned sessions do not create debt, do not affect the current account, and
// do not affect payment totals. These helpers exist purely to surface that
// upcoming/potential value in the UI; they must never feed into
// totalBilled / totalDebt / current-account calculations above.

function summarizePlannedSessions(sessions: Session[]): PlannedSessionsSummary {
  return {
    count: sessions.length,
    totalValue: sessions.reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0),
  };
}

export function getStudentPlannedSummary(
  studentId: string,
  sessions: Session[]
): PlannedSessionsSummary {
  return summarizePlannedSessions(
    sessions.filter((s) => s.studentId === studentId && s.status === "planned")
  );
}

export function getGuardianPlannedSummary(
  studentIds: string[],
  sessions: Session[]
): PlannedSessionsSummary {
  return summarizePlannedSessions(
    sessions.filter((s) => studentIds.includes(s.studentId) && s.status === "planned")
  );
}

export function getStudentPayments(studentId: string, payments: Payment[]): Payment[] {
  return payments
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getStudentGuardians(student: Student, guardians: Guardian[]): Guardian[] {
  return guardians.filter((g) => student.guardianIds.includes(g.id));
}

export function getStudentGuardian(
  studentId: string,
  students: Student[],
  guardians: Guardian[]
): Guardian | null {
  const student = students.find((s) => s.id === studentId);
  if (!student) return null;
  return guardians.find((g) => student.guardianIds.includes(g.id)) ?? null;
}

export function getSessionRelations(
  sessionId: string,
  sessions: Session[],
  students: Student[],
  teachers: Teacher[],
  educationTypes: EducationType[],
  guardians: Guardian[]
): {
  session: Session | null;
  student: Student | null;
  teacher: Teacher | null;
  educationType: EducationType | null;
  guardian: Guardian | null;
} {
  const session = sessions.find((s) => s.id === sessionId) ?? null;
  const student = session ? (students.find((s) => s.id === session.studentId) ?? null) : null;
  const teacher = session ? (teachers.find((t) => t.id === session.teacherId) ?? null) : null;
  const educationType = session
    ? (educationTypes.find((et) => et.id === session.educationTypeId) ?? null)
    : null;
  const guardian = student
    ? (guardians.find((g) => student.guardianIds.includes(g.id)) ?? null)
    : null;
  return { session, student, teacher, educationType, guardian };
}

export function getPaymentRelations(
  paymentId: string,
  payments: Payment[],
  students: Student[],
  guardians: Guardian[]
): {
  payment: Payment | null;
  student: Student | null;
  guardian: Guardian | null;
} {
  const payment = payments.find((p) => p.id === paymentId) ?? null;
  const student = payment ? (students.find((s) => s.id === payment.studentId) ?? null) : null;
  const guardian = student
    ? (guardians.find((g) => student.guardianIds.includes(g.id)) ?? null)
    : null;
  return { payment, student, guardian };
}

export function getEarningRelations(
  earningId: string,
  earnings: TeacherEarning[],
  sessions: Session[],
  teachers: Teacher[],
  students: Student[],
  educationTypes: EducationType[]
): {
  earning: TeacherEarning | null;
  session: Session | null;
  teacher: Teacher | null;
  student: Student | null;
  educationType: EducationType | null;
} {
  const earning = earnings.find((e) => e.id === earningId) ?? null;
  const session = earning ? (sessions.find((s) => s.id === earning.sessionId) ?? null) : null;
  const teacher = earning ? (teachers.find((t) => t.id === earning.teacherId) ?? null) : null;
  const student = session ? (students.find((s) => s.id === session.studentId) ?? null) : null;
  const educationType = session
    ? (educationTypes.find((et) => et.id === session.educationTypeId) ?? null)
    : null;
  return { earning, session, teacher, student, educationType };
}

export function getStudentAssignedTeachers(
  studentId: string,
  sessions: Session[],
  teachers: Teacher[]
): Teacher[] {
  const teacherIds = [...new Set(sessions
    .filter((s) => s.studentId === studentId)
    .map((s) => s.teacherId))];
  return teachers.filter((t) => teacherIds.includes(t.id));
}

export function buildStudentListItems(
  students: Student[],
  guardians: Guardian[],
  educationTypes: EducationType[],
  teachers: Teacher[],
  sessions: Session[],
  payments: Payment[],
  openingBalances: OpeningBalance[] = []
): StudentListItem[] {
  return students.map((student) => {
    const studentGuardians = getStudentGuardians(student, guardians);
    const primaryGuardian = studentGuardians[0] ?? null;
    const educationTypeNames = educationTypes
      .filter((et) => student.educationTypeIds.includes(et.id))
      .map((et) => et.name);
    const assignedTeachers = getStudentAssignedTeachers(student.id, sessions, teachers);

    const totalBilled = getStudentTotalBilled(student.id, sessions);
    const totalPaid = getStudentTotalPaid(student.id, payments);
    const totalDebt = getStudentDebt(student.id, sessions, payments, openingBalances);

    return {
      id: student.id,
      tenantId: student.tenantId,
      fullName: student.fullName,
      birthDate: student.birthDate,
      status: student.status,
      notes: student.notes,
      createdAt: student.createdAt,
      primaryGuardian,
      educationTypeNames,
      assignedTeacherNames: assignedTeachers.map((t) => t.fullName),
      totalSessions: getStudentSessionCount(student.id, sessions),
      totalBilled,
      totalPaid,
      totalDebt,
    };
  });
}

// ─── Teacher-specific helpers ──────────────────────────────────────────────────

export function getTeacherSessions(teacherId: string, sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.teacherId === teacherId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getTeacherEarnings(teacherId: string, earnings: TeacherEarning[]): TeacherEarning[] {
  return earnings
    .filter((e) => e.teacherId === teacherId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getTeacherMonthlyEarnings(
  teacher: Teacher,
  sessions: Session[],
  year: number,
  month: number
): number {
  return calculateTeacherMonthlyPayable(teacher, sessions, year, month);
}

export function getTeacherStudentRows(
  teacherId: string,
  sessions: Session[],
  students: Student[],
  guardians: Guardian[],
  educationTypes: EducationType[]
): TeacherStudentRow[] {
  const teacherSessions = sessions.filter((s) => s.teacherId === teacherId);
  const uniqueStudentIds = [...new Set(teacherSessions.map((s) => s.studentId))];

  return uniqueStudentIds
    .map((studentId) => {
      const student = students.find((s) => s.id === studentId);
      if (!student) return null;

      const studentSessions = teacherSessions.filter((s) => s.studentId === studentId);
      const primaryGuardian =
        guardians.find((g) => student.guardianIds.includes(g.id)) ?? null;
      const uniqueEdTypeIds = [...new Set(studentSessions.map((s) => s.educationTypeId))];
      const edTypeNames = educationTypes
        .filter((et) => uniqueEdTypeIds.includes(et.id))
        .map((et) => et.name);
      const sortedDates = studentSessions
        .map((s) => s.date)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      return {
        studentId: student.id,
        studentName: student.fullName,
        primaryGuardianId: primaryGuardian?.id ?? null,
        primaryGuardianName: primaryGuardian?.fullName ?? null,
        primaryGuardianPhone: primaryGuardian?.phone ?? null,
        educationTypeNames: edTypeNames,
        totalSessions: studentSessions.length,
        lastSessionDate: (sortedDates[0] as string | undefined) ?? null,
      } satisfies TeacherStudentRow;
    })
    .filter((r): r is TeacherStudentRow => r !== null);
}

export function getTeacherPriceRows(
  teacher: Teacher,
  educationTypes: EducationType[],
  customPrices: TeacherCustomPrice[]
): TeacherPriceRow[] {
  // Only return rows for the teacher's declared specializations
  const specializedTypes =
    teacher.specializations.length > 0
      ? educationTypes.filter((et) => teacher.specializations.includes(et.id))
      : educationTypes;
  return specializedTypes.map((et) => {
    const custom = customPrices.find(
      (cp) => cp.teacherId === teacher.id && cp.educationTypeId === et.id
    );
    return {
      educationTypeId: et.id,
      educationTypeName: et.name,
      description: et.description,
      defaultEarning: et.defaultTeacherEarning,
      customEarning: custom?.customEarning ?? null,
      isCustom: !!custom,
    } satisfies TeacherPriceRow;
  });
}

// ─── Likely-duplicate teacher detection (read-only — never merges/deletes) ─────
// Import name resolution matches on normalizeName() alone (see import-match.ts),
// which lowercases and collapses whitespace but does NOT strip an honorific/
// abbreviation suffix — "EKREM" and "EKREM H" (a common shorthand for "EKREM
// HOCA" some source sheets use, vs. others that already wrote "HOCA" in full
// and got it stripped by stripHocaHonorific in student-ledger-import.ts)
// normalize to two DIFFERENT keys and are therefore staged as two distinct
// teachers. This only ever SURFACES a recommendation for a human to review —
// it never merges records, transfers sessions, or deletes/archives anything.

/** Trailing tokens that commonly stand in for "Hoca" (teacher) in source
 *  sheets — stripped one at a time from the end so "ekrem h" and "ekrem hoca"
 *  both collapse to "ekrem" for comparison purposes only. */
const TEACHER_HONORIFIC_TOKENS = new Set([
  "hoca", "h", "öğretmen", "ogretmen", "öğrt", "ogrt", "abi", "hanım", "hanim",
]);

function stripTrailingTeacherHonorific(normalized: string): string {
  const tokens = normalized.split(" ");
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1]!.replace(/\.$/, "");
    if (!TEACHER_HONORIFIC_TOKENS.has(last)) break;
    tokens.pop();
  }
  return tokens.join(" ");
}

export interface DuplicateTeacherCandidate {
  teacherA: Teacher;
  teacherB: Teacher;
  teacherASessionCount: number;
  teacherBSessionCount: number;
  reason: string;
}

/** Flags teacher pairs whose names normalize to the same person once a
 *  trailing honorific/abbreviation is stripped — e.g. "EKREM" vs "EKREM H".
 *  Read-only: callers decide what (if anything) to do with the recommendation;
 *  this never mutates `teachers`/`sessions` or picks a "correct" record.
 *  Archived teachers (already merged into someone else) are excluded — they've
 *  already been resolved and shouldn't be re-suggested. */
export function findLikelyDuplicateTeachers(teachers: Teacher[], sessions: Session[]): DuplicateTeacherCandidate[] {
  const active = teachers.filter((t) => t.status !== "archived");
  const results: DuplicateTeacherCandidate[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i]!;
      const b = active[j]!;
      const strippedA = stripTrailingTeacherHonorific(normalizeName(a.fullName));
      const strippedB = stripTrailingTeacherHonorific(normalizeName(b.fullName));
      if (!strippedA || strippedA !== strippedB) continue;
      results.push({
        teacherA: a,
        teacherB: b,
        teacherASessionCount: sessions.filter((s) => s.teacherId === a.id).length,
        teacherBSessionCount: sessions.filter((s) => s.teacherId === b.id).length,
        reason: `"${a.fullName}" ve "${b.fullName}" adları normalize edildiğinde aynı kişiyi işaret ediyor olabilir.`,
      });
    }
  }
  return results;
}

export function buildTeacherListItems(
  teachers: Teacher[],
  educationTypes: EducationType[],
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  teacherCustomPrices: TeacherCustomPrice[] = []
): TeacherListItem[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return teachers.map((teacher) => {
    const specializationNames = [
      ...educationTypes
        .filter((et) => teacher.specializations.includes(et.id))
        .map((et) => et.name),
      ...(teacher.customBranch ? [teacher.customBranch] : []),
    ];

    return {
      id: teacher.id,
      tenantId: teacher.tenantId,
      fullName: teacher.fullName,
      phone: teacher.phone,
      email: teacher.email,
      status: teacher.status,
      specializationNames,
      createdAt: teacher.createdAt,
      totalSessions: sessions.filter((s) => s.teacherId === teacher.id).length,
      completedSessions: getTeacherCompletedSessions(teacher.id, sessions),
      monthlyEarnings: getTeacherMonthlyEarnings(teacher, sessions, year, month),
      pendingEarnings: getTeacherPendingEarnings(teacher, sessions, teacherPayments),
      unknownSessionCount: getTeacherEarningTotals(teacher, sessions, teacherPayments, teacherCustomPrices).unknownSessionCount,
    };
  });
}

export function buildTeacherDetail(
  teacherId: string,
  teachers: Teacher[],
  educationTypes: EducationType[],
  students: Student[],
  guardians: Guardian[],
  sessions: Session[],
  earnings: TeacherEarning[],
  teacherPayments: TeacherPayment[],
  customPrices: TeacherCustomPrice[]
): TeacherDetail | null {
  const teacher = teachers.find((t) => t.id === teacherId);
  if (!teacher) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const specializationNames = [
    ...educationTypes
      .filter((et) => teacher.specializations.includes(et.id))
      .map((et) => et.name),
    ...(teacher.customBranch ? [teacher.customBranch] : []),
  ];
  const teacherSessions = getTeacherSessions(teacherId, sessions);
  const teacherEarnings = getTeacherEarnings(teacherId, earnings);
  const studentRows = getTeacherStudentRows(
    teacherId,
    sessions,
    students,
    guardians,
    educationTypes
  );
  const priceRows = getTeacherPriceRows(teacher, educationTypes, customPrices);

  return {
    ...teacher,
    specializationNames,
    sessions: teacherSessions,
    studentRows,
    earnings: teacherEarnings,
    priceRows,
    totalSessions: teacherSessions.length,
    completedSessions: getTeacherCompletedSessions(teacherId, sessions),
    monthlyEarnings: getTeacherMonthlyEarnings(teacher, sessions, year, month),
    pendingEarnings: getTeacherPendingEarnings(teacher, sessions, teacherPayments),
    totalEarnings: getTeacherTotalEarnings(teacher, sessions, teacherPayments),
    unknownSessionCount: getTeacherEarningTotals(teacher, sessions, teacherPayments, customPrices).unknownSessionCount,
  };
}

export function buildStudentDetail(
  studentId: string,
  students: Student[],
  guardians: Guardian[],
  educationTypes: EducationType[],
  teachers: Teacher[],
  sessions: Session[],
  payments: Payment[],
  openingBalances: OpeningBalance[] = []
): StudentDetail | null {
  const student = students.find((s) => s.id === studentId);
  if (!student) return null;

  const allGuardians = getStudentGuardians(student, guardians);
  const primaryGuardian = allGuardians[0] ?? null;
  const educationTypeNames = educationTypes
    .filter((et) => student.educationTypeIds.includes(et.id))
    .map((et) => et.name);
  const assignedTeachers = getStudentAssignedTeachers(studentId, sessions, teachers);
  const studentSessions = getStudentSessions(studentId, sessions);
  const studentPayments = getStudentPayments(studentId, payments);

  return {
    ...student,
    primaryGuardian,
    allGuardians,
    educationTypeNames,
    assignedTeachers,
    sessions: studentSessions,
    payments: studentPayments,
    totalSessions: studentSessions.length,
    totalBilled: getStudentTotalBilled(studentId, sessions),
    totalPaid: getStudentTotalPaid(studentId, payments),
    totalDebt: getStudentDebt(studentId, sessions, payments, openingBalances),
  };
}

// ─── Session-specific helpers ──────────────────────────────────────────────────

// ─── Session timing constants ──────────────────────────────────────────────────

export const DEFAULT_SESSION_DURATION_MINUTES = 40;
export const AUTO_COMPLETE_GRACE_MINUTES = 5;

/**
 * Returns the display status for a session.
 * For planned sessions that have started but not yet reached the auto-complete
 * threshold (start + duration), returns "in_progress" as a display-only value.
 */
export function getSessionDisplayStatus(
  session: Pick<Session, "status" | "date">,
  now: Date = new Date()
): SessionStatus | "in_progress" {
  if (session.status !== "planned") return session.status;
  const start = new Date(session.date);
  const end = new Date(
    start.getTime() + DEFAULT_SESSION_DURATION_MINUTES * 60_000
  );
  if (now >= start && now < end) return "in_progress";
  return "planned";
}

export function calculateSessionTotal(session: Session): number {
  return session.studentPrice * session.sessionCount;
}

export function calculateSessionTeacherEarning(session: Session): number {
  return session.teacherEarning * session.sessionCount;
}

export function calculateSessionCenterProfit(session: Session): number {
  return calculateSessionTotal(session) - calculateSessionTeacherEarning(session);
}

export function getDefaultStudentPrice(
  educationTypeId: string,
  educationTypes: EducationType[]
): number {
  return (
    educationTypes.find((et) => et.id === educationTypeId)?.defaultStudentPrice ?? 0
  );
}

export function getTeacherCustomPriceForEducationType(
  teacherId: string,
  educationTypeId: string,
  customPrices: TeacherCustomPrice[]
): number | null {
  return (
    customPrices.find(
      (cp) => cp.teacherId === teacherId && cp.educationTypeId === educationTypeId
    )?.customEarning ?? null
  );
}

// ─── Teacher payment model helpers ────────────────────────────────────────────

/**
 * Returns the teacher's session-level earning for a given education type,
 * or null for per_session teachers with no configured price (no default fallback).
 */
export function calculateTeacherSessionEarning(
  teacher: Teacher,
  educationTypeId: string,
  studentPrice: number,
  customPrices: TeacherCustomPrice[]
): number | null {
  switch (teacher.earningType) {
    case "monthly_salary":
    case "salary_plus_quota":
      return 0; // salary is handled monthly, not per session
    case "percentage":
      return Math.round(studentPrice * (teacher.earningPercentage ?? 0) / 100);
    case "per_session":
    default: {
      const custom = customPrices.find(
        (cp) => cp.teacherId === teacher.id && cp.educationTypeId === educationTypeId
      );
      return custom?.customEarning ?? null; // null = no price configured
    }
  }
}

/**
 * The single source of truth for "was this session's teacherEarning actually
 * calculated, or is it an unreliable 0-fallback" (see TeacherEarningCalculationStatus).
 * Every new Session write path (import, manual SessionFormDrawer entry, recalculation)
 * persists `teacherEarningStatus` explicitly at write time — this resolver exists so
 * every READ path (totals, lists, reports) has exactly one place that decides what an
 * older record with no persisted status means, instead of each screen guessing.
 *
 * Rule for `teacherEarningStatus === undefined` (a record written before this field
 * existed): a nonzero stored `teacherEarning` could only exist if it was genuinely
 * computed or entered, so it's "calculated". A zero requires closer inspection — if the
 * teacher can be found, re-running calculateTeacherSessionEarning with today's settings
 * tells us whether zero was ever really uncomputable (null → "unknown") or is a
 * legitimate zero (a 0% percentage teacher, etc. → "calculated"). If the teacher can't
 * be found at all (deleted/orphaned reference), this is genuinely ambiguous — per the
 * "never guess" rule, it falls back to "calculated" (the pre-existing, already-displayed
 * behavior) rather than inventing a new "unknown" flag for a record we can't verify.
 */
export function resolveTeacherEarningStatus(
  session: Session,
  teacher: Teacher | undefined,
  customPrices: TeacherCustomPrice[]
): TeacherEarningCalculationStatus {
  if (session.teacherEarningStatus) return session.teacherEarningStatus;
  if (session.teacherEarning > 0) return "calculated";
  if (!teacher) return "calculated";
  const recalculated = calculateTeacherSessionEarning(teacher, session.educationTypeId, session.studentPrice, customPrices);
  return recalculated === null ? "unknown" : "calculated";
}

// ─── Unknown-earning recalculation (requirement 5) ─────────────────────────────
// Lets a center complete a teacher's price settings after a historical import and
// then safely re-run the calculation for exactly the sessions that were left
// unresolved — never touches sessions that already have a real calculated
// earning, never creates a TeacherPayment, and never duplicates a TeacherEarning
// row (store.updateSession's existing upsertEarningForSession already keys by
// sessionId). Running the preview/apply twice in a row is a no-op the second
// time: once a session's status flips to "calculated" it no longer matches the
// "unknown" filter below.

export interface EarningRecalculationRow {
  session: Session;
  studentName: string;
  educationTypeName: string;
  /** null = calculateTeacherSessionEarning still can't resolve this session
   *  (e.g. the custom price still isn't configured for THIS education type). */
  recalculatedEarning: number | null;
}

/** Every earning-eligible session for `teacher` currently marked unknown,
 *  paired with what calculateTeacherSessionEarning resolves to right now —
 *  the preview a "Eksik Hakedişleri Yeniden Hesapla" action should show before
 *  applying anything. Purely read-only. */
export function buildEarningRecalculationPreview(
  teacher: Teacher,
  sessions: Session[],
  customPrices: TeacherCustomPrice[],
  students: Student[],
  educationTypes: EducationType[]
): EarningRecalculationRow[] {
  return sessions
    .filter(
      (s) =>
        s.teacherId === teacher.id &&
        EARNING_STATUSES.includes(s.status) &&
        resolveTeacherEarningStatus(s, teacher, customPrices) === "unknown"
    )
    .map((s) => {
      const student = students.find((st) => st.id === s.studentId);
      const et = educationTypes.find((e) => e.id === s.educationTypeId);
      return {
        session: s,
        studentName: student?.fullName ?? "—",
        educationTypeName: et?.name ?? "—",
        recalculatedEarning: calculateTeacherSessionEarning(teacher, s.educationTypeId, s.studentPrice, customPrices),
      } satisfies EarningRecalculationRow;
    });
}

/**
 * Turns a preview into the actual Session records to persist — only the rows
 * that resolved (recalculatedEarning !== null), with teacherEarning updated and
 * teacherEarningStatus flipped to "calculated". Still-unresolved rows are left
 * out entirely (never written, never guessed).
 *
 * This function only returns data — it does not call the store. The caller
 * must feed each returned Session through the existing `store.updateSession`,
 * which already upserts the TeacherEarning ledger idempotently by sessionId
 * (see upsertEarningForSession in mock/store.tsx) and never touches
 * TeacherPayment, satisfying "no duplicate earning/payment records" by
 * construction — this helper does not need to re-implement that guarantee.
 */
export function applyEarningRecalculation(rows: EarningRecalculationRow[]): Session[] {
  return rows
    .filter((r): r is EarningRecalculationRow & { recalculatedEarning: number } => r.recalculatedEarning !== null)
    .map((r) => ({ ...r.session, teacherEarning: r.recalculatedEarning, teacherEarningStatus: "calculated" as const }));
}

/**
 * Computes the total amount payable to a teacher for a given month.
 * Uses stored session teacherEarning values for per_session teachers.
 */
export function calculateTeacherMonthlyPayable(
  teacher: Teacher,
  sessions: Session[],
  year: number,
  month: number
): number {
  const earningSessions = sessions.filter((s) => {
    if (s.teacherId !== teacher.id) return false;
    if (!EARNING_STATUSES.includes(s.status)) return false;
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  const totalSessionCount = earningSessions.reduce((sum, s) => sum + s.sessionCount, 0);

  switch (teacher.earningType) {
    case "monthly_salary":
      return teacher.monthlySalary ?? 0;
    case "salary_plus_quota": {
      const salary = teacher.monthlySalary ?? 0;
      const quota = teacher.includedSessionQuota ?? 0;
      const rate = teacher.extraSessionEarning ?? 0;
      const extra = Math.max(0, totalSessionCount - quota);
      return salary + extra * rate;
    }
    case "percentage":
      return earningSessions.reduce((sum, s) => {
        const pct = teacher.earningPercentage ?? 0;
        return sum + Math.round(s.studentPrice * pct / 100) * s.sessionCount;
      }, 0);
    case "per_session":
    default:
      return earningSessions.reduce((sum, s) => sum + s.teacherEarning * s.sessionCount, 0);
  }
}

/** Distinct (year, month) pairs a teacher could owe earnings for — every month with an
 *  earning-eligible session, plus the current month (salary is owed unconditionally). */
function getTeacherEarningMonths(
  teacherId: string,
  sessions: Session[]
): { year: number; month: number }[] {
  const seen = new Set<string>();
  sessions
    .filter((s) => s.teacherId === teacherId && EARNING_STATUSES.includes(s.status))
    .forEach((s) => {
      const d = new Date(s.date);
      seen.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    });
  const now = new Date();
  seen.add(`${now.getFullYear()}-${now.getMonth() + 1}`);

  return [...seen].map((key) => {
    const [year, month] = key.split("-").map(Number);
    return { year: year as number, month: month as number };
  });
}

/**
 * Total amount ever payable to a teacher, across every month they have earning-eligible
 * sessions (plus the current month). This is the same calculation the monthly summary
 * uses (`calculateTeacherMonthlyPayable`), just accumulated over time — sessions/salary
 * entitlement are always the source of truth, never student payments or a payment ledger.
 */
export function calculateTeacherTotalPayable(teacher: Teacher, sessions: Session[]): number {
  return getTeacherEarningMonths(teacher.id, sessions).reduce(
    (sum, { year, month }) => sum + calculateTeacherMonthlyPayable(teacher, sessions, year, month),
    0
  );
}

export interface TeacherEarningTotals {
  teacherId: string;
  totalEarning: number;
  /** Cash/bank payments only (Maaş, Avans, Ara Ödeme, Prim, Diğer) — never Kesinti. */
  paidEarning: number;
  /** Kesinti total — reduces what's owed but is never cash, never counted as "paid". */
  deductedEarning: number;
  pendingEarning: number;
  /** Earning-eligible sessions in this total's scope whose earning is unknown/
   *  unresolved (see resolveTeacherEarningStatus) — never folded into
   *  totalEarning/pendingEarning as a confirmed ₺0. Callers that display a total
   *  MUST also surface this count instead of presenting the total as complete. */
  unknownSessionCount: number;
}

/** Counts earning-eligible sessions for one teacher whose earning is unknown/
 *  unresolved, optionally restricted to a scope (a month, a date range) — the
 *  shared building block behind every TeacherEarningTotals' unknownSessionCount.
 *  Never invents an amount for these sessions, only counts them. */
function countUnknownEarningSessions(
  teacher: Teacher,
  sessions: Session[],
  customPrices: TeacherCustomPrice[],
  isInScope: (session: Session) => boolean = () => true
): number {
  return sessions.filter(
    (s) =>
      s.teacherId === teacher.id &&
      EARNING_STATUSES.includes(s.status) &&
      isInScope(s) &&
      resolveTeacherEarningStatus(s, teacher, customPrices) === "unknown"
  ).length;
}

/** A Kesinti isn't an outgoing payment — it's an adjustment to what's owed. Every other
 *  payment type is a real cash/bank payment to the teacher. */
export function isDeductionPaymentType(type: TeacherPaymentType): boolean {
  return type === "deduction";
}

export function getTeacherCashPaidTotal(teacherId: string, teacherPayments: TeacherPayment[]): number {
  return teacherPayments
    .filter((p) => p.teacherId === teacherId && !isDeductionPaymentType(p.paymentType))
    .reduce((sum, p) => sum + p.amount, 0);
}

export function getTeacherDeductionTotal(teacherId: string, teacherPayments: TeacherPayment[]): number {
  return teacherPayments
    .filter((p) => p.teacherId === teacherId && isDeductionPaymentType(p.paymentType))
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Canonical per-teacher earning totals — the single source every card, list, and
 * dashboard widget should read from. `totalEarning` always comes from sessions/salary
 * entitlement (calculateTeacherTotalPayable), never from student payments.
 * `pending = totalEarning - paidEarning - deductedEarning`: a Kesinti reduces pending
 * exactly like a cash payment does, but is tracked separately and never counted as paid.
 */
export function getTeacherEarningTotals(
  teacher: Teacher,
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  customPrices: TeacherCustomPrice[] = []
): TeacherEarningTotals {
  const totalEarning = calculateTeacherTotalPayable(teacher, sessions);
  const paidEarning = getTeacherCashPaidTotal(teacher.id, teacherPayments);
  const deductedEarning = getTeacherDeductionTotal(teacher.id, teacherPayments);
  const pendingEarning = Math.max(0, totalEarning - paidEarning - deductedEarning);
  const unknownSessionCount = countUnknownEarningSessions(teacher, sessions, customPrices);
  return { teacherId: teacher.id, totalEarning, paidEarning, deductedEarning, pendingEarning, unknownSessionCount };
}

/**
 * Per-teacher totals for a single month. Every TeacherPayment (cash or Kesinti) is applied
 * in chronological order, oldest-owed-month-first (like settling the oldest invoice first),
 * so the monthly summary's paid/deducted/pending split stays consistent with the all-time
 * totals above regardless of when within a month a payment was recorded.
 */
export function getTeacherMonthEarningTotals(
  teacher: Teacher,
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  year: number,
  month: number,
  customPrices: TeacherCustomPrice[] = []
): TeacherEarningTotals {
  const totalEarning = calculateTeacherMonthlyPayable(teacher, sessions, year, month);

  const owedByMonth = getTeacherEarningMonths(teacher.id, sessions)
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
    .map((m) => ({ ...m, remaining: calculateTeacherMonthlyPayable(teacher, sessions, m.year, m.month) }));

  const chronologicalPayments = teacherPayments
    .filter((p) => p.teacherId === teacher.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let paidEarning = 0;
  let deductedEarning = 0;

  for (const p of chronologicalPayments) {
    let remainingAmount = p.amount;
    for (const bucket of owedByMonth) {
      if (remainingAmount <= 0) break;
      if (bucket.remaining <= 0) continue;
      const applied = Math.min(bucket.remaining, remainingAmount);
      bucket.remaining -= applied;
      remainingAmount -= applied;
      if (bucket.year === year && bucket.month === month) {
        if (isDeductionPaymentType(p.paymentType)) deductedEarning += applied;
        else paidEarning += applied;
      }
    }
  }

  const pendingEarning = Math.max(0, totalEarning - paidEarning - deductedEarning);
  const unknownSessionCount = countUnknownEarningSessions(teacher, sessions, customPrices, (s) => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
  return { teacherId: teacher.id, totalEarning, paidEarning, deductedEarning, pendingEarning, unknownSessionCount };
}

/**
 * Teacher-side equivalent of `buildStudentCurrentAccount` — Önceki Devir / Bu Ay Hakediş /
 * Bu Ay Ödeme / Bu Ay Kesinti / Güncel Bakiye, using simple date-based scoping (not the
 * FIFO reallocation `getTeacherMonthEarningTotals` uses) so a payment recorded in July
 * always reduces July's own balance, never silently "shows up" in August. This mirrors
 * `getPreviousBalance`/`getCurrentMonthBilled`/`getCurrentMonthPaid` on the student side.
 */
export function getTeacherMonthAccountSummary(
  teacher: Teacher,
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  year: number,
  month: number,
  customPrices: TeacherCustomPrice[] = []
): TeacherMonthAccountSummary {
  const isBeforeMonth = (dateStr: string) => {
    const d = parseDateOnly(dateStr);
    return d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() + 1 < month);
  };
  const isInMonth = (dateStr: string) => {
    const d = parseDateOnly(dateStr);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  };

  const thisMonthEarning = calculateTeacherMonthlyPayable(teacher, sessions, year, month);

  const teacherOwnPayments = teacherPayments.filter((p) => p.teacherId === teacher.id);

  // Every month strictly before the target one that this teacher could owe for —
  // same month set calculateTeacherTotalPayable/getTeacherEarningTotals already use.
  const priorMonths = getTeacherEarningMonths(teacher.id, sessions).filter(
    (m) => m.year < year || (m.year === year && m.month < month)
  );
  const priorEarned = priorMonths.reduce(
    (sum, m) => sum + calculateTeacherMonthlyPayable(teacher, sessions, m.year, m.month),
    0
  );
  const priorSettled = teacherOwnPayments
    .filter((p) => isBeforeMonth(p.date))
    .reduce((sum, p) => sum + p.amount, 0); // cash + Kesinti both settle what's owed
  const previousBalance = Math.max(0, priorEarned - priorSettled);

  const paymentsThisMonth = teacherOwnPayments.filter((p) => isInMonth(p.date));
  const thisMonthPaid = paymentsThisMonth
    .filter((p) => !isDeductionPaymentType(p.paymentType))
    .reduce((sum, p) => sum + p.amount, 0);
  const thisMonthDeducted = paymentsThisMonth
    .filter((p) => isDeductionPaymentType(p.paymentType))
    .reduce((sum, p) => sum + p.amount, 0);

  const currentBalance = Math.max(
    0,
    previousBalance + thisMonthEarning - thisMonthPaid - thisMonthDeducted
  );

  const allTimeTotals = getTeacherEarningTotals(teacher, sessions, teacherPayments, customPrices);
  const totalPending = allTimeTotals.pendingEarning;
  const totalUnknownSessionCount = allTimeTotals.unknownSessionCount;
  const unknownSessionCount = countUnknownEarningSessions(teacher, sessions, customPrices, (s) => isInMonth(s.date));

  const earningSessions = sessions.filter(
    (s) => s.teacherId === teacher.id && EARNING_STATUSES.includes(s.status)
  );
  const lastSessionDate =
    earningSessions.length === 0
      ? null
      : earningSessions.reduce((latest, s) => (s.date > latest ? s.date : latest), earningSessions[0]!.date);

  return {
    teacherId: teacher.id,
    teacherName: teacher.fullName,
    year,
    month,
    previousBalance,
    thisMonthEarning,
    thisMonthPaid,
    thisMonthDeducted,
    currentBalance,
    totalPending,
    lastSessionDate,
    unknownSessionCount,
    totalUnknownSessionCount,
  };
}

/**
 * Per-teacher totals for an arbitrary date range (reports' Month/Date Range filters).
 * When both bounds are null this is identical to `getTeacherEarningTotals` (all-time),
 * and callers should prefer the exact (year, month) helpers above when the range is a
 * single whole calendar month, so numbers stay pixel-identical with the dashboard/teacher
 * detail cards. `totalEarning` is still summed via `calculateTeacherMonthlyPayable` per
 * calendar month overlapping the range — never re-derived from raw session amounts — so
 * salary/quota entitlement is computed exactly the same way everywhere.
 */
export function getTeacherEarningTotalsForRange(
  teacher: Teacher,
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  startDate: string | null,
  endDate: string | null,
  customPrices: TeacherCustomPrice[] = []
): TeacherEarningTotals {
  if (!startDate && !endDate) {
    return getTeacherEarningTotals(teacher, sessions, teacherPayments, customPrices);
  }

  // Parsed as local dates throughout (never `new Date("YYYY-MM-DD")`, which is UTC and
  // can silently shift a month boundary by a day depending on the browser's timezone).
  const start = startDate ? parseDateOnly(startDate) : null;
  const end = endDate ? parseDateOnlyEndOfDay(endDate) : null;

  const seen = new Set<string>();
  sessions
    .filter((s) => s.teacherId === teacher.id && EARNING_STATUSES.includes(s.status))
    .forEach((s) => {
      const d = new Date(s.date);
      if (start && d < start) return;
      if (end && d > end) return;
      seen.add(`${d.getFullYear()}-${d.getMonth() + 1}`);
    });

  // Every calendar month the range spans, so a salary teacher still shows up even with
  // zero sessions that month (mirrors getTeacherEarningMonths' "unconditional" inclusion).
  if (start && end) {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor <= last) {
      seen.add(`${cursor.getFullYear()}-${cursor.getMonth() + 1}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const totalEarning = [...seen]
    .map((key) => {
      const [year, month] = key.split("-").map(Number);
      return { year: year as number, month: month as number };
    })
    .reduce((sum, { year, month }) => sum + calculateTeacherMonthlyPayable(teacher, sessions, year, month), 0);

  const paymentsInRange = teacherPayments.filter((p) => {
    if (p.teacherId !== teacher.id) return false;
    const d = parseDateOnly(p.date);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  const paidEarning = paymentsInRange
    .filter((p) => !isDeductionPaymentType(p.paymentType))
    .reduce((sum, p) => sum + p.amount, 0);
  const deductedEarning = paymentsInRange
    .filter((p) => isDeductionPaymentType(p.paymentType))
    .reduce((sum, p) => sum + p.amount, 0);

  const unknownSessionCount = countUnknownEarningSessions(teacher, sessions, customPrices, (s) => {
    const d = new Date(s.date);
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  });

  return {
    teacherId: teacher.id,
    totalEarning,
    paidEarning,
    deductedEarning,
    pendingEarning: Math.max(0, totalEarning - paidEarning - deductedEarning),
    unknownSessionCount,
  };
}

export function getTeacherPaymentModelLabel(teacher: Teacher): string {
  switch (teacher.earningType) {
    case "per_session":      return "Seans Başı";
    case "monthly_salary":   return "Sabit Maaş";
    case "salary_plus_quota": return "Sabit Maaş + Kota Üstü";
    case "percentage":       return `Yüzde (%${teacher.earningPercentage ?? 0})`;
    default:                 return "Tanımlanmamış";
  }
}

export function getTeacherIncludedQuotaUsage(
  teacher: Teacher,
  sessions: Session[],
  year: number,
  month: number
): number {
  if (teacher.earningType !== "salary_plus_quota") return 0;
  const quota = teacher.includedSessionQuota ?? 0;
  const total = sessions
    .filter((s) => {
      if (s.teacherId !== teacher.id) return false;
      if (!EARNING_STATUSES.includes(s.status)) return false;
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .reduce((sum, s) => sum + s.sessionCount, 0);
  return Math.min(total, quota);
}

export function getTeacherExtraSessionCount(
  teacher: Teacher,
  sessions: Session[],
  year: number,
  month: number
): number {
  if (teacher.earningType !== "salary_plus_quota") return 0;
  const quota = teacher.includedSessionQuota ?? 0;
  const total = sessions
    .filter((s) => {
      if (s.teacherId !== teacher.id) return false;
      if (!EARNING_STATUSES.includes(s.status)) return false;
      const d = new Date(s.date);
      return d.getFullYear() === year && d.getMonth() + 1 === month;
    })
    .reduce((sum, s) => sum + s.sessionCount, 0);
  return Math.max(0, total - quota);
}

export function buildSessionListItems(
  sessions: Session[],
  students: Student[],
  teachers: Teacher[],
  educationTypes: EducationType[],
  teacherCustomPrices: TeacherCustomPrice[] = []
): SessionListItem[] {
  return [...sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((session) => {
      const student = students.find((s) => s.id === session.studentId);
      const teacher = teachers.find((t) => t.id === session.teacherId);
      const et = educationTypes.find((e) => e.id === session.educationTypeId);
      const totalAmount = calculateSessionTotal(session);
      const totalTeacherEarning = calculateSessionTeacherEarning(session);

      return {
        id: session.id,
        tenantId: session.tenantId,
        date: session.date,
        studentId: session.studentId,
        studentName: student?.fullName ?? "—",
        teacherId: session.teacherId,
        teacherName: teacher?.fullName ?? "—",
        educationTypeId: session.educationTypeId,
        educationTypeName: et?.name ?? "—",
        sessionCount: session.sessionCount,
        studentPrice: session.studentPrice,
        totalAmount,
        teacherEarningUnit: session.teacherEarning,
        totalTeacherEarning,
        centerProfit: totalAmount - totalTeacherEarning,
        status: session.status,
        notes: session.notes,
        durationMinutes: session.durationMinutes,
        billingMode: session.billingMode,
        teacherEarningStatus: resolveTeacherEarningStatus(session, teacher, teacherCustomPrices),
      } satisfies SessionListItem;
    });
}

export function buildSessionPageStats(
  sessions: Session[],
  year: number,
  month: number
): SessionPageStats {
  const inMonth = sessions.filter((s) => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  return {
    total: inMonth.length,
    completed: inMonth.filter((s) => s.status === "completed").length,
    planned: inMonth.filter((s) => s.status === "planned").length,
    cancelledAndNoShow: inMonth.filter(
      (s) => s.status === "cancelled" || s.status === "no_show"
    ).length,
    makeup: inMonth.filter((s) => s.status === "makeup").length,
  };
}

// ─── Payment-specific helpers ──────────────────────────────────────────────────

export function getPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    cash: "Nakit",
    bank_transfer: "EFT / Havale",
    credit_card: "Kredi Kartı",
    other: "Diğer",
  };
  return labels[method];
}

/** Short form used for teacher payments (Nakit / EFT/Havale / Kart / Diğer). */
export function getShortPaymentMethodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    cash: "Nakit",
    bank_transfer: "EFT/Havale",
    credit_card: "Kart",
    other: "Diğer",
  };
  return labels[method];
}

export const TEACHER_PAYMENT_TYPES: TeacherPaymentType[] = [
  "salary",
  "advance",
  "partial",
  "bonus",
  "deduction",
  "other",
];

export function getTeacherPaymentTypeLabel(type: TeacherPaymentType): string {
  const labels: Record<TeacherPaymentType, string> = {
    salary: "Maaş",
    advance: "Avans",
    partial: "Ara Ödeme",
    bonus: "Prim",
    deduction: "Kesinti",
    other: "Diğer",
  };
  return labels[type];
}

// ─── Status label helpers ───────────────────────────────────────────────────────
// Centralized so no raw enum value (e.g. "planned", "active") ever reaches the UI —
// tables, exports (CSV/PDF), and dropdowns should all resolve through these.

export function getSessionStatusLabel(status: SessionStatus | "in_progress"): string {
  const labels: Record<SessionStatus | "in_progress", string> = {
    planned: "Planlandı",
    completed: "Tamamlandı",
    cancelled: "İptal",
    no_show: "Gelmedi",
    makeup: "Telafi",
    in_progress: "Devam Ediyor",
  };
  return labels[status];
}

export function getStudentStatusLabel(status: StudentStatus): string {
  const labels: Record<StudentStatus, string> = {
    active: "Aktif",
    inactive: "Pasif",
    on_hold: "Beklemede",
  };
  return labels[status];
}

export function getTeacherStatusLabel(status: TeacherStatus): string {
  const labels: Record<TeacherStatus, string> = {
    active: "Aktif",
    inactive: "Pasif",
    archived: "Arşivlendi",
  };
  return labels[status];
}

// ─── Month key/label helpers ────────────────────────────────────────────────────

/** "YYYY-M" key for grouping/filtering by calendar month. */
export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

/** Turkish long month + year label from a getMonthKey() key, e.g. "Temmuz 2026". */
export function getMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(
    new Date(y as number, (m as number) - 1, 1)
  );
}

// ─── Date-only ("YYYY-MM-DD") helpers ──────────────────────────────────────────
// `new Date("YYYY-MM-DD")` parses as UTC midnight, while `.getFullYear()`/`.getMonth()`
// read back in local time — mixing the two silently shifts dates by a day (or a whole
// month, near month boundaries) whenever the browser's timezone isn't UTC. These always
// construct/format using local components only, so report date-range filtering is
// correct regardless of the user's timezone (this app's Turkish users are UTC+3).

/** Parses a "YYYY-MM-DD" string as local midnight (never UTC). */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y as number, (m as number) - 1, d as number);
}

/** Parses a "YYYY-MM-DD" string as local end-of-day — for inclusive range upper bounds. */
export function parseDateOnlyEndOfDay(dateStr: string): Date {
  const d = parseDateOnly(dateStr);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Formats a Date back to "YYYY-MM-DD" using local components (never `.toISOString()`). */
export function formatDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resolveDebtStatus(
  totalBilled: number,
  totalPaid: number,
  remainingDebt: number
): DebtStatus {
  if (totalBilled === 0 || remainingDebt <= 0) return "paid";
  if (totalPaid === 0) return "unpaid";
  return "partial";
}

export function buildPaymentListItems(
  payments: Payment[],
  students: Student[],
  guardians: Guardian[],
  sessions: Session[],
  openingBalances: OpeningBalance[] = []
): PaymentListItem[] {
  return [...payments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((payment) => {
      const student = students.find((s) => s.id === payment.studentId);
      const primaryGuardian = student
        ? (guardians.find((g) => student.guardianIds.includes(g.id)) ?? null)
        : null;
      const totalBilled = getStudentTotalBilled(payment.studentId, sessions);
      const totalPaid = getStudentTotalPaid(payment.studentId, payments);
      const remainingDebt = getStudentDebt(payment.studentId, sessions, payments, openingBalances);

      return {
        id: payment.id,
        tenantId: payment.tenantId,
        date: payment.date,
        studentId: payment.studentId,
        studentName: student?.fullName ?? "—",
        guardianId: primaryGuardian?.id ?? null,
        guardianName: primaryGuardian?.fullName ?? null,
        guardianPhone: primaryGuardian?.phone ?? null,
        method: payment.method,
        methodLabel: getPaymentMethodLabel(payment.method),
        amount: payment.amount,
        totalBilled,
        totalPaid,
        remainingDebt,
        debtStatus: resolveDebtStatus(totalBilled, totalPaid, remainingDebt),
        notes: payment.notes,
        paymentSource: payment.paymentSource,
        installmentPlanId: payment.installmentPlanId,
        installmentNumber: payment.installmentNumber,
      } satisfies PaymentListItem;
    });
}

export function buildStudentDebtItems(
  students: Student[],
  guardians: Guardian[],
  sessions: Session[],
  payments: Payment[],
  openingBalances: OpeningBalance[] = []
): StudentDebtItem[] {
  return students
    .map((student) => {
      const primaryGuardian =
        guardians.find((g) => student.guardianIds.includes(g.id)) ?? null;
      const totalBilled = getStudentTotalBilled(student.id, sessions);
      const totalPaid = getStudentTotalPaid(student.id, payments);
      const remainingDebt = getStudentDebt(student.id, sessions, payments, openingBalances);

      return {
        studentId: student.id,
        studentName: student.fullName,
        guardianId: primaryGuardian?.id ?? null,
        guardianName: primaryGuardian?.fullName ?? null,
        totalBilled,
        totalPaid,
        remainingDebt,
        debtStatus: resolveDebtStatus(totalBilled, totalPaid, remainingDebt),
        lastActivityDate: getStudentLastActivityDate(student.id, sessions, payments),
        lastDebtActivityDate: getStudentDebtActivityDate(student.id, sessions, payments),
        hasOpeningBalance: getOpeningBalanceNet(student.id, openingBalances) !== 0,
      } satisfies StudentDebtItem;
    })
    // Any student with financial activity — billed, paid, or carrying a migrated
    // opening balance (a student imported with only a historical Devir Bakiyesi
    // and no session/payment history yet must still show up here).
    .filter((item) => item.totalBilled > 0 || item.totalPaid > 0 || item.hasOpeningBalance)
    .sort((a, b) => b.remainingDebt - a.remainingDebt);
}

export function buildPaymentPageStats(
  payments: Payment[],
  sessions: Session[],
  students: Student[],
  year: number,
  month: number,
  openingBalances: OpeningBalance[] = []
): PaymentPageStats {
  const inMonth = payments.filter((p) => {
    const d = new Date(p.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const totalBilled = sessions
    .filter((s) => isBillableSession(s))
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  const totalRemaining = students.reduce(
    (sum, s) => sum + getStudentDebt(s.id, sessions, payments, openingBalances),
    0
  );

  const studentsWithDebt = students.filter(
    (s) => getStudentDebt(s.id, sessions, payments, openingBalances) > 0
  ).length;

  return {
    collectedThisMonth: inMonth.reduce((sum, p) => sum + p.amount, 0),
    totalBilled,
    totalCollected,
    totalRemaining,
    studentsWithDebt,
  };
}

// ─── Teacher Earning helpers ───────────────────────────────────────────────────

export function buildTeacherEarningListItems(
  earnings: TeacherEarning[],
  sessions: Session[],
  teachers: Teacher[],
  students: Student[],
  educationTypes: EducationType[],
  teacherCustomPrices: TeacherCustomPrice[] = []
): TeacherEarningListItem[] {
  return [...earnings]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((earning) => {
      const session = sessions.find((s) => s.id === earning.sessionId);
      const teacher = teachers.find((t) => t.id === earning.teacherId);
      const student = session
        ? students.find((s) => s.id === session.studentId)
        : undefined;
      const et = session
        ? educationTypes.find((e) => e.id === session.educationTypeId)
        : undefined;

      return {
        id: earning.id,
        tenantId: earning.tenantId,
        teacherId: earning.teacherId,
        teacherName: teacher?.fullName ?? "—",
        sessionId: earning.sessionId,
        sessionDate: session?.date ?? earning.createdAt,
        studentId: session?.studentId ?? "",
        studentName: student?.fullName ?? "—",
        educationTypeId: session?.educationTypeId ?? "",
        educationTypeName: et?.name ?? "—",
        sessionCount: session?.sessionCount ?? 1,
        unitEarning: session?.teacherEarning ?? earning.amount,
        totalEarning: earning.amount,
        status: earning.status,
        // A TeacherEarning ledger row only ever exists for amount > 0 (see
        // upsertEarningForSession) — an "unknown" (0-fallback) session never
        // gets one, so this only surfaces here in the defensive/edge case
        // where a session record is missing entirely.
        teacherEarningStatus: session ? resolveTeacherEarningStatus(session, teacher, teacherCustomPrices) : "calculated",
        paidAt: earning.paidAt,
        createdAt: earning.createdAt,
      } satisfies TeacherEarningListItem;
    });
}

export function buildTeacherEarningOverviewItems(
  teachers: Teacher[],
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  teacherCustomPrices: TeacherCustomPrice[] = []
): TeacherEarningOverviewItem[] {
  return teachers
    .map((teacher) => {
      const totals = getTeacherEarningTotals(teacher, sessions, teacherPayments, teacherCustomPrices);
      const earningCount = sessions.filter(
        (s) => s.teacherId === teacher.id && EARNING_STATUSES.includes(s.status)
      ).length;
      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        totalEarning: totals.totalEarning,
        paidEarning: totals.paidEarning,
        pendingEarning: totals.pendingEarning,
        earningCount,
        unknownSessionCount: totals.unknownSessionCount,
      } satisfies TeacherEarningOverviewItem;
    })
    // A teacher whose entire earning-eligible history is "unknown" (all sessions
    // 0-fallback, totalEarning stays 0) must still surface here — otherwise the
    // exact case this feature exists for would be the one case that silently
    // disappears from the overview.
    .filter((item) => item.totalEarning > 0 || item.unknownSessionCount > 0)
    .sort((a, b) => b.totalEarning - a.totalEarning);
}

export function buildTeacherEarningPageStats(
  teachers: Teacher[],
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  year: number,
  month: number,
  teacherCustomPrices: TeacherCustomPrice[] = []
): TeacherEarningPageStats {
  // "Bu Ay" = what's owed for sessions/salary entitlement in this specific month —
  // independent of whether it has been billed/paid to the student yet.
  const thisMonthTotal = teachers.reduce(
    (sum, t) => sum + calculateTeacherMonthlyPayable(t, sessions, year, month),
    0
  );

  const allTotals = teachers.map((t) => getTeacherEarningTotals(t, sessions, teacherPayments, teacherCustomPrices));

  return {
    thisMonthTotal,
    paidTotal: allTotals.reduce((sum, t) => sum + t.paidEarning, 0),
    pendingTotal: allTotals.reduce((sum, t) => sum + t.pendingEarning, 0),
    teachersWithEarnings: allTotals.filter((t) => t.totalEarning > 0).length,
    unresolvedSessionCount: allTotals.reduce((sum, t) => sum + t.unknownSessionCount, 0),
  };
}

export function buildMonthlyTeacherEarningSummary(
  teachers: Teacher[],
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  year: number,
  month: number,
  teacherCustomPrices: TeacherCustomPrice[] = []
): MonthlyTeacherEarningSummary[] {
  const inMonthSessions = sessions.filter((s) => {
    const d = new Date(s.date);
    return (
      d.getFullYear() === year &&
      d.getMonth() + 1 === month &&
      EARNING_STATUSES.includes(s.status)
    );
  });

  // Include salary teachers unconditionally, per-session/percentage only if they have sessions
  const relevantTeachers = teachers.filter((t) => {
    if (t.earningType === "monthly_salary" || t.earningType === "salary_plus_quota") return true;
    return inMonthSessions.some((s) => s.teacherId === t.id);
  });

  return relevantTeachers
    .map((teacher) => {
      const teacherSessions = inMonthSessions.filter((s) => s.teacherId === teacher.id);
      const sessionCount = teacherSessions.reduce((sum, s) => sum + s.sessionCount, 0);

      const { totalEarning, paidEarning, pendingEarning, unknownSessionCount } = getTeacherMonthEarningTotals(
        teacher,
        sessions,
        teacherPayments,
        year,
        month,
        teacherCustomPrices
      );

      const summary: MonthlyTeacherEarningSummary = {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        earningType: teacher.earningType,
        sessionCount,
        totalEarning,
        paidEarning,
        pendingEarning,
        unknownSessionCount,
      };

      if (teacher.earningType === "salary_plus_quota") {
        const quota = teacher.includedSessionQuota ?? 0;
        const extraRate = teacher.extraSessionEarning ?? 0;
        const extraCount = Math.max(0, sessionCount - quota);
        summary.salaryComponent = teacher.monthlySalary ?? 0;
        summary.includedQuota = quota;
        summary.quotaUsed = Math.min(sessionCount, quota);
        summary.extraSessions = extraCount;
        summary.extraEarning = extraCount * extraRate;
      }

      return summary;
    })
    .sort((a, b) => b.totalEarning - a.totalEarning);
}

// ─── Report helpers ────────────────────────────────────────────────────────────

/**
 * Per-teacher report row. `filteredSessions` should already reflect every active report
 * filter (date range, teacher, student, education type) and drives the session/student
 * counts; `allSessions` + `teacherPayments` drive the earning totals via
 * `getTeacherEarningTotalsForRange`, which needs full session history to compute
 * salary/quota entitlement correctly (same reasoning as buildStudentDebtItems needing
 * `allSessions`/`allPayments` for debt even when a report is date-filtered).
 */
export function buildTeacherReportRows(
  teachers: Teacher[],
  filteredSessions: Session[],
  allSessions: Session[],
  teacherPayments: TeacherPayment[],
  startDate: string | null,
  endDate: string | null,
  teacherCustomPrices: TeacherCustomPrice[] = []
): TeacherReportRow[] {
  return teachers
    .map((teacher) => {
      const teacherSessions = filteredSessions.filter((s) => s.teacherId === teacher.id);
      const uniqueStudentCount = new Set(teacherSessions.map((s) => s.studentId)).size;
      const { totalEarning, paidEarning, pendingEarning, unknownSessionCount } = getTeacherEarningTotalsForRange(
        teacher,
        allSessions,
        teacherPayments,
        startDate,
        endDate,
        teacherCustomPrices
      );
      const earningSessions = teacherSessions.filter((s) => EARNING_STATUSES.includes(s.status));
      const lastSessionDate =
        earningSessions.length === 0
          ? null
          : earningSessions.reduce((latest, s) => (s.date > latest ? s.date : latest), earningSessions[0]!.date);

      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        totalSessions: teacherSessions.length,
        completedSessions: earningSessions.length,
        totalEarning,
        paidEarning,
        pendingEarning,
        uniqueStudentCount,
        status: teacher.status,
        lastSessionDate,
        unknownSessionCount,
      } satisfies TeacherReportRow;
    })
    .sort((a, b) => b.totalEarning - a.totalEarning);
}

/** Flat, teacher-labeled view of every TeacherPayment — the row shape for the
 *  "Teacher Payment Report" (Financial + Teachers categories share this). */
export function buildTeacherPaymentListItems(
  teacherPayments: TeacherPayment[],
  teachers: Teacher[]
): TeacherPaymentReportRow[] {
  return [...teacherPayments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((p) => {
      const teacher = teachers.find((t) => t.id === p.teacherId);
      return {
        id: p.id,
        teacherId: p.teacherId,
        teacherName: teacher?.fullName ?? "—",
        paymentType: p.paymentType,
        paymentTypeLabel: getTeacherPaymentTypeLabel(p.paymentType),
        amount: p.amount,
        method: p.method,
        // Kesinti isn't a cash/bank payment — it has no meaningful method.
        methodLabel: isDeductionPaymentType(p.paymentType) ? "-" : getShortPaymentMethodLabel(p.method),
        date: p.date,
        description: p.description,
      } satisfies TeacherPaymentReportRow;
    });
}

function summarizeSessionStatuses(sessions: Session[]): SessionStatusBreakdown {
  return {
    total: sessions.length,
    completed: sessions.filter((s) => s.status === "completed").length,
    planned: sessions.filter((s) => s.status === "planned").length,
    cancelled: sessions.filter((s) => s.status === "cancelled").length,
    noShow: sessions.filter((s) => s.status === "no_show").length,
    makeup: sessions.filter((s) => s.status === "makeup").length,
  };
}

/** Session status counts for the Education report's summary cards. */
export function buildSessionStatusBreakdown(sessions: Session[]): SessionStatusBreakdown {
  return summarizeSessionStatuses(sessions);
}

/** Per-student session status breakdown — the Students category's "Attendance Summary". */
function latestDate(sessions: Session[]): string | null {
  if (sessions.length === 0) return null;
  return sessions.reduce((latest, s) => (s.date > latest ? s.date : latest), sessions[0]!.date);
}

export function buildStudentAttendanceRows(
  students: Student[],
  sessions: Session[]
): StudentAttendanceRow[] {
  return students
    .map((student) => {
      const studentSessions = sessions.filter((s) => s.studentId === student.id);
      return {
        studentId: student.id,
        studentName: student.fullName,
        ...summarizeSessionStatuses(studentSessions),
        lastSessionDate: latestDate(studentSessions),
      } satisfies StudentAttendanceRow;
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

/** Per-teacher session status breakdown — the Teachers category's "Teacher Session Counts". */
export function buildTeacherSessionCountRows(
  teachers: Teacher[],
  sessions: Session[]
): TeacherSessionCountRow[] {
  return teachers
    .map((teacher) => {
      const teacherSessions = sessions.filter((s) => s.teacherId === teacher.id);
      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        ...summarizeSessionStatuses(teacherSessions),
        lastSessionDate: latestDate(teacherSessions),
      } satisfies TeacherSessionCountRow;
    })
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total);
}

// ─── Guardian / Veli helpers ──────────────────────────────────────────────────

export function getGuardianStudents(
  guardian: Guardian,
  students: Student[]
): Student[] {
  return students.filter((s) => guardian.studentIds.includes(s.id));
}

export function getGuardianPayments(
  guardian: Guardian,
  payments: Payment[]
): Payment[] {
  return payments.filter((p) => guardian.studentIds.includes(p.studentId));
}

export function getGuardianSessions(
  guardian: Guardian,
  sessions: Session[]
): Session[] {
  return sessions.filter((s) => guardian.studentIds.includes(s.studentId));
}

export function buildGuardianDetail(
  guardianId: string,
  guardians: Guardian[],
  students: Student[],
  sessions: Session[],
  payments: Payment[],
  openingBalances: OpeningBalance[] = []
): GuardianDetail | null {
  const guardian = guardians.find((g) => g.id === guardianId);
  if (!guardian) return null;

  const guardianStudents = getGuardianStudents(guardian, students);
  const guardianPayments = [...getGuardianPayments(guardian, payments)].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const guardianSessions = [...getGuardianSessions(guardian, sessions)].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const totalBilled = guardianStudents.reduce(
    (sum, s) => sum + getStudentTotalBilled(s.id, sessions),
    0
  );
  const totalPaid = guardianStudents.reduce(
    (sum, s) => sum + getStudentTotalPaid(s.id, payments),
    0
  );
  const totalDebt = guardianStudents.reduce(
    (sum, s) => sum + getStudentDebt(s.id, sessions, payments, openingBalances),
    0
  );
  const lastPaymentDate = (guardianPayments[0] as Payment | undefined)?.date ?? null;

  return {
    id: guardian.id,
    tenantId: guardian.tenantId,
    fullName: guardian.fullName,
    phone: guardian.phone,
    email: guardian.email,
    relationship: guardian.relationship,
    students: guardianStudents,
    payments: guardianPayments,
    sessions: guardianSessions,
    totalBilled,
    totalPaid,
    totalDebt,
    lastPaymentDate,
  };
}

export function buildGuardianListItems(
  guardians: Guardian[],
  students: Student[],
  sessions: Session[],
  payments: Payment[],
  openingBalances: OpeningBalance[] = []
): GuardianListItem[] {
  return guardians.map((guardian) => {
    const guardianStudents = getGuardianStudents(guardian, students);
    const totalBilled = guardianStudents.reduce(
      (sum, s) => sum + getStudentTotalBilled(s.id, sessions),
      0
    );
    const totalPaid = guardianStudents.reduce(
      (sum, s) => sum + getStudentTotalPaid(s.id, payments),
      0
    );
    const totalDebt = guardianStudents.reduce(
      (sum, s) => sum + getStudentDebt(s.id, sessions, payments, openingBalances),
      0
    );
    return {
      id: guardian.id,
      tenantId: guardian.tenantId,
      fullName: guardian.fullName,
      phone: guardian.phone,
      email: guardian.email,
      relationship: guardian.relationship,
      studentIds: guardian.studentIds,
      studentNames: guardianStudents.map((s) => s.fullName),
      studentCount: guardianStudents.length,
      totalBilled,
      totalPaid,
      totalDebt,
    } satisfies GuardianListItem;
  });
}
