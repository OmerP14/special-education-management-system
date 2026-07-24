"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  AlertCircle,
  CreditCard,
  TrendingUp,
  Plus,
  Search,
  X,
  UserMinus,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CompactStatBar } from "@/components/shared/CompactStatBar";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { GuardianFormDrawer } from "@/components/guardians/GuardianFormDrawer";
import { useMockStore } from "@/lib/mock/store";
import { buildGuardianListItems, formatCurrency } from "@/lib/helpers/finance";
import type { Guardian, GuardianListItem } from "@/types";
import { cn } from "@/lib/utils";

function initialsOf(fullName: string): string {
  return fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

// ─── Filter types ──────────────────────────────────────────────────────────────

type DebtFilter = "all" | "with_debt" | "no_debt";
type RelFilter = "all" | "Anne" | "Baba" | "Büyükanne" | "Büyükbaba" | "Diğer";

const DEBT_FILTER_OPTIONS: { value: DebtFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "with_debt", label: "Borcu Olanlar" },
  { value: "no_debt", label: "Borcu Olmayanlar" },
];

const REL_FILTER_OPTIONS: { value: RelFilter; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "Anne", label: "Anne" },
  { value: "Baba", label: "Baba" },
  { value: "Büyükanne", label: "Büyükanne" },
  { value: "Büyükbaba", label: "Büyükbaba" },
  { value: "Diğer", label: "Diğer" },
];

// ─── Filter chip ──────────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-xs font-medium transition-colors border whitespace-nowrap",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
      )}
    >
      {children}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GuardiansPage() {
  const store = useMockStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<Guardian | null>(null);
  const [search, setSearch] = useState("");
  const [debtFilter, setDebtFilter] = useState<DebtFilter>("all");
  const [relFilter, setRelFilter] = useState<RelFilter>("all");

  const items = useMemo(
    () =>
      buildGuardianListItems(
        store.guardians,
        store.students,
        store.sessions,
        store.payments,
        store.openingBalances
      ),
    [store.guardians, store.students, store.sessions, store.payments, store.openingBalances]
  );

  // ─── Aggregate stats ────────────────────────────────────────────────────────
  const totalDebt = items.reduce((sum, i) => sum + i.totalDebt, 0);
  const totalPaid = items.reduce((sum, i) => sum + i.totalPaid, 0);
  const totalBilled = items.reduce((sum, i) => sum + i.totalBilled, 0);
  const totalStudentCount = items.reduce((sum, i) => sum + i.studentCount, 0);
  const guardiansWithDebt = items.filter((i) => i.totalDebt > 0).length;

  // ─── Filtered rows ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (debtFilter === "with_debt" && item.totalDebt <= 0) return false;
      if (debtFilter === "no_debt" && item.totalDebt > 0) return false;
      if (relFilter !== "all") {
        const stdRels = ["Anne", "Baba", "Büyükanne", "Büyükbaba"];
        const matches =
          relFilter === "Diğer"
            ? !stdRels.includes(item.relationship)
            : item.relationship === relFilter;
        if (!matches) return false;
      }
      if (q) {
        const hit =
          item.fullName.toLowerCase().includes(q) ||
          item.phone.toLowerCase().includes(q) ||
          (item.email ?? "").toLowerCase().includes(q) ||
          item.studentNames.some((n) => n.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [items, debtFilter, relFilter, search]);

  const hasActiveFilters = debtFilter !== "all" || relFilter !== "all" || search !== "";

  const handleEdit = (row: GuardianListItem) => {
    const guardian = store.guardians.find((g) => g.id === row.id);
    if (guardian) {
      setEditingGuardian(guardian);
      setDrawerOpen(true);
    }
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingGuardian(null);
  };

  // ─── Table columns ─────────────────────────────────────────────────────────
  const columns: Column<GuardianListItem>[] = [
    {
      key: "name",
      header: "Ad Soyad",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {initialsOf(row.fullName)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-0.5 min-w-0">
            <Link
              href={`/app/guardians/${row.id}`}
              className="block truncate font-medium text-foreground hover:text-primary transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {row.fullName}
            </Link>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center rounded-full border border-border/60 bg-muted/50 px-1.5 py-px text-[10px] font-medium text-muted-foreground">
                {row.relationship}
              </span>
              {row.studentCount === 0 && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-px text-[10px] font-medium text-amber-700">
                  Öğrenci yok
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "İletişim",
      render: (row) => (
        <div className="space-y-0.5">
          <a
            href={`tel:${row.phone}`}
            className="block text-sm tabular-nums text-muted-foreground hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {row.phone}
          </a>
          {row.email && (
            <a
              href={`mailto:${row.email}`}
              className="block text-xs text-muted-foreground/70 hover:text-primary transition-colors truncate max-w-[180px]"
              onClick={(e) => e.stopPropagation()}
            >
              {row.email}
            </a>
          )}
        </div>
      ),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "students",
      header: "Öğrenciler",
      render: (row) => {
        if (row.studentIds.length === 0) {
          return (
            <span className="inline-flex items-center rounded-full bg-muted/60 border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground/60">
              Henüz öğrenci yok
            </span>
          );
        }
        const visibleIds = row.studentIds.slice(0, 2);
        const restCount = row.studentIds.length - 2;
        return (
          <div className="flex flex-wrap items-center gap-1">
            {visibleIds.map((id, i) => (
              <Link
                key={id}
                href={`/app/students/${id}`}
                className="inline-flex items-center rounded-full bg-primary/8 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/15 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {row.studentNames[i]}
              </Link>
            ))}
            {restCount > 0 && (
              <span className="inline-flex items-center rounded-full bg-muted/60 border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                +{restCount} daha
              </span>
            )}
          </div>
        );
      },
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "totalBilled",
      header: "Tahakkuk",
      render: (row) => (
        <span className="tabular-nums text-sm text-foreground text-right block">
          {formatCurrency(row.totalBilled)}
        </span>
      ),
      className: "hidden md:table-cell text-right",
      headerClassName: "hidden md:table-cell text-right",
    },
    {
      key: "totalPaid",
      header: "Tahsilat",
      render: (row) => (
        <span className="tabular-nums text-sm font-medium text-emerald-600 text-right block">
          {formatCurrency(row.totalPaid)}
        </span>
      ),
      className: "hidden lg:table-cell text-right",
      headerClassName: "hidden lg:table-cell text-right",
    },
    {
      key: "debt",
      header: "Kalan Borç",
      render: (row) => (
        <span
          className={cn(
            "tabular-nums font-semibold text-sm text-right block",
            row.totalDebt > 0 ? "text-destructive" : "text-muted-foreground/40"
          )}
        >
          {row.totalDebt > 0 ? formatCurrency(row.totalDebt) : "—"}
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/app/guardians/${row.id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-7 px-2 text-xs"
            )}
          >
            Detay
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => handleEdit(row)}
          >
            Düzenle
          </Button>
        </div>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Veliler"
          description={`${items.length} kayıtlı veli · ${totalStudentCount} bağlı öğrenci`}
          actions={
            <Button
              size="sm"
              onClick={() => {
                setEditingGuardian(null);
                setDrawerOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Veli Ekle
            </Button>
          }
        />

        {/* Stats — one dense row instead of six tall cards */}
        <CompactStatBar
          items={[
            { icon: Users, label: "Toplam Veli", value: items.length, tone: "primary" },
            { icon: Users, label: "Bağlı Öğrenci", value: totalStudentCount, tone: "primary" },
            { icon: TrendingUp, label: "Toplam Tahakkuk", value: formatCurrency(totalBilled), tone: "primary" },
            { icon: CreditCard, label: "Toplam Tahsilat", value: formatCurrency(totalPaid), tone: "success" },
            {
              icon: AlertCircle,
              label: "Toplam Borç",
              value: formatCurrency(totalDebt),
              tone: totalDebt > 0 ? "danger" : "success",
            },
            {
              icon: UserMinus,
              label: "Borçlu Veli",
              value: guardiansWithDebt,
              tone: guardiansWithDebt > 0 ? "warning" : "success",
            },
          ]}
        />

        {/* Search + filter bar */}
        <div className="space-y-2.5">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Ad, telefon, e-posta veya öğrenci ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Aramayı temizle"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Borç:</span>
            {DEBT_FILTER_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={debtFilter === opt.value}
                onClick={() => setDebtFilter(opt.value)}
              >
                {opt.label}
              </FilterChip>
            ))}
            <span className="text-muted-foreground/40 text-xs mx-0.5">·</span>
            <span className="text-xs text-muted-foreground font-medium">Yakınlık:</span>
            {REL_FILTER_OPTIONS.map((opt) => (
              <FilterChip
                key={opt.value}
                active={relFilter === opt.value}
                onClick={() => setRelFilter(opt.value)}
              >
                {opt.label}
              </FilterChip>
            ))}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch("");
                  setDebtFilter("all");
                  setRelFilter("all");
                }}
                className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
              >
                Temizle
              </button>
            )}
          </div>
        </div>

        {/* Result count when filtering */}
        {hasActiveFilters && (
          <p className="text-xs text-muted-foreground -mt-2">
            {filtered.length} sonuç gösteriliyor
            {items.length !== filtered.length && ` (${items.length} veliden)`}
          </p>
        )}

        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(g) => g.id}
          emptyTitle={hasActiveFilters ? "Sonuç bulunamadı" : "Veli bulunamadı"}
          emptyDescription={
            hasActiveFilters
              ? "Arama veya filtre kriterlerinizle eşleşen veli bulunamadı."
              : "Henüz veli kaydı oluşturulmamış. Yeni veli eklemek için butona tıklayın."
          }
          onRowClick={(row) => {
            window.location.href = `/app/guardians/${row.id}`;
          }}
        />
      </div>

      <GuardianFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        initialData={editingGuardian ?? undefined}
      />
    </>
  );
}
