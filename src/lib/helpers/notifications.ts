import type { Payment, Session, Student, Teacher } from "@/types";
import type { NotificationEventKey, NotificationSettings } from "@/types/settings";
import { formatCurrency, formatDate, formatTime } from "@/lib/helpers/finance";

// ─── In-app notifications (Ayarlar → Bildirimler) ───────────────────────────

export interface AppNotification {
  /** Deterministic per event+record, so the same event is never notified twice. */
  id: string;
  event: NotificationEventKey;
  title: string;
  message: string;
  /** Where clicking the notification takes the user. */
  href?: string;
  studentId?: string;
  teacherId?: string;
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
 * Time-based notifications due right now: upcoming-session reminders, when
 * the event is enabled, with the configured lead time.
 */
export function collectTimedNotifications(params: {
  settings: NotificationSettings;
  sessions: Session[];
  students: Student[];
  teachers: Teacher[];
  now?: Date;
}): AppNotification[] {
  const { settings, sessions, students, teachers } = params;
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

  return out;
}

/** Brings notifications saved by older versions onto the current shape. */
/** Events whose feature was removed — their stored notifications are dropped. */
const REMOVED_EVENTS = ["user_invited", "installment_due", "installment_overdue"];

export function normalizeNotifications(raw: unknown): AppNotification[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (n): n is Record<string, unknown> =>
        !!n && typeof n === "object" && !REMOVED_EVENTS.includes(n.event as string)
    )
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
    id: `notif-payment_received-${payment.id}`,
    event: "payment_received",
    title: "Ödeme alındı",
    message: `${nameOf(students, payment.studentId)} · ${formatCurrency(payment.amount)} · ${formatDate(payment.date)}`,
    href: `/app/students/${payment.studentId}`,
    studentId: payment.studentId,
    createdAt: new Date().toISOString(),
  };
}
