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
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { SessionFormDrawer } from "@/components/sessions/SessionFormDrawer";
import { SessionDetailDrawer } from "@/components/calendar/SessionDetailDrawer";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { CalendarAgendaView } from "@/components/calendar/CalendarAgendaView";
import { useMockStore } from "@/lib/mock/store";
import { useUserScope } from "@/lib/auth/use-scope";
import { getScopedSessions, getScopedStudents, getScopedTeachers } from "@/lib/auth/scope";
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

type CalendarView = "month" | "week" | "day" | "agenda";

const VIEW_LABELS: Record<CalendarView, string> = {
  month: "Aylık",
  week: "Haftalık",
  day: "Günlük",
  agenda: "Ajanda",
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

// ─── Compact stat cell ──────────────────────────────────────────────────────────
// A single dense row of 4 cells instead of 4 tall StatCards — same information,
// far less vertical footprint, so the calendar grid starts much higher.

const COMPACT_STAT_TONES = {
  primary: "bg-primary/10 text-primary",
  warning: "bg-amber-500/10 text-amber-600",
  danger: "bg-destructive/10 text-destructive",
} as const;

function CompactStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: keyof typeof COMPACT_STAT_TONES;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-2.5">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", COMPACT_STAT_TONES[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-base font-bold leading-tight tabular-nums text-foreground">{value}</p>
      </div>
    </div>
  );
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
  const scope = useUserScope();
  const isMobile = useIsMobile();

  // Teacher: own sessions only. Guardian: linked children's sessions only.
  // Owner/manager: everyone. See lib/auth/scope.ts.
  const scopedSessions = useMemo(() => getScopedSessions(store.sessions, scope), [store.sessions, scope]);
  const scopedStudents = useMemo(
    () => getScopedStudents(store.students, store.sessions, scope),
    [store.students, store.sessions, scope]
  );
  const scopedTeachers = useMemo(() => getScopedTeachers(store.teachers, scope), [store.teachers, scope]);

  // View & navigation — initial view comes from Ayarlar → Takvim ve Çalışma
  // Saatleri's configured default (still freely switchable afterward).
  const [view, setView] = useState<CalendarView>(() => store.institutionSettings.calendar.defaultView);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());

  // Configured work-day hour range for Week/Day views — "HH:mm" strings are
  // reduced to whole hours since the grid renders one row per hour.
  const hourStart = Number(store.institutionSettings.calendar.dayStartTime.split(":")[0]);
  const hourEndRaw = store.institutionSettings.calendar.dayEndTime.split(":");
  const hourEnd = Number(hourEndRaw[0]) + (Number(hourEndRaw[1]) > 0 ? 1 : 0);

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
    () => buildCalendarEvents(scopedSessions, scopedStudents, scopedTeachers, store.educationTypes),
    [scopedSessions, scopedStudents, scopedTeachers, store.educationTypes]
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
    // scopedSessions guards this the same way handleEditFromDetail below
    // does — a session id that isn't in scope simply resolves to nothing.
    return getCalendarEventRelations(
      selectedSessionId,
      scopedSessions,
      scopedStudents,
      scopedTeachers,
      store.educationTypes,
      store.guardians
    );
  }, [selectedSessionId, scopedSessions, scopedStudents, scopedTeachers, store.guardians, store.educationTypes]);

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

  // Drill into a specific date's full list (Day view) — from Month view (a day
  // number, its empty cell area, or "+N daha") or Week view (a day header).
  // Both currentDate and view update together in this one handler so there's
  // no intermediate render showing the day view for the wrong (previous) date.
  // Active filters are untouched, so they carry straight over into Day view.
  const handleDayClick = useCallback((date: Date) => {
    setCurrentDate(date);
    setView("day");
  }, []);

  // Edit from detail drawer
  const handleEditFromDetail = useCallback(() => {
    if (!selectedSessionId) return;
    const session = scopedSessions.find((s) => s.id === selectedSessionId);
    if (session) {
      setEditingSession(session);
      setEditDrawerOpen(true);
    }
  }, [selectedSessionId, scopedSessions]);

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

  const showWeekends = store.institutionSettings.calendar.showWeekends;
  const weekDays = useMemo(() => {
    const days = getWeekDays(currentDate);
    return showWeekends ? days : days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
  }, [currentDate, showWeekends]);
  const navLabel = getNavLabel(view, currentDate);

  return (
    <>
      <div className="space-y-2.5">
        {/* Page title stays for document structure / a11y only — see PageHeader.
            No actions here: "Bugün" already lives in the toolbar's quick filters
            below, so a second copy would be redundant. */}
        <PageHeader title="Takvim" />

        {/* Compact stat strip — a single dense row instead of four tall cards,
            so the calendar itself starts much higher on the page. */}
        <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4 sm:divide-y-0">
          <CompactStat icon={CalendarDays} label="Bugünkü Seanslar" value={stats.todayCount} tone="primary" />
          <CompactStat icon={Clock} label="Bu Hafta" value={stats.weekCount} tone="primary" />
          <CompactStat icon={CalendarCheck2} label="Planlanan" value={stats.plannedCount} tone="warning" />
          <CompactStat
            icon={CalendarX2}
            label="İptal / Gelmedi"
            value={stats.cancelledCount}
            tone={stats.cancelledCount > 0 ? "danger" : "primary"}
          />
        </div>

        {/* Calendar toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View switcher */}
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            {(["month", "week", "day", "agenda"] as CalendarView[]).map((v) => (
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

          {/* Date nav — agenda shows every upcoming session flatly, not one
              date/range at a time, so prev/next don't apply to it. */}
          {view !== "agenda" && (
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
          )}

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
                {scopedTeachers.map((t) => (
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
                {scopedStudents.map((s) => (
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

        {/* Status + education-type legend — one dense row (was two stacked
            rows with a border between them) to keep the calendar higher up. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
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

          {getActiveEducationTypes(store.educationTypes).length > 0 && (
            <>
              <span className="h-3 w-px bg-border" aria-hidden />
              {getActiveEducationTypes(store.educationTypes).map((et) => (
                <div key={et.id} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: et.color }} />
                  <span className="text-xs text-muted-foreground">{et.name}</span>
                </div>
              ))}
            </>
          )}

          {filteredEvents.length < allEvents.length && (
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredEvents.length} / {allEvents.length} seans gösteriliyor
            </span>
          )}
        </div>

        {/* Calendar view — on mobile, uses Ayarlar → Takvim's configured
            mobile default (Ajanda/Günlük) instead of the picked desktop
            view, since month/week grids don't stay legible on a phone. */}
        <div key={isMobile ? "mobile" : view} className="animate-in fade-in duration-200">
          {isMobile ? (
            store.institutionSettings.calendar.mobileDefaultView === "day" ? (
              <CalendarDayView
                date={currentDate}
                events={filteredEvents}
                onEventClick={handleEventClick}
                hourStart={hourStart}
                hourEnd={hourEnd}
              />
            ) : (
              <CalendarAgendaView events={filteredEvents} onEventClick={handleEventClick} />
            )
          ) : view === "month" ? (
            <CalendarMonthView
              year={currentDate.getFullYear()}
              month={currentDate.getMonth()}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onDayClick={handleDayClick}
            />
          ) : view === "week" ? (
            <CalendarWeekView
              weekDays={weekDays}
              events={filteredEvents}
              onEventClick={handleEventClick}
              onDayHeaderClick={handleDayClick}
              hourStart={hourStart}
              hourEnd={hourEnd}
            />
          ) : view === "day" ? (
            <CalendarDayView
              date={currentDate}
              events={filteredEvents}
              onEventClick={handleEventClick}
              hourStart={hourStart}
              hourEnd={hourEnd}
            />
          ) : (
            <CalendarAgendaView events={filteredEvents} onEventClick={handleEventClick} />
          )}
        </div>
      </div>

      {/* Session detail drawer */}
      <SessionDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        relations={selectedRelations}
        onEdit={handleEditFromDetail}
        teacherEducationTypeAssignments={store.teacherEducationTypeAssignments}
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
