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
import type { EducationType, Teacher, TeacherStatus, TeacherEarningType } from "@/types";

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

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  status: TeacherStatus;
  specializationIds: string[];
  hasCustomBranch: boolean;
  customBranch: string;
  earningType: TeacherEarningType;
  monthlySalary: number;
  monthlySessionQuota: number;
  extraSessionRate: number;
  earningPercentage: number;
  customPrices: Record<string, number | undefined>; // educationTypeId → amount (undefined = not set)
  notes: string;
}

function buildEmptyForm(): FormState {
  return {
    fullName: "",
    phone: "",
    email: "",
    status: "active",
    specializationIds: [],
    hasCustomBranch: false,
    customBranch: "",
    earningType: "per_session",
    monthlySalary: 0,
    monthlySessionQuota: 0,
    extraSessionRate: 0,
    earningPercentage: 0,
    customPrices: {},
    notes: "",
  };
}

function buildFormFromTeacher(
  teacher: Teacher,
  existingCustomPrices: Record<string, number | undefined>,
  educationTypes: EducationType[]
): FormState {
  const hasCustomBranch =
    !!teacher.customBranch && !educationTypes.some((et) => et.id === teacher.customBranch);
  return {
    fullName: teacher.fullName,
    phone: teacher.phone,
    email: teacher.email ?? "",
    status: teacher.status,
    specializationIds: teacher.specializations,
    hasCustomBranch,
    customBranch: teacher.customBranch ?? "",
    earningType: teacher.earningType ?? "per_session",
    monthlySalary: teacher.monthlySalary ?? 0,
    monthlySessionQuota: teacher.includedSessionQuota ?? 0,
    extraSessionRate: teacher.extraSessionEarning ?? 0,
    earningPercentage: teacher.earningPercentage ?? 0,
    customPrices: existingCustomPrices,
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

  const buildExistingPricesMap = (): Record<string, number | undefined> => {
    const map: Record<string, number | undefined> = {};
    if (initialData) {
      store.teacherCustomPrices
        .filter((tcp) => tcp.teacherId === initialData.id)
        .forEach((tcp) => {
          map[tcp.educationTypeId] = tcp.customEarning;
        });
    }
    return map;
  };

  const [form, setForm] = useState<FormState>(() =>
    initialData
      ? buildFormFromTeacher(initialData, buildExistingPricesMap(), store.educationTypes)
      : buildEmptyForm()
  );

  useEffect(() => {
    if (open) {
      const map = buildExistingPricesMap();
      setForm(
        initialData
          ? buildFormFromTeacher(initialData, map, store.educationTypes)
          : buildEmptyForm()
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // Active-only for new specialization picks, but never drops one the teacher
  // is already assigned (an inactive type must stay visible/checked on an
  // existing record — see AGENTS §5/§6).
  const activeEducationTypes = getActiveEducationTypes(store.educationTypes);
  const specializationOptions = [
    ...activeEducationTypes,
    ...store.educationTypes.filter(
      (et) => et.status === "inactive" && form.specializationIds.includes(et.id)
    ),
  ];

  const toggleSpecialization = (id: string) => {
    setForm((prev) => ({
      ...prev,
      specializationIds: prev.specializationIds.includes(id)
        ? prev.specializationIds.filter((x) => x !== id)
        : [...prev.specializationIds, id],
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
      specializations: form.specializationIds,
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

    // Per-session teachers: persist configured custom prices
    if (form.earningType === "per_session") {
      const prices = Object.entries(form.customPrices)
        .map(([educationTypeId, amt]) => ({
          educationTypeId,
          amount: amt ?? 0,
        }))
        .filter((p) => p.amount > 0);
      store.upsertTeacherCustomPricesForTeacher(id, tenantId, prices);
    } else {
      store.upsertTeacherCustomPricesForTeacher(id, tenantId, []);
    }

    onOpenChange(false);
  };

  const title = isEditing ? "Öğretmen Düzenle" : "Yeni Öğretmen";
  const saveLabel = isEditing ? "Değişiklikleri Kaydet" : "Öğretmen Ekle";

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

        {/* Uzmanlık Alanları */}
        <div className="space-y-2">
          <Label>Uzmanlık Alanları</Label>
          <div className="space-y-2">
            {specializationOptions.map((et) => {
              const checked = form.specializationIds.includes(et.id);
              return (
                <label
                  key={et.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={checked}
                    onChange={() => toggleSpecialization(et.id)}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {et.name}
                      {et.status === "inactive" && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">(Pasif)</span>
                      )}
                    </p>
                    {et.description && (
                      <p className="text-xs text-muted-foreground">{et.description}</p>
                    )}
                  </div>
                </label>
              );
            })}
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

        {/* Seans Başı fiyatları — yalnızca seçili uzmanlıklara göre */}
        {form.earningType === "per_session" && (
          <div className="space-y-2">
            <Label>Uzmanlık Alanına Göre Seans Hakedişi (₺)</Label>
            {form.specializationIds.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border px-3 py-2.5">
                Hakediş tanımlamak için önce uzmanlık alanı seçiniz.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Her uzmanlık için özel hakediş girin. Girilmezse o eğitim türüne özel
                  fiyat tanımsız kalır ve seans kaydında uyarı gösterilir.
                </p>
                <div className="space-y-2">
                  {store.educationTypes
                    .filter((et) => form.specializationIds.includes(et.id))
                    .map((et) => (
                      <div key={et.id} className="flex items-center gap-3">
                        <span className="flex-1 text-sm text-foreground truncate">
                          {et.name}
                        </span>
                        <NumericInput
                          min={0}
                          step={25}
                          placeholder="Tanımsız"
                          value={form.customPrices[et.id]}
                          allowUndefined
                          onValueChange={(v) =>
                            setForm((prev) => ({
                              ...prev,
                              customPrices: {
                                ...prev.customPrices,
                                [et.id]: v,
                              },
                            }))
                          }
                          className="w-28 shrink-0"
                        />
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        )}

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
