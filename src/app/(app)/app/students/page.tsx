"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StudentFormDrawer } from "@/components/students/StudentFormDrawer";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import { buildStudentListItems, formatCurrency } from "@/lib/helpers/finance";
import type { Student, StudentListItem, StudentStatus } from "@/types";
import { cn } from "@/lib/utils";

// ─── Status filter options ─────────────────────────────────────────────────────

const STATUS_FILTERS: { value: StudentStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "on_hold", label: "Beklemede" },
  { value: "inactive", label: "Pasif" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentsPage() {
  const store = useMockStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentStatus | "all">("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const allItems = useMemo(
    () =>
      buildStudentListItems(
        store.students,
        store.guardians,
        mockEducationTypes,
        store.teachers,
        store.sessions,
        store.payments,
        store.openingBalances
      ),
    [store.students, store.guardians, store.teachers, store.sessions, store.payments, store.openingBalances]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      const matchesSearch =
        !q ||
        item.fullName.toLowerCase().includes(q) ||
        item.primaryGuardian?.fullName.toLowerCase().includes(q) ||
        item.primaryGuardian?.phone.includes(q);
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allItems, search, statusFilter]);

  const activeCount = allItems.filter((s) => s.status === "active").length;

  const handleEdit = (row: StudentListItem) => {
    const student = store.students.find((s) => s.id === row.id);
    if (student) {
      setEditingStudent(student);
      setDrawerOpen(true);
    }
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingStudent(null);
  };

  const columns: Column<StudentListItem>[] = [
    {
      key: "name",
      header: "Öğrenci",
      render: (row) => (
        <Link
          href={`/app/students/${row.id}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.fullName}
        </Link>
      ),
    },
    {
      key: "guardian",
      header: "Veli",
      render: (row) =>
        row.primaryGuardian ? (
          <Link
            href={`/app/guardians/${row.primaryGuardian.id}`}
            className="text-muted-foreground hover:text-primary transition-colors text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {row.primaryGuardian.fullName}
          </Link>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        ),
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
    {
      key: "phone",
      header: "Telefon",
      render: (row) =>
        row.primaryGuardian?.phone ? (
          <span className="tabular-nums text-muted-foreground text-xs">
            {row.primaryGuardian.phone}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "educations",
      header: "Eğitimler",
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
      className: "hidden xl:table-cell",
      headerClassName: "hidden xl:table-cell",
    },
    {
      key: "totalSessions",
      header: "Seans",
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">{row.totalSessions}</span>
      ),
      className: "hidden md:table-cell text-right",
      headerClassName: "hidden md:table-cell text-right",
    },
    {
      key: "totalBilled",
      header: "Toplam Tutar",
      render: (row) => (
        <span className="tabular-nums font-medium">{formatCurrency(row.totalBilled)}</span>
      ),
      className: "hidden lg:table-cell text-right",
      headerClassName: "hidden lg:table-cell text-right",
    },
    {
      key: "totalPaid",
      header: "Alınan Ödeme",
      render: (row) => (
        <span className="tabular-nums font-medium text-emerald-600">
          {formatCurrency(row.totalPaid)}
        </span>
      ),
      className: "hidden lg:table-cell text-right",
      headerClassName: "hidden lg:table-cell text-right",
    },
    {
      key: "totalDebt",
      header: "Kalan Borç",
      render: (row) => (
        <span
          className={cn(
            "tabular-nums font-semibold",
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
      key: "status",
      header: "Durum",
      render: (row) => <StatusBadge status={row.status} />,
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
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
    {
      key: "detail",
      header: "",
      render: (row) => (
        <Link
          href={`/app/students/${row.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Detay
          <ChevronRight className="h-3 w-3" />
        </Link>
      ),
      className: "text-right w-16",
      headerClassName: "text-right w-16",
    },
  ];

  return (
    <>
      <div className="space-y-5">
        <PageHeader
          title="Öğrenciler"
          description={`${activeCount} aktif öğrenci · ${allItems.length} toplam`}
          actions={
            <Button size="sm" onClick={() => { setEditingStudent(null); setDrawerOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Öğrenci Ekle
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Öğrenci veya veli ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex gap-1.5">
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
        </div>

        {/* Table */}
        <DataTable
          data={filtered}
          columns={columns}
          keyExtractor={(s) => s.id}
          emptyTitle={
            search || statusFilter !== "all"
              ? "Eşleşen öğrenci bulunamadı"
              : "Henüz öğrenci yok"
          }
          emptyDescription={
            search || statusFilter !== "all"
              ? "Arama veya filtre kriterlerini değiştirmeyi deneyin."
              : "Öğrenci ekleyerek başlayın."
          }
        />

        {filtered.length > 0 && filtered.length !== allItems.length && (
          <p className="text-xs text-muted-foreground">
            {allItems.length} kayıt içinde {filtered.length} sonuç gösteriliyor
          </p>
        )}
      </div>

      <StudentFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        initialData={editingStudent ?? undefined}
      />
    </>
  );
}
