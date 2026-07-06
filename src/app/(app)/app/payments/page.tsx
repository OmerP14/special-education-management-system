"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  BanknoteIcon,
  ReceiptText,
  AlertCircle,
  Users,
  Search,
  Plus,
  X,
  Check,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PaymentFormDrawer } from "@/components/payments/PaymentFormDrawer";
import { useMockStore } from "@/lib/mock/store";
import {
  buildPaymentListItems,
  buildStudentDebtItems,
  buildPaymentPageStats,
  formatCurrency,
  formatDate,
} from "@/lib/helpers/finance";
import {
  buildInstallmentRows,
  getIntervalLabel,
  getInstallmentDisplayStatus,
} from "@/lib/helpers/installments";
import type {
  Payment,
  PaymentListItem,
  PaymentMethod,
  DebtStatus,
  InstallmentRow,
  InstallmentStatus,
} from "@/types";
import { cn } from "@/lib/utils";

// ─── Debt status badge (local — avoids collision with EarningStatus "paid") ───

const DEBT_CONFIG: Record<DebtStatus, { label: string; className: string }> = {
  paid: {
    label: "Borçsuz",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  partial: {
    label: "Kısmi Ödeme",
    className: "bg-amber-100 text-amber-700 border-amber-200",
  },
  unpaid: {
    label: "Ödenmedi",
    className: "bg-red-100 text-red-700 border-red-200",
  },
};

function DebtBadge({ status }: { status: DebtStatus }) {
  const cfg = DEBT_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        cfg.className
      )}
    >
      {cfg.label}
    </span>
  );
}

// ─── Method badge ─────────────────────────────────────────────────────────────

const METHOD_ICONS: Record<PaymentMethod, string> = {
  cash: "💵",
  bank_transfer: "🏦",
  credit_card: "💳",
  other: "📋",
};

// ─── Column definitions ────────────────────────────────────────────────────────

const columns: Column<PaymentListItem>[] = [
  {
    key: "date",
    header: "Tarih",
    render: (row) => (
      <span className="tabular-nums text-sm font-medium">{formatDate(row.date)}</span>
    ),
  },
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
    key: "method",
    header: "Ödeme Yöntemi",
    render: (row) => (
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span className="text-base leading-none">{METHOD_ICONS[row.method]}</span>
          {row.methodLabel}
        </span>
        {row.paymentSource === "installment" && (
          <span className="inline-flex items-center rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[10px] font-medium text-indigo-700 w-fit">
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
    render: (row) =>
      row.notes ? (
        <span className="text-sm text-muted-foreground line-clamp-1">{row.notes}</span>
      ) : (
        <span className="text-muted-foreground/40">—</span>
      ),
    className: "hidden lg:table-cell max-w-[200px]",
    headerClassName: "hidden lg:table-cell",
  },
  {
    key: "amount",
    header: "Ödenen Tutar",
    render: (row) => (
      <span className="tabular-nums font-semibold text-emerald-600">
        {formatCurrency(row.amount)}
      </span>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
  {
    key: "totalBilled",
    header: "Toplam Tahakkuk",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground">
        {formatCurrency(row.totalBilled)}
      </span>
    ),
    className: "hidden md:table-cell text-right",
    headerClassName: "hidden md:table-cell text-right",
  },
  {
    key: "remainingDebt",
    header: "Kalan Borç",
    render: (row) => (
      <span
        className={cn(
          "tabular-nums font-medium",
          row.remainingDebt > 0 ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {formatCurrency(row.remainingDebt)}
      </span>
    ),
    className: "hidden sm:table-cell text-right",
    headerClassName: "hidden sm:table-cell text-right",
  },
  {
    key: "debtStatus",
    header: "Durum",
    render: (row) => <DebtBadge status={row.debtStatus} />,
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
  },
];

// ─── Filter constants ──────────────────────────────────────────────────────────

type PaymentTypeFilter = "all" | "single" | "installment";

const PAYMENT_TYPE_FILTERS: { value: PaymentTypeFilter; label: string }[] = [
  { value: "all", label: "Tüm Ödemeler" },
  { value: "single", label: "Tek Ödeme" },
  { value: "installment", label: "Taksit Planı" },
];

const INSTALLMENT_STATUS_FILTERS: { value: InstallmentStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "pending", label: "Bekliyor" },
  { value: "overdue", label: "Gecikmiş" },
  { value: "paid", label: "Ödendi" },
];

const DEBT_STATUS_FILTERS: { value: DebtStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "unpaid", label: "Ödenmedi" },
  { value: "partial", label: "Kısmi" },
  { value: "paid", label: "Borçsuz" },
];

const METHOD_FILTERS: { value: PaymentMethod | "all"; label: string }[] = [
  { value: "all", label: "Tüm Yöntemler" },
  { value: "cash", label: "Nakit" },
  { value: "bank_transfer", label: "Banka Havalesi" },
  { value: "credit_card", label: "Kredi Kartı" },
  { value: "other", label: "Diğer" },
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

// ─── Debt progress bar ────────────────────────────────────────────────────────

function DebtProgressBar({
  totalBilled,
  totalPaid,
  debtStatus,
}: {
  totalBilled: number;
  totalPaid: number;
  debtStatus: DebtStatus;
}) {
  const pct = totalBilled > 0 ? Math.min(100, Math.round((totalPaid / totalBilled) * 100)) : 0;
  const barClass =
    debtStatus === "paid"
      ? "bg-emerald-500"
      : debtStatus === "partial"
        ? "bg-amber-500"
        : "bg-red-400";

  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", barClass)}
        style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }}
      />
    </div>
  );
}

// ─── Installment table ─────────────────────────────────────────────────────────

function InstallmentTable({
  rows,
  onMarkPaid,
}: {
  rows: InstallmentRow[];
  onMarkPaid: (planId: string, installmentId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-10 text-center">
        <CalendarClock className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium text-foreground">Taksit kaydı bulunamadı</p>
        <p className="text-xs text-muted-foreground mt-1">
          Taksit planı oluşturmak için &ldquo;Ödeme Ekle&rdquo; butonunu kullanın.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Öğrenci
              </th>
              <th className="hidden sm:table-cell px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Veli
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Taksit
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Vade Tarihi
              </th>
              <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Tutar
              </th>
              <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Durum
              </th>
              <th className="px-4 py-2.5 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.map((row) => (
              <tr key={row.installmentId} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    href={`/app/students/${row.studentId}`}
                    className="font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {row.studentName}
                  </Link>
                </td>
                <td className="hidden sm:table-cell px-4 py-3">
                  {row.guardianId ? (
                    <Link
                      href={`/app/guardians/${row.guardianId}`}
                      className="text-muted-foreground hover:text-primary transition-colors text-sm"
                    >
                      {row.guardianName}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                  {row.installmentNumber}/{row.totalInstallments}
                </td>
                <td className="px-4 py-3 text-sm tabular-nums">
                  {formatDate(row.dueDate)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold">
                  {formatCurrency(row.amount)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.displayStatus} />
                </td>
                <td className="px-4 py-3 text-right">
                  {(row.displayStatus === "pending" || row.displayStatus === "overdue") && (
                    <button
                      onClick={() => onMarkPaid(row.planId, row.installmentId)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <Check className="h-3 w-3" />
                      Ödendi
                    </button>
                  )}
                  {row.displayStatus === "paid" && row.paidDate && (
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(row.paidDate)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const store = useMockStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<PaymentTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [debtStatusFilter, setDebtStatusFilter] = useState<DebtStatus | "all">("all");
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | "all">("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [instStatusFilter, setInstStatusFilter] = useState<InstallmentStatus | "all">("all");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const thisMonthLabel = monthLabel(monthKey(now));

  // The "Bu Ay Alınan Ödeme" card must track whatever month the user has selected in the
  // filter above — falling back to the real current month only when "Tümü" (all) is picked,
  // never silently pinned to "now" while the user is looking at a different month.
  const [statsYear, statsMonth] =
    monthFilter === "all" ? [currentYear, currentMonth] : (monthFilter.split("-").map(Number) as [number, number]);
  const statsMonthLabel = monthFilter === "all" ? thisMonthLabel : monthLabel(monthFilter);

  const allItems = useMemo(
    () =>
      buildPaymentListItems(
        store.payments,
        store.students,
        store.guardians,
        store.sessions
      ),
    [store.payments, store.students, store.guardians, store.sessions]
  );

  const stats = useMemo(
    () =>
      buildPaymentPageStats(
        store.payments,
        store.sessions,
        store.students,
        statsYear,
        statsMonth
      ),
    [store.payments, store.sessions, store.students, statsYear, statsMonth]
  );

  const debtItems = useMemo(
    () => buildStudentDebtItems(store.students, store.guardians, store.sessions, store.payments),
    [store.students, store.guardians, store.sessions, store.payments]
  );

  const today = new Date();

  const allInstallmentRows = useMemo(
    () => buildInstallmentRows(store.installmentPlans, store.students, store.guardians, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store.installmentPlans, store.students, store.guardians]
  );

  const filteredInstallmentRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allInstallmentRows.filter((row) => {
      const matchSearch =
        !q ||
        row.studentName.toLowerCase().includes(q) ||
        (row.guardianName?.toLowerCase().includes(q) ?? false);
      const matchStatus =
        instStatusFilter === "all" || row.displayStatus === instStatusFilter;
      const matchStudent =
        studentFilter === "all" || row.studentId === studentFilter;
      return matchSearch && matchStatus && matchStudent;
    });
  }, [allInstallmentRows, search, instStatusFilter, studentFilter]);

  const handleEdit = (row: PaymentListItem) => {
    const payment = store.payments.find((p) => p.id === row.id);
    if (payment) {
      setEditingPayment(payment);
      setDrawerOpen(true);
    }
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingPayment(null);
  };

  const editColumnEntry: Column<PaymentListItem> = {
    key: "action",
    header: "",
    render: (row) => (
      <button
        className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
      >
        Düzenle
      </button>
    ),
    className: "text-right w-16",
    headerClassName: "text-right w-16",
  };

  const columnsWithEdit: Column<PaymentListItem>[] = [...columns, editColumnEntry];

  // Derive available months from payment dates
  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [
      { value: "all", label: "Tüm Aylar" },
    ];
    [...allItems].forEach((item) => {
      const key = monthKey(new Date(item.date));
      if (!seen.has(key)) {
        seen.add(key);
        opts.push({ value: key, label: monthLabel(key) });
      }
    });
    return opts;
  }, [allItems]);

  // Apply all filters
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      const matchSearch =
        !q ||
        item.studentName.toLowerCase().includes(q) ||
        (item.guardianName?.toLowerCase().includes(q) ?? false) ||
        item.methodLabel.toLowerCase().includes(q) ||
        (item.notes?.toLowerCase().includes(q) ?? false);
      const matchDebt = debtStatusFilter === "all" || item.debtStatus === debtStatusFilter;
      const matchMethod = methodFilter === "all" || item.method === methodFilter;
      const matchStudent = studentFilter === "all" || item.studentId === studentFilter;
      const matchMonth =
        monthFilter === "all" || monthKey(new Date(item.date)) === monthFilter;
      return matchSearch && matchDebt && matchMethod && matchStudent && matchMonth;
    });
  }, [allItems, search, debtStatusFilter, methodFilter, studentFilter, monthFilter]);

  const hasActiveFilters =
    search ||
    debtStatusFilter !== "all" ||
    methodFilter !== "all" ||
    studentFilter !== "all" ||
    monthFilter !== "all" ||
    instStatusFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setDebtStatusFilter("all");
    setMethodFilter("all");
    setStudentFilter("all");
    setMonthFilter("all");
    setInstStatusFilter("all");
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Ödemeler"
          description={`${allItems.length} ödeme kaydı · ${thisMonthLabel}`}
          actions={
            <Button size="sm" onClick={() => { setEditingPayment(null); setDrawerOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Ödeme Ekle
            </Button>
          }
        />

        {/* KPI cards — "Bu Ay Alınan Ödeme" follows the month filter below, not just "now" */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title={monthFilter === "all" ? "Bu Ay Alınan Ödeme" : "Seçili Ay Alınan Ödeme"}
            value={formatCurrency(stats.collectedThisMonth)}
            description={statsMonthLabel}
            icon={BanknoteIcon}
            variant="success"
          />
          <StatCard
            title="Toplam Tahakkuk"
            value={formatCurrency(stats.totalBilled)}
            description="Tüm dönem"
            icon={ReceiptText}
            variant="default"
          />
          <StatCard
            title="Toplam Alacak"
            value={formatCurrency(stats.totalRemaining)}
            description="Tahsil bekliyor"
            icon={AlertCircle}
            variant={stats.totalRemaining > 0 ? "warning" : "success"}
          />
          <StatCard
            title="Borcu Olan Öğrenci"
            value={stats.studentsWithDebt}
            description="Borç bakiyesi var"
            icon={Users}
            variant={stats.studentsWithDebt > 0 ? "danger" : "success"}
          />
        </div>

        {/* Debt overview card */}
        {debtItems.length > 0 && (
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Öğrenci Borç Durumu</p>
              <span className="text-xs text-muted-foreground">
                {debtItems.filter((d) => d.remainingDebt > 0).length} borçlu öğrenci
              </span>
            </div>
            <div className="divide-y divide-border/60">
              {debtItems.map((item) => {
                const pct =
                  item.totalBilled > 0
                    ? Math.round((item.totalPaid / item.totalBilled) * 100)
                    : 0;
                return (
                  <div key={item.studentId} className="flex items-center gap-4 px-4 py-3">
                    {/* Name + guardian */}
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/app/students/${item.studentId}`}
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                      >
                        {item.studentName}
                      </Link>
                      {item.guardianName &&
                        (item.guardianId ? (
                          <Link
                            href={`/app/guardians/${item.guardianId}`}
                            className="text-xs text-muted-foreground hover:text-primary transition-colors"
                          >
                            {item.guardianName}
                          </Link>
                        ) : (
                          <p className="text-xs text-muted-foreground">{item.guardianName}</p>
                        ))}
                      <DebtProgressBar
                        totalBilled={item.totalBilled}
                        totalPaid={item.totalPaid}
                        debtStatus={item.debtStatus}
                      />
                    </div>

                    {/* Billed / Paid */}
                    <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(item.totalPaid)}
                        <span className="text-muted-foreground/50">
                          {" "}/{" "}
                        </span>
                        {formatCurrency(item.totalBilled)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{pct}% ödendi</span>
                    </div>

                    {/* Remaining + badge */}
                    <div className="flex flex-col items-end gap-1 shrink-0 min-w-[80px]">
                      <span
                        className={cn(
                          "tabular-nums text-sm font-semibold",
                          item.remainingDebt > 0 ? "text-destructive" : "text-emerald-600"
                        )}
                      >
                        {formatCurrency(item.remainingDebt)}
                      </span>
                      <DebtBadge status={item.debtStatus} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Payment type toggle */}
        <div className="flex rounded-lg border border-border p-0.5 bg-muted/30 max-w-sm">
          {PAYMENT_TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setPaymentTypeFilter(f.value)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
                paymentTypeFilter === f.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Row 1: search + month */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Öğrenci, veli, yöntem veya açıklama ara…"
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

          {/* Row 2: debt status pills — single mode only */}
          {paymentTypeFilter !== "installment" && (
            <div className="flex flex-wrap gap-1.5">
              {DEBT_STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setDebtStatusFilter(f.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                    debtStatusFilter === f.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Row 3: entity dropdowns + clear */}
          <div className="flex flex-wrap gap-2">
            {paymentTypeFilter !== "installment" && (
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value as PaymentMethod | "all")}
                className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {METHOD_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            )}
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Tüm Öğrenciler</option>
              {store.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
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

        {/* Single payments table */}
        {paymentTypeFilter !== "installment" && (
          <div className="space-y-3">
            {paymentTypeFilter === "all" && (
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tek Ödemeler
              </p>
            )}
            <DataTable
              data={filtered}
              columns={columnsWithEdit}
              keyExtractor={(p) => p.id}
              emptyTitle={hasActiveFilters ? "Eşleşen ödeme bulunamadı" : "Henüz ödeme yok"}
              emptyDescription={
                hasActiveFilters
                  ? "Arama veya filtre kriterlerini değiştirmeyi deneyin."
                  : "Ödeme ekleyerek başlayın."
              }
            />
            {filtered.length > 0 && filtered.length !== allItems.length && (
              <p className="text-xs text-muted-foreground">
                {allItems.length} kayıt içinde{" "}
                <span className="font-medium text-foreground">{filtered.length}</span> ödeme
                gösteriliyor
              </p>
            )}
          </div>
        )}

        {/* Installment plans section */}
        {paymentTypeFilter !== "single" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Taksit Planları
              </p>
              <span className="text-xs text-muted-foreground">
                {allInstallmentRows.length} taksit kaydı
              </span>
            </div>
            {/* Installment status filter */}
            <div className="flex flex-wrap gap-1.5">
              {INSTALLMENT_STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setInstStatusFilter(f.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                    instStatusFilter === f.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <InstallmentTable
              rows={filteredInstallmentRows}
              onMarkPaid={store.markInstallmentPaid}
            />
          </div>
        )}
      </div>

      <PaymentFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        initialData={editingPayment ?? undefined}
      />
    </>
  );
}
