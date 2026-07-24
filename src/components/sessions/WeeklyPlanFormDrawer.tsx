"use client";

import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, CheckCircle2, Info, User } from "lucide-react";
import Link from "next/link";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMockStore } from "@/lib/mock/store";
import { getActiveEducationTypes } from "@/lib/helpers/education-types";
import {
  getDefaultStudentPrice,
  calculateTeacherSessionEarning,
  getStudentGuardian,
  formatCurrency,
  formatDate,
  formatTime,
} from "@/lib/helpers/finance";
import {
  isTeacherAssignedToEducationType,
  getTeacherActiveEducationTypeIds,
} from "@/lib/helpers/teacher-assignments";
import {
  generateSessionDates,
  findDuplicateDateTimestamps,
} from "@/lib/helpers/weekly-plans";
import { partitionDatesByConflict } from "@/lib/helpers/session-conflict";
import { WeeklyPlanConflictWarning } from "@/components/sessions/WeeklyPlanConflictWarning";
import type { WeeklySessionPlan } from "@/types";
import { cn } from "@/lib/utils";

// ─── Day config (Mon-first display order) ─────────────────────────────────────

const ALL_DAYS = [
  { dayOfWeek: 1, name: "Pazartesi" },
  { dayOfWeek: 2, name: "Salı" },
  { dayOfWeek: 3, name: "Çarşamba" },
  { dayOfWeek: 4, name: "Perşembe" },
  { dayOfWeek: 5, name: "Cuma" },
  { dayOfWeek: 6, name: "Cumartesi" },
  { dayOfWeek: 0, name: "Pazar" },
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface DaySchedule {
  dayOfWeek: number;
  name: string;
  enabled: boolean;
  time: string;
}

interface FormState {
  studentId: string;
  teacherId: string;
  educationTypeId: string;
  studentPrice: number;
  teacherEarning: number;
  startDate: string;
  endDate: string;
  schedule: DaySchedule[];
  notes: string;
}

function buildEmptyForm(): FormState {
  return {
    studentId: "",
    teacherId: "",
    educationTypeId: "",
    studentPrice: 0,
    teacherEarning: 0,
    startDate: "",
    endDate: "",
    schedule: ALL_DAYS.map((d) => ({ ...d, enabled: false, time: "09:00" })),
    notes: "",
  };
}

function buildFromPlan(plan: WeeklySessionPlan): FormState {
  const schedule = ALL_DAYS.map((d) => {
    const existing = plan.weeklySchedule.find((s) => s.dayOfWeek === d.dayOfWeek);
    return { ...d, enabled: !!existing, time: existing?.time ?? "09:00" };
  });
  return {
    studentId: plan.studentId,
    teacherId: plan.teacherId,
    educationTypeId: plan.educationTypeId,
    studentPrice: plan.studentPrice,
    teacherEarning: plan.teacherEarning,
    startDate: plan.startDate,
    endDate: plan.endDate,
    schedule,
    notes: plan.notes ?? "",
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WeeklyPlanFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If set: edit mode — updates the plan, does not regenerate sessions. */
  initialData?: WeeklySessionPlan;
  /** If set: copy mode — creates a new plan pre-filled from this template. */
  copyFromPlan?: WeeklySessionPlan;
  preselectedStudentId?: string;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function WeeklyPlanFormDrawer({
  open,
  onOpenChange,
  initialData,
  copyFromPlan,
  preselectedStudentId,
}: WeeklyPlanFormDrawerProps) {
  const store = useMockStore();
  const isEditing = !!initialData;

  const buildInitial = (): FormState => {
    if (initialData) return buildFromPlan(initialData);
    if (copyFromPlan) {
      const f = buildFromPlan(copyFromPlan);
      // Wipe dates so user sets new range; keep schedule/prices
      f.startDate = "";
      f.endDate = "";
      return f;
    }
    const f = buildEmptyForm();
    if (preselectedStudentId) f.studentId = preselectedStudentId;
    return f;
  };

  const [form, setForm] = useState<FormState>(buildInitial);
  const [incompatibilityAcknowledged, setIncompatibilityAcknowledged] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setForm(buildFromPlan(initialData));
      } else if (copyFromPlan) {
        const f = buildFromPlan(copyFromPlan);
        f.startDate = "";
        f.endDate = "";
        setForm(f);
      } else {
        const f = buildEmptyForm();
        if (preselectedStudentId) f.studentId = preselectedStudentId;
        setForm(f);
      }
      setIncompatibilityAcknowledged(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id, copyFromPlan?.id, preselectedStudentId]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const selectedTeacher = form.teacherId
    ? store.teachers.find((t) => t.id === form.teacherId) ?? null
    : null;

  // ── Teacher change ─────────────────────────────────────────────────────────
  const handleTeacherChange = (teacherId: string) => {
    const teacher = store.teachers.find((t) => t.id === teacherId);
    setForm((prev) => {
      if (
        prev.educationTypeId &&
        teacher &&
        !isTeacherAssignedToEducationType(teacher.id, prev.educationTypeId, store.teacherEducationTypeAssignments)
      ) {
        return { ...prev, teacherId, educationTypeId: "", studentPrice: 0, teacherEarning: 0 };
      }
      let teacherEarning = prev.teacherEarning;
      if (prev.educationTypeId && teacher) {
        teacherEarning =
          calculateTeacherSessionEarning(teacher, prev.educationTypeId, prev.studentPrice, store.teacherEducationTypeAssignments) ?? 0;
      }
      return { ...prev, teacherId, teacherEarning };
    });
  };

  // ── Education type change ─────────────────────────────────────────────────
  const handleEducationTypeChange = (etId: string) => {
    setForm((prev) => {
      const teacher = prev.teacherId ? store.teachers.find((t) => t.id === prev.teacherId) : null;
      const defaultStudent = getDefaultStudentPrice(etId, store.educationTypes);
      if (teacher && !isTeacherAssignedToEducationType(teacher.id, etId, store.teacherEducationTypeAssignments)) {
        return { ...prev, educationTypeId: etId, teacherId: "", studentPrice: defaultStudent, teacherEarning: 0 };
      }
      const teacherEarning = teacher
        ? (calculateTeacherSessionEarning(teacher, etId, defaultStudent, store.teacherEducationTypeAssignments) ?? 0)
        : 0;
      return { ...prev, educationTypeId: etId, studentPrice: defaultStudent, teacherEarning };
    });
  };

  // ── Schedule helpers ───────────────────────────────────────────────────────
  const toggleDay = (dayOfWeek: number) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, enabled: !d.enabled } : d
      ),
    }));
  };

  const setDayTime = (dayOfWeek: number, time: string) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, time } : d
      ),
    }));
  };

  // ── Active slots ─────────────────────────────────────────────────────────
  const activeSlots = form.schedule.filter((d) => d.enabled);

  // ── Generated dates ───────────────────────────────────────────────────────
  const generatedDates = useMemo(
    () => generateSessionDates(form.startDate, form.endDate, activeSlots),
    [form.startDate, form.endDate, activeSlots]
  );

  // ── Duplicate protection ───────────────────────────────────────────────────
  // Skip dates that would recreate an identical session (same student, teacher,
  // education type and instant) — e.g. the same plan accidentally saved twice.
  const duplicateTimestamps = useMemo(
    () =>
      isEditing || !form.studentId || !form.teacherId || !form.educationTypeId
        ? new Set<number>()
        : findDuplicateDateTimestamps(
            generatedDates,
            form.studentId,
            form.teacherId,
            form.educationTypeId,
            store.sessions
          ),
    [isEditing, generatedDates, form.studentId, form.teacherId, form.educationTypeId, store.sessions]
  );

  const datesAfterDuplicates = useMemo(
    () => generatedDates.filter((d) => !duplicateTimestamps.has(new Date(d).getTime())),
    [generatedDates, duplicateTimestamps]
  );
  const skippedDuplicateCount = duplicateTimestamps.size;

  // ── Conflict detection (teacher / student double-booking) ─────────────────
  // Conflicting dates are never created — they're excluded from datesToCreate and
  // surfaced as a skip list, so double-booking can't slip through even if the user
  // ignores the warning (there is nothing to acknowledge or override).
  const { datesToCreate, conflicts } = useMemo(
    () =>
      isEditing || !form.studentId || !form.teacherId
        ? { datesToCreate: datesAfterDuplicates, conflicts: [] }
        : partitionDatesByConflict(
            datesAfterDuplicates,
            form.studentId,
            form.teacherId,
            50,
            store.sessions
          ),
    [isEditing, datesAfterDuplicates, form.studentId, form.teacherId, store.sessions]
  );

  // ── Financial preview ─────────────────────────────────────────────────────
  const totalBilling = datesToCreate.length * form.studentPrice;
  const totalTeacherEarning = datesToCreate.length * form.teacherEarning;
  const totalCenterProfit = totalBilling - totalTeacherEarning;

  // ── Weekly count validation ────────────────────────────────────────────────
  const selectedStudent = form.studentId
    ? store.students.find((s) => s.id === form.studentId) ?? null
    : null;
  const plannedWeekly = selectedStudent?.weeklySessionCount ?? null;
  const selectedWeeklyCount = activeSlots.length;
  const weeklyMismatch =
    plannedWeekly !== null && plannedWeekly > 0 && selectedWeeklyCount !== plannedWeekly;
  const weeklyMatch =
    plannedWeekly !== null && plannedWeekly > 0 && selectedWeeklyCount === plannedWeekly;

  // ── Guardian ─────────────────────────────────────────────────────────────
  const connectedGuardian = form.studentId
    ? getStudentGuardian(form.studentId, store.students, store.guardians)
    : null;

  // ── Filtered options ───────────────────────────────────────────────────────
  const filteredTeacherOptions = useMemo(() => {
    const active = store.teachers.filter((t) => t.status === "active");
    const base = form.educationTypeId
      ? active.filter((t) => isTeacherAssignedToEducationType(t.id, form.educationTypeId, store.teacherEducationTypeAssignments))
      : active;
    if (form.teacherId && !base.some((t) => t.id === form.teacherId)) {
      const sel = store.teachers.find((t) => t.id === form.teacherId);
      return sel ? [sel, ...base] : base;
    }
    return base;
  }, [store.teachers, store.teacherEducationTypeAssignments, form.educationTypeId, form.teacherId]);

  const filteredEducationTypeOptions = useMemo(() => {
    const active = getActiveEducationTypes(store.educationTypes);
    const base =
      form.educationTypeId && !active.some((et) => et.id === form.educationTypeId)
        ? [...active, ...store.educationTypes.filter((et) => et.id === form.educationTypeId)]
        : active;
    if (!form.teacherId || !selectedTeacher) return base;
    const activeIds = getTeacherActiveEducationTypeIds(selectedTeacher.id, store.teacherEducationTypeAssignments);
    return base.filter((et) => activeIds.includes(et.id));
  }, [store.educationTypes, store.teacherEducationTypeAssignments, form.teacherId, form.educationTypeId, selectedTeacher]);

  // ── Incompatibility (section 10 — never save an invalid teacher/type combo) ──
  const isIncompatible =
    !!form.teacherId && !!form.educationTypeId && !!selectedTeacher &&
    !isTeacherAssignedToEducationType(selectedTeacher.id, form.educationTypeId, store.teacherEducationTypeAssignments);

  const studentOptions = useMemo(() => {
    const active = store.students.filter((s) => s.status !== "inactive");
    if (!form.studentId || active.some((s) => s.id === form.studentId)) return active;
    const sel = store.students.find((s) => s.id === form.studentId);
    return sel ? [sel, ...active] : active;
  }, [store.students, form.studentId]);

  // ── Display names ─────────────────────────────────────────────────────────
  const studentDisplayName = form.studentId
    ? (store.students.find((s) => s.id === form.studentId)?.fullName ?? null)
    : null;
  const teacherDisplayName = form.teacherId
    ? (store.teachers.find((t) => t.id === form.teacherId)?.fullName ?? null)
    : null;
  const educationTypeDisplayName = form.educationTypeId
    ? (store.educationTypes.find((et) => et.id === form.educationTypeId)?.name ?? null)
    : null;

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!form.studentId || !form.teacherId || !form.educationTypeId) return;
    if (!form.startDate || !form.endDate) return;
    if (activeSlots.length === 0) return;
    if (isIncompatible && !incompatibilityAcknowledged) return;
    if (isEditing) {
      // Edit: just update plan record, don't touch existing sessions
      store.updateWeeklySessionPlan({
        ...initialData!,
        teacherId: form.teacherId,
        educationTypeId: form.educationTypeId,
        studentPrice: form.studentPrice,
        teacherEarning: form.teacherEarning,
        startDate: form.startDate,
        endDate: form.endDate,
        weeklySchedule: activeSlots.map((s) => ({ dayOfWeek: s.dayOfWeek, time: s.time })),
        notes: form.notes.trim() || undefined,
      });
    } else {
      // Create plan
      const planId = `wsp-${Date.now()}`;
      const tenantId = "tenant-1";

      const plan: WeeklySessionPlan = {
        id: planId,
        tenantId,
        studentId: form.studentId,
        teacherId: form.teacherId,
        educationTypeId: form.educationTypeId,
        studentPrice: form.studentPrice,
        teacherEarning: form.teacherEarning,
        startDate: form.startDate,
        endDate: form.endDate,
        weeklySchedule: activeSlots.map((s) => ({ dayOfWeek: s.dayOfWeek, time: s.time })),
        isActive: true,
        notes: form.notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      store.addWeeklySessionPlan(plan);

      // Generate sessions (duplicates already filtered out of datesToCreate)
      for (const dateStr of datesToCreate) {
        store.addSession({
          id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          tenantId,
          studentId: form.studentId,
          teacherId: form.teacherId,
          educationTypeId: form.educationTypeId,
          date: dateStr,
          durationMinutes: 50,
          sessionCount: 1,
          studentPrice: form.studentPrice,
          teacherEarning: form.teacherEarning,
          status: "planned",
          notes: form.notes.trim() || undefined,
          createdAt: new Date().toISOString(),
          weeklyPlanId: planId,
        });
      }
    }

    onOpenChange(false);
  };

  const canSave =
    !!form.studentId &&
    !!form.teacherId &&
    !!form.educationTypeId &&
    !!form.startDate &&
    !!form.endDate &&
    activeSlots.length > 0 &&
    (isEditing || generatedDates.length > 0) &&
    (!isIncompatible || incompatibilityAcknowledged);

  const saveLabel = isEditing
    ? "Planı Güncelle"
    : datesToCreate.length > 0
    ? `${datesToCreate.length} Seans Oluştur`
    : "Plan Oluştur";

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Haftalık Plan Düzenle" : copyFromPlan ? "Planı Kopyala" : "Haftalık Seans Planı Oluştur"}
      description="Haftalık tekrarlayan seans programı oluşturun. Seanslar otomatik olarak oluşturulur."
      onSave={handleSave}
      saveLabel={saveLabel}
      saveDisabled={isIncompatible && !incompatibilityAcknowledged}
    >
      <div className="space-y-5">

        {/* Edit note */}
        {isEditing && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Plan güncelleniyor. Mevcut seanslar etkilenmez; yalnızca plan kaydı güncellenir.
            </p>
          </div>
        )}

        {/* Öğrenci */}
        <div className="space-y-1.5">
          <Label>Öğrenci</Label>
          <Select
            value={form.studentId}
            onValueChange={(val) => { if (val) set("studentId", val); }}
            disabled={isEditing}
          >
            <SelectTrigger className="w-full">
              <SelectValue className={!form.studentId ? "text-muted-foreground" : ""}>
                {studentDisplayName ?? "Öğrenci seçin"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {studentOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.fullName}
                  {s.status === "on_hold" && (
                    <span className="ml-1.5 text-[11px] text-amber-500">· Beklemede</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Bağlı Veli */}
        {connectedGuardian && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">Bağlı Veli</p>
              <Link
                href={`/app/guardians/${connectedGuardian.id}`}
                className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                onClick={() => onOpenChange(false)}
              >
                {connectedGuardian.fullName}
              </Link>
              <span className="ml-1.5 text-xs text-muted-foreground">
                {connectedGuardian.relationship} · {connectedGuardian.phone}
              </span>
            </div>
          </div>
        )}

        {/* Öğretmen */}
        <div className="space-y-1.5">
          <Label>Öğretmen</Label>
          <Select value={form.teacherId} onValueChange={(val) => { if (val) handleTeacherChange(val); }}>
            <SelectTrigger className="w-full">
              <SelectValue className={!form.teacherId ? "text-muted-foreground" : ""}>
                {teacherDisplayName ?? "Öğretmen seçin"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {filteredTeacherOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Eğitim Türü */}
        <div className="space-y-1.5">
          <Label>Eğitim Türü</Label>
          <Select value={form.educationTypeId} onValueChange={(val) => { if (val) handleEducationTypeChange(val); }}>
            <SelectTrigger className="w-full">
              <SelectValue className={!form.educationTypeId ? "text-muted-foreground" : ""}>
                {educationTypeDisplayName ?? "Eğitim türü seçin"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {filteredEducationTypeOptions.map((et) => (
                <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Uyumsuzluk — section 10: never silently keep an invalid combination */}
        {isIncompatible && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Bu öğretmen seçilen eğitim türünü vermek üzere tanımlanmamış.
                </p>
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-500">
                  Öğretmenin aktif eğitim türü atamaları bu eğitim türünü kapsamıyor.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={incompatibilityAcknowledged}
                onChange={(e) => setIncompatibilityAcknowledged(e.target.checked)}
                className="h-4 w-4 rounded border-amber-500/60 accent-amber-600"
              />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Uyumsuzluğu onaylıyorum, kaydetmeye devam et
              </span>
            </label>
          </div>
        )}

        {/* Seans Ücreti + Hakediş */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-student-price">Seans Ücreti (₺)</Label>
            <NumericInput
              id="plan-student-price"
              min={0}
              value={form.studentPrice}
              onValueChange={(v) => set("studentPrice", v ?? 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-teacher-earning">Öğretmen Hakedişi (₺)</Label>
            <NumericInput
              id="plan-teacher-earning"
              min={0}
              value={form.teacherEarning}
              onValueChange={(v) => set("teacherEarning", v ?? 0)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Öğretmen anlaşmasına göre otomatik doldurulur. Gerekirse düzenleyin.
        </p>

        <Separator />

        {/* Tarih aralığı */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-start">Başlangıç Tarihi</Label>
            <Input
              id="plan-start"
              type="date"
              value={form.startDate}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-end">Bitiş Tarihi</Label>
            <Input
              id="plan-end"
              type="date"
              value={form.endDate}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </div>
        </div>

        {/* Haftalık program */}
        <div className="space-y-2">
          <Label>Haftalık Program</Label>
          <div className="space-y-1.5">
            {form.schedule.map((day) => (
              <div
                key={day.dayOfWeek}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                  day.enabled
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-background"
                )}
              >
                <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={() => toggleDay(day.dayOfWeek)}
                    className="h-4 w-4 rounded accent-primary"
                  />
                  <span
                    className={cn(
                      "text-sm font-medium select-none",
                      day.enabled ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {day.name}
                  </span>
                </label>
                {day.enabled && (
                  <Input
                    type="time"
                    value={day.time}
                    onChange={(e) => setDayTime(day.dayOfWeek, e.target.value)}
                    className="w-28 h-8 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Weekly count validation */}
        {weeklyMatch && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Haftalık plan öğrencinin tanımlı seans sayısıyla uyumlu.
            </p>
          </div>
        )}
        {weeklyMismatch && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Öğrenci için haftalık planlanan seans sayısı {plannedWeekly}.
                </p>
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-500">
                  Şu anda haftada {selectedWeeklyCount} seans planlıyorsunuz. Yine de devam edebilirsiniz.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Notlar */}
        <div className="space-y-1.5">
          <Label htmlFor="plan-notes">Notlar</Label>
          <textarea
            id="plan-notes"
            rows={2}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Plan hakkında notlar…"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Live preview */}
        {!isEditing && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Önizleme
              </p>

              {/* Not enough info */}
              {(!form.startDate || !form.endDate || activeSlots.length === 0) && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Tarih aralığı ve en az bir gün seçildiğinde önizleme görünecek.
                  </p>
                </div>
              )}

              {/* Duplicate protection notice */}
              {skippedDuplicateCount > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    {skippedDuplicateCount} seans zaten mevcut olduğu için atlanacak (aynı öğrenci, öğretmen, eğitim türü ve saat).
                  </p>
                </div>
              )}

              {/* Conflict warnings */}
              <WeeklyPlanConflictWarning
                conflicts={conflicts}
                students={store.students}
                teachers={store.teachers}
                educationTypes={store.educationTypes}
              />

              {/* Generated count */}
              {datesToCreate.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <p className="text-2xl font-bold text-foreground tabular-nums">
                        {datesToCreate.length}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                        Toplam Seans
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <p className="text-lg font-bold text-foreground tabular-nums">
                        {formatCurrency(totalBilling)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                        Potansiyel Tahakkuk
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                      <p className="text-lg font-bold text-amber-600 tabular-nums">
                        {formatCurrency(totalTeacherEarning)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
                        Öğretmen Hakedişi
                      </p>
                    </div>
                  </div>

                  {/* Center profit */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
                    <span className="text-xs text-muted-foreground">Tahmini Merkez Kârı</span>
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      totalCenterProfit >= 0 ? "text-emerald-600" : "text-destructive"
                    )}>
                      {formatCurrency(totalCenterProfit)}
                    </span>
                  </div>

                  {/* Date list */}
                  <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1.5">
                    <p className="text-xs font-medium text-foreground mb-2">
                      Oluşturulacak Seanslar
                    </p>
                    {datesToCreate.slice(0, 8).map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                        <span>{formatDate(d)} — {formatTime(d)}</span>
                      </div>
                    ))}
                    {datesToCreate.length > 8 && (
                      <p className="text-xs text-muted-foreground italic pt-1">
                        …ve {datesToCreate.length - 8} seans daha
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* No dates found */}
              {form.startDate && form.endDate && activeSlots.length > 0 && generatedDates.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Seçilen tarih aralığında bu günlere denk seans bulunamadı. Tarihleri kontrol edin.
                  </p>
                </div>
              )}

              {/* All generated dates were duplicates (conflicts are explained above instead) */}
              {generatedDates.length > 0 && datesToCreate.length === 0 && conflicts.length === 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Bu tarih aralığındaki tüm seanslar zaten mevcut. Yeni seans oluşturulmayacak.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Save guard */}
        {!canSave && (form.startDate || form.endDate || activeSlots.length > 0) && (
          <p className="text-xs text-muted-foreground">
            Kaydetmek için öğrenci, öğretmen, eğitim türü, tarih aralığı ve en az bir gün seçilmeli; ayrıca en az bir seans oluşturulabilmeli.
          </p>
        )}
      </div>
    </FormDrawer>
  );
}
