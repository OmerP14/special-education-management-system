// ─── Teacher Merge — preview & conflict detection ──────────────────────────────
// Pure, read-only functions. Nothing here mutates the store — buildTeacherMergePreview
// is called live (on every render of the merge drawer) so the preview always reflects
// current data; the actual mutation happens in store.mergeTeachers, which recomputes
// this same preview once more before writing anything (never trusts stale UI state).
//
// Conflict philosophy: every category below is a case where blindly reassigning
// teacherId would either (a) make two rows describing the exact same real-world
// event appear under one teacher (a de-facto duplicate the merge itself created), or
// (b) leave two rows that a `.find()` elsewhere in the app can't disambiguate
// (see getTeacherEducationAssignment — keyed by teacherId+educationTypeId, first-match only).
// Any conflict found makes the merge unsafe; there is no partial/best-effort merge —
// the user resolves the underlying data first (edit/remove the clashing row), then
// retries. This is what "never silently discard data" means in practice here.

import type {
  Teacher,
  Session,
  TeacherEarning,
  TeacherPayment,
  TeacherEducationTypeAssignment,
  WeeklySessionPlan,
  EducationType,
} from "@/types";

export type TeacherMergeConflictCategory = "session" | "teacherPayment" | "teacherEducationTypeAssignment" | "weeklyPlan";

export interface TeacherMergeConflict {
  category: TeacherMergeConflictCategory;
  count: number;
  message: string;
}

export interface TeacherMergePreviewCounts {
  sessions: number;
  teacherEarnings: number;
  teacherPayments: number;
  assignments: number;
  weeklyPlans: number;
  /** Calendar has no separate storage — every calendar entry IS a Session, so this
   *  always equals `sessions`. Kept as its own field so the preview UI can show a
   *  "Calendar References" row without the caller needing to know that detail. */
  calendarReferences: number;
}

export interface TeacherMergePreview {
  counts: TeacherMergePreviewCounts;
  conflicts: TeacherMergeConflict[];
  /** True only when `conflicts` is empty. The merge drawer disables Confirm
   *  whenever this is false; store.mergeTeachers refuses to run in that case too. */
  isSafe: boolean;
}

function sameInstant(a: string, b: string): boolean {
  return new Date(a).getTime() === new Date(b).getTime();
}

/**
 * Computes exactly what a merge of `duplicate` into `primary` would move, and
 * flags anything that would collide once both teachers' rows share one teacherId.
 * Read-only — never mutates any of the arrays passed in.
 */
export function buildTeacherMergePreview(
  primary: Teacher,
  duplicate: Teacher,
  sessions: Session[],
  teacherEarnings: TeacherEarning[],
  teacherPayments: TeacherPayment[],
  assignments: TeacherEducationTypeAssignment[],
  weeklySessionPlans: WeeklySessionPlan[],
  educationTypes: EducationType[]
): TeacherMergePreview {
  const duplicateSessions = sessions.filter((s) => s.teacherId === duplicate.id);
  const primarySessions = sessions.filter((s) => s.teacherId === primary.id);
  const duplicateEarnings = teacherEarnings.filter((e) => e.teacherId === duplicate.id);
  const duplicatePayments = teacherPayments.filter((p) => p.teacherId === duplicate.id);
  const primaryPayments = teacherPayments.filter((p) => p.teacherId === primary.id);
  const duplicateAssignments = assignments.filter((a) => a.teacherId === duplicate.id);
  const primaryAssignments = assignments.filter((a) => a.teacherId === primary.id);
  const duplicatePlans = weeklySessionPlans.filter((w) => w.teacherId === duplicate.id);
  const primaryPlans = weeklySessionPlans.filter((w) => w.teacherId === primary.id);

  const conflicts: TeacherMergeConflict[] = [];

  // ── Duplicate sessions: same student + education type + exact start already
  // exists under the primary — merging would make one teacher "have" the same
  // lesson twice. ──────────────────────────────────────────────────────────────
  const clashingSessions = duplicateSessions.filter((ds) =>
    primarySessions.some(
      (ps) =>
        ps.studentId === ds.studentId &&
        ps.educationTypeId === ds.educationTypeId &&
        sameInstant(ps.date, ds.date)
    )
  );
  if (clashingSessions.length > 0) {
    conflicts.push({
      category: "session",
      count: clashingSessions.length,
      message: `${clashingSessions.length} seans, aynı öğrenci/eğitim türü/tarih ile hem "${primary.fullName}" hem "${duplicate.fullName}" kaydında mevcut — birleştirme bunları tek öğretmende yinelenmiş gösterir. Devam etmeden önce bu seansları inceleyip birini düzeltin veya silin.`,
    });
  }

  // ── Duplicate teacher payments: same date + amount + method + type on both
  // sides is very likely the same real payment recorded twice. ───────────────
  const clashingPayments = duplicatePayments.filter((dp) =>
    primaryPayments.some(
      (pp) =>
        pp.amount === dp.amount &&
        pp.method === dp.method &&
        pp.paymentType === dp.paymentType &&
        sameInstant(pp.date, dp.date)
    )
  );
  if (clashingPayments.length > 0) {
    conflicts.push({
      category: "teacherPayment",
      count: clashingPayments.length,
      message: `${clashingPayments.length} öğretmen ödemesi, aynı tarih/tutar/yöntem/tür ile her iki kayıtta da mevcut — bu ödeme tekrar sayılmış olabilir. Birleştirmeden önce hangi kaydın doğru olduğunu belirleyin.`,
    });
  }

  // ── Duplicate assignments: same educationTypeId assigned on both sides.
  // getTeacherEducationAssignment() resolves via `.find()` (first match), so
  // having both rows survive under one teacherId would make the effective
  // assignment ambiguous/order-dependent — always unsafe, regardless of
  // whether the earning amounts happen to match. ─────────────────────────────
  const primaryEducationTypeIds = new Set(primaryAssignments.map((a) => a.educationTypeId));
  const clashingAssignments = duplicateAssignments.filter((a) => primaryEducationTypeIds.has(a.educationTypeId));
  if (clashingAssignments.length > 0) {
    const names = clashingAssignments
      .map((a) => educationTypes.find((et) => et.id === a.educationTypeId)?.name ?? a.educationTypeId)
      .join(", ");
    conflicts.push({
      category: "teacherEducationTypeAssignment",
      count: clashingAssignments.length,
      message: `${clashingAssignments.length} eğitim türü için (${names}) her iki öğretmende de bir atama tanımlı — birleştirme sonrası hangisinin geçerli olacağı belirsiz kalır. Birleştirmeden önce birinden kaldırın.`,
    });
  }

  // ── Duplicate weekly plans: same student with an overlapping weekly slot
  // (day + time) and overlapping date range active on both sides. ────────────
  const clashingPlans = duplicatePlans.filter((dp) => {
    if (!dp.isActive) return false;
    const dStart = new Date(dp.startDate).getTime();
    const dEnd = new Date(dp.endDate).getTime();
    return primaryPlans.some((pp) => {
      if (!pp.isActive || pp.studentId !== dp.studentId) return false;
      const pStart = new Date(pp.startDate).getTime();
      const pEnd = new Date(pp.endDate).getTime();
      const datesOverlap = dStart <= pEnd && pStart <= dEnd;
      if (!datesOverlap) return false;
      return dp.weeklySchedule.some((slot) =>
        pp.weeklySchedule.some((s) => s.dayOfWeek === slot.dayOfWeek && s.time === slot.time)
      );
    });
  });
  if (clashingPlans.length > 0) {
    conflicts.push({
      category: "weeklyPlan",
      count: clashingPlans.length,
      message: `${clashingPlans.length} haftalık plan, aynı öğrenci ve aynı gün/saat için her iki öğretmende de aktif — birleştirme sonrası çakışan seans üretebilir. Birleştirmeden önce planlardan birini pasif hale getirin.`,
    });
  }

  return {
    counts: {
      sessions: duplicateSessions.length,
      teacherEarnings: duplicateEarnings.length,
      teacherPayments: duplicatePayments.length,
      assignments: duplicateAssignments.length,
      weeklyPlans: duplicatePlans.length,
      calendarReferences: duplicateSessions.length,
    },
    conflicts,
    isSafe: conflicts.length === 0,
  };
}
