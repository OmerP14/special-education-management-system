"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EducationTypeFormDrawer } from "@/components/settings/EducationTypeFormDrawer";
import { useMockStore } from "@/lib/mock/store";
import {
  getEducationTypeUsage,
  canDeleteEducationType,
  EDUCATION_TYPE_DELETE_BLOCKED_MESSAGE,
  getReadableTextColor,
  type EducationTypeUsage,
} from "@/lib/helpers/education-types";
import { formatCurrency } from "@/lib/helpers/finance";
import type { EducationType, EducationTypeStatus } from "@/types";
import { cn } from "@/lib/utils";

// ─── Status filter options ─────────────────────────────────────────────────────

const STATUS_FILTERS: { value: EducationTypeStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Pasif" },
];

interface EducationTypeRow extends EducationType {
  usage: EducationTypeUsage;
}

function usageBreakdownText(usage: EducationTypeUsage): string {
  const parts = [
    `${usage.sessions} seans`,
    `${usage.students} öğrenci`,
    `${usage.teachers} öğretmen`,
    `${usage.weeklyPlans} haftalık plan`,
    `${usage.assignments} öğretmen ataması`,
  ];
  return parts.join(" · ");
}

export default function EducationTypesSettingsPage() {
  const store = useMockStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EducationTypeStatus | "all">("all");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingType, setEditingType] = useState<EducationType | null>(null);

  const rows: EducationTypeRow[] = useMemo(
    () =>
      store.educationTypes.map((et) => ({
        ...et,
        usage: getEducationTypeUsage(et.id, {
          sessions: store.sessions,
          students: store.students,
          teachers: store.teachers,
          weeklySessionPlans: store.weeklySessionPlans,
          teacherEducationTypeAssignments: store.teacherEducationTypeAssignments,
        }),
      })),
    [
      store.educationTypes,
      store.sessions,
      store.students,
      store.teachers,
      store.weeklySessionPlans,
      store.teacherEducationTypeAssignments,
    ]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");
    return rows.filter((row) => {
      const matchesSearch = !q || row.name.toLocaleLowerCase("tr-TR").includes(q);
      const matchesStatus = statusFilter === "all" || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const activeCount = rows.filter((r) => r.status === "active").length;

  const handleEdit = (row: EducationTypeRow) => {
    setEditingType(row);
    setDrawerOpen(true);
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingType(null);
  };

  const handleToggleStatus = (row: EducationTypeRow) => {
    store.setEducationTypeStatus(row.id, row.status === "active" ? "inactive" : "active");
  };

  const handleDelete = (row: EducationTypeRow) => {
    if (!canDeleteEducationType(row.usage)) return;
    store.deleteEducationType(row.id);
  };

  const columns: Column<EducationTypeRow>[] = [
    {
      key: "name",
      header: "Eğitim Türü",
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
            style={{ backgroundColor: row.color }}
          />
          <div>
            <p className="font-medium text-foreground">{row.name}</p>
            {row.description && (
              <p className="text-xs text-muted-foreground">{row.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "duration",
      header: "Varsayılan Süre",
      render: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {row.defaultDurationMinutes} dk
        </span>
      ),
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
    {
      key: "price",
      header: "Varsayılan Öğrenci Ücreti",
      render: (row) => (
        <span className="tabular-nums font-medium">
          {formatCurrency(row.defaultStudentPrice)}
        </span>
      ),
      className: "hidden md:table-cell text-right",
      headerClassName: "hidden md:table-cell text-right",
    },
    {
      key: "color",
      header: "Renk",
      render: (row) => (
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: row.color, color: getReadableTextColor(row.color) }}
        >
          {row.color}
        </span>
      ),
      className: "hidden lg:table-cell",
      headerClassName: "hidden lg:table-cell",
    },
    {
      key: "status",
      header: "Durum",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "usage",
      header: "Kullanım",
      render: (row) => (
        <Tooltip>
          <TooltipTrigger className="inline-flex bg-transparent p-0 border-0">
            <span className="tabular-nums text-sm font-medium text-foreground underline decoration-dotted underline-offset-4 cursor-help">
              {row.usage.total}
            </span>
          </TooltipTrigger>
          <TooltipContent>{usageBreakdownText(row.usage)}</TooltipContent>
        </Tooltip>
      ),
      className: "hidden sm:table-cell",
      headerClassName: "hidden sm:table-cell",
    },
    {
      key: "actions",
      header: "İşlemler",
      render: (row) => {
        const deletable = canDeleteEducationType(row.usage);
        return (
          <div className="flex items-center justify-end gap-3">
            <button
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
            >
              Düzenle
            </button>
            <button
              className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
              onClick={(e) => { e.stopPropagation(); handleToggleStatus(row); }}
            >
              {row.status === "active" ? "Pasife Al" : "Aktife Al"}
            </button>
            {deletable ? (
              <button
                className="text-xs font-medium text-destructive/80 hover:text-destructive transition-colors"
                onClick={(e) => { e.stopPropagation(); handleDelete(row); }}
              >
                Sil
              </button>
            ) : (
              <Tooltip>
                <TooltipTrigger className="inline-flex bg-transparent p-0 border-0">
                  <span className="text-xs font-medium text-muted-foreground/40 cursor-not-allowed">
                    Sil
                  </span>
                </TooltipTrigger>
                <TooltipContent>{EDUCATION_TYPE_DELETE_BLOCKED_MESSAGE}</TooltipContent>
              </Tooltip>
            )}
          </div>
        );
      },
      className: "text-right",
      headerClassName: "text-right",
    },
  ];

  return (
    <>
      <div className="space-y-5">
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Ayarlar
        </Link>

        <PageHeader
          title="Eğitim Türleri"
          description={`Kurumun sunduğu eğitim türlerini yönetin. ${activeCount} aktif · ${rows.length} toplam.`}
          actions={
            <Button size="sm" onClick={() => { setEditingType(null); setDrawerOpen(true); }}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Eğitim Türü Ekle
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="max-w-xs flex-1">
            <Input
              placeholder="Eğitim türü ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-sm"
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
          keyExtractor={(et) => et.id}
          emptyTitle={
            search || statusFilter !== "all"
              ? "Eşleşen eğitim türü bulunamadı"
              : "Henüz eğitim türü yok"
          }
          emptyDescription={
            search || statusFilter !== "all"
              ? "Arama veya filtre kriterlerini değiştirmeyi deneyin."
              : "Eğitim türü ekleyerek başlayın."
          }
        />
      </div>

      <EducationTypeFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        initialData={editingType ?? undefined}
      />
    </>
  );
}
