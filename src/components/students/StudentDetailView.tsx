"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  TrendingUp,
  CreditCard,
  AlertCircle,
  Phone,
  User,
  GraduationCap,
  StickyNote,
  Check,
  BookOpen,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tabs, type TabItem } from "@/components/shared/Tabs";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import {
  buildStudentDetail,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatTime,
  getPaymentMethodLabel,
} from "@/lib/helpers/finance";
import {
  getInstallmentDisplayStatus,
  getPlanProgress,
  getIntervalLabel,
} from "@/lib/helpers/installments";
import { buildStudentCurrentAccount } from "@/lib/helpers/current-account";
import type { Session, Payment, PaymentMethod, InstallmentPlan } from "@/types";
import { cn } from "@/lib/utils";

// ─── Column builders ───────────────────────────────────────────────────────────

function buildSessionColumns(
  teachers: { id: string; fullName: string }[]
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
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatTime(row.date)}
        </span>
      ),
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
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
        const et = mockEducationTypes.find((e) => e.id === row.educationTypeId);
        return (
          <span className="text-muted-foreground">{et?.name ?? "—"}</span>
        );
      },
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "sessionCount",
      header: "Adet",
      render: (row) => (
        <span className="tabular-nums text-center">{row.sessionCount}</span>
      ),
      className: "hidden sm:table-cell text-center",
      headerClassName: "hidden sm:table-cell text-center",
    },
    {
      key: "unitPrice",
      header: "Birim",
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {formatCurrency(row.studentPrice)}
        </span>
      ),
      className: "hidden md:table-cell text-right",
      headerClassName: "hidden md:table-cell text-right",
    },
    {
      key: "total",
      header: "Toplam",
      render: (row) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.studentPrice * row.sessionCount)}
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => <StatusBadge status={row.status} />,
      className: "text-right",
      headerClassName: "text-right",
    },
  ];
}

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  bank_transfer: "Banka Havalesi",
  credit_card: "Kredi Kartı",
  other: "Diğer",
};

const paymentColumns: Column<Payment>[] = [
  {
    key: "date",
    header: "Tarih",
    render: (row) => (
      <span className="tabular-nums text-sm">{formatDate(row.date)}</span>
    ),
  },
  {
    key: "amount",
    header: "Tutar",
    render: (row) => (
      <span className="tabular-nums font-semibold text-emerald-600">
        {formatCurrency(row.amount)}
      </span>
    ),
  },
  {
    key: "method",
    header: "Yöntem",
    render: (row) => (
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-sm">
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

// ─── Sub-components ────────────────────────────────────────────────────────────

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

// ─── Installment plan card ─────────────────────────────────────────────────────

function InstallmentPlanCard({
  plan,
  today,
  onMarkPaid,
}: {
  plan: InstallmentPlan;
  today: Date;
  onMarkPaid: (planId: string, instId: string) => void;
}) {
  const progress = getPlanProgress(plan, today);
  const paidFraction = `${progress.paid}/${plan.installmentCount}`;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Plan header */}
      <div className="flex items-center justify-between bg-muted/30 px-4 py-3 border-b border-border/60">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(plan.totalAmount)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {paidFraction} taksit ödendi · {getIntervalLabel(plan.interval, plan.customIntervalDays)} · {getPaymentMethodLabel(plan.method)}
          </p>
        </div>
        <div className="text-right shrink-0 ml-4">
          {progress.overdue > 0 && (
            <span className="inline-flex rounded-full bg-red-100 border border-red-200 px-2 py-0.5 text-[10px] font-medium text-red-700">
              {progress.overdue} gecikmiş
            </span>
          )}
        </div>
      </div>
      {/* Installment rows */}
      <div className="divide-y divide-border/60">
        {plan.installments.map((inst) => {
          const display = getInstallmentDisplayStatus(inst, today);
          return (
            <div
              key={inst.id}
              className="flex items-center gap-3 px-4 py-2.5"
            >
              <span className="text-xs text-muted-foreground w-5 shrink-0 text-center">
                {inst.installmentNumber}.
              </span>
              <span className="text-xs tabular-nums text-foreground flex-1">
                {formatDate(inst.dueDate)}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(inst.amount)}
              </span>
              <StatusBadge status={display} />
              {(display === "pending" || display === "overdue") && (
                <button
                  onClick={() => onMarkPaid(plan.id, inst.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0"
                >
                  <Check className="h-3 w-3" />
                  Ödendi
                </button>
              )}
              {display === "paid" && inst.paidDate && (
                <span className="text-[11px] text-muted-foreground shrink-0">
                  {formatDate(inst.paidDate)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface StudentDetailViewProps {
  studentId: string;
}

export function StudentDetailView({ studentId }: StudentDetailViewProps) {
  const store = useMockStore();
  const sessionColumns = buildSessionColumns(store.teachers);
  const detail = buildStudentDetail(
    studentId,
    store.students,
    store.guardians,
    mockEducationTypes,
    store.teachers,
    store.sessions,
    store.payments
  );

  const today = new Date();
  const studentPlans = store.installmentPlans.filter(
    (p) => p.studentId === studentId
  );

  // Cari Hesap state
  const nowYear = today.getFullYear();
  const nowMonth = today.getMonth() + 1;
  const defaultMonthValue = `${nowYear}-${String(nowMonth).padStart(2, "0")}`;
  const [selectedMonthStr, setSelectedMonthStr] = useState(defaultMonthValue);
  const [caYear, caMonth] = selectedMonthStr.split("-").map(Number) as [number, number];
  const account = buildStudentCurrentAccount(
    studentId,
    store.sessions,
    store.payments,
    caYear,
    caMonth
  );

  if (!detail) {
    return (
      <div className="space-y-6">
        <Link
          href="/app/students"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Öğrenciler
        </Link>
        <EmptyState
          title="Öğrenci bulunamadı"
          description="Bu kimliğe ait öğrenci kaydı mevcut değil."
          icon={User}
          action={{
            label: "Öğrencilere Dön",
            onClick: () => window.history.back(),
          }}
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

  // ─── Tab contents ───────────────────────────────────────────────────────────

  const generalInfoContent = (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Student info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Öğrenci Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 divide-y divide-border/60">
          <InfoRow icon={User} label="Ad Soyad" value={detail.fullName} />
          <InfoRow
            icon={CalendarDays}
            label="Doğum Tarihi"
            value={formatDate(detail.birthDate)}
          />
          <InfoRow
            icon={GraduationCap}
            label="Eğitim Türleri"
            value={
              detail.educationTypeNames.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {detail.educationTypeNames.map((name) => (
                    <span
                      key={name}
                      className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">Tanımlanmamış</span>
              )
            }
          />
          <InfoRow
            icon={GraduationCap}
            label="Atanan Öğretmenler"
            value={
              detail.assignedTeachers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {detail.assignedTeachers.map((t) => (
                    <Link
                      key={t.id}
                      href={`/app/teachers/${t.id}`}
                      className="text-primary hover:underline text-sm"
                    >
                      {t.fullName}
                    </Link>
                  ))}
                </div>
              ) : (
                "Henüz atanmamış"
              )
            }
          />
        </CardContent>
      </Card>

      {/* Guardian info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Veli Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 divide-y divide-border/60">
          {detail.allGuardians.length > 0 ? (
            detail.allGuardians.map((guardian) => (
              <div key={guardian.id}>
                <InfoRow
                  icon={User}
                  label={guardian.relationship}
                  value={
                    <Link
                      href={`/app/guardians/${guardian.id}`}
                      className="text-primary hover:underline"
                    >
                      {guardian.fullName}
                    </Link>
                  }
                />
                <InfoRow
                  icon={Phone}
                  label="Telefon"
                  value={
                    <a
                      href={`tel:${guardian.phone}`}
                      className="text-primary hover:underline"
                    >
                      {guardian.phone}
                    </a>
                  }
                />
                {guardian.email && (
                  <InfoRow
                    icon={User}
                    label="E-posta"
                    value={
                      <a
                        href={`mailto:${guardian.email}`}
                        className="text-primary hover:underline"
                      >
                        {guardian.email}
                      </a>
                    }
                  />
                )}
                {detail.allGuardians.indexOf(guardian) < detail.allGuardians.length - 1 && (
                  <Separator className="my-2" />
                )}
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Veli kaydı bulunamadı
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const sessionsContent = (
    <DataTable
      data={detail.sessions}
      columns={sessionColumns}
      keyExtractor={(s) => s.id}
      emptyTitle="Seans bulunamadı"
      emptyDescription="Bu öğrenciye ait seans kaydı bulunmamaktadır."
    />
  );

  const paymentsContent = (
    <div className="space-y-6">
      {/* Installment plans */}
      {studentPlans.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Taksit Planları ({studentPlans.length})
          </p>
          {studentPlans.map((plan) => (
            <InstallmentPlanCard
              key={plan.id}
              plan={plan}
              today={today}
              onMarkPaid={store.markInstallmentPaid}
            />
          ))}
        </div>
      )}

      {/* Single payments */}
      <div className="space-y-3">
        {studentPlans.length > 0 && (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tek Ödemeler ({detail.payments.length})
          </p>
        )}
        <DataTable
          data={detail.payments}
          columns={paymentColumns}
          keyExtractor={(p) => p.id}
          emptyTitle="Ödeme bulunamadı"
          emptyDescription="Bu öğrenciye ait ödeme kaydı bulunmamaktadır."
        />
      </div>
    </div>
  );

  const notesContent = (
    <Card>
      <CardContent className="pt-5">
        {detail.notes ? (
          <div className="flex gap-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
              <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="text-sm text-foreground leading-relaxed">{detail.notes}</p>
          </div>
        ) : (
          <EmptyState
            title="Not eklenmemiş"
            description="Bu öğrenci için henüz bir not girilmemiş."
            icon={StickyNote}
          />
        )}
      </CardContent>
    </Card>
  );

  const monthLabel = new Intl.DateTimeFormat("tr-TR", {
    month: "long",
    year: "numeric",
  }).format(new Date(caYear, caMonth - 1, 1));

  const cariHesapContent = (
    <div className="space-y-5">
      {/* Month selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{monthLabel}</span>
        </div>
        <input
          type="month"
          value={selectedMonthStr}
          onChange={(e) => e.target.value && setSelectedMonthStr(e.target.value)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {selectedMonthStr !== defaultMonthValue && (
          <button
            onClick={() => setSelectedMonthStr(defaultMonthValue)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Bu Aya Dön
          </button>
        )}
      </div>

      {/* Monthly breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Aylık Hesap Hareketi — {monthLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Önceki Devir
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-bold tabular-nums",
                  account.previousBalance > 0
                    ? "text-destructive"
                    : account.previousBalance < 0
                      ? "text-emerald-600"
                      : "text-foreground"
                )}
              >
                {formatCurrency(Math.abs(account.previousBalance))}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {account.previousBalance > 0
                  ? "Borç devri"
                  : account.previousBalance < 0
                    ? "Alacak devri"
                    : "Sıfır"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bu Ay Tahakkuk
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(account.currentMonthBilled)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Seans bedeli</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Bu Ay Ödeme
              </p>
              <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600">
                {formatCurrency(account.currentMonthPaid)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Tahsil edilen</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Güncel Bakiye
              </p>
              <p
                className={cn(
                  "mt-1 text-lg font-bold tabular-nums",
                  account.currentBalance > 0
                    ? "text-destructive"
                    : "text-emerald-600"
                )}
              >
                {formatCurrency(Math.abs(account.currentBalance))}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {account.currentBalance > 0 ? "Öğrenci borçlu" : "Bakiye yok"}
              </p>
            </div>
          </div>

          {/* Formula explanation */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/20 border border-border/60 px-3 py-2 text-xs text-muted-foreground">
            <span className={cn("font-semibold", account.previousBalance > 0 ? "text-destructive" : "text-foreground")}>
              {formatCurrency(account.previousBalance)}
            </span>
            <span>(önceki devir)</span>
            <span>+</span>
            <span className="font-semibold text-foreground">{formatCurrency(account.currentMonthBilled)}</span>
            <span>(tahakkuk)</span>
            <span>−</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(account.currentMonthPaid)}</span>
            <span>(ödeme)</span>
            <span>=</span>
            <span className={cn("font-bold", account.currentBalance > 0 ? "text-destructive" : "text-emerald-600")}>
              {formatCurrency(account.currentBalance)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* All-time totals */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Toplam Hesap Özeti
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 divide-y divide-border/60">
          {[
            {
              label: "Toplam Tahakkuk",
              value: formatCurrency(account.totalBilled),
              sub: "Tüm zamanlar",
              color: "text-foreground",
            },
            {
              label: "Toplam Ödeme",
              value: formatCurrency(account.totalPaid),
              sub: "Tahsil edilen",
              color: "text-emerald-600",
            },
            {
              label: "Kalan Borç",
              value: formatCurrency(account.remainingDebt),
              sub: account.remainingDebt > 0 ? "Ödenmemiş" : "Borç yok",
              color: account.remainingDebt > 0 ? "text-destructive" : "text-emerald-600",
            },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.sub}</p>
              </div>
              <span className={cn("text-base font-bold tabular-nums", row.color)}>
                {row.value}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const tabs: TabItem[] = [
    { key: "general", label: "Genel Bilgiler", content: generalInfoContent },
    {
      key: "sessions",
      label: "Seanslar",
      badge: detail.sessions.length,
      content: sessionsContent,
    },
    {
      key: "payments",
      label: "Ödemeler",
      badge: detail.payments.length + studentPlans.length,
      content: paymentsContent,
    },
    { key: "cari", label: "Cari Hesap", content: cariHesapContent },
    { key: "notes", label: "Notlar", content: notesContent },
  ];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/app/students"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Öğrenciler
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-foreground">{detail.fullName}</h1>
                  <StatusBadge status={detail.status} />
                </div>
                {detail.primaryGuardian && (
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <Link
                      href={`/app/guardians/${detail.primaryGuardian.id}`}
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                    >
                      <User className="h-3 w-3" />
                      {detail.primaryGuardian.fullName} · {detail.primaryGuardian.relationship}
                    </Link>
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {detail.primaryGuardian.phone}
                    </span>
                  </div>
                )}
                {detail.educationTypeNames.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {detail.educationTypeNames.map((name) => (
                      <span
                        key={name}
                        className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Toplam Seans"
          value={detail.totalSessions}
          description="Tüm zamanlar"
          icon={CalendarDays}
          variant="default"
        />
        <StatCard
          title="Toplam Tutar"
          value={formatCurrency(detail.totalBilled)}
          description="Tahakkuk eden"
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Alınan Ödeme"
          value={formatCurrency(detail.totalPaid)}
          description="Tahsil edilen"
          icon={CreditCard}
          variant="success"
        />
        <StatCard
          title="Kalan Borç"
          value={formatCurrency(detail.totalDebt)}
          description="Ödenmemiş"
          icon={AlertCircle}
          variant={detail.totalDebt > 0 ? "danger" : "success"}
        />
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} defaultTab="general" />
    </div>
  );
}
