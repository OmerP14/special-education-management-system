import type { PersistedState } from "@/lib/data/store";
import type { Session, WeeklySessionPlan } from "@/types";
import { mergeStates } from "@/lib/data/merge";
import { applyMakeupBilling } from "@/lib/helpers/finance-rules";
import { calculateTeacherSessionEarning, getDefaultStudentPrice, withEarningFactor } from "@/lib/helpers/finance";
import { getTeacherEducationAssignment } from "@/lib/helpers/teacher-assignments";
import { upsertEarningForSession } from "@/lib/helpers/earning-ledger";
import { normalizeInstitutionSettings } from "@/lib/settings/defaults";
import { setActiveSettings } from "@/lib/settings/runtime";

// ─── What a staff ("personel") account may see and change ──────────────────
//
// Staff schedule lessons; they never see money. So the server — not the page —
// decides what reaches their browser:
//
//   read   — stripForStaff(): no payments, teacher payments, earnings, devir,
//            import history or merge snapshots, no finance notifications, and
//            every price/pay field zeroed or removed.
//   write  — applyStaffChanges(): only students, sessions and weekly plans
//            are taken from a staff save, with the same fields stripped, and
//            merged onto the real document. Staff can't delete students, nor
//            lessons that already happened (they carry debt and pay) — only
//            planned ones, as deleting a weekly plan does. Prices and teacher earnings of
//            the lessons they add or change are then filled in here, from the
//            education type's default price and the teacher's rate — exactly
//            what the lesson form would have filled in for an admin.

const HIDDEN_COLLECTIONS = [
  "payments",
  "teacherPayments",
  "teacherEarnings",
  "openingBalances",
  "importBatches",
  "teacherMergeHistory",
] as const;

/** Collections a staff save may change; everything else is read-only. */
const WRITABLE_COLLECTIONS = ["students", "sessions", "weeklySessionPlans"] as const;

type Doc = Record<string, unknown>;
type Rec = Record<string, unknown>;

const list = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);

function omit(record: Rec, keys: string[]): Rec {
  const out = { ...record };
  for (const k of keys) delete out[k];
  return out;
}

const stripSession = (s: Rec): Rec => ({
  ...omit(s, ["earningFactor", "earningApprovedAt", "teacherEarningStatus"]),
  studentPrice: 0,
  teacherEarning: 0,
});
const stripPlan = (p: Rec): Rec => ({ ...p, studentPrice: 0, teacherEarning: 0 });
const stripTeacher = (t: Rec): Rec =>
  omit(t, ["earningType", "monthlySalary", "includedSessionQuota", "extraSessionEarning", "earningPercentage", "openingBalance"]);
const stripEducationType = (e: Rec): Rec => ({ ...e, defaultStudentPrice: 0 });
const stripAssignment = (a: Rec): Rec => ({ ...a, earningAmount: null });
const stripStudent = (s: Rec): Rec => s;

/** Settings sections a staff page needs (institution name, calendar, lesson
 *  rules, student form rules); finance, pay rules and backups stay behind —
 *  the staff browser fills those with defaults it never saves. */
const VISIBLE_SETTINGS = ["institution", "calendar", "sessions", "students"];

function stripSettings(settings: unknown): Rec {
  const s = (settings && typeof settings === "object" ? settings : {}) as Rec;
  const out: Rec = {};
  for (const key of VISIBLE_SETTINGS) if (key in s) out[key] = s[key];
  return out;
}

export function stripForStaff(full: PersistedState): PersistedState {
  const d = full as unknown as Doc;
  const out: Doc = { ...d };
  for (const key of HIDDEN_COLLECTIONS) delete out[key];
  out.students = list(d.students).map(stripStudent);
  out.sessions = list(d.sessions).map(stripSession);
  out.weeklySessionPlans = list(d.weeklySessionPlans).map(stripPlan);
  out.teachers = list(d.teachers).map(stripTeacher);
  out.educationTypes = list(d.educationTypes).map(stripEducationType);
  out.teacherEducationTypeAssignments = list(d.teacherEducationTypeAssignments).map(stripAssignment);
  out.notifications = list(d.notifications).filter((n) => n.event !== "payment_received");
  out.institutionSettings = stripSettings(d.institutionSettings);
  return out as unknown as PersistedState;
}

/** Price, teacher earning and its status for a lesson, as the lesson form
 *  fills them in from the current education types and teacher rates. */
function priceLesson<T extends Session | WeeklySessionPlan>(lesson: T, full: PersistedState): T {
  const studentPrice = getDefaultStudentPrice(lesson.educationTypeId, full.educationTypes ?? []);
  const teacher = (full.teachers ?? []).find((t) => t.id === lesson.teacherId);
  const assignments = full.teacherEducationTypeAssignments ?? [];
  const teacherEarning = teacher ? (calculateTeacherSessionEarning(teacher, lesson.educationTypeId, studentPrice, assignments) ?? 0) : 0;
  const assignment = getTeacherEducationAssignment(lesson.teacherId, lesson.educationTypeId, assignments);
  const hasRate = !!assignment && assignment.status === "active" && assignment.earningAmount !== null;
  const unknown = teacher?.earningType === "per_session" && !hasRate;
  return {
    ...lesson,
    studentPrice,
    teacherEarning,
    ...("status" in lesson ? { teacherEarningStatus: unknown ? "unknown" : "calculated" } : {}),
  };
}

const lessonChanged = (a: Session | WeeklySessionPlan, b: Session | WeeklySessionPlan) =>
  a.teacherId !== b.teacherId || a.educationTypeId !== b.educationTypeId;

/** The real document with a staff save applied. `staffData` is whatever the
 *  staff browser sent — never trusted beyond the writable collections. */
export function applyStaffChanges(full: PersistedState, staffData: unknown): PersistedState {
  const base = stripForStaff(full);
  const sent = (staffData && typeof staffData === "object" ? staffData : {}) as Doc;
  const local: Doc = { ...(base as unknown as Doc) };
  const keepMissing = (sentList: Rec[], baseList: Rec[], deletable: (r: Rec) => boolean) => {
    const ids = new Set(sentList.map((r) => r.id));
    return [...sentList, ...baseList.filter((r) => !ids.has(r.id) && !deletable(r))];
  };
  local.students = keepMissing(list(sent.students).map(stripStudent), list(base.students), () => false);
  local.sessions = keepMissing(list(sent.sessions).map(stripSession), list(base.sessions), (r) => r.status === "planned");
  local.weeklySessionPlans = list(sent.weeklySessionPlans).map(stripPlan);
  const merged = mergeStates(base, local as unknown as PersistedState, full);

  const settings = normalizeInstitutionSettings(full.institutionSettings);
  setActiveSettings(settings);
  const policy = settings.teacherEarnings;
  const before = new Map((full.sessions ?? []).map((s) => [s.id, s]));
  const beforePlans = new Map((full.weeklySessionPlans ?? []).map((p) => [p.id, p]));

  let earnings = full.teacherEarnings ?? [];
  const sessions = (merged.sessions ?? []).map((s) => {
    const previous = before.get(s.id);
    let next = s;
    if (!previous || lessonChanged(previous, s)) next = priceLesson(next, full);
    if (!previous || previous.status !== next.status) {
      if (previous?.status !== "makeup") next = applyMakeupBilling(next, settings.sessions);
      next = { ...withEarningFactor(next, policy), earningApprovedAt: undefined };
    }
    if (next !== s || !previous) earnings = upsertEarningForSession(earnings, next, policy);
    return next;
  });
  const kept = new Set(sessions.map((s) => s.id));
  earnings = earnings.filter((e) => kept.has(e.sessionId));

  const weeklySessionPlans = (merged.weeklySessionPlans ?? []).map((p) => {
    const previous = beforePlans.get(p.id);
    return !previous || lessonChanged(previous, p) ? priceLesson(p, full) : p;
  });

  return { ...merged, sessions, weeklySessionPlans, teacherEarnings: earnings };
}

export const STAFF_WRITABLE_COLLECTIONS = WRITABLE_COLLECTIONS;
