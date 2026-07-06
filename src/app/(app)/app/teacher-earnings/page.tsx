"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  GraduationCap,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { TeacherPaymentFormDrawer } from "@/components/teachers/TeacherPaymentFormDrawer";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import {
  buildTeacherEarningListItems,
  buildTeacherEarningOverviewItems,
  buildTeacherEarningPageStats,
  buildMonthlyTeacherEarningSummary,
  formatCurrency,
  formatDate,
} from "@/lib/helpers/finance";
import type {
  TeacherEarningListItem,
  MonthlyTeacherEarningSummary,
  EarningStatus,
} from "@/types";
import { cn } from "@/lib/utils";

// ─── Column definitions ────────────────────────────────────────────────────────

const columns: Column<TeacherEarningListItem>[] = [
  {
    key: "date",
    header: "Tarih",
    render: (row) => (
      <span className="tabular-nums text-sm font-medium">
        {formatDate(row.sessionDate)}
      </span>
    ),
  },
  {
    key: "teacher",
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
    key: "student",
    header: "Öğrenci",
    render: (row) =>
      row.studentId ? (
        <Link
          href={`/app/students/${row.studentId}`}
          className="text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.studentName}
        </Link>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
    className: "hidden md:table-cell",
    headerClassName: "hidden md:table-cell",
  },
  {
    key: "educationType",
    header: "Eğitim Türü",
    render: (row) => (
      <span className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
        {row.educationTypeName}
      </span>
    ),
    className: "hidden lg:table-cell",
    headerClassName: "hidden lg:table-cell",
  },
  {
    key: "sessionCount",
    header: "Seans",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.sessionCount}
      </span>
    ),
    className: "hidden sm:table-cell w-16 text-center",
    headerClassName: "hidden sm:table-cell w-16 text-center",
  },
  {
    key: "unitEarning",
    header: "Birim Hakediş",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-right block">
        {formatCurrency(row.unitEarning)}
      </span>
    ),
    className: "hidden lg:table-cell text-right",
    headerClassName: "hidden lg:table-cell text-right",
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
    key: "status",
    header: "Durum",
    render: (row) => <StatusBadge status={row.status} />,
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
  {
    key: "action",
    header: "",
    render: (row) => (
      <Link
        href={`/app/teachers/${row.teacherId}`}
        className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        Detay
      </Link>
    ),
    className: "text-right w-14",
    headerClassName: "text-right w-14",
  },
];

// ─── Monthly summary table columns ────────────────────────────────────────────

function MonthlySummaryStatusBadge({ summary }: { summary: MonthlyTeacherEarningSummary }) {
  if (summary.pendingEarning === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Ödendi
      </span>
    );
  }
  if (summary.paidEarning === 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Bekliyor
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
      Kısmi
    </span>
  );
}

// ─── Status filter ─────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: EarningStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "pending", label: "Bekliyor" },
  { value: "paid", label: "Ödendi" },
];

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeacherEarningsPage() {
  const store = useMockStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EarningStatus | "all">("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [edTypeFilter, setEdTypeFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [payTeacherId, setPayTeacherId] = useState<string | null>(null);

  // Current month — fixed reference for KPI cards and monthly summary
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const thisMonthLabel = monthLabel(monthKey(now));

  // Build enriched list items from store
  const allItems = useMemo(
    () =>
      buildTeacherEarningListItems(
        store.teacherEarnings,
        store.sessions,
        store.teachers,
        store.students,
        mockEducationTypes
      ),
    [store.teacherEarnings, store.sessions, store.teachers, store.students]
  );

  // KPI stats — always current month for "Bu Ay", all-time for paid/pending
  const stats = useMemo(
    () =>
      buildTeacherEarningPageStats(
        store.teachers,
        store.sessions,
        store.teacherPayments,
        currentYear,
        currentMonth
      ),
    [store.teachers, store.sessions, store.teacherPayments, currentYear, currentMonth]
  );

  // Teacher overview — all-time totals
  const overviewItems = useMemo(
    () => buildTeacherEarningOverviewItems(store.teachers, store.sessions, store.teacherPayments),
    [store.teachers, store.sessions, store.teacherPayments]
  );

  // Monthly summary — always current month
  const monthlySummary = useMemo(
    () =>
      buildMonthlyTeacherEarningSummary(
        store.teachers,
        store.sessions,
        store.teacherPayments,
        currentYear,
        currentMonth
      ),
    [store.teachers, store.sessions, store.teacherPayments, currentYear, currentMonth]
  );

  // Derive available months from session dates in list items
  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [
      { value: "all", label: "Tüm Aylar" },
    ];
    allItems.forEach((item) => {
      const key = monthKey(new Date(item.sessionDate));
      if (!seen.has(key)) {
        seen.add(key);
        opts.push({ value: key, label: monthLabel(key) });
      }
    });
    return opts;
  }, [allItems]);

  // Apply filters to the DataTable
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      const matchSearch =
        !q ||
        item.teacherName.toLowerCase().includes(q) ||
        item.studentName.toLowerCase().includes(q) ||
        item.educationTypeName.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchTeacher = teacherFilter === "all" || item.teacherId === teacherFilter;
      const matchEdType = edTypeFilter === "all" || item.educationTypeId === edTypeFilter;
      const matchMonth =
        monthFilter === "all" ||
        monthKey(new Date(item.sessionDate)) === monthFilter;
      return matchSearch && matchStatus && matchTeacher && matchEdType && matchMonth;
    });
  }, [allItems, search, statusFilter, teacherFilter, edTypeFilter, monthFilter]);

  const hasActiveFilters =
    search ||
    statusFilter !== "all" ||
    teacherFilter !== "all" ||
    edTypeFilter !== "all" ||
    monthFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTeacherFilter("all");
    setEdTypeFilter("all");
    setMonthFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Öğretmen Hakedişleri"
        description={`${allItems.length} hakediş kaydı · ${thisMonthLabel}`}
      />

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Bu Ay Hakediş"
          value={formatCurrency(stats.thisMonthTotal)}
          description={thisMonthLabel}
          icon={TrendingUp}
          variant="default"
        />
        <StatCard
          title="Ödenen Hakediş"
          value={formatCurrency(stats.paidTotal)}
          description="Tüm dönem"
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          title="Bekleyen Hakediş"
          value={formatCurrency(stats.pendingTotal)}
          description="Ödeme bekliyor"
          icon={Clock}
          variant={stats.pendingTotal > 0 ? "warning" : "success"}
        />
        <StatCard
          title="Hakedişi Olan Öğretmen"
          value={stats.teachersWithEarnings}
          description="Aktif öğretmen"
          icon={GraduationCap}
          variant="default"
        />
      </div>

      {/* Teacher overview card */}
      {overviewItems.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Öğretmen Hakediş Özeti</p>
            <span className="text-xs text-muted-foreground">Tüm dönem</span>
          </div>
          <div className="divide-y divide-border/60">
            {overviewItems.map((item) => {
              const pct =
                item.totalEarning > 0
                  ? Math.round((item.paidEarning / item.totalEarning) * 100)
                  : 0;
              const barClass =
                item.pendingEarning === 0
                  ? "bg-emerald-500"
                  : item.paidEarning === 0
                    ? "bg-amber-400"
                    : "bg-blue-500";

              return (
                <div key={item.teacherId} className="flex items-center gap-4 px-4 py-3">
                  {/* Name + progress */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/teachers/${item.teacherId}`}
                      className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {item.teacherName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.earningCount} hakediş kaydı
                    </p>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", barClass)}
                        style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Paid / Pending */}
                  <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      <span className="text-emerald-600 font-medium">
                        {formatCurrency(item.paidEarning)}
                      </span>
                      <span className="text-muted-foreground/50"> / </span>
                      {formatCurrency(item.totalEarning)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{pct}% ödendi</span>
                  </div>

                  {/* Pending + action */}
                  <div className="flex flex-col items-end gap-1 shrink-0 min-w-[90px]">
                    {item.pendingEarning > 0 ? (
                      <span className="tabular-nums text-sm font-semibold text-amber-600">
                        {formatCurrency(item.pendingEarning)}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-600 font-medium">Tamamı ödendi</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">bekliyor</span>
                  </div>
                  {item.pendingEarning > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => setPayTeacherId(item.teacherId)}
                    >
                      Ödeme Yap
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly teacher summary table */}
      {monthlySummary.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              {thisMonthLabel} — Öğretmen Bazlı Özet
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Öğretmen
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">
                  Toplam Seans
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Toplam Hakediş
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">
                  Ödenen
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">
                  Bekleyen
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Durum
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {""}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {monthlySummary.map((row) => (
                <React.Fragment key={row.teacherId}>
                  <tr className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/teachers/${row.teacherId}`}
                        className="font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {row.teacherName}
                      </Link>
                      {row.earningType && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {row.earningType === "per_session" && "Seans Başı"}
                          {row.earningType === "monthly_salary" && "Sabit Maaş"}
                          {row.earningType === "salary_plus_quota" && "Sabit Maaş + Kota Üstü"}
                          {row.earningType === "percentage" && "Yüzde"}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                      {row.sessionCount}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {formatCurrency(row.totalEarning)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-600 hidden md:table-cell">
                      {formatCurrency(row.paidEarning)}
                    </td>
                    <td
                      className={cn(
                        "px-4 py-3 text-right tabular-nums hidden md:table-cell",
                        row.pendingEarning > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"
                      )}
                    >
                      {formatCurrency(row.pendingEarning)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <MonthlySummaryStatusBadge summary={row} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.pendingEarning > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPayTeacherId(row.teacherId)}
                        >
                          Ödeme Yap
                        </Button>
                      )}
                    </td>
                  </tr>
                  {row.earningType === "salary_plus_quota" && (
                    <tr className="bg-muted/10">
                      <td colSpan={7} className="px-6 pb-2.5 pt-1">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            Maaş: <span className="font-medium text-foreground">{formatCurrency(row.salaryComponent ?? 0)}</span>
                          </span>
                          <span>
                            Kota: <span className="font-medium text-foreground">{row.quotaUsed ?? 0}/{row.includedQuota ?? 0} seans</span>
                          </span>
                          {(row.extraSessions ?? 0) > 0 && (
                            <span>
                              Kota Üstü: <span className="font-medium text-primary">{row.extraSessions} seans × ek = {formatCurrency(row.extraEarning ?? 0)}</span>
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        {/* Row 1: search + month */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Öğretmen, öğrenci veya eğitim türü ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
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

        {/* Row 2: status pills */}
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Row 3: entity dropdowns + clear */}
        <div className="flex flex-wrap gap-2">
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Tüm Öğretmenler</option>
            {store.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
          <select
            value={edTypeFilter}
            onChange={(e) => setEdTypeFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">Tüm Eğitim Türleri</option>
            {mockEducationTypes.map((et) => (
              <option key={et.id} value={et.id}>
                {et.name}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 h-8 rounded-lg border border-destructive/40 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors"
            >
              <X className="h-3 w-3" />
              Filtreleri Temizle
            </button>
          )}
        </div>
      </div>

      {/* Detail table */}
      <DataTable
        data={filtered}
        columns={columns}
        keyExtractor={(e) => e.id}
        emptyTitle={hasActiveFilters ? "Eşleşen hakediş bulunamadı" : "Henüz hakediş yok"}
        emptyDescription={
          hasActiveFilters
            ? "Arama veya filtre kriterlerini değiştirmeyi deneyin."
            : "Tamamlanan seanslardan otomatik oluşturulur."
        }
      />

      {/* Result count */}
      {filtered.length > 0 && filtered.length !== allItems.length && (
        <p className="text-xs text-muted-foreground">
          {allItems.length} kayıt içinde{" "}
          <span className="font-medium text-foreground">{filtered.length}</span> hakediş
          gösteriliyor
        </p>
      )}

      <TeacherPaymentFormDrawer
        open={!!payTeacherId}
        onOpenChange={(open) => { if (!open) setPayTeacherId(null); }}
        preselectedTeacherId={payTeacherId ?? undefined}
      />
    </div>
  );
}
