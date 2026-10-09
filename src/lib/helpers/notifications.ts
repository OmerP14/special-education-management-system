import type { InstallmentPlan, Payment, Session, Student, Teacher } from "@/types";
import type { NotificationEventKey, NotificationSettings } from "@/types/settings";
import type { CurrentUserScope } from "@/lib/auth/scope";
import type { PermissionKey } from "@/types/auth";
import { hasAnyPermission, hasPermission } from "@/lib/auth/permissions";
import { formatCurrency, formatDate, formatTime } from "@/lib/helpers/finance";
import { getInstallmentDisplayStatus } from "@/lib/helpers/installments";

// ─── In-app notifications (Ayarlar → Bildirimler) ───────────────────────────

export interface AppNotification {
  /** Deterministic per event+record, so the same event is never notified twice. */
  id: string;
  event: NotificationEventKey;
  title: string;
  message: string;
  /** Where clicking the notification takes the user. */
  href?: string;
  /** Scoping: teachers see their own, guardians their children's. */
  studentId?: string;
  teacherId?: string;
  /** Staff-only notifications (e.g. user invitations) are hidden from
   *  teacher/guardian accounts. */
  staffOnly?: boolean;
  createdAt: string;
  readAt?: string;
}

/** Keeps the bell bounded — oldest notifications beyond this drop off. */
export const MAX_NOTIFICATIONS = 200;

export function isNotificationEnabled(settings: NotificationSettings, event: NotificationEventKey): boolean {
  return settings.events[event]?.enabled ?? false;
}

/** Adds notifications whose ids aren't present yet, newest kept. */
export function mergeNotifications(prev: AppNotification[], fresh: AppNotification[]): AppNotification[] {
  const existing = new Set(prev.map((n) => n.id));
  const added = fresh.filter((n) => !existing.has(n.id));
  if (added.length === 0) return prev;
  return [...prev, ...added]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_NOTIFICATIONS);
}

/** The permission(s) a role needs to receive each event — any one suffices.
 *  A notification about a module the role cannot open is never shown,
 *  whatever the record scope says. */
const NOTIFICATION_EVENT_PERMISSIONS: Record<NotificationEventKey, PermissionKey[]> = {
  session_upcoming: ["sessions.view"],
  session_auto_completed: ["sessions.view"],
  session_cancelled: ["sessions.view"],
  student_no_show: ["sessions.view"],
  payment_received: ["finance.student_payments.view"],
  installment_due: ["finance.student_payments.view"],
  installment_overdue: ["finance.student_payments.view"],
  teacher_earning_created: ["finance.teacher_earnings.view", "teachers.view_earnings"],
  teacher_payment_made: ["finance.teacher_earnings.view", "teachers.view_earnings"],
  user_invited: ["settings.users.manage"],
};

/** Notifications the signed-in user may see: the role must allow the
 *  event (permissions), then the record must be theirs (lib/auth/scope.ts). */
export function getVisibleNotifications(
  notifications: AppNotification[],
  scope: CurrentUserScope,
  permissions: PermissionKey[]
): AppNotification[] {
  if (!hasPermission(permissions, "notifications.view")) return [];
  const allowed = notifications.filter((n) => hasAnyPermission(permissions, NOTIFICATION_EVENT_PERMISSIONS[n.event] ?? []));
  if (scope.isUnrestricted) return allowed;
  return allowed.filter((n) => {
    if (n.staffOnly) return false;
    if (scope.teacherId) return n.teacherId === scope.teacherId;
    if (scope.guardianId) return !!n.studentId && scope.linkedStudentIds.includes(n.studentId);
    return false;
  });
}

function nameOf<T extends { id: string; fullName: string }>(list: T[], id: string | undefined): string {
  return list.find((x) => x.id === id)?.fullName ?? "—";
}

/** Notification for a session-related event. */
export function buildSessionNotification(
  event: Extract<NotificationEventKey, "session_upcoming" | "session_auto_completed" | "session_cancelled" | "student_no_show" | "teacher_earning_created">,
  session: Session,
  students: Student[],
  teachers: Teacher[],
  extra?: string
): AppNotification {
  const titles: Record<typeof event, string> = {
    session_upcoming: "Yaklaşan seans",
    session_auto_completed: "Seans otomatik tamamlandı",
    session_cancelled: "Seans iptal edildi",
    student_no_show: "Öğrenci seansa gelmedi",
    teacher_earning_created: "Öğretmen hakedişi oluştu",
  };
  const when = `${formatDate(session.date)} ${formatTime(session.date)}`;
  return {
    id: `notif-${event}-${session.id}`,
    event,
    title: titles[event],
    message: `${nameOf(students, session.studentId)} · ${nameOf(teachers, session.teacherId)} · ${when}${extra ? ` · ${extra}` : ""}`,
    href: `/app/sessions?sessionId=${session.id}`,
    studentId: session.studentId,
    teacherId: session.teacherId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Time-based notifications due right now: upcoming-session reminders,
 * installment due-date reminders and overdue installments — each only when
 * its event is enabled, with the configured lead time.
 */
export function collectTimedNotifications(params: {
  settings: NotificationSettings;
  sessions: Session[];
  installmentPlans: InstallmentPlan[];
  students: Student[];
  teachers: Teacher[];
  now?: Date;
}): AppNotification[] {
  const { settings, sessions, installmentPlans, students, teachers } = params;
  const now = params.now ?? new Date();
  const out: AppNotification[] = [];

  const upcoming = settings.events.session_upcoming;
  if (upcoming?.enabled) {
    const leadMs = (upcoming.reminderMinutesBefore ?? 60) * 60_000;
    for (const s of sessions) {
      if (s.status !== "planned") continue;
      const until = new Date(s.date).getTime() - now.getTime();
      if (until > 0 && until <= leadMs) {
        out.push(buildSessionNotification("session_upcoming", s, students, teachers));
      }
    }
  }

  const due = settings.events.installment_due;
  const overdue = settings.events.installment_overdue;
  if (due?.enabled || overdue?.enabled) {
    const leadMs = (due?.reminderMinutesBefore ?? 1440) * 60_000;
    for (const plan of installmentPlans) {
      const studentName = nameOf(students, plan.studentId);
      for (const inst of plan.installments) {
        if (inst.status !== "pending") continue;
        const status = getInstallmentDisplayStatus(inst, now);
        const base = {
          studentId: plan.studentId,
          href: `/app/students/${plan.studentId}`,
          createdAt: now.toISOString(),
        };
        if (status === "overdue" && overdue?.enabled) {
          out.push({
            ...base,
            id: `notif-installment_overdue-${inst.id}`,
            event: "installment_overdue",
            title: "Taksit gecikti",
            message: `${studentName} · ${inst.installmentNumber}. taksit · ${formatCurrency(inst.amount)} · vade ${formatDate(inst.dueDate)}`,
          });
        } else if (status === "pending" && due?.enabled) {
          const dueAt = new Date(`${inst.dueDate.slice(0, 10)}T09:00:00`).getTime();
          const until = dueAt - now.getTime();
          if (until > -86_400_000 && until <= leadMs) {
            out.push({
              ...base,
              id: `notif-installment_due-${inst.id}`,
              event: "installment_due",
              title: "Taksit vadesi yaklaşıyor",
              message: `${studentName} · ${inst.installmentNumber}. taksit · ${formatCurrency(inst.amount)} · vade ${formatDate(inst.dueDate)}`,
            });
          }
        }
      }
    }
  }

  return out;
}

/** Brings notifications saved by older versions onto the current shape. */
export function normalizeNotifications(raw: unknown): AppNotification[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
    .map((n) => {
      if (typeof n.event === "string") return n as unknown as AppNotification;
      // Old shape: { type: "session_auto_completed", sessionId, studentId, teacherId, sessionDate }
      return {
        id: String(n.id),
        event: "session_auto_completed" as const,
        title: "Seans otomatik tamamlandı",
        message: typeof n.sessionDate === "string" ? `${formatDate(n.sessionDate)} ${formatTime(n.sessionDate)}` : "",
        href: typeof n.sessionId === "string" ? `/app/sessions?sessionId=${n.sessionId}` : undefined,
        studentId: typeof n.studentId === "string" ? n.studentId : undefined,
        teacherId: typeof n.teacherId === "string" ? n.teacherId : undefined,
        createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date().toISOString(),
        readAt: typeof n.readAt === "string" ? n.readAt : undefined,
      };
    });
}

/** "Ödeme alındı" notification for a student payment. */
export function buildPaymentNotification(payment: Payment, students: Student[]): AppNotification {
  return {
    id: `notif-payment_received-${payment.installmentPlanId ? `${payment.installmentPlanId}-${payment.installmentNumber}` : payment.id}`,
    event: "payment_received",
    title: "Ödeme alındı",
    message: `${nameOf(students, payment.studentId)} · ${formatCurrency(payment.amount)} · ${formatDate(payment.date)}`,
    href: `/app/students/${payment.studentId}`,
    studentId: payment.studentId,
    createdAt: new Date().toISOString(),
  };
}
