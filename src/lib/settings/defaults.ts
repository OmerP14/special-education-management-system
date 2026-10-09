import type { InstitutionSettings, NotificationEventConfig, NotificationEventKey } from "@/types/settings";

// The one place every default value lives — getSettingsDefaults() and every
// "Reset to defaults" action read from here, so a field can never drift
// between what a fresh install starts with and what "Reset" restores.

function eventConfig(enabled: boolean, reminderMinutesBefore?: number): NotificationEventConfig {
  return reminderMinutesBefore === undefined ? { enabled } : { enabled, reminderMinutesBefore };
}

const DEFAULT_NOTIFICATION_EVENTS: Record<NotificationEventKey, NotificationEventConfig> = {
  session_upcoming: eventConfig(true, 60),
  session_auto_completed: eventConfig(true),
  session_cancelled: eventConfig(true),
  student_no_show: eventConfig(true),
  payment_received: eventConfig(true),
  installment_due: eventConfig(true, 1440),
  installment_overdue: eventConfig(true),
  teacher_earning_created: eventConfig(false),
  teacher_payment_made: eventConfig(true),
  user_invited: eventConfig(true),
};

export const DEFAULT_INSTITUTION_SETTINGS: InstitutionSettings = {
  institution: {
    name: "Özel Eğitim Kurumu",
    shortName: "ÖzelEğitim",
    logoUrl: null,
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    district: "",
    postalCode: "",
    taxOffice: "",
    taxNumber: "",
    mersisNumber: "",
    contactPersonName: "",
    contactPersonPhone: "",
    contactPersonEmail: "",
  },
  sessions: {
    defaultDurationMinutes: 50,
    defaultBreakMinutes: 10,
    minDurationMinutes: 15,
    maxDurationMinutes: 180,
    timeStepMinutes: 15,
    autoCompleteEnabled: true,
    autoCompleteDelayMinutes: 60,
    cancellationMinNoticeHours: 24,
    preventStudentConflict: true,
    preventTeacherConflict: true,
    conflictBehavior: "block_full_and_partial",
    allowPastDateSessions: true,
    allowEditingCompletedSessions: false,
    makeupSessionBehavior: "billable",
  },
  calendar: {
    workingDays: [1, 2, 3, 4, 5, 6],
    dayStartTime: "08:00",
    dayEndTime: "21:00",
    lunchBreakStart: null,
    lunchBreakEnd: null,
    holidays: [],
    defaultView: "week",
    weekStartsOn: 1,
    timeFormat: "24h",
    showWeekends: true,
    hideEmptyHours: false,
    colorSource: "status",
    overlapDisplay: "side_by_side",
    mobileDefaultView: "agenda",
  },
  finance: {
    currency: "TRY",
    currencySymbolPosition: "before",
    defaultPaymentMethod: "cash",
    enabledPaymentMethods: ["cash", "bank_transfer", "credit_card", "other"],
    studentDebtWarningThreshold: 5000,
    overpaymentPolicy: "credit",
    allowInstallments: true,
    defaultInstallmentIntervalDays: 30,
    latePaymentToleranceDays: 5,
    highlightOverdueInstallments: true,
    paymentNumberStart: 1000,
    receiptNumberFormat: "MKB-{YYYY}-{0000}",
    collectionDescriptionTemplate: "{ogrenciAdi} - {ay} tahsilatı",
    cashClosingBehavior: "manual",
    negativeCashWarning: true,
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
  notifications: {
    events: DEFAULT_NOTIFICATION_EVENTS,
  },
  documents: {
    documentLogoUrl: null,
    receiptTitle: "Tahsilat Makbuzu",
    invoiceNote: "",
    pdfFooterText: "",
    showSignatureArea: true,
    showStampArea: true,
    dateFormat: "DD.MM.YYYY",
    csvDelimiter: ",",
    pdfPageSize: "A4",
    defaultExportOrientation: "portrait",
  },
  appearance: {
    primaryBrandColor: "#171717",
    accentColor: "#2563eb",
    institutionFooterText: "",
    density: "comfortable",
    tableRowDensity: "comfortable",
    cardRadius: "lg",
    animationsEnabled: true,
    theme: "light",
    sidebarDefaultState: "expanded",
    defaultLandingPage: "dashboard",
  },
  security: {
    auditLoggingEnabled: true,
    confirmSensitiveActions: true,
    confirmFinancialEdits: true,
    confirmDataExport: false,
  },
  dataManagement: {
    lastBackupAt: null,
    backupCount: 0,
    autoBackupEnabled: false,
  },
  metadata: {},
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
    // Notification events are merged per event below.
    if (key === "notifications") continue;
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

  // Notification events are a keyed record — merge per event, ignoring
  // events that no longer exist and old per-channel flags.
  const savedEvents = (source.notifications as { events?: Record<string, { enabled?: unknown; reminderMinutesBefore?: unknown }> } | undefined)?.events;
  const events = defaults.notifications.events;
  for (const key of Object.keys(events) as NotificationEventKey[]) {
    const saved = savedEvents?.[key];
    if (!saved) continue;
    if (typeof saved.enabled === "boolean") events[key].enabled = saved.enabled;
    if (typeof saved.reminderMinutesBefore === "number" && events[key].reminderMinutesBefore !== undefined) {
      events[key].reminderMinutesBefore = saved.reminderMinutesBefore;
    }
  }
  // Fields that used to be free text are now fixed choices — anything else
  // falls back to the default.
  const fallback = getSettingsDefaults();
  if (!["DD.MM.YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].includes(defaults.documents.dateFormat)) {
    defaults.documents.dateFormat = fallback.documents.dateFormat;
  }
  if (!["TRY", "USD", "EUR", "GBP"].includes(defaults.finance.currency)) {
    defaults.finance.currency = fallback.finance.currency;
  }

  // Old "darkModeReady" flag maps onto the real theme switch.
  const oldAppearance = source.appearance as { darkModeReady?: unknown } | undefined;
  if (oldAppearance?.darkModeReady === true && !("theme" in (oldAppearance as object))) {
    defaults.appearance.theme = "dark";
  }
  return defaults;
}
