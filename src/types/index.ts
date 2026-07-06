// ─── Tenant ───────────────────────────────────────────────────────────────────
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

// ─── User / Auth ───────────────────────────────────────────────────────────────
export type UserRole = "super_admin" | "institution_admin" | "teacher" | "guardian";

export interface User {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: string;
}

// ─── Education Type ────────────────────────────────────────────────────────────
export interface EducationType {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  defaultStudentPrice: number;
  defaultTeacherEarning: number;
  createdAt: string;
}

// ─── Student ───────────────────────────────────────────────────────────────────
export type StudentStatus = "active" | "inactive" | "on_hold";

export interface Student {
  id: string;
  tenantId: string;
  fullName: string;
  birthDate: string;
  status: StudentStatus;
  guardianIds: string[];
  educationTypeIds: string[];
  weeklySessionCount?: number;
  assignedTeacherIds?: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Guardian ──────────────────────────────────────────────────────────────────
export interface Guardian {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  relationship: string;
  studentIds: string[];
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Teacher ───────────────────────────────────────────────────────────────────
export type TeacherStatus = "active" | "inactive";
export type TeacherEarningType =
  | "per_session"
  | "monthly_salary"
  | "salary_plus_quota"
  | "percentage";

export interface Teacher {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  status: TeacherStatus;
  specializations: string[];
  earningType?: TeacherEarningType;
  monthlySalary?: number;
  /** For salary_plus_quota: monthly sessions included in the base salary. */
  includedSessionQuota?: number;
  /** For salary_plus_quota: extra earning per session above the quota. */
  extraSessionEarning?: number;
  earningPercentage?: number;
  customBranch?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Session ───────────────────────────────────────────────────────────────────
export type SessionStatus =
  | "planned"
  | "completed"
  | "cancelled"
  | "no_show"
  | "makeup";

export interface Session {
  id: string;
  tenantId: string;
  studentId: string;
  teacherId: string;
  educationTypeId: string;
  date: string;
  durationMinutes: number;
  sessionCount: number;
  studentPrice: number;
  teacherEarning: number;
  status: SessionStatus;
  notes?: string;
  createdAt: string;
  recurringGroupId?: string;
  weeklyPlanId?: string;
}

// ─── Weekly Session Plan ───────────────────────────────────────────────────────

export interface WeeklyScheduleSlot {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday … 6 = Saturday
  time: string;      // "HH:MM"
}

export interface WeeklySessionPlan {
  id: string;
  tenantId: string;
  studentId: string;
  teacherId: string;
  educationTypeId: string;
  studentPrice: number;
  teacherEarning: number;
  startDate: string;  // "YYYY-MM-DD"
  endDate: string;    // "YYYY-MM-DD"
  weeklySchedule: WeeklyScheduleSlot[];
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

// ─── Payment ───────────────────────────────────────────────────────────────────
export type PaymentMethod = "cash" | "bank_transfer" | "credit_card" | "other";
export type InstallmentStatus = "paid" | "pending" | "overdue" | "cancelled";
export type InstallmentInterval = "monthly" | "weekly" | "custom";

export type PaymentSource = "manual" | "installment";

export interface Payment {
  id: string;
  tenantId: string;
  studentId: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  paymentSource?: PaymentSource;
  installmentPlanId?: string;
  installmentNumber?: number;
  notes?: string;
  createdAt: string;
}

// ─── Installment Plan ─────────────────────────────────────────────────────────

export interface InstallmentRecord {
  id: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  /** Stored as "pending" | "paid" | "cancelled"; "overdue" is computed display-only */
  status: Exclude<InstallmentStatus, "overdue">;
  paidDate?: string;
}

export interface InstallmentPlan {
  id: string;
  tenantId: string;
  studentId: string;
  totalAmount: number;
  installmentCount: number;
  firstDueDate: string;
  interval: InstallmentInterval;
  customIntervalDays?: number;
  method: PaymentMethod;
  notes?: string;
  installments: InstallmentRecord[];
  createdAt: string;
}

export interface StudentInstallmentSummary {
  activePlanCount: number;
  totalPlanned: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
  overdueCount: number;
}

export interface InstallmentRow {
  planId: string;
  studentId: string;
  studentName: string;
  guardianId: string | null;
  guardianName: string | null;
  installmentId: string;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
  totalPlanAmount: number;
  displayStatus: InstallmentStatus;
  storedStatus: Exclude<InstallmentStatus, "overdue">;
  paidDate?: string;
  method: PaymentMethod;
  methodLabel: string;
  interval: InstallmentInterval;
  notes?: string;
}

// ─── Teacher Custom Price ──────────────────────────────────────────────────────
export interface TeacherCustomPrice {
  id: string;
  tenantId: string;
  teacherId: string;
  educationTypeId: string;
  customEarning: number;
  createdAt: string;
}

// ─── Teacher Earning ───────────────────────────────────────────────────────────
export type EarningStatus = "pending" | "paid";

export interface TeacherEarning {
  id: string;
  tenantId: string;
  teacherId: string;
  sessionId: string;
  amount: number;
  status: EarningStatus;
  paidAt?: string;
  createdAt: string;
}

// ─── Teacher Payment ────────────────────────────────────────────────────────────
export type TeacherPaymentType =
  | "salary"
  | "advance"
  | "partial"
  | "bonus"
  | "deduction"
  | "other";

// Records an actual payment made to a teacher, independent of student/guardian
// payments. This is the source of truth for how much of a teacher's earnings
// have been paid — never the TeacherEarning ledger above.
export interface TeacherPayment {
  id: string;
  tenantId: string;
  teacherId: string;
  amount: number;
  method: PaymentMethod;
  paymentType: TeacherPaymentType;
  date: string;
  description?: string;
  createdAt: string;
}

// ─── Derived / UI Models ───────────────────────────────────────────────────────
export interface StudentSummary extends Student {
  totalDebt: number;
  totalPaid: number;
  completedSessions: number;
}

export interface StudentListItem {
  id: string;
  tenantId: string;
  fullName: string;
  birthDate: string;
  status: StudentStatus;
  notes?: string;
  createdAt: string;
  primaryGuardian: Guardian | null;
  educationTypeNames: string[];
  assignedTeacherNames: string[];
  totalSessions: number;
  totalBilled: number;
  totalPaid: number;
  totalDebt: number;
}

export interface StudentDetail extends Student {
  primaryGuardian: Guardian | null;
  allGuardians: Guardian[];
  educationTypeNames: string[];
  assignedTeachers: Teacher[];
  sessions: Session[];
  payments: Payment[];
  totalSessions: number;
  totalBilled: number;
  totalPaid: number;
  totalDebt: number;
}

export interface TeacherSummary extends Teacher {
  totalEarnings: number;
  pendingEarnings: number;
  completedSessions: number;
}

export interface TeacherStudentRow {
  studentId: string;
  studentName: string;
  primaryGuardianId: string | null;
  primaryGuardianName: string | null;
  primaryGuardianPhone: string | null;
  educationTypeNames: string[];
  totalSessions: number;
  lastSessionDate: string | null;
}

export interface TeacherPriceRow {
  educationTypeId: string;
  educationTypeName: string;
  description?: string;
  defaultEarning: number;
  customEarning: number | null;
  isCustom: boolean;
}

export interface TeacherListItem {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  status: TeacherStatus;
  specializationNames: string[];
  createdAt: string;
  totalSessions: number;
  completedSessions: number;
  monthlyEarnings: number;
  pendingEarnings: number;
}

export interface TeacherDetail extends Teacher {
  specializationNames: string[];
  sessions: Session[];
  studentRows: TeacherStudentRow[];
  earnings: TeacherEarning[];
  priceRows: TeacherPriceRow[];
  totalSessions: number;
  completedSessions: number;
  monthlyEarnings: number;
  pendingEarnings: number;
  totalEarnings: number;
}

export interface DashboardStats {
  activeStudents: number;
  activeTeachers: number;
  sessionsThisMonth: number;
  /** Ciro — this month's accrual from completed/no_show/makeup sessions. Never cash. */
  revenueThisMonth: number;
  /** Tahsilat — this month's actual guardian payments received. Never accrual. */
  collectedThisMonth: number;
  pendingPayments: number;
  pendingEarnings: number;
}

/** Informational only — planned sessions are not billed until completed/no_show/makeup. */
export interface PlannedSessionsSummary {
  count: number;
  totalValue: number;
}

export interface SessionListItem {
  id: string;
  tenantId: string;
  date: string;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  educationTypeId: string;
  educationTypeName: string;
  sessionCount: number;
  studentPrice: number;
  totalAmount: number;
  teacherEarningUnit: number;
  totalTeacherEarning: number;
  centerProfit: number;
  status: SessionStatus;
  notes?: string;
  durationMinutes: number;
}

export interface SessionPageStats {
  total: number;
  completed: number;
  planned: number;
  cancelledAndNoShow: number;
  makeup: number;
}

// ─── Payment / Debt models ─────────────────────────────────────────────────────

export type DebtStatus = "paid" | "partial" | "unpaid";

export interface PaymentListItem {
  id: string;
  tenantId: string;
  date: string;
  studentId: string;
  studentName: string;
  guardianId: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  method: PaymentMethod;
  methodLabel: string;
  amount: number;
  totalBilled: number;
  totalPaid: number;
  remainingDebt: number;
  debtStatus: DebtStatus;
  notes?: string;
  paymentSource?: PaymentSource;
  installmentPlanId?: string;
  installmentNumber?: number;
}

export interface StudentDebtItem {
  studentId: string;
  studentName: string;
  guardianId: string | null;
  guardianName: string | null;
  totalBilled: number;
  totalPaid: number;
  remainingDebt: number;
  debtStatus: DebtStatus;
  /** Latest payment date, or latest billed session date if no payment exists. Display only. */
  lastActivityDate: string | null;
}

/** Month-scoped account row for a student — Önceki Devir / Bu Ay Tahakkuk / Bu Ay
 *  Tahsilat / Güncel Bakiye, mirroring StudentCurrentAccount but enriched for report tables. */
export interface StudentMonthlyAccountRow {
  studentId: string;
  studentName: string;
  guardianId: string | null;
  guardianName: string | null;
  previousBalance: number;
  currentMonthBilled: number;
  currentMonthPaid: number;
  currentBalance: number;
  /** Latest payment date, or latest billed session date if no payment exists. Display only. */
  lastActivityDate: string | null;
}

export interface PaymentPageStats {
  collectedThisMonth: number;
  totalBilled: number;
  totalCollected: number;
  totalRemaining: number;
  studentsWithDebt: number;
}

// ─── Teacher Earning UI models ─────────────────────────────────────────────────

export interface TeacherEarningListItem {
  id: string;
  tenantId: string;
  teacherId: string;
  teacherName: string;
  sessionId: string;
  sessionDate: string;
  studentId: string;
  studentName: string;
  educationTypeId: string;
  educationTypeName: string;
  sessionCount: number;
  unitEarning: number;
  totalEarning: number;
  status: EarningStatus;
  paidAt?: string;
  createdAt: string;
}

export interface TeacherEarningOverviewItem {
  teacherId: string;
  teacherName: string;
  totalEarning: number;
  paidEarning: number;
  pendingEarning: number;
  earningCount: number;
}

export interface TeacherEarningPageStats {
  thisMonthTotal: number;
  paidTotal: number;
  pendingTotal: number;
  teachersWithEarnings: number;
}

export interface MonthlyTeacherEarningSummary {
  teacherId: string;
  teacherName: string;
  earningType?: TeacherEarningType;
  sessionCount: number;
  totalEarning: number;
  paidEarning: number;
  pendingEarning: number;
  /** salary_plus_quota breakdown */
  salaryComponent?: number;
  includedQuota?: number;
  quotaUsed?: number;
  extraSessions?: number;
  extraEarning?: number;
}

// ─── Report models ─────────────────────────────────────────────────────────────

export interface TeacherReportRow {
  teacherId: string;
  teacherName: string;
  totalSessions: number;
  completedSessions: number;
  totalEarning: number;
  paidEarning: number;
  pendingEarning: number;
  uniqueStudentCount: number;
  status: TeacherStatus;
}

export interface TeacherPaymentReportRow {
  id: string;
  teacherId: string;
  teacherName: string;
  paymentType: TeacherPaymentType;
  paymentTypeLabel: string;
  amount: number;
  method: PaymentMethod;
  methodLabel: string;
  date: string;
  description?: string;
}

/**
 * Month-scoped account summary for a teacher — the teacher-side equivalent of
 * StudentCurrentAccount. Mirrors the same previous-balance/this-month/current-balance
 * shape so both sides of the ledger read the same way.
 */
export interface TeacherMonthAccountSummary {
  teacherId: string;
  teacherName: string;
  year: number;
  month: number;
  /** Unpaid teacher earnings from every month before the selected one. */
  previousBalance: number;
  /** Hakediş generated in the selected month only (calculateTeacherMonthlyPayable). */
  thisMonthEarning: number;
  /** Cash/bank payments dated within the selected month (never Kesinti). */
  thisMonthPaid: number;
  /** Kesinti dated within the selected month. */
  thisMonthDeducted: number;
  /** previousBalance + thisMonthEarning − thisMonthPaid − thisMonthDeducted, clamped ≥ 0. */
  currentBalance: number;
  /** All-time pending across every month — same figure as getTeacherEarningTotals. */
  totalPending: number;
}

export interface SessionStatusBreakdown {
  total: number;
  completed: number;
  planned: number;
  cancelled: number;
  noShow: number;
  makeup: number;
}

export interface StudentAttendanceRow extends SessionStatusBreakdown {
  studentId: string;
  studentName: string;
}

export interface TeacherSessionCountRow extends SessionStatusBreakdown {
  teacherId: string;
  teacherName: string;
}

// ─── Cari Hesap (Current Account) ─────────────────────────────────────────────

export interface StudentCurrentAccount {
  year: number;
  month: number;
  previousBalance: number;
  currentMonthBilled: number;
  currentMonthPaid: number;
  currentBalance: number;
  totalBilled: number;
  totalPaid: number;
  remainingDebt: number;
}

// ─── Cash Register ─────────────────────────────────────────────────────────────

export type CashMovementType = "income" | "expense";

export type CashCategory =
  | "guardian_payment"
  | "loan_received"
  | "rent"
  | "salary"
  | "grocery"
  | "stationery"
  | "utility"
  | "other";

export interface CashMovement {
  id: string;
  tenantId: string;
  date: string;
  type: CashMovementType;
  category: CashCategory;
  amount: number;
  method: PaymentMethod;
  description?: string;
  studentId?: string;
  paymentId?: string;
  createdAt: string;
}

export interface CashMovementRow {
  id: string;
  date: string;
  type: CashMovementType;
  typeLabel: string;
  category: CashCategory;
  categoryLabel: string;
  amount: number;
  method: PaymentMethod;
  methodLabel: string;
  description?: string;
  studentId?: string;
  studentName?: string;
  paymentId?: string;
  teacherId?: string;
  teacherName?: string;
  teacherPaymentId?: string;
  /** Human-readable payment type (Maaş / Avans / …) — only set for teacher_payment rows. */
  teacherPaymentTypeLabel?: string;
  source: "manual" | "payment" | "teacher_payment";
  isEditable: boolean;
}

export interface DailyCashSummary {
  date: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  netMovement: number;
  closingBalance: number;
  movementCount: number;
}

// ─── Guardian / Veli UI models ────────────────────────────────────────────────

export interface GuardianListItem {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  relationship: string;
  studentIds: string[];
  studentNames: string[];
  studentCount: number;
  totalBilled: number;
  totalPaid: number;
  totalDebt: number;
}

export interface GuardianDetail {
  id: string;
  tenantId: string;
  fullName: string;
  phone: string;
  email?: string;
  relationship: string;
  students: Student[];
  payments: Payment[];
  sessions: Session[];
  totalBilled: number;
  totalPaid: number;
  totalDebt: number;
  lastPaymentDate: string | null;
}

// ─── Excel Import ──────────────────────────────────────────────────────────────

export type ImportType = "students" | "sessions" | "payments" | "teacher-earnings";
export type ImportRowStatus = "valid" | "warning" | "error";

export interface ImportSystemField {
  key: string;
  label: string;
  required: boolean;
}

export interface ImportColumnMapping {
  excelColumn: string;
  systemField: string | null;
  sampleData: string;
}

export interface ImportEntityMatch {
  entityType: "Öğrenci" | "Öğretmen" | "Eğitim Türü" | "Veli";
  value: string;
  matched: boolean;
}

export interface ImportPreviewRow {
  rowNumber: number;
  displayText: string;
  status: ImportRowStatus;
  issues: string[];
  entityMatches: ImportEntityMatch[];
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
}
