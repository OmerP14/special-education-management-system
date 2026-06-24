"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Users, AlertCircle, CreditCard, TrendingUp, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/StatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { GuardianFormDrawer } from "@/components/guardians/GuardianFormDrawer";
import { useMockStore } from "@/lib/mock/store";
import { buildGuardianListItems, formatCurrency } from "@/lib/helpers/finance";
import type { Guardian, GuardianListItem } from "@/types";
import { cn } from "@/lib/utils";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GuardiansPage() {
  const store = useMockStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingGuardian, setEditingGuardian] = useState<Guardian | null>(null);

  const items = useMemo(
    () =>
      buildGuardianListItems(
        store.guardians,
        store.students,
        store.sessions,
        store.payments
      ),
    [store.guardians, store.students, store.sessions, store.payments]
  );

  const totalDebt = items.reduce((sum, i) => sum + i.totalDebt, 0);
  const totalPaid = items.reduce((sum, i) => sum + i.totalPaid, 0);
  const totalBilled = items.reduce((sum, i) => sum + i.totalBilled, 0);
  const guardiansWithDebt = items.filter((i) => i.totalDebt > 0).length;

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

  const columns: Column<GuardianListItem>[] = [
    {
      key: "name",
      header: "Ad Soyad",
      render: (row) => (
        <Link
          href={`/app/guardians/${row.id}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.fullName}
        </Link>
      ),
    },
    {
      key: "relationship",
      header: "Yakınlık",
      render: (row) => (
        <span className="text-muted-foreground text-sm">{row.relationship}</span>
      ),
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
    {
      key: "phone",
      header: "Telefon",
      render: (row) => (
        <a
          href={`tel:${row.phone}`}
          className="tabular-nums text-sm text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.phone}
        </a>
      ),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "students",
      header: "Öğrenciler",
      render: (row) =>
        row.studentNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.studentNames.map((name, i) => {
              const studentId = row.studentIds[i];
              return studentId ? (
                <Link
                  key={studentId}
                  href={`/app/students/${studentId}`}
                  className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  {name}
                </Link>
              ) : null;
            })}
          </div>
        ) : (
          <span className="text-muted-foreground/40 text-sm">—</span>
        ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "totalBilled",
      header: "Toplam Tahakkuk",
      render: (row) => (
        <span className="tabular-nums text-right block">
          {formatCurrency(row.totalBilled)}
        </span>
      ),
      className: "hidden md:table-cell text-right",
      headerClassName: "hidden md:table-cell text-right",
    },
    {
      key: "totalPaid",
      header: "Alınan Ödeme",
      render: (row) => (
        <span className="tabular-nums text-emerald-600 font-medium text-right block">
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
            "tabular-nums font-semibold text-right block",
            row.totalDebt > 0 ? "text-destructive" : "text-muted-foreground"
          )}
        >
          {formatCurrency(row.totalDebt)}
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
    {
      key: "edit",
      header: "",
      render: (row) => (
        <button
          className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
        >
          Düzenle
        </button>
      ),
      className: "text-right w-20",
      headerClassName: "text-right w-20",
    },
  ];

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Veliler"
          description={`${items.length} kayıtlı veli`}
          actions={
            <Button size="sm" onClick={() => { setEditingGuardian(null); setDrawerOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Veli Ekle
            </Button>
          }
        />

        {/* Summary stat cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Toplam Veli"
            value={items.length}
            description="Kayıtlı veli"
            icon={Users}
            variant="default"
          />
          <StatCard
            title="Toplam Tahakkuk"
            value={formatCurrency(totalBilled)}
            description="Tüm veliler"
            icon={TrendingUp}
            variant="default"
          />
          <StatCard
            title="Alınan Ödeme"
            value={formatCurrency(totalPaid)}
            description="Tahsil edilen"
            icon={CreditCard}
            variant="success"
          />
          <StatCard
            title="Kalan Borç"
            value={formatCurrency(totalDebt)}
            description={`${guardiansWithDebt} velide borç var`}
            icon={AlertCircle}
            variant={guardiansWithDebt > 0 ? "danger" : "success"}
          />
        </div>

        <DataTable
          data={items}
          columns={columns}
          keyExtractor={(g) => g.id}
          emptyTitle="Veli bulunamadı"
          emptyDescription="Henüz veli kaydı oluşturulmamış."
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
