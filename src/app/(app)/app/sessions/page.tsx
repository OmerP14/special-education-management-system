"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/shared/StatCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { HistoricalRecordBadge } from "@/components/shared/HistoricalRecordBadge";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { DonutChart, type DonutSegment } from "@/components/shared/DonutChart";
import { SessionFormDrawer } from "@/components/sessions/SessionFormDrawer";
import { WeeklyPlanFormDrawer } from "@/components/sessions/WeeklyPlanFormDrawer";
import { useMockStore } from "@/lib/mock/store";
import {
  buildSessionListItems,
  buildSessionPageStats,
  formatCurrency,
  formatDate,
  formatTime,
  getSessionDisplayStatus,
} from "@/lib/helpers/finance";
import type { Session, SessionListItem, SessionStatus } from "@/types";
import { cn } from "@/lib/utils";

// ─── Column definitions ────────────────────────────────────────────────────────

const columns: Column<SessionListItem>[] = [
  {
    key: "date",
    header: "Tarih",
    render: (row) => (
      <span className="tabular-nums text-sm font-medium">{formatDate(row.date)}</span>
    ),
  },
  {
    key: "time",
    header: "Saat",
    render: (row) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {formatTime(row.date)}
      </span>
    ),
    className: "hidden sm:table-cell",
    headerClassName: "hidden sm:table-cell",
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
    key: "teacher",
    header: "Öğretmen",
    render: (row) => (
      <Link
        href={`/app/teachers/${row.teacherId}`}
        className="text-muted-foreground hover:text-primary transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {row.teacherName}
      </Link>
    ),
    className: "hidden md:table-cell",
    headerClassName: "hidden md:table-cell",
  },
  {
    key: "educationType",
    header: "Eğitim Türü",
    render: (row) => (
      <span className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
        {row.educationTypeName}
      </span>
    ),
    className: "hidden lg:table-cell",
    headerClassName: "hidden lg:table-cell",
  },
  {
    key: "sessionCount",
    header: "Adet",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-center block">
        {row.sessionCount}
      </span>
    ),
    className: "hidden md:table-cell w-16 text-center",
    headerClassName: "hidden md:table-cell w-16 text-center",
  },
  {
    key: "studentPrice",
    header: "Birim Fiyat",
    render: (row) => (
      <span className="tabular-nums text-muted-foreground text-right block">
        {formatCurrency(row.studentPrice)}
      </span>
    ),
    className: "hidden xl:table-cell text-right",
    headerClassName: "hidden xl:table-cell text-right",
  },
  {
    key: "totalAmount",
    header: "Toplam Tutar",
    render: (row) => (
      <span className="tabular-nums font-semibold text-right block">
        {formatCurrency(row.totalAmount)}
      </span>
    ),
    className: "hidden sm:table-cell text-right",
    headerClassName: "hidden sm:table-cell text-right",
  },
  {
    key: "teacherEarning",
    header: "Öğretmen Hakedişi",
    render: (row) =>
      row.teacherEarningStatus === "unknown" ? (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 float-right">
          Hakediş bekliyor
        </span>
      ) : (
        <span className="tabular-nums text-amber-600 font-medium text-right block">
          {formatCurrency(row.totalTeacherEarning)}
        </span>
      ),
    className: "hidden lg:table-cell text-right",
    headerClassName: "hidden lg:table-cell text-right",
  },
  {
    key: "status",
    header: "Durum",
    render: (row) => (
      <div className="flex flex-col items-end gap-1">
        <StatusBadge status={getSessionDisplayStatus(row)} />
        {row.billingMode === "historical_non_billable" && <HistoricalRecordBadge />}
      </div>
    ),
    className: "text-right",
    headerClassName: "text-right",
  },
];

// ─── Status filter config ──────────────────────────────────────────────────────

const STATUS_FILTERS: { value: SessionStatus | "all"; label: string }[] = [
  { value: "all", label: "Tümü" },
  { value: "planned", label: "Planlandı" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal" },
  { value: "no_show", label: "Gelmedi" },
  { value: "makeup", label: "Telafi" },
];

// ─── Month label helper ────────────────────────────────────────────────────────

function monthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" }).format(
    new Date(Number(y), Number(m) - 1, 1)
  );
}

// ─── Status donut colors (mirrors StatusBadge's session status palette) ───────

const STATUS_DONUT_COLORS = {
  completed: "#10b981", // emerald-500
  planned: "#3b82f6", // blue-500
  makeup: "#a855f7", // purple-500
  cancelledAndNoShow: "#f87171", // red-400
} as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

// useSearchParams requires a Suspense boundary around any static page that calls it,
// otherwise production builds fail — the actual page content lives in the inner
// component below, wrapped by the default export.
export default function SessionsPage() {
  return (
    <Suspense fallback={null}>
      <SessionsPageContent />
    </Suspense>
  );
}

function SessionsPageContent() {
  const store = useMockStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [weeklyPlanOpen, setWeeklyPlanOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [edTypeFilter, setEdTypeFilter] = useState("all");

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const stats = useMemo(
    () => buildSessionPageStats(store.sessions, currentYear, currentMonth),
    [store.sessions, currentYear, currentMonth]
  );

  const statusDonutSegments: DonutSegment[] = useMemo(
    () => [
      {
        key: "completed",
        label: "Tamamlandı",
        value: stats.completed,
        color: STATUS_DONUT_COLORS.completed,
      },
      {
        key: "planned",
        label: "Planlandı",
        value: stats.planned,
        color: STATUS_DONUT_COLORS.planned,
      },
      {
        key: "makeup",
        label: "Telafi",
        value: stats.makeup,
        color: STATUS_DONUT_COLORS.makeup,
      },
      {
        key: "cancelledAndNoShow",
        label: "İptal / Gelmedi",
        value: stats.cancelledAndNoShow,
        color: STATUS_DONUT_COLORS.cancelledAndNoShow,
      },
    ],
    [stats.completed, stats.planned, stats.makeup, stats.cancelledAndNoShow]
  );

  const allItems = useMemo(
    () =>
      buildSessionListItems(
        store.sessions,
        store.students,
        store.teachers,
        store.educationTypes,
        store.teacherEducationTypeAssignments
      ),
    [store.sessions, store.students, store.teachers, store.teacherEducationTypeAssignments]
  );

  const handleEdit = (row: SessionListItem) => {
    const session = store.sessions.find((s) => s.id === row.id);
    if (session) {
      setEditingSession(session);
      setDrawerOpen(true);
    }
  };

  const handleDrawerClose = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setEditingSession(null);
  };

  // Deep-link support: "Son Seanslar" on the Dashboard links here with ?sessionId=,
  // since there's no dedicated /app/sessions/[id] route — this opens that session's
  // edit drawer directly, then strips the param so it doesn't re-trigger on refresh.
  useEffect(() => {
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return;
    const session = store.sessions.find((s) => s.id === sessionId);
    if (session) {
      setEditingSession(session);
      setDrawerOpen(true);
    }
    router.replace("/app/sessions");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const editColumnEntry: Column<SessionListItem> = {
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

  const columnsWithEdit: Column<SessionListItem>[] = [...columns, editColumnEntry];

  // Derive available months from data (newest first)
  const monthOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [
      { value: "all", label: "Tüm Aylar" },
    ];
    [...allItems]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((item) => {
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
        item.teacherName.toLowerCase().includes(q) ||
        item.educationTypeName.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || item.status === statusFilter;
      const matchMonth =
        monthFilter === "all" || monthKey(new Date(item.date)) === monthFilter;
      const matchTeacher = teacherFilter === "all" || item.teacherId === teacherFilter;
      const matchStudent = studentFilter === "all" || item.studentId === studentFilter;
      const matchEdType = edTypeFilter === "all" || item.educationTypeId === edTypeFilter;
      return (
        matchSearch && matchStatus && matchMonth && matchTeacher && matchStudent && matchEdType
      );
    });
  }, [allItems, search, statusFilter, monthFilter, teacherFilter, studentFilter, edTypeFilter]);

  const hasActiveFilters =
    search ||
    statusFilter !== "all" ||
    monthFilter !== "all" ||
    teacherFilter !== "all" ||
    studentFilter !== "all" ||
    edTypeFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setMonthFilter("all");
    setTeacherFilter("all");
    setStudentFilter("all");
    setEdTypeFilter("all");
  };

  const thisMonthLabel = monthLabel(monthKey(now));

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Seanslar"
          description={`${allItems.length} toplam seans · ${thisMonthLabel}`}
          actions={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWeeklyPlanOpen(true)}
              >
                <CalendarClock className="h-3.5 w-3.5 mr-1" />
                Haftalık Plan
              </Button>
              <Button size="sm" onClick={() => { setEditingSession(null); setDrawerOpen(true); }}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Seans Ekle
              </Button>
            </div>
          }
        />

        {/* KPI cards — always this month */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Bu Ay Toplam Seans"
            value={stats.total}
            description={thisMonthLabel}
            icon={CalendarDays}
            variant="default"
          />
          <StatCard
            title="Tamamlanan"
            value={stats.completed}
            description="Kazanç yaratan"
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="Bekleyen"
            value={stats.planned}
            description="Planlandı"
            icon={Clock}
            variant="warning"
          />
          <StatCard
            title="İptal / Gelmedi"
            value={stats.cancelledAndNoShow}
            description="İptal + no-show"
            icon={XCircle}
            variant={stats.cancelledAndNoShow > 0 ? "danger" : "default"}
          />
        </div>

        {/* Status breakdown donut */}
        <div className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {thisMonthLabel} Dağılımı
          </p>
          <DonutChart segments={statusDonutSegments} centerUnitLabel="Seans" />
        </div>

        {/* Filter bar */}
        <div className="space-y-3">
          {/* Row 1: search + month dropdown */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Öğrenci, öğretmen veya eğitim türü ara…"
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

          {/* Row 2: status pills */}
          <div className="flex flex-wrap gap-1.5">
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

          {/* Row 3: entity dropdowns */}
          <div className="flex flex-wrap gap-2">
            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Tüm Öğretmenler</option>
              {store.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
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
            <select
              value={edTypeFilter}
              onChange={(e) => setEdTypeFilter(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Tüm Eğitim Türleri</option>
              {store.educationTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.name}
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

        {/* Table */}
        <DataTable
          data={filtered}
          columns={columnsWithEdit}
          keyExtractor={(s) => s.id}
          emptyTitle={hasActiveFilters ? "Eşleşen seans bulunamadı" : "Henüz seans yok"}
          emptyDescription={
            hasActiveFilters
              ? "Arama veya filtre kriterlerini değiştirmeyi deneyin."
              : "Seans ekleyerek başlayın."
          }
        />

        {/* Result count */}
        {filtered.length > 0 && filtered.length !== allItems.length && (
          <p className="text-xs text-muted-foreground">
            {allItems.length} kayıt içinde{" "}
            <span className="font-medium text-foreground">{filtered.length}</span> seans
            gösteriliyor
          </p>
        )}
      </div>

      <SessionFormDrawer
        open={drawerOpen}
        onOpenChange={handleDrawerClose}
        initialData={editingSession ?? undefined}
      />
      <WeeklyPlanFormDrawer
        open={weeklyPlanOpen}
        onOpenChange={setWeeklyPlanOpen}
      />
    </>
  );
}
