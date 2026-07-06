"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  User,
  GraduationCap,
  Tag,
  TrendingUp,
  Pencil,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TeacherFormDrawer } from "@/components/teachers/TeacherFormDrawer";
import { TeacherPaymentFormDrawer } from "@/components/teachers/TeacherPaymentFormDrawer";
import { TeacherPaymentHistoryTab } from "@/components/teachers/TeacherPaymentHistoryTab";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { Tabs, type TabItem } from "@/components/shared/Tabs";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import {
  buildTeacherDetail,
  calculateTeacherMonthlyPayable,
  getTeacherIncludedQuotaUsage,
  getTeacherExtraSessionCount,
  getTeacherPaymentModelLabel,
  formatCurrency,
  formatDate,
  formatTime,
} from "@/lib/helpers/finance";
import { DetailHeaderMeta } from "@/components/shared/DetailHeaderMeta";
import type {
  Session,
  TeacherEarning,
  TeacherStudentRow,
  TeacherPriceRow,
} from "@/types";

// ─── Enriched earning row for display ─────────────────────────────────────────

interface EarningDisplayRow {
  earning: TeacherEarning;
  studentId: string;
  studentName: string;
  educationTypeName: string;
  sessionCount: number;
  sessionDate: string;
}

// ─── Session column builder ────────────────────────────────────────────────────

function buildSessionColumns(
  students: { id: string; fullName: string }[]
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
      key: "student",
      header: "Öğrenci",
      render: (row) => {
        const student = students.find((s) => s.id === row.studentId);
        return (
          <Link
            href={`/app/students/${row.studentId}`}
            className="font-medium text-foreground hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {student?.fullName ?? "—"}
          </Link>
        );
      },
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
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
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
      key: "earning",
      header: "Hakediş",
      render: (row) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.teacherEarning * row.sessionCount)}
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

const studentRowColumns: Column<TeacherStudentRow>[] = [
  {
    key: "name",
    header: "Öğrenci",
    render: (row) => (
      <Link
        href={`/app/students/${row.studentId}`}
        className="font-medium text-foreground hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {row.studentName}
      </Link>
    ),
  },
  {
    key: "guardian",
    header: "Veli",
    render: (row) =>
      row.primaryGuardianName && row.primaryGuardianId ? (
        <Link
          href={`/app/guardians/${row.primaryGuardianId}`}
          className="text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.primaryGuardianName}
        </Link>
      ) : row.primaryGuardianName ? (
        <span className="text-muted-foreground">{row.primaryGuardianName}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
  {
    key: "educationTypes",
    header: "Eğitim Türleri",
    render: (row) =>
      row.educationTypeNames.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {row.educationTypeNames.map((name) => (
            <span
              key={name}
              className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary"
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
    className: "hidden lg:table-cell",
    headerClassName: "hidden lg:table-cell",
  },
  {
    key: "totalSessions",
    header: "Seans",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground">{row.totalSessions}</span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "lastSession",
    header: "Son Seans",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-xs">
        {row.lastSessionDate ? formatDate(row.lastSessionDate) : "—"}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
];

const earningColumns: Column<EarningDisplayRow>[] = [
  {
    key: "date",
    header: "Seans Tarihi",
    render: (row) => (
      <span className="tabular-nums text-sm">{formatDate(row.sessionDate)}</span>
    ),
  },
  {
    key: "student",
    header: "Öğrenci",
    render: (row) =>
      row.studentId ? (
        <Link
          href={`/app/students/${row.studentId}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.studentName}
        </Link>
      ) : (
        <span className="font-medium">{row.studentName}</span>
      ),
  },
  {
    key: "educationType",
    header: "Eğitim Türü",
    render: (row) => (
      <span className="text-muted-foreground">{row.educationTypeName}</span>
    ),
    className: "hidden md:table-cell",
    headerClassName: "hidden md:table-cell",
  },
  {
    key: "sessionCount",
    header: "Adet",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground">{row.sessionCount}</span>
    ),
    className: "hidden sm:table-cell text-center",
    headerClassName: "hidden sm:table-cell text-center",
  },
  {
    key: "amount",
    header: "Tutar",
    render: (row) => (
      <span className="tabular-nums font-semibold">
        {formatCurrency(row.earning.amount)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "status",
    header: "Durum",
    render: (row) => <StatusBadge status={row.earning.status} />,
    className: "text-right",
    headerClassName: "text-right",
  },
];

// ─── InfoRow helper ────────────────────────────────────────────────────────────

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

// ─── Main component ────────────────────────────────────────────────────────────

interface TeacherDetailViewProps {
  teacherId: string;
}

export function TeacherDetailView({ teacherId }: TeacherDetailViewProps) {
  const store = useMockStore();
  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const sessionColumns = buildSessionColumns(store.students);
  const detail = buildTeacherDetail(
    teacherId,
    store.teachers,
    mockEducationTypes,
    store.students,
    store.guardians,
    store.sessions,
    store.teacherEarnings,
    store.teacherPayments,
    store.teacherCustomPrices
  );

  if (!detail) {
    return (
      <div className="space-y-6">
        <Link
          href="/app/teachers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Öğretmenler
        </Link>
        <EmptyState
          title="Öğretmen bulunamadı"
          description="Bu kimliğe ait öğretmen kaydı mevcut değil."
          icon={GraduationCap}
          action={{
            label: "Öğretmenlere Dön",
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

  // ─── Enrich earnings for display ───────────────────────────────────────────

  const earningRows: EarningDisplayRow[] = detail.earnings
    .map((earning) => {
      const session = store.sessions.find((s) => s.id === earning.sessionId);
      if (!session) return null;
      const student = store.students.find((s) => s.id === session.studentId);
      const et = mockEducationTypes.find((e) => e.id === session.educationTypeId);
      return {
        earning,
        studentId: session.studentId,
        studentName: student?.fullName ?? "—",
        educationTypeName: et?.name ?? "—",
        sessionCount: session.sessionCount,
        sessionDate: session.date,
      };
    })
    .filter((r): r is EarningDisplayRow => r !== null);

  // ─── Tab contents ───────────────────────────────────────────────────────────

  const generalInfoContent = (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Öğretmen Bilgileri
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 divide-y divide-border/60">
        <InfoRow icon={User} label="Ad Soyad" value={detail.fullName} />
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
        <InfoRow
          icon={Tag}
          label="Uzmanlık Alanları"
          value={
            detail.specializationNames.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {detail.specializationNames.map((name) => (
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
          icon={TrendingUp}
          label="Hakediş Modeli"
          value={
            <span>
              {getTeacherPaymentModelLabel(detail)}
              {detail.earningType === "monthly_salary" && (
                <> — <span className="font-semibold">{formatCurrency(detail.monthlySalary ?? 0)}</span></>
              )}
              {detail.earningType === "salary_plus_quota" && (
                <> — <span className="font-semibold">{formatCurrency(detail.monthlySalary ?? 0)}</span> + kota üstü ₺{detail.extraSessionEarning ?? 0}/seans</>
              )}
              {detail.earningType === "percentage" && (
                <> — <span className="font-semibold">%{detail.earningPercentage ?? 0}</span></>
              )}
            </span>
          }
        />
        <InfoRow
          icon={GraduationCap}
          label="Durum"
          value={<StatusBadge status={detail.status} />}
        />
        <InfoRow
          icon={CalendarDays}
          label="Kayıt Tarihi"
          value={formatDate(detail.createdAt)}
        />
      </CardContent>
    </Card>
  );

  const sessionsContent = (
    <DataTable
      data={detail.sessions}
      columns={sessionColumns}
      keyExtractor={(s) => s.id}
      emptyTitle="Seans bulunamadı"
      emptyDescription="Bu öğretmene ait seans kaydı bulunmamaktadır."
    />
  );

  const studentsContent = (
    <DataTable
      data={detail.studentRows}
      columns={studentRowColumns}
      keyExtractor={(r) => r.studentId}
      emptyTitle="Öğrenci bulunamadı"
      emptyDescription="Bu öğretmen henüz hiçbir öğrenciyle seans yapmamış."
    />
  );

  const earningsContent = (
    <DataTable
      data={earningRows}
      columns={earningColumns}
      keyExtractor={(r) => r.earning.id}
      emptyTitle="Hakediş bulunamadı"
      emptyDescription="Bu öğretmene ait hakediş kaydı bulunmamaktadır."
    />
  );

  const pricesContent = (() => {
    if (detail.earningType === "monthly_salary") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bu öğretmen aylık maaş modelinde çalışmaktadır. Seans başı ayrıca hakediş hesaplanmaz.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Aylık Maaş</span>
            <span className="text-lg font-bold text-foreground tabular-nums">
              {formatCurrency(detail.monthlySalary ?? 0)}
            </span>
          </div>
        </div>
      );
    }

    if (detail.earningType === "salary_plus_quota") {
      const now = new Date();
      const yr = now.getFullYear();
      const mo = now.getMonth() + 1;
      const rawTeacherObj = store.teachers.find((t) => t.id === teacherId)!;
      const totalPayable = calculateTeacherMonthlyPayable(rawTeacherObj, store.sessions, yr, mo);
      const quotaUsed = getTeacherIncludedQuotaUsage(rawTeacherObj, store.sessions, yr, mo);
      const extraCount = getTeacherExtraSessionCount(rawTeacherObj, store.sessions, yr, mo);
      const quota = detail.includedSessionQuota ?? 0;
      const extraRate = detail.extraSessionEarning ?? 0;

      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bu öğretmen sabit maaş + kota üstü modelinde çalışmaktadır. Maaşa dahil
            kota aşıldığında ek seans hakedişi eklenir.
          </p>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border/60">
                <tr className="bg-muted/20">
                  <td className="px-4 py-3 text-sm text-muted-foreground">Aylık Maaş</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {formatCurrency(detail.monthlySalary ?? 0)}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-muted-foreground">Maaşa Dahil Kota</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {quota} seans
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm text-muted-foreground">Kota Üstü Seans Hakedişi</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(extraRate)} / seans
                  </td>
                </tr>
                <tr className="border-t-2 border-border">
                  <td className="px-4 py-3 text-sm text-muted-foreground">Bu Ay — Kota Kullanımı</td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {quotaUsed} / {quota} seans
                  </td>
                </tr>
                {extraCount > 0 && (
                  <tr>
                    <td className="px-4 py-3 text-sm text-muted-foreground">Bu Ay — Kota Üstü</td>
                    <td className="px-4 py-3 text-right tabular-nums text-primary font-medium">
                      {extraCount} seans × {formatCurrency(extraRate)} = {formatCurrency(extraCount * extraRate)}
                    </td>
                  </tr>
                )}
                <tr className="bg-muted/30">
                  <td className="px-4 py-3 text-sm font-semibold text-foreground">Bu Ay Toplam Ödenecek</td>
                  <td className="px-4 py-3 text-right tabular-nums text-lg font-bold text-foreground">
                    {formatCurrency(totalPayable)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (detail.earningType === "percentage") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Bu öğretmen yüzde hakediş modelinde çalışmaktadır. Seans ücreti üzerinden
            belirlenen oran kadar ödeme yapılır.
          </p>
          <div className="rounded-lg border border-border bg-muted/30 px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Hakediş Yüzdesi</span>
            <span className="text-lg font-bold text-foreground tabular-nums">
              %{detail.earningPercentage ?? 0}
            </span>
          </div>
        </div>
      );
    }

    // per_session (default)
    if (detail.priceRows.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          Bu öğretmen için uzmanlık alanı tanımlanmamış; özel fiyat gösterilemiyor.
        </p>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Bu öğretmenin uzmanlık alanlarına göre geçerli hakediş tutarları.
        </p>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Eğitim Türü
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Hakediş
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {detail.priceRows.map((row: TeacherPriceRow) => {
                const effectiveEarning = row.customEarning ?? row.defaultEarning;

                return (
                  <tr key={row.educationTypeId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.educationTypeName}</p>
                      {row.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
                      {formatCurrency(effectiveEarning)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  })();

  const tabs: TabItem[] = [
    { key: "general", label: "Genel Bilgiler", content: generalInfoContent },
    {
      key: "sessions",
      label: "Seanslar",
      badge: detail.sessions.length,
      content: sessionsContent,
    },
    {
      key: "students",
      label: "Öğrenciler",
      badge: detail.studentRows.length,
      content: studentsContent,
    },
    {
      key: "earnings",
      label: "Hakedişler",
      badge: detail.earnings.length,
      content: earningsContent,
    },
    { key: "prices", label: "Hakediş", content: pricesContent },
    {
      key: "payments",
      label: "Ödeme Geçmişi",
      badge: store.teacherPayments.filter((p) => p.teacherId === teacherId).length,
      content: <TeacherPaymentHistoryTab teacherId={teacherId} />,
    },
  ];

  const rawTeacher = store.teachers.find((t) => t.id === teacherId);

  return (
    <>
      <div className="space-y-6">
        {/* Back link */}
        <Link
          href="/app/teachers"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Öğretmenler
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
                  {detail.specializationNames.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {detail.specializationNames.map((name) => (
                        <span
                          key={name}
                          className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  )}
                  <DetailHeaderMeta createdAt={detail.createdAt} updatedAt={detail.updatedAt} />
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {detail.pendingEarnings > 0 && (
                  <Button size="sm" onClick={() => setPayOpen(true)}>
                    Ödeme Yap
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Düzenle
                </Button>
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
            title="Tamamlanan Seans"
            value={detail.completedSessions}
            description="Kazanç yaratan"
            icon={CheckCircle2}
            variant="default"
          />
          <StatCard
            title="Aylık Hakediş"
            value={formatCurrency(detail.monthlyEarnings)}
            description="Bu ay"
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="Bekleyen Hakediş"
            value={formatCurrency(detail.pendingEarnings)}
            description="Ödenmemiş"
            icon={AlertCircle}
            variant={detail.pendingEarnings > 0 ? "warning" : "success"}
          />
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} defaultTab="general" />
      </div>

      {rawTeacher && (
        <TeacherFormDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          initialData={rawTeacher}
        />
      )}
      <TeacherPaymentFormDrawer
        open={payOpen}
        onOpenChange={setPayOpen}
        preselectedTeacherId={teacherId}
      />
    </>
  );
}
