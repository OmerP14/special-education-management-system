import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSettingsDefaults } from "@/lib/settings/defaults";
import {
  buildDashboardStats,
  buildMonthlyTeacherEarningSummary,
  buildPaymentPageStats,
  buildTeacherEarningPageStats,
  getMonthlyCollected,
  getMonthlyRevenue,
  getStudentDebt,
  getTeacherEarningTotals,
  withEarningFactor,
} from "@/lib/helpers/finance";
import { applyMakeupBilling } from "@/lib/helpers/finance-rules";
import { getVisibleHourRange } from "@/lib/helpers/calendar";
import type { OpeningBalance, Payment, Session, SessionStatus, Student, Teacher, TeacherPayment } from "@/types";

// Finansal Panel and the pages it links to, on one realistic month: every
// figure worked out by hand, and the same figure must read the same on every
// screen. "Today" is 21 October 2026.

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-21T12:00:00"));
});
afterEach(() => vi.useRealTimers());

const policy = getSettingsDefaults().teacherEarnings;
let n = 0;
const lesson = (studentId: string, teacherId: string, at: string, status: SessionStatus, price: number, earning: number, extra: Partial<Session> = {}): Session =>
  withEarningFactor(
    { id: `s${++n}`, tenantId: "t", studentId, teacherId, educationTypeId: "et-1", date: at, durationMinutes: 40, sessionCount: 1, studentPrice: price, teacherEarning: earning, status, createdAt: at, teacherEarningStatus: "calculated", ...extra },
    policy
  );
const student = (id: string, fullName: string, status: Student["status"]): Student => ({ id, tenantId: "t", fullName, birthDate: "", status, guardianIds: [], educationTypeIds: [], createdAt: "2026-01-01" });
const teacher = (id: string, o: Partial<Teacher>): Teacher => ({ id, tenantId: "t", fullName: id, phone: "", status: "active", createdAt: "2026-01-01T00:00:00", ...o });
const pay = (studentId: string, date: string, amount: number): Payment => ({ id: `p${++n}`, tenantId: "t", studentId, date, amount, method: "cash", createdAt: date });
const tpay = (teacherId: string, date: string, amount: number): TeacherPayment => ({ id: `tp${++n}`, tenantId: "t", teacherId, date, amount, method: "cash", paymentType: "salary", createdAt: date });

const students = [student("ali", "Ali", "active"), student("eski", "Eski Öğrenci", "inactive"), student("ara", "Ara Veren", "on_hold")];
const teachers = [
  teacher("seans", { earningType: "per_session" }),
  teacher("maas", { earningType: "monthly_salary", monthlySalary: 30000, createdAt: "2026-08-01T09:00:00" }),
  teacher("ayrilan", { earningType: "monthly_salary", monthlySalary: 20000, status: "inactive", createdAt: "2026-07-01T09:00:00", leftAt: "2026-09-15T17:00:00" }),
  teacher("birlesen", { earningType: "monthly_salary", monthlySalary: 10000, status: "archived", archivedAt: "2026-05-01T09:00:00" }),
];
const sessions = [
  lesson("ali", "seans", "2026-10-06T10:00:00", "completed", 400, 250),
  lesson("ali", "seans", "2026-10-07T10:00:00", "no_show", 400, 250),
  lesson("ali", "seans", "2026-09-30T23:30:00", "completed", 400, 250), // last minutes of September
  lesson("ali", "seans", "2026-11-02T10:00:00", "planned", 400, 250), // not held yet
  lesson("eski", "seans", "2026-08-10T10:00:00", "completed", 500, 300),
  lesson("ara", "maas", "2026-10-08T10:00:00", "completed", 400, 0),
  lesson("ali", "seans", "2026-06-01T10:00:00", "completed", 400, 250, { billingMode: "historical_non_billable" }),
];
const payments = [pay("ali", "2026-10-01", 300), pay("ali", "2026-09-30", 200)];
const openingBalances: OpeningBalance[] = [
  { id: "ob1", tenantId: "t", studentId: "ali", amount: 1000, balanceType: "debt", date: "2026-06-30" } as OpeningBalance,
];
const teacherPayments = [tpay("seans", "2026-10-10", 250), tpay("maas", "2026-09-30", 30000), tpay("ayrilan", "2026-07-31", 20000), tpay("ayrilan", "2026-08-31", 20000)];

describe("Finansal Panel", () => {
  const stats = () => buildDashboardStats(sessions, payments, teacherPayments, students, teachers, openingBalances);

  it("this month's revenue: held lessons and no-shows of October only", () => {
    // 400 + 400 (no-show is billed) + 400; the 30 Sept 23:30 lesson, the future
    // lesson and the history-only lesson do not count.
    expect(stats().revenueThisMonth).toBe(1200);
  });

  it("this month's collections: payments dated in October", () => {
    expect(stats().collectedThisMonth).toBe(300);
  });

  it("outstanding debt includes students who left or are on hold", () => {
    // Ali: 400 + 400 + 400 + devir 1000 − 500 paid = 1700; Eski: 500; Ara: 400.
    expect(getStudentDebt("ali", sessions, payments, openingBalances)).toBe(1700);
    expect(stats().pendingPayments).toBe(2600);
  });

  it("owed to teachers: lessons, salary while employed, nothing for merged records", () => {
    // Seans: 250 + 250 + 300 − 250 = 550 (no-show earns nothing by default).
    // Maaş: Aug–Oct 90 000 − 30 000 = 60 000.
    // Ayrılan: Jul–Sep (left mid-Sept) 60 000 − 40 000 = 20 000.
    // Birleşen (merged away): 0.
    const owed = Object.fromEntries(teachers.map((t) => [t.id, getTeacherEarningTotals(t, sessions, teacherPayments).pendingEarning]));
    expect(owed).toEqual({ seans: 550, maas: 60000, ayrilan: 20000, birlesen: 0 });
    expect(stats().pendingEarnings).toBe(80550);
  });

  it("cash-flow chart months", () => {
    expect([8, 9, 10].map((m) => getMonthlyRevenue(sessions, 2026, m))).toEqual([500, 400, 1200]);
    expect([8, 9, 10].map((m) => getMonthlyCollected(payments, 2026, m))).toEqual([0, 200, 300]);
    expect(getMonthlyRevenue(sessions, 2026, 6)).toBe(0); // history-only lesson
  });
});

describe("the same numbers on every page", () => {
  it("Öğretmen Hakedişleri agrees with Finansal Panel", () => {
    const page = buildTeacherEarningPageStats(teachers, sessions, teacherPayments, 2026, 10);
    const dashboard = buildDashboardStats(sessions, payments, teacherPayments, students, teachers, openingBalances);
    expect(page.pendingTotal).toBe(dashboard.pendingEarnings);
    // October: Seans 250 + Maaş 30 000 — the teacher who left is not owed October.
    expect(page.thisMonthTotal).toBe(30250);
  });

  it("the monthly teacher table lists only teachers owed something that month", () => {
    const oct = buildMonthlyTeacherEarningSummary(teachers, sessions, teacherPayments, 2026, 10);
    expect(oct.map((r) => [r.teacherId, r.totalEarning]).sort()).toEqual([["maas", 30000], ["seans", 250]]);
    const sep = buildMonthlyTeacherEarningSummary(teachers, sessions, teacherPayments, 2026, 9);
    expect(sep.map((r) => r.teacherId).sort()).toEqual(["ayrilan", "maas", "seans"]);
  });

  it("Öğrenci Ödemeleri agrees with Finansal Panel", () => {
    const page = buildPaymentPageStats(payments, sessions, students, 2026, 10, openingBalances);
    expect(page.collectedThisMonth).toBe(300);
    expect(page.totalRemaining).toBe(2600);
    expect(page.studentsWithDebt).toBe(3);
  });
});

describe("settings that change money or the calendar", () => {
  it("a free makeup lesson (Ders Kuralları → Hayır) bills nothing; other lessons keep their fee", () => {
    const makeup = lesson("ali", "seans", "2026-10-13T15:00:00", "makeup", 400, 250);
    expect(applyMakeupBilling(makeup, { makeupSessionBehavior: "non_billable" }).studentPrice).toBe(0);
    expect(applyMakeupBilling(makeup, { makeupSessionBehavior: "billable" }).studentPrice).toBe(400);
    const held = lesson("ali", "seans", "2026-10-13T15:00:00", "completed", 400, 250);
    expect(applyMakeupBilling(held, { makeupSessionBehavior: "non_billable" }).studentPrice).toBe(400);
  });

  it("the week grid widens to fit a lesson outside working hours", () => {
    const hours = { ...getSettingsDefaults().calendar, dayStartTime: "09:00", dayEndTime: "12:00" };
    expect(getVisibleHourRange(hours)).toEqual({ hourStart: 9, hourEnd: 12 });
    expect(getVisibleHourRange(hours, [{ date: new Date(2026, 9, 13, 15, 0), durationMinutes: 40 }, { date: new Date(2026, 9, 14, 7, 30), durationMinutes: 80 }])).toEqual({
      hourStart: 7,
      hourEnd: 16,
    });
  });
});
