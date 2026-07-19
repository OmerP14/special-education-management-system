"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { User, AlertTriangle, CheckCircle2, Info, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { getEducationTypeById, getActiveEducationTypes } from "@/lib/helpers/education-types";
import {
  getDefaultStudentPrice,
  calculateTeacherSessionEarning,
  getTeacherCustomPriceForEducationType,
  getStudentGuardian,
  getSessionStatusLabel,
  formatCurrency,
} from "@/lib/helpers/finance";
import { checkSessionConflict } from "@/lib/helpers/session-conflict";
import { SessionConflictError } from "@/components/sessions/SessionConflictError";
import type { Session, SessionStatus, Teacher } from "@/types";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  "planned",
  "completed",
  "cancelled",
  "no_show",
  "makeup",
].map((value) => ({ value: value as SessionStatus, label: getSessionStatusLabel(value as SessionStatus) }));

const BILLABLE_STATUSES: SessionStatus[] = ["completed", "no_show", "makeup"];

// ─── Preview row ───────────────────────────────────────────────────────────────

function PreviewRow({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "neutral" | "warning" | "success" | "danger";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          variant === "neutral" && "text-foreground",
          variant === "warning" && "text-amber-600",
          variant === "success" && "text-emerald-600",
          variant === "danger" && "text-destructive"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function teacherMatchesEducationType(teacher: Teacher, educationTypeId: string): boolean {
  if (teacher.specializations.length === 0) return true;
  return teacher.specializations.includes(educationTypeId);
}

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  studentId: string;
  teacherId: string;
  educationTypeId: string;
  date: string;
  time: string;
  durationMinutes: number;
  studentPrice: number;
  teacherEarningPrice: number;
  status: SessionStatus;
  notes: string;
}

const EMPTY_FORM: FormState = {
  studentId: "",
  teacherId: "",
  educationTypeId: "",
  date: "",
  time: "",
  durationMinutes: 50,
  studentPrice: 0,
  teacherEarningPrice: 0,
  status: "planned",
  notes: "",
};

function buildFromSession(session: Session): FormState {
  const dateObj = new Date(session.date);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
  const timeStr = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
  return {
    studentId: session.studentId,
    teacherId: session.teacherId,
    educationTypeId: session.educationTypeId,
    date: dateStr,
    time: timeStr,
    durationMinutes: session.durationMinutes,
    studentPrice: session.studentPrice,
    teacherEarningPrice: session.teacherEarning,
    status: session.status,
    notes: session.notes ?? "",
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SessionFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Session;
  preselectedStudentId?: string;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SessionFormDrawer({
  open,
  onOpenChange,
  initialData,
  preselectedStudentId,
}: SessionFormDrawerProps) {
  const store = useMockStore();
  const isEditing = !!initialData;

  const buildInitial = (): FormState => {
    if (initialData) return buildFromSession(initialData);
    if (preselectedStudentId) return { ...EMPTY_FORM, studentId: preselectedStudentId };
    return EMPTY_FORM;
  };

  const [form, setForm] = useState<FormState>(buildInitial);
  const [lossAcknowledged, setLossAcknowledged] = useState(false);
  const [incompatibilityAcknowledged, setIncompatibilityAcknowledged] = useState(false);
  const [manualEarningMode, setManualEarningMode] = useState(false);
  const [manualEarningAcknowledged, setManualEarningAcknowledged] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(
        initialData
          ? buildFromSession(initialData)
          : preselectedStudentId
          ? { ...EMPTY_FORM, studentId: preselectedStudentId }
          : EMPTY_FORM
      );
      setLossAcknowledged(false);
      setIncompatibilityAcknowledged(false);
      setManualEarningMode(false);
      setManualEarningAcknowledged(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id, preselectedStudentId]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const selectedTeacher = form.teacherId
    ? store.teachers.find((t) => t.id === form.teacherId) ?? null
    : null;

  // ── Teacher change ─────────────────────────────────────────────────────────
  const handleTeacherChange = (teacherId: string) => {
    setManualEarningMode(false);
    setManualEarningAcknowledged(false);
    const teacher = store.teachers.find((t) => t.id === teacherId);
    setForm((prev) => {
      if (prev.educationTypeId && teacher && !teacherMatchesEducationType(teacher, prev.educationTypeId)) {
        return { ...prev, teacherId, educationTypeId: "", studentPrice: 0, teacherEarningPrice: 0 };
      }
      let teacherEarningPrice = prev.teacherEarningPrice;
      if (prev.educationTypeId && teacher) {
        teacherEarningPrice =
          calculateTeacherSessionEarning(teacher, prev.educationTypeId, prev.studentPrice, store.teacherCustomPrices) ?? 0;
      }
      return { ...prev, teacherId, teacherEarningPrice };
    });
  };

  // ── Education type change ─────────────────────────────────────────────────
  const handleEducationTypeChange = (etId: string) => {
    setManualEarningMode(false);
    setManualEarningAcknowledged(false);
    setForm((prev) => {
      const teacher = prev.teacherId ? store.teachers.find((t) => t.id === prev.teacherId) : null;
      const defaultStudent = getDefaultStudentPrice(etId, store.educationTypes);
      // Prefills only — never touches durationMinutes/studentPrice on any
      // session that already exists, since this only runs from the form's own
      // Select onChange (see AGENTS §9: changing the EducationType default
      // later must not retroactively change existing sessions).
      const defaultDuration =
        getEducationTypeById(etId, store.educationTypes)?.defaultDurationMinutes ?? prev.durationMinutes;
      if (teacher && !teacherMatchesEducationType(teacher, etId)) {
        return {
          ...prev,
          educationTypeId: etId,
          teacherId: "",
          studentPrice: defaultStudent,
          teacherEarningPrice: 0,
          durationMinutes: defaultDuration,
        };
      }
      const teacherEarningPrice = teacher
        ? (calculateTeacherSessionEarning(teacher, etId, defaultStudent, store.teacherCustomPrices) ?? 0)
        : 0;
      return {
        ...prev,
        educationTypeId: etId,
        studentPrice: defaultStudent,
        teacherEarningPrice,
        durationMinutes: defaultDuration,
      };
    });
  };

  // ── Student price change ───────────────────────────────────────────────────
  const handleStudentPriceChange = (newPrice: number) => {
    if (selectedTeacher?.earningType === "percentage" && !manualEarningMode && form.educationTypeId) {
      const newEarning =
        calculateTeacherSessionEarning(selectedTeacher, form.educationTypeId, newPrice, store.teacherCustomPrices) ?? 0;
      setForm((prev) => ({ ...prev, studentPrice: newPrice, teacherEarningPrice: newEarning }));
    } else {
      set("studentPrice", newPrice);
    }
  };

  const resetToAutoEarning = () => {
    setManualEarningMode(false);
    setManualEarningAcknowledged(false);
    if (selectedTeacher && form.educationTypeId) {
      const autoVal =
        calculateTeacherSessionEarning(selectedTeacher, form.educationTypeId, form.studentPrice, store.teacherCustomPrices) ?? 0;
      set("teacherEarningPrice", autoVal);
    }
  };

  // ── Scheduling / conflict check ─────────────────────────────────────────────
  const startsAt = form.date
    ? form.time
      ? `${form.date}T${form.time}:00`
      : `${form.date}T00:00:00`
    : null;
  const conflictResult = useMemo(() => {
    if (!startsAt || !form.studentId || !form.teacherId) {
      return { hasConflict: false, isDuplicate: false, conflictType: null, conflictingSessions: [], message: null };
    }
    return checkSessionConflict({
      sessions: store.sessions,
      studentId: form.studentId,
      teacherId: form.teacherId,
      startsAt,
      durationMinutes: form.durationMinutes,
      excludeSessionId: initialData?.id,
      educationTypeId: form.educationTypeId || undefined,
      fee: form.studentPrice,
    });
  }, [startsAt, form.studentId, form.teacherId, form.educationTypeId, form.studentPrice, form.durationMinutes, store.sessions, initialData?.id]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!form.studentId || !form.teacherId || !form.educationTypeId || !form.date) return;
    if (isLoss && !lossAcknowledged) return;
    if (isIncompatible && !incompatibilityAcknowledged) return;
    if (conflictResult.hasConflict) return;

    const tenantId = initialData?.tenantId ?? "tenant-1";
    const id = initialData?.id ?? `session-${Date.now()}`;
    const dateStr = startsAt!;

    const session: Session = {
      id,
      tenantId,
      studentId: form.studentId,
      teacherId: form.teacherId,
      educationTypeId: form.educationTypeId,
      date: dateStr,
      durationMinutes: form.durationMinutes,
      sessionCount: initialData?.sessionCount ?? 1,
      studentPrice: form.studentPrice,
      teacherEarning: form.teacherEarningPrice,
      status: isEditing ? form.status : "planned",
      notes: form.notes.trim() || undefined,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
      recurringGroupId: initialData?.recurringGroupId,
      weeklyPlanId: initialData?.weeklyPlanId,
      // A manual override is a deliberate, confirmed value — only the untouched
      // auto-calc path with no configured price is a genuine 0-fallback.
      teacherEarningStatus: noCustomPriceWarning && !manualEarningMode ? "unknown" : "calculated",
    };

    if (isEditing) {
      store.updateSession(session);
    } else {
      store.addSession(session);
    }
    onOpenChange(false);
  };

  // ── Derived flags ──────────────────────────────────────────────────────────
  const isIncompatible =
    !!form.teacherId && !!form.educationTypeId && !!selectedTeacher &&
    !teacherMatchesEducationType(selectedTeacher, form.educationTypeId);

  const hasCustomPrice =
    !!form.teacherId && !!form.educationTypeId &&
    getTeacherCustomPriceForEducationType(form.teacherId, form.educationTypeId, store.teacherCustomPrices) !== null;

  const noCustomPriceWarning =
    !!form.teacherId && !!form.educationTypeId &&
    selectedTeacher?.earningType === "per_session" && !hasCustomPrice;

  const connectedGuardian = form.studentId
    ? getStudentGuardian(form.studentId, store.students, store.guardians)
    : null;

  const previewTotal = form.studentPrice;
  const previewTeacherEarning = form.teacherEarningPrice;
  const previewCenterProfit = previewTotal - previewTeacherEarning;
  const profitPct = previewTotal > 0 ? Math.round((previewCenterProfit / previewTotal) * 100) : 0;

  const isLoss = form.studentPrice > 0 && form.teacherEarningPrice > form.studentPrice;
  const showPreview = !!form.educationTypeId;
  const isBillable = BILLABLE_STATUSES.includes(form.status);
  const earningFieldEnabled = manualEarningMode && manualEarningAcknowledged;
  const showManualOverrideBtn = !!form.teacherId && !!form.educationTypeId;
  const isSalaryModel =
    selectedTeacher?.earningType === "monthly_salary" ||
    selectedTeacher?.earningType === "salary_plus_quota";

  // ── Select display lookups ─────────────────────────────────────────────────
  const studentDisplayName = form.studentId
    ? (store.students.find((s) => s.id === form.studentId)?.fullName ?? form.studentId)
    : null;
  const teacherDisplayName = form.teacherId
    ? (store.teachers.find((t) => t.id === form.teacherId)?.fullName ?? form.teacherId)
    : null;
  const educationTypeDisplayName = form.educationTypeId
    ? (store.educationTypes.find((et) => et.id === form.educationTypeId)?.name ?? form.educationTypeId)
    : null;
  const statusDisplayLabel = STATUS_OPTIONS.find((o) => o.value === form.status)?.label ?? form.status;

  // ── Filtered options ───────────────────────────────────────────────────────
  const filteredTeacherOptions = useMemo(() => {
    const active = store.teachers.filter((t) => t.status === "active");
    const base = form.educationTypeId
      ? active.filter((t) => teacherMatchesEducationType(t, form.educationTypeId))
      : active;
    if (form.teacherId && !base.some((t) => t.id === form.teacherId)) {
      const sel = store.teachers.find((t) => t.id === form.teacherId);
      return sel ? [sel, ...base] : base;
    }
    return base;
  }, [store.teachers, form.educationTypeId, form.teacherId]);

  const filteredEducationTypeOptions = useMemo(() => {
    // Active-only for new selections, but never drops an already-selected
    // inactive type (editing a historical session must keep it visible).
    const active = getActiveEducationTypes(store.educationTypes);
    const base =
      form.educationTypeId && !active.some((et) => et.id === form.educationTypeId)
        ? [...active, ...store.educationTypes.filter((et) => et.id === form.educationTypeId)]
        : active;
    if (!form.teacherId || !selectedTeacher) return base;
    if (selectedTeacher.specializations.length === 0) return base;
    return base.filter((et) => selectedTeacher.specializations.includes(et.id));
  }, [store.educationTypes, form.teacherId, form.educationTypeId, selectedTeacher]);

  const studentOptions = useMemo(() => {
    const active = store.students.filter((s) => s.status !== "inactive");
    if (!form.studentId || active.some((s) => s.id === form.studentId)) return active;
    const sel = store.students.find((s) => s.id === form.studentId);
    return sel ? [sel, ...active] : active;
  }, [store.students, form.studentId]);

  // ── Effects checklist ──────────────────────────────────────────────────────
  const effects = [
    { text: "Takvime eklenecek", show: true },
    { text: "Seans listesine eklenecek", show: true },
    { text: "Öğrenci detayına eklenecek", show: !!form.studentId },
    { text: "Öğretmen detayına eklenecek", show: !!form.teacherId },
    { text: "Veli detayına yansıyacak", show: !!connectedGuardian },
    { text: "Öğrencinin cari hesabı güncellenecek", show: !!form.studentId && isBillable },
    {
      text: "Öğretmen hakedişi oluşacak",
      show: !!form.teacherId && isBillable && !isSalaryModel && form.teacherEarningPrice > 0,
    },
    { text: "Raporlara yansıyacak", show: isBillable },
    { text: "Dashboard istatistikleri güncellenecek", show: isBillable },
  ].filter((e) => e.show);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Seans Düzenle" : "Yeni Seans"}
      description="Seans bilgilerini girin. Fiyatlar anlaşmaya göre otomatik hesaplanır."
      onSave={handleSave}
      saveLabel={isEditing ? "Değişiklikleri Kaydet" : "Seans Ekle"}
      saveDisabled={conflictResult.hasConflict}
    >
      <div className="space-y-5">

        {/* Recurring plan note */}
        {isEditing && initialData?.weeklyPlanId && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Bu seans bir haftalık plan kapsamında oluşturuldu. Yalnızca bu seans düzenleniyor; plan veya diğer seanslar etkilenmez.
            </p>
          </div>
        )}

        {/* Öğrenci */}
        <div className="space-y-1.5">
          <Label>Öğrenci</Label>
          <Select value={form.studentId} onValueChange={(val) => { if (val) set("studentId", val); }}>
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
              {filteredTeacherOptions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Bu eğitim türü için uygun öğretmen bulunamadı.
                </div>
              ) : (
                filteredTeacherOptions.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                    {t.status === "inactive" && (
                      <span className="ml-1.5 text-[11px] text-muted-foreground">· Pasif</span>
                    )}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {form.educationTypeId && filteredTeacherOptions.length === 0 && (
            <p className="text-xs text-amber-600">Bu eğitim türünde uzman öğretmen tanımlı değil.</p>
          )}
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
              {filteredEducationTypeOptions.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Bu öğretmenin uzmanlık alanı tanımlanmamış.
                </div>
              ) : (
                filteredEducationTypeOptions.map((et) => (
                  <SelectItem key={et.id} value={et.id}>{et.name}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {form.teacherId && filteredEducationTypeOptions.length === 0 && (
            <p className="text-xs text-amber-600">Öğretmenin uzmanlık alanı tanımlanmamış; eğitim türü seçilemiyor.</p>
          )}
        </div>

        {/* Uyumsuzluk */}
        {isIncompatible && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Seçilen öğretmen bu eğitim türü için yetkilendirilmemiş.
                </p>
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-500">
                  Öğretmenin uzmanlık alanları bu eğitim türünü kapsamıyor.
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

        {/* Tarih + Saat */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="session-date">Tarih</Label>
            <Input id="session-date" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="session-time">Saat</Label>
            <Input id="session-time" type="time" value={form.time} onChange={(e) => set("time", e.target.value)} />
          </div>
        </div>

        {/* Süre — prefilled from the education type's default, always overridable */}
        <div className="space-y-1.5">
          <Label htmlFor="session-duration">Süre (dakika)</Label>
          <NumericInput
            id="session-duration"
            min={1}
            integer
            value={form.durationMinutes}
            onValueChange={(v) => set("durationMinutes", v ?? 0)}
            className="w-28"
          />
        </div>

        {/* Zamanlama çakışması */}
        <SessionConflictError
          result={conflictResult}
          students={store.students}
          teachers={store.teachers}
          educationTypes={store.educationTypes}
        />

        {/* Seans Ücreti */}
        <div className="space-y-1.5">
          <Label htmlFor="student-price">Seans Ücreti (₺)</Label>
          <NumericInput
            id="student-price"
            min={0}
            value={form.studentPrice}
            onValueChange={(v) => handleStudentPriceChange(v ?? 0)}
          />
          <p className="text-xs text-muted-foreground">Veliye yansıyacak seans ücreti</p>
        </div>

        {/* Öğretmen Hakedişi */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="teacher-earning" className="flex items-center gap-1.5">
              Öğretmen Hakedişi (₺)
              {hasCustomPrice && !manualEarningMode && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary leading-none">
                  Özel
                </span>
              )}
              {manualEarningMode && (
                <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400 leading-none">
                  Manuel
                </span>
              )}
            </Label>
            {showManualOverrideBtn && !manualEarningMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                onClick={() => setManualEarningMode(true)}
              >
                <Pencil className="h-3 w-3" />
                Manuel Değiştir
              </Button>
            )}
          </div>
          <NumericInput
            id="teacher-earning"
            min={0}
            value={form.teacherEarningPrice}
            disabled={!earningFieldEnabled}
            onValueChange={(v) => set("teacherEarningPrice", v ?? 0)}
            className={cn(!earningFieldEnabled && "bg-muted/50 cursor-not-allowed opacity-70")}
          />
          {!manualEarningMode && (
            <p className="text-xs text-muted-foreground">Öğretmen anlaşmasına göre otomatik hesaplanır.</p>
          )}
        </div>

        {/* Manuel override */}
        {manualEarningMode && (
          <div className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Bu değer öğretmen anlaşmasını geçersiz kılar.
                </p>
                <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-500">
                  Girdiğiniz miktar öğretmenin ödeme modelinden bağımsız olarak kaydedilecektir.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={manualEarningAcknowledged}
                onChange={(e) => setManualEarningAcknowledged(e.target.checked)}
                className="h-4 w-4 rounded border-amber-500/60 accent-amber-600"
              />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Manuel hakediş gireceğimi onaylıyorum.
              </span>
            </label>
            <button
              type="button"
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
              onClick={resetToAutoEarning}
            >
              Otomatik hesaplamaya dön
            </button>
          </div>
        )}

        {/* Özel fiyat uyarısı */}
        {noCustomPriceWarning && !manualEarningMode && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Bu öğretmen için bu eğitim türüne özel hakediş tanımlanmamış.
            </p>
          </div>
        )}

        {/* Maaş modeli notu */}
        {selectedTeacher?.earningType === "monthly_salary" && form.teacherId && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Bu öğretmen aylık maaş modelinde çalışmaktadır. Seans başı hakediş yalnızca kayıt amaçlıdır.
            </p>
          </div>
        )}
        {selectedTeacher?.earningType === "salary_plus_quota" && form.teacherId && (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Bu öğretmen sabit maaş + kota üstü modelinde çalışmaktadır. Bu alan yalnızca kayıt amaçlıdır.
            </p>
          </div>
        )}

        {/* Durum */}
        {isEditing ? (
          <div className="space-y-1.5">
            <Label>Durum</Label>
            <Select value={form.status} onValueChange={(val) => set("status", val as SessionStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue>{statusDisplayLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Yeni seanslar otomatik olarak <span className="font-medium text-foreground">Planlandı</span> durumunda oluşturulur.
            </p>
          </div>
        )}

        {/* Notlar */}
        <div className="space-y-1.5">
          <Label htmlFor="session-notes">Notlar</Label>
          <textarea
            id="session-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Seans hakkında notlar…"
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Zarar uyarısı */}
        {isLoss && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">
                  Bu seans merkezin zarar etmesine neden olacaktır.
                </p>
                <p className="mt-0.5 text-xs text-destructive/80">
                  Öğretmen hakedişi (₺{form.teacherEarningPrice.toLocaleString("tr-TR")}) seans
                  ücretini (₺{form.studentPrice.toLocaleString("tr-TR")}) aşıyor.
                </p>
              </div>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={lossAcknowledged}
                onChange={(e) => setLossAcknowledged(e.target.checked)}
                className="h-4 w-4 rounded border-destructive/60 accent-destructive"
              />
              <span className="text-xs font-medium text-destructive">
                Zararı onaylıyorum, kaydetmeye devam et
              </span>
            </label>
          </div>
        )}

        {/* Finansal özet */}
        {showPreview && (
          <>
            <Separator />
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Bu Seans Finansal Özeti
                </p>
                <div className="flex items-center gap-1.5">
                  <div className={cn("h-2 w-2 rounded-full", previewCenterProfit >= 0 ? "bg-emerald-500" : "bg-destructive")} />
                  <span className={cn("text-xs font-semibold", previewCenterProfit >= 0 ? "text-emerald-600" : "text-destructive")}>
                    {previewCenterProfit >= 0 ? "Karlı" : "Zararlı"}
                  </span>
                  {previewTotal > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">({Math.abs(profitPct)}%)</span>
                  )}
                </div>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 space-y-2.5">
                <PreviewRow label="Veliye Yansıyacak Tutar" value={formatCurrency(previewTotal)} variant="neutral" />
                <PreviewRow label="Öğretmen Hakedişi" value={formatCurrency(previewTeacherEarning)} variant="warning" />
                <div className="border-t border-border/60 pt-2.5">
                  <PreviewRow
                    label="Merkez Kârı"
                    value={formatCurrency(previewCenterProfit)}
                    variant={previewCenterProfit >= 0 ? "success" : "danger"}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Etkiler */}
        {effects.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Bu işlem tamamlandığında
              </p>
              <div className="space-y-1.5">
                {effects.map((e) => (
                  <div key={e.text} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span className="text-xs text-muted-foreground">{e.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </FormDrawer>
  );
}
