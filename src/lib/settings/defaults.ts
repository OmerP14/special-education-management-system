import type { InstitutionSettings, NotificationEventConfig, NotificationEventKey } from "@/types/settings";

// The one place every default value lives — getSettingsDefaults() and every
// "Reset to defaults" action read from here, so a field can never drift
// between what a fresh install starts with and what "Reset" restores.

function eventConfig(
  enabled: boolean,
  channels: Partial<Record<"inApp" | "email" | "sms" | "whatsapp", boolean>>,
  reminderMinutesBefore?: number
): NotificationEventConfig {
  return {
    enabled,
    channels: {
      inApp: channels.inApp ?? false,
      email: channels.email ?? false,
      sms: channels.sms ?? false,
      whatsapp: channels.whatsapp ?? false,
    },
    reminderMinutesBefore,
  };
}

const DEFAULT_NOTIFICATION_EVENTS: Record<NotificationEventKey, NotificationEventConfig> = {
  session_upcoming: eventConfig(true, { inApp: true, email: false }, 60),
  session_cancelled: eventConfig(true, { inApp: true, email: true }),
  student_no_show: eventConfig(true, { inApp: true }),
  payment_received: eventConfig(true, { inApp: true, email: true }),
  installment_due: eventConfig(true, { inApp: true, email: true }, 1440),
  installment_overdue: eventConfig(true, { inApp: true, email: true }),
  teacher_earning_created: eventConfig(false, { inApp: true }),
  teacher_payment_made: eventConfig(true, { inApp: true, email: true }),
  user_invited: eventConfig(true, { email: true }),
  system_alert: eventConfig(true, { inApp: true }),
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
    lateToleranceMinutes: 15,
    noShowThresholdMinutes: 20,
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
    timezone: "Europe/Istanbul",
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
    showFinanceOnGeneralDashboard: false,
    restrictFinanceToAuthorized: true,
  },
  teacherEarnings: {
    availableEarningTypes: ["per_session", "salary_plus_quota", "percentage"],
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
    defaultRecipientType: "guardian",
    quietHoursStart: "21:00",
    quietHoursEnd: "09:00",
    notifyOnWeekends: false,
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
    darkModeReady: false,
    sidebarDefaultState: "expanded",
    defaultLandingPage: "dashboard",
  },
  security: {
    sessionTimeoutMinutes: 60,
    inactivityLogoutEnabled: false,
    passwordMinLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSpecialChar: false,
    failedLoginThreshold: 5,
    lockoutDurationMinutes: 15,
    twoFactorReady: false,
    auditLoggingEnabled: true,
    confirmSensitiveActions: true,
    confirmFinancialEdits: true,
    confirmDataExport: false,
    timezone: "Europe/Istanbul",
    locale: "tr-TR",
    dateFormat: "DD.MM.YYYY",
    numberFormat: "1.234,56",
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
