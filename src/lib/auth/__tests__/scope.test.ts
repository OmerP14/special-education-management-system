import { describe, expect, it } from "vitest";
import {
  canAccessGuardian,
  canAccessStudent,
  canAccessTeacher,
  getCurrentUserScope,
  getScopedPayments,
  getScopedSessions,
  getScopedStudents,
  getScopedTeachers,
} from "@/lib/auth/scope";
import { SYSTEM_ROLES, getRoleRecordScope } from "@/lib/auth/roles";
import type { AuthUser, RoleRecordScope } from "@/types/auth";
import type { Guardian, Payment, Session, Student, Teacher } from "@/types";

const students = [{ id: "s1" }, { id: "s2" }] as Student[];
const sessions = [{ id: "x1", studentId: "s1", teacherId: "t1" }, { id: "x2", studentId: "s2", teacherId: "t2" }] as Session[];
const payments = [{ id: "p1", studentId: "s1" }, { id: "p2", studentId: "s2" }] as Payment[];
const teachers = [{ id: "t1" }, { id: "t2" }] as Teacher[];
const guardians = [{ id: "g1", studentIds: ["s2"] }] as Guardian[];

function user(recordScope: RoleRecordScope, links: Partial<AuthUser> = {}): AuthUser {
  return { id: "u", tenantId: "tenant-1", name: "U", email: "u", roleId: "r", roleKey: "custom", recordScope, status: "active", ...links };
}
const ids = (list: { id: string }[]) => list.map((x) => x.id);

describe("record scope", () => {
  it("institution roles see everything", () => {
    const scope = getCurrentUserScope(user("institution"), guardians);
    expect(ids(getScopedStudents(students, sessions, scope))).toEqual(["s1", "s2"]);
    expect(ids(getScopedPayments(payments, scope))).toEqual(["p1", "p2"]);
  });

  it("a linked teacher sees only their own students and sessions, no payments", () => {
    const scope = getCurrentUserScope(user("teacher", { teacherId: "t1" }), guardians);
    expect(ids(getScopedStudents(students, sessions, scope))).toEqual(["s1"]);
    expect(ids(getScopedSessions(sessions, scope))).toEqual(["x1"]);
    expect(getScopedPayments(payments, scope)).toEqual([]);
    expect(canAccessTeacher("t2", scope)).toBe(false);
  });

  it("a linked guardian sees only their own children", () => {
    const scope = getCurrentUserScope(user("guardian", { guardianId: "g1" }), guardians);
    expect(ids(getScopedStudents(students, sessions, scope))).toEqual(["s2"]);
    expect(ids(getScopedPayments(payments, scope))).toEqual(["p2"]);
    expect(canAccessStudent("s1", scope, students, sessions)).toBe(false);
  });

  // B-01: an unlinked teacher/guardian account used to be treated as
  // institution-wide and saw every student, session and payment.
  it.each(["teacher", "guardian"] as const)("an unlinked %s account sees nothing", (recordScope) => {
    const scope = getCurrentUserScope(user(recordScope), guardians);
    expect(scope.isUnrestricted).toBe(false);
    expect(getScopedStudents(students, sessions, scope)).toEqual([]);
    expect(getScopedSessions(sessions, scope)).toEqual([]);
    expect(getScopedPayments(payments, scope)).toEqual([]);
    expect(getScopedTeachers(teachers, scope)).toEqual([]);
    expect(canAccessStudent("s1", scope, students, sessions)).toBe(false);
    expect(canAccessTeacher("t1", scope)).toBe(false);
    expect(canAccessGuardian("g1", scope)).toBe(false);
  });

  it("a link that doesn't match the role's scope is ignored", () => {
    // guardian role with a stray teacherId must not get teacher data
    const scope = getCurrentUserScope(user("guardian", { teacherId: "t1" }), guardians);
    expect(getScopedSessions(sessions, scope)).toEqual([]);
  });

  it("no signed-in user sees nothing", () => {
    expect(getCurrentUserScope(null, guardians).isUnrestricted).toBe(false);
  });
});

describe("getRoleRecordScope", () => {
  it("system roles carry their scope", () => {
    expect(SYSTEM_ROLES.map((r) => [r.key, getRoleRecordScope(r)])).toEqual([
      ["owner", "institution"],
      ["admin", "institution"],
      ["teacher", "teacher"],
      ["guardian", "guardian"],
    ]);
  });

  it("roles saved before the field existed fall back by key, custom ones to institution", () => {
    expect(getRoleRecordScope({ key: "teacher" })).toBe("teacher");
    expect(getRoleRecordScope({ key: "guardian" })).toBe("guardian");
    expect(getRoleRecordScope({ key: "muhasebe" })).toBe("institution");
  });

  // B-02: a copy of Öğretmen keeps its per-teacher scope instead of
  // becoming institution-wide because its key is a new slug.
  it("an explicit scope wins over the key", () => {
    expect(getRoleRecordScope({ key: "ogretmen-kopya", recordScope: "teacher" })).toBe("teacher");
  });
});
