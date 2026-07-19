"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Student,
  Guardian,
  Teacher,
  Session,
  Payment,
  TeacherEarning,
  TeacherPayment,
  TeacherCustomPrice,
  InstallmentPlan,
  CashMovement,
  WeeklySessionPlan,
  OpeningBalance,
  ImportBatch,
  TeacherMergeHistory,
  EducationType,
} from "@/types";
import { mockStudents, mockGuardians, DEMO_STUDENTS, DEMO_GUARDIANS } from "@/lib/mock/students";
import { mockTeachers } from "@/lib/mock/teachers";
import { mockSessions } from "@/lib/mock/sessions";
import { mockPayments } from "@/lib/mock/payments";
import { mockTeacherEarnings } from "@/lib/mock/teacher-earnings";
import { mockTeacherPayments } from "@/lib/mock/teacher-payments";
import { mockTeacherCustomPrices } from "@/lib/mock/teacher-custom-prices";
import { mockInstallmentPlans } from "@/lib/mock/installment-plans";
import { mockCashMovements } from "@/lib/mock/cash-movements";
import { mockWeeklySessionPlans } from "@/lib/mock/weekly-session-plans";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { buildInstallmentPayment } from "@/lib/helpers/installments";
import {
  DEFAULT_SESSION_DURATION_MINUTES,
  AUTO_COMPLETE_GRACE_MINUTES,
  EARNING_STATUSES,
  calculateSessionTeacherEarning,
  getTeacherEarningTotals,
} from "@/lib/helpers/finance";
import { buildTeacherMergePreview } from "@/lib/helpers/teacher-merge";
import { getEducationTypeUsage, canDeleteEducationType } from "@/lib/helpers/education-types";

// Upserts the TeacherEarning ledger row for a single session, keyed by sessionId so
// re-saving the same completed session updates the existing row instead of duplicating it.
// Sessions that aren't earning-eligible (or whose computed earning is 0, e.g. salary-based
// teachers whose pay is tracked monthly, not per session) have their row removed instead.
function upsertEarningForSession(
  prev: TeacherEarning[],
  session: Session
): TeacherEarning[] {
  const withoutThisSession = prev.filter((e) => e.sessionId !== session.id);
  const amount = calculateSessionTeacherEarning(session);

  if (!EARNING_STATUSES.includes(session.status) || amount <= 0) {
    return withoutThisSession;
  }

  // amount > 0 here (guarded above), so this can only ever be a real calculated
  // figure — an "unknown" session's teacherEarning is always 0 and never reaches
  // this point (see resolveTeacherEarningStatus in finance.ts).
  const existing = prev.find((e) => e.sessionId === session.id);
  const earning: TeacherEarning = existing
    ? { ...existing, teacherId: session.teacherId, amount, calculationStatus: "calculated" }
    : {
        id: `earning-${session.id}`,
        tenantId: session.tenantId,
        teacherId: session.teacherId,
        sessionId: session.id,
        amount,
        status: "pending",
        calculationStatus: "calculated",
        createdAt: new Date().toISOString(),
      };

  return [...withoutThisSession, earning];
}

// ─── Notification types ────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  type: "session_auto_completed";
  sessionId: string;
  studentId: string;
  teacherId: string;
  sessionDate: string;
  createdAt: string;
  readAt?: string;
}

// ─── Store shape ───────────────────────────────────────────────────────────────

// ─── Delete / soft-delete — intentionally not implemented ──────────────────────
// Audit finding: there's no delete action for Student, Teacher, Guardian, Payment, or
// TeacherPayment (only CashMovement and WeeklySessionPlan support delete today).
//
// This is deliberate, not an oversight to silently fix: every financial calculation in
// this app (getStudentDebt, getTeacherEarningTotals, current-account.ts, every Report)
// walks the *entire* sessions/payments/teacherPayments history for a student or teacher.
// A hard delete of a Student/Teacher would orphan every Session/Payment/TeacherPayment
// that references it (names would render as "—", but the financial totals computed
// from those orphaned rows would still silently count toward aggregates like Dashboard's
// pendingPayments/pendingEarnings) — the data would still be *there*, just unreachable
// through the entity it belongs to. A hard delete of a Payment or TeacherPayment is worse:
// it directly rewrites financial history (accrual/collection totals, Önceki Devir, Kalan
// Borç) with no audit trail that a payment was ever recorded and then removed — the kind
// of silent mutation an accounting system should never allow.
//
// Recommendation for later: soft-delete/archive (an `archived`/`status: "inactive"` flag)
// for Student/Teacher/Guardian, hiding them from active pickers and lists while keeping
// every historical Session/Payment/TeacherPayment fully intact for reporting. For Payment
// and TeacherPayment specifically, prefer a reversing/correcting entry (a negative-amount
// or "void" record with a reason) over any delete at all, so the ledger always explains
// itself. Sessions should likely follow the same reversing pattern once cancellation
// audit trails matter, rather than ever being removed outright.
interface MockStore {
  students: Student[];
  guardians: Guardian[];
  teachers: Teacher[];
  educationTypes: EducationType[];
  sessions: Session[];
  payments: Payment[];
  teacherEarnings: TeacherEarning[];
  teacherPayments: TeacherPayment[];
  teacherCustomPrices: TeacherCustomPrice[];
  installmentPlans: InstallmentPlan[];
  cashMovements: CashMovement[];
  openingBalances: OpeningBalance[];
  importBatches: ImportBatch[];

  addStudent: (s: Student) => void;
  updateStudent: (s: Student) => void;
  deleteStudents: (ids: string[]) => void;
  addGuardian: (g: Guardian) => void;
  updateGuardian: (g: Guardian) => void;
  deleteGuardians: (ids: string[]) => void;
  addTeacher: (t: Teacher) => void;
  updateTeacher: (t: Teacher) => void;
  deleteTeachers: (ids: string[]) => void;
  addEducationType: (et: EducationType) => void;
  updateEducationType: (et: EducationType) => void;
  setEducationTypeStatus: (id: string, status: EducationType["status"]) => void;
  /** Silently no-ops if the type is referenced by any session/student/teacher/
   *  weekly plan/custom price — re-validated against current data right before
   *  writing, never trusting caller UI state (same reasoning as mergeTeachers
   *  below). The Settings UI itself disables Sil in that case; this is the
   *  backstop — see getEducationTypeUsage/canDeleteEducationType. */
  deleteEducationType: (id: string) => void;
  addSession: (s: Session) => void;
  updateSession: (s: Session) => void;
  deleteSessions: (ids: string[]) => void;
  addPayment: (p: Payment) => void;
  updatePayment: (p: Payment) => void;
  deletePayments: (ids: string[]) => void;
  /** Records a payment to a teacher. Silently no-ops if it would exceed pending earnings. */
  addTeacherPayment: (p: TeacherPayment) => void;
  deleteTeacherPayments: (ids: string[]) => void;
  upsertTeacherCustomPricesForTeacher: (
    teacherId: string,
    tenantId: string,
    prices: { educationTypeId: string; amount: number }[]
  ) => void;
  addInstallmentPlan: (plan: InstallmentPlan) => void;
  updateInstallmentPlan: (plan: InstallmentPlan) => void;
  markInstallmentPaid: (planId: string, installmentId: string) => void;
  cancelInstallment: (planId: string, installmentId: string) => void;
  addCashMovement: (m: CashMovement) => void;
  updateCashMovement: (m: CashMovement) => void;
  deleteCashMovement: (id: string) => void;
  addOpeningBalance: (b: OpeningBalance) => void;
  deleteOpeningBalances: (ids: string[]) => void;
  addImportBatch: (batch: ImportBatch) => void;
  markImportBatchRolledBack: (batchId: string) => void;
  teacherMergeHistory: TeacherMergeHistory[];
  /** Reassigns every Session/TeacherEarning/TeacherPayment/TeacherCustomPrice/
   *  WeeklySessionPlan owned by the duplicate over to the primary, archives the
   *  duplicate, and records a TeacherMergeHistory entry. Silently no-ops (like
   *  addTeacherPayment above) if either teacher is missing, they're the same
   *  teacher, the duplicate is already archived, or buildTeacherMergePreview
   *  finds a conflict — a merge never runs on stale/unsafe UI state. */
  mergeTeachers: (params: { primaryTeacherId: string; duplicateTeacherId: string; reason?: string }) => void;
  /** Reverses a still-active merge: moves every reassigned row back to the
   *  duplicate (only rows still owned by the primary — never touches a row a
   *  later, unrelated edit moved elsewhere) and restores the duplicate's
   *  archived status. No-ops if the merge id doesn't exist or was already
   *  rolled back. */
  rollbackTeacherMerge: (mergeId: string) => void;
  weeklySessionPlans: WeeklySessionPlan[];
  addWeeklySessionPlan: (plan: WeeklySessionPlan) => void;
  updateWeeklySessionPlan: (plan: WeeklySessionPlan) => void;
  deleteWeeklySessionPlan: (id: string) => void;
  resetToDemo: () => void;
  notifications: AppNotification[];
  markAllNotificationsRead: () => void;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const MockStoreContext = createContext<MockStore | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MockDataProvider({ children }: { children: ReactNode }) {
  const [students, setStudents] = useState<Student[]>(mockStudents);
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const [guardians, setGuardians] = useState<Guardian[]>(mockGuardians);
  const [teachers, setTeachers] = useState<Teacher[]>(mockTeachers);
  const [educationTypes, setEducationTypes] = useState<EducationType[]>(mockEducationTypes);
  const educationTypesRef = useRef(educationTypes);
  educationTypesRef.current = educationTypes;
  const [sessions, setSessions] = useState<Session[]>(mockSessions);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const [payments, setPayments] = useState<Payment[]>(mockPayments);
  const [teacherEarnings, setTeacherEarnings] = useState<TeacherEarning[]>(mockTeacherEarnings);
  const [teacherPayments, setTeacherPayments] = useState<TeacherPayment[]>(mockTeacherPayments);
  // Refs so addTeacherPayment always validates against the latest pending balance,
  // even when called from a memoised handler holding a stale closure.
  const teachersRef = useRef(teachers);
  teachersRef.current = teachers;
  const teacherPaymentsRef = useRef(teacherPayments);
  teacherPaymentsRef.current = teacherPayments;
  const [teacherCustomPrices, setTeacherCustomPrices] = useState<TeacherCustomPrice[]>(
    mockTeacherCustomPrices
  );
  // Refs so mergeTeachers/rollbackTeacherMerge always compute against a single
  // consistent, current snapshot across every array they touch at once — same
  // reasoning as teachersRef/teacherPaymentsRef above.
  const teacherEarningsRef = useRef(teacherEarnings);
  teacherEarningsRef.current = teacherEarnings;
  const teacherCustomPricesRef = useRef(teacherCustomPrices);
  teacherCustomPricesRef.current = teacherCustomPrices;
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>(
    mockInstallmentPlans
  );
  // Always-current ref so markInstallmentPaid / cancelInstallment never read
  // a stale closure snapshot when called from memoised event handlers.
  const installmentPlansRef = useRef(installmentPlans);
  installmentPlansRef.current = installmentPlans;
  const [cashMovements, setCashMovements] = useState<CashMovement[]>(mockCashMovements);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [weeklySessionPlans, setWeeklySessionPlans] = useState<WeeklySessionPlan[]>(
    mockWeeklySessionPlans
  );
  const weeklySessionPlansRef = useRef(weeklySessionPlans);
  weeklySessionPlansRef.current = weeklySessionPlans;
  const [teacherMergeHistory, setTeacherMergeHistory] = useState<TeacherMergeHistory[]>([]);
  const teacherMergeHistoryRef = useRef(teacherMergeHistory);
  teacherMergeHistoryRef.current = teacherMergeHistory;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const AUTO_COMPLETE_THRESHOLD_MS =
    (DEFAULT_SESSION_DURATION_MINUTES + AUTO_COMPLETE_GRACE_MINUTES) * 60_000;

  useEffect(() => {
    function autoCompletePastPlanned() {
      const now = new Date();

      // Use the ref so the closure always sees the latest sessions.
      const toComplete = sessionsRef.current.filter((s) => {
        if (s.status !== "planned") return false;
        const start = new Date(s.date);
        return now.getTime() - start.getTime() >= AUTO_COMPLETE_THRESHOLD_MS;
      });

      if (toComplete.length === 0) return;

      const idsToComplete = new Set(toComplete.map((s) => s.id));

      setSessions((prev) =>
        prev.map((s) =>
          idsToComplete.has(s.id) ? { ...s, status: "completed" as const } : s
        )
      );

      setTeacherEarnings((prev) =>
        toComplete.reduce(
          (acc, s) => upsertEarningForSession(acc, { ...s, status: "completed" as const }),
          prev
        )
      );

      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        const fresh = toComplete
          .map((s) => ({
            id: `notif-auto-${s.id}`,
            type: "session_auto_completed" as const,
            sessionId: s.id,
            studentId: s.studentId,
            teacherId: s.teacherId,
            sessionDate: s.date,
            createdAt: new Date().toISOString(),
          }))
          .filter((n) => !existingIds.has(n.id));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
    }

    autoCompletePastPlanned();
    const timer = setInterval(autoCompletePastPlanned, 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoized so this object keeps a stable reference across renders that
  // don't touch any of the data below — e.g. toggling the sidebar re-renders
  // MockDataProvider (it's an ancestor in the tree) but none of THESE
  // dependencies change, so the memo bails out and every `useMockStore()`
  // consumer across the whole app correctly skips re-rendering too. Every
  // action below is safe to omit from the dependency list: each one only
  // closes over a stable setState function or a `*Ref.current` read (never a
  // plain state variable by value), so a "stale" version from an earlier
  // memoized call behaves identically to a freshly-created one.
  const value: MockStore = useMemo<MockStore>(
    () => ({
    students,
    guardians,
    teachers,
    educationTypes,
    sessions,
    payments,
    teacherEarnings,
    teacherPayments,
    teacherCustomPrices,
    installmentPlans,
    cashMovements,
    openingBalances,
    importBatches,
    teacherMergeHistory,

    addStudent: (s) => setStudents((prev) => [...prev, s]),
    updateStudent: (s) =>
      setStudents((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...s, importBatchId: x.importBatchId, updatedAt: new Date().toISOString() }
            : x
        )
      ),
    deleteStudents: (ids) => {
      const idSet = new Set(ids);
      setStudents((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    addGuardian: (g) => setGuardians((prev) => [...prev, g]),
    updateGuardian: (g) =>
      setGuardians((prev) =>
        prev.map((x) =>
          x.id === g.id
            ? { ...g, importBatchId: x.importBatchId, updatedAt: new Date().toISOString() }
            : x
        )
      ),
    deleteGuardians: (ids) => {
      const idSet = new Set(ids);
      setGuardians((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    addTeacher: (t) => setTeachers((prev) => [...prev, t]),
    updateTeacher: (t) =>
      setTeachers((prev) =>
        prev.map((x) =>
          x.id === t.id
            ? {
                ...t,
                importBatchId: x.importBatchId,
                // The manual edit form has no concept of archive/merge state —
                // never let a plain edit silently wipe it out from under a
                // merged-away record (same reasoning as importBatchId above).
                archivedAt: x.archivedAt,
                archivedReason: x.archivedReason,
                mergedIntoTeacherId: x.mergedIntoTeacherId,
                updatedAt: new Date().toISOString(),
              }
            : x
        )
      ),
    deleteTeachers: (ids) => {
      const idSet = new Set(ids);
      setTeachers((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    addEducationType: (et) => setEducationTypes((prev) => [...prev, et]),
    updateEducationType: (et) =>
      setEducationTypes((prev) =>
        prev.map((x) =>
          x.id === et.id ? { ...et, createdAt: x.createdAt, updatedAt: new Date().toISOString() } : x
        )
      ),
    setEducationTypeStatus: (id, status) =>
      setEducationTypes((prev) =>
        prev.map((x) =>
          x.id === id ? { ...x, status, updatedAt: new Date().toISOString() } : x
        )
      ),
    deleteEducationType: (id) => {
      const usage = getEducationTypeUsage(id, {
        sessions: sessionsRef.current,
        students: studentsRef.current,
        teachers: teachersRef.current,
        weeklySessionPlans: weeklySessionPlansRef.current,
        teacherCustomPrices: teacherCustomPricesRef.current,
      });
      if (!canDeleteEducationType(usage)) return;
      setEducationTypes((prev) => prev.filter((x) => x.id !== id));
    },

    mergeTeachers: ({ primaryTeacherId, duplicateTeacherId, reason }) => {
      if (primaryTeacherId === duplicateTeacherId) return;
      const primary = teachersRef.current.find((t) => t.id === primaryTeacherId);
      const duplicate = teachersRef.current.find((t) => t.id === duplicateTeacherId);
      if (!primary || !duplicate) return;
      if (duplicate.status === "archived") return;

      // Never trust the caller's UI state — recompute the safety check against
      // the current store right before writing anything.
      const preview = buildTeacherMergePreview(
        primary,
        duplicate,
        sessionsRef.current,
        teacherEarningsRef.current,
        teacherPaymentsRef.current,
        teacherCustomPricesRef.current,
        weeklySessionPlansRef.current,
        educationTypesRef.current
      );
      if (!preview.isSafe) return;

      const now = new Date().toISOString();

      const movedSessionIds = sessionsRef.current
        .filter((s) => s.teacherId === duplicateTeacherId)
        .map((s) => s.id);
      const movedTeacherEarningIds = teacherEarningsRef.current
        .filter((e) => e.teacherId === duplicateTeacherId)
        .map((e) => e.id);
      const movedTeacherPaymentIds = teacherPaymentsRef.current
        .filter((p) => p.teacherId === duplicateTeacherId)
        .map((p) => p.id);
      const movedWeeklyPlanIds = weeklySessionPlansRef.current
        .filter((w) => w.teacherId === duplicateTeacherId)
        .map((w) => w.id);

      // Custom prices don't just flip teacherId — a conflicting educationTypeId
      // would leave two rows under one teacher (see teacher-merge.ts), so those
      // are dropped from the live array (never happens in practice since a
      // conflict there makes preview.isSafe false above; the branch exists so
      // rollback stays correct even if this rule is ever relaxed later).
      const duplicatePrices = teacherCustomPricesRef.current.filter(
        (cp) => cp.teacherId === duplicateTeacherId
      );
      const primaryEducationTypeIds = new Set(
        teacherCustomPricesRef.current
          .filter((cp) => cp.teacherId === primaryTeacherId)
          .map((cp) => cp.educationTypeId)
      );
      const priceIdsToMove = duplicatePrices
        .filter((cp) => !primaryEducationTypeIds.has(cp.educationTypeId))
        .map((cp) => cp.id);
      const droppedPrices = duplicatePrices.filter((cp) =>
        primaryEducationTypeIds.has(cp.educationTypeId)
      );

      const movedSessionIdSet = new Set(movedSessionIds);
      setSessions((prev) =>
        prev.map((s) =>
          movedSessionIdSet.has(s.id) ? { ...s, teacherId: primaryTeacherId, updatedAt: now } : s
        )
      );
      const movedEarningIdSet = new Set(movedTeacherEarningIds);
      setTeacherEarnings((prev) =>
        prev.map((e) => (movedEarningIdSet.has(e.id) ? { ...e, teacherId: primaryTeacherId } : e))
      );
      const movedPaymentIdSet = new Set(movedTeacherPaymentIds);
      setTeacherPayments((prev) =>
        prev.map((p) =>
          movedPaymentIdSet.has(p.id) ? { ...p, teacherId: primaryTeacherId, updatedAt: now } : p
        )
      );
      const movedPlanIdSet = new Set(movedWeeklyPlanIds);
      setWeeklySessionPlans((prev) =>
        prev.map((w) =>
          movedPlanIdSet.has(w.id) ? { ...w, teacherId: primaryTeacherId, updatedAt: now } : w
        )
      );
      const priceIdsToMoveSet = new Set(priceIdsToMove);
      setTeacherCustomPrices((prev) =>
        prev
          .filter((cp) => cp.teacherId !== duplicateTeacherId)
          .concat(
            duplicatePrices
              .filter((cp) => priceIdsToMoveSet.has(cp.id))
              .map((cp) => ({ ...cp, teacherId: primaryTeacherId }))
          )
      );
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === duplicateTeacherId
            ? {
                ...t,
                status: "archived" as const,
                archivedAt: now,
                archivedReason: `${primary.fullName} ile birleştirildi`,
                mergedIntoTeacherId: primaryTeacherId,
                updatedAt: now,
              }
            : t
        )
      );

      const historyEntry: TeacherMergeHistory = {
        id: `merge-${duplicateTeacherId}-${Date.now()}`,
        tenantId: primary.tenantId,
        primaryTeacherId,
        primaryTeacherName: primary.fullName,
        duplicateTeacherId,
        duplicateTeacherName: duplicate.fullName,
        mergedAt: now,
        mergedBy: "Sistem Kullanıcısı",
        reason: reason?.trim() || `${duplicate.fullName} → ${primary.fullName} birleştirildi`,
        moved: {
          sessions: movedSessionIds.length,
          teacherEarnings: movedTeacherEarningIds.length,
          teacherPayments: movedTeacherPaymentIds.length,
          teacherCustomPrices: priceIdsToMove.length,
          weeklyPlans: movedWeeklyPlanIds.length,
        },
        snapshot: {
          duplicateTeacher: duplicate,
          movedSessionIds,
          movedTeacherEarningIds,
          movedTeacherPaymentIds,
          movedWeeklyPlanIds,
          movedTeacherCustomPriceIds: priceIdsToMove,
          droppedTeacherCustomPrices: droppedPrices,
        },
      };
      setTeacherMergeHistory((prev) => [...prev, historyEntry]);
    },

    rollbackTeacherMerge: (mergeId) => {
      const entry = teacherMergeHistoryRef.current.find((h) => h.id === mergeId);
      if (!entry || entry.rolledBackAt) return;

      const now = new Date().toISOString();
      const { primaryTeacherId, duplicateTeacherId, snapshot } = entry;
      const movedSessionIdSet = new Set(snapshot.movedSessionIds);
      const movedEarningIdSet = new Set(snapshot.movedTeacherEarningIds);
      const movedPaymentIdSet = new Set(snapshot.movedTeacherPaymentIds);
      const movedPlanIdSet = new Set(snapshot.movedWeeklyPlanIds);
      const movedPriceIdSet = new Set(snapshot.movedTeacherCustomPriceIds);

      // Only flip back rows still owned by the primary — if something else
      // reassigned one of these since the merge, that later, unrelated change
      // is left alone rather than overwritten.
      setSessions((prev) =>
        prev.map((s) =>
          movedSessionIdSet.has(s.id) && s.teacherId === primaryTeacherId
            ? { ...s, teacherId: duplicateTeacherId, updatedAt: now }
            : s
        )
      );
      setTeacherEarnings((prev) =>
        prev.map((e) =>
          movedEarningIdSet.has(e.id) && e.teacherId === primaryTeacherId
            ? { ...e, teacherId: duplicateTeacherId }
            : e
        )
      );
      setTeacherPayments((prev) =>
        prev.map((p) =>
          movedPaymentIdSet.has(p.id) && p.teacherId === primaryTeacherId
            ? { ...p, teacherId: duplicateTeacherId, updatedAt: now }
            : p
        )
      );
      setWeeklySessionPlans((prev) =>
        prev.map((w) =>
          movedPlanIdSet.has(w.id) && w.teacherId === primaryTeacherId
            ? { ...w, teacherId: duplicateTeacherId, updatedAt: now }
            : w
        )
      );
      setTeacherCustomPrices((prev) => [
        ...prev.map((cp) =>
          movedPriceIdSet.has(cp.id) && cp.teacherId === primaryTeacherId
            ? { ...cp, teacherId: duplicateTeacherId }
            : cp
        ),
        ...snapshot.droppedTeacherCustomPrices,
      ]);
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === duplicateTeacherId
            ? {
                ...t,
                status: snapshot.duplicateTeacher.status,
                archivedAt: undefined,
                archivedReason: undefined,
                mergedIntoTeacherId: undefined,
                updatedAt: now,
              }
            : t
        )
      );
      setTeacherMergeHistory((prev) =>
        prev.map((h) => (h.id === mergeId ? { ...h, rolledBackAt: now } : h))
      );
    },

    addSession: (s) => {
      setSessions((prev) => [...prev, s]);
      setTeacherEarnings((prev) => upsertEarningForSession(prev, s));
    },
    updateSession: (s) => {
      setSessions((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...s, importBatchId: x.importBatchId, updatedAt: new Date().toISOString() }
            : x
        )
      );
      setTeacherEarnings((prev) => upsertEarningForSession(prev, s));
    },
    deleteSessions: (ids) => {
      const idSet = new Set(ids);
      setSessions((prev) => prev.filter((x) => !idSet.has(x.id)));
      setTeacherEarnings((prev) => prev.filter((e) => !idSet.has(e.sessionId)));
    },

    addPayment: (p) => setPayments((prev) => [...prev, p]),
    updatePayment: (p) =>
      setPayments((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? { ...p, importBatchId: x.importBatchId, updatedAt: new Date().toISOString() }
            : x
        )
      ),
    deletePayments: (ids) => {
      const idSet = new Set(ids);
      setPayments((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    addTeacherPayment: (p) => {
      // Guard: never let a teacher payment push paid past what's actually owed.
      // Read from refs so this is correct even from a stale memoised handler.
      const teacher = teachersRef.current.find((t) => t.id === p.teacherId);
      if (!teacher || p.amount <= 0) return;
      const { pendingEarning } = getTeacherEarningTotals(
        teacher,
        sessionsRef.current,
        teacherPaymentsRef.current
      );
      if (p.amount > pendingEarning) return;
      setTeacherPayments((prev) => [...prev, p]);
    },
    deleteTeacherPayments: (ids) => {
      const idSet = new Set(ids);
      setTeacherPayments((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    upsertTeacherCustomPricesForTeacher: (teacherId, tenantId, prices) => {
      setTeacherCustomPrices((prev) => {
        const withoutTeacher = prev.filter((tcp) => tcp.teacherId !== teacherId);
        const newPrices = prices
          .filter((p) => p.amount > 0)
          .map((p, i) => ({
            id: `tcp-${teacherId}-${p.educationTypeId}-${Date.now()}-${i}`,
            tenantId,
            teacherId,
            educationTypeId: p.educationTypeId,
            customEarning: p.amount,
            createdAt: new Date().toISOString(),
          }));
        return [...withoutTeacher, ...newPrices];
      });
    },

    addInstallmentPlan: (plan) =>
      setInstallmentPlans((prev) => [...prev, plan]),

    updateInstallmentPlan: (plan) =>
      setInstallmentPlans((prev) => prev.map((x) => (x.id === plan.id ? plan : x))),

    markInstallmentPaid: (planId, installmentId) => {
      const today = new Date().toISOString().split("T")[0]!;

      // Read from the ref so we always get the latest value even when this
      // function was captured in a memoised handler from an earlier render.
      const plan = installmentPlansRef.current.find((p) => p.id === planId);
      const record = plan?.installments.find((i) => i.id === installmentId);

      // Guard: only proceed if the installment exists and is not already paid.
      if (!plan || !record || record.status === "paid") return;

      // 1. Mark the installment record as paid (functional updater = always fresh).
      setInstallmentPlans((prev) =>
        prev.map((p) => {
          if (p.id !== planId) return p;
          return {
            ...p,
            installments: p.installments.map((inst) =>
              inst.id === installmentId
                ? { ...inst, status: "paid" as const, paidDate: today }
                : inst
            ),
          };
        })
      );

      // 2. Create a linked Payment record (idempotent: skip if one already exists).
      // `plan` and `record` come from the ref read above — same snapshot that
      // setInstallmentPlans receives as `prev`, so the data is consistent.
      setPayments((prev) => {
        const alreadyExists = prev.some(
          (p) =>
            p.installmentPlanId === planId &&
            p.installmentNumber === record.installmentNumber
        );
        if (alreadyExists) return prev;
        return [...prev, buildInstallmentPayment(plan, record, today)];
      });
    },

    addCashMovement: (m) => setCashMovements((prev) => [...prev, m]),

    updateCashMovement: (m) =>
      setCashMovements((prev) => prev.map((x) => (x.id === m.id ? m : x))),

    deleteCashMovement: (id) =>
      setCashMovements((prev) => prev.filter((x) => x.id !== id)),

    addOpeningBalance: (b) => setOpeningBalances((prev) => [...prev, b]),
    deleteOpeningBalances: (ids) => {
      const idSet = new Set(ids);
      setOpeningBalances((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    addImportBatch: (batch) => setImportBatches((prev) => [...prev, batch]),
    markImportBatchRolledBack: (batchId) =>
      setImportBatches((prev) =>
        prev.map((b) =>
          b.id === batchId ? { ...b, rolledBackAt: new Date().toISOString() } : b
        )
      ),

    weeklySessionPlans,

    addWeeklySessionPlan: (plan) =>
      setWeeklySessionPlans((prev) => [...prev, plan]),

    updateWeeklySessionPlan: (plan) =>
      setWeeklySessionPlans((prev) =>
        prev.map((x) =>
          x.id === plan.id ? { ...plan, updatedAt: new Date().toISOString() } : x
        )
      ),

    deleteWeeklySessionPlan: (id) => {
      setWeeklySessionPlans((prev) => prev.filter((x) => x.id !== id));
      // Remove future planned sessions that belong to this plan only
      const now = new Date();
      setSessions((prev) =>
        prev.filter((s) => {
          if (s.weeklyPlanId !== id) return true;
          if (s.status !== "planned") return true;
          return new Date(s.date) <= now; // keep past planned (edge case)
        })
      );
    },

    resetToDemo: () => {
      setStudents([...DEMO_STUDENTS]);
      setGuardians([...DEMO_GUARDIANS]);
      setTeachers([...mockTeachers]);
      setEducationTypes([...mockEducationTypes]);
      setSessions([]);
      setPayments([]);
      setTeacherEarnings([]);
      setTeacherPayments([]);
      setTeacherCustomPrices([...mockTeacherCustomPrices]);
      setInstallmentPlans([]);
      setCashMovements([]);
      setWeeklySessionPlans([]);
      setNotifications([]);
      setOpeningBalances([]);
      setImportBatches([]);
      setTeacherMergeHistory([]);
    },

    notifications,
    markAllNotificationsRead: () =>
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
      ),

    cancelInstallment: (planId, installmentId) => {
      // Guard: never cancel a paid installment (payment already created).
      // Read from ref for the same reason as markInstallmentPaid.
      const plan = installmentPlansRef.current.find((p) => p.id === planId);
      const record = plan?.installments.find((i) => i.id === installmentId);
      if (!plan || !record || record.status === "paid") return;

      setInstallmentPlans((prev) =>
        prev.map((p) => {
          if (p.id !== planId) return p;
          return {
            ...p,
            installments: p.installments.map((inst) =>
              inst.id === installmentId
                ? { ...inst, status: "cancelled" as const }
                : inst
            ),
          };
        })
      );
    },
    }),
    // Action functions are intentionally omitted below; see the comment above
    // `value` for why that's safe (each one only closes over a stable setState
    // function or a ref read).
    [
      students,
      guardians,
      teachers,
      educationTypes,
      sessions,
      payments,
      teacherEarnings,
      teacherPayments,
      teacherCustomPrices,
      installmentPlans,
      cashMovements,
      openingBalances,
      importBatches,
      teacherMergeHistory,
      weeklySessionPlans,
      notifications,
    ]
  );

  return (
    <MockStoreContext.Provider value={value}>
      {children}
    </MockStoreContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useMockStore(): MockStore {
  const ctx = useContext(MockStoreContext);
  if (!ctx) throw new Error("useMockStore must be used within MockDataProvider");
  return ctx;
}
