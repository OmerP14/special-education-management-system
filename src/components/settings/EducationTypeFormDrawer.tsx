"use client";

import { useState, useEffect } from "react";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useMockStore } from "@/lib/mock/store";
import {
  EDUCATION_TYPE_COLOR_PALETTE,
  getDefaultEducationTypeColor,
  getReadableTextColor,
  validateEducationTypeForm,
} from "@/lib/helpers/education-types";
import { cn } from "@/lib/utils";
import type { EducationType, EducationTypeStatus } from "@/types";

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  description: string;
  color: string;
  defaultDurationMinutes: number;
  defaultStudentPrice: number;
  status: EducationTypeStatus;
}

function buildEmptyForm(existingCount: number): FormState {
  return {
    name: "",
    description: "",
    color: getDefaultEducationTypeColor(existingCount),
    defaultDurationMinutes: 50,
    defaultStudentPrice: 0,
    status: "active",
  };
}

function buildFromEducationType(et: EducationType): FormState {
  return {
    name: et.name,
    description: et.description ?? "",
    color: et.color,
    defaultDurationMinutes: et.defaultDurationMinutes,
    defaultStudentPrice: et.defaultStudentPrice,
    status: et.status,
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface EducationTypeFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: EducationType;
  /** Called with the newly created/edited record right after it's saved — lets
   *  callers (e.g. the Excel Import repair flow) immediately select it without
   *  waiting for a re-render off store state. */
  onSaved?: (educationType: EducationType) => void;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function EducationTypeFormDrawer({
  open,
  onOpenChange,
  initialData,
  onSaved,
}: EducationTypeFormDrawerProps) {
  const store = useMockStore();
  const isEditing = !!initialData;

  const [form, setForm] = useState<FormState>(() =>
    initialData ? buildFromEducationType(initialData) : buildEmptyForm(store.educationTypes.length)
  );
  const [errors, setErrors] = useState<ReturnType<typeof validateEducationTypeForm>>({});

  useEffect(() => {
    if (open) {
      setForm(
        initialData
          ? buildFromEducationType(initialData)
          : buildEmptyForm(store.educationTypes.length)
      );
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    const validationErrors = validateEducationTypeForm(
      form,
      store.educationTypes,
      initialData?.id
    );
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const tenantId = initialData?.tenantId ?? "tenant-1";
    const id = initialData?.id ?? `et-${Date.now()}`;

    const educationType: EducationType = {
      id,
      tenantId,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      color: form.color,
      defaultDurationMinutes: form.defaultDurationMinutes,
      defaultStudentPrice: form.defaultStudentPrice,
      status: form.status,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };

    if (isEditing) {
      store.updateEducationType(educationType);
    } else {
      store.addEducationType(educationType);
    }

    onSaved?.(educationType);
    onOpenChange(false);
  };

  const title = isEditing ? "Eğitim Türü Düzenle" : "Yeni Eğitim Türü";
  const saveLabel = isEditing ? "Değişiklikleri Kaydet" : "Eğitim Türü Ekle";

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Kurumun sunduğu eğitim türünü tanımlayın. Varsayılan süre ve ücret yeni seans kayıtlarında otomatik doldurulur."
      onSave={handleSave}
      saveLabel={saveLabel}
    >
      <div className="space-y-5">
        {/* Eğitim Türü Adı */}
        <div className="space-y-1.5">
          <Label htmlFor="et-name">Eğitim Türü Adı</Label>
          <Input
            id="et-name"
            placeholder="Örn. Oyun Terapisi"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Açıklama */}
        <div className="space-y-1.5">
          <Label htmlFor="et-description">Açıklama</Label>
          <textarea
            id="et-description"
            rows={2}
            placeholder="Bu eğitim türü hakkında kısa açıklama…"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {/* Takvim Rengi */}
        <div className="space-y-1.5">
          <Label>Takvim Rengi</Label>
          <div className="flex flex-wrap gap-2">
            {EDUCATION_TYPE_COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => set("color", color)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform",
                  form.color === color ? "border-foreground scale-110" : "border-transparent"
                )}
                style={{ backgroundColor: color }}
                aria-label={color}
              >
                {form.color === color && (
                  <span
                    className="text-xs font-bold"
                    style={{ color: getReadableTextColor(color) }}
                  >
                    ✓
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Varsayılan Seans Süresi */}
        <div className="space-y-1.5">
          <Label htmlFor="et-duration">Varsayılan Seans Süresi (dakika)</Label>
          <NumericInput
            id="et-duration"
            min={1}
            integer
            value={form.defaultDurationMinutes}
            onValueChange={(v) => set("defaultDurationMinutes", v ?? 0)}
            className="w-32"
          />
          {errors.defaultDurationMinutes && (
            <p className="text-xs text-destructive">{errors.defaultDurationMinutes}</p>
          )}
        </div>

        {/* Varsayılan Öğrenci Ücreti */}
        <div className="space-y-1.5">
          <Label htmlFor="et-price">Varsayılan Öğrenci Ücreti (₺)</Label>
          <NumericInput
            id="et-price"
            min={0}
            step={25}
            value={form.defaultStudentPrice}
            onValueChange={(v) => set("defaultStudentPrice", v ?? 0)}
            className="w-32"
          />
          {errors.defaultStudentPrice && (
            <p className="text-xs text-destructive">{errors.defaultStudentPrice}</p>
          )}
        </div>

        {/* Durum */}
        <div className="space-y-1.5">
          <Label>Durum</Label>
          <Select
            value={form.status}
            onValueChange={(val) => set("status", val as EducationTypeStatus)}
          >
            <SelectTrigger>
              <SelectValue>{form.status === "active" ? "Aktif" : "Pasif"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="inactive">Pasif</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Pasif eğitim türleri yeni kayıtlarda seçilemez; geçmiş kayıtlarda görünmeye devam eder.
          </p>
        </div>
      </div>
    </FormDrawer>
  );
}
