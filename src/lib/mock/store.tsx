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
import { mockStudents, mockGuardians, DEMO_STUDENTS, DEMO_GUARDIANS } from "@/lib/mock/students";
import { mockTeachers } from "@/lib/mock/teachers";
import { mockSessions } from "@/lib/mock/sessions";
import { mockPayments } from "@/lib/mock/payments";
import { mockTeacherEarnings } from "@/lib/mock/teacher-earnings";
import { mockTeacherPayments } from "@/lib/mock/teacher-payments";
import { mockTeacherEducationTypeAssignments } from "@/lib/mock/teacher-education-type-assignments";
import { mockWeeklySessionPlans } from "@/lib/mock/weekly-session-plans";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { mockAccount, mockCredential } from "@/lib/mock/account";
import type {
  InstitutionSettings,
  InstitutionSettingsKey,
  AuditLogEntry,
  TeacherEarningsSettings,
  StudentSettings,
} from "@/types/settings";
import { DEFAULT_INSTITUTION_SETTINGS, getSettingsDefaults, normalizeInstitutionSettings } from "@/lib/settings/defaults";
import { getActiveSettings, setActiveSettings } from "@/lib/settings/runtime";
import { INSTITUTION_SETTINGS_FIELD_LABELS } from "@/lib/settings/sections";
import type { Account, Credential, AuthSession } from "@/types/auth";
import { loadPersistedStore, savePersistedStore, clearPersistedStore, watchOtherTabWrites } from "@/lib/mock/persistence";
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
  isNotificationEnabled,
  mergeNotifications,
  normalizeNotifications,
  type AppNotification,
} from "@/lib/helpers/notifications";
import {
  assignReceiptNumber,
  canExceedPendingEarning,
  getAllowedTeacherPaymentTypes,
} from "@/lib/helpers/finance-rules";
import { getEducationTypeUsage, canDeleteEducationType } from "@/lib/helpers/education-types";

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

// ─── Audit log ──────────────────────────────────────────────────────────────
// Not every mutation in this store pushes an entry — see logAuditEvent's own
// doc comment on the MockStore interface for which ones do today and why the
// rest were left out of this pass.

// Fallback for audit entries logged by store actions that don't (and, for
// most of these, shouldn't) accept an explicit actor — see actorNameRef in
// MockDataProvider, kept fresh by AuthProvider via setActorName whenever the
// signed-in user changes. Only used before a session exists (should be
// unreachable in practice — every mutating action already sits behind
// RouteGuard) or if AuthProvider hasn't synced yet.
const FALLBACK_ACTOR_NAME = "Sistem Kullanıcısı";

function makeAuditEntry(entry: Omit<AuditLogEntry, "id" | "tenantId" | "occurredAt">): AuditLogEntry {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: "tenant-1",
    occurredAt: new Date().toISOString(),
    ...entry,
  };
}

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
interface MockStore {
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
  /** Replaces all institution data with the demo set. The account, its
   *  password and the open session are kept. */
  resetToDemo: () => void;
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
   *  only call this on "Kaydet"), and it stamps metadata + pushes an audit
   *  entry in the same write. */
  updateSettingsSection: <K extends InstitutionSettingsKey>(
    key: K,
    value: InstitutionSettings[K],
    updatedBy?: string
  ) => void;
  resetSettingsSection: (key: InstitutionSettingsKey) => void;

  // ─── The single account (see src/lib/auth/AuthProvider.tsx — the only real
  //     consumer) ───────────────────────────────────────────────────────────
  account: Account;
  /** Login counters/lockout/lastLoginAt — a plain write with no audit entry;
   *  the auth flow logs its own login events. */
  saveAccountState: (account: Account) => void;
  /** Profil page: display name and username. Returns an error message when
   *  either is empty. */
  updateAccountProfile: (input: { name: string; username: string }) => string | null;
  /** Never read/written outside src/lib/auth/local-auth-service.ts. */
  credential: Credential;
  setCredential: (credential: Credential) => void;
  /** This device's session. */
  authSession: AuthSession | null;
  setAuthSession: (session: AuthSession | null) => void;
  /** Kept in sync by AuthProvider — lets store actions log audit entries
   *  under the account's name. See actorNameRef below. */
  setActorName: (name: string | null) => void;

  // ─── İşlem Geçmişi ────────────────────────────────────────────────────────
  auditLog: AuditLogEntry[];
  /** General-purpose escape hatch for pages that need to record a one-off
   *  event with no dedicated store action of their own (e.g. Veri Yönetimi's
   *  backup/restore/export buttons). Settings changes, education type
   *  create/update, imports, payments, session edits, and auth
   *  events already log themselves from within their own store actions —
   *  see each action's own comment. */
  logAuditEvent: (entry: Omit<AuditLogEntry, "id" | "tenantId" | "occurredAt">) => void;
}

/** Everything persisted to localStorage — see lib/mock/persistence.ts. One
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
  auditLog: AuditLogEntry[];
  account: Account;
  credential: Credential;
  authSession: AuthSession | null;
}

/** What a backup file holds: institution data only. */
export type BackupData = Omit<PersistedState, "account" | "credential" | "authSession">;

// ─── Context ───────────────────────────────────────────────────────────────────

const MockStoreContext = createContext<MockStore | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MockDataProvider({ children }: { children: ReactNode }) {
  // Read once per mount — every state initializer below reads from this same
  // snapshot instead of each re-parsing localStorage independently. `null`
  // (nothing persisted yet, or a stale schema version) falls back to the
  // existing seed data exactly as before this phase.
  const [persisted] = useState(() => loadPersistedStore<PersistedState>());
  const [initialSettings] = useState(() => normalizeInstitutionSettings(persisted?.institutionSettings));

  const [students, setStudents] = useState<Student[]>(() =>
    backfillStudentNumbers(persisted?.students ?? mockStudents, initialSettings.students)
  );
  const studentsRef = useRef(students);
  const [guardians, setGuardians] = useState<Guardian[]>(() => persisted?.guardians ?? mockGuardians);
  const guardiansRef = useRef(guardians);
  const [teachers, setTeachers] = useState<Teacher[]>(() => persisted?.teachers ?? mockTeachers);
  const [educationTypes, setEducationTypes] = useState<EducationType[]>(
    () => persisted?.educationTypes ?? mockEducationTypes
  );
  const educationTypesRef = useRef(educationTypes);
  // Sessions saved before earning factors existed get one from the current
  // policy — with the default policy that reproduces the old completed/makeup
  // rule exactly.
  const [sessions, setSessions] = useState<Session[]>(() =>
    (persisted?.sessions ?? mockSessions).map((s) =>
      s.earningFactor === undefined ? withEarningFactor(s, initialSettings.teacherEarnings) : s
    )
  );
  const sessionsRef = useRef(sessions);
  const [payments, setPayments] = useState<Payment[]>(() => persisted?.payments ?? mockPayments);
  const [teacherEarnings, setTeacherEarnings] = useState<TeacherEarning[]>(
    () => persisted?.teacherEarnings ?? mockTeacherEarnings
  );
  const [teacherPayments, setTeacherPayments] = useState<TeacherPayment[]>(
    () => persisted?.teacherPayments ?? mockTeacherPayments
  );
  // Refs so addTeacherPayment always validates against the latest pending balance,
  // even when called from a memoised handler holding a stale closure.
  const teachersRef = useRef(teachers);
  const teacherPaymentsRef = useRef(teacherPayments);
  const [teacherEducationTypeAssignments, setTeacherEducationTypeAssignments] = useState<TeacherEducationTypeAssignment[]>(
    () => persisted?.teacherEducationTypeAssignments ?? mockTeacherEducationTypeAssignments
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
    () => persisted?.weeklySessionPlans ?? mockWeeklySessionPlans
  );
  const weeklySessionPlansRef = useRef(weeklySessionPlans);
  const [teacherMergeHistory, setTeacherMergeHistory] = useState<TeacherMergeHistory[]>(
    () => persisted?.teacherMergeHistory ?? []
  );
  const teacherMergeHistoryRef = useRef(teacherMergeHistory);
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    normalizeNotifications(persisted?.notifications)
  );
  /** Adds in-app notifications for the events enabled in Ayarlar → Bildirimler. */
  const notify = useCallback((items: AppNotification[]) => {
    const settings = getActiveSettings().notifications;
    const enabled = items.filter((n) => isNotificationEnabled(settings, n.event));
    if (enabled.length > 0) setNotifications((prev) => mergeNotifications(prev, enabled));
  }, []);

  const [institutionSettings, setInstitutionSettings] = useState<InstitutionSettings>(
    () => initialSettings
  );
  // Published during render (not in an effect) so every descendant rendering
  // in this same pass already formats/calculates with the new values.
  setActiveSettings(institutionSettings);
  const [auditLog, setAuditLogState] = useState<AuditLogEntry[]>(() => persisted?.auditLog ?? []);
  // Every append goes through a functional update; with Ayarlar → Güvenlik →
  // "İşlem geçmişi kaydını etkinleştir" off those are dropped. Plain array
  // writes (reset to demo) always apply.
  const setAuditLog = useCallback<typeof setAuditLogState>((update) => {
    if (typeof update === "function" && !getActiveSettings().security.auditLoggingEnabled) return;
    setAuditLogState(update);
  }, []);

  // ─── Account / credential / this device's session ─────────────────────────
  // A snapshot from the multi-account era has no `account`: it starts from
  // the seed (admin / 1) and the old session no longer counts.
  const [account, setAccount] = useState<Account>(() => persisted?.account ?? mockAccount);
  const [credential, setCredentialState] = useState<Credential>(() =>
    persisted?.account && persisted.credential ? persisted.credential : mockCredential
  );
  const [authSession, setAuthSessionState] = useState<AuthSession | null>(() =>
    persisted?.account ? persisted.authSession ?? null : null
  );
  // Not persisted (ephemeral per-tab) — kept fresh by AuthProvider via
  // setActorName. See FALLBACK_ACTOR_NAME / the MockStore interface comment.
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

      notify([
        ...[...completed.values()].map((cs) =>
          buildSessionNotification("session_auto_completed", cs, studentsRef.current, teachersRef.current)
        ),
        ...[...completed.values()]
          .filter((cs) => isEarningSession(cs, policy))
          .map((cs) =>
            buildSessionNotification("teacher_earning_created", cs, studentsRef.current, teachersRef.current)
          ),
      ]);
    }

    // Reminders (upcoming sessions).
    function collectReminders() {
      notify(
        collectTimedNotifications({
          settings: getActiveSettings().notifications,
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

  useEffect(() => watchOtherTabWrites(), []);
  /** True while the latest change could not be written to this browser. */
  const [storageFull, setStorageFull] = useState(false);

  // Full-store persistence — one write path for every domain instead of
  // per-field bespoke code, mirrored by the lazy `useState` initializers
  // above reading loadPersistedStore() back on the next mount. See
  // lib/mock/persistence.ts.
  //
  // Deliberately NOT debounced: a debounced write raced against a fast
  // reload/relogin (e.g. immediately after signIn) could lose the just-set
  // authSession/failedLoginAttempts entirely, since the browser can reload
  // before the timer fires. localStorage.setItem on data this size is cheap
  // enough that writing on every change is not a real cost here.
  useEffect(() => {
    const saved = savePersistedStore<PersistedState>({
      students,
      guardians,
      teachers,
      educationTypes,
      sessions,
      payments,
      teacherEarnings,
      teacherPayments,
      teacherEducationTypeAssignments,
      openingBalances,
      importBatches,
      teacherMergeHistory,
      weeklySessionPlans,
      notifications,
      institutionSettings,
      auditLog,
      account,
      credential,
      authSession,
    });
    // Mirrors an external system (localStorage) into state so the layout can
    // warn — not derivable during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStorageFull(!saved);
  }, [
    students,
    guardians,
    teachers,
    educationTypes,
    sessions,
    payments,
    teacherEarnings,
    teacherPayments,
    teacherEducationTypeAssignments,
    openingBalances,
    importBatches,
    teacherMergeHistory,
    weeklySessionPlans,
    notifications,
    institutionSettings,
    auditLog,
    account,
    credential,
    authSession,
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

  /** Audit entry under the current actor — skipped when Ayarlar → Güvenlik →
   *  İşlem geçmişi kaydı is off. */
  const logAudit = useCallback(
    (entry: Omit<AuditLogEntry, "id" | "tenantId" | "occurredAt" | "userName"> & { userName?: string }) => {
      setAuditLog((prev) => [
        makeAuditEntry({ ...entry, userName: entry.userName ?? actorNameRef.current ?? FALLBACK_ACTOR_NAME }),
        ...prev,
      ]);
    },
    [setAuditLog]
  );

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
    teacherEducationTypeAssignments,
    openingBalances,
    importBatches,
    teacherMergeHistory,

    addStudent: (s) =>
      setStudents((prev) => [...prev, assignStudentNumber(s, prev, getActiveSettings().students)]),
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
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: (actorNameRef.current ?? FALLBACK_ACTOR_NAME),
          action: "education_type_created",
          module: "education_types",
          recordLabel: et.name,
        }),
        ...prev,
      ]);
    },
    updateEducationType: (et) => {
      setEducationTypes((prev) =>
        prev.map((x) =>
          x.id === et.id ? { ...et, createdAt: x.createdAt, updatedAt: new Date().toISOString() } : x
        )
      );
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: (actorNameRef.current ?? FALLBACK_ACTOR_NAME),
          action: "education_type_updated",
          module: "education_types",
          recordLabel: et.name,
        }),
        ...prev,
      ]);
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
      const movedTeacherPaymentIds = teacherPaymentsRef.current
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
      const s = withEarningFactor(raw, getActiveSettings().teacherEarnings);
      setSessions((prev) => [...prev, s]);
      setTeacherEarnings((prev) => upsertEarningForSession(prev, s));
    },
    updateSession: (raw) => {
      // The earning share is fixed when the status is set; editing anything
      // else (price, notes, time) keeps it — and keeps any approval.
      const previous = sessionsRef.current.find((x) => x.id === raw.id);
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
        if (!isEarningSession(previous) && isEarningSession(s)) {
          notify([buildSessionNotification("teacher_earning_created", s, ...people)]);
        }
      }
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: (actorNameRef.current ?? FALLBACK_ACTOR_NAME),
          action: "session_edited",
          module: "sessions",
          recordLabel: `${s.date} — ${s.status}`,
        }),
        ...prev,
      ]);
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
      notify(
        approved.map((s) =>
          buildSessionNotification("teacher_earning_created", s, studentsRef.current, teachersRef.current)
        )
      );
      logAudit({ action: "earnings_approved", module: "teacher_earnings", recordLabel: `${approved.length} seans` });
    },
    deleteSessions: (ids) => {
      const idSet = new Set(ids);
      setSessions((prev) => prev.filter((x) => !idSet.has(x.id)));
      setTeacherEarnings((prev) => prev.filter((e) => !idSet.has(e.sessionId)));
    },

    addPayment: (p) => {
      setPayments((prev) => [...prev, assignReceiptNumber(p, prev)]);
      notify([buildPaymentNotification(p, studentsRef.current)]);
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: (actorNameRef.current ?? FALLBACK_ACTOR_NAME),
          action: "payment_created",
          module: "payments",
          recordLabel: `${formatCurrency(p.amount)} — ${p.date}`,
        }),
        ...prev,
      ]);
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
        const next = rows.map((row, i) => {
          const existing = existingForTeacher.find((a) => a.educationTypeId === row.educationTypeId);
          return existing
            ? { ...existing, earningAmount: row.earningAmount, status: row.status, updatedAt: now }
            : {
                id: `tea-${teacherId}-${row.educationTypeId}-${Date.now()}-${i}`,
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
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: (actorNameRef.current ?? FALLBACK_ACTOR_NAME),
          action: "import_performed",
          module: "import",
          recordLabel: batch.fileName,
        }),
        ...prev,
      ]);
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
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: who,
          action: "settings_changed",
          module: "settings",
          recordLabel: INSTITUTION_SETTINGS_FIELD_LABELS[key],
        }),
        ...prev,
      ]);
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
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: (actorNameRef.current ?? FALLBACK_ACTOR_NAME),
          action: "settings_reset",
          module: "settings",
          recordLabel: INSTITUTION_SETTINGS_FIELD_LABELS[key],
        }),
        ...prev,
      ]);
    },

    account,
    saveAccountState: (next) => setAccount(next),
    updateAccountProfile: ({ name, username }) => {
      const nextName = name.trim();
      const nextUsername = username.trim();
      if (!nextName) return "Ad boş bırakılamaz.";
      if (!nextUsername) return "Kullanıcı adı boş bırakılamaz.";
      if (/\s/.test(nextUsername)) return "Kullanıcı adı boşluk içeremez.";
      setAccount((prev) => ({ ...prev, name: nextName, username: nextUsername, updatedAt: new Date().toISOString() }));
      setAuditLog((prev) => [
        makeAuditEntry({ userName: nextName, action: "account_updated", module: "auth", recordLabel: nextUsername }),
        ...prev,
      ]);
      return null;
    },
    credential,
    setCredential: (next) => setCredentialState(next),
    authSession,
    setAuthSession: (session) => setAuthSessionState(session),
    setActorName: (name) => setActorName(name),

    auditLog,
    logAuditEvent: (entry) => setAuditLog((prev) => [makeAuditEntry(entry), ...prev]),

    getBackupSnapshot: () => ({
      students,
      guardians,
      teachers,
      educationTypes,
      sessions,
      payments,
      teacherEarnings,
      teacherPayments,
      teacherEducationTypeAssignments,
      openingBalances,
      importBatches,
      teacherMergeHistory,
      weeklySessionPlans,
      notifications,
      institutionSettings,
      auditLog,
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
      // The restored audit log is kept, plus a record of the restore itself.
      setAuditLogState([
        makeAuditEntry({
          userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
          action: "backup_restored",
          module: "data",
          recordLabel: "Yedek dosyası",
        }),
        ...(d.auditLog ?? []),
      ]);
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
    resetToDemo: () => {
      clearPersistedStore();
      setStudents([...DEMO_STUDENTS]);
      setGuardians([...DEMO_GUARDIANS]);
      setTeachers([...mockTeachers]);
      setEducationTypes([...mockEducationTypes]);
      setSessions([]);
      setPayments([]);
      setTeacherEarnings([]);
      setTeacherPayments([]);
      setTeacherEducationTypeAssignments([...mockTeacherEducationTypeAssignments]);
      setWeeklySessionPlans([]);
      setNotifications([]);
      setOpeningBalances([]);
      setImportBatches([]);
      setInstitutionSettings(structuredClone(DEFAULT_INSTITUTION_SETTINGS));
      setAuditLog([]);
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
      teacherEarnings,
      teacherPayments,
      teacherEducationTypeAssignments,
      openingBalances,
      importBatches,
      teacherMergeHistory,
      weeklySessionPlans,
      notifications,
      institutionSettings,
      auditLog,
      account,
      credential,
      authSession,
      setAuditLog,
      logAudit,
      applyEarningPolicy,
      notify,
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
