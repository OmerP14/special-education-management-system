import type { Session, SessionStatus } from "@/types";

/**
 * Statuses that occupy a student's/teacher's calendar slot. Cancelled and no-show
 * sessions free up the slot — a new session can be booked over them without conflict.
 */
export const CONFLICT_BLOCKING_STATUSES: SessionStatus[] = ["planned", "completed", "makeup"];

export const DEFAULT_CONFLICT_DURATION_MINUTES = 40;

export type SessionConflictType = "student" | "teacher" | "both";

export interface CheckSessionConflictParams {
  sessions: Session[];
  studentId: string;
  teacherId: string;
  /** ISO datetime string for the session's start. */
  startsAt: string;
  durationMinutes: number;
  /** Exclude this session id from the check (editing a session must not conflict with itself). */
  excludeSessionId?: string;
  /** Optional, together with `fee` — refines the message to "already exists" for an exact
   *  duplicate (same student + teacher + education type + start + fee), not just an overlap. */
  educationTypeId?: string;
  fee?: number;
  /** Settings → Seans Ayarları "Aynı öğrenci/öğretmen çakışmasını engelle" — both default
   *  true (today's unconditional behavior), so every existing caller (Excel import
   *  pipelines, weekly plan generation) that never passes these is completely unaffected.
   *  Only the interactive session form wires these to institutionSettings.sessions. */
  preventStudentConflict?: boolean;
  preventTeacherConflict?: boolean;
  /** Settings → "Tam çakışma / kısmi çakışma davranışı". true (default) keeps today's
   *  behavior — any time-range intersection blocks. false narrows blocking to an exact
   *  same start+end match only, letting partially-overlapping bookings through. */
  blockPartialOverlap?: boolean;
}

export interface SessionConflictResult {
  hasConflict: boolean;
  /** True when the conflict is an exact duplicate (same student/teacher/educationType/start/fee). */
  isDuplicate: boolean;
  conflictType: SessionConflictType | null;
  conflictingSessions: Session[];
  message: string | null;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * The single source of truth for "is this student/teacher already booked at this time".
 * Used by every session-creating entry point (New/Edit Session, Weekly Plan generation,
 * Copy plan, Extend plan) so conflict rules never drift between forms.
 *
 * Overlap is duration-aware, not just same-start-time: two sessions conflict whenever
 * their [start, start+duration) ranges intersect. Cancelled/no-show sessions never block.
 */
export function checkSessionConflict({
  sessions,
  studentId,
  teacherId,
  startsAt,
  durationMinutes,
  excludeSessionId,
  educationTypeId,
  fee,
  preventStudentConflict = true,
  preventTeacherConflict = true,
  blockPartialOverlap = true,
}: CheckSessionConflictParams): SessionConflictResult {
  const newStart = new Date(startsAt).getTime();
  const newEnd = newStart + durationMinutes * 60_000;

  // Both toggles off means conflict checking is entirely disabled — nothing
  // left that could ever be flagged as student- or teacher-blocking.
  if (!preventStudentConflict && !preventTeacherConflict) {
    return { hasConflict: false, isDuplicate: false, conflictType: null, conflictingSessions: [], message: null };
  }

  const conflictingSessions = sessions.filter((s) => {
    if (excludeSessionId && s.id === excludeSessionId) return false;
    if (!CONFLICT_BLOCKING_STATUSES.includes(s.status)) return false;

    const isStudentMatch = s.studentId === studentId;
    const isTeacherMatch = s.teacherId === teacherId;
    if (!isStudentMatch && !isTeacherMatch) return false;
    // A match on the side whose checking is turned off doesn't count on its own.
    if (isStudentMatch && !isTeacherMatch && !preventStudentConflict) return false;
    if (isTeacherMatch && !isStudentMatch && !preventTeacherConflict) return false;
    if (isStudentMatch && isTeacherMatch && !preventStudentConflict && !preventTeacherConflict) return false;

    const existingStart = new Date(s.date).getTime();
    const existingEnd = existingStart + (s.durationMinutes || DEFAULT_CONFLICT_DURATION_MINUTES) * 60_000;
    return blockPartialOverlap
      ? rangesOverlap(newStart, newEnd, existingStart, existingEnd)
      : existingStart === newStart && existingEnd === newEnd;
  });

  if (conflictingSessions.length === 0) {
    return { hasConflict: false, isDuplicate: false, conflictType: null, conflictingSessions: [], message: null };
  }

  const hasStudentConflict = preventStudentConflict && conflictingSessions.some((s) => s.studentId === studentId);
  const hasTeacherConflict = preventTeacherConflict && conflictingSessions.some((s) => s.teacherId === teacherId);
  const conflictType: SessionConflictType =
    hasStudentConflict && hasTeacherConflict ? "both" : hasStudentConflict ? "student" : "teacher";

  const isDuplicate =
    educationTypeId !== undefined &&
    fee !== undefined &&
    conflictingSessions.some(
      (s) =>
        s.studentId === studentId &&
        s.teacherId === teacherId &&
        s.educationTypeId === educationTypeId &&
        s.studentPrice === fee &&
        new Date(s.date).getTime() === newStart
    );

  const message = isDuplicate
    ? "Bu seans zaten mevcut."
    : conflictType === "both"
      ? "Bu öğrenci ve öğretmen seçilen saatte başka bir seansa kayıtlı."
      : conflictType === "student"
        ? "Bu öğrenci aynı saatte başka bir seansa kayıtlı."
        : "Bu öğretmen aynı saatte başka bir seansa kayıtlı.";

  return { hasConflict: true, isDuplicate, conflictType, conflictingSessions, message };
}

// ─── Indexed variant (Excel Import staging) ─────────────────────────────────────
// checkSessionConflict above filters the FULL sessions array on every call, which is
// fine for the rest of the app (called once per user action against a bounded,
// not-growing array) but is an O(n) scan repeated once per row during import staging,
// where the sessions array itself grows by one every row — O(n^2) overall. This index
// narrows the candidate set to just the sessions already known to touch this specific
// student or teacher before running the exact same overlap logic, so a large import
// only pays for its own person's session count, not the whole table's.

export interface SessionConflictIndex {
  byStudent: Map<string, Session[]>;
  byTeacher: Map<string, Session[]>;
}

function pushIndexed(map: Map<string, Session[]>, key: string, session: Session): void {
  const bucket = map.get(key);
  if (bucket) bucket.push(session);
  else map.set(key, [session]);
}

export function buildSessionConflictIndex(sessions: Session[]): SessionConflictIndex {
  const byStudent = new Map<string, Session[]>();
  const byTeacher = new Map<string, Session[]>();
  for (const s of sessions) {
    pushIndexed(byStudent, s.studentId, s);
    pushIndexed(byTeacher, s.teacherId, s);
  }
  return { byStudent, byTeacher };
}

export function addSessionToConflictIndex(index: SessionConflictIndex, session: Session): void {
  pushIndexed(index.byStudent, session.studentId, session);
  pushIndexed(index.byTeacher, session.teacherId, session);
}

export function checkSessionConflictIndexed(
  index: SessionConflictIndex,
  params: Omit<CheckSessionConflictParams, "sessions">
): SessionConflictResult {
  const candidates = new Map<string, Session>();
  for (const s of index.byStudent.get(params.studentId) ?? []) candidates.set(s.id, s);
  for (const s of index.byTeacher.get(params.teacherId) ?? []) candidates.set(s.id, s);
  return checkSessionConflict({ ...params, sessions: [...candidates.values()] });
}

// ─── Batch variant (weekly plan generation / extend / copy) ────────────────────

export interface BatchConflictEntry {
  date: string;
  result: SessionConflictResult;
}

/**
 * Runs checkSessionConflict once per candidate date and splits them into dates safe to
 * create vs. dates that must be skipped because they'd double-book the student or teacher.
 * Bulk generation never force-creates a conflicting session — it skips it and reports why,
 * so a plan with one bad slot doesn't block the rest of the batch (and never silently
 * creates an invalid session either).
 */
export function partitionDatesByConflict(
  dates: string[],
  studentId: string,
  teacherId: string,
  durationMinutes: number,
  sessions: Session[]
): { datesToCreate: string[]; conflicts: BatchConflictEntry[] } {
  const datesToCreate: string[] = [];
  const conflicts: BatchConflictEntry[] = [];

  for (const date of dates) {
    const result = checkSessionConflict({ sessions, studentId, teacherId, startsAt: date, durationMinutes });
    if (result.hasConflict) {
      conflicts.push({ date, result });
    } else {
      datesToCreate.push(date);
    }
  }

  return { datesToCreate, conflicts };
}
