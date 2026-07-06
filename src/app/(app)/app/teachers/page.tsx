"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TeacherFormDrawer } from "@/components/teachers/TeacherFormDrawer";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import { buildTeacherListItems, formatCurrency } from "@/lib/helpers/finance";
import type { Teacher, TeacherListItem, TeacherStatus } from "@/types";
import { cn } from "@/lib/utils";

// ─── Status filter options ─────────────────────────────────────────────────────

const STATUS_FILTERS: { value: TeacherStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Pasif" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeachersPage() {
  const store = useMockStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherStatus | "all">("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const allItems = useMemo(
    () =>
      buildTeacherListItems(
        store.teachers,
        mockEducationTypes,
        store.sessions,
        store.teacherPayments
      ),
    [store.teachers, store.sessions, store.teacherPayments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      const matchesSearch =
        !q ||
        item.fullName.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        (item.email?.toLowerCase().includes(q) ?? false) ||
        item.specializationNames.some((s) => s.toLowerCase().includes(q));
      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allItems, search, statusFilter]);

  const activeCount = allItems.filter((t) => t.status === "active").length;

  const handleEdit = (row: TeacherListItem) => {
    const teacher = store.teachers.find((t) => t.id === row.id);
    if (teacher) {
      setEditingTeacher(teacher);
      setDrawerOpen(true);
    }
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingTeacher(null);
  };

  const columns: Column<TeacherListItem>[] = [
    {
      key: "name",
      header: "Öğretmen",
      render: (row) => (
        <Link
          href={`/app/teachers/${row.id}`}
          className="font-medium text-foreground hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {row.fullName}
        </Link>
      ),
    },
    {
      key: "phone",
      header: "Telefon",
      render: (row) => (
        <span className="tabular-nums text-xs text-muted-foreground">{row.phone}</span>
      ),
      className: "hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "email",
      header: "E-posta",
      render: (row) =>
        row.email ? (
          <span className="text-xs text-muted-foreground">{row.email}</span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "specializations",
      header: "Uzmanlık Alanları",
      render: (row) =>
        row.specializationNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.specializationNames.map((name) => (
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
      header: "Toplam Seans",
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">{row.totalSessions}</span>
      ),
      className: "hidden md:table-cell text-right",
      headerClassName: "hidden md:table-cell text-right",
    },
    {
      key: "completedSessions",
      header: "Tamamlanan",
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">{row.completedSessions}</span>
      ),
      className: "hidden lg:table-cell text-right",
      headerClassName: "hidden lg:table-cell text-right",
    },
    {
      key: "monthlyEarnings",
      header: "Aylık Hakediş",
      render: (row) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.monthlyEarnings)}
        </span>
      ),
      className: "hidden lg:table-cell text-right",
      headerClassName: "hidden lg:table-cell text-right",
    },
    {
      key: "pendingEarnings",
      header: "Bekleyen Hakediş",
      render: (row) => (
        <span
          className={cn(
            "tabular-nums font-semibold",
            row.pendingEarnings > 0 ? "text-amber-600" : "text-muted-foreground"
          )}
        >
          {formatCurrency(row.pendingEarnings)}
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
          href={`/app/teachers/${row.id}`}
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
          title="Öğretmenler"
          description={`${activeCount} aktif öğretmen · ${allItems.length} toplam`}
          actions={
            <Button size="sm" onClick={() => { setEditingTeacher(null); setDrawerOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Öğretmen Ekle
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Öğretmen, telefon veya uzmanlık ara…"
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
          keyExtractor={(t) => t.id}
          emptyTitle={
            search || statusFilter !== "all"
              ? "Eşleşen öğretmen bulunamadı"
              : "Henüz öğretmen yok"
          }
          emptyDescription={
            search || statusFilter !== "all"
              ? "Arama veya filtre kriterlerini değiştirmeyi deneyin."
              : "Öğretmen ekleyerek başlayın."
          }
        />

        {filtered.length > 0 && filtered.length !== allItems.length && (
          <p className="text-xs text-muted-foreground">
            {allItems.length} kayıt içinde {filtered.length} sonuç gösteriliyor
          </p>
        )}
      </div>

      <TeacherFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        initialData={editingTeacher ?? undefined}
      />
    </>
  );
}
