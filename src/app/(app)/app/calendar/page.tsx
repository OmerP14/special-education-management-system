"use client";

import { useState, useMemo, useCallback } from "react";
import {
  CalendarDays,
  CalendarCheck2,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Clock,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/shared/StatCard";
import { Button } from "@/components/ui/button";
import { SessionFormDrawer } from "@/components/sessions/SessionFormDrawer";
import { SessionDetailDrawer } from "@/components/calendar/SessionDetailDrawer";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { CalendarAgendaView } from "@/components/calendar/CalendarAgendaView";
import { useMockStore } from "@/lib/mock/store";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  buildCalendarEvents,
  buildCalendarStats,
  getCalendarEventRelations,
  getWeekDays,
} from "@/lib/helpers/calendar";
import { getActiveEducationTypes } from "@/lib/helpers/education-types";
import type { Session, SessionStatus } from "@/types";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type CalendarView = "month" | "week" | "day";

const VIEW_LABELS: Record<CalendarView, string> = {
  month: "Aylık",
  week: "Haftalık",
  day: "Günlük",
};

const STATUS_FILTER_OPTIONS: { value: SessionStatus | "all"; label: string }[] = [
  { value: "all", label: "Tüm Durumlar" },
  { value: "planned", label: "Planlandı" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal" },
  { value: "no_show", label: "Gelmedi" },
  { value: "makeup", label: "Telafi" },
];

// ─── Date nav label ────────────────────────────────────────────────────────────

function getNavLabel(view: CalendarView, date: Date): string {
  if (view === "month") {
    return new Intl.DateTimeFormat("tr-TR", {
      month: "long",
      year: "numeric",
    }).format(date);
  }
  if (view === "day") {
    return new Intl.DateTimeFormat("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }
  // week
  const days = getWeekDays(date);
  const first = days[0]!;
  const last = days[6]!;
  const sameMonth = first.getMonth() === last.getMonth();
  if (sameMonth) {
    return `${first.getDate()}–${last.getDate()} ${new Intl.DateTimeFormat("tr-TR", {
      month: "long",
      year: "numeric",
    }).format(first)}`;
  }
  return `${new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
  }).format(first)} – ${new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(last)}`;
}

// ─── Chip filter button ────────────────────────────────────────────────────────

function ChipButton({
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

export default function CalendarPage() {
  const store = useMockStore();
  const isMobile = useIsMobile();

  // View & navigation
  const [view, setView] = useState<CalendarView>("week");
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Filters
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [edTypeFilter, setEdTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  // Selected session for detail / edit
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);

  // Build calendar events
  const allEvents = useMemo(
    () =>
      buildCalendarEvents(
        store.sessions,
        store.students,
        store.teachers,
        store.educationTypes
      ),
    [store.sessions, store.students, store.teachers, store.educationTypes]
  );

  // Apply filters
  const filteredEvents = useMemo(() => {
    return allEvents.filter((e) => {
      if (teacherFilter !== "all" && e.teacherId !== teacherFilter) return false;
      if (studentFilter !== "all" && e.studentId !== studentFilter) return false;
      if (edTypeFilter !== "all" && e.educationTypeId !== edTypeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [allEvents, teacherFilter, studentFilter, edTypeFilter, statusFilter]);

  // Stats (always from all events so stats cards are context-aware)
  const today = useMemo(() => new Date(), []);
  const stats = useMemo(
    () => buildCalendarStats(filteredEvents, today),
    [filteredEvents, today]
  );

  // Relations for selected session
  const selectedRelations = useMemo(() => {
    if (!selectedSessionId) return null;
    return getCalendarEventRelations(
      selectedSessionId,
      store.sessions,
      store.students,
      store.teachers,
      store.educationTypes,
      store.guardians
    );
  }, [selectedSessionId, store.sessions, store.students, store.teachers, store.guardians, store.educationTypes]);

  // Navigation
  const navigate = useCallback(
    (direction: "prev" | "next") => {
      const d = new Date(currentDate);
      const delta = direction === "next" ? 1 : -1;
      if (view === "month") d.setMonth(d.getMonth() + delta);
      else if (view === "week") d.setDate(d.getDate() + delta * 7);
      else d.setDate(d.getDate() + delta);
      setCurrentDate(d);
    },
    [currentDate, view]
  );

  const goToday = () => {
    setCurrentDate(new Date());
  };

  // Quick filters
  const goThisWeek = () => {
    setCurrentDate(new Date());
    setView("week");
  };

  const goThisMonth = () => {
    setCurrentDate(new Date());
    setView("month");
  };

  // Event click
  const handleEventClick = useCallback(
    (eventId: string) => {
      setSelectedSessionId(eventId);
      setDetailOpen(true);
    },
    []
  );

  // Month view "+N daha" → drill into that day's full list (Day view), never hidden
  const handleShowMore = useCallback((date: Date) => {
    setCurrentDate(date);
    setView("day");
  }, []);

  // Edit from detail drawer
  const handleEditFromDetail = useCallback(() => {
    if (!selectedSessionId) return;
    const session = store.sessions.find((s) => s.id === selectedSessionId);
    if (session) {
      setEditingSession(session);
      setEditDrawerOpen(true);
    }
  }, [selectedSessionId, store.sessions]);

  const handleEditDrawerClose = (open: boolean) => {
    setEditDrawerOpen(open);
    if (!open) setEditingSession(null);
  };

  // Filter state
  const hasActiveFilters =
    teacherFilter !== "all" ||
    studentFilter !== "all" ||
    edTypeFilter !== "all" ||
    statusFilter !== "all";

  const clearFilters = () => {
    setTeacherFilter("all");
    setStudentFilter("all");
    setEdTypeFilter("all");
    setStatusFilter("all");
  };

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const navLabel = getNavLabel(view, currentDate);

  return (
    <>
      <div className="space-y-5">
        {/* Page header */}
        <PageHeader
          title="Takvim"
          description="Seansları gün, hafta ve aylık görünümde takip edin."
          actions={
            <Button
              size="sm"
              variant="outline"
              onClick={goToday}
            >
              Bugün
            </Button>
          }
        />

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Bugünkü Seanslar"
            value={stats.todayCount}
            description="Bugün planlanmış"
            icon={CalendarDays}
            variant="default"
          />
          <StatCard
            title="Bu Hafta"
            value={stats.weekCount}
            description="Haftalık toplam"
            icon={Clock}
            variant="default"
          />
          <StatCard
            title="Planlanan"
            value={stats.plannedCount}
            description="Bekleyen seanslar"
            icon={CalendarCheck2}
            variant="warning"
          />
          <StatCard
            title="İptal / Gelmedi"
            value={stats.cancelledCount}
            description="Bu dönemde"
            icon={CalendarX2}
            variant={stats.cancelledCount > 0 ? "danger" : "default"}
          />
        </div>

        {/* Calendar toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            {(["month", "week", "day"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                )}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {/* Date nav */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => navigate("prev")}
              aria-label="Önceki"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="min-w-[160px] text-center text-sm font-semibold text-foreground capitalize px-2">
              {navLabel}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => navigate("next")}
              aria-label="Sonraki"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Quick filters */}
          <div className="flex gap-1 ml-auto">
            <ChipButton active={false} onClick={goToday}>
              Bugün
            </ChipButton>
            <ChipButton active={false} onClick={goThisWeek}>
              Bu Hafta
            </ChipButton>
            <ChipButton active={false} onClick={goThisMonth}>
              Bu Ay
            </ChipButton>
          </div>

          {/* Filter toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((p) => !p)}
            className={cn(hasActiveFilters && "border-primary text-primary")}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Filtrele
            {hasActiveFilters && (
              <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {[teacherFilter, studentFilter, edTypeFilter, statusFilter].filter(
                  (f) => f !== "all"
                ).length}
              </span>
            )}
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Filtreler
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:text-destructive/80"
                >
                  <X className="h-3 w-3" />
                  Temizle
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Status pills */}
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <ChipButton
                  key={opt.value}
                  active={statusFilter === opt.value}
                  onClick={() =>
                    setStatusFilter(
                      statusFilter === opt.value ? "all" : opt.value
                    )
                  }
                >
                  {opt.label}
                </ChipButton>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              {/* Teacher dropdown */}
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

              {/* Student dropdown */}
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

              {/* Education type dropdown */}
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
            </div>
          </div>
        )}

        {/* Status legend */}
        <div className="flex flex-wrap items-center gap-3">
          {(
            [
              { status: "planned", label: "Planlandı", color: "bg-blue-500" },
              { status: "completed", label: "Tamamlandı", color: "bg-emerald-500" },
              { status: "cancelled", label: "İptal", color: "bg-gray-400" },
              { status: "no_show", label: "Gelmedi", color: "bg-red-500" },
              { status: "makeup", label: "Telafi", color: "bg-purple-500" },
            ] as { status: string; label: string; color: string }[]
          ).map(({ status, label, color }) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", color)} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
          {filteredEvents.length < allEvents.length && (
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredEvents.length} / {allEvents.length} seans gösteriliyor
            </span>
          )}
        </div>

        {/* Education type legend — the colored accent on each session card */}
        {getActiveEducationTypes(store.educationTypes).length > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-3">
            {getActiveEducationTypes(store.educationTypes).map((et) => (
              <div key={et.id} className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: et.color }}
                />
                <span className="text-xs text-muted-foreground">{et.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Calendar view — always agenda on mobile */}
        {isMobile ? (
          <CalendarAgendaView
            events={filteredEvents}
            onEventClick={handleEventClick}
          />
        ) : view === "month" ? (
          <CalendarMonthView
            year={currentDate.getFullYear()}
            month={currentDate.getMonth()}
            events={filteredEvents}
            onEventClick={handleEventClick}
            onShowMore={handleShowMore}
          />
        ) : view === "week" ? (
          <CalendarWeekView
            weekDays={weekDays}
            events={filteredEvents}
            onEventClick={handleEventClick}
          />
        ) : (
          <CalendarDayView
            date={currentDate}
            events={filteredEvents}
            onEventClick={handleEventClick}
          />
        )}
      </div>

      {/* Session detail drawer */}
      <SessionDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        relations={selectedRelations}
        onEdit={handleEditFromDetail}
        teacherCustomPrices={store.teacherCustomPrices}
      />

      {/* Session edit form drawer */}
      <SessionFormDrawer
        open={editDrawerOpen}
        onOpenChange={handleEditDrawerClose}
        initialData={editingSession ?? undefined}
      />
    </>
  );
}
