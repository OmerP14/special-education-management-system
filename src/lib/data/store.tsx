"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Student,
  Guardian,
  Teacher,
  Session,
  Payment,
  TeacherEarning,
  TeacherPayment,
  TeacherEducationTypeAssignment,
  WeeklySessionPlan,
  OpeningBalance,
  ImportBatch,
  TeacherMergeHistory,
  EducationType,
} from "@/types";
import type {
  InstitutionSettings,
  InstitutionSettingsKey,
  TeacherEarningsSettings,
  StudentSettings,
} from "@/types/settings";
import { getSettingsDefaults, normalizeInstitutionSettings } from "@/lib/settings/defaults";
import { getActiveSettings, setActiveSettings } from "@/lib/settings/runtime";
import { dataSource } from "@/lib/data/source";
import {
  DEFAULT_SESSION_DURATION_MINUTES,
  getSessionEarningAmount,
  isEarningSession,
  withEarningFactor,
  getTeacherEarningTotals,
  formatCurrency,
} from "@/lib/helpers/finance";
import { buildTeacherMergePreview } from "@/lib/helpers/teacher-merge";
import { assignStudentNumber, backfillStudentNumbers } from "@/lib/helpers/student-rules";
import {
  buildPaymentNotification,
  buildSessionNotification,
  collectTimedNotifications,
  mergeNotifications,
  normalizeNotifications,
  type AppNotification,
} from "@/lib/helpers/notifications";
import {
  applyMakeupBilling,
  assignReceiptNumber,
  canExceedPendingEarning,
  getAllowedTeacherPaymentTypes,
} from "@/lib/helpers/finance-rules";
import { getEducationTypeUsage, canDeleteEducationType } from "@/lib/helpers/education-types";
import { createId } from "@/lib/data/ids";

// Upserts the TeacherEarning ledger row for a single session, keyed by sessionId so
// re-saving the same completed session updates the existing row instead of duplicating it.
// Sessions that aren't earning-eligible (or whose computed earning is 0, e.g. salary-based
// teachers whose pay is tracked monthly, not per session) have their row removed instead.
function upsertEarningForSession(
  prev: TeacherEarning[],
  session: Session,
  policy: TeacherEarningsSettings = getActiveSettings().teacherEarnings
): TeacherEarning[] {
  const withoutThisSession = prev.filter((e) => e.sessionId !== session.id);
  // Status share (telafi/iptal/gelmedi), approval and rounding all come from
  // Ayarlar → Öğretmen ve Hakediş — see getSessionEarningFactor.
  const amount = getSessionEarningAmount(session, policy);

  if (!isEarningSession(session, policy) || amount <= 0) {
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

// ─── Actor name ─────────────────────────────────────────────────────────────
// Stamped as "updatedBy" on settings metadata — see actorNameRef in
// DataProvider, kept fresh by AuthProvider via setActorName. Only used
// before AuthProvider has synced.
const FALLBACK_ACTOR_NAME = "Sistem Kullanıcısı";

// ─── Notification types ────────────────────────────────────────────────────────

export type { AppNotification };

// ─── Store shape ───────────────────────────────────────────────────────────────

// ─── Delete / soft-delete — intentionally not implemented ──────────────────────
// Audit finding: there's no delete action for Student, Teacher, Guardian, Payment, or
// TeacherPayment (only WeeklySessionPlan supports delete today).
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
interface DataStore {
  students: Student[];
  guardians: Guardian[];
  teachers: Teacher[];
  educationTypes: EducationType[];
  sessions: Session[];
  /** Payments that count — never the ones imported as history only. */
  payments: Payment[];
  /** Payments imported as history only (before the import's devir date):
   *  shown in the student's history, never in a balance, total or report. */
  historicalPayments: Payment[];
  teacherEarnings: TeacherEarning[];
  teacherPayments: TeacherPayment[];
  historicalTeacherPayments: TeacherPayment[];
  teacherEducationTypeAssignments: TeacherEducationTypeAssignment[];
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
  /** Sets (or with undefined clears) a teacher's devir — used by Excel import
   *  and its rollback; leaves updatedAt alone. */
  setTeacherOpeningBalance: (teacherId: string, balance: Teacher["openingBalance"]) => void;
  deleteTeachers: (ids: string[]) => void;
  addEducationType: (et: EducationType) => void;
  updateEducationType: (et: EducationType) => void;
  setEducationTypeStatus: (id: string, status: EducationType["status"]) => void;
  /** Silently no-ops if the type is referenced by any session/student/teacher/
   *  weekly plan/assignment — re-validated against current data right before
   *  writing, never trusting caller UI state (same reasoning as mergeTeachers
   *  below). The Settings UI itself disables Sil in that case; this is the
   *  backstop — see getEducationTypeUsage/canDeleteEducationType. */
  deleteEducationType: (id: string) => void;
  addSession: (s: Session) => void;
  updateSession: (s: Session) => void;
  /** Approves the earnings of these sessions ("Hakediş Oluşturma Anı:
   *  Yönetici onayladığında"). */
  approveSessionEarnings: (ids: string[]) => void;
  deleteSessions: (ids: string[]) => void;
  addPayment: (p: Payment) => void;
  updatePayment: (p: Payment) => void;
  deletePayments: (ids: string[]) => void;
  /** Records a payment to a teacher. Silently no-ops for a type or an amount over
   *  pending earnings that Ayarlar → Öğretmen ve Hakediş does not allow. */
  addTeacherPayment: (p: TeacherPayment) => void;
  deleteTeacherPayments: (ids: string[]) => void;
  /** Fully replaces the assignment set for one teacher in a single write — this
   *  is what makes "duplicate assignment for the same teacherId+educationTypeId"
   *  structurally impossible, since there is no other way to add/edit a row. */
  upsertTeacherEducationTypeAssignments: (
    teacherId: string,
    tenantId: string,
    rows: { educationTypeId: string; earningAmount: number | null; status: "active" | "inactive" }[]
  ) => void;
  addOpeningBalance: (b: OpeningBalance) => void;
  deleteOpeningBalances: (ids: string[]) => void;
  addImportBatch: (batch: ImportBatch) => void;
  markImportBatchRolledBack: (batchId: string) => void;
  teacherMergeHistory: TeacherMergeHistory[];
  /** Reassigns every Session/TeacherEarning/TeacherPayment/TeacherEducationTypeAssignment/
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
  /** Deletes every record (students, guardians, teachers, sessions, payments,
   *  earnings...). Institution info, education types, settings, the account
   *  and the open session are kept. */
  clearAllRecords: () => void;
  /** True while changes can't be saved to this browser (storage full). */
  storageFull: boolean;
  /** All institution data — what a backup file contains. The account and
   *  password are never part of a backup. */
  getBackupSnapshot: () => BackupData;
  /** Replaces all institution data with a backup's contents (the account,
   *  password and session stay). Returns an error message when the backup
   *  is missing required data. */
  restoreBackup: (data: BackupData) => string | null;
  /** Stamps Ayarlar → Veri Yönetimi's last backup time/count. */
  recordBackup: () => void;
  notifications: AppNotification[];
  /** Marks the given notifications read (the ones the current user can see). */
  markNotificationsRead: (ids: string[]) => void;

  // ─── Institution settings (see src/types/settings.ts) ───────────────────────
  institutionSettings: InstitutionSettings;
  /** Section-level save — the whole section's value is replaced at once (the
   *  settings pages hold their own draft state via useSettingsSection and
   *  only call this on "Kaydet"), and it stamps metadata in the same write. */
  updateSettingsSection: <K extends InstitutionSettingsKey>(
    key: K,
    value: InstitutionSettings[K],
    updatedBy?: string
  ) => void;
  resetSettingsSection: (key: InstitutionSettingsKey) => void;

  /** Kept in sync by AuthProvider — settings metadata records the account's
   *  name as "updatedBy". See actorNameRef below. */
  setActorName: (name: string | null) => void;

}

/** Everything persisted to localStorage — see lib/data/persistence.ts. One
 *  shape, not per-field bespoke persistence code. */
export interface PersistedState {
  students: Student[];
  guardians: Guardian[];
  teachers: Teacher[];
  educationTypes: EducationType[];
  sessions: Session[];
  payments: Payment[];
  teacherEarnings: TeacherEarning[];
  teacherPayments: TeacherPayment[];
  teacherEducationTypeAssignments: TeacherEducationTypeAssignment[];
  openingBalances: OpeningBalance[];
  importBatches: ImportBatch[];
  teacherMergeHistory: TeacherMergeHistory[];
  weeklySessionPlans: WeeklySessionPlan[];
  notifications: AppNotification[];
  institutionSettings: InstitutionSettings;
}

/** What a backup file holds: all institution data. The login account lives
 *  on the server and is never part of it. */
export type BackupData = PersistedState;

// ─── Context ───────────────────────────────────────────────────────────────────

const StoreContext = createContext<DataStore | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/** Loads the data from the data source (lib/data/source.ts), then provides the
 *  store. Until the data is in, a plain loading screen shows — a backend
 *  answers asynchronously, and no screen may render on half-loaded data. */
export function DataProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<{ data: PersistedState | null } | null>(null);
  useEffect(() => {
    let active = true;
    void dataSource.load().then((data) => {
      if (active) setLoaded({ data });
    });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) {
    return (
      <div role="status" className="flex h-svh items-center justify-center bg-background text-base text-muted-foreground">
        Yükleniyor…
      </div>
    );
  }
  return <StoreProvider persisted={loaded.data}>{children}</StoreProvider>;
}

function StoreProvider({ persisted, children }: { persisted: PersistedState | null; children: ReactNode }) {
  const [initialSettings] = useState(() => normalizeInstitutionSettings(persisted?.institutionSettings));

  const [students, setStudents] = useState<Student[]>(() =>
    backfillStudentNumbers(persisted?.students ?? [], initialSettings.students)
  );
  const studentsRef = useRef(students);
  const [guardians, setGuardians] = useState<Guardian[]>(() => persisted?.guardians ?? []);
  const guardiansRef = useRef(guardians);
  const [teachers, setTeachers] = useState<Teacher[]>(() => persisted?.teachers ?? []);
  const [educationTypes, setEducationTypes] = useState<EducationType[]>(
    () => persisted?.educationTypes ?? []
  );
  const educationTypesRef = useRef(educationTypes);
  // Sessions saved before earning factors existed get one from the current
  // policy — with the default policy that reproduces the old completed/makeup
  // rule exactly.
  const [sessions, setSessions] = useState<Session[]>(() =>
    (persisted?.sessions ?? []).map((s) =>
      s.earningFactor === undefined ? withEarningFactor(s, initialSettings.teacherEarnings) : s
    )
  );
  const sessionsRef = useRef(sessions);
  // Payments imported as history only ("historical") are kept with the rest
  // — backups, rollback and deletes see every record — but every consumer
  // gets `payments` without them, so no balance, total or report counts them.
  const [allPayments, setPayments] = useState<Payment[]>(() => persisted?.payments ?? []);
  const payments = useMemo(() => allPayments.filter((p) => !p.historical), [allPayments]);
  const historicalPayments = useMemo(() => allPayments.filter((p) => p.historical), [allPayments]);
  const [teacherEarnings, setTeacherEarnings] = useState<TeacherEarning[]>(
    () => persisted?.teacherEarnings ?? []
  );
  const [allTeacherPayments, setTeacherPayments] = useState<TeacherPayment[]>(
    () => persisted?.teacherPayments ?? []
  );
  const teacherPayments = useMemo(() => allTeacherPayments.filter((p) => !p.historical), [allTeacherPayments]);
  const historicalTeacherPayments = useMemo(() => allTeacherPayments.filter((p) => p.historical), [allTeacherPayments]);
  const allTeacherPaymentsRef = useRef(allTeacherPayments);
  // Refs so addTeacherPayment always validates against the latest pending balance,
  // even when called from a memoised handler holding a stale closure.
  const teachersRef = useRef(teachers);
  const teacherPaymentsRef = useRef(teacherPayments);
  const [teacherEducationTypeAssignments, setTeacherEducationTypeAssignments] = useState<TeacherEducationTypeAssignment[]>(
    () => persisted?.teacherEducationTypeAssignments ?? []
  );
  // Refs so mergeTeachers/rollbackTeacherMerge always compute against a single
  // consistent, current snapshot across every array they touch at once — same
  // reasoning as teachersRef/teacherPaymentsRef above.
  const teacherEarningsRef = useRef(teacherEarnings);
  const teacherEducationTypeAssignmentsRef = useRef(teacherEducationTypeAssignments);
  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>(
    () => persisted?.openingBalances ?? []
  );
  const [importBatches, setImportBatches] = useState<ImportBatch[]>(() => persisted?.importBatches ?? []);
  const [weeklySessionPlans, setWeeklySessionPlans] = useState<WeeklySessionPlan[]>(
    () => persisted?.weeklySessionPlans ?? []
  );
  const weeklySessionPlansRef = useRef(weeklySessionPlans);
  const [teacherMergeHistory, setTeacherMergeHistory] = useState<TeacherMergeHistory[]>(
    () => persisted?.teacherMergeHistory ?? []
  );
  const teacherMergeHistoryRef = useRef(teacherMergeHistory);
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    normalizeNotifications(persisted?.notifications)
  );
  const notify = useCallback((items: AppNotification[]) => {
    if (items.length > 0) setNotifications((prev) => mergeNotifications(prev, items));
  }, []);

  const [institutionSettings, setInstitutionSettings] = useState<InstitutionSettings>(
    () => initialSettings
  );
  // Published during render (not in an effect) so every descendant rendering
  // in this same pass already formats/calculates with the new values.
  setActiveSettings(institutionSettings);

  // Not persisted (ephemeral per-tab) — kept fresh by AuthProvider via
  // setActorName. See FALLBACK_ACTOR_NAME / the DataStore interface comment.
  const [actorName, setActorName] = useState<string | null>(null);
  const actorNameRef = useRef(actorName);

  // Keep the *Ref mirrors current for mutators/effects that read state at
  // call time. Synced in a layout effect (not during render) so it is done
  // before any event handler or passive effect can run.
  useLayoutEffect(() => {
    studentsRef.current = students;
    educationTypesRef.current = educationTypes;
    sessionsRef.current = sessions;
    teachersRef.current = teachers;
    teacherPaymentsRef.current = teacherPayments;
    allTeacherPaymentsRef.current = allTeacherPayments;
    teacherEarningsRef.current = teacherEarnings;
    teacherEducationTypeAssignmentsRef.current = teacherEducationTypeAssignments;
    weeklySessionPlansRef.current = weeklySessionPlans;
    teacherMergeHistoryRef.current = teacherMergeHistory;
    guardiansRef.current = guardians;
    actorNameRef.current = actorName;
  });

  useEffect(() => {
    function autoCompletePastPlanned() {
      // Ayarlar → Seans → Seansları Otomatik Tamamla / Gecikme — a planned
      // session flips to completed once its own end time plus the delay passes.
      const { autoCompleteEnabled, autoCompleteDelayMinutes } = getActiveSettings().sessions;
      if (!autoCompleteEnabled) return;
      const now = Date.now();

      // Use the ref so the closure always sees the latest sessions.
      const toComplete = sessionsRef.current.filter((s) => {
        if (s.status !== "planned") return false;
        const durationMs = (s.durationMinutes || DEFAULT_SESSION_DURATION_MINUTES) * 60_000;
        return now >= new Date(s.date).getTime() + durationMs + autoCompleteDelayMinutes * 60_000;
      });

      if (toComplete.length === 0) return;

      const policy = getActiveSettings().teacherEarnings;
      const completed = new Map(
        toComplete.map((s) => [s.id, withEarningFactor({ ...s, status: "completed" as const }, policy)])
      );
      setSessions((prev) => prev.map((s) => completed.get(s.id) ?? s));

      setTeacherEarnings((prev) =>
        [...completed.values()].reduce((acc, s) => upsertEarningForSession(acc, s, policy), prev)
      );

      notify(
        [...completed.values()].map((cs) =>
          buildSessionNotification("session_auto_completed", cs, studentsRef.current, teachersRef.current)
        )
      );
    }

    // Reminders (upcoming sessions).
    function collectReminders() {
      notify(
        collectTimedNotifications({
          sessions: sessionsRef.current,
          students: studentsRef.current,
          teachers: teachersRef.current,
        })
      );
    }

    autoCompletePastPlanned();
    collectReminders();
    const timer = setInterval(() => {
      autoCompletePastPlanned();
      collectReminders();
    }, 60_000);
    return () => clearInterval(timer);
  }, [notify]);

  useEffect(() => dataSource.watch(), []);
  /** True while the latest change could not be written to this browser. */
  const [storageFull, setStorageFull] = useState(false);

  // Full-store persistence — one write path for every domain instead of
  // per-field bespoke code, mirrored by the lazy `useState` initializers
  // above reading the loaded snapshot. See lib/data/source.ts.
  //
  // Deliberately NOT debounced: a reload right after a change must never
  // lose it, and localStorage.setItem on data this size is cheap enough that
  // writing on every change is not a real cost here.
  useEffect(() => {
    let active = true;
    void dataSource.save({
      students,
      guardians,
      teachers,
      educationTypes,
      sessions,
      payments: allPayments,
      teacherEarnings,
      teacherPayments: allTeacherPayments,
      teacherEducationTypeAssignments,
      openingBalances,
      importBatches,
      teacherMergeHistory,
      weeklySessionPlans,
      notifications,
      institutionSettings,
    }).then((saved) => {
      // Mirrors the data source into state so the layout can warn.
      if (active) setStorageFull(!saved);
    });
    return () => {
      active = false;
    };
  }, [
    students,
    guardians,
    teachers,
    educationTypes,
    sessions,
    allPayments,
    teacherEarnings,
    allTeacherPayments,
    teacherEducationTypeAssignments,
    openingBalances,
    importBatches,
    teacherMergeHistory,
    weeklySessionPlans,
    notifications,
    institutionSettings,
  ]);

  /** Re-derives earnings after Ayarlar → Öğretmen ve Hakediş is saved. Past
   *  sessions get the new status shares only with "Geçmişe dönük yeniden
   *  hesaplamaya izin ver"; approval mode and rounding always re-apply. */
  const applyEarningPolicy = useCallback((policy: TeacherEarningsSettings) => {
    const current = sessionsRef.current;
    const next = policy.allowHistoricalRecalculation
      ? current.map((s) => (s.status === "planned" ? s : withEarningFactor(s, policy)))
      : current;
    if (next !== current) setSessions(next);
    setTeacherEarnings((prev) => next.reduce((acc, s) => upsertEarningForSession(acc, s, policy), prev));
  }, []);


  // Memoized so this object keeps a stable reference across renders that
  // don't touch any of the data below — e.g. toggling the sidebar re-renders
  // DataProvider (it's an ancestor in the tree) but none of THESE
  // dependencies change, so the memo bails out and every `useStore()`
  // consumer across the whole app correctly skips re-rendering too. Every
  // action below is safe to omit from the dependency list: each one only
  // closes over a stable setState function or a `*Ref.current` read (never a
  // plain state variable by value), so a "stale" version from an earlier
  // memoized call behaves identically to a freshly-created one.
  const value: DataStore = useMemo<DataStore>(
    () => ({
    students,
    guardians,
    teachers,
    educationTypes,
    sessions,
    payments,
    historicalPayments,
    teacherEarnings,
    teacherPayments,
    historicalTeacherPayments,
    teacherEducationTypeAssignments,
    openingBalances,
    importBatches,
    teacherMergeHistory,

    addStudent: (s) => {
      setStudents((prev) => [...prev, assignStudentNumber(s, prev, getActiveSettings().students)]);
      // Keep the link two-way: a guardian lists its students (guardian page,
      // guardian balance), so a student added from anywhere — Excel import
      // included — must also appear on its guardians.
      if (s.guardianIds.length > 0) {
        setGuardians((prev) =>
          prev.map((g) =>
            s.guardianIds.includes(g.id) && !g.studentIds.includes(s.id) ? { ...g, studentIds: [...g.studentIds, s.id] } : g
          )
        );
      }
    },
    updateStudent: (s) =>
      setStudents((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? {
                ...s,
                importBatchId: x.importBatchId,
                studentSequence: s.studentNumber === x.studentNumber ? x.studentSequence : undefined,
                updatedAt: new Date().toISOString(),
              }
            : x
        )
      ),
    deleteStudents: (ids) => {
      const idSet = new Set(ids);
      setStudents((prev) => prev.filter((x) => !idSet.has(x.id)));
      setGuardians((prev) =>
        prev.map((g) => (g.studentIds.some((id) => idSet.has(id)) ? { ...g, studentIds: g.studentIds.filter((id) => !idSet.has(id)) } : g))
      );
    },

    addGuardian: (g) => setGuardians((prev) => [...prev, g]),
    updateGuardian: (g) => {
      setGuardians((prev) =>
        prev.map((x) =>
          x.id === g.id
            ? { ...g, importBatchId: x.importBatchId, updatedAt: new Date().toISOString() }
            : x
        )
      );
    },
    deleteGuardians: (ids) => {
      const idSet = new Set(ids);
      setGuardians((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    addTeacher: (t) => setTeachers((prev) => [...prev, t]),
    setTeacherOpeningBalance: (teacherId, balance) =>
      setTeachers((prev) =>
        prev.map((t) => {
          if (t.id !== teacherId) return t;
          const { openingBalance: _previous, ...rest } = t;
          void _previous;
          return balance ? { ...rest, openingBalance: balance } : rest;
        })
      ),
    updateTeacher: (t) => {
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
                // Salary stops after the pay period a teacher leaves in.
                leftAt:
                  t.status === "active"
                    ? undefined
                    : x.status === "active"
                      ? new Date().toISOString()
                      : x.leftAt,
                updatedAt: new Date().toISOString(),
              }
            : x
        )
      );
    },
    deleteTeachers: (ids) => {
      const idSet = new Set(ids);
      setTeachers((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    addEducationType: (et) => {
      setEducationTypes((prev) => [...prev, et]);
    },
    updateEducationType: (et) => {
      setEducationTypes((prev) =>
        prev.map((x) =>
          x.id === et.id ? { ...et, createdAt: x.createdAt, updatedAt: new Date().toISOString() } : x
        )
      );
    },
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
        teacherEducationTypeAssignments: teacherEducationTypeAssignmentsRef.current,
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
        teacherEducationTypeAssignmentsRef.current,
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
      const movedTeacherPaymentIds = allTeacherPaymentsRef.current
        .filter((p) => p.teacherId === duplicateTeacherId)
        .map((p) => p.id);
      const movedWeeklyPlanIds = weeklySessionPlansRef.current
        .filter((w) => w.teacherId === duplicateTeacherId)
        .map((w) => w.id);

      // Assignments don't just flip teacherId — a conflicting educationTypeId
      // would leave two rows under one teacher (see teacher-merge.ts), so those
      // are dropped from the live array (never happens in practice since a
      // conflict there makes preview.isSafe false above; the branch exists so
      // rollback stays correct even if this rule is ever relaxed later).
      const duplicateAssignments = teacherEducationTypeAssignmentsRef.current.filter(
        (a) => a.teacherId === duplicateTeacherId
      );
      const primaryEducationTypeIds = new Set(
        teacherEducationTypeAssignmentsRef.current
          .filter((a) => a.teacherId === primaryTeacherId)
          .map((a) => a.educationTypeId)
      );
      const assignmentIdsToMove = duplicateAssignments
        .filter((a) => !primaryEducationTypeIds.has(a.educationTypeId))
        .map((a) => a.id);
      const droppedAssignments = duplicateAssignments.filter((a) =>
        primaryEducationTypeIds.has(a.educationTypeId)
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
      const assignmentIdsToMoveSet = new Set(assignmentIdsToMove);
      setTeacherEducationTypeAssignments((prev) =>
        prev
          .filter((a) => a.teacherId !== duplicateTeacherId)
          .concat(
            duplicateAssignments
              .filter((a) => assignmentIdsToMoveSet.has(a.id))
              .map((a) => ({ ...a, teacherId: primaryTeacherId }))
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
        id: createId("merge"),
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
          teacherEducationTypeAssignments: assignmentIdsToMove.length,
          weeklyPlans: movedWeeklyPlanIds.length,
        },
        snapshot: {
          duplicateTeacher: duplicate,
          movedSessionIds,
          movedTeacherEarningIds,
          movedTeacherPaymentIds,
          movedWeeklyPlanIds,
          movedTeacherEducationTypeAssignmentIds: assignmentIdsToMove,
          droppedTeacherEducationTypeAssignments: droppedAssignments,
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
      const movedAssignmentIdSet = new Set(snapshot.movedTeacherEducationTypeAssignmentIds);

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
      setTeacherEducationTypeAssignments((prev) => [
        ...prev.map((a) =>
          movedAssignmentIdSet.has(a.id) && a.teacherId === primaryTeacherId
            ? { ...a, teacherId: duplicateTeacherId }
            : a
        ),
        ...snapshot.droppedTeacherEducationTypeAssignments,
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

    addSession: (raw) => {
      const s = withEarningFactor(applyMakeupBilling(raw, getActiveSettings().sessions), getActiveSettings().teacherEarnings);
      setSessions((prev) => [...prev, s]);
      setTeacherEarnings((prev) => upsertEarningForSession(prev, s));
    },
    updateSession: (raw) => {
      // The earning share is fixed when the status is set; editing anything
      // else (price, notes, time) keeps it — and keeps any approval.
      const previous = sessionsRef.current.find((x) => x.id === raw.id);
      if (previous?.status !== "makeup") raw = applyMakeupBilling(raw, getActiveSettings().sessions);
      const statusUnchanged = previous?.status === raw.status && previous.earningFactor !== undefined;
      const s: Session = statusUnchanged
        ? { ...raw, earningFactor: previous!.earningFactor, earningApprovedAt: previous!.earningApprovedAt }
        : { ...withEarningFactor(raw, getActiveSettings().teacherEarnings), earningApprovedAt: undefined };
      setSessions((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...s, importBatchId: x.importBatchId, updatedAt: new Date().toISOString() }
            : x
        )
      );
      setTeacherEarnings((prev) => upsertEarningForSession(prev, s));
      if (previous && previous.status !== s.status) {
        const people = [studentsRef.current, teachersRef.current] as const;
        if (s.status === "cancelled") notify([buildSessionNotification("session_cancelled", s, ...people)]);
        if (s.status === "no_show") notify([buildSessionNotification("student_no_show", s, ...people)]);
      }
    },
    approveSessionEarnings: (ids) => {
      const idSet = new Set(ids);
      const now = new Date().toISOString();
      const approved = sessionsRef.current
        .filter((s) => idSet.has(s.id) && !s.earningApprovedAt)
        .map((s) => ({ ...s, earningApprovedAt: now }));
      if (approved.length === 0) return;
      const byId = new Map(approved.map((s) => [s.id, s]));
      setSessions((prev) => prev.map((s) => byId.get(s.id) ?? s));
      setTeacherEarnings((prev) => approved.reduce((acc, s) => upsertEarningForSession(acc, s), prev));
    },
    deleteSessions: (ids) => {
      const idSet = new Set(ids);
      setSessions((prev) => prev.filter((x) => !idSet.has(x.id)));
      setTeacherEarnings((prev) => prev.filter((e) => !idSet.has(e.sessionId)));
    },

    addPayment: (p) => {
      // A history-only payment gets no receipt number; imported payments
      // don't ring the bell one by one.
      setPayments((prev) => [...prev, p.historical ? p : assignReceiptNumber(p, prev)]);
      if (!p.importBatchId) notify([buildPaymentNotification(p, studentsRef.current)]);
    },
    updatePayment: (p) =>
      setPayments((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? {
                ...p,
                importBatchId: x.importBatchId,
                // A receipt number, once issued, belongs to the payment for good.
                receiptNumber: x.receiptNumber,
                receiptSequence: x.receiptSequence,
                paymentSource: x.paymentSource ?? p.paymentSource,
                updatedAt: new Date().toISOString(),
              }
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
      if (p.importBatchId) {
        // Imported: validated by the import preview, and sessions from the
        // same import aren't in the refs yet, so the pending check below
        // would wrongly drop it.
        if (p.amount > 0) setTeacherPayments((prev) => [...prev, p]);
        return;
      }
      if (!teacher || p.amount <= 0) return;
      const policy = getActiveSettings().teacherEarnings;
      if (!getAllowedTeacherPaymentTypes([p.paymentType], policy).length) return;
      const { pendingEarning } = getTeacherEarningTotals(
        teacher,
        sessionsRef.current,
        teacherPaymentsRef.current
      );
      if (p.amount > pendingEarning && !canExceedPendingEarning(p.paymentType, policy)) return;
      setTeacherPayments((prev) => [...prev, p]);
      notify([
        {
          id: `notif-teacher_payment_made-${p.id}`,
          event: "teacher_payment_made",
          title: "Öğretmene ödeme yapıldı",
          message: `${teacher.fullName} · ${formatCurrency(p.amount)} · ${p.date}`,
          href: `/app/teachers/${teacher.id}`,
          teacherId: teacher.id,
          createdAt: new Date().toISOString(),
        },
      ]);
    },
    deleteTeacherPayments: (ids) => {
      const idSet = new Set(ids);
      setTeacherPayments((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    upsertTeacherEducationTypeAssignments: (teacherId, tenantId, rows) => {
      setTeacherEducationTypeAssignments((prev) => {
        const others = prev.filter((a) => a.teacherId !== teacherId);
        const existingForTeacher = prev.filter((a) => a.teacherId === teacherId);
        const now = new Date().toISOString();
        const next = rows.map((row) => {
          const existing = existingForTeacher.find((a) => a.educationTypeId === row.educationTypeId);
          return existing
            ? { ...existing, earningAmount: row.earningAmount, status: row.status, updatedAt: now }
            : {
                id: createId("tea"),
                tenantId,
                teacherId,
                educationTypeId: row.educationTypeId,
                earningAmount: row.earningAmount,
                status: row.status,
                createdAt: now,
              };
        });
        return [...others, ...next];
      });
    },

    addOpeningBalance: (b) => setOpeningBalances((prev) => [...prev, b]),
    deleteOpeningBalances: (ids) => {
      const idSet = new Set(ids);
      setOpeningBalances((prev) => prev.filter((x) => !idSet.has(x.id)));
    },

    addImportBatch: (batch) => {
      setImportBatches((prev) => [...prev, batch]);
    },
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

    institutionSettings,
    updateSettingsSection: (key, value, updatedBy) => {
      const who = updatedBy ?? (actorNameRef.current ?? FALLBACK_ACTOR_NAME);
      if (key === "teacherEarnings") applyEarningPolicy(value as TeacherEarningsSettings);
      // Turning auto-numbering on numbers every student that has none yet.
      if (key === "students") setStudents((prev) => backfillStudentNumbers(prev, value as StudentSettings));
      setInstitutionSettings((prev) => ({
        ...prev,
        [key]: value,
        metadata: {
          ...prev.metadata,
          [key]: {
            updatedAt: new Date().toISOString(),
            updatedBy: who,
            version: (prev.metadata[key]?.version ?? 0) + 1,
          },
        },
      }));
    },
    resetSettingsSection: (key) => {
      if (key === "teacherEarnings") applyEarningPolicy(getSettingsDefaults("teacherEarnings"));
      setInstitutionSettings((prev) => ({
        ...prev,
        [key]: getSettingsDefaults(key),
        metadata: {
          ...prev.metadata,
          [key]: {
            updatedAt: new Date().toISOString(),
            updatedBy: (actorNameRef.current ?? FALLBACK_ACTOR_NAME),
            version: (prev.metadata[key]?.version ?? 0) + 1,
          },
        },
      }));
    },

    setActorName: (name) => setActorName(name),

    getBackupSnapshot: () => ({
      students,
      guardians,
      teachers,
      educationTypes,
      sessions,
      payments: allPayments,
      teacherEarnings,
      teacherPayments: allTeacherPayments,
      teacherEducationTypeAssignments,
      openingBalances,
      importBatches,
      teacherMergeHistory,
      weeklySessionPlans,
      notifications,
      institutionSettings,
    }),

    restoreBackup: (d) => {
      // Account fields a backup from the multi-account era still carries
      // (appUsers, roles, credentials, ...) are ignored — the login stays.
      const arrays: (keyof BackupData)[] = [
        "students", "guardians", "teachers", "educationTypes", "sessions", "payments",
        "teacherPayments", "teacherEducationTypeAssignments",
      ];
      const missing = arrays.filter((k) => !Array.isArray(d[k]));
      if (missing.length > 0) return `Yedekte eksik veri var: ${missing.join(", ")}`;
      const settings = normalizeInstitutionSettings(d.institutionSettings);
      setStudents(backfillStudentNumbers(d.students, settings.students));
      setGuardians(d.guardians);
      setTeachers(d.teachers);
      setEducationTypes(d.educationTypes);
      setSessions(d.sessions.map((s) => (s.earningFactor === undefined ? withEarningFactor(s, settings.teacherEarnings) : s)));
      setPayments(d.payments);
      setTeacherEarnings(d.teacherEarnings ?? []);
      setTeacherPayments(d.teacherPayments);
      setTeacherEducationTypeAssignments(d.teacherEducationTypeAssignments);
      setOpeningBalances(d.openingBalances ?? []);
      setImportBatches(d.importBatches ?? []);
      setTeacherMergeHistory(d.teacherMergeHistory ?? []);
      setWeeklySessionPlans(d.weeklySessionPlans ?? []);
      setNotifications(normalizeNotifications(d.notifications));
      setInstitutionSettings(settings);
      return null;
    },

    recordBackup: () =>
      setInstitutionSettings((prev) => ({
        ...prev,
        dataManagement: {
          ...prev.dataManagement,
          lastBackupAt: new Date().toISOString(),
          backupCount: prev.dataManagement.backupCount + 1,
        },
      })),

    storageFull,
    // Clears every record; institution info, education types and settings stay.
    clearAllRecords: () => {
      setStudents([]);
      setGuardians([]);
      setTeachers([]);
      setSessions([]);
      setPayments([]);
      setTeacherEarnings([]);
      setTeacherPayments([]);
      setTeacherEducationTypeAssignments([]);
      setWeeklySessionPlans([]);
      setNotifications([]);
      setOpeningBalances([]);
      setImportBatches([]);
      setTeacherMergeHistory([]);
    },

    notifications,
    markNotificationsRead: (ids) => {
      const idSet = new Set(ids);
      setNotifications((prev) =>
        prev.map((n) => (n.readAt || !idSet.has(n.id) ? n : { ...n, readAt: new Date().toISOString() }))
      );
    },

    }),
    // Action functions are intentionally omitted below; see the comment above
    // `value` for why that's safe (each one only closes over a stable setState
    // function or a ref read).
    [
      storageFull,
      students,
      guardians,
      teachers,
      educationTypes,
      sessions,
      payments,
      historicalPayments,
      allPayments,
      teacherEarnings,
      teacherPayments,
      historicalTeacherPayments,
      allTeacherPayments,
      teacherEducationTypeAssignments,
      openingBalances,
      importBatches,
      teacherMergeHistory,
      weeklySessionPlans,
      notifications,
      institutionSettings,
      applyEarningPolicy,
      notify,
    ]
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useStore(): DataStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within DataProvider");
  return ctx;
}
