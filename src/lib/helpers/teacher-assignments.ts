// ─── Teacher Education Type Assignment — canonical lookups ─────────────────────
// TeacherEducationTypeAssignment is the single source of truth for "which
// education types can this teacher provide, and what do they earn for each."
// Every place that used to read Teacher.specializations or search
// TeacherCustomPrice reads through these helpers instead — never re-filter the
// assignments array ad hoc in a component.

import type {
  Teacher,
  TeacherEducationTypeAssignment,
  TeacherEarningConfigurationStatus,
} from "@/types";

export function getTeacherEducationAssignments(
  teacherId: string,
  assignments: TeacherEducationTypeAssignment[]
): TeacherEducationTypeAssignment[] {
  return assignments.filter((a) => a.teacherId === teacherId);
}

export function getTeacherActiveEducationTypeIds(
  teacherId: string,
  assignments: TeacherEducationTypeAssignment[]
): string[] {
  return assignments
    .filter((a) => a.teacherId === teacherId && a.status === "active")
    .map((a) => a.educationTypeId);
}

/** Active-assignment-only check — replaces the old teacherMatchesEducationType()
 *  duplicated in SessionFormDrawer/WeeklyPlanFormDrawer. Deliberately has no
 *  "empty specializations = matches everything" escape hatch: under this model
 *  every education type a teacher may serve has an explicit active assignment
 *  row, so no assignments correctly means no valid education type. */
export function isTeacherAssignedToEducationType(
  teacherId: string,
  educationTypeId: string,
  assignments: TeacherEducationTypeAssignment[]
): boolean {
  return assignments.some(
    (a) => a.teacherId === teacherId && a.educationTypeId === educationTypeId && a.status === "active"
  );
}

/** Any status (active or inactive) — used when a historical session references
 *  an assignment that has since been deactivated, so it can still be resolved/
 *  displayed rather than treated as if it never existed. */
export function getTeacherEducationAssignment(
  teacherId: string,
  educationTypeId: string,
  assignments: TeacherEducationTypeAssignment[]
): TeacherEducationTypeAssignment | undefined {
  return assignments.find((a) => a.teacherId === teacherId && a.educationTypeId === educationTypeId);
}

export function getTeachersForEducationType(
  educationTypeId: string,
  assignments: TeacherEducationTypeAssignment[]
): string[] {
  return assignments
    .filter((a) => a.educationTypeId === educationTypeId && a.status === "active")
    .map((a) => a.teacherId);
}

// ─── Configuration status (sections 9 & 12) ─────────────────────────────────────
// "Is this teacher's payout setup complete" — a different question from "does
// this teacher have historical sessions with an unresolved earning," which is
// getTeacherHistoricalUnresolvedEarningCount below (backed by
// getTeacherEarningTotals in finance.ts). Never conflate the two.

const CONFIGURATION_STATUS_LABELS: Record<TeacherEarningConfigurationStatus, string> = {
  configured: "Hakediş ayarları tamam",
  missing_pricing: "Eksik hakediş ayarı",
  no_assignment: "Eğitim türü atanmamış",
  salaried: "Maaşlı",
  salary_quota: "Maaş + Kota",
  inactive_teacher: "Pasif öğretmen",
};

export function getTeacherEarningConfigurationStatus(
  teacher: Teacher,
  assignments: TeacherEducationTypeAssignment[]
): { status: TeacherEarningConfigurationStatus; label: string } {
  const build = (status: TeacherEarningConfigurationStatus) => ({
    status,
    label: CONFIGURATION_STATUS_LABELS[status],
  });

  if (teacher.status !== "active") return build("inactive_teacher");
  if (teacher.earningType === "monthly_salary") return build("salaried");
  if (teacher.earningType === "salary_plus_quota") return build("salary_quota");

  const activeAssignments = assignments.filter(
    (a) => a.teacherId === teacher.id && a.status === "active"
  );
  if (activeAssignments.length === 0) return build("no_assignment");

  if (teacher.earningType === "percentage") return build("configured");

  // per_session (default)
  const missingPricing = activeAssignments.some((a) => a.earningAmount === null);
  return build(missingPricing ? "missing_pricing" : "configured");
}
