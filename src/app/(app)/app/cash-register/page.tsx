"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowLeftRight,
  Pencil,
  Trash2,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/shared/StatCard";
import { CashMovementFormDrawer } from "@/components/cash/CashMovementFormDrawer";
import { useMockStore } from "@/lib/mock/store";
import {
  buildCashMovementRows,
  buildDailyCashSummary,
  getCashMovementTypeLabel,
  getCashCategoryLabel,
  calculateCashBalance,
} from "@/lib/helpers/cash";
import { formatCurrency, formatDate } from "@/lib/helpers/finance";
import type { CashMovement, CashMovementType, CashCategory, CashMovementRow } from "@/types";
import { cn } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function dateToday(): string {
  return new Date().toISOString().split("T")[0]!;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0]!;
}

function longDateLabel(dateStr: string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date(dateStr));
}

// ─── Type badge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: CashMovementType }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        type === "income"
          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
          : "bg-red-100 text-red-700 border-red-200"
      )}
    >
      {type === "income" ? "Gelir" : "Gider"}
    </span>
  );
}

// ─── Source badge ──────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: CashMovementRow["source"] }) {
  if (source === "payment") {
    return (
      <span className="inline-flex rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
        Veli Ödemesi
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Manuel
    </span>
  );
}

// ─── Category filter options ───────────────────────────────────────────────────

const TYPE_FILTERS: { value: CashMovementType | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "income", label: "Gelir" },
  { value: "expense", label: "Gider" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CashRegisterPage() {
  const store = useMockStore();
  const [selectedDate, setSelectedDate] = useState(dateToday);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<CashMovement | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<CashMovementType | "all">("all");

  const allRows = useMemo(
    () => buildCashMovementRows(store.cashMovements, store.payments, store.students),
    [store.cashMovements, store.payments, store.students]
  );

  const dailySummary = useMemo(
    () => buildDailyCashSummary(store.cashMovements, store.payments, selectedDate),
    [store.cashMovements, store.payments, selectedDate]
  );

  const dayRows = useMemo(
    () => allRows.filter((r) => r.date === selectedDate),
    [allRows, selectedDate]
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dayRows.filter((row) => {
      const matchSearch =
        !q ||
        row.categoryLabel.toLowerCase().includes(q) ||
        (row.description?.toLowerCase().includes(q) ?? false) ||
        (row.studentName?.toLowerCase().includes(q) ?? false);
      const matchType = typeFilter === "all" || row.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [dayRows, search, typeFilter]);

  const handleEdit = (row: CashMovementRow) => {
    if (!row.isEditable) return;
    const movement = store.cashMovements.find((m) => m.id === row.id);
    if (movement) {
      setEditingMovement(movement);
      setDrawerOpen(true);
    }
  };

  const handleDelete = (row: CashMovementRow) => {
    if (!row.isEditable) return;
    store.deleteCashMovement(row.id);
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingMovement(null);
  };

  const isToday = selectedDate === dateToday();

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Günlük Kasa"
          description="Merkeze ait günlük nakit ve kart hareketleri"
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditingMovement(null);
                setDrawerOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Hareket Ekle
            </Button>
          }
        />

        {/* Date navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setSelectedDate((d) => addDays(d, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-2 min-w-[200px] text-center">
              <p className="text-sm font-semibold text-foreground">
                {isToday ? "Bugün" : formatDate(selectedDate)}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {longDateLabel(selectedDate)}
              </p>
            </div>
            <button
              onClick={() => setSelectedDate((d) => addDays(d, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {!isToday && (
            <button
              onClick={() => setSelectedDate(dateToday())}
              className="text-xs font-medium text-primary hover:underline"
            >
              Bugüne Dön
            </button>
          )}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="ml-auto h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* KPI stat cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Açılış Bakiyesi"
            value={formatCurrency(dailySummary.openingBalance)}
            description="Güne başlarken"
            icon={Wallet}
            variant={dailySummary.openingBalance >= 0 ? "default" : "danger"}
          />
          <StatCard
            title="Günlük Gelir"
            value={formatCurrency(dailySummary.totalIncome)}
            description={`${dayRows.filter((r) => r.type === "income").length} giriş`}
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="Günlük Gider"
            value={formatCurrency(dailySummary.totalExpense)}
            description={`${dayRows.filter((r) => r.type === "expense").length} çıkış`}
            icon={TrendingDown}
            variant={dailySummary.totalExpense > 0 ? "warning" : "default"}
          />
          <StatCard
            title="Kapanış Bakiyesi"
            value={formatCurrency(dailySummary.closingBalance)}
            description={`Net: ${dailySummary.netMovement >= 0 ? "+" : ""}${formatCurrency(dailySummary.netMovement)}`}
            icon={ArrowLeftRight}
            variant={dailySummary.closingBalance >= 0 ? "success" : "danger"}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Kategori, açıklama veya öğrenci ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                  typeFilter === f.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          {(search || typeFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setTypeFilter("all"); }}
              className="inline-flex items-center gap-1 h-8 rounded-lg border border-destructive/40 px-2.5 text-xs font-medium text-destructive hover:bg-destructive/5 transition-colors"
            >
              <X className="h-3 w-3" />
              Temizle
            </button>
          )}
        </div>

        {/* Transactions table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {filteredRows.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <Wallet className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">
                {dayRows.length === 0
                  ? "Bu tarihte hareket yok"
                  : "Eşleşen hareket bulunamadı"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {dayRows.length === 0
                  ? "Yeni hareket eklemek için \"Hareket Ekle\" butonunu kullanın."
                  : "Arama veya filtre kriterlerini değiştirin."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tür
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Kategori
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Açıklama
                    </th>
                    <th className="hidden sm:table-cell px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Yöntem
                    </th>
                    <th className="hidden md:table-cell px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Kaynak
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Tutar
                    </th>
                    <th className="px-4 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <TypeBadge type={row.type} />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {row.categoryLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="text-sm text-foreground line-clamp-1">
                          {row.description ?? "—"}
                        </p>
                        {row.studentId && row.studentName && (
                          <Link
                            href={`/app/students/${row.studentId}`}
                            className="text-xs text-primary hover:underline"
                          >
                            {row.studentName}
                          </Link>
                        )}
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 text-xs text-muted-foreground">
                        {row.methodLabel}
                      </td>
                      <td className="hidden md:table-cell px-4 py-3">
                        <SourceBadge source={row.source} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "tabular-nums font-semibold text-sm",
                            row.type === "income"
                              ? "text-emerald-600"
                              : "text-destructive"
                          )}
                        >
                          {row.type === "income" ? "+" : "-"}
                          {formatCurrency(row.amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.isEditable ? (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(row)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              title="Düzenle"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(row)}
                              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Sil"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="block text-right text-[11px] text-muted-foreground/50">
                            Otomatik
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Daily totals footer */}
          {filteredRows.length > 0 && (
            <div className="border-t border-border/60 bg-muted/20 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {filteredRows.length} hareket
              </p>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="text-emerald-600">
                  Gelir: +{formatCurrency(filteredRows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0))}
                </span>
                <span className="text-destructive">
                  Gider: -{formatCurrency(filteredRows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Running balance note */}
        <p className="text-xs text-muted-foreground text-center">
          Kasa bakiyesi, tüm öğrenci ödemeleri ve manuel hareketler esas alınarak hesaplanmaktadır.
        </p>
      </div>

      <CashMovementFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        initialDate={selectedDate}
        initialData={editingMovement ?? undefined}
      />
    </>
  );
}
