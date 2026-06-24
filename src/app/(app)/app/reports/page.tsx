"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  CheckCircle2,
  ReceiptText,
  BanknoteIcon,
  AlertCircle,
  TrendingUp,
  BookOpen,
  GraduationCap,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Tabs, type TabItem } from "@/components/shared/Tabs";
import { mockSessions } from "@/lib/mock/sessions";
import { mockPayments } from "@/lib/mock/payments";
import { mockTeacherEarnings } from "@/lib/mock/teacher-earnings";
import { mockStudents, mockGuardians } from "@/lib/mock/students";
import { mockTeachers } from "@/lib/mock/teachers";
import { mockEducationTypes } from "@/lib/mock/education-types";
import {
  filterSessionsByMonth,
  filterPaymentsByMonth,
  filterEarningsByMonth,
  buildGeneralReportStats,
  buildStudentReportRows,
  buildTeacherReportRows,
  buildEducationTypeReportRows,
  buildFinanceReportStats,
  formatCurrency,
  formatDate,
} from "@/lib/helpers/finance";
import type {
  StudentReportRow,
  TeacherReportRow,
  EducationTypeReportRow,
} from "@/types";
import { cn } from "@/lib/utils";

// ─── Month helpers ────────────────────────────────────────────────────────────

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(
    new Date(Number(y), Number(m) - 1, 1)
  );
}

function parseMonthFilter(value: string): { year: number | null; month: number | null } {
  if (value === "all") return { year: null, month: null };
  const [y, m] = value.split("-");
  return { year: Number(y), month: Number(m) };
}

// ─── Finance row helper ───────────────────────────────────────────────────────

function FinanceRow({
  label,
  value,
  variant = "neutral",
  bold,
  indent,
}: {
  label: string;
  value: string;
  variant?: "neutral" | "success" | "warning" | "danger" | "primary";
  bold?: boolean;
  indent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-2.5",
        indent ? "pl-4" : ""
      )}
    >
      <span
        className={cn(
          "text-sm",
          indent ? "text-muted-foreground" : "font-medium text-foreground"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums text-sm",
          bold ? "text-base font-bold" : "font-semibold",
          variant === "neutral" && "text-foreground",
          variant === "success" && "text-emerald-600",
          variant === "warning" && "text-amber-600",
          variant === "danger" && "text-destructive",
          variant === "primary" && "text-primary"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Student report columns ───────────────────────────────────────────────────

const studentColumns: Column<StudentReportRow>[] = [
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
      row.guardianName && row.guardianId ? (
        <Link
          href={`/app/guardians/${row.guardianId}`}
          className="text-muted-foreground hover:text-primary transition-colors text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {row.guardianName}
        </Link>
      ) : row.guardianName ? (
        <span className="text-muted-foreground text-sm">{row.guardianName}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
  {
    key: "totalSessions",
    header: "Toplam Seans",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.totalSessions}
      </span>
    ),
    className: "hidden md:table-cell text-center",
    headerClassName: "hidden md:table-cell text-center",
  },
  {
    key: "completedSessions",
    header: "Tamamlanan",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.completedSessions}
      </span>
    ),
    className: "hidden lg:table-cell text-center",
    headerClassName: "hidden lg:table-cell text-center",
  },
  {
    key: "totalBilled",
    header: "Toplam Tutar",
    render: (row) => (
      <span className="tabular-nums font-medium text-right block">
        {formatCurrency(row.totalBilled)}
      </span>
    ),
    className: "hidden sm:table-cell text-right",
    headerClassName: "hidden sm:table-cell text-right",
  },
  {
    key: "totalCollected",
    header: "Alınan Ödeme",
    render: (row) => (
      <span className="tabular-nums text-emerald-600 font-medium text-right block">
        {formatCurrency(row.totalCollected)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "remainingDebt",
    header: "Kalan Borç",
    render: (row) => (
      <span
        className={cn(
          "tabular-nums font-semibold text-right block",
          row.remainingDebt > 0 ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {formatCurrency(row.remainingDebt)}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
  {
    key: "lastSession",
    header: "Son Seans",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-xs">
        {row.lastSessionDate ? formatDate(row.lastSessionDate) : "—"}
      </span>
    ),
    className: "hidden lg:table-cell text-right",
    headerClassName: "hidden lg:table-cell text-right",
  },
  {
    key: "status",
    header: "Durum",
    render: (row) => <StatusBadge status={row.status} />,
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
];

// ─── Teacher report columns ───────────────────────────────────────────────────

const teacherColumns: Column<TeacherReportRow>[] = [
  {
    key: "name",
    header: "Öğretmen",
    render: (row) => (
      <Link
        href={`/app/teachers/${row.teacherId}`}
        className="font-medium text-foreground hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {row.teacherName}
      </Link>
    ),
  },
  {
    key: "totalSessions",
    header: "Toplam Seans",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.totalSessions}
      </span>
    ),
    className: "hidden md:table-cell text-center",
    headerClassName: "hidden md:table-cell text-center",
  },
  {
    key: "completedSessions",
    header: "Tamamlanan",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.completedSessions}
      </span>
    ),
    className: "hidden lg:table-cell text-center",
    headerClassName: "hidden lg:table-cell text-center",
  },
  {
    key: "totalEarning",
    header: "Toplam Hakediş",
    render: (row) => (
      <span className="tabular-nums font-semibold text-right block">
        {formatCurrency(row.totalEarning)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "paidEarning",
    header: "Ödenen",
    render: (row) => (
      <span className="tabular-nums text-emerald-600 text-right block">
        {formatCurrency(row.paidEarning)}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
  {
    key: "pendingEarning",
    header: "Bekleyen",
    render: (row) => (
      <span
        className={cn(
          "tabular-nums font-medium text-right block",
          row.pendingEarning > 0 ? "text-amber-600" : "text-muted-foreground"
        )}
      >
        {formatCurrency(row.pendingEarning)}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
  {
    key: "students",
    header: "Öğrenci Sayısı",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.uniqueStudentCount}
      </span>
    ),
    className: "hidden sm:table-cell text-center",
    headerClassName: "hidden sm:table-cell text-center",
  },
  {
    key: "status",
    header: "Durum",
    render: (row) => <StatusBadge status={row.status} />,
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
];

// ─── Education type report columns ───────────────────────────────────────────

const edTypeColumns: Column<EducationTypeReportRow>[] = [
  {
    key: "name",
    header: "Eğitim Türü",
    render: (row) => (
      <span className="font-medium text-foreground">{row.educationTypeName}</span>
    ),
  },
  {
    key: "totalSessions",
    header: "Toplam Seans",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.totalSessions}
      </span>
    ),
    className: "hidden md:table-cell text-center",
    headerClassName: "hidden md:table-cell text-center",
  },
  {
    key: "completedSessions",
    header: "Tamamlanan",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.completedSessions}
      </span>
    ),
    className: "hidden lg:table-cell text-center",
    headerClassName: "hidden lg:table-cell text-center",
  },
  {
    key: "totalRevenue",
    header: "Toplam Gelir",
    render: (row) => (
      <span className="tabular-nums font-semibold text-right block">
        {formatCurrency(row.totalRevenue)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "teacherEarnings",
    header: "Öğretmen Hakedişi",
    render: (row) => (
      <span className="tabular-nums text-amber-600 text-right block">
        {formatCurrency(row.teacherEarnings)}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
  {
    key: "centerProfit",
    header: "Merkez Kârı",
    render: (row) => (
      <span
        className={cn(
          "tabular-nums font-semibold text-right block",
          row.centerProfit >= 0 ? "text-emerald-600" : "text-destructive"
        )}
      >
        {formatCurrency(row.centerProfit)}
      </span>
    ),
    className: "hidden sm:table-cell text-right",
    headerClassName: "hidden sm:table-cell text-right",
  },
  {
    key: "activeStudents",
    header: "Aktif Öğrenci",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.activeStudentCount}
      </span>
    ),
    className: "hidden sm:table-cell text-center",
    headerClassName: "hidden sm:table-cell text-center",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [monthFilter, setMonthFilter] = useState("all");

  // Derive available months from session dates
  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [
      { value: "all", label: "Tüm Dönem" },
    ];
    [...mockSessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((s) => {
        const key = monthKey(new Date(s.date));
        if (!seen.has(key)) {
          seen.add(key);
          opts.push({ value: key, label: monthLabel(key) });
        }
      });
    return opts;
  }, []);

  // Parse the selected month filter
  const { year, month } = useMemo(() => parseMonthFilter(monthFilter), [monthFilter]);

  // Filtered data slices — computed once, shared by all report sections
  const filteredSessions = useMemo(
    () => filterSessionsByMonth(mockSessions, year, month),
    [year, month]
  );
  const filteredPayments = useMemo(
    () => filterPaymentsByMonth(mockPayments, year, month),
    [year, month]
  );
  const filteredEarnings = useMemo(
    () => filterEarningsByMonth(mockTeacherEarnings, mockSessions, year, month),
    [year, month]
  );

  // Report data — all pure helpers, no computation in JSX
  const generalStats = useMemo(
    () =>
      buildGeneralReportStats(
        filteredSessions,
        filteredPayments,
        filteredEarnings,
        mockSessions,
        mockPayments,
        mockStudents
      ),
    [filteredSessions, filteredPayments, filteredEarnings]
  );

  const studentRows = useMemo(
    () =>
      buildStudentReportRows(
        mockStudents,
        mockGuardians,
        filteredSessions,
        filteredPayments,
        mockSessions,
        mockPayments
      ),
    [filteredSessions, filteredPayments]
  );

  const teacherRows = useMemo(
    () => buildTeacherReportRows(mockTeachers, filteredSessions, filteredEarnings),
    [filteredSessions, filteredEarnings]
  );

  const edTypeRows = useMemo(
    () => buildEducationTypeReportRows(mockEducationTypes, filteredSessions, mockStudents),
    [filteredSessions]
  );

  const financeStats = useMemo(
    () =>
      buildFinanceReportStats(
        filteredSessions,
        filteredPayments,
        filteredEarnings,
        mockSessions,
        mockPayments,
        mockStudents
      ),
    [filteredSessions, filteredPayments, filteredEarnings]
  );

  const periodLabel =
    monthFilter === "all" ? "Tüm dönem" : monthLabel(monthFilter);

  // ─── Tab contents ───────────────────────────────────────────────────────────

  const generalContent = (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-4">{periodLabel} verileri</p>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <StatCard
          title="Toplam Öğrenci"
          value={generalStats.totalStudents}
          description="Tüm kayıtlar"
          icon={Users}
          variant="default"
        />
        <StatCard
          title="Aktif Öğrenci"
          value={generalStats.activeStudents}
          description="Devam edenler"
          icon={Users}
          variant="success"
        />
        <StatCard
          title="Toplam Seans"
          value={generalStats.totalSessions}
          description={periodLabel}
          icon={CalendarDays}
          variant="default"
        />
        <StatCard
          title="Tamamlanan Seans"
          value={generalStats.completedSessions}
          description={periodLabel}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Toplam Tahakkuk"
          value={formatCurrency(generalStats.totalBilled)}
          description={periodLabel}
          icon={ReceiptText}
          variant="default"
        />
        <StatCard
          title="Alınan Ödeme"
          value={formatCurrency(generalStats.totalCollected)}
          description={periodLabel}
          icon={BanknoteIcon}
          variant="success"
        />
        <StatCard
          title="Kalan Alacak"
          value={formatCurrency(generalStats.totalRemaining)}
          description="Genel bakiye"
          icon={AlertCircle}
          variant={generalStats.totalRemaining > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Öğretmen Hakedişi"
          value={formatCurrency(generalStats.totalTeacherEarnings)}
          description={periodLabel}
          icon={GraduationCap}
          variant="default"
        />
        <StatCard
          title="Merkez Kârı"
          value={formatCurrency(generalStats.centerProfit)}
          description={periodLabel}
          icon={TrendingUp}
          variant={generalStats.centerProfit >= 0 ? "success" : "danger"}
        />
      </div>
    </div>
  );

  const studentContent = (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {periodLabel} · {studentRows.filter((r) => r.totalSessions > 0).length} öğrencinin seansı var · Kalan borç her zaman güncel bakiyeyi gösterir
      </p>
      <DataTable
        data={studentRows}
        columns={studentColumns}
        keyExtractor={(r) => r.studentId}
        emptyTitle="Veri bulunamadı"
        emptyDescription="Seçilen dönemde öğrenci verisi mevcut değil."
      />
    </div>
  );

  const teacherContent = (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {periodLabel} · Hakediş tutarları kayıtlı hakedişlerden hesaplanmaktadır
      </p>
      <DataTable
        data={teacherRows}
        columns={teacherColumns}
        keyExtractor={(r) => r.teacherId}
        emptyTitle="Veri bulunamadı"
        emptyDescription="Seçilen dönemde öğretmen verisi mevcut değil."
      />
    </div>
  );

  const edTypeContent = (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {periodLabel} · Eğitim türlerine göre gelir ve kâr dağılımı
      </p>
      <DataTable
        data={edTypeRows}
        columns={edTypeColumns}
        keyExtractor={(r) => r.educationTypeId}
        emptyTitle="Veri bulunamadı"
        emptyDescription="Seçilen dönemde eğitim türü verisi mevcut değil."
      />
    </div>
  );

  const financeContent = (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {periodLabel} · Kalan alacak tüm dönem genel bakiyesidir
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue section */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Öğrenci Geliri</p>
          </div>
          <div className="divide-y divide-border/60 px-4">
            <FinanceRow
              label="Toplam Tahakkuk"
              value={formatCurrency(financeStats.totalBilled)}
            />
            <FinanceRow
              label="Alınan Ödeme"
              value={formatCurrency(financeStats.totalCollected)}
              variant="success"
              indent
            />
            <FinanceRow
              label="Kalan Alacak"
              value={formatCurrency(financeStats.remainingReceivable)}
              variant={financeStats.remainingReceivable > 0 ? "warning" : "success"}
              indent
            />
          </div>
        </div>

        {/* Teacher earnings section */}
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Öğretmen Gideri</p>
          </div>
          <div className="divide-y divide-border/60 px-4">
            <FinanceRow
              label="Toplam Hakediş"
              value={formatCurrency(financeStats.totalTeacherEarnings)}
            />
            <FinanceRow
              label="Ödenen Hakediş"
              value={formatCurrency(financeStats.paidTeacherEarnings)}
              variant="success"
              indent
            />
            <FinanceRow
              label="Bekleyen Hakediş"
              value={formatCurrency(financeStats.pendingTeacherEarnings)}
              variant={financeStats.pendingTeacherEarnings > 0 ? "warning" : "success"}
              indent
            />
          </div>
        </div>
      </div>

      {/* Net profit — full width, prominent */}
      <div className="rounded-lg border-2 border-primary/20 bg-primary/5 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Merkez Brüt Kârı</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Toplam Tahakkuk − Toplam Öğretmen Hakedişi
            </p>
          </div>
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              financeStats.centerGrossProfit >= 0 ? "text-emerald-600" : "text-destructive"
            )}
          >
            {formatCurrency(financeStats.centerGrossProfit)}
          </span>
        </div>
        {financeStats.totalBilled > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Kâr Marjı</span>
              <span>
                {Math.round((financeStats.centerGrossProfit / financeStats.totalBilled) * 100)}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-primary/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, Math.round((financeStats.centerGrossProfit / financeStats.totalBilled) * 100)))}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Detailed breakdown table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Ayrıntılı Finans Özeti</p>
        </div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border/60">
            {[
              { label: "Toplam Tahakkuk", value: formatCurrency(financeStats.totalBilled), variant: "neutral" },
              { label: "Alınan Ödeme", value: formatCurrency(financeStats.totalCollected), variant: "success" },
              { label: "Kalan Alacak", value: formatCurrency(financeStats.remainingReceivable), variant: financeStats.remainingReceivable > 0 ? "warning" : "success" },
              { label: "Toplam Öğretmen Hakedişi", value: formatCurrency(financeStats.totalTeacherEarnings), variant: "neutral" },
              { label: "Ödenen Öğretmen Hakedişi", value: formatCurrency(financeStats.paidTeacherEarnings), variant: "success" },
              { label: "Bekleyen Öğretmen Hakedişi", value: formatCurrency(financeStats.pendingTeacherEarnings), variant: financeStats.pendingTeacherEarnings > 0 ? "warning" : "success" },
              { label: "Merkez Brüt Kârı", value: formatCurrency(financeStats.centerGrossProfit), variant: financeStats.centerGrossProfit >= 0 ? "success" : "danger" },
            ].map(({ label, value, variant }) => (
              <tr key={label} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{label}</td>
                <td
                  className={cn(
                    "px-4 py-3 text-right tabular-nums font-semibold",
                    variant === "neutral" && "text-foreground",
                    variant === "success" && "text-emerald-600",
                    variant === "warning" && "text-amber-600",
                    variant === "danger" && "text-destructive"
                  )}
                >
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const tabs: TabItem[] = [
    { key: "general", label: "Genel Özet", content: generalContent },
    { key: "students", label: "Öğrenci Raporu", badge: studentRows.length, content: studentContent },
    { key: "teachers", label: "Öğretmen Raporu", badge: teacherRows.length, content: teacherContent },
    { key: "edtypes", label: "Eğitim Türü Raporu", badge: edTypeRows.length, content: edTypeContent },
    { key: "finance", label: "Finans Raporu", content: financeContent },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raporlar"
        description="Dönemsel performans ve finansal analiz"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      <Tabs tabs={tabs} defaultTab="general" />
    </div>
  );
}
