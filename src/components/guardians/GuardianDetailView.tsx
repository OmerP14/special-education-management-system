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
  Mail,
  Users,
  User,
  BookOpen,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tabs, type TabItem } from "@/components/shared/Tabs";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import {
  buildGuardianDetail,
  formatCurrency,
  formatDate,
  formatTime,
  getStudentDebt,
  getStudentTotalBilled,
} from "@/lib/helpers/finance";
import {
  buildGuardianInstallmentSummary,
} from "@/lib/helpers/installments";
import { buildGuardianCurrentAccountSummary } from "@/lib/helpers/current-account";
import type { Student, Session, Payment, PaymentMethod } from "@/types";
import { cn } from "@/lib/utils";

// ─── Column builders ──────────────────────────────────────────────────────────

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  bank_transfer: "Banka Havalesi",
  credit_card: "Kredi Kartı",
  other: "Diğer",
};

function buildStudentColumns(
  sessions: { id: string; studentId: string; studentPrice: number; sessionCount: number; status: string }[],
  payments: { id: string; studentId: string; amount: number }[]
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
          .map((id) => mockEducationTypes.find((et) => et.id === id)?.name)
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
          payments as Parameters<typeof getStudentDebt>[2]
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
        const et = mockEducationTypes.find((e) => e.id === row.educationTypeId);
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
      render: (row) => <StatusBadge status={row.status} />,
      className: "text-right",
      headerClassName: "text-right",
    },
  ];
}

// ─── InfoRow sub-component ────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

interface GuardianDetailViewProps {
  guardianId: string;
}

export function GuardianDetailView({ guardianId }: GuardianDetailViewProps) {
  const store = useMockStore();
  const studentColumns = buildStudentColumns(store.sessions, store.payments);
  const paymentColumns = buildPaymentColumns(store.students);
  const sessionColumns = buildSessionColumns(store.students, store.teachers);
  const detail = buildGuardianDetail(
    guardianId,
    store.guardians,
    store.students,
    store.sessions,
    store.payments
  );

  const today = new Date();
  const nowYear = today.getFullYear();
  const nowMonth = today.getMonth() + 1;
  const defaultMonthValue = `${nowYear}-${String(nowMonth).padStart(2, "0")}`;
  const [selectedMonthStr, setSelectedMonthStr] = useState(defaultMonthValue);
  const [caYear, caMonth] = selectedMonthStr.split("-").map(Number) as [number, number];

  const guardianStudentIds = detail?.students.map((s) => s.id) ?? [];
  const installmentSummary = buildGuardianInstallmentSummary(
    guardianStudentIds,
    store.installmentPlans,
    today
  );
  const guardianAccount = buildGuardianCurrentAccountSummary(
    guardianStudentIds,
    store.sessions,
    store.payments,
    caYear,
    caMonth
  );

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

  // ── Tab contents ────────────────────────────────────────────────────────────

  const generalContent = (
    <div className="space-y-4">
      {/* Installment warning banner */}
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
      {installmentSummary.planCount > 0 && installmentSummary.overdueCount === 0 && installmentSummary.totalPending > 0 && (
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
      <div className="grid gap-4 lg:grid-cols-2">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Bağlı Öğrenciler
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 divide-y divide-border/60">
          {detail.students.length > 0 ? (
            detail.students.map((student) => {
              const debt = getStudentDebt(student.id, store.sessions, store.payments);
              return (
                <div key={student.id} className="flex items-center justify-between py-3">
                  <div>
                    <Link
                      href={`/app/students/${student.id}`}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {student.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {student.educationTypeIds
                        .map((id) => mockEducationTypes.find((et) => et.id === id)?.name)
                        .filter(Boolean)
                        .join(", ") || "Eğitim türü yok"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={student.status} />
                    {debt > 0 && (
                      <span className="text-xs font-semibold text-destructive tabular-nums">
                        {formatCurrency(debt)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Bağlı öğrenci kaydı bulunamadı
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      {/* Cari Hesap summary card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Cari Hesap Özeti —{" "}
                {new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(
                  new Date(caYear, caMonth - 1, 1)
                )}
              </CardTitle>
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Önceki Devir</p>
              <p className={cn("mt-1 text-base font-bold tabular-nums", guardianAccount.previousBalance > 0 ? "text-destructive" : "text-foreground")}>
                {formatCurrency(Math.abs(guardianAccount.previousBalance))}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bu Ay Tahakkuk</p>
              <p className="mt-1 text-base font-bold tabular-nums text-foreground">
                {formatCurrency(guardianAccount.currentMonthBilled)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bu Ay Ödeme</p>
              <p className="mt-1 text-base font-bold tabular-nums text-emerald-600">
                {formatCurrency(guardianAccount.currentMonthPaid)}
              </p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Güncel Bakiye</p>
              <p className={cn("mt-1 text-base font-bold tabular-nums", guardianAccount.currentBalance > 0 ? "text-destructive" : "text-emerald-600")}>
                {formatCurrency(Math.abs(guardianAccount.currentBalance))}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">Toplam Kalan Borç</span>
            <span className={cn("text-sm font-bold tabular-nums", guardianAccount.totalDebt > 0 ? "text-destructive" : "text-emerald-600")}>
              {formatCurrency(guardianAccount.totalDebt)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const paymentsContent = (
    <DataTable
      data={detail.payments}
      columns={paymentColumns}
      keyExtractor={(p) => p.id}
      emptyTitle="Ödeme bulunamadı"
      emptyDescription="Bu veliye bağlı öğrenciler için henüz ödeme kaydı bulunmamaktadır."
    />
  );

  const sessionsContent = (
    <DataTable
      data={detail.sessions}
      columns={sessionColumns}
      keyExtractor={(s) => s.id}
      emptyTitle="Seans bulunamadı"
      emptyDescription="Bu veliye bağlı öğrenciler için henüz seans kaydı bulunmamaktadır."
    />
  );

  const tabs: TabItem[] = [
    { key: "general", label: "Genel Bilgiler", content: generalContent },
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
      content: paymentsContent,
    },
    {
      key: "sessions",
      label: "Seanslar",
      badge: detail.sessions.length,
      content: sessionsContent,
    },
  ];

  return (
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
                  <span className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {detail.relationship}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {detail.phone}
                  </span>
                  {detail.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {detail.email}
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
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI stat cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Bağlı Öğrenci"
          value={detail.students.length}
          description="Kayıtlı öğrenci"
          icon={Users}
          variant="default"
        />
        <StatCard
          title="Toplam Tahakkuk"
          value={formatCurrency(detail.totalBilled)}
          description="Tüm öğrenciler"
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
