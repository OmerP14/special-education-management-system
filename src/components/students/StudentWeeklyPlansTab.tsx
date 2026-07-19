"use client";

import { useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  Pencil,
  Pause,
  Play,
  Copy,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { WeeklyPlanFormDrawer } from "@/components/sessions/WeeklyPlanFormDrawer";
import { ExtendPlanDrawer } from "@/components/sessions/ExtendPlanDrawer";
import { useMockStore } from "@/lib/mock/store";
import { formatDate, formatCurrency } from "@/lib/helpers/finance";
import {
  computeWeeklyPlanStatus,
  computeWeeklyPlanSessionStats,
  type WeeklyPlanStatus,
} from "@/lib/helpers/weekly-plans";
import type { WeeklySessionPlan } from "@/types";
import { cn } from "@/lib/utils";

// ─── Plan status badge config ──────────────────────────────────────────────────

const PLAN_STATUS_CONFIG: Record<WeeklyPlanStatus, { label: string; className: string }> = {
  active: {
    label: "Aktif",
    className:
      "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800",
  },
  paused: {
    label: "Durduruldu",
    className:
      "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
  },
  completed: {
    label: "Tamamlandı",
    className:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700",
  },
};

// ─── Day names ────────────────────────────────────────────────────────────────

const DAY_NAMES: Record<number, string> = {
  0: "Pazar",
  1: "Pazartesi",
  2: "Salı",
  3: "Çarşamba",
  4: "Perşembe",
  5: "Cuma",
  6: "Cumartesi",
};

// ─── Confirm banner ───────────────────────────────────────────────────────────

function ConfirmBanner({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-3 mt-3">
      <p className="text-sm text-destructive font-medium">{message}</p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" onClick={onConfirm} className="h-7 text-xs">
          Evet, Sil
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} className="h-7 text-xs">
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function StatCell({ label, value, colorClass }: { label: string; value: number; colorClass?: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      <p className={cn("text-base font-bold tabular-nums", colorClass ?? "text-foreground")}>{value}</p>
    </div>
  );
}

function PlanCard({
  plan,
  onEdit,
  onToggleActive,
  onCopy,
  onExtend,
  onDelete,
}: {
  plan: WeeklySessionPlan;
  onEdit: () => void;
  onToggleActive: () => void;
  onCopy: () => void;
  onExtend: () => void;
  onDelete: () => void;
}) {
  const store = useMockStore();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const now = new Date();
  const teacher = store.teachers.find((t) => t.id === plan.teacherId);
  const educationType = store.educationTypes.find((et) => et.id === plan.educationTypeId);

  const status = computeWeeklyPlanStatus(plan, now);
  const statusConfig = PLAN_STATUS_CONFIG[status];
  const stats = computeWeeklyPlanSessionStats(plan.id, store.sessions, now);

  const planSessions = store.sessions.filter((s) => s.weeklyPlanId === plan.id);
  const nextSession = planSessions
    .filter((s) => s.status === "planned" && new Date(s.date) > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;

  const sortedSlots = [...plan.weeklySchedule].sort((a, b) => {
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.indexOf(a.dayOfWeek) - order.indexOf(b.dayOfWeek);
  });

  return (
    <div
      className={cn(
        "rounded-xl border bg-card overflow-hidden",
        status === "active" ? "border-border" : "border-border/40 opacity-80"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/60 bg-muted/20">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold border", statusConfig.className)}>
              {statusConfig.label}
            </span>
            {educationType && (
              <span className="inline-flex rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-medium text-primary">
                {educationType.name}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold text-foreground">{teacher?.fullName ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatDate(plan.startDate + "T00:00:00")} — {formatDate(plan.endDate + "T00:00:00")}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Düzenle"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Planı Uzat"
            onClick={onExtend}
          >
            <CalendarPlus className="h-3.5 w-3.5" />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={plan.isActive ? "Planı Durdur" : "Planı Devam Ettir"}
            onClick={onToggleActive}
          >
            {plan.isActive ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Planı Kopyala"
            onClick={onCopy}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Planı Sil"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Haftalık Program
        </p>
        <div className="flex flex-wrap gap-2">
          {sortedSlots.map((slot) => (
            <div
              key={slot.dayOfWeek}
              className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-2.5 py-1.5"
            >
              <span className="text-xs font-semibold text-primary">{DAY_NAMES[slot.dayOfWeek]}</span>
              <ChevronRight className="h-3 w-3 text-primary/50" />
              <span className="text-xs text-muted-foreground font-medium">{slot.time}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Seans Ücreti: <span className="font-medium text-foreground">{formatCurrency(plan.studentPrice)}</span>
          {" · "}Öğretmen Hakedişi: <span className="font-medium text-foreground">{formatCurrency(plan.teacherEarning)}</span>
        </p>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-x-3 gap-y-3 pt-3 border-t border-border/60">
          <StatCell label="Toplam" value={stats.total} />
          <StatCell label="Tamamlanan" value={stats.completed} colorClass="text-emerald-600" />
          <StatCell label="Planlanan" value={stats.planned} colorClass="text-blue-600" />
          <StatCell label="Kalan" value={stats.remaining} />
          {stats.inProgress > 0 && (
            <StatCell label="Devam Ediyor" value={stats.inProgress} colorClass="text-orange-600" />
          )}
          <StatCell label="İptal" value={stats.cancelled} colorClass="text-gray-500" />
          <StatCell label="Gelmedi" value={stats.noShow} colorClass="text-red-600" />
          <StatCell label="Telafi" value={stats.makeup} colorClass="text-purple-600" />
        </div>

        {/* Next session */}
        {nextSession && (
          <div className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2">
            <CalendarClock className="h-3.5 w-3.5 text-primary shrink-0" />
            <p className="text-xs text-foreground">
              <span className="font-medium">Sonraki seans:</span>{" "}
              {formatDate(nextSession.date)} —{" "}
              {new Date(nextSession.date).toLocaleTimeString("tr-TR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}

        {plan.notes && (
          <p className="text-xs text-muted-foreground italic">{plan.notes}</p>
        )}

        {confirmDelete && (
          <ConfirmBanner
            message="Bu planı silmek üzeresiniz. Tamamlanmış seanslar korunacak, yalnızca gelecekteki Planlandı durumundaki seanslar silinecektir."
            onConfirm={() => { setConfirmDelete(false); onDelete(); }}
            onCancel={() => setConfirmDelete(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Drawer state ─────────────────────────────────────────────────────────────

type DrawerMode = "new" | "edit" | "copy";

// ─── Main tab ─────────────────────────────────────────────────────────────────

export function StudentWeeklyPlansTab({ studentId }: { studentId: string }) {
  const store = useMockStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("new");
  const [activePlan, setActivePlan] = useState<WeeklySessionPlan | undefined>(undefined);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendPlan, setExtendPlan] = useState<WeeklySessionPlan | undefined>(undefined);

  const plans = store.weeklySessionPlans
    .filter((p) => p.studentId === studentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const openDrawer = (mode: DrawerMode, plan?: WeeklySessionPlan) => {
    setDrawerMode(mode);
    setActivePlan(plan);
    setDrawerOpen(true);
  };

  const closeDrawer = (open: boolean) => {
    setDrawerOpen(open);
    if (!open) setActivePlan(undefined);
  };

  const openExtendDrawer = (plan: WeeklySessionPlan) => {
    setExtendPlan(plan);
    setExtendOpen(true);
  };

  const closeExtendDrawer = (open: boolean) => {
    setExtendOpen(open);
    if (!open) setExtendPlan(undefined);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Haftalık Seans Planları</p>
            {plans.length > 0 && (
              <p className="text-xs text-muted-foreground">{plans.length} plan tanımlı</p>
            )}
          </div>
          <Button size="sm" onClick={() => openDrawer("new")}>
            <CalendarClock className="h-3.5 w-3.5 mr-1.5" />
            Yeni Plan
          </Button>
        </div>

        {plans.length === 0 ? (
          <EmptyState
            title="Henüz seans planı yok"
            description="Haftalık seans planı oluşturarak seansları otomatik olarak planlayabilirsiniz."
            icon={CalendarClock}
            action={{ label: "Haftalık Plan Oluştur", onClick: () => openDrawer("new") }}
          />
        ) : (
          <div className="space-y-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onEdit={() => openDrawer("edit", plan)}
                onToggleActive={() => store.updateWeeklySessionPlan({ ...plan, isActive: !plan.isActive })}
                onCopy={() => openDrawer("copy", plan)}
                onExtend={() => openExtendDrawer(plan)}
                onDelete={() => store.deleteWeeklySessionPlan(plan.id)}
              />
            ))}
          </div>
        )}
      </div>

      <WeeklyPlanFormDrawer
        key={`${drawerMode}-${activePlan?.id ?? "new"}`}
        open={drawerOpen}
        onOpenChange={closeDrawer}
        initialData={drawerMode === "edit" ? activePlan : undefined}
        copyFromPlan={drawerMode === "copy" ? activePlan : undefined}
        preselectedStudentId={studentId}
      />

      {extendPlan && (
        <ExtendPlanDrawer
          key={extendPlan.id}
          open={extendOpen}
          onOpenChange={closeExtendDrawer}
          plan={extendPlan}
        />
      )}
    </>
  );
}
