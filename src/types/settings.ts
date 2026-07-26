// ─── Institution Settings — canonical model ─────────────────────────────────
//
// Kept in its own file (not types/index.ts) deliberately: this is a large,
// self-contained new domain (11 sub-sections) and mixing it into the
// already-1000+ line index would make both harder to scan. Nothing here
// changes any existing type — import from "@/types/settings" wherever these
// are needed, same as any other domain import.
//
// See src/lib/settings/defaults.ts for default values and
// src/lib/settings/sections.ts for the permission-ready section registry
// that pairs with SettingsSectionKey below.

import type { PaymentMethod, StudentStatus } from "@/types";

// ─── Section keys ───────────────────────────────────────────────────────────
// Every settings nav entry, including ones with no literal InstitutionSettings
// sub-object (educationTypes/users/data/audit are their own store domains or
// pure action/log screens, but still need permission metadata + nav status).

export type SettingsSectionKey =
  | "institution"
  | "educationTypes"
  | "sessions"
  | "calendar"
  | "finance"
  | "teacherEarnings"
  | "students"
  | "notifications"
  | "users"
  | "data"
  | "appearance"
  | "security"
  | "audit";

export type SettingsSectionStatus = "complete" | "incomplete" | "attention";

// ─── 1. Kurum Bilgileri ──────────────────────────────────────────────────────

export interface InstitutionProfileSettings {
  name: string;
  shortName: string;
  logoUrl: string | null;
  phone: string;
  email: string;
  website: string;
  address: string;
  city: string;
  district: string;
  postalCode: string;
  taxOffice: string;
  taxNumber: string;
  mersisNumber: string;
  contactPersonName: string;
  contactPersonPhone: string;
  contactPersonEmail: string;
}

// ─── 2. Seans Ayarları ───────────────────────────────────────────────────────

export type SessionTimeStepMinutes = 5 | 10 | 15 | 30;
export type SessionConflictBehavior = "block_full_and_partial" | "block_full_only";
export type MakeupSessionBillingBehavior = "billable" | "non_billable";

export interface SessionSettings {
  defaultDurationMinutes: number;
  defaultBreakMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  timeStepMinutes: SessionTimeStepMinutes;
  autoCompleteEnabled: boolean;
  autoCompleteDelayMinutes: number;
  lateToleranceMinutes: number;
  noShowThresholdMinutes: number;
  cancellationMinNoticeHours: number;
  preventStudentConflict: boolean;
  preventTeacherConflict: boolean;
  conflictBehavior: SessionConflictBehavior;
  allowPastDateSessions: boolean;
  allowEditingCompletedSessions: boolean;
  makeupSessionBehavior: MakeupSessionBillingBehavior;
}

// ─── 3. Takvim ve Çalışma Saatleri ──────────────────────────────────────────

export type CalendarView = "month" | "week" | "day" | "agenda";
export type CalendarColorSource = "educationType" | "status" | "teacher";
export type CalendarOverlapDisplay = "side_by_side" | "compact";
export type CalendarMobileView = "agenda" | "day";

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
  defaultView: CalendarView;
  weekStartsOn: 0 | 1;
  timeFormat: "24h" | "12h";
  timezone: string;
  showWeekends: boolean;
  hideEmptyHours: boolean;
  colorSource: CalendarColorSource;
  overlapDisplay: CalendarOverlapDisplay;
  mobileDefaultView: CalendarMobileView;
}

// ─── 4. Finans Ayarları ──────────────────────────────────────────────────────

export type OverpaymentPolicy = "credit" | "block" | "warn";
export type CashClosingBehavior = "manual" | "auto_lock";

export interface FinanceSettings {
  currency: string;
  currencySymbolPosition: "before" | "after";
  defaultPaymentMethod: PaymentMethod;
  enabledPaymentMethods: PaymentMethod[];
  studentDebtWarningThreshold: number;
  overpaymentPolicy: OverpaymentPolicy;
  allowInstallments: boolean;
  defaultInstallmentIntervalDays: number;
  latePaymentToleranceDays: number;
  highlightOverdueInstallments: boolean;
  paymentNumberStart: number;
  receiptNumberFormat: string;
  collectionDescriptionTemplate: string;
  cashClosingBehavior: CashClosingBehavior;
  negativeCashWarning: boolean;
  showFinanceOnGeneralDashboard: boolean;
  restrictFinanceToAuthorized: boolean;
}

// ─── 5. Öğretmen ve Hakediş Ayarları ─────────────────────────────────────────

export type TeacherEarningTypeOption = "per_session" | "salary_plus_quota" | "percentage";
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

export type NotificationChannel = "inApp" | "email" | "sms" | "whatsapp";

export type NotificationEventKey =
  | "session_upcoming"
  | "session_cancelled"
  | "student_no_show"
  | "payment_received"
  | "installment_due"
  | "installment_overdue"
  | "teacher_earning_created"
  | "teacher_payment_made"
  | "user_invited"
  | "system_alert";

export interface NotificationEventConfig {
  enabled: boolean;
  channels: Record<NotificationChannel, boolean>;
  reminderMinutesBefore?: number;
}

export type NotificationRecipientType = "guardian" | "teacher" | "both";

export interface NotificationSettings {
  events: Record<NotificationEventKey, NotificationEventConfig>;
  defaultRecipientType: NotificationRecipientType;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  notifyOnWeekends: boolean;
}

// ─── 8. Belge ve Görünüm Ayarları ────────────────────────────────────────────

export type CsvDelimiter = "," | ";";
export type PdfPageSize = "A4" | "Letter";
export type ExportOrientation = "portrait" | "landscape";
export type UiDensity = "comfortable" | "compact";
export type CardRadiusPreference = "sm" | "md" | "lg" | "xl";
export type SidebarDefaultState = "expanded" | "collapsed";
export type LandingPage = "dashboard" | "calendar" | "sessions";

export interface DocumentSettings {
  documentLogoUrl: string | null;
  receiptTitle: string;
  invoiceNote: string;
  pdfFooterText: string;
  showSignatureArea: boolean;
  showStampArea: boolean;
  dateFormat: string;
  csvDelimiter: CsvDelimiter;
  pdfPageSize: PdfPageSize;
  defaultExportOrientation: ExportOrientation;
}

export interface AppearanceSettings {
  primaryBrandColor: string;
  accentColor: string;
  institutionFooterText: string;
  density: UiDensity;
  tableRowDensity: UiDensity;
  cardRadius: CardRadiusPreference;
  animationsEnabled: boolean;
  darkModeReady: boolean;
  sidebarDefaultState: SidebarDefaultState;
  defaultLandingPage: LandingPage;
}

// ─── 9. Güvenlik ve Sistem ────────────────────────────────────────────────────
// Frontend/mock-only — see the section page's own notice. There is no real
// auth/session backend yet, so nothing here is actually enforced.

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  inactivityLogoutEnabled: boolean;
  passwordMinLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSpecialChar: boolean;
  failedLoginThreshold: number;
  lockoutDurationMinutes: number;
  twoFactorReady: boolean;
  auditLoggingEnabled: boolean;
  confirmSensitiveActions: boolean;
  confirmFinancialEdits: boolean;
  confirmDataExport: boolean;
  timezone: string;
  locale: string;
  dateFormat: string;
  numberFormat: string;
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
// SettingsSectionKey — they're not 1:1 (the "appearance" nav section covers
// both the `documents` and `appearance` model fields on one page), and audit
// history should reference what data actually changed, not how it's grouped
// in the nav.
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
  documents: DocumentSettings;
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

// ─── Kullanıcılar ve Roller ───────────────────────────────────────────────────
// Role labeling now lives in src/types/auth.ts (RoleKey/Role) — one canonical
// role system for the whole app, not a settings-only cosmetic list. AppUser
// references a role by `roleId` (FK into the seeded Role catalog) rather than
// carrying a role string of its own.

export type AppUserStatus = "active" | "invited" | "inactive" | "locked";

export interface AppUser {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  /** FK into the seeded Role[] catalog — see src/lib/auth/roles.ts. Never a
   *  raw role string; resolve via getRoleById when a label is needed. */
  roleId: string;
  status: AppUserStatus;
  lastLoginAt?: string;
  /** Reset to 0 on a successful login; incremented on a bad password.
   *  LocalAuthService locks the account once this reaches
   *  institutionSettings.security.failedLoginThreshold. */
  failedLoginAttempts?: number;
  /** Set alongside status:"locked" — LocalAuthService rejects sign-in until
   *  this passes, then treats the account as unlocked without needing a
   *  separate "unlock" write. */
  lockedUntil?: string;
  invitedAt?: string;
  invitationAcceptedAt?: string;
  updatedAt?: string;
  /** Links this account to its operational identity for future resource
   *  scoping (Phase 2) — set for teacher-role/guardian-role accounts only.
   *  Deliberately never a passwordHash/credential field here — see
   *  Credential in types/auth.ts for where that lives instead. */
  teacherId?: string;
  guardianId?: string;
  createdAt: string;
}
