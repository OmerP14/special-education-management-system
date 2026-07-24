"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ReceiptText,
  BanknoteIcon,
  AlertCircle,
  GraduationCap,
  Wallet,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  CalendarDays,
  Clock,
  XCircle,
  UserX,
  Repeat,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HistoricalRecordBadge } from "@/components/shared/HistoricalRecordBadge";
import { ReportViewer, type ReportSummaryCard } from "@/components/reports/ReportViewer";
import { ReportFilterBar } from "@/components/reports/ReportFilterBar";
import type { Column } from "@/components/shared/DataTable";
import { useMockStore } from "@/lib/mock/store";
import {
  buildStudentDebtItems,
  buildPaymentListItems,
  buildTeacherPaymentListItems,
  buildSessionListItems,
  buildSessionStatusBreakdown,
  buildStudentAttendanceRows,
  buildTeacherSessionCountRows,
  buildTeacherReportRows,
  getTeacherEarningTotalsForRange,
  getTeacherMonthAccountSummary,
  getMonthKey,
  getMonthLabel,
  formatCurrency,
  formatDate,
  formatDateDMY,
  getSessionStatusLabel,
  getTeacherStatusLabel,
} from "@/lib/helpers/finance";
import { buildCashMovementRows } from "@/lib/helpers/cash";
import { buildStudentMonthlyAccountRows } from "@/lib/helpers/current-account";
import {
  EMPTY_REPORT_FILTERS,
  resolveReportDateRange,
  filterSessionsByReportFilters,
  filterPaymentsByReportFilters,
  filterTeacherPaymentsByReportFilters,
  isWithinReportRange,
  REPORT_CATALOG,
  REPORT_CATEGORY_LABELS,
  type ReportFilters,
  type ReportCategory,
} from "@/lib/helpers/reports";
import type {
  StudentDebtItem,
  StudentMonthlyAccountRow,
  PaymentListItem,
  TeacherPaymentReportRow,
  CashMovementRow,
  SessionListItem,
  StudentAttendanceRow,
  TeacherSessionCountRow,
  TeacherReportRow,
  TeacherMonthAccountSummary,
} from "@/types";
import { cn } from "@/lib/utils";

// ─── Small local badges (avoid StatusBadge collisions with unrelated status enums) ──

function CashTypeBadge({ type }: { type: "income" | "expense" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        type === "income"
          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
          : "bg-red-100 text-red-700 border-red-200"
      )}
    >
      {type === "income" ? "Gelir" : "Gider"}
    </span>
  );
}

function PaymentTypeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
      {label}
    </span>
  );
}

function DateCell({ date }: { date: string | null }) {
  return (
    <span className="tabular-nums text-sm">
      {date ? formatDateDMY(date) : <span className="text-muted-foreground/40">—</span>}
    </span>
  );
}

/** Standard "Tarih" first column — every report table leads with the most relevant
 *  business date for its row (see report-specific date rules at each call site). */
function tarihColumn<T>(getDate: (row: T) => string | null): Column<T> {
  return {
    key: "tarih",
    header: "Tarih",
    render: (row) => <DateCell date={getDate(row)} />,
  };
}

// ─── Column definitions (one per report row shape) ────────────────────────────

// Shared non-date columns for the debt-style table (Income Report all-time view +
// Student Debt Report) — only the Tarih column's date field differs between the two.
const debtColumnsRest: Column<StudentDebtItem>[] = [
  {
    key: "student",
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
    render: (row) => row.guardianName ?? <span className="text-muted-foreground/40">—</span>,
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
  {
    key: "totalBilled",
    header: "Tahakkuk",
    render: (row) => (
      <span className="tabular-nums text-right block">{formatCurrency(row.totalBilled)}</span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "totalPaid",
    header: "Tahsilat",
    render: (row) => (
      <span className="tabular-nums text-emerald-600 text-right block">
        {formatCurrency(row.totalPaid)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "remainingDebt",
    header: "Kalan",
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
    className: "text-right",
    headerClassName: "text-right",
  },
];

// Income Report all-time view — Tarih shows latest payment, else latest billed session.
const debtColumns: Column<StudentDebtItem>[] = [
  tarihColumn<StudentDebtItem>((row) => row.lastActivityDate),
  ...debtColumnsRest,
];

// Student Debt Report — Tarih shows latest billed session, else latest payment
// (reversed priority from Income Report: leads with service delivered, not money moved).
const studentDebtColumns: Column<StudentDebtItem>[] = [
  tarihColumn<StudentDebtItem>((row) => row.lastDebtActivityDate),
  ...debtColumnsRest,
];

// Month-scoped variant — Önceki Devir / Bu Ay Tahakkuk / Bu Ay Tahsilat / Güncel Bakiye,
// shown instead of the debt-style columns above when a single month filter is active.
// Shared non-date columns; only the Tarih column's date field differs by report (see below).
const monthlyAccountColumnsRest: Column<StudentMonthlyAccountRow>[] = [
  {
    key: "student",
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
    render: (row) => row.guardianName ?? <span className="text-muted-foreground/40">—</span>,
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
  {
    key: "previousBalance",
    header: "Önceki Devir",
    render: (row) => (
      <span
        className={cn(
          "tabular-nums text-right block",
          row.previousBalance > 0 ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {formatCurrency(Math.abs(row.previousBalance))}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
  {
    key: "currentMonthBilled",
    header: "Bu Ay Tahakkuk",
    render: (row) => (
      <span className="tabular-nums text-right block">
        {formatCurrency(row.currentMonthBilled)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "currentMonthPaid",
    header: "Bu Ay Tahsilat",
    render: (row) => (
      <span className="tabular-nums text-emerald-600 text-right block">
        {formatCurrency(row.currentMonthPaid)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "currentBalance",
    header: "Güncel Bakiye",
    render: (row) => (
      <span
        className={cn(
          "tabular-nums font-semibold text-right block",
          row.currentBalance > 0 ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {formatCurrency(row.currentBalance)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
];

// Income Report single-month view — Tarih shows latest payment, else latest billed session.
const monthlyAccountColumns: Column<StudentMonthlyAccountRow>[] = [
  tarihColumn<StudentMonthlyAccountRow>((row) => row.lastActivityDate),
  ...monthlyAccountColumnsRest,
];

// Student Debt Report single-month view — Tarih shows latest billed session, else payment.
const monthlyDebtAccountColumns: Column<StudentMonthlyAccountRow>[] = [
  tarihColumn<StudentMonthlyAccountRow>((row) => row.lastDebtActivityDate),
  ...monthlyAccountColumnsRest,
];

const teacherPaymentColumns: Column<TeacherPaymentReportRow>[] = [
  tarihColumn<TeacherPaymentReportRow>((row) => row.date),
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
    key: "paymentType",
    header: "Ödeme Türü",
    render: (row) => <PaymentTypeBadge label={row.paymentTypeLabel} />,
  },
  {
    key: "amount",
    header: "Tutar",
    render: (row) => (
      <span className="tabular-nums font-semibold text-right block">
        {formatCurrency(row.amount)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "method",
    header: "Yöntem",
    render: (row) => row.methodLabel,
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
  {
    key: "description",
    header: "Açıklama",
    render: (row) =>
      row.description ?? <span className="text-muted-foreground/40">—</span>,
    className: "hidden md:table-cell",
    headerClassName: "hidden md:table-cell",
  },
];

const cashColumns: Column<CashMovementRow>[] = [
  tarihColumn<CashMovementRow>((row) => row.date),
  {
    key: "type",
    header: "Tür",
    render: (row) => <CashTypeBadge type={row.type} />,
  },
  {
    key: "description",
    header: "Açıklama",
    render: (row) => (
      <div>
        <p className="text-sm">{row.description ?? "—"}</p>
        {row.teacherPaymentTypeLabel && (
          <PaymentTypeBadge label={row.teacherPaymentTypeLabel} />
        )}
      </div>
    ),
  },
  {
    key: "amount",
    header: "Tutar",
    render: (row) => (
      <span
        className={cn(
          "tabular-nums font-semibold text-right block",
          row.type === "income" ? "text-emerald-600" : "text-destructive"
        )}
      >
        {row.type === "income" ? "+" : "-"}
        {formatCurrency(row.amount)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
];

const sessionColumns: Column<SessionListItem>[] = [
  tarihColumn<SessionListItem>((row) => row.date),
  {
    key: "student",
    header: "Öğrenci",
    render: (row) => (
      <Link
        href={`/app/students/${row.studentId}`}
        className="text-foreground hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {row.studentName}
      </Link>
    ),
  },
  {
    key: "teacher",
    header: "Öğretmen",
    render: (row) => (
      <Link
        href={`/app/teachers/${row.teacherId}`}
        className="text-muted-foreground hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {row.teacherName}
      </Link>
    ),
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
  {
    key: "educationType",
    header: "Eğitim Türü",
    render: (row) => row.educationTypeName,
    className: "hidden md:table-cell",
    headerClassName: "hidden md:table-cell",
  },
  {
    key: "status",
    header: "Durum",
    render: (row) => (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge status={row.status} />
        {row.billingMode === "historical_non_billable" && <HistoricalRecordBadge />}
      </div>
    ),
  },
  {
    key: "amount",
    header: "Tutar",
    render: (row) => (
      <span className="tabular-nums text-right block">{formatCurrency(row.totalAmount)}</span>
    ),
    className: "hidden sm:table-cell text-right",
    headerClassName: "hidden sm:table-cell text-right",
  },
];

const paymentColumns: Column<PaymentListItem>[] = [
  tarihColumn<PaymentListItem>((row) => row.date),
  {
    key: "student",
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
    render: (row) => row.guardianName ?? <span className="text-muted-foreground/40">—</span>,
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
  {
    key: "amount",
    header: "Tutar",
    render: (row) => (
      <span className="tabular-nums font-semibold text-right block">
        {formatCurrency(row.amount)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "method",
    header: "Yöntem",
    render: (row) => row.methodLabel,
    className: "hidden md:table-cell",
    headerClassName: "hidden md:table-cell",
  },
  {
    key: "notes",
    header: "Not",
    render: (row) => row.notes ?? <span className="text-muted-foreground/40">—</span>,
    className: "hidden lg:table-cell",
    headerClassName: "hidden lg:table-cell",
  },
];

const attendanceColumns: Column<StudentAttendanceRow>[] = [
  tarihColumn<StudentAttendanceRow>((row) => row.lastSessionDate),
  {
    key: "student",
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
  { key: "total", header: "Toplam", render: (row) => <span className="tabular-nums text-right block">{row.total}</span>, className: "text-right", headerClassName: "text-right" },
  { key: "completed", header: "Tamamlanan", render: (row) => <span className="tabular-nums text-emerald-600 text-right block">{row.completed}</span>, className: "text-right", headerClassName: "text-right" },
  { key: "planned", header: "Planlanan", render: (row) => <span className="tabular-nums text-right block">{row.planned}</span>, className: "hidden sm:table-cell text-right", headerClassName: "hidden sm:table-cell text-right" },
  { key: "cancelled", header: "İptal", render: (row) => <span className="tabular-nums text-right block">{row.cancelled}</span>, className: "hidden md:table-cell text-right", headerClassName: "hidden md:table-cell text-right" },
  { key: "noShow", header: "Gelmedi", render: (row) => <span className="tabular-nums text-right block">{row.noShow}</span>, className: "hidden md:table-cell text-right", headerClassName: "hidden md:table-cell text-right" },
  { key: "makeup", header: "Telafi", render: (row) => <span className="tabular-nums text-right block">{row.makeup}</span>, className: "hidden lg:table-cell text-right", headerClassName: "hidden lg:table-cell text-right" },
];

const teacherSessionCountColumns: Column<TeacherSessionCountRow>[] = [
  tarihColumn<TeacherSessionCountRow>((row) => row.lastSessionDate),
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
  { key: "total", header: "Toplam", render: (row) => <span className="tabular-nums text-right block">{row.total}</span>, className: "text-right", headerClassName: "text-right" },
  { key: "completed", header: "Tamamlanan", render: (row) => <span className="tabular-nums text-emerald-600 text-right block">{row.completed}</span>, className: "text-right", headerClassName: "text-right" },
  { key: "planned", header: "Planlanan", render: (row) => <span className="tabular-nums text-right block">{row.planned}</span>, className: "hidden sm:table-cell text-right", headerClassName: "hidden sm:table-cell text-right" },
  { key: "cancelled", header: "İptal", render: (row) => <span className="tabular-nums text-right block">{row.cancelled}</span>, className: "hidden md:table-cell text-right", headerClassName: "hidden md:table-cell text-right" },
  { key: "noShow", header: "Gelmedi", render: (row) => <span className="tabular-nums text-right block">{row.noShow}</span>, className: "hidden md:table-cell text-right", headerClassName: "hidden md:table-cell text-right" },
  { key: "makeup", header: "Telafi", render: (row) => <span className="tabular-nums text-right block">{row.makeup}</span>, className: "hidden lg:table-cell text-right", headerClassName: "hidden lg:table-cell text-right" },
];

const teacherEarningsColumns: Column<TeacherReportRow>[] = [
  tarihColumn<TeacherReportRow>((row) => row.lastSessionDate),
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
    key: "sessions",
    header: "Seans",
    render: (row) => <span className="tabular-nums text-right block">{row.totalSessions}</span>,
    className: "hidden sm:table-cell text-right",
    headerClassName: "hidden sm:table-cell text-right",
  },
  {
    key: "totalEarning",
    header: "Toplam Hakediş",
    render: (row) => (
      <div className="text-right">
        <span className="tabular-nums font-semibold">{formatCurrency(row.totalEarning)}</span>
        {row.unknownSessionCount > 0 && (
          <p className="text-[10px] text-amber-600">Hakediş ayarı bekleniyor — {row.unknownSessionCount} seans</p>
        )}
      </div>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "paidEarning",
    header: "Ödenen",
    render: (row) => <span className="tabular-nums text-emerald-600 text-right block">{formatCurrency(row.paidEarning)}</span>,
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
  {
    key: "pendingEarning",
    header: "Bekleyen",
    render: (row) => (
      <span className={cn("tabular-nums font-medium text-right block", row.pendingEarning > 0 ? "text-amber-600" : "text-muted-foreground")}>
        {formatCurrency(row.pendingEarning)}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
  {
    key: "status",
    header: "Durum",
    render: (row) => <StatusBadge status={row.status} />,
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
];

const teacherPerformanceColumns: Column<TeacherReportRow>[] = [
  tarihColumn<TeacherReportRow>((row) => row.lastSessionDate),
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
  { key: "totalSessions", header: "Toplam Seans", render: (row) => <span className="tabular-nums text-right block">{row.totalSessions}</span>, className: "hidden sm:table-cell text-right", headerClassName: "hidden sm:table-cell text-right" },
  { key: "completedSessions", header: "Tamamlanan", render: (row) => <span className="tabular-nums text-right block">{row.completedSessions}</span>, className: "hidden md:table-cell text-right", headerClassName: "hidden md:table-cell text-right" },
  { key: "students", header: "Öğrenci Sayısı", render: (row) => <span className="tabular-nums text-right block">{row.uniqueStudentCount}</span>, className: "hidden sm:table-cell text-right", headerClassName: "hidden sm:table-cell text-right" },
  {
    key: "totalEarning",
    header: "Toplam Hakediş",
    render: (row) => (
      <div className="text-right">
        <span className="tabular-nums font-semibold">{formatCurrency(row.totalEarning)}</span>
        {row.unknownSessionCount > 0 && (
          <p className="text-[10px] text-amber-600">Hakediş ayarı bekleniyor — {row.unknownSessionCount} seans</p>
        )}
      </div>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  { key: "paidEarning", header: "Ödenen", render: (row) => <span className="tabular-nums text-emerald-600 text-right block">{formatCurrency(row.paidEarning)}</span>, className: "hidden md:table-cell text-right", headerClassName: "hidden md:table-cell text-right" },
  { key: "pendingEarning", header: "Bekleyen", render: (row) => <span className={cn("tabular-nums font-medium text-right block", row.pendingEarning > 0 ? "text-amber-600" : "text-muted-foreground")}>{formatCurrency(row.pendingEarning)}</span>, className: "hidden md:table-cell text-right", headerClassName: "hidden md:table-cell text-right" },
  { key: "status", header: "Durum", render: (row) => <StatusBadge status={row.status} />, className: "hidden sm:table-cell", headerClassName: "hidden sm:table-cell" },
];

// Month-scoped variant for Teacher Earnings/Performance — shown instead of the columns
// above when a single month filter is active, so carryover is explicit instead of hidden.
const teacherMonthAccountColumns: Column<TeacherMonthAccountSummary>[] = [
  tarihColumn<TeacherMonthAccountSummary>((row) => row.lastSessionDate),
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
    key: "previousBalance",
    header: "Önceki Devir",
    render: (row) => (
      <span className={cn("tabular-nums text-right block", row.previousBalance > 0 ? "text-destructive" : "text-muted-foreground")}>
        {formatCurrency(row.previousBalance)}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
  {
    key: "thisMonthEarning",
    header: "Bu Ay Hakediş",
    render: (row) => (
      <div className="text-right">
        <span className="tabular-nums">{formatCurrency(row.thisMonthEarning)}</span>
        {row.unknownSessionCount > 0 && (
          <p className="text-[10px] text-amber-600">Hakediş ayarı bekleniyor — {row.unknownSessionCount} seans</p>
        )}
      </div>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "thisMonthPaid",
    header: "Bu Ay Ödeme",
    render: (row) => <span className="tabular-nums text-emerald-600 text-right block">{formatCurrency(row.thisMonthPaid)}</span>,
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "thisMonthDeducted",
    header: "Bu Ay Kesinti",
    render: (row) => (
      <span className={cn("tabular-nums text-right block", row.thisMonthDeducted > 0 ? "text-amber-600" : "text-muted-foreground")}>
        {formatCurrency(row.thisMonthDeducted)}
      </span>
    ),
    className: "hidden sm:table-cell text-right",
    headerClassName: "hidden sm:table-cell text-right",
  },
  {
    key: "currentBalance",
    header: "Güncel Bakiye",
    render: (row) => (
      <span className={cn("tabular-nums font-semibold text-right block", row.currentBalance > 0 ? "text-destructive" : "text-muted-foreground")}>
        {formatCurrency(row.currentBalance)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "totalPending",
    header: "Toplam Bekleyen",
    render: (row) => (
      <span className={cn("tabular-nums text-right block", row.totalPending > 0 ? "text-amber-600" : "text-muted-foreground")}>
        {formatCurrency(row.totalPending)}
      </span>
    ),
    className: "hidden lg:table-cell text-right",
    headerClassName: "hidden lg:table-cell text-right",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

const CATEGORIES: ReportCategory[] = ["financial", "education", "students", "teachers"];

export default function ReportsPage() {
  const store = useMockStore();
  const [category, setCategory] = useState<ReportCategory>("financial");
  const [reportId, setReportId] = useState<string>(REPORT_CATALOG.financial[0]!.id);
  const [filters, setFilters] = useState<ReportFilters>({ ...EMPTY_REPORT_FILTERS });

  const selectCategory = (cat: ReportCategory) => {
    setCategory(cat);
    setReportId(REPORT_CATALOG[cat][0]!.id);
  };

  // ─── Shared filter inputs ────────────────────────────────────────────────
  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: "all", label: "Tüm Aylar" }];
    [...store.sessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((s) => {
        const key = getMonthKey(new Date(s.date));
        if (!seen.has(key)) {
          seen.add(key);
          opts.push({ value: key, label: getMonthLabel(key) });
        }
      });
    return opts;
  }, [store.sessions]);

  const teacherOptions = useMemo(
    () => store.teachers.map((t) => ({ id: t.id, label: t.fullName })),
    [store.teachers]
  );
  const studentOptions = useMemo(
    () => store.students.map((s) => ({ id: s.id, label: s.fullName })),
    [store.students]
  );
  const edTypeOptions = useMemo(
    () => store.educationTypes.map((et) => ({ id: et.id, label: et.name })),
    [store.educationTypes]
  );

  const { start, end } = useMemo(() => resolveReportDateRange(filters), [filters]);

  // A single whole calendar month picked from the Ay dropdown (not a custom date range)
  // switches Income/Student Debt/Teacher Earnings/Teacher Payment reports into their
  // carryover-aware view — Önceki Devir explicit, never lifetime totals disguised as
  // month-scoped ones. A custom date range keeps the existing all-time/range behavior.
  const isSingleMonthMode = !!filters.monthKey && !filters.startDate && !filters.endDate;
  const [singleMonthYear, singleMonthMonth] = isSingleMonthMode
    ? (filters.monthKey!.split("-").map(Number) as [number, number])
    : [0, 0];

  const filterSummaryText = useMemo(() => {
    const parts: string[] = [];
    if (filters.monthKey) parts.push(getMonthLabel(filters.monthKey));
    else if (start || end)
      parts.push(`${start ? formatDate(start) : "…"} – ${end ? formatDate(end) : "…"}`);
    else parts.push("Tüm Zamanlar");
    if (filters.teacherId) {
      const t = store.teachers.find((x) => x.id === filters.teacherId);
      if (t) parts.push(`Öğretmen: ${t.fullName}`);
    }
    if (filters.studentId) {
      const s = store.students.find((x) => x.id === filters.studentId);
      if (s) parts.push(`Öğrenci: ${s.fullName}`);
    }
    if (filters.educationTypeId) {
      const et = store.educationTypes.find((x) => x.id === filters.educationTypeId);
      if (et) parts.push(`Eğitim Türü: ${et.name}`);
    }
    return parts.join(" · ");
  }, [filters, start, end, store.teachers, store.students, store.educationTypes]);

  // ─── Filtered entity slices — shared by every report below ───────────────
  const filteredSessions = useMemo(
    () => filterSessionsByReportFilters(store.sessions, filters),
    [store.sessions, filters]
  );
  const filteredPayments = useMemo(
    () => filterPaymentsByReportFilters(store.payments, filters),
    [store.payments, filters]
  );
  const filteredTeacherPayments = useMemo(
    () => filterTeacherPaymentsByReportFilters(store.teacherPayments, filters),
    [store.teacherPayments, filters]
  );
  const teachersToShow = useMemo(
    () => (filters.teacherId ? store.teachers.filter((t) => t.id === filters.teacherId) : store.teachers),
    [store.teachers, filters.teacherId]
  );
  const studentsToShow = useMemo(
    () => (filters.studentId ? store.students.filter((s) => s.id === filters.studentId) : store.students),
    [store.students, filters.studentId]
  );

  // ─── Report bodies ─────────────────────────────────────────────────────────

  // mode "income" → Tarih prefers latest payment, else latest billed session (Income Report).
  // mode "debt" → Tarih prefers latest billed session, else latest payment (Student Debt Report).
  function renderIncomeStyleReport(idSuffix: string, mode: "income" | "debt") {
    const reportTitle = mode === "income" ? "Gelir Raporu" : "Öğrenci Borç Raporu";
    const dateOf = (r: { lastActivityDate: string | null; lastDebtActivityDate: string | null }) =>
      mode === "income" ? r.lastActivityDate : r.lastDebtActivityDate;

    // A single month selected → carryover-aware view (Önceki Devir explicit, never
    // hidden inside a lifetime total). Reuses buildStudentCurrentAccount under the hood
    // via buildStudentMonthlyAccountRows, same as Student/Guardian Detail's Cari Hesap.
    if (isSingleMonthMode) {
      const rows = buildStudentMonthlyAccountRows(
        filters.studentId ? studentsToShow : store.students,
        store.guardians,
        store.sessions,
        store.payments,
        singleMonthYear,
        singleMonthMonth,
        store.openingBalances
      );

      const totalPrevious = rows.reduce((s, r) => s + r.previousBalance, 0);
      const totalBilledThisMonth = rows.reduce((s, r) => s + r.currentMonthBilled, 0);
      const totalPaidThisMonth = rows.reduce((s, r) => s + r.currentMonthPaid, 0);
      const totalCurrentBalance = rows.reduce((s, r) => s + r.currentBalance, 0);

      const summaryCards: ReportSummaryCard[] = [
        { title: "Önceki Devir", value: formatCurrency(totalPrevious), icon: AlertCircle, variant: totalPrevious > 0 ? "warning" : "default" },
        { title: "Bu Ay Tahakkuk", value: formatCurrency(totalBilledThisMonth), icon: ReceiptText, variant: "default" },
        { title: "Bu Ay Tahsilat", value: formatCurrency(totalPaidThisMonth), icon: BanknoteIcon, variant: "success" },
        { title: "Güncel Bakiye", value: formatCurrency(totalCurrentBalance), icon: AlertCircle, variant: totalCurrentBalance > 0 ? "warning" : "success" },
      ];

      return (
        <ReportViewer<StudentMonthlyAccountRow>
          note={filterSummaryText}
          summaryCards={summaryCards}
          columns={mode === "income" ? monthlyAccountColumns : monthlyDebtAccountColumns}
          rows={rows}
          keyExtractor={(r) => r.studentId}
          emptyTitle="Bu ayda hareket bulunamadı"
          csv={{
            filename: `gelir-raporu-${idSuffix}-${filters.monthKey}.csv`,
            headers: ["Tarih", "Öğrenci", "Veli", "Önceki Devir", "Bu Ay Tahakkuk", "Bu Ay Tahsilat", "Güncel Bakiye"],
            rowMapper: (r) => [dateOf(r) ? formatDateDMY(dateOf(r)!) : "", r.studentName, r.guardianName ?? "", r.previousBalance, r.currentMonthBilled, r.currentMonthPaid, r.currentBalance],
          }}
          pdf={{
            title: reportTitle,
            subtitle: filterSummaryText,
            columns: [
              { header: "Tarih" },
              { header: "Öğrenci" },
              { header: "Veli" },
              { header: "Önceki Devir", align: "right" },
              { header: "Bu Ay Tahakkuk", align: "right" },
              { header: "Bu Ay Tahsilat", align: "right" },
              { header: "Güncel Bakiye", align: "right" },
            ],
            rowMapper: (r) => [
              dateOf(r) ? formatDateDMY(dateOf(r)!) : "—",
              r.studentName,
              r.guardianName ?? "—",
              formatCurrency(r.previousBalance),
              formatCurrency(r.currentMonthBilled),
              formatCurrency(r.currentMonthPaid),
              formatCurrency(r.currentBalance),
            ],
          }}
        />
      );
    }

    // No single month selected (all-time, or a custom date range) — lifetime totals,
    // honestly presented as lifetime (never disguised as period-scoped). The date-range/
    // teacher/education-type filters only narrow down *which* students appear (activity
    // in that window), never the all-time totals themselves, since "remaining debt" isn't
    // a period-scoped concept.
    const allDebtItems = buildStudentDebtItems(store.students, store.guardians, store.sessions, store.payments, store.openingBalances);
    // Activity in the filtered window can come from sessions (billing) OR payments
    // (collection) — a student who only paid (no billed session yet, e.g. an advance
    // payment) must still count as "active" here, otherwise they'd silently vanish.
    const relevantIds = filters.studentId
      ? new Set([filters.studentId])
      : start || end || filters.teacherId || filters.educationTypeId
        ? new Set([
            ...filteredSessions.map((s) => s.studentId),
            ...filteredPayments.map((p) => p.studentId),
          ])
        : null;
    const rows = relevantIds ? allDebtItems.filter((item) => relevantIds.has(item.studentId)) : allDebtItems;

    const totalBilled = rows.reduce((s, r) => s + r.totalBilled, 0);
    const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0);
    const totalRemaining = rows.reduce((s, r) => s + r.remainingDebt, 0);

    const summaryCards: ReportSummaryCard[] = [
      { title: "Toplam Tahakkuk", value: formatCurrency(totalBilled), icon: ReceiptText, variant: "default" },
      { title: "Toplam Tahsilat", value: formatCurrency(totalPaid), icon: BanknoteIcon, variant: "success" },
      { title: "Kalan Borç", value: formatCurrency(totalRemaining), icon: AlertCircle, variant: totalRemaining > 0 ? "warning" : "success" },
    ];

    return (
      <ReportViewer<StudentDebtItem>
        note={filterSummaryText}
        summaryCards={summaryCards}
        columns={mode === "income" ? debtColumns : studentDebtColumns}
        rows={rows}
        keyExtractor={(r) => r.studentId}
        emptyTitle="Borç kaydı bulunamadı"
        csv={{
          filename: `gelir-raporu-${idSuffix}.csv`,
          headers: ["Tarih", "Öğrenci", "Veli", "Tahakkuk", "Tahsilat", "Kalan"],
          rowMapper: (r) => [dateOf(r) ? formatDateDMY(dateOf(r)!) : "", r.studentName, r.guardianName ?? "", r.totalBilled, r.totalPaid, r.remainingDebt],
        }}
        pdf={{
          title: reportTitle,
          subtitle: filterSummaryText,
          columns: [
            { header: "Tarih" },
            { header: "Öğrenci" },
            { header: "Veli" },
            { header: "Tahakkuk", align: "right" },
            { header: "Tahsilat", align: "right" },
            { header: "Kalan", align: "right" },
          ],
          rowMapper: (r) => [
            dateOf(r) ? formatDateDMY(dateOf(r)!) : "—",
            r.studentName,
            r.guardianName ?? "—",
            formatCurrency(r.totalBilled),
            formatCurrency(r.totalPaid),
            formatCurrency(r.remainingDebt),
          ],
        }}
      />
    );
  }

  function renderTeacherPaymentReport(idSuffix: string) {
    // Table stays activity-based (a flat list of payment events) regardless of mode —
    // only the summary cards switch to explicit carryover when a single month is active,
    // so a July-only balance never silently disappears while viewing August.
    const rows = buildTeacherPaymentListItems(filteredTeacherPayments, store.teachers);

    const summaryCards: ReportSummaryCard[] = isSingleMonthMode
      ? (() => {
          const monthSummaries = teachersToShow.map((t) =>
            getTeacherMonthAccountSummary(t, store.sessions, store.teacherPayments, singleMonthYear, singleMonthMonth, store.teacherEducationTypeAssignments)
          );
          const totalPrevious = monthSummaries.reduce((s, m) => s + m.previousBalance, 0);
          const totalEarning = monthSummaries.reduce((s, m) => s + m.thisMonthEarning, 0);
          const totalPaidThisMonth = monthSummaries.reduce((s, m) => s + m.thisMonthPaid, 0);
          const totalDeducted = monthSummaries.reduce((s, m) => s + m.thisMonthDeducted, 0);
          const totalBalance = monthSummaries.reduce((s, m) => s + m.currentBalance, 0);
          const totalUnknown = monthSummaries.reduce((s, m) => s + m.unknownSessionCount, 0);
          return [
            { title: "Önceki Devir", value: formatCurrency(totalPrevious), icon: AlertCircle, variant: totalPrevious > 0 ? "warning" : "default" },
            { title: "Bu Ay Hakediş", value: formatCurrency(totalEarning), icon: TrendingUp, variant: "default" },
            { title: "Bu Ay Ödeme", value: formatCurrency(totalPaidThisMonth), icon: CheckCircle2, variant: "success" },
            { title: "Bu Ay Kesinti", value: formatCurrency(totalDeducted), icon: Clock, variant: totalDeducted > 0 ? "warning" : "default" },
            { title: "Güncel Bakiye", value: formatCurrency(totalBalance), icon: AlertCircle, variant: totalBalance > 0 ? "warning" : "success" },
            ...(totalUnknown > 0
              ? [{ title: "Hesaplanamayan", value: `${totalUnknown} seans`, icon: Clock, variant: "warning" as const }]
              : []),
          ];
        })()
      : (() => {
          const totals = teachersToShow.map((t) => getTeacherEarningTotalsForRange(t, store.sessions, store.teacherPayments, start, end, store.teacherEducationTypeAssignments));
          const totalEarned = totals.reduce((s, t) => s + t.totalEarning, 0);
          const totalPaid = totals.reduce((s, t) => s + t.paidEarning, 0);
          const totalPending = totals.reduce((s, t) => s + t.pendingEarning, 0);
          const totalUnknown = totals.reduce((s, t) => s + t.unknownSessionCount, 0);
          return [
            { title: "Bilinen Hakediş", value: formatCurrency(totalEarned), icon: TrendingUp, variant: "default" },
            { title: "Toplam Ödenen", value: formatCurrency(totalPaid), icon: CheckCircle2, variant: "success" },
            { title: "Bekleyen", value: formatCurrency(totalPending), icon: Clock, variant: totalPending > 0 ? "warning" : "success" },
            ...(totalUnknown > 0
              ? [{ title: "Hesaplanamayan", value: `${totalUnknown} seans`, icon: Clock, variant: "warning" as const }]
              : []),
          ];
        })();

    return (
      <ReportViewer<TeacherPaymentReportRow>
        note={filterSummaryText}
        summaryCards={summaryCards}
        columns={teacherPaymentColumns}
        rows={rows}
        keyExtractor={(r) => r.id}
        emptyTitle="Ödeme kaydı bulunamadı"
        csv={{
          filename: `ogretmen-odeme-raporu-${idSuffix}.csv`,
          headers: ["Tarih", "Öğretmen", "Ödeme Türü", "Tutar", "Yöntem", "Açıklama"],
          rowMapper: (r) => [formatDateDMY(r.date), r.teacherName, r.paymentTypeLabel, r.amount, r.methodLabel, r.description ?? ""],
        }}
        pdf={{
          title: "Öğretmen Ödeme Raporu",
          subtitle: filterSummaryText,
          columns: [
            { header: "Tarih" },
            { header: "Öğretmen" },
            { header: "Ödeme Türü" },
            { header: "Tutar", align: "right" },
            { header: "Yöntem" },
            { header: "Açıklama" },
          ],
          rowMapper: (r) => [formatDateDMY(r.date), r.teacherName, r.paymentTypeLabel, formatCurrency(r.amount), r.methodLabel, r.description ?? "—"],
        }}
      />
    );
  }

  function renderDailyCashReport() {
    const allRows = buildCashMovementRows(
      store.cashMovements,
      store.payments,
      store.students,
      store.teacherPayments,
      store.teachers
    );
    const rows = allRows.filter((r) => isWithinReportRange(r.date, filters));
    const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
    const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);

    const summaryCards: ReportSummaryCard[] = [
      { title: "Gelir", value: formatCurrency(income), icon: TrendingUp, variant: "success" },
      { title: "Gider", value: formatCurrency(expense), icon: TrendingDown, variant: "danger" },
      { title: "Bakiye", value: formatCurrency(income - expense), icon: Wallet, variant: income - expense >= 0 ? "success" : "danger" },
    ];

    return (
      <ReportViewer<CashMovementRow>
        note={filterSummaryText}
        summaryCards={summaryCards}
        columns={cashColumns}
        rows={rows}
        keyExtractor={(r) => r.id}
        emptyTitle="Kasa hareketi bulunamadı"
        csv={{
          filename: "gunluk-kasa-raporu.csv",
          headers: ["Tarih", "Tür", "Açıklama", "Tutar"],
          rowMapper: (r) => [formatDateDMY(r.date), r.typeLabel, r.description ?? "", r.type === "income" ? r.amount : -r.amount],
        }}
        pdf={{
          title: "Günlük Kasa Raporu",
          subtitle: filterSummaryText,
          columns: [{ header: "Tarih" }, { header: "Tür" }, { header: "Açıklama" }, { header: "Tutar", align: "right" }],
          rowMapper: (r) => [
            formatDateDMY(r.date),
            r.typeLabel,
            r.description ?? "—",
            `${r.type === "income" ? "+" : "-"}${formatCurrency(r.amount)}`,
          ],
        }}
      />
    );
  }

  function renderSessionStatusReport() {
    const breakdown = buildSessionStatusBreakdown(filteredSessions);
    const rows = buildSessionListItems(filteredSessions, store.students, store.teachers, store.educationTypes);

    const summaryCards: ReportSummaryCard[] = [
      { title: "Tamamlanan", value: breakdown.completed, icon: CheckCircle2, variant: "success" },
      { title: "Planlanan", value: breakdown.planned, icon: CalendarDays, variant: "default" },
      { title: "İptal", value: breakdown.cancelled, icon: XCircle, variant: "danger" },
      { title: "Gelmedi", value: breakdown.noShow, icon: UserX, variant: "warning" },
      { title: "Telafi", value: breakdown.makeup, icon: Repeat, variant: "default" },
    ];

    return (
      <ReportViewer<SessionListItem>
        note={filterSummaryText}
        summaryCards={summaryCards}
        columns={sessionColumns}
        rows={rows}
        keyExtractor={(r) => r.id}
        emptyTitle="Seans bulunamadı"
        csv={{
          filename: "seans-durum-raporu.csv",
          headers: ["Tarih", "Öğrenci", "Öğretmen", "Eğitim Türü", "Durum", "Tutar"],
          rowMapper: (r) => [formatDateDMY(r.date), r.studentName, r.teacherName, r.educationTypeName, getSessionStatusLabel(r.status), r.totalAmount],
        }}
        pdf={{
          title: "Seans Durum Raporu",
          subtitle: filterSummaryText,
          columns: [
            { header: "Tarih" },
            { header: "Öğrenci" },
            { header: "Öğretmen" },
            { header: "Eğitim Türü" },
            { header: "Durum" },
            { header: "Tutar", align: "right" },
          ],
          rowMapper: (r) => [formatDateDMY(r.date), r.studentName, r.teacherName, r.educationTypeName, getSessionStatusLabel(r.status), formatCurrency(r.totalAmount)],
        }}
      />
    );
  }

  function renderStudentPaymentReport() {
    const rows = buildPaymentListItems(filteredPayments, store.students, store.guardians, store.sessions, store.openingBalances);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const uniqueStudents = new Set(rows.map((r) => r.studentId)).size;

    const summaryCards: ReportSummaryCard[] = [
      { title: "Toplam Tahsilat", value: formatCurrency(total), icon: BanknoteIcon, variant: "success" },
      { title: "Ödeme Sayısı", value: rows.length, icon: ReceiptText, variant: "default" },
      { title: "Öğrenci Sayısı", value: uniqueStudents, icon: Users, variant: "default" },
    ];

    return (
      <ReportViewer<PaymentListItem>
        note={filterSummaryText}
        summaryCards={summaryCards}
        columns={paymentColumns}
        rows={rows}
        keyExtractor={(r) => r.id}
        emptyTitle="Ödeme kaydı bulunamadı"
        csv={{
          filename: "ogrenci-odeme-raporu.csv",
          headers: ["Tarih", "Öğrenci", "Veli", "Tutar", "Yöntem", "Not"],
          rowMapper: (r) => [formatDateDMY(r.date), r.studentName, r.guardianName ?? "", r.amount, r.methodLabel, r.notes ?? ""],
        }}
        pdf={{
          title: "Öğrenci Ödeme Raporu",
          subtitle: filterSummaryText,
          columns: [
            { header: "Tarih" },
            { header: "Öğrenci" },
            { header: "Veli" },
            { header: "Tutar", align: "right" },
            { header: "Yöntem" },
            { header: "Not" },
          ],
          rowMapper: (r) => [formatDateDMY(r.date), r.studentName, r.guardianName ?? "—", formatCurrency(r.amount), r.methodLabel, r.notes ?? "—"],
        }}
      />
    );
  }

  function renderAttendanceReport() {
    const breakdown = buildSessionStatusBreakdown(filteredSessions);
    const rows = buildStudentAttendanceRows(studentsToShow, filteredSessions);

    const summaryCards: ReportSummaryCard[] = [
      { title: "Tamamlanan", value: breakdown.completed, icon: CheckCircle2, variant: "success" },
      { title: "Planlanan", value: breakdown.planned, icon: CalendarDays, variant: "default" },
      { title: "İptal / Gelmedi", value: breakdown.cancelled + breakdown.noShow, icon: XCircle, variant: "warning" },
      { title: "Telafi", value: breakdown.makeup, icon: Repeat, variant: "default" },
    ];

    return (
      <ReportViewer<StudentAttendanceRow>
        note={filterSummaryText}
        summaryCards={summaryCards}
        columns={attendanceColumns}
        rows={rows}
        keyExtractor={(r) => r.studentId}
        emptyTitle="Devam kaydı bulunamadı"
        csv={{
          filename: "devam-ozeti.csv",
          headers: ["Tarih", "Öğrenci", "Toplam", "Tamamlanan", "Planlanan", "İptal", "Gelmedi", "Telafi"],
          rowMapper: (r) => [r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "", r.studentName, r.total, r.completed, r.planned, r.cancelled, r.noShow, r.makeup],
        }}
        pdf={{
          title: "Devam Özeti",
          subtitle: filterSummaryText,
          columns: [
            { header: "Tarih" },
            { header: "Öğrenci" },
            { header: "Toplam", align: "right" },
            { header: "Tamamlanan", align: "right" },
            { header: "Planlanan", align: "right" },
            { header: "İptal", align: "right" },
            { header: "Gelmedi", align: "right" },
            { header: "Telafi", align: "right" },
          ],
          rowMapper: (r) => [r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "—", r.studentName, String(r.total), String(r.completed), String(r.planned), String(r.cancelled), String(r.noShow), String(r.makeup)],
        }}
      />
    );
  }

  function renderTeacherSessionCountsReport() {
    const breakdown = buildSessionStatusBreakdown(filteredSessions);
    const rows = buildTeacherSessionCountRows(teachersToShow, filteredSessions);

    const summaryCards: ReportSummaryCard[] = [
      { title: "Tamamlanan", value: breakdown.completed, icon: CheckCircle2, variant: "success" },
      { title: "Planlanan", value: breakdown.planned, icon: CalendarDays, variant: "default" },
      { title: "İptal / Gelmedi", value: breakdown.cancelled + breakdown.noShow, icon: XCircle, variant: "warning" },
      { title: "Telafi", value: breakdown.makeup, icon: Repeat, variant: "default" },
    ];

    return (
      <ReportViewer<TeacherSessionCountRow>
        note={filterSummaryText}
        summaryCards={summaryCards}
        columns={teacherSessionCountColumns}
        rows={rows}
        keyExtractor={(r) => r.teacherId}
        emptyTitle="Seans kaydı bulunamadı"
        csv={{
          filename: "ogretmen-seans-sayilari.csv",
          headers: ["Tarih", "Öğretmen", "Toplam", "Tamamlanan", "Planlanan", "İptal", "Gelmedi", "Telafi"],
          rowMapper: (r) => [r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "", r.teacherName, r.total, r.completed, r.planned, r.cancelled, r.noShow, r.makeup],
        }}
        pdf={{
          title: "Öğretmen Seans Sayıları",
          subtitle: filterSummaryText,
          columns: [
            { header: "Tarih" },
            { header: "Öğretmen" },
            { header: "Toplam", align: "right" },
            { header: "Tamamlanan", align: "right" },
            { header: "Planlanan", align: "right" },
            { header: "İptal", align: "right" },
            { header: "Gelmedi", align: "right" },
            { header: "Telafi", align: "right" },
          ],
          rowMapper: (r) => [r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "—", r.teacherName, String(r.total), String(r.completed), String(r.planned), String(r.cancelled), String(r.noShow), String(r.makeup)],
        }}
      />
    );
  }

  function renderTeacherEarningsReport(mode: "earnings" | "performance") {
    const isPerformance = mode === "performance";

    // A single month selected → carryover-aware table (Önceki Devir/Bu Ay Hakediş/
    // Bu Ay Ödeme/Bu Ay Kesinti/Güncel Bakiye/Toplam Bekleyen) for both earnings and
    // performance modes — session-count columns aren't part of the carryover story.
    if (isSingleMonthMode) {
      const rows = teachersToShow.map((t) =>
        getTeacherMonthAccountSummary(t, store.sessions, store.teacherPayments, singleMonthYear, singleMonthMonth, store.teacherEducationTypeAssignments)
      );
      const totalPrevious = rows.reduce((s, r) => s + r.previousBalance, 0);
      const totalEarning = rows.reduce((s, r) => s + r.thisMonthEarning, 0);
      const totalPaidThisMonth = rows.reduce((s, r) => s + r.thisMonthPaid, 0);
      const totalDeducted = rows.reduce((s, r) => s + r.thisMonthDeducted, 0);
      const totalBalance = rows.reduce((s, r) => s + r.currentBalance, 0);
      const totalUnknown = rows.reduce((s, r) => s + r.unknownSessionCount, 0);

      const summaryCards: ReportSummaryCard[] = [
        { title: "Önceki Devir", value: formatCurrency(totalPrevious), icon: AlertCircle, variant: totalPrevious > 0 ? "warning" : "default" },
        { title: "Bu Ay Hakediş", value: formatCurrency(totalEarning), icon: TrendingUp, variant: "default" },
        { title: "Bu Ay Ödeme", value: formatCurrency(totalPaidThisMonth), icon: CheckCircle2, variant: "success" },
        { title: "Bu Ay Kesinti", value: formatCurrency(totalDeducted), icon: Clock, variant: totalDeducted > 0 ? "warning" : "default" },
        { title: "Güncel Bakiye", value: formatCurrency(totalBalance), icon: AlertCircle, variant: totalBalance > 0 ? "warning" : "success" },
        ...(totalUnknown > 0
          ? [{ title: "Hesaplanamayan", value: `${totalUnknown} seans`, icon: Clock, variant: "warning" as const }]
          : []),
      ];

      return (
        <ReportViewer<TeacherMonthAccountSummary>
          note={filterSummaryText}
          summaryCards={summaryCards}
          columns={teacherMonthAccountColumns}
          rows={rows}
          keyExtractor={(r) => r.teacherId}
          emptyTitle="Öğretmen verisi bulunamadı"
          csv={{
            filename: `${isPerformance ? "ogretmen-performansi" : "ogretmen-hakedisleri"}-${filters.monthKey}.csv`,
            headers: ["Tarih", "Öğretmen", "Önceki Devir", "Bu Ay Hakediş", "Bu Ay Ödeme", "Bu Ay Kesinti", "Güncel Bakiye", "Toplam Bekleyen"],
            rowMapper: (r) => [r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "", r.teacherName, r.previousBalance, r.thisMonthEarning, r.thisMonthPaid, r.thisMonthDeducted, r.currentBalance, r.totalPending],
          }}
          pdf={{
            title: isPerformance ? "Öğretmen Performansı" : "Öğretmen Hakedişleri",
            subtitle: filterSummaryText,
            columns: [
              { header: "Tarih" },
              { header: "Öğretmen" },
              { header: "Önceki Devir", align: "right" },
              { header: "Bu Ay Hakediş", align: "right" },
              { header: "Bu Ay Ödeme", align: "right" },
              { header: "Bu Ay Kesinti", align: "right" },
              { header: "Güncel Bakiye", align: "right" },
              { header: "Toplam Bekleyen", align: "right" },
            ],
            rowMapper: (r) => [
              r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "—",
              r.teacherName,
              formatCurrency(r.previousBalance),
              formatCurrency(r.thisMonthEarning),
              formatCurrency(r.thisMonthPaid),
              formatCurrency(r.thisMonthDeducted),
              formatCurrency(r.currentBalance),
              formatCurrency(r.totalPending),
            ],
          }}
        />
      );
    }

    const rows = buildTeacherReportRows(teachersToShow, filteredSessions, store.sessions, store.teacherPayments, start, end, store.teacherEducationTypeAssignments);
    const totalEarned = rows.reduce((s, r) => s + r.totalEarning, 0);
    const totalPaid = rows.reduce((s, r) => s + r.paidEarning, 0);
    const totalPending = rows.reduce((s, r) => s + r.pendingEarning, 0);
    const totalUnknown = rows.reduce((s, r) => s + r.unknownSessionCount, 0);

    const summaryCards: ReportSummaryCard[] = [
      { title: "Bilinen Hakediş", value: formatCurrency(totalEarned), icon: TrendingUp, variant: "default" },
      { title: "Toplam Ödenen", value: formatCurrency(totalPaid), icon: CheckCircle2, variant: "success" },
      { title: "Bekleyen", value: formatCurrency(totalPending), icon: Clock, variant: totalPending > 0 ? "warning" : "success" },
      { title: "Öğretmen Sayısı", value: rows.length, icon: GraduationCap, variant: "default" },
      ...(totalUnknown > 0
        ? [{ title: "Hesaplanamayan", value: `${totalUnknown} seans`, icon: AlertCircle, variant: "warning" as const }]
        : []),
    ];

    return (
      <ReportViewer<TeacherReportRow>
        note={filterSummaryText}
        summaryCards={summaryCards}
        columns={isPerformance ? teacherPerformanceColumns : teacherEarningsColumns}
        rows={rows}
        keyExtractor={(r) => r.teacherId}
        emptyTitle="Öğretmen verisi bulunamadı"
        csv={{
          filename: isPerformance ? "ogretmen-performansi.csv" : "ogretmen-hakedisleri.csv",
          headers: isPerformance
            ? ["Tarih", "Öğretmen", "Toplam Seans", "Tamamlanan", "Öğrenci Sayısı", "Toplam Hakediş", "Ödenen", "Bekleyen", "Hesaplanamayan Seans", "Durum"]
            : ["Tarih", "Öğretmen", "Seans", "Toplam Hakediş", "Ödenen", "Bekleyen", "Hesaplanamayan Seans", "Durum"],
          rowMapper: (r) =>
            isPerformance
              ? [r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "", r.teacherName, r.totalSessions, r.completedSessions, r.uniqueStudentCount, r.totalEarning, r.paidEarning, r.pendingEarning, r.unknownSessionCount, getTeacherStatusLabel(r.status)]
              : [r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "", r.teacherName, r.totalSessions, r.totalEarning, r.paidEarning, r.pendingEarning, r.unknownSessionCount, getTeacherStatusLabel(r.status)],
        }}
        pdf={{
          title: isPerformance ? "Öğretmen Performansı" : "Öğretmen Hakedişleri",
          subtitle: filterSummaryText,
          columns: isPerformance
            ? [
                { header: "Tarih" },
                { header: "Öğretmen" },
                { header: "Toplam Seans", align: "right" },
                { header: "Tamamlanan", align: "right" },
                { header: "Öğrenci Sayısı", align: "right" },
                { header: "Toplam Hakediş", align: "right" },
                { header: "Ödenen", align: "right" },
                { header: "Bekleyen", align: "right" },
                { header: "Hesaplanamayan Seans", align: "right" },
                { header: "Durum" },
              ]
            : [
                { header: "Tarih" },
                { header: "Öğretmen" },
                { header: "Seans", align: "right" },
                { header: "Toplam Hakediş", align: "right" },
                { header: "Ödenen", align: "right" },
                { header: "Bekleyen", align: "right" },
                { header: "Hesaplanamayan Seans", align: "right" },
                { header: "Durum" },
              ],
          rowMapper: (r) =>
            isPerformance
              ? [
                  r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "—",
                  r.teacherName,
                  String(r.totalSessions),
                  String(r.completedSessions),
                  String(r.uniqueStudentCount),
                  formatCurrency(r.totalEarning),
                  formatCurrency(r.paidEarning),
                  formatCurrency(r.pendingEarning),
                  String(r.unknownSessionCount),
                  getTeacherStatusLabel(r.status),
                ]
              : [r.lastSessionDate ? formatDateDMY(r.lastSessionDate) : "—", r.teacherName, String(r.totalSessions), formatCurrency(r.totalEarning), formatCurrency(r.paidEarning), formatCurrency(r.pendingEarning), String(r.unknownSessionCount), getTeacherStatusLabel(r.status)],
        }}
      />
    );
  }

  function renderActiveReport() {
    switch (reportId) {
      case "income":
        return renderIncomeStyleReport("gelir", "income");
      case "teacher-payments":
        return renderTeacherPaymentReport("finansal");
      case "daily-cash":
        return renderDailyCashReport();
      case "session-status":
        return renderSessionStatusReport();
      case "student-debt":
        return renderIncomeStyleReport("ogrenci-borc", "debt");
      case "student-payments":
        return renderStudentPaymentReport();
      case "attendance":
        return renderAttendanceReport();
      case "teacher-earnings":
        return renderTeacherEarningsReport("earnings");
      case "teacher-session-counts":
        return renderTeacherSessionCountsReport();
      case "teacher-performance":
        return renderTeacherEarningsReport("performance");
      default:
        return null;
    }
  }

  const showTeacherFilter = category !== "students" || reportId === "attendance";
  const showStudentFilter = category !== "teachers";
  const showEducationTypeFilter = category === "education" || category === "financial";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raporlar"
        description="Mevcut verilerden üretilen finansal, eğitim, öğrenci ve öğretmen raporları"
      />

      {/* Category selector */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => selectCategory(cat)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors border",
              category === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            {REPORT_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Report selector within category */}
      <div className="flex flex-wrap gap-1.5">
        {REPORT_CATALOG[category].map((r) => (
          <button
            key={r.id}
            onClick={() => setReportId(r.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border",
              reportId === r.id
                ? "bg-primary/10 text-primary border-primary/30"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-3">
        <ReportFilterBar
          filters={filters}
          onChange={setFilters}
          monthOptions={monthOptions}
          teachers={teacherOptions}
          students={studentOptions}
          educationTypes={edTypeOptions}
          showTeacherFilter={showTeacherFilter}
          showStudentFilter={showStudentFilter}
          showEducationTypeFilter={showEducationTypeFilter}
        />
      </div>

      {/* Active report */}
      {renderActiveReport()}
    </div>
  );
}
