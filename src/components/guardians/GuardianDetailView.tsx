"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  TrendingUp,
  CreditCard,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Users,
  User,
  BookOpen,
  Pencil,
  GraduationCap,
  UserCheck,
  Plus,
  UserPlus,
  Landmark,
  CheckCircle2,
  StickyNote,
  Trash2,
  Edit3,
  Send,
  Clock,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuardianFormDrawer } from "@/components/guardians/GuardianFormDrawer";
import { StudentFormDrawer } from "@/components/students/StudentFormDrawer";
import { PaymentFormDrawer } from "@/components/payments/PaymentFormDrawer";
import { SessionFormDrawer } from "@/components/sessions/SessionFormDrawer";
import { StatCard } from "@/components/shared/StatCard";
import { PlannedSessionsCard } from "@/components/shared/PlannedSessionsCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HistoricalRecordBadge } from "@/components/shared/HistoricalRecordBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tabs, type TabItem } from "@/components/shared/Tabs";
import { useMockStore } from "@/lib/mock/store";
import { useUserScope } from "@/lib/auth/use-scope";
import { canAccessGuardian } from "@/lib/auth/scope";
import { UnauthorizedState } from "@/components/auth/UnauthorizedState";
import {
  buildGuardianDetail,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  getStudentDebt,
  getStudentTotalBilled,
  getGuardianPlannedSummary,
} from "@/lib/helpers/finance";
import {
  buildGuardianInstallmentSummary,
  getInstallmentDisplayStatus,
} from "@/lib/helpers/installments";
import {
  buildGuardianCurrentAccountSummary,
  buildGuardianCurrentAccountMovements,
} from "@/lib/helpers/current-account";
import { DetailHeaderMeta } from "@/components/shared/DetailHeaderMeta";
import type { Student, Session, Payment, PaymentMethod, OpeningBalance, EducationType } from "@/types";
import { cn, formatTitleCase } from "@/lib/utils";

// ─── Local types ──────────────────────────────────────────────────────────────

interface NoteEntry {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  updatedAt?: string;
}

// Guardian.notes is a single string field — the structured note list is JSON-encoded
// into it so multiple timestamped/authored notes can persist via store.updateGuardian
// without a data-model migration.
function serializeNoteEntries(entries: NoteEntry[]): string {
  return JSON.stringify(entries);
}

function parseNoteEntries(raw: string | undefined): NoteEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as NoteEntry[];
  } catch {
    // Not JSON — a legacy plain-text note from before this structured format existed.
  }
  return [{ id: "note-legacy", text: raw, author: "Sistem", createdAt: new Date().toISOString() }];
}

interface ActivityEvent {
  id: string;
  type:
    | "guardian_created"
    | "guardian_updated"
    | "student_added"
    | "session_created"
    | "payment_received"
    | "installment_created"
    | "installment_paid"
    | "note_added";
  date: string;
  title: string;
  description?: string;
  iconEl: React.ElementType;
  iconColor: string;
  iconBg: string;
}

// ─── Column builders ──────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  bank_transfer: "Banka Havalesi",
  credit_card: "Kredi Kartı",
  other: "Diğer",
};

function buildStudentColumns(
  sessions: { id: string; studentId: string; studentPrice: number; sessionCount: number; status: string }[],
  payments: { id: string; studentId: string; amount: number }[],
  openingBalances: OpeningBalance[] = [],
  educationTypes: EducationType[] = []
): Column<Student>[] {
  return [
    {
      key: "name",
      header: "Öğrenci",
      render: (row) => (
        <Link
          href={`/app/students/${row.id}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.fullName}
        </Link>
      ),
    },
    {
      key: "educationTypes",
      header: "Eğitim Türleri",
      render: (row) => {
        const names = row.educationTypeIds
          .map((id) => educationTypes.find((et) => et.id === id)?.name)
          .filter(Boolean);
        return names.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {names.map((name) => (
              <span
                key={name}
                className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
              >
                {name}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-xs">—</span>
        );
      },
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
    {
      key: "totalBilled",
      header: "Toplam Tahakkuk",
      render: (row) => (
        <span className="tabular-nums text-right block">
          {formatCurrency(getStudentTotalBilled(row.id, sessions as Parameters<typeof getStudentTotalBilled>[1]))}
        </span>
      ),
      className: "hidden md:table-cell text-right",
      headerClassName: "hidden md:table-cell text-right",
    },
    {
      key: "debt",
      header: "Kalan Borç",
      render: (row) => {
        const debt = getStudentDebt(
          row.id,
          sessions as Parameters<typeof getStudentDebt>[1],
          payments as Parameters<typeof getStudentDebt>[2],
          openingBalances
        );
        return (
          <span
            className={cn(
              "tabular-nums font-semibold text-right block",
              debt > 0 ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {formatCurrency(debt)}
          </span>
        );
      },
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => <StatusBadge status={row.status} />,
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
  ];
}

function buildPaymentColumns(
  students: { id: string; fullName: string }[]
): Column<Payment>[] {
  return [
    {
      key: "date",
      header: "Tarih",
      render: (row) => (
        <span className="tabular-nums text-sm">{formatDate(row.date)}</span>
      ),
    },
    {
      key: "student",
      header: "Öğrenci",
      render: (row) => {
        const student = students.find((s) => s.id === row.studentId);
        return student ? (
          <Link
            href={`/app/students/${row.studentId}`}
            className="text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {student.fullName}
          </Link>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        );
      },
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
    {
      key: "amount",
      header: "Tutar",
      render: (row) => (
        <span className="tabular-nums font-semibold text-emerald-600">
          {formatCurrency(row.amount)}
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "method",
      header: "Yöntem",
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            {PAYMENT_METHOD_LABELS[row.method]}
          </span>
          {row.paymentSource === "installment" && (
            <span className="inline-flex rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[10px] font-medium text-indigo-700 w-fit">
              Taksit Ödemesi
            </span>
          )}
        </div>
      ),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "notes",
      header: "Açıklama",
      render: (row) => (
        <span className={cn("text-sm", row.notes ? "text-foreground" : "text-muted-foreground/40")}>
          {row.notes ?? "—"}
        </span>
      ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
  ];
}

function buildSessionColumns(
  students: { id: string; fullName: string }[],
  teachers: { id: string; fullName: string }[],
  educationTypes: EducationType[]
): Column<Session>[] {
  return [
    {
      key: "date",
      header: "Tarih",
      render: (row) => (
        <span className="tabular-nums text-sm">{formatDate(row.date)}</span>
      ),
    },
    {
      key: "time",
      header: "Saat",
      render: (row) => (
        <span className="tabular-nums text-sm text-muted-foreground">{formatTime(row.date)}</span>
      ),
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
    {
      key: "student",
      header: "Öğrenci",
      render: (row) => {
        const student = students.find((s) => s.id === row.studentId);
        return student ? (
          <Link
            href={`/app/students/${row.studentId}`}
            className="font-medium text-foreground hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {student.fullName}
          </Link>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        );
      },
    },
    {
      key: "teacher",
      header: "Öğretmen",
      render: (row) => {
        const teacher = teachers.find((t) => t.id === row.teacherId);
        return teacher ? (
          <Link
            href={`/app/teachers/${row.teacherId}`}
            className="text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {teacher.fullName}
          </Link>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        );
      },
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "educationType",
      header: "Eğitim Türü",
      render: (row) => {
        const et = educationTypes.find((e) => e.id === row.educationTypeId);
        return (
          <span className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
            {et?.name ?? "—"}
          </span>
        );
      },
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "total",
      header: "Toplam",
      render: (row) => (
        <span className="tabular-nums font-medium text-right block">
          {formatCurrency(row.studentPrice * row.sessionCount)}
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => (
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={row.status} />
          {row.billingMode === "historical_non_billable" && <HistoricalRecordBadge />}
        </div>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
  ];
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
      </div>
    </div>
  );
}

// ─── Activity dot ─────────────────────────────────────────────────────────────

function ActivityDot({
  event,
}: {
  event: ActivityEvent;
}) {
  const Icon = event.iconEl;
  return (
    <div className="relative flex gap-3">
      {/* vertical line connector */}
      <div className="flex flex-col items-center">
        <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", event.iconBg)}>
          <Icon className={cn("h-3.5 w-3.5", event.iconColor)} />
        </div>
        <div className="mt-1 flex-1 w-px bg-border/60 min-h-[16px]" />
      </div>
      <div className="pb-4 flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p className="text-sm font-medium text-foreground">{event.title}</p>
          <time className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
            {formatDateTime(event.date)}
          </time>
        </div>
        {event.description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{event.description}</p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface GuardianDetailViewProps {
  guardianId: string;
}

export function GuardianDetailView({ guardianId }: GuardianDetailViewProps) {
  const store = useMockStore();
  const scope = useUserScope();

  // Direct-URL scope enforcement — a guardian hitting another guardian's id
  // by URL gets this instead of the record. See lib/auth/scope.ts.
  if (!canAccessGuardian(guardianId, scope)) {
    return (
      <UnauthorizedState
        title="Bu veliye erişim yetkiniz yok"
        description="Bu veli kaydı hesabınızla ilişkili değil."
      />
    );
  }

  return <GuardianDetailViewContent guardianId={guardianId} store={store} />;
}

function GuardianDetailViewContent({
  guardianId,
  store,
}: GuardianDetailViewProps & { store: ReturnType<typeof useMockStore> }) {
  // ── Column builders ────────────────────────────────────────────────────────
  const studentColumns = buildStudentColumns(
    store.sessions,
    store.payments,
    store.openingBalances,
    store.educationTypes
  );
  const paymentColumns = buildPaymentColumns(store.students);
  const sessionColumns = buildSessionColumns(store.students, store.teachers, store.educationTypes);

  // ── Core data ──────────────────────────────────────────────────────────────
  const detail = buildGuardianDetail(
    guardianId,
    store.guardians,
    store.students,
    store.sessions,
    store.payments,
    store.openingBalances
  );
  const rawGuardian = store.guardians.find((g) => g.id === guardianId);

  // ── Drawer state ───────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [studentDrawerOpen, setStudentDrawerOpen] = useState(false);
  const [paymentDrawerOpen, setPaymentDrawerOpen] = useState(false);
  const [sessionDrawerOpen, setSessionDrawerOpen] = useState(false);

  // ── Notes state ────────────────────────────────────────────────────────────
  // Persisted into the guardian record's single `notes` string field (JSON-encoded),
  // via store.updateGuardian — not local-only state, so notes survive navigation/
  // refresh within the mock store session. Falls back to treating a legacy plain-text
  // note (pre-dating this structured format) as a single entry.
  const [notes, setNotes] = useState<NoteEntry[]>(() => parseNoteEntries(rawGuardian?.notes));

  const persistNotes = (updated: NoteEntry[]) => {
    setNotes(updated);
    if (rawGuardian) {
      store.updateGuardian({ ...rawGuardian, notes: serializeNoteEntries(updated) });
    }
  };

  const [noteInput, setNoteInput] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  const handleAddNote = () => {
    const text = noteInput.trim();
    if (!text) return;
    const newNote: NoteEntry = {
      id: `note-${Date.now()}`,
      text,
      author: "Kullanıcı",
      createdAt: new Date().toISOString(),
    };
    persistNotes([newNote, ...notes]);
    setNoteInput("");
  };

  const handleSaveEditNote = (id: string) => {
    const text = editingNoteText.trim();
    if (!text) return;
    persistNotes(
      notes.map((n) => (n.id === id ? { ...n, text, updatedAt: new Date().toISOString() } : n))
    );
    setEditingNoteId(null);
    setEditingNoteText("");
  };

  const handleDeleteNote = (id: string) => {
    persistNotes(notes.filter((n) => n.id !== id));
  };

  // ── Cari hesap month state ─────────────────────────────────────────────────
  const today = new Date();
  const nowYear = today.getFullYear();
  const nowMonth = today.getMonth() + 1;
  const defaultMonthValue = `${nowYear}-${String(nowMonth).padStart(2, "0")}`;
  const [selectedMonthStr, setSelectedMonthStr] = useState(defaultMonthValue);
  const [caYear, caMonth] = selectedMonthStr.split("-").map(Number) as [number, number];

  // ── Computed values ────────────────────────────────────────────────────────
  const guardianStudentIds = detail?.students.map((s) => s.id) ?? [];

  const installmentSummary = buildGuardianInstallmentSummary(
    guardianStudentIds,
    store.installmentPlans,
    today
  );

  const nextInstallmentDate = useMemo<string | null>(() => {
    const relevantPlans = store.installmentPlans.filter((p) =>
      guardianStudentIds.includes(p.studentId)
    );
    let nearest: string | null = null;
    for (const plan of relevantPlans) {
      for (const inst of plan.installments) {
        if (getInstallmentDisplayStatus(inst, today) === "pending") {
          if (nearest === null || inst.dueDate < nearest) nearest = inst.dueDate;
        }
      }
    }
    return nearest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.installmentPlans, guardianStudentIds.join(",")]);

  const guardianAccount = buildGuardianCurrentAccountSummary(
    guardianStudentIds,
    store.sessions,
    store.payments,
    caYear,
    caMonth,
    store.openingBalances
  );
  const plannedSummary = getGuardianPlannedSummary(guardianStudentIds, store.sessions);

  // ── Activity events ────────────────────────────────────────────────────────
  const activityEvents = useMemo<ActivityEvent[]>(() => {
    if (!detail || !rawGuardian) return [];
    const events: ActivityEvent[] = [];

    // Veli oluşturuldu
    events.push({
      id: "ev-guardian",
      type: "guardian_created",
      date: rawGuardian.createdAt,
      title: "Veli kaydı oluşturuldu",
      description: `${rawGuardian.fullName} sisteme eklendi`,
      iconEl: User,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    });

    // Veli güncellendi
    if (rawGuardian.updatedAt && rawGuardian.updatedAt !== rawGuardian.createdAt) {
      events.push({
        id: "ev-guardian-updated",
        type: "guardian_updated" as const,
        date: rawGuardian.updatedAt,
        title: "Veli bilgileri güncellendi",
        description: undefined,
        iconEl: Pencil,
        iconColor: "text-primary",
        iconBg: "bg-primary/10",
      });
    }

    // Öğrenciler eklendi
    for (const student of detail.students) {
      events.push({
        id: `ev-student-${student.id}`,
        type: "student_added",
        date: student.createdAt,
        title: "Öğrenci eklendi",
        description: `${student.fullName} bu veliye bağlandı`,
        iconEl: UserPlus,
        iconColor: "text-violet-600",
        iconBg: "bg-violet-100",
      });
    }

    // Seanslar
    for (const session of detail.sessions) {
      const teacher = store.teachers.find((t) => t.id === session.teacherId);
      const student = detail.students.find((s) => s.id === session.studentId);
      const et = store.educationTypes.find((e) => e.id === session.educationTypeId);
      events.push({
        id: `ev-session-${session.id}`,
        type: "session_created",
        date: session.date,
        title: "Seans planlandı",
        description: [
          student?.fullName,
          et?.name,
          teacher ? `(${teacher.fullName})` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        iconEl: CalendarDays,
        iconColor: "text-blue-600",
        iconBg: "bg-blue-100",
      });
    }

    // Ödemeler
    for (const payment of detail.payments) {
      const student = detail.students.find((s) => s.id === payment.studentId);
      events.push({
        id: `ev-payment-${payment.id}`,
        type: "payment_received",
        date: payment.date,
        title: "Ödeme alındı",
        description: `${formatCurrency(payment.amount)} — ${student?.fullName ?? ""}`,
        iconEl: CreditCard,
        iconColor: "text-emerald-600",
        iconBg: "bg-emerald-100",
      });
    }

    // Taksit planları
    const guardianPlans = store.installmentPlans.filter((p) =>
      guardianStudentIds.includes(p.studentId)
    );
    for (const plan of guardianPlans) {
      const student = detail.students.find((s) => s.id === plan.studentId);
      events.push({
        id: `ev-plan-${plan.id}`,
        type: "installment_created",
        date: plan.createdAt,
        title: "Taksit planı oluşturuldu",
        description: `${formatCurrency(plan.totalAmount)} — ${plan.installmentCount} taksit${student ? ` (${student.fullName})` : ""}`,
        iconEl: Landmark,
        iconColor: "text-indigo-600",
        iconBg: "bg-indigo-100",
      });

      // Ödenen taksitler
      for (const inst of plan.installments) {
        if (inst.status === "paid" && inst.paidDate) {
          events.push({
            id: `ev-inst-${inst.id}`,
            type: "installment_paid",
            date: inst.paidDate,
            title: `${inst.installmentNumber}. taksit ödendi`,
            description: `${formatCurrency(inst.amount)}${student ? ` — ${student.fullName}` : ""}`,
            iconEl: CheckCircle2,
            iconColor: "text-emerald-600",
            iconBg: "bg-emerald-100",
          });
        }
      }
    }

    // Notlar
    for (const note of notes) {
      events.push({
        id: `ev-note-${note.id}`,
        type: "note_added",
        date: note.createdAt,
        title: "Not eklendi",
        description: note.text.length > 80 ? `${note.text.slice(0, 80)}…` : note.text,
        iconEl: StickyNote,
        iconColor: "text-amber-600",
        iconBg: "bg-amber-100",
      });
    }

    return events.sort((a, b) => b.date.localeCompare(a.date));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, rawGuardian, store.teachers, store.installmentPlans, notes, guardianStudentIds.join(",")]);

  // ── Early return ───────────────────────────────────────────────────────────
  if (!detail) {
    return (
      <div className="space-y-6">
        <Link
          href="/app/guardians"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Veliler
        </Link>
        <EmptyState
          title="Veli bulunamadı"
          description="Bu kimliğe ait veli kaydı mevcut değil."
          icon={User}
          action={{ label: "Velilere Dön", onClick: () => window.history.back() }}
        />
      </div>
    );
  }

  const initials = detail.fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ── Activity grouping ──────────────────────────────────────────────────────
  const activityByMonth = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const ev of activityEvents) {
      const key = new Intl.DateTimeFormat("tr-TR", {
        month: "long",
        year: "numeric",
      }).format(new Date(ev.date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries());
  }, [activityEvents]);

  // ── Preselected student for payment/session drawers ────────────────────────
  const singleStudentId = detail.students.length === 1 ? detail.students[0].id : undefined;

  // ── Tab content ─────────────────────────────────────────────────────────────

  // General
  const generalContent = (
    <div className="space-y-4">
      {/* Installment warning banners */}
      {installmentSummary.planCount > 0 && installmentSummary.overdueCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">
              {installmentSummary.overdueCount} gecikmiş taksit var
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Toplam gecikmiş tutar:{" "}
              <span className="font-bold">{formatCurrency(installmentSummary.totalOverdue)}</span>
              {installmentSummary.totalPending > 0 && (
                <> · Bekleyen: <span className="font-semibold">{formatCurrency(installmentSummary.totalPending)}</span></>
              )}
            </p>
          </div>
        </div>
      )}
      {installmentSummary.planCount > 0 &&
        installmentSummary.overdueCount === 0 &&
        installmentSummary.totalPending > 0 && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-700">
                {installmentSummary.planCount} aktif taksit planı
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Bekleyen tutar:{" "}
                <span className="font-bold">{formatCurrency(installmentSummary.totalPending)}</span>
              </p>
            </div>
          </div>
        )}

      {/* Contact + Students grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Veli Bilgileri */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Veli Bilgileri
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-border/60">
            <InfoRow icon={User} label="Ad Soyad" value={detail.fullName} />
            <InfoRow icon={User} label="Yakınlık" value={detail.relationship} />
            <InfoRow
              icon={Phone}
              label="Telefon"
              value={
                <a href={`tel:${detail.phone}`} className="text-primary hover:underline">
                  {detail.phone}
                </a>
              }
            />
            {detail.email && (
              <InfoRow
                icon={Mail}
                label="E-posta"
                value={
                  <a href={`mailto:${detail.email}`} className="text-primary hover:underline">
                    {detail.email}
                  </a>
                }
              />
            )}
            {rawGuardian?.address && (
              <InfoRow
                icon={MapPin}
                label="Adres"
                value={
                  <span className="whitespace-pre-wrap leading-relaxed">
                    {rawGuardian.address}
                  </span>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Bağlı Öğrenciler */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Bağlı Öğrenciler
                {detail.students.length > 0 && (
                  <span className="ml-2 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-bold text-primary">
                    {detail.students.length}
                  </span>
                )}
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-primary"
                onClick={() => setStudentDrawerOpen(true)}
              >
                <Plus className="h-3 w-3 mr-1" />
                Ekle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {detail.students.length > 0 ? (
              <div className="divide-y divide-border/60">
                {detail.students.map((student) => {
                  const debt = getStudentDebt(student.id, store.sessions, store.payments, store.openingBalances);
                  const studentTeachers = (student.assignedTeacherIds ?? [])
                    .map((id) => store.teachers.find((t) => t.id === id)?.fullName)
                    .filter(Boolean);
                  const educationTypeNames = student.educationTypeIds
                    .map((id) => store.educationTypes.find((et) => et.id === id)?.name)
                    .filter(Boolean);
                  const lastCompletedSession = store.sessions
                    .filter((s) => s.studentId === student.id && s.status === "completed")
                    .sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

                  return (
                    <div key={student.id} className="py-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/app/students/${student.id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                        >
                          {student.fullName}
                        </Link>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={student.status} />
                          {debt > 0 && (
                            <span className="text-xs font-bold text-destructive tabular-nums">
                              {formatCurrency(debt)}
                            </span>
                          )}
                        </div>
                      </div>
                      {educationTypeNames.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <GraduationCap className="h-3 w-3 text-muted-foreground shrink-0" />
                          {educationTypeNames.map((name) => (
                            <span
                              key={name}
                              className="inline-flex rounded-full bg-primary/8 border border-primary/20 px-1.5 py-px text-[10px] font-medium text-primary"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                      {studentTeachers.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <UserCheck className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-[11px] text-muted-foreground">
                            {studentTeachers.join(", ")}
                          </span>
                        </div>
                      )}
                      {lastCompletedSession && (
                        <div className="flex items-center gap-1">
                          <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="text-[11px] text-muted-foreground">
                            Son seans: {formatDate(lastCompletedSession.date)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-4">
                <EmptyState
                  title="Öğrenci bulunamadı"
                  description="Bu veliye bağlı öğrenci kaydı yok. Yeni öğrenci ekleyebilirsiniz."
                  icon={Users}
                  action={{
                    label: "Öğrenci Ekle",
                    onClick: () => setStudentDrawerOpen(true),
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cari Hesap summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Cari Hesap Özeti —{" "}
                  {new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(
                    new Date(caYear, caMonth - 1, 1)
                  )}
                </CardTitle>
              </div>
              <p className="text-[11px] text-muted-foreground/60 pl-6">
                Önceki devir + bu ay tahakkuk − bu ay ödeme = güncel bakiye
              </p>
            </div>
            <input
              type="month"
              value={selectedMonthStr}
              onChange={(e) => e.target.value && setSelectedMonthStr(e.target.value)}
              className="h-7 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Önceki Devir
              </p>
              <p
                className={cn(
                  "mt-1 text-base font-bold tabular-nums",
                  guardianAccount.previousBalance > 0 ? "text-destructive" : "text-foreground"
                )}
              >
                {formatCurrency(Math.abs(guardianAccount.previousBalance))}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bu Ay Tahakkuk
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-foreground">
                {formatCurrency(guardianAccount.currentMonthBilled)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bu Ay Ödeme
              </p>
              <p className="mt-1 text-base font-bold tabular-nums text-emerald-600">
                {formatCurrency(guardianAccount.currentMonthPaid)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Güncel Bakiye
              </p>
              <p
                className={cn(
                  "mt-1 text-base font-bold tabular-nums",
                  guardianAccount.currentBalance > 0 ? "text-destructive" : "text-emerald-600"
                )}
              >
                {formatCurrency(Math.abs(guardianAccount.currentBalance))}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">Toplam Kalan Borç</span>
            <span
              className={cn(
                "text-sm font-bold tabular-nums",
                guardianAccount.totalDebt > 0 ? "text-destructive" : "text-emerald-600"
              )}
            >
              {formatCurrency(guardianAccount.totalDebt)}
            </span>
          </div>

          {/* Cari Hareketler */}
          {(() => {
            const movements = buildGuardianCurrentAccountMovements(
              guardianStudentIds,
              detail.students,
              store.sessions,
              store.payments,
              caYear,
              caMonth
            );
            if (movements.length === 0) return null;
            return (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Cari Hareketler
                </p>
                <div className="divide-y divide-border/60 rounded-lg border border-border/60">
                  {movements.map((mov) => (
                    <div key={mov.id} className="flex items-center justify-between px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">{mov.description}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="tabular-nums">{formatDate(mov.date)}</span>
                          {mov.studentName && (
                            <>
                              <span>·</span>
                              <span>{mov.studentName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "tabular-nums text-sm font-bold shrink-0 ml-3",
                          mov.amount > 0 ? "text-foreground" : "text-emerald-600"
                        )}
                      >
                        {mov.amount > 0 ? "+" : ""}
                        {formatCurrency(Math.abs(mov.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );

  // Notes tab
  const notesContent = (
    <div className="space-y-4">
      {/* Add note input */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <textarea
                rows={3}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAddNote();
                }}
                placeholder="Bu veli hakkında bir not ekleyin… (Ctrl+Enter ile kaydet)"
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddNote}
                  disabled={!noteInput.trim()}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Not Ekle
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes list */}
      {notes.length === 0 ? (
        <EmptyState
          title="Henüz not yok"
          description="Yukarıdaki alandan bu veli için ilk notu ekleyebilirsiniz."
          icon={StickyNote}
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                      {note.author.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{note.author}</span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(note.createdAt)}
                          {note.updatedAt && " (düzenlendi)"}
                        </span>
                      </div>
                      {editingNoteId !== note.id && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditingNoteText(note.text);
                            }}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-primary hover:bg-primary/8 transition-colors"
                          >
                            <Edit3 className="h-3 w-3" />
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                            Sil
                          </button>
                        </div>
                      )}
                    </div>

                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <textarea
                          rows={3}
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          autoFocus
                          className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingNoteId(null);
                              setEditingNoteText("");
                            }}
                          >
                            İptal
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleSaveEditNote(note.id)}
                            disabled={!editingNoteText.trim()}
                          >
                            Kaydet
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {note.text}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Activity tab
  const activityContent = (
    <div>
      {activityEvents.length === 0 ? (
        <EmptyState
          title="Aktivite yok"
          description="Bu veli için henüz kayıt bulunmuyor."
          icon={Clock}
        />
      ) : (
        <div className="space-y-6">
          {activityByMonth.map(([monthLabel, events]) => (
            <div key={monthLabel}>
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {monthLabel}
                </span>
                <div className="h-px flex-1 bg-border/60" />
              </div>
              <div>
                {events.map((ev, idx) => (
                  <div key={ev.id} className={idx === events.length - 1 ? "[&>div>div:first-child>div:last-child]:hidden" : ""}>
                    <ActivityDot event={ev} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const tabs: TabItem[] = [
    { key: "general", label: "Genel Bilgiler", content: generalContent },
    {
      key: "notes",
      label: "Notlar",
      badge: notes.length,
      content: notesContent,
    },
    {
      key: "students",
      label: "Öğrenciler",
      badge: detail.students.length,
      content: (
        <DataTable
          data={detail.students}
          columns={studentColumns}
          keyExtractor={(s) => s.id}
          emptyTitle="Öğrenci bulunamadı"
        />
      ),
    },
    {
      key: "payments",
      label: "Ödemeler",
      badge: detail.payments.length,
      content: (
        <DataTable
          data={detail.payments}
          columns={paymentColumns}
          keyExtractor={(p) => p.id}
          emptyTitle="Ödeme bulunamadı"
          emptyDescription="Bu veliye bağlı öğrenciler için henüz ödeme kaydı bulunmamaktadır."
        />
      ),
    },
    {
      key: "sessions",
      label: "Seanslar",
      badge: detail.sessions.length,
      content: (
        <DataTable
          data={detail.sessions}
          columns={sessionColumns}
          keyExtractor={(s) => s.id}
          emptyTitle="Seans bulunamadı"
          emptyDescription="Bu veliye bağlı öğrenciler için henüz seans kaydı bulunmamaktadır."
        />
      ),
    },
    {
      key: "activity",
      label: "Aktivite",
      badge: activityEvents.length,
      content: activityContent,
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-6">
        {/* Back link */}
        <Link
          href="/app/guardians"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Veliler
        </Link>

        {/* Header card */}
        <Card className="relative overflow-hidden rounded-2xl border-border/70 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <CardContent className="relative p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* Identity */}
              <div className="flex items-start gap-4 min-w-0">
                <Avatar className="h-16 w-16 shrink-0 ring-4 ring-primary/10">
                  <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h1 className="text-xl font-bold text-foreground">{formatTitleCase(detail.fullName)}</h1>
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {detail.relationship}
                    </span>
                    {detail.students.length === 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        <AlertCircle className="h-2.5 w-2.5" />
                        Öğrenci yok
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <a
                      href={`tel:${detail.phone}`}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <Phone className="h-3 w-3" />
                      {detail.phone}
                    </a>
                    {detail.email && (
                      <a
                        href={`mailto:${detail.email}`}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        <Mail className="h-3 w-3" />
                        {detail.email}
                      </a>
                    )}
                    {rawGuardian?.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[220px]">{rawGuardian.address}</span>
                      </span>
                    )}
                  </div>
                  {detail.students.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {detail.students.map((s) => (
                        <Link
                          key={s.id}
                          href={`/app/students/${s.id}`}
                          className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          {s.fullName}
                        </Link>
                      ))}
                    </div>
                  )}
                  <DetailHeaderMeta
                    createdAt={rawGuardian?.createdAt}
                    updatedAt={rawGuardian?.updatedAt}
                  />
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Düzenle
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStudentDrawerOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                  Öğrenci Ekle
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPaymentDrawerOpen(true)}>
                  <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                  Ödeme Ekle
                </Button>
                <Button size="sm" variant="default" onClick={() => setSessionDrawerOpen(true)}>
                  <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                  Seans Oluştur
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI stat cards */}
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
          <StatCard
            title="Bağlı Öğrenci"
            value={detail.students.length}
            description="Bu veliye bağlı öğrenciler"
            icon={Users}
            variant="default"
          />
          <StatCard
            title="Toplam Tahakkuk"
            value={formatCurrency(detail.totalBilled)}
            description="Bu veliye bağlı öğrenciler"
            icon={TrendingUp}
            variant="default"
          />
          <StatCard
            title="Toplam Tahsilat"
            value={formatCurrency(detail.totalPaid)}
            description="Bu veliye ait tahsilat"
            icon={CreditCard}
            variant="success"
          />
          <StatCard
            title="Kalan Borç"
            value={formatCurrency(detail.totalDebt)}
            description="Bu veliye ait kalan borç"
            icon={AlertCircle}
            variant={detail.totalDebt > 0 ? "danger" : "success"}
          />
          <StatCard
            title="Son Ödeme"
            value={detail.lastPaymentDate ? formatDate(detail.lastPaymentDate) : "Ödeme yok"}
            description={
              detail.lastPaymentDate
                ? "En son tahsilat tarihi"
                : "Henüz tahsilat yapılmadı"
            }
            icon={CalendarDays}
            variant={detail.lastPaymentDate ? "success" : "default"}
            valueClassName="text-base font-bold tracking-tight text-foreground break-words"
          />
          <StatCard
            title="Yaklaşan Taksit"
            value={nextInstallmentDate ? formatDate(nextInstallmentDate) : "Taksit yok"}
            description={
              nextInstallmentDate
                ? "En yakın vadeli taksit"
                : "Aktif taksit planı yok"
            }
            icon={Landmark}
            variant={nextInstallmentDate ? "warning" : "default"}
            valueClassName="text-base font-bold tracking-tight text-foreground break-words"
          />
        </div>

        {/* Planned sessions — informational only, never billed */}
        {plannedSummary.count > 0 && (
          <PlannedSessionsCard count={plannedSummary.count} totalValue={plannedSummary.totalValue} />
        )}

        {/* Tabs */}
        <Tabs tabs={tabs} defaultTab="general" />
      </div>

      {/* Drawers */}
      {rawGuardian && (
        <GuardianFormDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          initialData={rawGuardian}
        />
      )}
      <StudentFormDrawer
        open={studentDrawerOpen}
        onOpenChange={setStudentDrawerOpen}
        defaultGuardianId={guardianId}
      />
      <PaymentFormDrawer
        open={paymentDrawerOpen}
        onOpenChange={setPaymentDrawerOpen}
        preselectedStudentId={singleStudentId}
      />
      <SessionFormDrawer
        open={sessionDrawerOpen}
        onOpenChange={setSessionDrawerOpen}
        preselectedStudentId={singleStudentId}
      />
    </>
  );
}
