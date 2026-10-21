import type { InstitutionSettings, InstitutionSettingsKey } from "@/types/settings";
import { normalizeBreakMinutes } from "@/lib/helpers/scheduling-rules";

// The one place every default value lives — getSettingsDefaults() and every
// "Reset to defaults" action read from here, so a field can never drift
// between what a fresh install starts with and what "Reset" restores.

export const DEFAULT_INSTITUTION_SETTINGS: InstitutionSettings = {
  institution: {
    name: "Özel Eğitim Kurumu",
    logoUrl: null,
    phone: "",
    email: "",
    address: "",
    city: "",
    district: "",
  },
  sessions: {
    breakMinutes: 10,
    autoCompleteEnabled: true,
    autoCompleteDelayMinutes: 60,
    cancellationMinNoticeHours: 24,
    allowPastDateSessions: true,
    allowEditingCompletedSessions: true,
    makeupSessionBehavior: "billable",
  },
  calendar: {
    workingDays: [1, 2, 3, 4, 5, 6],
    dayStartTime: "08:00",
    dayEndTime: "21:00",
    lunchBreakStart: null,
    lunchBreakEnd: null,
    holidays: [],
  },
  finance: {
    defaultPaymentMethod: "cash",
    enabledPaymentMethods: ["cash", "bank_transfer", "credit_card", "other"],
    studentDebtWarningThreshold: 5000,
  },
  teacherEarnings: {
    availableEarningTypes: ["per_session", "monthly_salary", "salary_plus_quota", "percentage"],
    defaultEarningType: "per_session",
    earningTriggerMoment: "on_completion",
    makeupSessionEarningBehavior: "full",
    cancelledSessionEarning: "none",
    noShowSessionEarning: "none",
    allowDeductions: true,
    allowAdvances: true,
    preventOverpayment: true,
    earningRoundingRule: "none",
    payPeriodStartDay: 1,
    defaultQuota: 20,
    postQuotaBehavior: "extra_rate",
    allowHistoricalRecalculation: false,
    warnOnMissingEarningConfig: true,
  },
  students: {
    autoGenerateStudentNumber: true,
    studentNumberFormat: "OGR-{0000}",
    guardianRequired: true,
    allowMultipleGuardians: true,
    defaultStudentStatus: "active",
    inactiveStudentBehavior: "show_greyed",
    debtWarningEnabled: true,
    guardianContactPreference: "phone",
    requireBirthDate: true,
    requireKvkkConsent: true,
    requireHealthInfo: false,
    requireEmergencyContact: false,
  },
  dataManagement: {
    lastBackupAt: null,
    backupCount: 0,
    autoBackupEnabled: true,
  },
  metadata: {},
};

/** Options taken off the Ayarlar screens so they stay simple for
 *  non-technical users. They always run on these values — whatever an older
 *  version or a backup file saved — so what the screens show is the whole
 *  story. Must match DEFAULT_INSTITUTION_SETTINGS above. */
export const FIXED_SETTINGS: { [K in InstitutionSettingsKey]?: Partial<InstitutionSettings[K]> } = {
  sessions: {
    autoCompleteEnabled: true,
    autoCompleteDelayMinutes: 60,
    cancellationMinNoticeHours: 24,
    allowPastDateSessions: true,
    // Sessions auto-complete an hour after they end, so a completed session
    // must stay editable — otherwise a missed "Gelmedi" could never be fixed.
    allowEditingCompletedSessions: true,
  },
  teacherEarnings: {
    availableEarningTypes: ["per_session", "monthly_salary", "salary_plus_quota", "percentage"],
    defaultEarningType: "per_session",
    earningTriggerMoment: "on_completion",
    allowDeductions: true,
    allowAdvances: true,
    preventOverpayment: true,
    earningRoundingRule: "none",
    payPeriodStartDay: 1,
    defaultQuota: 20,
    postQuotaBehavior: "extra_rate",
    allowHistoricalRecalculation: false,
    warnOnMissingEarningConfig: true,
  },
  students: DEFAULT_INSTITUTION_SETTINGS.students,
  dataManagement: { autoBackupEnabled: true },
};

/** Returns a fresh (never-shared) copy of the defaults, whole or for one
 *  section — callers always get their own object graph to mutate safely. */
export function getSettingsDefaults(): InstitutionSettings;
export function getSettingsDefaults<K extends keyof Omit<InstitutionSettings, "metadata">>(
  section: K
): InstitutionSettings[K];
export function getSettingsDefaults(section?: keyof Omit<InstitutionSettings, "metadata">) {
  const clone = structuredClone(DEFAULT_INSTITUTION_SETTINGS);
  return section ? clone[section] : clone;
}

/** Brings a persisted settings object (possibly saved by an older version of
 *  the app) onto the current shape: every section is rebuilt from today's
 *  defaults, then only fields that still exist are copied over. Removed
 *  fields drop out and new ones get their default. */
export function normalizeInstitutionSettings(raw: unknown): InstitutionSettings {
  const defaults = getSettingsDefaults();
  if (!raw || typeof raw !== "object") return defaults;
  const source = raw as Record<string, unknown>;
  const result = defaults as unknown as Record<string, unknown>;

  for (const key of Object.keys(defaults) as (keyof InstitutionSettings)[]) {
    if (key === "metadata") {
      if (source.metadata && typeof source.metadata === "object") result.metadata = source.metadata;
      continue;
    }
    const saved = source[key];
    if (!saved || typeof saved !== "object") continue;
    const section = result[key] as Record<string, unknown>;
    for (const field of Object.keys(section)) {
      const value = (saved as Record<string, unknown>)[field];
      if (value === undefined) continue;
      // A field whose type changed shape (e.g. string → union) keeps its default.
      if (typeof value !== typeof section[field] && section[field] !== null) continue;
      section[field] = value;
    }
  }

  // "Seanslar Arası Mola" used to be `defaultBreakMinutes` with no upper
  // bound; it is now "Mola", one of the fixed 0–20 choices.
  const oldSessions = source.sessions as { breakMinutes?: unknown; defaultBreakMinutes?: unknown } | undefined;
  const savedBreak = oldSessions?.breakMinutes ?? oldSessions?.defaultBreakMinutes;
  if (typeof savedBreak === "number") defaults.sessions.breakMinutes = savedBreak;
  defaults.sessions.breakMinutes = normalizeBreakMinutes(defaults.sessions.breakMinutes);

  for (const key of Object.keys(FIXED_SETTINGS) as InstitutionSettingsKey[]) {
    Object.assign(defaults[key], structuredClone(FIXED_SETTINGS[key]));
  }

  return defaults;
}
