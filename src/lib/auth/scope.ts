// ─── Resource scoping (Phase 3) ──────────────────────────────────────────────
//
// Centralized "what can THIS signed-in user see" — every list/detail/
// dashboard/report consumer that needs teacher-sees-own-data or guardian-
// sees-own-children behavior reads through these, never re-derives its own
// filter. Scoping is keyed off AuthUser.teacherId/guardianId (not role name)
// per the phase spec — a future custom role assigned to a per-teacher
// account is scoped exactly the same way a system "Öğretmen" account is.
//
// canAccess* are the enforcement half of this: route-level pages call these
// (not just filter a list) so a direct URL to another teacher's/guardian's
// record is blocked, not just missing from a list — see e.g.
// src/app/(app)/app/teachers/[id]/page.tsx.

import type { Guardian, InstallmentPlan, Payment, Session, Student, Teacher } from "@/types";
import type { AuthUser } from "@/types/auth";

export interface CurrentUserScope {
  /** True for any account with neither teacherId nor guardianId — owner,
   *  manager, or any other staff account. Institution-wide data, subject
   *  only to permission checks elsewhere (finance, settings, ...). */
  isUnrestricted: boolean;
  teacherId: string | null;
  guardianId: string | null;
  /** Resolved once here from the guardian's own studentIds — every
   *  guardian-scoped getScopedX below reads this instead of re-deriving it. */
  linkedStudentIds: string[];
}

export function getCurrentUserScope(user: AuthUser | null, guardians: Guardian[]): CurrentUserScope {
  const teacherId = user?.teacherId ?? null;
  const guardianId = user?.guardianId ?? null;
  const linkedStudentIds = guardianId ? guardians.find((g) => g.id === guardianId)?.studentIds ?? [] : [];
  return {
    isUnrestricted: !teacherId && !guardianId,
    teacherId,
    guardianId,
    linkedStudentIds,
  };
}

export function getScopedSessions(sessions: Session[], scope: CurrentUserScope): Session[] {
  if (scope.isUnrestricted) return sessions;
  if (scope.teacherId) return sessions.filter((s) => s.teacherId === scope.teacherId);
  if (scope.guardianId) return sessions.filter((s) => scope.linkedStudentIds.includes(s.studentId));
  return [];
}

/** Teacher: students reachable through their own sessions, plus anyone
 *  directly assigned via Student.assignedTeacherIds (covers a student with
 *  no session yet but already assigned). Guardian: exactly their linked
 *  children. */
export function getScopedStudents(students: Student[], sessions: Session[], scope: CurrentUserScope): Student[] {
  if (scope.isUnrestricted) return students;
  if (scope.teacherId) {
    const viaSessions = new Set(
      sessions.filter((s) => s.teacherId === scope.teacherId).map((s) => s.studentId)
    );
    return students.filter(
      (s) => viaSessions.has(s.id) || (s.assignedTeacherIds ?? []).includes(scope.teacherId!)
    );
  }
  if (scope.guardianId) return students.filter((s) => scope.linkedStudentIds.includes(s.id));
  return [];
}

/** Teacher: only themself (for "own profile" lookups that go through the
 *  same list a table/select would use). Guardian/unscoped-staff: no
 *  institution-wide teacher list — guardians never need one. */
export function getScopedTeachers(teachers: Teacher[], scope: CurrentUserScope): Teacher[] {
  if (scope.isUnrestricted) return teachers;
  if (scope.teacherId) return teachers.filter((t) => t.id === scope.teacherId);
  return [];
}

/** Guardian: only themself. Teacher: none — a teacher has no legitimate
 *  reason to browse the guardian list in this phase. */
export function getScopedGuardians(guardians: Guardian[], scope: CurrentUserScope): Guardian[] {
  if (scope.isUnrestricted) return guardians;
  if (scope.guardianId) return guardians.filter((g) => g.id === scope.guardianId);
  return [];
}

/** Guardian: payments for linked children only. Teacher: none — payments
 *  are institution finance, a teacher's own earnings are a separate
 *  concept (TeacherEarning/TeacherPayment, not Payment) gated by
 *  teachers.view_earnings instead of this scope. */
export function getScopedPayments(payments: Payment[], scope: CurrentUserScope): Payment[] {
  if (scope.isUnrestricted) return payments;
  if (scope.guardianId) return payments.filter((p) => scope.linkedStudentIds.includes(p.studentId));
  return [];
}

export function getScopedInstallments(plans: InstallmentPlan[], scope: CurrentUserScope): InstallmentPlan[] {
  if (scope.isUnrestricted) return plans;
  if (scope.guardianId) return plans.filter((p) => scope.linkedStudentIds.includes(p.studentId));
  return [];
}

export function canAccessStudent(
  studentId: string,
  scope: CurrentUserScope,
  students: Student[],
  sessions: Session[]
): boolean {
  if (scope.isUnrestricted) return true;
  return getScopedStudents(students, sessions, scope).some((s) => s.id === studentId);
}

export function canAccessTeacher(teacherId: string, scope: CurrentUserScope): boolean {
  if (scope.isUnrestricted) return true;
  return scope.teacherId === teacherId;
}

export function canAccessGuardian(guardianId: string, scope: CurrentUserScope): boolean {
  if (scope.isUnrestricted) return true;
  return scope.guardianId === guardianId;
}

export function canAccessSession(session: Session, scope: CurrentUserScope): boolean {
  if (scope.isUnrestricted) return true;
  if (scope.teacherId) return session.teacherId === scope.teacherId;
  if (scope.guardianId) return scope.linkedStudentIds.includes(session.studentId);
  return false;
}
