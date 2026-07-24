"use client";

import { useState, useEffect } from "react";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useMockStore } from "@/lib/mock/store";
import { getTeacherStatusLabel } from "@/lib/helpers/finance";
import { getActiveEducationTypes } from "@/lib/helpers/education-types";
import { getTeacherEducationAssignments } from "@/lib/helpers/teacher-assignments";
import type {
  EducationType,
  Teacher,
  TeacherStatus,
  TeacherEarningType,
  TeacherEducationTypeAssignmentStatus,
} from "@/types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const EARNING_TYPE_OPTIONS: {
  value: TeacherEarningType;
  label: string;
  description: string;
}[] = [
  {
    value: "per_session",
    label: "Seans Başı",
    description: "Her seans için uzmanlık alanına göre özel hakediş",
  },
  {
    value: "monthly_salary",
    label: "Sabit Maaş",
    description: "Sabit aylık maaş; seans başı ayrıca hakediş oluşmaz",
  },
  {
    value: "salary_plus_quota",
    label: "Sabit Maaş + Kota Üstü Hakediş",
    description: "Maaşa dahil kota aşıldığında ek seans hakedişi oluşur",
  },
  {
    value: "percentage",
    label: "Yüzde Hakediş",
    description: "Öğrenci ücretinin yüzdesi kadar hakediş",
  },
];

// ─── Form state ────────────────────────────────────────────────────────────────

interface AssignmentRowState {
  checked: boolean;
  earningAmount: number | undefined; // undefined = "Hakediş ayarı eksik" downstream
}

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  status: TeacherStatus;
  hasCustomBranch: boolean;
  customBranch: string;
  earningType: TeacherEarningType;
  monthlySalary: number;
  monthlySessionQuota: number;
  extraSessionRate: number;
  earningPercentage: number;
  assignmentRows: Record<string, AssignmentRowState>; // educationTypeId → row state
  notes: string;
}

function buildEmptyForm(): FormState {
  return {
    fullName: "",
    phone: "",
    email: "",
    status: "active",
    hasCustomBranch: false,
    customBranch: "",
    earningType: "per_session",
    monthlySalary: 0,
    monthlySessionQuota: 0,
    extraSessionRate: 0,
    earningPercentage: 0,
    assignmentRows: {},
    notes: "",
  };
}

function buildFormFromTeacher(
  teacher: Teacher,
  assignmentRows: Record<string, AssignmentRowState>,
  educationTypes: EducationType[]
): FormState {
  const hasCustomBranch =
    !!teacher.customBranch && !educationTypes.some((et) => et.id === teacher.customBranch);
  return {
    fullName: teacher.fullName,
    phone: teacher.phone,
    email: teacher.email ?? "",
    status: teacher.status,
    hasCustomBranch,
    customBranch: teacher.customBranch ?? "",
    earningType: teacher.earningType ?? "per_session",
    monthlySalary: teacher.monthlySalary ?? 0,
    monthlySessionQuota: teacher.includedSessionQuota ?? 0,
    extraSessionRate: teacher.extraSessionEarning ?? 0,
    earningPercentage: teacher.earningPercentage ?? 0,
    assignmentRows,
    notes: teacher.notes ?? "",
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TeacherFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Teacher;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function TeacherFormDrawer({
  open,
  onOpenChange,
  initialData,
}: TeacherFormDrawerProps) {
  const store = useMockStore();
  const isEditing = !!initialData;

  const buildExistingAssignmentRows = (): Record<string, AssignmentRowState> => {
    const map: Record<string, AssignmentRowState> = {};
    if (initialData) {
      getTeacherEducationAssignments(initialData.id, store.teacherEducationTypeAssignments).forEach(
        (a) => {
          map[a.educationTypeId] = {
            checked: a.status === "active",
            earningAmount: a.earningAmount ?? undefined,
          };
        }
      );
    }
    return map;
  };

  const [form, setForm] = useState<FormState>(() =>
    initialData
      ? buildFormFromTeacher(initialData, buildExistingAssignmentRows(), store.educationTypes)
      : buildEmptyForm()
  );

  useEffect(() => {
    if (open) {
      const rows = buildExistingAssignmentRows();
      setForm(
        initialData
          ? buildFormFromTeacher(initialData, rows, store.educationTypes)
          : buildEmptyForm()
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // Active-only for new assignment picks, but never drops an education type the
  // teacher already has an assignment row for (any status) — an inactive type
  // must stay visible/checked on an existing record.
  const activeEducationTypes = getActiveEducationTypes(store.educationTypes);
  const existingAssignmentTypeIds = new Set(Object.keys(form.assignmentRows));
  const assignmentOptions = [
    ...activeEducationTypes,
    ...store.educationTypes.filter(
      (et) => et.status === "inactive" && existingAssignmentTypeIds.has(et.id)
    ),
  ];

  const toggleAssignment = (id: string) => {
    setForm((prev) => ({
      ...prev,
      assignmentRows: {
        ...prev.assignmentRows,
        [id]: {
          checked: !(prev.assignmentRows[id]?.checked ?? false),
          earningAmount: prev.assignmentRows[id]?.earningAmount,
        },
      },
    }));
  };

  const setAssignmentEarning = (id: string, amount: number | undefined) => {
    setForm((prev) => ({
      ...prev,
      assignmentRows: {
        ...prev.assignmentRows,
        [id]: { checked: prev.assignmentRows[id]?.checked ?? false, earningAmount: amount },
      },
    }));
  };

  const handleSave = () => {
    if (!form.fullName.trim() || !form.phone.trim()) return;

    const tenantId = initialData?.tenantId ?? "tenant-1";
    const id = initialData?.id ?? `teacher-${Date.now()}`;

    const teacher: Teacher = {
      id,
      tenantId,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      status: form.status,
      earningType: form.earningType,
      monthlySalary:
        form.earningType === "monthly_salary" || form.earningType === "salary_plus_quota"
          ? form.monthlySalary
          : undefined,
      includedSessionQuota:
        form.earningType === "salary_plus_quota" ? form.monthlySessionQuota : undefined,
      extraSessionEarning:
        form.earningType === "salary_plus_quota" ? form.extraSessionRate : undefined,
      earningPercentage:
        form.earningType === "percentage" ? form.earningPercentage : undefined,
      customBranch:
        form.hasCustomBranch && form.customBranch.trim() ? form.customBranch.trim() : undefined,
      notes: form.notes.trim() || undefined,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };

    if (isEditing) {
      store.updateTeacher(teacher);
    } else {
      store.addTeacher(teacher);
    }

    // One row per education type the teacher is currently checked for, plus one
    // per previously-existing assignment that just got unchecked (deactivated,
    // never deleted) — see upsertTeacherEducationTypeAssignments in store.tsx.
    const rows = assignmentOptions
      .filter((et) => form.assignmentRows[et.id]?.checked || existingAssignmentTypeIds.has(et.id))
      .map((et) => {
        const rowState = form.assignmentRows[et.id];
        const status: TeacherEducationTypeAssignmentStatus = rowState?.checked ? "active" : "inactive";
        return {
          educationTypeId: et.id,
          earningAmount: form.earningType === "per_session" ? rowState?.earningAmount ?? null : null,
          status,
        };
      });
    store.upsertTeacherEducationTypeAssignments(id, tenantId, rows);

    onOpenChange(false);
  };

  const title = isEditing ? "Öğretmen Düzenle" : "Yeni Öğretmen";
  const saveLabel = isEditing ? "Değişiklikleri Kaydet" : "Öğretmen Ekle";

  const checkedCount = assignmentOptions.filter((et) => form.assignmentRows[et.id]?.checked).length;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Öğretmen bilgilerini doldurun. Hakediş modeli seans kaydına yansır."
      onSave={handleSave}
      saveLabel={saveLabel}
    >
      <div className="space-y-5">
        {/* Ad Soyad */}
        <div className="space-y-1.5">
          <Label htmlFor="teacher-name">Ad Soyad</Label>
          <Input
            id="teacher-name"
            placeholder="Öğretmen adı ve soyadı"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
          />
        </div>

        {/* Telefon */}
        <div className="space-y-1.5">
          <Label htmlFor="teacher-phone">Telefon</Label>
          <Input
            id="teacher-phone"
            type="tel"
            placeholder="05XX XXX XX XX"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>

        {/* E-posta */}
        <div className="space-y-1.5">
          <Label htmlFor="teacher-email">E-posta</Label>
          <Input
            id="teacher-email"
            type="email"
            placeholder="ad.soyad@kurum.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
        </div>

        {/* Durum */}
        <div className="space-y-1.5">
          <Label>Durum</Label>
          <Select
            value={form.status}
            onValueChange={(val) => set("status", val as TeacherStatus)}
          >
            <SelectTrigger>
              <SelectValue>{(val: TeacherStatus) => getTeacherStatusLabel(val)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{getTeacherStatusLabel("active")}</SelectItem>
              <SelectItem value="inactive">{getTeacherStatusLabel("inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Hakediş Modeli */}
        <div className="space-y-2">
          <Label>Hakediş Modeli</Label>
          <div className="space-y-2">
            {EARNING_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className="flex items-start gap-2.5 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <input
                  type="radio"
                  name="earningType"
                  value={opt.value}
                  checked={form.earningType === opt.value}
                  onChange={() => set("earningType", opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Sabit Maaş alanı */}
        {(form.earningType === "monthly_salary" ||
          form.earningType === "salary_plus_quota") && (
          <div className="space-y-1.5">
            <Label htmlFor="monthly-salary">Aylık Maaş (₺)</Label>
            <NumericInput
              id="monthly-salary"
              min={0}
              step={500}
              placeholder="0"
              value={form.monthlySalary}
              onValueChange={(v) => set("monthlySalary", v ?? 0)}
            />
          </div>
        )}

        {/* Kota alanları */}
        {form.earningType === "salary_plus_quota" && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/20 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Kota Üstü Ayarları
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="session-quota">Maaşa Dahil Aylık Seans Sayısı</Label>
              <NumericInput
                id="session-quota"
                min={0}
                step={1}
                integer
                placeholder="0"
                value={form.monthlySessionQuota}
                onValueChange={(v) => set("monthlySessionQuota", v ?? 0)}
              />
              <p className="text-xs text-muted-foreground">
                Bu kadara kadar yapılan seanslar maaşa dahildir.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="extra-session-rate">Kota Üstü Seans Hakedişi (₺)</Label>
              <NumericInput
                id="extra-session-rate"
                min={0}
                step={50}
                placeholder="0"
                value={form.extraSessionRate}
                onValueChange={(v) => set("extraSessionRate", v ?? 0)}
              />
              <p className="text-xs text-muted-foreground">
                Kotayı aşan her seans için ek ödeme miktarı.
              </p>
            </div>
          </div>
        )}

        {/* Yüzde alanı */}
        {form.earningType === "percentage" && (
          <div className="space-y-1.5">
            <Label htmlFor="earning-pct">Hakediş Yüzdesi (%)</Label>
            <NumericInput
              id="earning-pct"
              min={0}
              max={100}
              step={1}
              placeholder="0"
              value={form.earningPercentage}
              transform={(v) => Math.min(100, v)}
              onValueChange={(v) => set("earningPercentage", v ?? 0)}
            />
            <p className="text-xs text-muted-foreground">
              Öğrenci seans ücretinin bu yüzdesi öğretmene ödenir.
            </p>
          </div>
        )}

        <Separator />

        {/* Verebildiği Eğitim Türleri ve Hakedişler */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Verebildiği Eğitim Türleri ve Hakedişler</Label>
            {checkedCount > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{checkedCount} seçili</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {form.earningType === "per_session"
              ? "Her eğitim türü için sabit hakediş girin. Boş bırakılırsa o eğitim türü için hakediş ayarı eksik kalır ve seans kaydında uyarı gösterilir."
              : "Seçilen eğitim türleri, bu öğretmenin hangi derslere atanabileceğini belirler."}
          </p>
          <div className="space-y-2">
            {assignmentOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2.5">
                Sistemde tanımlı aktif eğitim türü yok. Önce Ayarlar → Eğitim Türleri altından ekleyin.
              </p>
            ) : (
              assignmentOptions.map((et) => {
                const row = form.assignmentRows[et.id];
                const checked = row?.checked ?? false;
                return (
                  <div
                    key={et.id}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 hover:bg-muted/50 transition-colors"
                  >
                    <label className="flex flex-1 min-w-0 items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded shrink-0"
                        checked={checked}
                        onChange={() => toggleAssignment(et.id)}
                      />
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: et.color }}
                        aria-hidden
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {et.name}
                          {et.status === "inactive" && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">(Pasif)</span>
                          )}
                        </span>
                      </span>
                    </label>
                    {form.earningType === "per_session" && (
                      <NumericInput
                        min={0}
                        step={25}
                        placeholder="Tanımsız"
                        value={row?.earningAmount}
                        allowUndefined
                        disabled={!checked}
                        onValueChange={(v) => setAssignmentEarning(et.id, v)}
                        className="w-28 shrink-0"
                      />
                    )}
                  </div>
                );
              })
            )}
            {/* Diğer */}
            <label className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                className="rounded"
                checked={form.hasCustomBranch}
                onChange={(e) => set("hasCustomBranch", e.target.checked)}
              />
              <p className="text-sm font-medium">Diğer</p>
            </label>
            {form.hasCustomBranch && (
              <Input
                placeholder="Branş adını girin…"
                value={form.customBranch}
                onChange={(e) => set("customBranch", e.target.value)}
              />
            )}
          </div>
        </div>

        <Separator />

        {/* Notlar */}
        <div className="space-y-1.5">
          <Label htmlFor="teacher-notes">Notlar</Label>
          <textarea
            id="teacher-notes"
            rows={3}
            placeholder="Sertifikalar, deneyim veya özel durumlar…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </FormDrawer>
  );
}
