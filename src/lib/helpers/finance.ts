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
} from "@/types";

const BILLABLE_STATUSES: Session["status"][] = ["completed", "no_show", "makeup"];
export const EARNING_STATUSES: Session["status"][] = ["completed", "makeup"];

export function getStudentDebt(
  studentId: string,
  sessions: Session[],
  payments: Payment[]
): number {
  const charged = sessions
    .filter((s) => s.studentId === studentId && BILLABLE_STATUSES.includes(s.status))
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);

  const paid = payments
    .filter((p) => p.studentId === studentId)
    .reduce((sum, p) => sum + p.amount, 0);

  return Math.max(0, charged - paid);
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
        BILLABLE_STATUSES.includes(s.status)
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
  teachers: Teacher[]
): DashboardStats {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const activeStudents = students.filter((s) => s.status === "active").length;
  const activeTeachers = teachers.filter((t) => t.status === "active").length;

  const totalDebt = students.reduce(
    (sum, s) => sum + getStudentDebt(s.id, sessions, payments),
    0
  );

  // Teacher earnings are owed the moment a session is completed/salary is entitled —
  // never derived from whether the student/parent has paid. "Paid" comes from actual
  // TeacherPayment records, never from the TeacherEarning ledger.
  const pendingEarnings = teachers.reduce(
    (sum, t) => sum + getTeacherEarningTotals(t, sessions, teacherPayments).pendingEarning,
    0
  );

  return {
    activeStudents,
    activeTeachers,
    sessionsThisMonth: getMonthlySessionCount(sessions, year, month),
    revenueThisMonth: getMonthlyRevenue(sessions, year, month),
    collectedThisMonth: getMonthlyCollected(payments, year, month),
    pendingPayments: totalDebt,
    pendingEarnings,
  };
}

export function buildStudentSummaries(
  sessions: Session[],
  payments: Payment[],
  students: Student[]
): StudentSummary[] {
  return students.map((student) => ({
    ...student,
    totalDebt: getStudentDebt(student.id, sessions, payments),
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

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function formatDateTime(dateStr: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function formatTime(dateStr: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

/** "06.07.2026" — day.month.year, for report "Tarih" columns. Handles both full ISO
 *  datetime strings (Session.date) and date-only "YYYY-MM-DD" strings (Payment.date)
 *  safely, same as parseDateOnly, so the displayed day never shifts by timezone. */
export function formatDateDMY(dateStr: string): string {
  const d = dateStr.includes("T") ? new Date(dateStr) : parseDateOnly(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

// ─── Student-specific helpers ──────────────────────────────────────────────────

export function getStudentTotalBilled(studentId: string, sessions: Session[]): number {
  return sessions
    .filter((s) => s.studentId === studentId && BILLABLE_STATUSES.includes(s.status))
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
    (s) => s.studentId === studentId && BILLABLE_STATUSES.includes(s.status)
  );
  if (billableSessions.length === 0) return null;
  return billableSessions.reduce((latest, s) => (s.date > latest ? s.date : latest), billableSessions[0]!.date);
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
  payments: Payment[]
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
    const totalDebt = getStudentDebt(student.id, sessions, payments);

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

export function buildTeacherListItems(
  teachers: Teacher[],
  educationTypes: EducationType[],
  sessions: Session[],
  teacherPayments: TeacherPayment[]
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
  };
}

export function buildStudentDetail(
  studentId: string,
  students: Student[],
  guardians: Guardian[],
  educationTypes: EducationType[],
  teachers: Teacher[],
  sessions: Session[],
  payments: Payment[]
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
    totalDebt: getStudentDebt(studentId, sessions, payments),
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
  teacherPayments: TeacherPayment[]
): TeacherEarningTotals {
  const totalEarning = calculateTeacherTotalPayable(teacher, sessions);
  const paidEarning = getTeacherCashPaidTotal(teacher.id, teacherPayments);
  const deductedEarning = getTeacherDeductionTotal(teacher.id, teacherPayments);
  const pendingEarning = Math.max(0, totalEarning - paidEarning - deductedEarning);
  return { teacherId: teacher.id, totalEarning, paidEarning, deductedEarning, pendingEarning };
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
  month: number
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
  return { teacherId: teacher.id, totalEarning, paidEarning, deductedEarning, pendingEarning };
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
  month: number
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

  const totalPending = getTeacherEarningTotals(teacher, sessions, teacherPayments).pendingEarning;

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
  endDate: string | null
): TeacherEarningTotals {
  if (!startDate && !endDate) {
    return getTeacherEarningTotals(teacher, sessions, teacherPayments);
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

  return {
    teacherId: teacher.id,
    totalEarning,
    paidEarning,
    deductedEarning,
    pendingEarning: Math.max(0, totalEarning - paidEarning - deductedEarning),
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
  educationTypes: EducationType[]
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
    bank_transfer: "Banka Havalesi",
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
  sessions: Session[]
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
      const remainingDebt = getStudentDebt(payment.studentId, sessions, payments);

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
  payments: Payment[]
): StudentDebtItem[] {
  return students
    .map((student) => {
      const primaryGuardian =
        guardians.find((g) => student.guardianIds.includes(g.id)) ?? null;
      const totalBilled = getStudentTotalBilled(student.id, sessions);
      const totalPaid = getStudentTotalPaid(student.id, payments);
      const remainingDebt = getStudentDebt(student.id, sessions, payments);

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
      } satisfies StudentDebtItem;
    })
    // Any student with financial activity — billed OR paid. A guardian can pay in
    // advance before any session is billed, and that collection must still show up
    // here (this is the one place Dashboard/Payments/Income Report all read from).
    .filter((item) => item.totalBilled > 0 || item.totalPaid > 0)
    .sort((a, b) => b.remainingDebt - a.remainingDebt);
}

export function buildPaymentPageStats(
  payments: Payment[],
  sessions: Session[],
  students: Student[],
  year: number,
  month: number
): PaymentPageStats {
  const inMonth = payments.filter((p) => {
    const d = new Date(p.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const totalBilled = sessions
    .filter((s) => BILLABLE_STATUSES.includes(s.status))
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);

  const totalRemaining = students.reduce(
    (sum, s) => sum + getStudentDebt(s.id, sessions, payments),
    0
  );

  const studentsWithDebt = students.filter(
    (s) => getStudentDebt(s.id, sessions, payments) > 0
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
  educationTypes: EducationType[]
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
        paidAt: earning.paidAt,
        createdAt: earning.createdAt,
      } satisfies TeacherEarningListItem;
    });
}

export function buildTeacherEarningOverviewItems(
  teachers: Teacher[],
  sessions: Session[],
  teacherPayments: TeacherPayment[]
): TeacherEarningOverviewItem[] {
  return teachers
    .map((teacher) => {
      const totals = getTeacherEarningTotals(teacher, sessions, teacherPayments);
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
      } satisfies TeacherEarningOverviewItem;
    })
    .filter((item) => item.totalEarning > 0)
    .sort((a, b) => b.totalEarning - a.totalEarning);
}

export function buildTeacherEarningPageStats(
  teachers: Teacher[],
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  year: number,
  month: number
): TeacherEarningPageStats {
  // "Bu Ay" = what's owed for sessions/salary entitlement in this specific month —
  // independent of whether it has been billed/paid to the student yet.
  const thisMonthTotal = teachers.reduce(
    (sum, t) => sum + calculateTeacherMonthlyPayable(t, sessions, year, month),
    0
  );

  const allTotals = teachers.map((t) => getTeacherEarningTotals(t, sessions, teacherPayments));

  return {
    thisMonthTotal,
    paidTotal: allTotals.reduce((sum, t) => sum + t.paidEarning, 0),
    pendingTotal: allTotals.reduce((sum, t) => sum + t.pendingEarning, 0),
    teachersWithEarnings: allTotals.filter((t) => t.totalEarning > 0).length,
  };
}

export function buildMonthlyTeacherEarningSummary(
  teachers: Teacher[],
  sessions: Session[],
  teacherPayments: TeacherPayment[],
  year: number,
  month: number
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

      const { totalEarning, paidEarning, pendingEarning } = getTeacherMonthEarningTotals(
        teacher,
        sessions,
        teacherPayments,
        year,
        month
      );

      const summary: MonthlyTeacherEarningSummary = {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        earningType: teacher.earningType,
        sessionCount,
        totalEarning,
        paidEarning,
        pendingEarning,
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
  endDate: string | null
): TeacherReportRow[] {
  return teachers
    .map((teacher) => {
      const teacherSessions = filteredSessions.filter((s) => s.teacherId === teacher.id);
      const uniqueStudentCount = new Set(teacherSessions.map((s) => s.studentId)).size;
      const { totalEarning, paidEarning, pendingEarning } = getTeacherEarningTotalsForRange(
        teacher,
        allSessions,
        teacherPayments,
        startDate,
        endDate
      );

      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        totalSessions: teacherSessions.length,
        completedSessions: teacherSessions.filter((s) =>
          EARNING_STATUSES.includes(s.status)
        ).length,
        totalEarning,
        paidEarning,
        pendingEarning,
        uniqueStudentCount,
        status: teacher.status,
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
  payments: Payment[]
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
    (sum, s) => sum + getStudentDebt(s.id, sessions, payments),
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
  payments: Payment[]
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
      (sum, s) => sum + getStudentDebt(s.id, sessions, payments),
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
