"use client";

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
  buildTeacherDetail,
  formatCurrency,
  formatDate,
  formatTime,
} from "@/lib/helpers/finance";
import type {
  Session,
  TeacherEarning,
  TeacherStudentRow,
  TeacherPriceRow,
} from "@/types";
import { cn } from "@/lib/utils";

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
  const sessionColumns = buildSessionColumns(store.students);
  const detail = buildTeacherDetail(
    teacherId,
    store.teachers,
    mockEducationTypes,
    store.students,
    store.guardians,
    store.sessions,
    store.teacherEarnings,
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

  const pricesContent = (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Öğretmene ait özel fiyat tanımları. Tanımsız satırlar kurum varsayılanını kullanır.
      </p>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Eğitim Türü
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Varsayılan
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bu Öğretmen
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">
                Fark
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {detail.priceRows.map((row: TeacherPriceRow) => {
              const effectiveEarning = row.customEarning ?? row.defaultEarning;
              const diff = effectiveEarning - row.defaultEarning;

              return (
                <tr key={row.educationTypeId} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.educationTypeName}</p>
                    {row.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(row.defaultEarning)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span
                        className={cn(
                          "tabular-nums font-semibold",
                          row.isCustom ? "text-primary" : "text-muted-foreground"
                        )}
                      >
                        {formatCurrency(effectiveEarning)}
                      </span>
                      {row.isCustom && (
                        <span className="inline-flex rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary leading-none">
                          Özel
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right hidden md:table-cell">
                    {diff !== 0 ? (
                      <span
                        className={cn(
                          "tabular-nums text-xs font-medium",
                          diff > 0 ? "text-emerald-600" : "text-destructive"
                        )}
                      >
                        {diff > 0 ? "+" : ""}
                        {formatCurrency(diff)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40 text-xs">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
    { key: "prices", label: "Özel Fiyatlar", content: pricesContent },
  ];

  return (
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
  );
}
