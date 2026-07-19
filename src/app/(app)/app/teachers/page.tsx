"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, ChevronRight, Users2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TeacherFormDrawer } from "@/components/teachers/TeacherFormDrawer";
import { TeacherMergeDrawer } from "@/components/teachers/TeacherMergeDrawer";
import { useMockStore } from "@/lib/mock/store";
import {
  buildTeacherListItems,
  findLikelyDuplicateTeachers,
  formatCurrency,
  type DuplicateTeacherCandidate,
} from "@/lib/helpers/finance";
import type { Teacher, TeacherListItem, TeacherStatus } from "@/types";
import { cn } from "@/lib/utils";

// ─── Status filter options ─────────────────────────────────────────────────────
// "all" deliberately excludes archived (merged-away) teachers — they're only
// ever visible via the explicit "Arşivlenmiş" filter (Teacher Merge requirement:
// hidden from the normal list, visible only in the Archived filter).

const STATUS_FILTERS: { value: TeacherStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Pasif" },
  { value: "archived", label: "Arşivlenmiş" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeachersPage() {
  const store = useMockStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TeacherStatus | "all">("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [mergeQueue, setMergeQueue] = useState<DuplicateTeacherCandidate[]>([]);
  const [mergeDrawerOpen, setMergeDrawerOpen] = useState(false);

  const allItems = useMemo(
    () =>
      buildTeacherListItems(
        store.teachers,
        store.educationTypes,
        store.sessions,
        store.teacherPayments,
        store.teacherCustomPrices
      ),
    [store.teachers, store.sessions, store.teacherPayments, store.teacherCustomPrices]
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
        statusFilter === "all" ? item.status !== "archived" : item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allItems, search, statusFilter]);

  const activeCount = allItems.filter((t) => t.status === "active").length;

  // Read-only advisory — never merges/transfers/deletes anything (Part 4).
  // See findLikelyDuplicateTeachers's own doc comment for why "EKREM" vs
  // "EKREM H" style pairs occur from import name normalization.
  const duplicateCandidates = useMemo(
    () => findLikelyDuplicateTeachers(store.teachers, store.sessions),
    [store.teachers, store.sessions]
  );

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

  // "İncele" and "Birleştir" both open the same drawer — the drawer itself IS the
  // review screen (full preview + conflict check before anything is confirmed),
  // so a separate read-only view would just duplicate that UI. Bulk "Tümünü
  // İncele" opens the same drawer with every candidate queued — see its own doc
  // comment for why that never auto-merges.
  const openMergeDrawer = (candidate: DuplicateTeacherCandidate) => {
    setMergeQueue([candidate]);
    setMergeDrawerOpen(true);
  };
  const openMergeReviewAll = () => {
    setMergeQueue(duplicateCandidates);
    setMergeDrawerOpen(true);
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
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={cn(
              "tabular-nums font-semibold",
              row.pendingEarnings > 0 ? "text-amber-600" : "text-muted-foreground"
            )}
          >
            {formatCurrency(row.pendingEarnings)}
          </span>
          {row.unknownSessionCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
              Hakediş ayarı bekleniyor — {row.unknownSessionCount} seans
            </span>
          )}
        </div>
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
      render: (row) =>
        row.status === "archived" ? (
          <span className="text-xs text-muted-foreground/30">—</span>
        ) : (
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

        {/* Likely-duplicate teacher advisory. Suggestions only — nothing here
            merges/deletes by itself; every merge still goes through the full
            preview/conflict/confirm drawer. See findLikelyDuplicateTeachers in
            finance.ts. */}
        {duplicateCandidates.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users2 className="h-4 w-4 text-amber-700 shrink-0" />
                <p className="text-sm font-semibold text-amber-800">
                  Olası Yinelenen Öğretmen Kayıtları
                </p>
              </div>
              {duplicateCandidates.length > 1 && (
                <button
                  onClick={openMergeReviewAll}
                  className="text-xs font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900 shrink-0"
                >
                  Tümünü İncele ({duplicateCandidates.length})
                </button>
              )}
            </div>
            <div className="space-y-1.5">
              {duplicateCandidates.map((c) => (
                <div
                  key={`${c.teacherA.id}-${c.teacherB.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800"
                >
                  <span>
                    <Link href={`/app/teachers/${c.teacherA.id}`} className="font-medium underline underline-offset-2 hover:text-amber-900">
                      {c.teacherA.fullName}
                    </Link>{" "}
                    ({c.teacherASessionCount} seans) ile{" "}
                    <Link href={`/app/teachers/${c.teacherB.id}`} className="font-medium underline underline-offset-2 hover:text-amber-900">
                      {c.teacherB.fullName}
                    </Link>{" "}
                    ({c.teacherBSessionCount} seans) aynı kişi olabilir.
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openMergeDrawer(c)}
                      className="font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
                    >
                      İncele
                    </button>
                    <button
                      onClick={() => openMergeDrawer(c)}
                      className="font-medium text-amber-900 underline underline-offset-2 hover:text-amber-950"
                    >
                      Birleştir
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-amber-700">
              Bu yalnızca bir öneridir — kayıtlar otomatik birleştirilmez veya silinmez.
              &quot;Birleştir&quot; ile açılan ekranda taşınacak kayıtları ve olası çakışmaları
              onaylamadan hiçbir veri değişmez.
            </p>
          </div>
        )}

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

      <TeacherMergeDrawer
        open={mergeDrawerOpen}
        onOpenChange={setMergeDrawerOpen}
        queue={mergeQueue}
      />
    </>
  );
}
