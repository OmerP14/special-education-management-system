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
  TeacherEducationTypeAssignment,
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
import { mockTeacherEducationTypeAssignments } from "@/lib/mock/teacher-education-type-assignments";
import { mockInstallmentPlans } from "@/lib/mock/installment-plans";
import { mockCashMovements } from "@/lib/mock/cash-movements";
import { mockWeeklySessionPlans } from "@/lib/mock/weekly-session-plans";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { mockAppUsers } from "@/lib/mock/app-users";
import { mockCredentials } from "@/lib/mock/credentials";
import type { InstitutionSettings, InstitutionSettingsKey, AuditLogEntry, AppUser } from "@/types/settings";
import { DEFAULT_INSTITUTION_SETTINGS, getSettingsDefaults } from "@/lib/settings/defaults";
import { INSTITUTION_SETTINGS_FIELD_LABELS } from "@/lib/settings/sections";
import type { Role, Credential, AuthSession, Invitation, PasswordResetToken } from "@/types/auth";
import { SYSTEM_ROLES, migrateRemovedRoleId } from "@/lib/auth/roles";
import { generateToken } from "@/lib/auth/tokens";
import { loadPersistedStore, savePersistedStore, clearPersistedStore } from "@/lib/mock/persistence";
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
  teacherEducationTypeAssignments: TeacherEducationTypeAssignment[];
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
   *  weekly plan/assignment — re-validated against current data right before
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
  /** Fully replaces the assignment set for one teacher in a single write — this
   *  is what makes "duplicate assignment for the same teacherId+educationTypeId"
   *  structurally impossible, since there is no other way to add/edit a row. */
  upsertTeacherEducationTypeAssignments: (
    teacherId: string,
    tenantId: string,
    rows: { educationTypeId: string; earningAmount: number | null; status: "active" | "inactive" }[]
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
  resetToDemo: () => void;
  notifications: AppNotification[];
  markAllNotificationsRead: () => void;

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

  // ─── Users & roles (Kullanıcılar ve Roller) — see src/lib/auth for the real
  //     canonical Role/permission model these reference ─────────────────────
  appUsers: AppUser[];
  /** No-ops on a duplicate email (case-insensitive) — mirrors the "prevent
   *  duplicate email invites" requirement without a separate validation pass. */
  inviteAppUser: (user: AppUser) => void;
  /** Logs `user_updated`, and additionally `role_changed` when `roleId`
   *  differs from the previous record — see AuditModule usage below. */
  updateAppUser: (user: AppUser) => void;
  /** No-ops if this would leave zero active owners — deliberately no hard
   *  delete for users either, same reasoning as Student/Teacher/Guardian at
   *  the top of this file: deactivate, never remove. Logs `user_deactivated`. */
  deactivateAppUser: (id: string) => void;
  /** Logs `user_activated`. Also clears any prior lockout — this doubles as
   *  the "unlock" action for a locked account in this phase. */
  activateAppUser: (id: string) => void;
  /** No-ops for a non-"invited" user. Extends/replaces the pending
   *  invitation's token and expiry — same "mock resend" reasoning as
   *  inviteAppUser (nothing is actually emailed). */
  resendInvitation: (userId: string) => void;
  /** No-ops for a non-pending invitation. The AppUser stays "invited" — the
   *  admin re-invites with a fresh token via inviteAppUser/resendInvitation
   *  rather than this action reviving the old one. */
  revokeInvitation: (invitationId: string) => void;

  // ─── Roles (Settings → Kullanıcılar ve Roller → Roller/Yetki Matrisi) ─────
  roles: Role[];
  /** Adds a custom role (custom or, in principle, a re-seed of a system one
   *  — the UI only ever calls this for custom roles). */
  createRole: (role: Role) => void;
  /** Full replace by id. Callers (the Roller tab's editor) are responsible
   *  for not letting a system role's `key`/`isSystemRole`/`isOwnerRole`
   *  change — see RolesTab. */
  updateRole: (role: Role) => void;
  /** No-ops for a system role (never deactivatable) or a role still
   *  referenced by any AppUser — same "usage protection" pattern as
   *  deleteEducationType above. */
  deactivateRole: (id: string) => void;

  // ─── Auth (see src/lib/auth/AuthProvider.tsx — the only real consumer) ────
  /** Never read/written outside src/lib/auth/local-auth-service.ts. */
  credentials: Credential[];
  setCredential: (credential: Credential) => void;
  authSession: AuthSession | null;
  setAuthSession: (session: AuthSession | null) => void;
  /** Kept in sync by AuthProvider whenever the signed-in user changes — lets
   *  pre-existing store actions (addEducationType, updateSession, ...) log
   *  audit entries under the real actor's name without every one of those
   *  actions/call sites needing to accept and thread through an explicit
   *  parameter. See actorNameRef below. */
  setActorName: (name: string | null) => void;

  // ─── Invitations / password resets (mock-delivery — see types/auth.ts) ────
  invitations: Invitation[];
  setInvitation: (invitation: Invitation) => void;
  passwordResets: PasswordResetToken[];
  setPasswordReset: (token: PasswordResetToken) => void;

  // ─── İşlem Geçmişi ────────────────────────────────────────────────────────
  auditLog: AuditLogEntry[];
  /** General-purpose escape hatch for pages that need to record a one-off
   *  event with no dedicated store action of their own (e.g. Veri Yönetimi's
   *  backup/restore/export buttons). Settings changes, education type
   *  create/update, imports, payments, session edits, invites, and auth
   *  events already log themselves from within their own store actions —
   *  see each action's own comment. */
  logAuditEvent: (entry: Omit<AuditLogEntry, "id" | "tenantId" | "occurredAt">) => void;
}

/** Everything persisted to localStorage — see lib/mock/persistence.ts. One
 *  shape, not per-field bespoke persistence code. */
interface PersistedState {
  students: Student[];
  guardians: Guardian[];
  teachers: Teacher[];
  educationTypes: EducationType[];
  sessions: Session[];
  payments: Payment[];
  teacherEarnings: TeacherEarning[];
  teacherPayments: TeacherPayment[];
  teacherEducationTypeAssignments: TeacherEducationTypeAssignment[];
  installmentPlans: InstallmentPlan[];
  cashMovements: CashMovement[];
  openingBalances: OpeningBalance[];
  importBatches: ImportBatch[];
  teacherMergeHistory: TeacherMergeHistory[];
  weeklySessionPlans: WeeklySessionPlan[];
  notifications: AppNotification[];
  institutionSettings: InstitutionSettings;
  appUsers: AppUser[];
  auditLog: AuditLogEntry[];
  roles: Role[];
  credentials: Credential[];
  authSession: AuthSession | null;
  invitations: Invitation[];
  passwordResets: PasswordResetToken[];
}

// ─── Context ───────────────────────────────────────────────────────────────────

const MockStoreContext = createContext<MockStore | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function MockDataProvider({ children }: { children: ReactNode }) {
  // Read once per mount — every state initializer below reads from this same
  // snapshot instead of each re-parsing localStorage independently. `null`
  // (nothing persisted yet, or a stale schema version) falls back to the
  // existing seed data exactly as before this phase.
  const [persisted] = useState(() => loadPersistedStore<PersistedState>());

  const [students, setStudents] = useState<Student[]>(() => persisted?.students ?? mockStudents);
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const [guardians, setGuardians] = useState<Guardian[]>(() => persisted?.guardians ?? mockGuardians);
  const [teachers, setTeachers] = useState<Teacher[]>(() => persisted?.teachers ?? mockTeachers);
  const [educationTypes, setEducationTypes] = useState<EducationType[]>(
    () => persisted?.educationTypes ?? mockEducationTypes
  );
  const educationTypesRef = useRef(educationTypes);
  educationTypesRef.current = educationTypes;
  const [sessions, setSessions] = useState<Session[]>(() => persisted?.sessions ?? mockSessions);
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
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
  teachersRef.current = teachers;
  const teacherPaymentsRef = useRef(teacherPayments);
  teacherPaymentsRef.current = teacherPayments;
  const [teacherEducationTypeAssignments, setTeacherEducationTypeAssignments] = useState<TeacherEducationTypeAssignment[]>(
    () => persisted?.teacherEducationTypeAssignments ?? mockTeacherEducationTypeAssignments
  );
  // Refs so mergeTeachers/rollbackTeacherMerge always compute against a single
  // consistent, current snapshot across every array they touch at once — same
  // reasoning as teachersRef/teacherPaymentsRef above.
  const teacherEarningsRef = useRef(teacherEarnings);
  teacherEarningsRef.current = teacherEarnings;
  const teacherEducationTypeAssignmentsRef = useRef(teacherEducationTypeAssignments);
  teacherEducationTypeAssignmentsRef.current = teacherEducationTypeAssignments;
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>(
    () => persisted?.installmentPlans ?? mockInstallmentPlans
  );
  // Always-current ref so markInstallmentPaid / cancelInstallment never read
  // a stale closure snapshot when called from memoised event handlers.
  const installmentPlansRef = useRef(installmentPlans);
  installmentPlansRef.current = installmentPlans;
  const [cashMovements, setCashMovements] = useState<CashMovement[]>(
    () => persisted?.cashMovements ?? mockCashMovements
  );
  const [openingBalances, setOpeningBalances] = useState<OpeningBalance[]>(
    () => persisted?.openingBalances ?? []
  );
  const [importBatches, setImportBatches] = useState<ImportBatch[]>(() => persisted?.importBatches ?? []);
  const [weeklySessionPlans, setWeeklySessionPlans] = useState<WeeklySessionPlan[]>(
    () => persisted?.weeklySessionPlans ?? mockWeeklySessionPlans
  );
  const weeklySessionPlansRef = useRef(weeklySessionPlans);
  weeklySessionPlansRef.current = weeklySessionPlans;
  const [teacherMergeHistory, setTeacherMergeHistory] = useState<TeacherMergeHistory[]>(
    () => persisted?.teacherMergeHistory ?? []
  );
  const teacherMergeHistoryRef = useRef(teacherMergeHistory);
  teacherMergeHistoryRef.current = teacherMergeHistory;
  const [notifications, setNotifications] = useState<AppNotification[]>(() => persisted?.notifications ?? []);
  const [institutionSettings, setInstitutionSettings] = useState<InstitutionSettings>(
    () => persisted?.institutionSettings ?? structuredClone(DEFAULT_INSTITUTION_SETTINGS)
  );
  const [appUsers, setAppUsers] = useState<AppUser[]>(() => persisted?.appUsers ?? [...mockAppUsers]);
  const appUsersRef = useRef(appUsers);
  appUsersRef.current = appUsers;
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => persisted?.auditLog ?? []);

  // ─── Roles / credentials / auth session / invitations / password resets ──
  const [roles, setRoles] = useState<Role[]>(() => persisted?.roles ?? SYSTEM_ROLES);
  const rolesRef = useRef(roles);
  rolesRef.current = roles;
  const [credentials, setCredentials] = useState<Credential[]>(() => persisted?.credentials ?? mockCredentials);
  const [authSession, setAuthSessionState] = useState<AuthSession | null>(() => persisted?.authSession ?? null);
  const [invitations, setInvitations] = useState<Invitation[]>(() => persisted?.invitations ?? []);
  const invitationsRef = useRef(invitations);
  invitationsRef.current = invitations;
  const [passwordResets, setPasswordResets] = useState<PasswordResetToken[]>(() => persisted?.passwordResets ?? []);
  // Not persisted (ephemeral per-tab) — kept fresh by AuthProvider via
  // setActorName. See FALLBACK_ACTOR_NAME / the MockStore interface comment.
  const [actorName, setActorName] = useState<string | null>(null);
  const actorNameRef = useRef(actorName);
  actorNameRef.current = actorName;

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

  // Phase 3 role simplification migration — a snapshot persisted from before
  // Muhasebe/Danışma/Görüntüleyici were removed can still have an AppUser
  // pointing at one of those roleIds. Runs once on mount so no orphan
  // roleId survives a reload; see migrateRemovedRoleId's own doc comment
  // for why every removed role maps to Yönetici (role-admin).
  useEffect(() => {
    const affected = appUsersRef.current.filter((u) => migrateRemovedRoleId(u.roleId));
    if (affected.length === 0) return;
    const now = new Date().toISOString();
    setAppUsers((prev) =>
      prev.map((u) => {
        const newRoleId = migrateRemovedRoleId(u.roleId);
        return newRoleId ? { ...u, roleId: newRoleId, updatedAt: now } : u;
      })
    );
    setAuditLog((prev) => [
      ...affected.map((u) =>
        makeAuditEntry({
          userName: "Sistem (rol göçü)",
          action: "role_changed",
          module: "users",
          recordLabel: `${u.name} <${u.email}>`,
          oldValueSummary: u.roleId,
          newValueSummary: migrateRemovedRoleId(u.roleId) ?? undefined,
        })
      ),
      ...prev,
    ]);
  }, []);

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
    savePersistedStore<PersistedState>({
      students,
      guardians,
      teachers,
      educationTypes,
      sessions,
      payments,
      teacherEarnings,
      teacherPayments,
      teacherEducationTypeAssignments,
      installmentPlans,
      cashMovements,
      openingBalances,
      importBatches,
      teacherMergeHistory,
      weeklySessionPlans,
      notifications,
      institutionSettings,
      appUsers,
      auditLog,
      roles,
      credentials,
      authSession,
      invitations,
      passwordResets,
    });
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
    installmentPlans,
    cashMovements,
    openingBalances,
    importBatches,
    teacherMergeHistory,
    weeklySessionPlans,
    notifications,
    institutionSettings,
    appUsers,
    auditLog,
    roles,
    credentials,
    authSession,
    invitations,
    passwordResets,
  ]);

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
    deleteSessions: (ids) => {
      const idSet = new Set(ids);
      setSessions((prev) => prev.filter((x) => !idSet.has(x.id)));
      setTeacherEarnings((prev) => prev.filter((e) => !idSet.has(e.sessionId)));
    },

    addPayment: (p) => {
      setPayments((prev) => [...prev, p]);
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: (actorNameRef.current ?? FALLBACK_ACTOR_NAME),
          action: "payment_created",
          module: "payments",
          recordLabel: `${p.amount} ₺ — ${p.date}`,
        }),
        ...prev,
      ]);
    },
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

    appUsers,
    inviteAppUser: (user) => {
      const exists = appUsersRef.current.some(
        (u) => u.email.toLowerCase() === user.email.toLowerCase()
      );
      if (exists) return;
      setAppUsers((prev) => [...prev, user]);
      // Mock email delivery: a single-use, 7-day token is created right
      // alongside the user — the Davetler tab is where an admin copies the
      // link, nothing is actually sent. See types/auth.ts's Invitation.
      const now = new Date().toISOString();
      setInvitations((prev) => [
        ...prev,
        {
          id: `invite-${user.id}`,
          tenantId: user.tenantId,
          token: generateToken(),
          userId: user.id,
          email: user.email,
          roleId: user.roleId,
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: now,
          createdBy: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
        },
      ]);
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: (actorNameRef.current ?? FALLBACK_ACTOR_NAME),
          action: "user_invited",
          module: "users",
          recordLabel: `${user.name} <${user.email}>`,
        }),
        ...prev,
      ]);
    },
    updateAppUser: (user) => {
      const previous = appUsersRef.current.find((u) => u.id === user.id);
      setAppUsers((prev) => prev.map((u) => (u.id === user.id ? user : u)));
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
          action: "user_updated",
          module: "users",
          recordLabel: `${user.name} <${user.email}>`,
        }),
        ...prev,
      ]);
      if (previous && previous.roleId !== user.roleId) {
        const previousRole = SYSTEM_ROLES.find((r) => r.id === previous.roleId);
        const nextRole = SYSTEM_ROLES.find((r) => r.id === user.roleId);
        setAuditLog((prev) => [
          makeAuditEntry({
            userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
            action: "role_changed",
            module: "users",
            recordLabel: `${user.name} <${user.email}>`,
            oldValueSummary: previousRole?.name,
            newValueSummary: nextRole?.name,
          }),
          ...prev,
        ]);
      }
    },
    deactivateAppUser: (id) => {
      const target = appUsersRef.current.find((u) => u.id === id);
      if (!target) return;
      const targetRole = SYSTEM_ROLES.find((r) => r.id === target.roleId);
      if (targetRole?.isOwnerRole) {
        const otherActiveOwners = appUsersRef.current.filter((u) => {
          const role = SYSTEM_ROLES.find((r) => r.id === u.roleId);
          return role?.isOwnerRole && u.status === "active" && u.id !== id;
        });
        if (otherActiveOwners.length === 0) return; // never deactivate the sole owner
      }
      setAppUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, status: "inactive" as const, updatedAt: new Date().toISOString() } : u))
      );
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
          action: "user_deactivated",
          module: "users",
          recordLabel: `${target.name} <${target.email}>`,
        }),
        ...prev,
      ]);
    },
    activateAppUser: (id) => {
      const target = appUsersRef.current.find((u) => u.id === id);
      setAppUsers((prev) =>
        prev.map((u) =>
          u.id === id
            ? {
                ...u,
                status: "active" as const,
                // Clears any prior lockout alongside reactivating — "Etkinleştir"
                // on a locked account IS the unlock action (no separate one in Phase 2).
                failedLoginAttempts: 0,
                lockedUntil: undefined,
                updatedAt: new Date().toISOString(),
              }
            : u
        )
      );
      if (target) {
        setAuditLog((prev) => [
          makeAuditEntry({
            userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
            action: "user_activated",
            module: "users",
            recordLabel: `${target.name} <${target.email}>`,
          }),
          ...prev,
        ]);
      }
    },
    resendInvitation: (userId) => {
      const target = appUsersRef.current.find((u) => u.id === userId);
      if (!target || target.status !== "invited") return;
      const now = new Date().toISOString();
      const existing = invitationsRef.current.find((i) => i.userId === userId && i.status === "pending");
      setInvitations((prev) => [
        ...prev.filter((i) => i.userId !== userId || i.status !== "pending"),
        {
          id: existing?.id ?? `invite-${userId}-${Date.now()}`,
          tenantId: target.tenantId,
          token: generateToken(),
          userId,
          email: target.email,
          roleId: target.roleId,
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: now,
          createdBy: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
        },
      ]);
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
          action: "invitation_resent",
          module: "users",
          recordLabel: `${target.name} <${target.email}>`,
        }),
        ...prev,
      ]);
    },
    revokeInvitation: (invitationId) => {
      const invitation = invitationsRef.current.find((i) => i.id === invitationId);
      if (!invitation || invitation.status !== "pending") return;
      setInvitations((prev) =>
        prev.map((i) => (i.id === invitationId ? { ...i, status: "revoked" as const, revokedAt: new Date().toISOString() } : i))
      );
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
          action: "invitation_revoked",
          module: "users",
          recordLabel: invitation.email,
        }),
        ...prev,
      ]);
    },

    roles,
    createRole: (role) => {
      setRoles((prev) => [...prev, role]);
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
          action: "role_created",
          module: "users",
          recordLabel: role.name,
        }),
        ...prev,
      ]);
    },
    updateRole: (role) => {
      setRoles((prev) => prev.map((r) => (r.id === role.id ? role : r)));
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
          action: "role_updated",
          module: "users",
          recordLabel: role.name,
        }),
        ...prev,
      ]);
    },
    deactivateRole: (id) => {
      const target = rolesRef.current.find((r) => r.id === id);
      if (!target || target.isSystemRole) return;
      const inUse = appUsersRef.current.some((u) => u.roleId === id && u.status !== "inactive");
      if (inUse) return;
      setRoles((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: false, updatedAt: new Date().toISOString() } : r)));
      setAuditLog((prev) => [
        makeAuditEntry({
          userName: actorNameRef.current ?? FALLBACK_ACTOR_NAME,
          action: "role_deactivated",
          module: "users",
          recordLabel: target.name,
        }),
        ...prev,
      ]);
    },

    credentials,
    setCredential: (credential) =>
      setCredentials((prev) => [...prev.filter((c) => c.userId !== credential.userId), credential]),
    authSession,
    setAuthSession: (session) => setAuthSessionState(session),
    setActorName: (name) => setActorName(name),

    invitations,
    setInvitation: (invitation) =>
      setInvitations((prev) => [...prev.filter((i) => i.id !== invitation.id), invitation]),
    passwordResets,
    setPasswordReset: (token) =>
      setPasswordResets((prev) => [...prev.filter((t) => t.token !== token.token), token]),

    auditLog,
    logAuditEvent: (entry) => setAuditLog((prev) => [makeAuditEntry(entry), ...prev]),

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
      setInstallmentPlans([]);
      setCashMovements([]);
      setWeeklySessionPlans([]);
      setNotifications([]);
      setOpeningBalances([]);
      setImportBatches([]);
      setInstitutionSettings(structuredClone(DEFAULT_INSTITUTION_SETTINGS));
      setAppUsers([...mockAppUsers]);
      setCredentials([...mockCredentials]);
      setAuthSessionState(null);
      setAuditLog([]);
      setTeacherMergeHistory([]);
      setRoles(SYSTEM_ROLES);
      setInvitations([]);
      setPasswordResets([]);
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
      teacherEducationTypeAssignments,
      installmentPlans,
      cashMovements,
      openingBalances,
      importBatches,
      teacherMergeHistory,
      weeklySessionPlans,
      notifications,
      institutionSettings,
      appUsers,
      auditLog,
      roles,
      credentials,
      authSession,
      invitations,
      passwordResets,
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
