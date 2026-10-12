// ─── Institution Settings — canonical model ─────────────────────────────────
//
// Kept in its own file (not types/index.ts) deliberately: this is a large,
// self-contained new domain (11 sub-sections) and mixing it into the
// already-1000+ line index would make both harder to scan. Nothing here
// changes any existing type — import from "@/types/settings" wherever these
// are needed, same as any other domain import.
//
// See src/lib/settings/defaults.ts for default values and
// src/lib/settings/sections.ts for the section registry that pairs with
// SettingsSectionKey below.

import type { PaymentMethod, StudentStatus } from "@/types";

// ─── Section keys ───────────────────────────────────────────────────────────
// Every settings nav entry, including ones with no literal InstitutionSettings
// sub-object (educationTypes/data/audit are their own store domains or pure
// action/log screens, but still need a nav entry + status).

export type SettingsSectionKey =
  | "institution"
  | "educationTypes"
  | "sessions"
  | "calendar"
  | "finance"
  | "teacherEarnings"
  | "students"
  | "notifications"
  | "data"
  | "appearance"
  | "security"
  | "audit";

export type SettingsSectionStatus = "complete" | "incomplete" | "attention";

// ─── 1. Kurum Bilgileri ──────────────────────────────────────────────────────

export interface InstitutionProfileSettings {
  name: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  address: string;
  city: string;
  district: string;
}

// ─── 2. Seans Ayarları ───────────────────────────────────────────────────────

export type MakeupSessionBillingBehavior = "billable" | "non_billable";

/** A lesson is always LESSON_MINUTES (40) long; a block lesson is two
 *  back-to-back lessons in one session. See lib/helpers/scheduling-rules.ts. */
export interface SessionSettings {
  /** "Mola": the gap kept between two sessions of the same teacher or the
   *  same student — one of BREAK_MINUTE_OPTIONS (0–20). */
  breakMinutes: number;
  autoCompleteEnabled: boolean;
  autoCompleteDelayMinutes: number;
  cancellationMinNoticeHours: number;
  allowPastDateSessions: boolean;
  allowEditingCompletedSessions: boolean;
  makeupSessionBehavior: MakeupSessionBillingBehavior;
}

// ─── 3. Takvim ve Çalışma Saatleri ──────────────────────────────────────────

export interface CalendarHoliday {
  id: string;
  date: string; // ISO date, no time
  label: string;
}

export interface CalendarSettings {
  workingDays: number[]; // 0=Sunday .. 6=Saturday
  dayStartTime: string; // "HH:mm"
  dayEndTime: string; // "HH:mm"
  lunchBreakStart: string | null;
  lunchBreakEnd: string | null;
  holidays: CalendarHoliday[];
}

// ─── 4. Finans Ayarları ──────────────────────────────────────────────────────


export interface FinanceSettings {
  defaultPaymentMethod: PaymentMethod;
  enabledPaymentMethods: PaymentMethod[];
  studentDebtWarningThreshold: number;
}

// ─── 5. Öğretmen ve Hakediş Ayarları ─────────────────────────────────────────

export type TeacherEarningTypeOption = "per_session" | "monthly_salary" | "salary_plus_quota" | "percentage";
export type EarningTriggerMoment = "on_completion" | "on_admin_approval";
export type MakeupEarningBehavior = "full" | "half" | "none";
export type CancelledEarningBehavior = "none" | "partial";
export type NoShowEarningBehavior = "none" | "partial" | "full";
export type EarningRoundingRule = "none" | "nearest_1" | "nearest_5" | "nearest_10";
export type PostQuotaBehavior = "extra_rate" | "same_rate" | "no_extra";

export interface TeacherEarningsSettings {
  availableEarningTypes: TeacherEarningTypeOption[];
  defaultEarningType: TeacherEarningTypeOption;
  earningTriggerMoment: EarningTriggerMoment;
  makeupSessionEarningBehavior: MakeupEarningBehavior;
  cancelledSessionEarning: CancelledEarningBehavior;
  noShowSessionEarning: NoShowEarningBehavior;
  allowDeductions: boolean;
  allowAdvances: boolean;
  preventOverpayment: boolean;
  earningRoundingRule: EarningRoundingRule;
  payPeriodStartDay: number; // 1-28
  defaultQuota: number;
  postQuotaBehavior: PostQuotaBehavior;
  allowHistoricalRecalculation: boolean;
  warnOnMissingEarningConfig: boolean;
}

// ─── 6. Öğrenci ve Veli Ayarları ─────────────────────────────────────────────

export type GuardianContactPreference = "phone" | "email" | "whatsapp";
export type InactiveStudentBehavior = "hide" | "show_greyed";

export interface StudentSettings {
  autoGenerateStudentNumber: boolean;
  studentNumberFormat: string;
  guardianRequired: boolean;
  allowMultipleGuardians: boolean;
  defaultStudentStatus: StudentStatus;
  inactiveStudentBehavior: InactiveStudentBehavior;
  debtWarningEnabled: boolean;
  guardianContactPreference: GuardianContactPreference;
  requireBirthDate: boolean;
  requireKvkkConsent: boolean;
  requireHealthInfo: boolean;
  requireEmergencyContact: boolean;
}

// ─── 7. Bildirim Ayarları ─────────────────────────────────────────────────────

export type NotificationEventKey =
  | "session_upcoming"
  | "session_auto_completed"
  | "session_cancelled"
  | "student_no_show"
  | "payment_received"
  | "teacher_earning_created"
  | "teacher_payment_made";

export interface NotificationEventConfig {
  enabled: boolean;
  /** Only for reminder events (session_upcoming). */
  reminderMinutesBefore?: number;
}

/** In-app notifications only — external channels (e-posta/SMS/WhatsApp)
 *  need a server-side sender and arrive with the backend. */
export interface NotificationSettings {
  events: Record<NotificationEventKey, NotificationEventConfig>;
}

// ─── 8. Görünüm Ayarları ────────────────────────────────────────────

export type UiDensity = "comfortable" | "compact";
export type CardRadiusPreference = "sm" | "md" | "lg" | "xl";
export type SidebarDefaultState = "expanded" | "collapsed";
export type ThemePreference = "light" | "dark" | "system";
export type LandingPage = "dashboard" | "calendar" | "sessions";

export interface AppearanceSettings {
  primaryBrandColor: string;
  accentColor: string;
  institutionFooterText: string;
  density: UiDensity;
  tableRowDensity: UiDensity;
  cardRadius: CardRadiusPreference;
  animationsEnabled: boolean;
  theme: ThemePreference;
  sidebarDefaultState: SidebarDefaultState;
  defaultLandingPage: LandingPage;
}

// ─── 9. Güvenlik ve Sistem ────────────────────────────────────────────────────
// Enforced by LocalAuthService/AuthProvider in this client-only build; moves
// server-side together with authentication when the backend arrives.

/** Password policy, login lockout, session lifetime and number format are
 *  fixed system rules (lib/auth/security-policy.ts), not settings. */
export interface SecuritySettings {
  auditLoggingEnabled: boolean;
  confirmSensitiveActions: boolean;
  confirmFinancialEdits: boolean;
  confirmDataExport: boolean;
}

// ─── 10. Excel ve Veri Yönetimi ──────────────────────────────────────────────
// Most of this section is actions (backup/restore/export), not persisted
// settings — this is just the small bit of state those actions leave behind.

export interface DataManagementSettings {
  lastBackupAt: string | null;
  backupCount: number;
  autoBackupEnabled: boolean;
}

// ─── Section metadata (updatedAt/updatedBy/version) ─────────────────────────

export interface SettingsSectionMetadataEntry {
  updatedAt: string;
  updatedBy: string;
  version: number;
}

// Keyed by the data-model field (InstitutionSettingsKey), not the nav
// SettingsSectionKey — audit history references what data actually changed.
export type SettingsMetadataMap = Partial<
  Record<InstitutionSettingsKey, SettingsSectionMetadataEntry>
>;

// ─── Canonical root model ────────────────────────────────────────────────────

export interface InstitutionSettings {
  institution: InstitutionProfileSettings;
  sessions: SessionSettings;
  calendar: CalendarSettings;
  finance: FinanceSettings;
  teacherEarnings: TeacherEarningsSettings;
  students: StudentSettings;
  notifications: NotificationSettings;
  appearance: AppearanceSettings;
  security: SecuritySettings;
  dataManagement: DataManagementSettings;
  metadata: SettingsMetadataMap;
}

/** The subset of SettingsSectionKey that maps to a literal InstitutionSettings
 *  field — excludes educationTypes/users/data/audit, which are their own
 *  store domains or pure action/log screens with no single settings object. */
export type InstitutionSettingsKey = keyof Omit<InstitutionSettings, "metadata">;

// ─── İşlem Geçmişi (audit log) ────────────────────────────────────────────────

export type AuditModule =
  | "settings"
  | "education_types"
  | "sessions"
  | "payments"
  | "teacher_earnings"
  | "import"
  | "users"
  | "data"
  | "auth";

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  occurredAt: string;
  userName: string;
  action: string;
  module: AuditModule;
  recordLabel?: string;
  oldValueSummary?: string;
  newValueSummary?: string;
}

