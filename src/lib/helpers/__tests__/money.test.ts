import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSettingsDefaults } from "@/lib/settings/defaults";
import { setActiveSettings } from "@/lib/settings/runtime";
import {
  calculateTeacherMonthlyPayable,
  calculateTeacherSessionEarning,
  getStudentDebt,
  getStudentNetBalance,
  getTeacherEarningTotals,
  getTeacherEarningTotalsForRange,
  getTeacherExtraSessionCount,
  getTeacherMonthAccountSummary,
  getTeacherMonthEarningTotals,
  withEarningFactor,
} from "@/lib/helpers/finance";
import { buildStudentCurrentAccount } from "@/lib/helpers/current-account";
import type { InstitutionSettings } from "@/types/settings";
import type {
  OpeningBalance,
  Payment,
  Session,
  SessionStatus,
  Teacher,
  TeacherEducationTypeAssignment,
  TeacherPayment,
  TeacherPaymentType,
} from "@/types";

// Hand-worked money scenarios for the two numbers this app must never get
// wrong: what a teacher is owed and what a student owes. "Today" is pinned so
// salary months and the current period are stable.

function withSettings(mutate: (s: InstitutionSettings) => void): InstitutionSettings {
  const s = getSettingsDefaults();
  mutate(s);
  setActiveSettings(s);
  return s;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-20T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
  setActiveSettings(getSettingsDefaults());
});

let seq = 0;
/** A session as the store saves it: stamped with the earning share for its
 *  status under the settings active at save time. */
function lesson(date: string, status: SessionStatus = "completed", overrides: Partial<Session> = {}): Session {
  const s: Session = {
    id: `s${++seq}`,
    tenantId: "tenant-1",
    studentId: "st1",
    teacherId: "t1",
    educationTypeId: "et1",
    date: `${date}T10:00:00`,
    durationMinutes: 40,
    sessionCount: 1,
    studentPrice: 500,
    teacherEarning: 300,
    status,
    createdAt: `${date}T09:00:00.000Z`,
    ...overrides,
  };
  return withEarningFactor(s, currentPolicy());
}

let policyOverride: InstitutionSettings["teacherEarnings"] | null = null;
function currentPolicy() {
  return policyOverride ?? getSettingsDefaults().teacherEarnings;
}
afterEach(() => {
  policyOverride = null;
});

function teacher(overrides: Partial<Teacher> = {}): Teacher {
  return {
    id: "t1",
    tenantId: "tenant-1",
    fullName: "Ayşe Öğretmen",
    phone: "",
    status: "active",
    earningType: "per_session",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function pay(date: string, amount: number, paymentType: TeacherPaymentType = "salary"): TeacherPayment {
  return {
    id: `p${++seq}`,
    tenantId: "tenant-1",
    teacherId: "t1",
    date,
    amount,
    paymentType,
    method: "cash",
    createdAt: `${date}T12:00:00.000Z`,
  } as TeacherPayment;
}

// ─── Per-lesson teachers ─────────────────────────────────────────────────────

describe("per-lesson teacher (Seans Başı)", () => {
  it("earns the agreed amount per completed lesson, nothing for planned ones", () => {
    const t = teacher();
    const sessions = [
      lesson("2026-03-02"),
      lesson("2026-03-03"),
      lesson("2026-03-25", "planned"), // not taught yet
    ];
    expect(calculateTeacherMonthlyPayable(t, sessions, 2026, 3)).toBe(600);
  });

  it("pays a block lesson (two lessons back to back) twice", () => {
    expect(calculateTeacherMonthlyPayable(teacher(), [lesson("2026-03-02", "completed", { sessionCount: 2 })], 2026, 3)).toBe(600);
  });

  it("follows Ayarlar → Öğretmen Ödemeleri for no-show, cancelled and makeup lessons", () => {
    const t = teacher();
    // Defaults: no-show → nothing, cancelled → nothing, makeup → full.
    let sessions = [lesson("2026-03-02", "no_show"), lesson("2026-03-03", "cancelled"), lesson("2026-03-04", "makeup")];
    expect(calculateTeacherMonthlyPayable(t, sessions, 2026, 3)).toBe(300);

    // "Yarım ücret" everywhere: 150 + 150 + 150.
    policyOverride = {
      ...getSettingsDefaults().teacherEarnings,
      noShowSessionEarning: "partial",
      cancelledSessionEarning: "partial",
      makeupSessionEarningBehavior: "half",
    };
    setActiveSettings({ ...getSettingsDefaults(), teacherEarnings: policyOverride });
    sessions = [lesson("2026-03-02", "no_show"), lesson("2026-03-03", "cancelled"), lesson("2026-03-04", "makeup")];
    expect(calculateTeacherMonthlyPayable(t, sessions, 2026, 3)).toBe(450);

    // "Tam ücret" for a no-show.
    policyOverride = { ...getSettingsDefaults().teacherEarnings, noShowSessionEarning: "full" };
    setActiveSettings({ ...getSettingsDefaults(), teacherEarnings: policyOverride });
    expect(calculateTeacherMonthlyPayable(t, [lesson("2026-03-02", "no_show")], 2026, 3)).toBe(300);
  });

  it("keeps the share a lesson was saved with when the rule changes later", () => {
    const t = teacher();
    const saved = [lesson("2026-03-02", "no_show")]; // saved under "no payment"
    withSettings((s) => (s.teacherEarnings.noShowSessionEarning = "full"));
    expect(calculateTeacherMonthlyPayable(t, saved, 2026, 3)).toBe(0);
  });

  it("does not pay for lessons imported as history (covered by the devir)", () => {
    const sessions = [lesson("2026-03-02", "completed", { billingMode: "historical_non_billable" })];
    expect(calculateTeacherMonthlyPayable(teacher(), sessions, 2026, 3)).toBe(0);
  });

  it("adds the imported devir in the month it is dated", () => {
    const t = teacher({ openingBalance: { amount: 2500, date: "2026-03-01" } });
    expect(calculateTeacherMonthlyPayable(t, [lesson("2026-03-02")], 2026, 3)).toBe(2800);
    expect(calculateTeacherMonthlyPayable(t, [], 2026, 2)).toBe(0);
  });

  it("uses the amount set for the teacher on that education type, never a guess", () => {
    const assignments: TeacherEducationTypeAssignment[] = [
      { id: "a1", tenantId: "tenant-1", teacherId: "t1", educationTypeId: "et1", earningAmount: 350, status: "active" } as TeacherEducationTypeAssignment,
      { id: "a2", tenantId: "tenant-1", teacherId: "t1", educationTypeId: "et2", earningAmount: null, status: "active" } as TeacherEducationTypeAssignment,
    ];
    expect(calculateTeacherSessionEarning(teacher(), "et1", 500, assignments)).toBe(350);
    expect(calculateTeacherSessionEarning(teacher(), "et2", 500, assignments)).toBeNull();
    expect(calculateTeacherSessionEarning(teacher(), "et3", 500, assignments)).toBeNull();
  });
});

// ─── Percentage teachers ─────────────────────────────────────────────────────

describe("percentage teacher (Yüzde)", () => {
  it("earns its share of the lesson fee", () => {
    const t = teacher({ earningType: "percentage", earningPercentage: 40 });
    expect(calculateTeacherSessionEarning(t, "et1", 450, [])).toBe(180);
    const sessions = [lesson("2026-03-02", "completed", { studentPrice: 450 }), lesson("2026-03-03", "completed", { studentPrice: 500, sessionCount: 2 })];
    // 450×40% + 2×(500×40%) = 180 + 400
    expect(calculateTeacherMonthlyPayable(t, sessions, 2026, 3)).toBe(580);
  });
});

// ─── Salaried teachers ───────────────────────────────────────────────────────

describe("fixed salary teacher (Sabit Maaş)", () => {
  it("is owed the salary for the month, whatever the lesson count", () => {
    const t = teacher({ earningType: "monthly_salary", monthlySalary: 30000 });
    expect(calculateTeacherMonthlyPayable(t, [lesson("2026-03-02")], 2026, 3)).toBe(30000);
    expect(calculateTeacherMonthlyPayable(t, [], 2026, 3)).toBe(30000);
  });

  it("owes the salary once per month across the year", () => {
    const t = teacher({ earningType: "monthly_salary", monthlySalary: 30000 });
    const sessions = [lesson("2026-01-12"), lesson("2026-02-09"), lesson("2026-03-02")];
    expect(getTeacherEarningTotals(t, sessions, []).totalEarning).toBe(90000);
  });

  it("still owes the salary for a month with no lessons (e.g. a holiday month)", () => {
    // Teacher works January and March; February has no lessons recorded.
    const t = teacher({ earningType: "monthly_salary", monthlySalary: 30000, createdAt: "2026-01-01T00:00:00.000Z" });
    const sessions = [lesson("2026-01-12"), lesson("2026-03-02")];
    expect(getTeacherEarningTotals(t, sessions, []).totalEarning).toBe(90000);
  });

  it("does not change last month's total when the calendar turns", () => {
    const t = teacher({ earningType: "monthly_salary", monthlySalary: 30000, createdAt: "2026-01-01T00:00:00.000Z" });
    const sessions = [lesson("2026-01-12")];
    const payments = [pay("2026-03-05", 30000), pay("2026-01-30", 30000), pay("2026-02-27", 30000)];
    // On 20 March: Jan + Feb + Mar owed, all three paid.
    expect(getTeacherEarningTotals(t, sessions, payments).pendingEarning).toBe(0);
    // On 10 April: April's salary is now also owed — and nothing paid before
    // may have silently stopped counting.
    vi.setSystemTime(new Date("2026-04-10T12:00:00"));
    const totals = getTeacherEarningTotals(t, sessions, payments);
    expect(totals.totalEarning).toBe(120000);
    expect(totals.pendingEarning).toBe(30000);
  });

  it("stops owing salary for a teacher who has left", () => {
    const t = teacher({
      earningType: "monthly_salary",
      monthlySalary: 30000,
      status: "inactive",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-31T18:00:00.000Z",
    });
    // Worked (and was paid for) January only; marked as left at the end of January.
    const totals = getTeacherEarningTotals(t, [lesson("2026-01-12")], [pay("2026-01-31", 30000)]);
    expect(totals.pendingEarning).toBe(0);
  });
});

describe("report date ranges", () => {
  it("counts salary only for the months inside the range the teacher worked", () => {
    const active = teacher({ earningType: "monthly_salary", monthlySalary: 30000, createdAt: "2026-01-01T00:00:00.000Z" });
    expect(getTeacherEarningTotalsForRange(active, [], [], "2026-01-01", "2026-03-31").totalEarning).toBe(90000);
    expect(getTeacherEarningTotalsForRange(active, [], [], "2026-02-01", "2026-02-28").totalEarning).toBe(30000);
    // Nothing before the teacher started.
    expect(getTeacherEarningTotalsForRange(active, [], [], "2025-10-01", "2025-12-31").totalEarning).toBe(0);

    const left = teacher({
      earningType: "monthly_salary",
      monthlySalary: 30000,
      status: "inactive",
      createdAt: "2026-01-01T00:00:00.000Z",
      leftAt: "2026-01-31T18:00:00.000Z",
    });
    expect(getTeacherEarningTotalsForRange(left, [], [], "2026-01-01", "2026-03-31").totalEarning).toBe(30000);
  });
});

describe("salary + quota teacher (Sabit Maaş + Kota Üstü)", () => {
  const quotaTeacher = (o: Partial<Teacher> = {}) =>
    teacher({ earningType: "salary_plus_quota", monthlySalary: 20000, includedSessionQuota: 20, extraSessionEarning: 400, ...o });
  const lessons = (n: number) => Array.from({ length: n }, (_, i) => lesson(`2026-03-${String((i % 28) + 1).padStart(2, "0")}`));

  it("pays only the salary up to the quota", () => {
    expect(calculateTeacherMonthlyPayable(quotaTeacher(), lessons(18), 2026, 3)).toBe(20000);
    expect(calculateTeacherMonthlyPayable(quotaTeacher(), lessons(20), 2026, 3)).toBe(20000);
  });

  it("adds the extra rate for every lesson above the quota", () => {
    expect(getTeacherExtraSessionCount(quotaTeacher(), lessons(23), 2026, 3)).toBe(3);
    expect(calculateTeacherMonthlyPayable(quotaTeacher(), lessons(23), 2026, 3)).toBe(21200);
  });

  it("counts a block lesson as two toward the quota", () => {
    const sessions = [...lessons(19), lesson("2026-03-28", "completed", { sessionCount: 2 })];
    expect(calculateTeacherMonthlyPayable(quotaTeacher(), sessions, 2026, 3)).toBe(20400);
  });
});

// ─── Payments to teachers ────────────────────────────────────────────────────

describe("payments to teachers", () => {
  it("pending = earned − paid − deducted, and a deduction is never counted as paid", () => {
    const sessions = Array.from({ length: 10 }, (_, i) => lesson(`2026-03-${String(i + 2).padStart(2, "0")}`)); // 3000
    const totals = getTeacherEarningTotals(teacher(), sessions, [pay("2026-03-15", 1000), pay("2026-03-16", 200, "deduction")]);
    expect(totals.totalEarning).toBe(3000);
    expect(totals.paidEarning).toBe(1000);
    expect(totals.deductedEarning).toBe(200);
    expect(totals.pendingEarning).toBe(1800);
  });

  it("settles the oldest month first in the monthly view", () => {
    const sessions = [lesson("2026-02-10"), lesson("2026-02-11"), lesson("2026-03-02")]; // Feb 600, Mar 300
    const payments = [pay("2026-03-05", 700)];
    expect(getTeacherMonthEarningTotals(teacher(), sessions, payments, 2026, 2, []).pendingEarning).toBe(0);
    expect(getTeacherMonthEarningTotals(teacher(), sessions, payments, 2026, 3, []).pendingEarning).toBe(200);
  });

  it("carries an advance larger than the month's earning into the next month", () => {
    // February: earned 600, advance 1000 → 400 paid ahead.
    // March: earned 900 → only 500 left to pay.
    const sessions = [lesson("2026-02-10"), lesson("2026-02-11"), lesson("2026-03-02"), lesson("2026-03-03"), lesson("2026-03-04")];
    const payments = [pay("2026-02-12", 1000, "advance")];
    const march = getTeacherMonthAccountSummary(teacher(), sessions, payments, 2026, 3, []);
    expect(march.thisMonthEarning).toBe(900);
    expect(march.currentBalance).toBe(500);
    expect(getTeacherEarningTotals(teacher(), sessions, payments).pendingEarning).toBe(500);
  });

  it("monthly summary agrees with the all-time total", () => {
    const sessions = [lesson("2026-01-10"), lesson("2026-02-10"), lesson("2026-03-02")];
    const payments = [pay("2026-01-31", 300), pay("2026-02-20", 100)];
    const march = getTeacherMonthAccountSummary(teacher(), sessions, payments, 2026, 3, []);
    expect(march.previousBalance).toBe(200);
    expect(march.currentBalance).toBe(500);
    expect(march.totalPending).toBe(500);
  });
});

// ─── What students owe ───────────────────────────────────────────────────────

describe("student debt", () => {
  const studentPayment = (date: string, amount: number): Payment =>
    ({ id: `pay${++seq}`, tenantId: "tenant-1", studentId: "st1", date, amount, method: "cash", createdAt: date }) as Payment;

  it("bills completed, no-show and makeup lessons; never planned or cancelled ones", () => {
    const sessions = [
      lesson("2026-03-02"),
      lesson("2026-03-03", "no_show"),
      lesson("2026-03-04", "makeup"),
      lesson("2026-03-05", "cancelled"),
      lesson("2026-03-26", "planned"),
    ];
    expect(getStudentDebt("st1", sessions, [])).toBe(1500);
  });

  it("bills a block lesson twice and subtracts payments", () => {
    const sessions = [lesson("2026-03-02", "completed", { sessionCount: 2 })];
    expect(getStudentDebt("st1", sessions, [studentPayment("2026-03-02", 400)])).toBe(600);
  });

  it("adds the imported devir and never bills history-only lessons", () => {
    const opening: OpeningBalance[] = [
      { id: "ob1", tenantId: "tenant-1", studentId: "st1", amount: 2000, balanceType: "debt", date: "2026-01-01" } as OpeningBalance,
    ];
    const sessions = [lesson("2026-03-02"), lesson("2025-12-01", "completed", { billingMode: "historical_non_billable" })];
    expect(getStudentDebt("st1", sessions, [], opening)).toBe(2500);
  });

  it("shows overpayment as credit, not as debt", () => {
    const sessions = [lesson("2026-03-02")];
    expect(getStudentNetBalance("st1", sessions, [studentPayment("2026-03-02", 800)])).toBe(-300);
    expect(getStudentDebt("st1", sessions, [studentPayment("2026-03-02", 800)])).toBe(0);
  });

  it("monthly statement: previous balance + this month's lessons − this month's payments", () => {
    const sessions = [lesson("2026-02-10"), lesson("2026-02-11"), lesson("2026-03-02")];
    const payments = [studentPayment("2026-02-28", 600), studentPayment("2026-03-10", 200)];
    const march = buildStudentCurrentAccount("st1", sessions, payments, 2026, 3);
    expect(march.previousBalance).toBe(400);
    expect(march.currentMonthBilled).toBe(500);
    expect(march.currentMonthPaid).toBe(200);
    expect(march.currentBalance).toBe(700);
    expect(march.remainingDebt).toBe(700);
  });
});
