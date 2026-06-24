import type {
  Session,
  Payment,
  TeacherEarning,
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
  GeneralReportStats,
  StudentReportRow,
  TeacherReportRow,
  EducationTypeReportRow,
  FinanceReportStats,
  GuardianListItem,
  GuardianDetail,
  Student,
  Guardian,
  Teacher,
  EducationType,
} from "@/types";
import { mockStudents } from "@/lib/mock/students";
import { mockTeachers } from "@/lib/mock/teachers";

const BILLABLE_STATUSES: Session["status"][] = ["completed", "no_show", "makeup"];
const EARNING_STATUSES: Session["status"][] = ["completed", "makeup"];

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

export function getTeacherTotalEarnings(teacherId: string, earnings: TeacherEarning[]): number {
  return earnings
    .filter((e) => e.teacherId === teacherId)
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getTeacherPendingEarnings(teacherId: string, earnings: TeacherEarning[]): number {
  return earnings
    .filter((e) => e.teacherId === teacherId && e.status === "pending")
    .reduce((sum, e) => sum + e.amount, 0);
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

export function buildDashboardStats(
  sessions: Session[],
  payments: Payment[],
  earnings: TeacherEarning[]
): DashboardStats {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const activeStudents = mockStudents.filter((s) => s.status === "active").length;
  const activeTeachers = mockTeachers.filter((t) => t.status === "active").length;

  const totalDebt = mockStudents.reduce(
    (sum, s) => sum + getStudentDebt(s.id, sessions, payments),
    0
  );

  const pendingEarnings = earnings
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    activeStudents,
    activeTeachers,
    sessionsThisMonth: getMonthlySessionCount(sessions, year, month),
    revenueThisMonth: getMonthlyRevenue(sessions, year, month),
    pendingPayments: totalDebt,
    pendingEarnings,
  };
}

export function buildStudentSummaries(
  sessions: Session[],
  payments: Payment[]
): StudentSummary[] {
  return mockStudents.map((student) => ({
    ...student,
    totalDebt: getStudentDebt(student.id, sessions, payments),
    totalPaid: getStudentTotalPaid(student.id, payments),
    completedSessions: getStudentCompletedSessions(student.id, sessions),
  }));
}

export function buildTeacherSummaries(
  sessions: Session[],
  earnings: TeacherEarning[]
): TeacherSummary[] {
  return mockTeachers.map((teacher) => ({
    ...teacher,
    totalEarnings: getTeacherTotalEarnings(teacher.id, earnings),
    pendingEarnings: getTeacherPendingEarnings(teacher.id, earnings),
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

// ─── Student-specific helpers ──────────────────────────────────────────────────

export function getStudentTotalBilled(studentId: string, sessions: Session[]): number {
  return sessions
    .filter((s) => s.studentId === studentId && BILLABLE_STATUSES.includes(s.status))
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);
}

export function getStudentSessionCount(studentId: string, sessions: Session[]): number {
  return sessions.filter((s) => s.studentId === studentId).length;
}

export function getStudentSessions(studentId: string, sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.studentId === studentId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
  teacherId: string,
  sessions: Session[],
  year: number,
  month: number
): number {
  return sessions
    .filter((s) => {
      const d = new Date(s.date);
      return (
        s.teacherId === teacherId &&
        d.getFullYear() === year &&
        d.getMonth() + 1 === month &&
        EARNING_STATUSES.includes(s.status)
      );
    })
    .reduce((sum, s) => sum + s.teacherEarning * s.sessionCount, 0);
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
  teacherId: string,
  educationTypes: EducationType[],
  customPrices: TeacherCustomPrice[]
): TeacherPriceRow[] {
  return educationTypes.map((et) => {
    const custom = customPrices.find(
      (cp) => cp.teacherId === teacherId && cp.educationTypeId === et.id
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
  earnings: TeacherEarning[]
): TeacherListItem[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return teachers.map((teacher) => {
    const specializationNames = educationTypes
      .filter((et) => teacher.specializations.includes(et.id))
      .map((et) => et.name);

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
      monthlyEarnings: getTeacherMonthlyEarnings(teacher.id, sessions, year, month),
      pendingEarnings: getTeacherPendingEarnings(teacher.id, earnings),
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
  customPrices: TeacherCustomPrice[]
): TeacherDetail | null {
  const teacher = teachers.find((t) => t.id === teacherId);
  if (!teacher) return null;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const specializationNames = educationTypes
    .filter((et) => teacher.specializations.includes(et.id))
    .map((et) => et.name);
  const teacherSessions = getTeacherSessions(teacherId, sessions);
  const teacherEarnings = getTeacherEarnings(teacherId, earnings);
  const studentRows = getTeacherStudentRows(
    teacherId,
    sessions,
    students,
    guardians,
    educationTypes
  );
  const priceRows = getTeacherPriceRows(teacherId, educationTypes, customPrices);

  return {
    ...teacher,
    specializationNames,
    sessions: teacherSessions,
    studentRows,
    earnings: teacherEarnings,
    priceRows,
    totalSessions: teacherSessions.length,
    completedSessions: getTeacherCompletedSessions(teacherId, sessions),
    monthlyEarnings: getTeacherMonthlyEarnings(teacherId, sessions, year, month),
    pendingEarnings: getTeacherPendingEarnings(teacherId, earnings),
    totalEarnings: getTeacherTotalEarnings(teacherId, earnings),
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

export function getDefaultTeacherEarningPrice(
  educationTypeId: string,
  educationTypes: EducationType[]
): number {
  return (
    educationTypes.find((et) => et.id === educationTypeId)?.defaultTeacherEarning ?? 0
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
      } satisfies StudentDebtItem;
    })
    .filter((item) => item.totalBilled > 0)
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
  earnings: TeacherEarning[],
  teachers: Teacher[]
): TeacherEarningOverviewItem[] {
  const byTeacher = new Map<
    string,
    { paid: number; pending: number; count: number }
  >();

  earnings.forEach((e) => {
    const prev = byTeacher.get(e.teacherId) ?? { paid: 0, pending: 0, count: 0 };
    byTeacher.set(e.teacherId, {
      paid: prev.paid + (e.status === "paid" ? e.amount : 0),
      pending: prev.pending + (e.status === "pending" ? e.amount : 0),
      count: prev.count + 1,
    });
  });

  return [...byTeacher.entries()]
    .map(([teacherId, data]) => {
      const teacher = teachers.find((t) => t.id === teacherId);
      return {
        teacherId,
        teacherName: teacher?.fullName ?? "—",
        totalEarning: data.paid + data.pending,
        paidEarning: data.paid,
        pendingEarning: data.pending,
        earningCount: data.count,
      } satisfies TeacherEarningOverviewItem;
    })
    .sort((a, b) => b.totalEarning - a.totalEarning);
}

export function buildTeacherEarningPageStats(
  earnings: TeacherEarning[],
  sessions: Session[],
  year: number,
  month: number
): TeacherEarningPageStats {
  // "Bu Ay" = earnings whose linked session falls in this month
  const inMonth = earnings.filter((e) => {
    const session = sessions.find((s) => s.id === e.sessionId);
    if (!session) return false;
    const d = new Date(session.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  return {
    thisMonthTotal: inMonth.reduce((sum, e) => sum + e.amount, 0),
    paidTotal: earnings
      .filter((e) => e.status === "paid")
      .reduce((sum, e) => sum + e.amount, 0),
    pendingTotal: earnings
      .filter((e) => e.status === "pending")
      .reduce((sum, e) => sum + e.amount, 0),
    teachersWithEarnings: new Set(earnings.map((e) => e.teacherId)).size,
  };
}

export function buildMonthlyTeacherEarningSummary(
  earnings: TeacherEarning[],
  sessions: Session[],
  teachers: Teacher[],
  year: number,
  month: number
): MonthlyTeacherEarningSummary[] {
  // Filter earnings whose session falls in the requested month
  const monthEarnings = earnings.filter((e) => {
    const session = sessions.find((s) => s.id === e.sessionId);
    if (!session) return false;
    const d = new Date(session.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });

  const byTeacher = new Map<
    string,
    { paid: number; pending: number; sessions: number }
  >();

  monthEarnings.forEach((e) => {
    const session = sessions.find((s) => s.id === e.sessionId);
    const prev = byTeacher.get(e.teacherId) ?? { paid: 0, pending: 0, sessions: 0 };
    byTeacher.set(e.teacherId, {
      paid: prev.paid + (e.status === "paid" ? e.amount : 0),
      pending: prev.pending + (e.status === "pending" ? e.amount : 0),
      sessions: prev.sessions + (session?.sessionCount ?? 1),
    });
  });

  return [...byTeacher.entries()]
    .map(([teacherId, data]) => {
      const teacher = teachers.find((t) => t.id === teacherId);
      return {
        teacherId,
        teacherName: teacher?.fullName ?? "—",
        sessionCount: data.sessions,
        totalEarning: data.paid + data.pending,
        paidEarning: data.paid,
        pendingEarning: data.pending,
      } satisfies MonthlyTeacherEarningSummary;
    })
    .sort((a, b) => b.totalEarning - a.totalEarning);
}

// ─── Report helpers ────────────────────────────────────────────────────────────

export function filterSessionsByMonth(
  sessions: Session[],
  year: number | null,
  month: number | null
): Session[] {
  if (year === null || month === null) return sessions;
  return sessions.filter((s) => {
    const d = new Date(s.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

export function filterPaymentsByMonth(
  payments: Payment[],
  year: number | null,
  month: number | null
): Payment[] {
  if (year === null || month === null) return payments;
  return payments.filter((p) => {
    const d = new Date(p.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

export function filterEarningsByMonth(
  earnings: TeacherEarning[],
  sessions: Session[],
  year: number | null,
  month: number | null
): TeacherEarning[] {
  if (year === null || month === null) return earnings;
  return earnings.filter((e) => {
    const session = sessions.find((s) => s.id === e.sessionId);
    if (!session) return false;
    const d = new Date(session.date);
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

export function buildGeneralReportStats(
  filteredSessions: Session[],
  filteredPayments: Payment[],
  filteredEarnings: TeacherEarning[],
  allSessions: Session[],
  allPayments: Payment[],
  students: Student[]
): GeneralReportStats {
  const billable = filteredSessions.filter((s) => BILLABLE_STATUSES.includes(s.status));
  const earning = filteredSessions.filter((s) => EARNING_STATUSES.includes(s.status));

  const totalBilled = billable.reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);
  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalTeacherEarnings = earning.reduce(
    (sum, s) => sum + s.teacherEarning * s.sessionCount,
    0
  );
  const totalRemaining = students.reduce(
    (sum, s) => sum + getStudentDebt(s.id, allSessions, allPayments),
    0
  );

  return {
    totalStudents: students.length,
    activeStudents: students.filter((s) => s.status === "active").length,
    totalSessions: filteredSessions.length,
    completedSessions: filteredSessions.filter((s) => s.status === "completed").length,
    totalBilled,
    totalCollected,
    totalRemaining,
    totalTeacherEarnings,
    centerProfit: totalBilled - totalTeacherEarnings,
  };
}

export function buildStudentReportRows(
  students: Student[],
  guardians: Guardian[],
  filteredSessions: Session[],
  filteredPayments: Payment[],
  allSessions: Session[],
  allPayments: Payment[]
): StudentReportRow[] {
  return students
    .map((student) => {
      const guardian = guardians.find((g) => student.guardianIds.includes(g.id)) ?? null;
      const studentSessions = filteredSessions.filter((s) => s.studentId === student.id);
      const studentPayments = filteredPayments.filter((p) => p.studentId === student.id);

      const totalBilled = studentSessions
        .filter((s) => BILLABLE_STATUSES.includes(s.status))
        .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);
      const totalCollected = studentPayments.reduce((sum, p) => sum + p.amount, 0);
      const remainingDebt = getStudentDebt(student.id, allSessions, allPayments);

      const sortedDates = studentSessions
        .map((s) => s.date)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      return {
        studentId: student.id,
        studentName: student.fullName,
        guardianId: guardian?.id ?? null,
        guardianName: guardian?.fullName ?? null,
        totalSessions: studentSessions.length,
        completedSessions: studentSessions.filter((s) => s.status === "completed").length,
        totalBilled,
        totalCollected,
        remainingDebt,
        lastSessionDate: (sortedDates[0] as string | undefined) ?? null,
        status: student.status,
      } satisfies StudentReportRow;
    })
    .sort((a, b) => b.totalBilled - a.totalBilled);
}

export function buildTeacherReportRows(
  teachers: Teacher[],
  filteredSessions: Session[],
  filteredEarnings: TeacherEarning[]
): TeacherReportRow[] {
  return teachers
    .map((teacher) => {
      const teacherSessions = filteredSessions.filter((s) => s.teacherId === teacher.id);
      const teacherEarnings = filteredEarnings.filter((e) => e.teacherId === teacher.id);

      const paidEarning = teacherEarnings
        .filter((e) => e.status === "paid")
        .reduce((sum, e) => sum + e.amount, 0);
      const pendingEarning = teacherEarnings
        .filter((e) => e.status === "pending")
        .reduce((sum, e) => sum + e.amount, 0);
      const uniqueStudentCount = new Set(teacherSessions.map((s) => s.studentId)).size;

      return {
        teacherId: teacher.id,
        teacherName: teacher.fullName,
        totalSessions: teacherSessions.length,
        completedSessions: teacherSessions.filter((s) =>
          EARNING_STATUSES.includes(s.status)
        ).length,
        totalEarning: paidEarning + pendingEarning,
        paidEarning,
        pendingEarning,
        uniqueStudentCount,
        status: teacher.status,
      } satisfies TeacherReportRow;
    })
    .sort((a, b) => b.totalEarning - a.totalEarning);
}

export function buildEducationTypeReportRows(
  educationTypes: EducationType[],
  filteredSessions: Session[],
  students: Student[]
): EducationTypeReportRow[] {
  return educationTypes
    .map((et) => {
      const etSessions = filteredSessions.filter((s) => s.educationTypeId === et.id);
      const billable = etSessions.filter((s) => BILLABLE_STATUSES.includes(s.status));
      const earning = etSessions.filter((s) => EARNING_STATUSES.includes(s.status));

      const totalRevenue = billable.reduce(
        (sum, s) => sum + s.studentPrice * s.sessionCount,
        0
      );
      const teacherEarningsAmt = earning.reduce(
        (sum, s) => sum + s.teacherEarning * s.sessionCount,
        0
      );
      const uniqueStudentIds = new Set(etSessions.map((s) => s.studentId));
      const activeStudentCount = [...uniqueStudentIds].filter((id) => {
        const student = students.find((s) => s.id === id);
        return student?.status === "active";
      }).length;

      return {
        educationTypeId: et.id,
        educationTypeName: et.name,
        totalSessions: etSessions.length,
        completedSessions: etSessions.filter((s) => s.status === "completed").length,
        totalRevenue,
        teacherEarnings: teacherEarningsAmt,
        centerProfit: totalRevenue - teacherEarningsAmt,
        activeStudentCount,
      } satisfies EducationTypeReportRow;
    })
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export function buildFinanceReportStats(
  filteredSessions: Session[],
  filteredPayments: Payment[],
  filteredEarnings: TeacherEarning[],
  allSessions: Session[],
  allPayments: Payment[],
  students: Student[]
): FinanceReportStats {
  const totalBilled = filteredSessions
    .filter((s) => BILLABLE_STATUSES.includes(s.status))
    .reduce((sum, s) => sum + s.studentPrice * s.sessionCount, 0);

  const totalCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  const remainingReceivable = students.reduce(
    (sum, s) => sum + getStudentDebt(s.id, allSessions, allPayments),
    0
  );

  const totalTeacherEarnings = filteredEarnings.reduce((sum, e) => sum + e.amount, 0);
  const paidTeacherEarnings = filteredEarnings
    .filter((e) => e.status === "paid")
    .reduce((sum, e) => sum + e.amount, 0);
  const pendingTeacherEarnings = filteredEarnings
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + e.amount, 0);

  return {
    totalBilled,
    totalCollected,
    remainingReceivable,
    totalTeacherEarnings,
    paidTeacherEarnings,
    pendingTeacherEarnings,
    centerGrossProfit: totalBilled - totalTeacherEarnings,
  };
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
