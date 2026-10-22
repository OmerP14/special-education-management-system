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
// sub-object (educationTypes/data are their own store domain or a pure
// action screen, but still need a nav entry + status).

export type SettingsSectionKey =
  | "institution"
  | "educationTypes"
  | "sessions"
  | "calendar"
  | "finance"
  | "teacherEarnings"
  | "data";

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

// ─── 6. Öğrenci Ayarları ─────────────────────────────────────────────

/** How the student card's guardian phone is offered: call or WhatsApp. */
export type GuardianContactPreference = "phone" | "whatsapp";
export type InactiveStudentBehavior = "hide" | "show_greyed";

export interface StudentSettings {
  autoGenerateStudentNumber: boolean;
  studentNumberFormat: string;
  defaultStudentStatus: StudentStatus;
  inactiveStudentBehavior: InactiveStudentBehavior;
  debtWarningEnabled: boolean;
  guardianContactPreference: GuardianContactPreference;
  requireBirthDate: boolean;
  requireKvkkConsent: boolean;
  requireHealthInfo: boolean;
  requireEmergencyContact: boolean;
}

// ─── 7. Bildirimler ──────────────────────────────────────────────────────────
// Not a settings section: which events reach the bell and the reminder lead
// time are fixed (lib/helpers/notifications.ts).

export type NotificationEventKey =
  | "session_upcoming"
  | "session_auto_completed"
  | "session_cancelled"
  | "student_no_show"
  | "payment_received"
  | "teacher_payment_made";

// ─── 8. Görünüm ─────────────────────────────────────────────────────────────
// Not a settings section: the app is always light and opens on the dashboard.

// ─── 9. Güvenlik ve Sistem ────────────────────────────────────────────────────
// Not a settings object: password policy, login lockout, session lifetime,
// and confirmations are fixed system rules
// (lib/auth/security-policy.ts, components/shared/ConfirmProvider.tsx).

// ─── 10. Yedekleme ve Excel ──────────────────────────────────────────────
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
// SettingsSectionKey.
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
  dataManagement: DataManagementSettings;
  metadata: SettingsMetadataMap;
}

/** The subset of SettingsSectionKey that maps to a literal InstitutionSettings
 *  field — excludes educationTypes/data, which are their own
 *  store domain or pure action screens with no single settings object. */
export type InstitutionSettingsKey = keyof Omit<InstitutionSettings, "metadata">;


