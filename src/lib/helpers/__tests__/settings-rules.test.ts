import { afterEach, describe, expect, it } from "vitest";
import { getSettingsDefaults, normalizeInstitutionSettings } from "@/lib/settings/defaults";
import { setActiveSettings } from "@/lib/settings/runtime";
import {
  computeEarningFactor,
  formatCurrency,
  formatDateDMY,
  getEarningPeriod,
  getSessionEarningAmount,
  isEarningSession,
  roundEarning,
} from "@/lib/helpers/finance";
import {
  getDurationError,
  getScheduleIssues,
  isLateCancellation,
  partitionDatesByHoliday,
} from "@/lib/helpers/scheduling-rules";
import {
  canExceedPendingEarning,
  fillCollectionTemplate,
  formatReceiptNumber,
  getDefaultInstallmentInterval,
  getNextReceiptSequence,
} from "@/lib/helpers/finance-rules";
import { checkSessionConflict } from "@/lib/helpers/session-conflict";
import { backfillStudentNumbers, getGuardianContactLink, validateStudentFields } from "@/lib/helpers/student-rules";
import { validatePasswordPolicy } from "@/lib/auth/password";
import type { InstitutionSettings } from "@/types/settings";
import type { Payment, Session, Student } from "@/types";

function withSettings(mutate: (s: InstitutionSettings) => void): InstitutionSettings {
  const s = getSettingsDefaults();
  mutate(s);
  setActiveSettings(s);
  return s;
}

afterEach(() => {
  setActiveSettings(getSettingsDefaults());
});

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "s1",
    tenantId: "tenant-1",
    studentId: "st1",
    teacherId: "t1",
    educationTypeId: "et1",
    date: "2026-03-02T10:00:00",
    durationMinutes: 40,
    sessionCount: 1,
    studentPrice: 500,
    teacherEarning: 300,
    status: "completed",
    createdAt: "2026-03-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("formatting follows Ayarlar", () => {
  it("formats money with currency, symbol position and number format", () => {
    expect(formatCurrency(1234)).toBe("₺1.234");
    withSettings((s) => {
      s.finance.currency = "EUR";
      s.finance.currencySymbolPosition = "after";
      s.security.numberFormat = "1,234.56";
    });
    expect(formatCurrency(1234.5)).toBe("1,234.5 €");
    expect(formatCurrency(-50)).toBe("-50 €");
  });

  it("formats document dates in the configured format", () => {
    expect(formatDateDMY("2026-03-07")).toBe("07.03.2026");
    withSettings((s) => (s.documents.dateFormat = "YYYY-MM-DD"));
    expect(formatDateDMY("2026-03-07")).toBe("2026-03-07");
  });
});

describe("scheduling rules", () => {
  const calendar = () => getSettingsDefaults().calendar;

  it("flags holidays, closed days, hours outside work time and lunch", () => {
    const cal = { ...calendar(), holidays: [{ id: "h", date: "2026-04-23", label: "23 Nisan" }], lunchBreakStart: "12:00", lunchBreakEnd: "13:00" };
    expect(getScheduleIssues(new Date(2026, 3, 23, 10), 40, cal)[0]).toContain("23 Nisan");
    expect(getScheduleIssues(new Date(2026, 2, 8, 10), 40, cal).join()).toContain("Pazar"); // Sunday not a working day
    expect(getScheduleIssues(new Date(2026, 2, 2, 20, 30), 60, cal).join()).toContain("çalışma saatlerinin");
    expect(getScheduleIssues(new Date(2026, 2, 2, 11, 45), 40, cal).join()).toContain("öğle arası");
    expect(getScheduleIssues(new Date(2026, 2, 2, 10), 40, cal)).toEqual([]);
  });

  it("enforces min/max duration", () => {
    const sessions = getSettingsDefaults().sessions;
    expect(getDurationError(10, sessions)).toContain("en az");
    expect(getDurationError(200, sessions)).toContain("en fazla");
    expect(getDurationError(50, sessions)).toBeNull();
  });

  it("detects late cancellations only for upcoming sessions", () => {
    const sessions = getSettingsDefaults().sessions; // 24h notice
    const now = new Date(2026, 2, 2, 9);
    expect(isLateCancellation(new Date(2026, 2, 2, 15), sessions, now)).toBe(true);
    expect(isLateCancellation(new Date(2026, 2, 4, 15), sessions, now)).toBe(false);
    expect(isLateCancellation(new Date(2026, 2, 1, 15), sessions, now)).toBe(false);
  });

  it("skips holiday dates when generating plans", () => {
    const cal = { ...calendar(), holidays: [{ id: "h", date: "2026-03-09", label: "Tatil" }] };
    const result = partitionDatesByHoliday(["2026-03-02T10:00:00", "2026-03-09T10:00:00"], cal);
    expect(result.datesToKeep).toEqual(["2026-03-02T10:00:00"]);
    expect(result.holidaySkips[0]?.label).toBe("Tatil");
  });

  it("requires the teacher break between sessions", () => {
    const existing = [session({ status: "planned" })]; // 10:00–10:40
    const base = { sessions: existing, studentId: "st2", teacherId: "t1", durationMinutes: 40 };
    expect(checkSessionConflict({ ...base, startsAt: "2026-03-02T10:45:00", teacherBreakMinutes: 10 }).hasConflict).toBe(true);
    expect(checkSessionConflict({ ...base, startsAt: "2026-03-02T10:50:00", teacherBreakMinutes: 10 }).hasConflict).toBe(false);
    expect(checkSessionConflict({ ...base, startsAt: "2026-03-02T10:45:00" }).hasConflict).toBe(false);
  });
});

describe("teacher earning policy", () => {
  it("matches the old completed/makeup rule with default settings", () => {
    const policy = getSettingsDefaults().teacherEarnings;
    expect(computeEarningFactor("completed", policy)).toBe(1);
    expect(computeEarningFactor("makeup", policy)).toBe(1);
    expect(computeEarningFactor("no_show", policy)).toBe(0);
    expect(computeEarningFactor("cancelled", policy)).toBe(0);
  });

  it("applies partial/half shares and rounding", () => {
    const policy = { ...getSettingsDefaults().teacherEarnings, noShowSessionEarning: "partial" as const, earningRoundingRule: "nearest_10" as const };
    setActiveSettings({ ...getSettingsDefaults(), teacherEarnings: policy });
    const s = session({ status: "no_show", teacherEarning: 333, earningFactor: computeEarningFactor("no_show", policy) });
    expect(getSessionEarningAmount(s)).toBe(170);
    expect(roundEarning(12.345, "none")).toBe(12.35);
  });

  it("holds earnings until approval when required", () => {
    withSettings((s) => (s.teacherEarnings.earningTriggerMoment = "on_admin_approval"));
    expect(isEarningSession(session({ earningFactor: 1 }))).toBe(false);
    expect(isEarningSession(session({ earningFactor: 1, earningApprovedAt: "2026-03-03T00:00:00Z" }))).toBe(true);
  });

  it("buckets dates into pay periods", () => {
    expect(getEarningPeriod("2026-03-10")).toEqual({ year: 2026, month: 3 });
    withSettings((s) => (s.teacherEarnings.payPeriodStartDay = 15));
    expect(getEarningPeriod("2026-03-10")).toEqual({ year: 2026, month: 2 });
    expect(getEarningPeriod("2026-03-15")).toEqual({ year: 2026, month: 3 });
    expect(getEarningPeriod("2026-01-05")).toEqual({ year: 2025, month: 12 });
  });

  it("lets only advances (and overpayment when allowed) exceed pending", () => {
    const policy = getSettingsDefaults().teacherEarnings;
    expect(canExceedPendingEarning("deduction", policy)).toBe(false);
    expect(canExceedPendingEarning("advance", policy)).toBe(true);
    expect(canExceedPendingEarning("salary", policy)).toBe(false);
    expect(canExceedPendingEarning("salary", { ...policy, preventOverpayment: false })).toBe(true);
  });
});

describe("finance rules", () => {
  it("numbers receipts from the configured start and format", () => {
    expect(formatReceiptNumber("MKB-{YYYY}-{0000}", 7, "2026-05-01")).toBe("MKB-2026-0007");
    const paid = [{ receiptSequence: 1003 }, { receiptSequence: 1001 }] as Payment[];
    expect(getNextReceiptSequence(paid, 1000)).toBe(1004);
    expect(getNextReceiptSequence([], 1000)).toBe(1000);
  });

  it("fills the collection template", () => {
    expect(fillCollectionTemplate("{ogrenciAdi} - {ay} tahsilatı", "Ali Veli", "2026-03-05")).toBe("Ali Veli - Mart 2026 tahsilatı");
  });

  it("maps the default installment interval", () => {
    expect(getDefaultInstallmentInterval(30).interval).toBe("monthly");
    expect(getDefaultInstallmentInterval(7).interval).toBe("weekly");
    expect(getDefaultInstallmentInterval(15)).toEqual({ interval: "custom", customIntervalDays: 15 });
  });
});

describe("student rules", () => {
  const settings = getSettingsDefaults().students;
  const student = (id: string, createdAt: string, extra: Partial<Student> = {}): Student => ({
    id,
    tenantId: "t",
    fullName: id,
    birthDate: "",
    status: "active",
    guardianIds: [],
    educationTypeIds: [],
    createdAt,
    ...extra,
  });

  it("backfills numbers oldest first", () => {
    const result = backfillStudentNumbers(
      [student("b", "2026-02-01"), student("a", "2026-01-01"), student("c", "2026-03-01", { studentNumber: "X", studentSequence: 5 })],
      settings
    );
    expect(result.find((s) => s.id === "a")?.studentNumber).toBe("OGR-0006");
    expect(result.find((s) => s.id === "b")?.studentNumber).toBe("OGR-0007");
  });

  it("validates required fields and unique numbers", () => {
    const form = {
      fullName: "Ali",
      birthDate: "",
      guardianId: "",
      studentNumber: "OGR-1",
      kvkkConsent: false,
      healthInfo: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
    };
    const errors = validateStudentFields(form, settings, [student("x", "2026-01-01", { studentNumber: "ogr-1" })]);
    expect(Object.keys(errors).sort()).toEqual(["birthDate", "guardianId", "kvkkConsent", "studentNumber"]);
  });

  it("builds the preferred guardian contact link", () => {
    const g = { phone: "0532 123 45 67", email: "a@b.com" };
    expect(getGuardianContactLink(g, "phone")?.href).toBe("tel:05321234567");
    expect(getGuardianContactLink(g, "whatsapp")?.href).toBe("https://wa.me/905321234567");
    expect(getGuardianContactLink(g, "email")?.href).toBe("mailto:a@b.com");
  });
});

describe("settings migration and password policy", () => {
  it("drops removed fields, keeps saved ones and fills new ones", () => {
    const old = {
      sessions: { defaultDurationMinutes: 45, lateToleranceMinutes: 10 },
      appearance: { darkModeReady: true },
      notifications: { events: { session_upcoming: { enabled: false, reminderMinutesBefore: 30, channels: {} }, system_alert: { enabled: true } } },
    };
    const s = normalizeInstitutionSettings(old);
    expect(s.sessions.defaultDurationMinutes).toBe(45);
    expect("lateToleranceMinutes" in s.sessions).toBe(false);
    expect(s.appearance.theme).toBe("dark");
    expect(s.notifications.events.session_upcoming).toEqual({ enabled: false, reminderMinutesBefore: 30 });
    expect("system_alert" in s.notifications.events).toBe(false);
  });

  it("validates passwords against the policy", () => {
    const policy = getSettingsDefaults().security; // 8+, uppercase, number
    expect(validatePasswordPolicy("short", policy)).toContain("en az 8 karakter");
    expect(validatePasswordPolicy("longpassword1", policy)).toContain("büyük harf");
    expect(validatePasswordPolicy("Demo1234!", policy)).toBeNull();
  });
});
