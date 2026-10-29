import { describe, expect, it } from "vitest";
import { applyStaffChanges, stripForStaff } from "@/lib/server/staff-view";
import { getSettingsDefaults } from "@/lib/settings/defaults";
import type { PersistedState } from "@/lib/data/store";

// A small institution: one per-lesson teacher with a rate, one salaried
// teacher, one education type with a price, one completed lesson, a payment.
function institution(): PersistedState {
  return {
    students: [{ id: "st", tenantId: "t", fullName: "Ali", birthDate: "", status: "active", educationTypeIds: ["et"], createdAt: "" }],
    teachers: [
      { id: "te", tenantId: "t", fullName: "Ayşe", phone: "1", status: "active", earningType: "per_session", createdAt: "" },
      { id: "sal", tenantId: "t", fullName: "Can", phone: "2", status: "active", earningType: "monthly_salary", monthlySalary: 30000, createdAt: "" },
    ],
    educationTypes: [{ id: "et", tenantId: "t", name: "Bireysel", color: "#000", defaultStudentPrice: 1000, status: "active", createdAt: "" }],
    teacherEducationTypeAssignments: [{ id: "as", tenantId: "t", teacherId: "te", educationTypeId: "et", earningAmount: 400, status: "active", createdAt: "" }],
    sessions: [
      {
        id: "s1", tenantId: "t", studentId: "st", teacherId: "te", educationTypeId: "et", date: "2026-10-20T10:00:00",
        durationMinutes: 40, sessionCount: 1, studentPrice: 1000, teacherEarning: 400, status: "completed", createdAt: "",
        earningFactor: 1, teacherEarningStatus: "calculated",
      },
    ],
    payments: [{ id: "p1", tenantId: "t", studentId: "st", amount: 1000, date: "2026-10-20", method: "cash", createdAt: "" }],
    teacherEarnings: [{ id: "earning-s1", tenantId: "t", teacherId: "te", sessionId: "s1", amount: 400, status: "pending", calculationStatus: "calculated", createdAt: "" }],
    teacherPayments: [{ id: "tp", tenantId: "t", teacherId: "te", amount: 400, paymentType: "salary", method: "cash", date: "2026-10-21", createdAt: "" }],
    openingBalances: [{ id: "ob", tenantId: "t", studentId: "st", amount: 500, balanceType: "debt", date: "2026-01-01", createdAt: "" }],
    importBatches: [],
    teacherMergeHistory: [],
    weeklySessionPlans: [],
    notifications: [
      { id: "n1", event: "payment_received", title: "Ödeme alındı", message: "1.000 ₺", createdAt: "", read: false },
      { id: "n2", event: "session_cancelled", title: "İptal", message: "", createdAt: "", read: false },
    ],
    institutionSettings: getSettingsDefaults(),
  } as unknown as PersistedState;
}

const json = (v: unknown) => JSON.stringify(v);

describe("stripForStaff", () => {
  const view = stripForStaff(institution());

  it("sends no money: no payments, earnings, devir; every price and pay field gone", () => {
    for (const key of ["payments", "teacherPayments", "teacherEarnings", "openingBalances", "importBatches", "teacherMergeHistory"]) {
      expect(view).not.toHaveProperty(key);
    }
    expect(view.sessions[0]).toMatchObject({ studentPrice: 0, teacherEarning: 0 });
    expect(view.sessions[0]).not.toHaveProperty("earningFactor");
    expect(view.educationTypes[0]!.defaultStudentPrice).toBe(0);
    expect(view.teacherEducationTypeAssignments[0]!.earningAmount).toBeNull();
    expect(view.teachers[1]).not.toHaveProperty("monthlySalary");
    expect(view.teachers[1]).not.toHaveProperty("earningType");
    expect(view.notifications.map((n) => n.id)).toEqual(["n2"]);
    expect(Object.keys(view.institutionSettings).sort()).toEqual(["calendar", "institution", "sessions", "students"]);
    // Belt and braces: none of the amounts appear anywhere in the document.
    expect(json(view)).not.toMatch(/30000|"1000"|:1000\b|:400\b|:500\b/);
  });
});

describe("applyStaffChanges", () => {
  it("prices a lesson staff added from the education type and the teacher's rate, and books the earning", () => {
    const full = institution();
    const view = stripForStaff(full);
    const added = { ...view.sessions[0]!, id: "s2", date: "2026-10-22T10:00:00", status: "completed" as const };
    const result = applyStaffChanges(full, { ...view, sessions: [...view.sessions, added] });
    const s2 = result.sessions.find((s) => s.id === "s2")!;
    expect(s2).toMatchObject({ studentPrice: 1000, teacherEarning: 400, earningFactor: 1, teacherEarningStatus: "calculated" });
    expect(result.teacherEarnings.find((e) => e.sessionId === "s2")?.amount).toBe(400);
  });

  it("keeps the real price when staff only moves a lesson, and re-prices it when the teacher changes", () => {
    const full = institution();
    const view = stripForStaff(full);
    const moved = applyStaffChanges(full, { ...view, sessions: [{ ...view.sessions[0]!, date: "2026-10-21T11:00:00" }] });
    expect(moved.sessions[0]).toMatchObject({ date: "2026-10-21T11:00:00", studentPrice: 1000, teacherEarning: 400, earningFactor: 1 });

    const reassigned = applyStaffChanges(full, { ...view, sessions: [{ ...view.sessions[0]!, teacherId: "sal" }] });
    expect(reassigned.sessions[0]).toMatchObject({ teacherId: "sal", studentPrice: 1000, teacherEarning: 0 });
  });

  it("re-computes the earning share and the booked earning when staff changes the status", () => {
    const full = institution();
    const view = stripForStaff(full);
    const noShow = applyStaffChanges(full, { ...view, sessions: [{ ...view.sessions[0]!, status: "no_show" }] });
    expect(noShow.sessions[0]!.earningFactor).toBe(0);
    expect(noShow.teacherEarnings).toEqual([]);

    const planned = applyStaffChanges(full, { ...view, sessions: [{ ...view.sessions[0]!, status: "planned" }] });
    expect(planned.teacherEarnings).toEqual([]);
  });

  it("ignores anything staff sends outside students, lessons and plans — including prices they type in", () => {
    const full = institution();
    const view = stripForStaff(full);
    const forged = {
      ...view,
      sessions: [{ ...view.sessions[0]!, studentPrice: 1, teacherEarning: 99999, earningFactor: 5 }],
      payments: [{ id: "fake", studentId: "st", amount: -100000, date: "2026-10-22", method: "cash" }],
      teacherPayments: [],
      openingBalances: [],
      teachers: [{ ...view.teachers[1]!, monthlySalary: 999999 }],
      educationTypes: [{ ...view.educationTypes[0]!, defaultStudentPrice: 1 }],
      teacherEducationTypeAssignments: [{ ...view.teacherEducationTypeAssignments[0]!, earningAmount: 99999 }],
      institutionSettings: { finance: { debtWarningThreshold: 0 } },
    };
    const result = applyStaffChanges(full, forged);
    expect(result.sessions[0]).toMatchObject({ studentPrice: 1000, teacherEarning: 400, earningFactor: 1 });
    expect(result.payments).toEqual(full.payments);
    expect(result.teacherPayments).toEqual(full.teacherPayments);
    expect(result.openingBalances).toEqual(full.openingBalances);
    expect(result.teachers).toEqual(full.teachers);
    expect(result.educationTypes).toEqual(full.educationTypes);
    expect(result.teacherEducationTypeAssignments).toEqual(full.teacherEducationTypeAssignments);
    expect(result.institutionSettings).toEqual(full.institutionSettings);
  });

  it("lets staff add and edit students, and keeps everything else exactly as it was", () => {
    const full = institution();
    const view = stripForStaff(full);
    const newStudent = { id: "st2", tenantId: "t", fullName: "Zeynep", birthDate: "", status: "active", educationTypeIds: [], createdAt: "" };
    const result = applyStaffChanges(full, { ...view, students: [{ ...view.students[0]!, guardianPhone: "0532" }, newStudent] });
    expect(result.students.map((s) => s.fullName)).toEqual(["Ali", "Zeynep"]);
    expect(result.students[0]!.guardianPhone).toBe("0532");
    expect(result.teacherEarnings).toEqual(full.teacherEarnings);
    expect(result.notifications).toEqual(full.notifications);
  });

  it("staff can't delete students or lessons that already happened, only planned ones", () => {
    const full = institution();
    full.sessions.push({ ...full.sessions[0]!, id: "s3", status: "planned", date: "2026-11-01T10:00:00" });
    const view = stripForStaff(full);
    const result = applyStaffChanges(full, { ...view, students: [], sessions: [] });
    expect(result.students.map((s) => s.id)).toEqual(["st"]);
    expect(result.sessions.map((s) => s.id)).toEqual(["s1"]);
    expect(result.sessions[0]).toMatchObject({ studentPrice: 1000, earningFactor: 1 });
  });

  it("an unchanged staff save changes nothing", () => {
    const full = institution();
    expect(applyStaffChanges(full, stripForStaff(full))).toEqual(full);
  });
});
