"use client";

import { useState, useEffect } from "react";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import type { Teacher, TeacherStatus, TeacherEarningType } from "@/types";

// ─── Constants ─────────────────────────────────────────────────────────────────

const EARNING_TYPE_OPTIONS: { value: TeacherEarningType; label: string; description: string }[] = [
  {
    value: "per_session",
    label: "Seans Başına",
    description: "Her seans için sabit veya özel fiyat",
  },
  {
    value: "monthly_salary",
    label: "Aylık Maaş",
    description: "Sabit aylık maaş",
  },
  {
    value: "percentage",
    label: "Yüzde Hakediş",
    description: "Öğrenci ücretinin yüzdesi",
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
  earningPercentage: number;
  customPrices: Record<string, string>; // educationTypeId → amount string
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
    earningPercentage: 0,
    customPrices: {},
    notes: "",
  };
}

function buildFormFromTeacher(
  teacher: Teacher,
  existingCustomPrices: Record<string, string>
): FormState {
  const hasCustomBranch =
    !!teacher.customBranch && !mockEducationTypes.some((et) => et.id === teacher.customBranch);
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

  // Build existing custom prices map for the teacher being edited
  const existingPricesMap: Record<string, string> = {};
  if (initialData) {
    store.teacherCustomPrices
      .filter((tcp) => tcp.teacherId === initialData.id)
      .forEach((tcp) => {
        existingPricesMap[tcp.educationTypeId] = String(tcp.customEarning);
      });
  }

  const [form, setForm] = useState<FormState>(() =>
    initialData ? buildFormFromTeacher(initialData, existingPricesMap) : buildEmptyForm()
  );

  // Re-sync when initialData changes (e.g., opening a different teacher's edit drawer)
  useEffect(() => {
    if (open) {
      const map: Record<string, string> = {};
      if (initialData) {
        store.teacherCustomPrices
          .filter((tcp) => tcp.teacherId === initialData.id)
          .forEach((tcp) => {
            map[tcp.educationTypeId] = String(tcp.customEarning);
          });
      }
      setForm(
        initialData ? buildFormFromTeacher(initialData, map) : buildEmptyForm()
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

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

    const specializations = [
      ...form.specializationIds,
      ...(form.hasCustomBranch && form.customBranch.trim() ? [] : []),
    ];

    const teacher: Teacher = {
      id,
      tenantId,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      status: form.status,
      specializations,
      earningType: form.earningType,
      monthlySalary: form.earningType === "monthly_salary" ? form.monthlySalary : undefined,
      earningPercentage: form.earningType === "percentage" ? form.earningPercentage : undefined,
      customBranch: form.hasCustomBranch && form.customBranch.trim() ? form.customBranch.trim() : undefined,
      notes: form.notes.trim() || undefined,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };

    if (isEditing) {
      store.updateTeacher(teacher);
    } else {
      store.addTeacher(teacher);
    }

    // Upsert custom prices for per_session
    if (form.earningType === "per_session") {
      const prices = Object.entries(form.customPrices)
        .map(([educationTypeId, amt]) => ({
          educationTypeId,
          amount: parseFloat(amt) || 0,
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
      description="Öğretmen bilgilerini doldurun. Özel fiyatlar eğitim türüne göre ayarlanabilir."
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
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Pasif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Uzmanlık Alanları */}
        <div className="space-y-2">
          <Label>Uzmanlık Alanları</Label>
          <div className="space-y-2">
            {mockEducationTypes.map((et) => {
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
                    <p className="text-sm font-medium">{et.name}</p>
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
                className="ml-0"
              />
            )}
          </div>
        </div>

        <Separator />

        {/* Hakediş Tipi */}
        <div className="space-y-2">
          <Label>Hakediş Tipi</Label>
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

        {/* Monthly salary field */}
        {form.earningType === "monthly_salary" && (
          <div className="space-y-1.5">
            <Label htmlFor="monthly-salary">Aylık Maaş (₺)</Label>
            <Input
              id="monthly-salary"
              type="number"
              min={0}
              step={500}
              placeholder="0"
              value={form.monthlySalary || ""}
              onChange={(e) => set("monthlySalary", parseFloat(e.target.value) || 0)}
            />
          </div>
        )}

        {/* Percentage field */}
        {form.earningType === "percentage" && (
          <div className="space-y-1.5">
            <Label htmlFor="earning-pct">Hakediş Yüzdesi (%)</Label>
            <Input
              id="earning-pct"
              type="number"
              min={0}
              max={100}
              step={1}
              placeholder="0"
              value={form.earningPercentage || ""}
              onChange={(e) =>
                set("earningPercentage", Math.min(100, parseFloat(e.target.value) || 0))
              }
            />
            <p className="text-xs text-muted-foreground">
              Öğrenci seans ücretinin bu yüzdesi öğretmene ödenir.
            </p>
          </div>
        )}

        {/* Per-session custom prices */}
        {form.earningType === "per_session" && (
          <div className="space-y-2">
            <Label>Eğitim Türü Başına Hakediş (₺)</Label>
            <p className="text-xs text-muted-foreground">
              Boş bırakılırsa eğitim türünün varsayılan hakedişi kullanılır.
            </p>
            <div className="space-y-2">
              {mockEducationTypes.map((et) => (
                <div key={et.id} className="flex items-center gap-3">
                  <span className="flex-1 text-sm text-foreground truncate">{et.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    Varsayılan: ₺{et.defaultTeacherEarning}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={25}
                    placeholder={String(et.defaultTeacherEarning)}
                    value={form.customPrices[et.id] ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        customPrices: {
                          ...prev.customPrices,
                          [et.id]: e.target.value,
                        },
                      }))
                    }
                    className="w-24 shrink-0"
                  />
                </div>
              ))}
            </div>
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
