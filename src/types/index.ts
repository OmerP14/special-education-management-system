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
export type EducationTypeStatus = "active" | "inactive";

export interface EducationType {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  /** Hex color, drawn from EDUCATION_TYPE_COLOR_PALETTE — used consistently for
   *  calendar session cards, the calendar legend, and filter badges. */
  color: string;
  defaultDurationMinutes: number;
  defaultStudentPrice: number;
  /** Informational reference only (shown in Teacher price rows) — never a
   *  fallback in actual earning calculation, see calculateTeacherSessionEarning
   *  in finance.ts. Real teacher-specific earning lives on TeacherCustomPrice;
   *  this field is intentionally not editable from Settings → Eğitim Türleri. */
  defaultTeacherEarning: number;
  /** "inactive" hides the type from new-record selectors everywhere but never
   *  changes how it renders on historical records/reports — see
   *  getActiveEducationTypes/getEducationTypeLabel in education-types.ts. */
  status: EducationTypeStatus;
  createdAt: string;
  updatedAt?: string;
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
  /** Set when created by Excel Import — lets that batch be rolled back. */
  importBatchId?: string;
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
  importBatchId?: string;
}

// ─── Teacher ───────────────────────────────────────────────────────────────────
/** "archived" is set ONLY by the Teacher Merge workflow (see TeacherMergeHistory) —
 *  never manually selectable in the edit form. An archived teacher keeps every one
 *  of its historical Session/TeacherEarning/TeacherPayment rows intact for audit;
 *  only NEW activity is redirected to whichever teacher absorbed it. */
export type TeacherStatus = "active" | "inactive" | "archived";
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
  importBatchId?: string;
  /** Set together with status:"archived" when this record was merged away —
   *  see TeacherMergeHistory. Never set directly; only mergeTeachers/rollback
   *  in the store write these three fields. */
  archivedAt?: string;
  archivedReason?: string;
  mergedIntoTeacherId?: string;
}

// ─── Session ───────────────────────────────────────────────────────────────────
export type SessionStatus =
  | "planned"
  | "completed"
  | "cancelled"
  | "no_show"
  | "makeup";

/** "billable" (default when absent — every manually-created/existing session)
 *  counts toward student/guardian debt, tahakkuk, and receivables everywhere.
 *  "historical_non_billable" is set ONLY by a historical import that the user
 *  explicitly chose to bring in as pure session history (no payments/opening
 *  balance included) — it still shows up in session history, attendance, and
 *  session counts, but is excluded from every debt/tahakkuk calculation so a
 *  migration never silently invents receivables the center never billed. */
export type SessionBillingMode = "billable" | "historical_non_billable";

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
  updatedAt?: string;
  recurringGroupId?: string;
  weeklyPlanId?: string;
  importBatchId?: string;
  /** Undefined is treated identically to "billable" everywhere — see
   *  SessionBillingMode. */
  billingMode?: SessionBillingMode;
  /** See TeacherEarningCalculationStatus. Undefined (every session created
   *  before this field existed) is resolved via resolveTeacherEarningStatus()
   *  in finance.ts, never re-derived ad hoc. */
  teacherEarningStatus?: TeacherEarningCalculationStatus;
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

export type PaymentSource = "manual" | "installment" | "import";

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
  updatedAt?: string;
  importBatchId?: string;
}

// ─── Opening Balance (Devir Bakiyesi) ──────────────────────────────────────────
// A historical carry-in balance for a student who has debt/credit predating any
// session or payment history in the system. Never becomes a fake Session or
// Payment — it only feeds into previous-balance/remaining-debt calculations
// (see getPreviousBalance / getStudentDebt), so Tahakkuk/Tahsilat figures stay
// pure sums of real sessions/payments.
export type OpeningBalanceType = "debt" | "credit";

export interface OpeningBalance {
  id: string;
  tenantId: string;
  studentId: string;
  guardianId?: string;
  amount: number; // always positive; sign is carried by balanceType
  balanceType: OpeningBalanceType;
  date: string; // "YYYY-MM-DD" — balance is "as of" this date
  note?: string;
  createdAt: string;
  updatedAt?: string;
  importBatchId?: string;
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

/** Whether a session/earning's `teacherEarning`/`amount` is a real calculated
 *  value or an unreliable 0-fallback because the teacher had no configured
 *  earning model/price at the time (e.g. a per_session teacher with no custom
 *  price for that education type). Undefined (pre-existing records) is treated
 *  as "calculated" unless it can be safely re-derived otherwise — see
 *  resolveTeacherEarningStatus() in finance.ts, the single source of truth for
 *  this rule; never re-derive it inline in a component. */
export type TeacherEarningCalculationStatus = "calculated" | "unknown";

export interface TeacherEarning {
  id: string;
  tenantId: string;
  teacherId: string;
  sessionId: string;
  amount: number;
  status: EarningStatus;
  /** See TeacherEarningCalculationStatus. Named distinctly from `status`
   *  (pending/paid) to avoid confusing "has this been paid" with "was this
   *  amount actually calculable". */
  calculationStatus?: TeacherEarningCalculationStatus;
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
  updatedAt?: string;
  importBatchId?: string;
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
  /** Earning-eligible sessions whose teacherEarning could not be reliably
   *  calculated (missing per_session custom price at commit time) — never
   *  folded into pendingEarnings/monthlyEarnings as a confirmed ₺0. */
  unknownSessionCount: number;
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
  /** All-time earning-eligible sessions with an unknown (unresolved) earning —
   *  see TeacherListItem.unknownSessionCount. */
  unknownSessionCount: number;
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
  /** All-time, across every teacher — sessions whose teacherEarning is unknown/
   *  unresolved. `pendingEarnings` above never invents an amount for these; this
   *  count is what lets the UI say so instead of presenting pendingEarnings as
   *  the complete picture. */
  unknownEarningSessionCount: number;
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
  billingMode?: SessionBillingMode;
  /** Resolved (never undefined) via resolveTeacherEarningStatus() — see
   *  TeacherEarningCalculationStatus. */
  teacherEarningStatus: TeacherEarningCalculationStatus;
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
  /** Latest billed session date, or latest payment date if no billed session exists. Display only. */
  lastDebtActivityDate: string | null;
  /** True if this student carries a nonzero migrated opening balance (Devir Bakiyesi). */
  hasOpeningBalance: boolean;
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
  /** Latest billed session date, or latest payment date if no billed session exists. Display only. */
  lastDebtActivityDate: string | null;
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
  /** Resolved (never undefined) via resolveTeacherEarningStatus() against the
   *  underlying Session record. */
  teacherEarningStatus: TeacherEarningCalculationStatus;
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
  unknownSessionCount: number;
}

export interface TeacherEarningPageStats {
  thisMonthTotal: number;
  paidTotal: number;
  pendingTotal: number;
  teachersWithEarnings: number;
  /** All-time, across every teacher — see DashboardStats.unknownEarningSessionCount. */
  unresolvedSessionCount: number;
}

export interface MonthlyTeacherEarningSummary {
  teacherId: string;
  teacherName: string;
  earningType?: TeacherEarningType;
  sessionCount: number;
  totalEarning: number;
  paidEarning: number;
  pendingEarning: number;
  /** Earning-eligible sessions in this month with an unknown/unresolved earning. */
  unknownSessionCount: number;
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
  /** Latest earning-eligible (completed/makeup) session date in the filtered set. Display only. */
  lastSessionDate: string | null;
  /** Earning-eligible sessions in range with an unknown/unresolved earning. */
  unknownSessionCount: number;
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
  /** Latest earning-eligible (completed/makeup) session date for this teacher. Display only. */
  lastSessionDate: string | null;
  /** Earning-eligible sessions in the selected month with an unknown/unresolved earning. */
  unknownSessionCount: number;
  /** All-time equivalent of unknownSessionCount — same scope as totalPending. */
  totalUnknownSessionCount: number;
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
  /** Latest session date within the filtered set. Display only. */
  lastSessionDate: string | null;
}

export interface TeacherSessionCountRow extends SessionStatusBreakdown {
  teacherId: string;
  teacherName: string;
  /** Latest session date within the filtered set. Display only. */
  lastSessionDate: string | null;
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

// ─── Excel Import / Historical Data Migration ─────────────────────────────────

/** One entity type is imported per wizard pass — matches the dependency order a
 *  real migration needs (people before sessions, sessions/payments before balances). */
export type ImportEntityType =
  | "students"
  | "guardians"
  | "teachers"
  | "sessions"
  | "payments"
  | "teacherPayments"
  | "openingBalances";

/** Historical applies migration-specific rules (status/duplicate handling geared
 *  at bulk backfill); Operational is for current/future day-to-day data. */
export type ImportMode = "historical" | "operational";

export type ImportRowStatus = "valid" | "warning" | "error" | "duplicate";

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

/** Best-effort values already readable from an error row's own raw cells (fee,
 *  time) — display-only, never auto-committed. Lets the repair panel pre-fill
 *  everything the importer already knows so the user only has to touch the one
 *  field that actually failed validation (e.g. a broken date). */
export interface ImportRowRepairHints {
  fee?: number;
  time?: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  displayText: string;
  status: ImportRowStatus;
  issues: string[];
  entityMatches: ImportEntityMatch[];
  repairHints?: ImportRowRepairHints;
  /** User can uncheck a warning/conflict row to exclude it from commit. Duplicate
   *  and error rows are always excluded regardless of this flag. */
  include: boolean;
  /** True when this row stages a Session whose teacherEarning is a 0-fallback,
   *  not a real calculation — the teacher has no configured earning model/price
   *  (or no explicit hakediş column value) at staging time. The Session record
   *  itself still gets a numeric teacherEarning (unchanged accounting behavior),
   *  but the import preview must never present that fallback as a known hakediş. */
  teacherEarningUnknown?: boolean;
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  duplicateRows: number;
  /** Rows silently dropped as non-data (TOPLAM/summary lines, blank rows, template
   *  sheets) — never counted as errors, never shown as red rows. */
  skippedRows: number;
  /** Rows that will actually be written on commit (valid + included warnings). */
  toCommitRows: number;
}

/** Financial preview shown in Step 3 before anything is written — computed from
 *  the staged (not-yet-committed) rows using the same helpers reports use. */
export interface ImportFinancialImpact {
  sessionsToCreate: number;
  paymentsToCreate: number;
  teacherPaymentsToCreate: number;
  openingBalancesToCreate: number;
  totalTahakkukImpact: number;
  totalTahsilatImpact: number;
  teacherPaymentImpact: number;
  cashImpact: number;
  remainingBalanceImpact: number;
  /** Sum of calculateSessionTeacherEarning() over sessions with a KNOWN
   *  (reliably configured) teacher earning only — see sessionsWithUnknownTeacherEarning.
   *  The same per-session hakediş formula Reports/Dashboard already use, never a
   *  new calculation. */
  estimatedTeacherEarningImpact: number;
  /** totalTahakkukImpact - estimatedTeacherEarningImpact, restricted to the same
   *  known-earning sessions, mirroring calculateSessionCenterProfit()'s existing
   *  per-session formula. */
  estimatedCenterProfitImpact: number;
  /** Sessions whose teacherEarning had to fall back to 0 because the teacher has
   *  no configured earning model/price (Excel data alone never carries hakediş —
   *  only student billing). When > 0, estimated hakediş/profit above are computed
   *  over the KNOWN subset only and the UI must not present them as the full
   *  picture — see ImportPreviewRow.teacherEarningUnknown. */
  sessionsWithUnknownTeacherEarning: number;
  /** Sessions staged with billingMode: "historical_non_billable" (the user chose
   *  "Sadece ders geçmişi olarak aktar") — excluded from totalTahakkukImpact/
   *  estimatedTeacherEarningImpact/estimatedCenterProfitImpact above entirely,
   *  since they will never bill the student. Still counted in sessionsToCreate. */
  historicalNonBillableSessionsToCreate: number;
}

/** Result returned after commit — the basis for the on-screen import/error report. */
export interface ImportResult {
  imported: number;
  skippedDuplicates: number;
  skippedErrors: number;
  warnings: number;
}

// ─── Import Batch (rollback / audit trail) ─────────────────────────────────────

export interface ImportBatchEntityIds {
  students: string[];
  guardians: string[];
  teachers: string[];
  sessions: string[];
  payments: string[];
  teacherPayments: string[];
  openingBalances: string[];
}

/**
 * One record per committed import (potentially spanning several entity types in
 * one multi-select run). Rollback deletes exactly the ids listed here — never a
 * broader query — so a batch can never remove data it didn't create.
 */
export interface ImportBatch {
  id: string;
  tenantId: string;
  fileName: string;
  importedAt: string;
  importMode: ImportMode;
  importedBy: string;
  entityTypes: ImportEntityType[];
  rowCount: number;
  createdEntityIds: ImportBatchEntityIds;
  skippedRows: number;
  warningRows: number;
  duplicateRows: number;
  financialSummary: ImportFinancialImpact;
  /** SHA-256 of the source file's bytes — detects "this exact file was already
   *  imported" independent of row-level duplicate matching. */
  fileFingerprint: string;
  rolledBackAt?: string;
}

export interface EditedImportRecord {
  entityType: ImportEntityType;
  id: string;
  label: string;
}

// ─── Teacher Merge (duplicate-teacher consolidation) ───────────────────────────
// A merge never deletes the duplicate teacher or any of its historical rows — it
// reassigns every Session/TeacherEarning/TeacherPayment/TeacherCustomPrice/
// WeeklySessionPlan.teacherId from the duplicate to the primary, then archives
// the duplicate (status:"archived"). Reports/Dashboard/Calendar all derive from
// these same arrays, so they update for free — nothing else needs to know a
// merge happened. See lib/helpers/teacher-merge.ts and store.mergeTeachers.

export interface TeacherMergeMovedCounts {
  sessions: number;
  teacherEarnings: number;
  teacherPayments: number;
  teacherCustomPrices: number;
  weeklyPlans: number;
}

/**
 * Everything needed to reverse a merge without touching any record that wasn't
 * part of it. Only ids are kept for the reassigned entities (rollback just flips
 * teacherId back); teacherCustomPrice rows dropped for conflicting with a price
 * the primary already had are kept in full (they were removed from the live
 * array entirely, so there's no id left to flip back — the whole row must be
 * recreated). See rollbackTeacherMerge in store.tsx.
 */
export interface TeacherMergeSnapshot {
  /** Full duplicate Teacher record exactly as it was immediately before archiving. */
  duplicateTeacher: Teacher;
  movedSessionIds: string[];
  movedTeacherEarningIds: string[];
  movedTeacherPaymentIds: string[];
  movedWeeklyPlanIds: string[];
  movedTeacherCustomPriceIds: string[];
  /** Custom price rows that existed on the duplicate but were NOT moved because
   *  the primary already had a price for that educationTypeId — buildTeacherMergePreview
   *  flags this as a blocking conflict, so in practice this is always empty at the
   *  moment a merge is actually confirmed; kept for defense-in-depth. */
  droppedTeacherCustomPrices: TeacherCustomPrice[];
}

export interface TeacherMergeHistory {
  id: string;
  tenantId: string;
  primaryTeacherId: string;
  /** Snapshot of names at merge time — stays readable even if the primary is
   *  later renamed or (via a later merge) archived itself. */
  primaryTeacherName: string;
  duplicateTeacherId: string;
  duplicateTeacherName: string;
  mergedAt: string;
  mergedBy: string;
  reason: string;
  moved: TeacherMergeMovedCounts;
  snapshot: TeacherMergeSnapshot;
  rolledBackAt?: string;
}
