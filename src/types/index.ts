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
}

// ─── Teacher ───────────────────────────────────────────────────────────────────
export type TeacherStatus = "active" | "inactive";
export type TeacherEarningType = "per_session" | "monthly_salary" | "percentage";

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
  earningPercentage?: number;
  customBranch?: string;
  notes?: string;
  createdAt: string;
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
  revenueThisMonth: number;
  pendingPayments: number;
  pendingEarnings: number;
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
  sessionCount: number;
  totalEarning: number;
  paidEarning: number;
  pendingEarning: number;
}

// ─── Report models ─────────────────────────────────────────────────────────────

export interface GeneralReportStats {
  totalStudents: number;
  activeStudents: number;
  totalSessions: number;
  completedSessions: number;
  totalBilled: number;
  totalCollected: number;
  totalRemaining: number;
  totalTeacherEarnings: number;
  centerProfit: number;
}

export interface StudentReportRow {
  studentId: string;
  studentName: string;
  guardianId: string | null;
  guardianName: string | null;
  totalSessions: number;
  completedSessions: number;
  totalBilled: number;
  totalCollected: number;
  remainingDebt: number;
  lastSessionDate: string | null;
  status: StudentStatus;
}

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

export interface EducationTypeReportRow {
  educationTypeId: string;
  educationTypeName: string;
  totalSessions: number;
  completedSessions: number;
  totalRevenue: number;
  teacherEarnings: number;
  centerProfit: number;
  activeStudentCount: number;
}

export interface FinanceReportStats {
  totalBilled: number;
  totalCollected: number;
  remainingReceivable: number;
  totalTeacherEarnings: number;
  paidTeacherEarnings: number;
  pendingTeacherEarnings: number;
  centerGrossProfit: number;
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
  source: "manual" | "payment";
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
