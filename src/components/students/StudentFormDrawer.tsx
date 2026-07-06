"use client";

import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
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
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import type { Student, StudentStatus } from "@/types";

// ─── Status labels ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Aktif",
  on_hold: "Beklemede",
  inactive: "Pasif",
};

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  fullName: string;
  birthDate: string;
  status: StudentStatus;
  guardianId: string;
  educationTypeIds: string[];
  weeklySessionCount: number;
  notes: string;
}

function buildEmpty(): FormState {
  return {
    fullName: "",
    birthDate: "",
    status: "active",
    guardianId: "",
    educationTypeIds: [],
    weeklySessionCount: 0,
    notes: "",
  };
}

function buildFromStudent(student: Student): FormState {
  return {
    fullName: student.fullName,
    birthDate: student.birthDate,
    status: student.status,
    guardianId: student.guardianIds[0] ?? "",
    educationTypeIds: student.educationTypeIds,
    weeklySessionCount: student.weeklySessionCount ?? 0,
    notes: student.notes ?? "",
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface StudentFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Student;
  /** When set, pre-selects and locks this guardian so the student is always linked. */
  defaultGuardianId?: string;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function StudentFormDrawer({
  open,
  onOpenChange,
  initialData,
  defaultGuardianId,
}: StudentFormDrawerProps) {
  const store = useMockStore();
  const isEditing = !!initialData;

  const buildInitial = (): FormState => {
    if (initialData) return buildFromStudent(initialData);
    const empty = buildEmpty();
    if (defaultGuardianId) empty.guardianId = defaultGuardianId;
    return empty;
  };

  const [form, setForm] = useState<FormState>(buildInitial);

  useEffect(() => {
    if (open) {
      const f = initialData ? buildFromStudent(initialData) : buildEmpty();
      if (!initialData && defaultGuardianId) f.guardianId = defaultGuardianId;
      setForm(f);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id, defaultGuardianId]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const toggleEducationType = (id: string) => {
    setForm((prev) => ({
      ...prev,
      educationTypeIds: prev.educationTypeIds.includes(id)
        ? prev.educationTypeIds.filter((x) => x !== id)
        : [...prev.educationTypeIds, id],
    }));
  };

  const handleSave = () => {
    if (!form.fullName.trim()) return;

    const tenantId = initialData?.tenantId ?? "tenant-1";
    const id = initialData?.id ?? `student-${Date.now()}`;
    const guardianIds = form.guardianId ? [form.guardianId] : [];

    const student: Student = {
      id,
      tenantId,
      fullName: form.fullName.trim(),
      birthDate: form.birthDate,
      status: form.status,
      guardianIds,
      educationTypeIds: form.educationTypeIds,
      weeklySessionCount: form.weeklySessionCount > 0 ? form.weeklySessionCount : undefined,
      assignedTeacherIds: initialData?.assignedTeacherIds ?? [],
      notes: form.notes.trim() || undefined,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };

    if (isEditing) {
      store.updateStudent(student);
      if (form.guardianId) {
        const guardian = store.guardians.find((g) => g.id === form.guardianId);
        if (guardian && !guardian.studentIds.includes(id)) {
          store.updateGuardian({ ...guardian, studentIds: [...guardian.studentIds, id] });
        }
      }
    } else {
      store.addStudent(student);
      if (form.guardianId) {
        const guardian = store.guardians.find((g) => g.id === form.guardianId);
        if (guardian) {
          store.updateGuardian({ ...guardian, studentIds: [...guardian.studentIds, id] });
        }
      }
    }

    onOpenChange(false);
  };

  // Guardian display name for SelectValue
  const guardianDisplayName = form.guardianId
    ? (store.guardians.find((g) => g.id === form.guardianId)?.fullName ?? null)
    : null;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Öğrenci Düzenle" : "Yeni Öğrenci"}
      description="Öğrenci bilgilerini doldurun. Veli kaydı önceden oluşturulmuş olmalıdır."
      onSave={handleSave}
      saveLabel={isEditing ? "Değişiklikleri Kaydet" : "Öğrenci Ekle"}
    >
      <div className="space-y-5">
        {/* Ad Soyad */}
        <div className="space-y-1.5">
          <Label htmlFor="student-name">Ad Soyad</Label>
          <Input
            id="student-name"
            placeholder="Öğrenci adı ve soyadı"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
          />
        </div>

        {/* Doğum Tarihi */}
        <div className="space-y-1.5">
          <Label htmlFor="student-birth">Doğum Tarihi</Label>
          <Input
            id="student-birth"
            type="date"
            value={form.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
          />
        </div>

        {/* Durum */}
        <div className="space-y-1.5">
          <Label>Durum</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v as StudentStatus)}>
            <SelectTrigger>
              <SelectValue>{STATUS_LABELS[form.status]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="on_hold">Beklemede</SelectItem>
              <SelectItem value="inactive">Pasif</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Veli */}
        <div className="space-y-1.5">
          <Label>Veli</Label>
          {defaultGuardianId && !isEditing ? (
            (() => {
              const g = store.guardians.find((x) => x.id === defaultGuardianId);
              return (
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{g?.fullName ?? "—"}</p>
                    {g?.relationship && (
                      <p className="text-xs text-muted-foreground">{g.relationship}</p>
                    )}
                  </div>
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              );
            })()
          ) : (
            <Select
              value={form.guardianId || ""}
              onValueChange={(v) => { if (v) set("guardianId", v); }}
            >
              <SelectTrigger>
                <SelectValue className={!form.guardianId ? "text-muted-foreground" : ""}>
                  {guardianDisplayName ?? "Veli seçin"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {store.guardians.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.fullName}
                    <span className="ml-1 text-muted-foreground text-xs">({g.relationship})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(!defaultGuardianId || isEditing) && (
            <p className="text-xs text-muted-foreground">
              Veliler sekmesinden yeni veli kaydı oluşturabilirsiniz.
            </p>
          )}
        </div>

        <Separator />

        {/* Eğitim Türleri */}
        <div className="space-y-2">
          <Label>Eğitim Türleri</Label>
          <div className="space-y-2">
            {mockEducationTypes.map((et) => (
              <label
                key={et.id}
                className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <input
                  type="checkbox"
                  className="rounded"
                  checked={form.educationTypeIds.includes(et.id)}
                  onChange={() => toggleEducationType(et.id)}
                />
                <div>
                  <p className="text-sm font-medium">{et.name}</p>
                  {et.description && (
                    <p className="text-xs text-muted-foreground">{et.description}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* Planlanan Haftalık Seans (bilgi amaçlı) */}
        <div className="space-y-1.5">
          <Label htmlFor="weekly-session">Planlanan Haftalık Seans</Label>
          <NumericInput
            id="weekly-session"
            min={0}
            max={20}
            integer
            placeholder="0"
            value={form.weeklySessionCount}
            transform={(v) => Math.max(0, v)}
            onValueChange={(v) => set("weeklySessionCount", v ?? 0)}
          />
          <p className="text-xs text-muted-foreground">
            Bilgilendirme amaçlıdır. Gerçek seans programı Seanslar bölümünden oluşturulur.
          </p>
        </div>

        {/* Notlar */}
        <div className="space-y-1.5">
          <Label htmlFor="student-notes">Notlar</Label>
          <textarea
            id="student-notes"
            rows={3}
            placeholder="Tanı, özel durum veya dikkat edilmesi gerekenler…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </FormDrawer>
  );
}
