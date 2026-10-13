import { afterEach, describe, expect, it } from "vitest";
import type { OpeningBalance, Payment, Session, Teacher, TeacherPayment } from "@/types";
import type { StagedRow } from "@/lib/helpers/import";
import {
  applyDevirDate,
  buildDevirPlan,
  isDevirIncluded,
  studentDevirRows,
  suggestDevirDate,
} from "@/lib/helpers/import-devir";
import {
  calculateTeacherMonthlyPayable,
  getStudentNetBalance,
  getTeacherEarningTotals,
  isEarningSession,
} from "@/lib/helpers/finance";
import { getSettingsDefaults } from "@/lib/settings/defaults";
import { setActiveSettings } from "@/lib/settings/runtime";

const policy = getSettingsDefaults().teacherEarnings;
afterEach(() => setActiveSettings(getSettingsDefaults()));

function session(id: string, date: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    tenantId: "tenant-1",
    studentId: "st-1",
    teacherId: "t-1",
    educationTypeId: "et-1",
    date: `${date}T10:00:00`,
    durationMinutes: 40,
    sessionCount: 1,
    studentPrice: 400,
    teacherEarning: 200,
    status: "completed",
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}
function payment(id: string, date: string, amount: number, studentId = "st-1"): Payment {
  return { id, tenantId: "tenant-1", studentId, amount, method: "cash", date, createdAt: "2026-01-01T00:00:00Z" };
}
function teacherPayment(id: string, date: string, amount: number): TeacherPayment {
  return { id, tenantId: "tenant-1", teacherId: "t-1", amount, method: "cash", paymentType: "salary", date, createdAt: "2026-01-01T00:00:00Z" };
}
const teacher: Teacher = { id: "t-1", tenantId: "tenant-1", fullName: "Ayşe Öz", phone: "", status: "active", earningType: "per_session", createdAt: "2026-01-01T00:00:00Z" };
const student = { id: "st-1", fullName: "Ali Kaya" } as never;

function row(...staged: StagedRow["staged"]): StagedRow {
  return { preview: { rowNumber: 2, displayText: "", status: "valid", issues: [], entityMatches: [], include: true }, staged };
}

describe("devir date", () => {
  const rows = [
    row({ kind: "sessions", record: session("a", "2026-09-10") }),
    row({ kind: "sessions", record: session("b", "2026-10-13") }),
    row({ kind: "payments", record: payment("p1", "2026-09-20", 300) }),
    row({ kind: "payments", record: payment("p2", "2026-10-14", 100) }),
    row({ kind: "teacherPayments", record: teacherPayment("tp", "2026-09-30", 150) }),
  ];

  it("turns everything before it into history and leaves the rest live", () => {
    const out = applyDevirDate(rows, "2026-10-13").flatMap((r) => r.staged);
    const byId = Object.fromEntries(out.map((s) => [s.record.id, s.record]));
    expect((byId.a as Session).billingMode).toBe("historical_non_billable");
    expect((byId.b as Session).billingMode ?? "billable").toBe("billable");
    expect((byId.p1 as Payment).historical).toBe(true);
    expect((byId.p2 as Payment).historical).toBeFalsy();
    expect((byId.tp as TeacherPayment).historical).toBe(true);
    // Moving the date back makes them live again.
    const back = applyDevirDate(applyDevirDate(rows, "2026-10-13"), "2026-09-01").flatMap((r) => r.staged);
    expect(back.every((s) => !("historical" in s.record && s.record.historical))).toBe(true);
    expect(back.filter((s) => s.kind === "sessions").every((s) => ((s.record as Session).billingMode ?? "billable") === "billable")).toBe(true);
  });

  it("history bills and earns nothing", () => {
    const [hist] = applyDevirDate([rows[0]!], "2026-10-13").flatMap((r) => r.staged);
    const s = hist!.record as Session;
    expect(getStudentNetBalance("st-1", [s], [], [])).toBe(0);
    expect(isEarningSession(s, policy)).toBe(false);
    expect(getTeacherEarningTotals(teacher, [s], []).totalEarning).toBe(0);
  });

  it("suggests the first day of the system's own records, else today", () => {
    expect(suggestDevirDate([], [], "2026-10-13")).toBe("2026-10-13");
    expect(suggestDevirDate([session("x", "2026-09-01")], ["2026-09-05"], "2026-10-13")).toBe("2026-09-01");
    expect(
      suggestDevirDate([session("x", "2026-08-01", { billingMode: "historical_non_billable" })], [], "2026-10-13")
    ).toBe("2026-10-13");
  });
});

describe("devir plan", () => {
  const base = { students: [student], teachers: [teacher], openingBalances: [] as OpeningBalance[], policy };

  it("student devir = lessons − payments before the date; teacher devir = earnings − payments", () => {
    const rows = applyDevirDate(
      [
        row({ kind: "sessions", record: session("a", "2026-09-10") }),
        row({ kind: "sessions", record: session("b", "2026-09-17", { sessionCount: 2 }) }),
        row({ kind: "sessions", record: session("c", "2026-09-24", { status: "cancelled" }) }),
        row({ kind: "sessions", record: session("d", "2026-10-20") }),
        row({ kind: "payments", record: payment("p1", "2026-09-20", 500) }),
        row({ kind: "teacherPayments", record: teacherPayment("tp", "2026-09-30", 250) }),
      ],
      "2026-10-01"
    );
    const plan = buildDevirPlan({ ...base, rows, devirDate: "2026-10-01" });
    expect(plan.students).toEqual([
      expect.objectContaining({ studentId: "st-1", lessonTotal: 1200, paymentTotal: 500, suggested: 700, source: "computed" }),
    ]);
    // 3 lessons × 200 earned (the cancelled one earns nothing), 250 paid.
    expect(plan.teachers).toEqual([
      expect.objectContaining({ teacherId: "t-1", earningTotal: 600, paymentTotal: 250, suggested: 350, salaryBased: false }),
    ]);
  });

  it("an overpaying student gets a credit devir", () => {
    const rows = [row({ kind: "sessions", record: session("a", "2026-09-10") }), row({ kind: "payments", record: payment("p", "2026-09-11", 1000) })];
    const plan = buildDevirPlan({ ...base, rows, devirDate: "2026-10-01" });
    expect(plan.students[0]!.suggested).toBe(-600);
    const [devir] = studentDevirRows(plan.students, (_, s) => s, "2026-10-01").flatMap((r) => r.staged);
    expect(devir!.record).toEqual(expect.objectContaining({ amount: 600, balanceType: "credit", date: "2026-10-01" }));
  });

  it("uses the file's own devir rows and adds nothing on top", () => {
    const fileDevir: OpeningBalance = {
      id: "ob",
      tenantId: "tenant-1",
      studentId: "st-1",
      amount: 900,
      balanceType: "debt",
      date: "2026-09-30",
      createdAt: "",
    };
    const rows = [row({ kind: "sessions", record: session("a", "2026-09-10") }), row({ kind: "openingBalances", record: fileDevir })];
    const plan = buildDevirPlan({ ...base, rows, devirDate: "2026-10-01" });
    expect(plan.students[0]).toEqual(expect.objectContaining({ source: "file", fileDevir: 900, suggested: 900 }));
    expect(studentDevirRows(plan.students, (_, s) => s, "2026-10-01")).toEqual([]);
  });

  it("with no payments in the file, suggests 0 instead of calling every lesson unpaid", () => {
    const rows = [row({ kind: "sessions", record: session("a", "2026-09-10") })];
    const plan = buildDevirPlan({ ...base, rows, devirDate: "2026-10-01" });
    expect(plan.hasPaymentData).toBe(false);
    expect(plan.students[0]).toEqual(expect.objectContaining({ lessonTotal: 400, suggested: 0, source: "no_payments" }));
  });

  it("salaried teachers start at 0; existing devirs are off by default", () => {
    const salaried = { ...teacher, earningType: "monthly_salary" as const, monthlySalary: 20000, openingBalance: { amount: 5, date: "2026-01-01" } };
    const rows = [row({ kind: "sessions", record: session("a", "2026-09-10") })];
    const plan = buildDevirPlan({
      ...base,
      teachers: [salaried],
      openingBalances: [{ id: "x", tenantId: "t", studentId: "st-1", amount: 1, balanceType: "debt", date: "2026-01-01", createdAt: "" }],
      rows,
      devirDate: "2026-10-01",
    });
    expect(plan.teachers[0]).toEqual(expect.objectContaining({ salaryBased: true, suggested: 0, hasExistingDevir: true }));
    expect(isDevirIncluded({}, "st-1", plan.students[0]!)).toBe(false);
    expect(isDevirIncluded({ "st-1": true }, "st-1", plan.students[0]!)).toBe(true);
  });

  it("ignores excluded and error rows", () => {
    const excluded = row({ kind: "payments", record: payment("p", "2026-09-11", 1000) });
    excluded.preview.include = false;
    const errored = row({ kind: "sessions", record: session("e", "2026-09-12") });
    errored.preview.status = "error";
    const plan = buildDevirPlan({ ...base, rows: [row({ kind: "sessions", record: session("a", "2026-09-10") }), excluded, errored], devirDate: "2026-10-01" });
    expect(plan.students[0]).toEqual(expect.objectContaining({ lessonTotal: 400, paymentTotal: 0 }));
  });
});

describe("teacher devir in earnings", () => {
  it("is earned in the month of its date, on top of that month's lessons", () => {
    const withDevir = { ...teacher, openingBalance: { amount: 1500, date: "2026-10-01" } };
    const october = session("o", "2026-10-05");
    expect(calculateTeacherMonthlyPayable(withDevir, [october], 2026, 10)).toBe(1700);
    expect(calculateTeacherMonthlyPayable(withDevir, [october], 2026, 9)).toBe(0);
    const totals = getTeacherEarningTotals(withDevir, [october], [teacherPayment("tp", "2026-10-10", 500)]);
    expect(totals.totalEarning).toBe(1700);
    expect(totals.pendingEarning).toBe(1200);
  });
});
