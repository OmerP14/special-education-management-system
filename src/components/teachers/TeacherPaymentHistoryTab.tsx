"use client";

import { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  FileText,
  Wallet,
  CheckCircle2,
  Clock,
  TrendingUp,
  MinusCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { TeacherPaymentFormDrawer } from "@/components/teachers/TeacherPaymentFormDrawer";
import { useMockStore } from "@/lib/mock/store";
import {
  getTeacherMonthAccountSummary,
  getMonthKey,
  getMonthLabel,
  getShortPaymentMethodLabel,
  getTeacherPaymentTypeLabel,
  isDeductionPaymentType,
  formatCurrency,
  formatDate,
} from "@/lib/helpers/finance";
import { downloadCsv, printHtmlReport } from "@/lib/helpers/export";
import type { TeacherPayment } from "@/types";

// Kesinti isn't a cash/bank payment — it has no meaningful method.
function methodDisplay(p: TeacherPayment): string {
  return isDeductionPaymentType(p.paymentType) ? "-" : getShortPaymentMethodLabel(p.method);
}

function slugify(name: string): string {
  return name
    .toLocaleLowerCase("tr-TR")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

interface TeacherPaymentHistoryTabProps {
  teacherId: string;
}

export function TeacherPaymentHistoryTab({ teacherId }: TeacherPaymentHistoryTabProps) {
  const store = useMockStore();
  const [monthFilter, setMonthFilter] = useState("all");
  const [payOpen, setPayOpen] = useState(false);

  const teacher = store.teachers.find((t) => t.id === teacherId);

  const allPayments = useMemo(
    () =>
      store.teacherPayments
        .filter((p) => p.teacherId === teacherId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [store.teacherPayments, teacherId]
  );

  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: "all", label: "Tüm Aylar" }];
    allPayments.forEach((p) => {
      const key = getMonthKey(new Date(p.date));
      if (!seen.has(key)) {
        seen.add(key);
        opts.push({ value: key, label: getMonthLabel(key) });
      }
    });
    return opts;
  }, [allPayments]);

  const filteredPayments = useMemo(
    () =>
      monthFilter === "all"
        ? allPayments
        : allPayments.filter((p) => getMonthKey(new Date(p.date)) === monthFilter),
    [allPayments, monthFilter]
  );

  if (!teacher) return null;

  // The summary always reflects whichever month is selected in the dropdown below —
  // falling back to the real current month only when "Tüm Aylar" is picked, never
  // silently pinned to "now" while the user is looking at a past month.
  const now = new Date();
  const [summaryYear, summaryMonth] =
    monthFilter === "all"
      ? [now.getFullYear(), now.getMonth() + 1]
      : (monthFilter.split("-").map(Number) as [number, number]);
  const summaryMonthLabel =
    monthFilter === "all" ? getMonthLabel(getMonthKey(now)) : getMonthLabel(monthFilter);

  const account = getTeacherMonthAccountSummary(
    teacher,
    store.sessions,
    store.teacherPayments,
    summaryYear,
    summaryMonth
  );

  const filteredMonthLabel = monthFilter === "all" ? "Tüm Aylar" : getMonthLabel(monthFilter);
  const filenameSuffix = monthFilter === "all" ? "" : `-${monthFilter}`;

  const handleExportCsv = () => {
    downloadCsv(
      `${slugify(teacher.fullName)}-odeme-gecmisi${filenameSuffix}.csv`,
      ["Tarih", "Dönem", "Ödeme Türü", "Tutar", "Yöntem", "Açıklama"],
      filteredPayments.map((p) => [
        formatDate(p.date),
        getMonthLabel(getMonthKey(new Date(p.date))),
        getTeacherPaymentTypeLabel(p.paymentType),
        p.amount,
        methodDisplay(p),
        p.description ?? "",
      ])
    );
  };

  const handleExportPdf = () => {
    printHtmlReport({
      title: `${teacher.fullName} — Ödeme Geçmişi`,
      subtitle: filteredMonthLabel,
      summary: [
        { label: "Önceki Devir", value: formatCurrency(account.previousBalance) },
        { label: "Bu Ay Hakediş", value: formatCurrency(account.thisMonthEarning) },
        { label: "Bu Ay Ödeme", value: formatCurrency(account.thisMonthPaid) },
        { label: "Bu Ay Kesinti", value: formatCurrency(account.thisMonthDeducted) },
        { label: "Güncel Bakiye", value: formatCurrency(account.currentBalance) },
        { label: "Toplam Bekleyen", value: formatCurrency(account.totalPending) },
      ],
      columns: [
        { header: "Tarih" },
        { header: "Dönem" },
        { header: "Ödeme Türü" },
        { header: "Tutar", align: "right" },
        { header: "Yöntem" },
        { header: "Açıklama" },
      ],
      rows: filteredPayments.map((p) => [
        formatDate(p.date),
        getMonthLabel(getMonthKey(new Date(p.date))),
        getTeacherPaymentTypeLabel(p.paymentType),
        formatCurrency(p.amount),
        methodDisplay(p),
        p.description ?? "—",
      ]),
    });
  };

  const columns: Column<TeacherPayment>[] = [
    {
      key: "date",
      header: "Tarih",
      render: (row) => <span className="tabular-nums text-sm">{formatDate(row.date)}</span>,
    },
    {
      key: "period",
      header: "Dönem",
      render: (row) => (
        <span className="text-sm text-muted-foreground">
          {getMonthLabel(getMonthKey(new Date(row.date)))}
        </span>
      ),
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
    {
      key: "paymentType",
      header: "Ödeme Türü",
      render: (row) => (
        <span className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
          {getTeacherPaymentTypeLabel(row.paymentType)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Tutar",
      render: (row) => (
        <span className="tabular-nums font-semibold">{formatCurrency(row.amount)}</span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "method",
      header: "Yöntem",
      render: (row) => <span className="text-sm">{methodDisplay(row)}</span>,
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "description",
      header: "Açıklama",
      render: (row) =>
        row.description ? (
          <span className="text-sm text-muted-foreground">{row.description}</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Aylık Hesap Hareketi — mirrors Student/Guardian Detail's Cari Hesap, but for
          teacher earnings: Önceki Devir is never silently folded into a lifetime total. */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Aylık Hesap Hareketi — {summaryMonthLabel}
        </p>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Önceki Devir"
            value={formatCurrency(account.previousBalance)}
            description="Seçili aydan önceki bekleyen"
            icon={AlertCircle}
            variant={account.previousBalance > 0 ? "warning" : "success"}
          />
          <StatCard
            title="Bu Ay Hakediş"
            value={formatCurrency(account.thisMonthEarning)}
            description="Seçili ayda oluşan"
            icon={TrendingUp}
            variant="default"
          />
          <StatCard
            title="Bu Ay Ödeme"
            value={formatCurrency(account.thisMonthPaid)}
            description="Nakit/EFT"
            icon={Wallet}
            variant="success"
          />
          <StatCard
            title="Bu Ay Kesinti"
            value={formatCurrency(account.thisMonthDeducted)}
            description="Hakedişten düşülen"
            icon={MinusCircle}
            variant={account.thisMonthDeducted > 0 ? "warning" : "default"}
          />
          <StatCard
            title="Güncel Bakiye"
            value={formatCurrency(account.currentBalance)}
            description="Devir + hakediş − ödeme − kesinti"
            icon={CheckCircle2}
            variant={account.currentBalance > 0 ? "warning" : "success"}
          />
          <StatCard
            title="Toplam Bekleyen"
            value={formatCurrency(account.totalPending)}
            description="Tüm zamanlar"
            icon={Clock}
            variant={account.totalPending > 0 ? "warning" : "success"}
          />
        </div>
      </div>

      {/* Toolbar: month filter + exports + pay action */}
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            disabled={filteredPayments.length === 0}
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
            Excel&apos;e Aktar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportPdf}
            disabled={filteredPayments.length === 0}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            PDF Rapor
          </Button>
          {account.totalPending > 0 && (
            <Button size="sm" onClick={() => setPayOpen(true)}>
              Ödeme Yap
            </Button>
          )}
        </div>
      </div>

      <DataTable
        data={filteredPayments}
        columns={columns}
        keyExtractor={(p) => p.id}
        emptyTitle="Ödeme kaydı bulunamadı"
        emptyDescription={
          monthFilter === "all"
            ? "Bu öğretmene henüz ödeme yapılmamış."
            : "Seçilen ayda ödeme kaydı yok."
        }
      />

      <TeacherPaymentFormDrawer
        open={payOpen}
        onOpenChange={setPayOpen}
        preselectedTeacherId={teacherId}
      />
    </div>
  );
}
