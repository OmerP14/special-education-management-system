"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, ChevronRight, Users2, Pencil, GraduationCap, UserCheck, Banknote } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CompactStatBar } from "@/components/shared/CompactStatBar";
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

function initialsOf(fullName: string): string {
  return fullName
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

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
        store.teacherEducationTypeAssignments
      ),
    [store.teachers, store.sessions, store.teacherPayments, store.teacherEducationTypeAssignments]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      const matchesSearch =
        !q ||
        item.fullName.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        (item.email?.toLowerCase().includes(q) ?? false) ||
        item.educationTypeNames.some((s) => s.toLowerCase().includes(q));
      const matchesStatus =
        statusFilter === "all" ? item.status !== "archived" : item.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allItems, search, statusFilter]);

  const activeCount = allItems.filter((t) => t.status === "active").length;
  const totalPendingEarnings = allItems.reduce((sum, t) => sum + t.pendingEarnings, 0);

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
          className="flex max-w-[180px] items-center gap-2.5 font-medium text-foreground transition-colors hover:text-primary"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
              {initialsOf(row.fullName)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{row.fullName}</span>
        </Link>
      ),
    },
    {
      key: "phone",
      header: "Telefon",
      render: (row) => (
        <span className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
          {row.phone}
        </span>
      ),
      className: "hidden md:table-cell w-[92px]",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "email",
      header: "E-posta",
      render: (row) =>
        row.email ? (
          <span className="block max-w-[140px] truncate text-xs text-muted-foreground" title={row.email}>
            {row.email}
          </span>
        ) : (
          <span className="text-muted-foreground/40">—</span>
        ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "specializations",
      header: "Eğitim Türleri",
      render: (row) =>
        row.educationTypeNames.length > 0 ? (
          <div className="flex max-w-[150px] flex-wrap gap-1">
            {row.educationTypeNames.map((name) => (
              <span
                key={name}
                className="inline-flex rounded-full bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-primary"
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
      key: "configurationStatus",
      header: "Hakediş",
      render: (row) => (
        <span
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
            row.configurationStatus === "missing_pricing" || row.configurationStatus === "no_assignment"
              ? "bg-amber-100 text-amber-700"
              : row.configurationStatus === "inactive_teacher"
              ? "bg-muted text-muted-foreground"
              : "bg-emerald-100 text-emerald-700"
          )}
        >
          {row.configurationStatusLabel}
        </span>
      ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "sessions",
      header: "Seans",
      render: (row) => (
        <span className="tabular-nums text-muted-foreground whitespace-nowrap">
          <span className="font-medium text-foreground">{row.completedSessions}</span>
          {" / "}
          {row.totalSessions}
        </span>
      ),
      className: "hidden md:table-cell text-right",
      headerClassName: "hidden md:table-cell text-right",
    },
    {
      key: "monthlyEarnings",
      header: "Aylık Hakediş",
      render: (row) => (
        <span className="tabular-nums font-medium whitespace-nowrap">
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
              "tabular-nums font-semibold whitespace-nowrap",
              row.pendingEarnings > 0 ? "text-amber-600" : "text-muted-foreground"
            )}
          >
            {formatCurrency(row.pendingEarnings)}
          </span>
          {row.unknownSessionCount > 0 && (
            <span
              className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 whitespace-nowrap"
              title={`${row.unknownSessionCount} geçmiş seansın hakedişi çözümlenmemiş`}
            >
              {row.unknownSessionCount} seans bekliyor
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
      key: "actions",
      header: "",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {row.status !== "archived" && (
            <button
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
              aria-label="Düzenle"
              title="Düzenle"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <Link
            href={`/app/teachers/${row.id}`}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-primary transition-colors"
            onClick={(e) => e.stopPropagation()}
            aria-label="Detay"
            title="Detay"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ),
      className: "text-right w-[68px]",
      headerClassName: "text-right w-[68px]",
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

        <CompactStatBar
          items={[
            { icon: GraduationCap, label: "Toplam Öğretmen", value: allItems.length, tone: "primary" },
            { icon: UserCheck, label: "Aktif", value: activeCount, tone: "success" },
            {
              icon: Banknote,
              label: "Bekleyen Hakediş",
              value: formatCurrency(totalPendingEarnings),
              tone: totalPendingEarnings > 0 ? "warning" : "success",
            },
          ]}
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
          dense
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
