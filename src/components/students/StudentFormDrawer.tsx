"use client";

import { useState } from "react";
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
import { useStore } from "@/lib/data/store";
import { getStudentStatusLabel } from "@/lib/helpers/finance";
import { getActiveEducationTypes } from "@/lib/helpers/education-types";
import {
  formatStudentNumber,
  getNextStudentSequence,
  validateStudentFields,
  type StudentFormFields,
} from "@/lib/helpers/student-rules";
import { toLocalDateKey } from "@/lib/helpers/scheduling-rules";
import type { Student, StudentStatus } from "@/types";
import { cn } from "@/lib/utils";
import { createId, TENANT_ID } from "@/lib/data/ids";

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState extends StudentFormFields {
  status: StudentStatus;
  educationTypeIds: string[];
  weeklySessionCount: number;
  notes: string;
}

/** New students start with Ayarlar → Öğrenci ve Veli → Varsayılan Öğrenci Durumu. */
function buildEmpty(defaultStatus: StudentStatus): FormState {
  return {
    fullName: "",
    birthDate: "",
    status: defaultStatus,
    guardianId: "",
    studentNumber: "",
    kvkkConsent: false,
    healthInfo: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
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
    studentNumber: student.studentNumber ?? "",
    kvkkConsent: student.kvkkConsent ?? false,
    healthInfo: student.healthInfo ?? "",
    emergencyContactName: student.emergencyContactName ?? "",
    emergencyContactPhone: student.emergencyContactPhone ?? "",
    educationTypeIds: student.educationTypeIds,
    weeklySessionCount: student.weeklySessionCount ?? 0,
    notes: student.notes ?? "",
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-destructive">{message}</p> : null;
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
  const store = useStore();
  const isEditing = !!initialData;
  const rules = store.institutionSettings.students;

  const buildInitial = (): FormState => {
    if (initialData) return buildFromStudent(initialData);
    const empty = buildEmpty(rules.defaultStudentStatus);
    if (defaultGuardianId) empty.guardianId = defaultGuardianId;
    return empty;
  };

  const [form, setForm] = useState<FormState>(buildInitial);
  const [submitted, setSubmitted] = useState(false);

  // Reset when the drawer opens (or targets another record). Done during
  // render rather than in an effect so stale values never paint.
  const resetKey = open ? `${initialData?.id ?? ""}|${defaultGuardianId ?? ""}` : null;
  const [prevResetKey, setPrevResetKey] = useState<string | null>(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setForm(buildInitial());
      setSubmitted(false);
    }
  }

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  // Active-only for new selections, but never drops a type the student is
  // already tagged with (an inactive type must stay visible/checked on an
  // existing record — see AGENTS §5/§6).
  const activeEducationTypes = getActiveEducationTypes(store.educationTypes);
  const educationTypeOptions = [
    ...activeEducationTypes,
    ...store.educationTypes.filter(
      (et) => et.status === "inactive" && form.educationTypeIds.includes(et.id)
    ),
  ];

  const toggleEducationType = (id: string) => {
    setForm((prev) => ({
      ...prev,
      educationTypeIds: prev.educationTypeIds.includes(id)
        ? prev.educationTypeIds.filter((x) => x !== id)
        : [...prev.educationTypeIds, id],
    }));
  };

  // Ayarlar → Öğrenci ve Veli: required fields + unique student number.
  const otherStudents = store.students.filter((s) => s.id !== initialData?.id);
  const errors = validateStudentFields(form, rules, otherStudents);
  const shownErrors = submitted ? errors : {};
  const hasErrors = Object.keys(errors).length > 0;
  const nextAutoNumber = formatStudentNumber(rules.studentNumberFormat, getNextStudentSequence(store.students));

  const handleSave = () => {
    setSubmitted(true);
    if (hasErrors) return;

    const tenantId = initialData?.tenantId ?? TENANT_ID;
    const id = initialData?.id ?? createId("student");
    const previousPrimary = initialData?.guardianIds[0];
    // The form edits the primary guardian; any additional guardians (added from
    // a guardian's own page) stay linked unless multiple guardians are off.
    const extraGuardians = rules.allowMultipleGuardians
      ? (initialData?.guardianIds ?? []).filter((g) => g !== previousPrimary && g !== form.guardianId)
      : [];
    const guardianIds = form.guardianId ? [form.guardianId, ...extraGuardians] : extraGuardians;
    const kvkkConsentDate = form.kvkkConsent
      ? initialData?.kvkkConsent ? initialData.kvkkConsentDate : toLocalDateKey(new Date())
      : undefined;

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
      // Auto mode: the store assigns the number; manual mode: whatever was typed.
      studentNumber: rules.autoGenerateStudentNumber
        ? initialData?.studentNumber
        : form.studentNumber.trim() || undefined,
      studentSequence: initialData?.studentSequence,
      kvkkConsent: form.kvkkConsent || undefined,
      kvkkConsentDate,
      healthInfo: form.healthInfo.trim() || undefined,
      emergencyContactName: form.emergencyContactName.trim() || undefined,
      emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
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
      // Moving the student to another guardian unlinks the previous one.
      if (previousPrimary && previousPrimary !== form.guardianId && !guardianIds.includes(previousPrimary)) {
        const oldGuardian = store.guardians.find((g) => g.id === previousPrimary);
        if (oldGuardian) {
          store.updateGuardian({ ...oldGuardian, studentIds: oldGuardian.studentIds.filter((sid) => sid !== id) });
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
          <FieldError message={shownErrors.fullName} />
        </div>

        {/* Öğrenci No */}
        <div className="space-y-1.5">
          <Label htmlFor="student-number">Öğrenci No</Label>
          {rules.autoGenerateStudentNumber ? (
            <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground tabular-nums">
              {initialData?.studentNumber ?? `${nextAutoNumber} (otomatik atanacak)`}
            </p>
          ) : (
            <Input
              id="student-number"
              placeholder="örn. 2026-015"
              value={form.studentNumber}
              onChange={(e) => set("studentNumber", e.target.value)}
            />
          )}
          <FieldError message={shownErrors.studentNumber} />
        </div>

        {/* Doğum Tarihi */}
        <div className="space-y-1.5">
          <Label htmlFor="student-birth">
            Doğum Tarihi{rules.requireBirthDate && <span className="text-destructive"> *</span>}
          </Label>
          <Input
            id="student-birth"
            type="date"
            value={form.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
          />
          <FieldError message={shownErrors.birthDate} />
        </div>

        {/* Durum */}
        <div className="space-y-1.5">
          <Label>Durum</Label>
          <Select value={form.status} onValueChange={(v) => set("status", v as StudentStatus)}>
            <SelectTrigger aria-label="Durum">
              <SelectValue>{(val: StudentStatus) => getStudentStatusLabel(val)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{getStudentStatusLabel("active")}</SelectItem>
              <SelectItem value="on_hold">{getStudentStatusLabel("on_hold")}</SelectItem>
              <SelectItem value="inactive">{getStudentStatusLabel("inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Veli */}
        <div className="space-y-1.5">
          <Label>Veli{rules.guardianRequired && <span className="text-destructive"> *</span>}</Label>
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
              <SelectTrigger aria-label="Veli">
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
          <FieldError message={shownErrors.guardianId} />
        </div>

        {/* Acil durum kişisi */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="emergency-name">
              Acil Durum Kişisi{rules.requireEmergencyContact && <span className="text-destructive"> *</span>}
            </Label>
            <Input
              id="emergency-name"
              value={form.emergencyContactName}
              onChange={(e) => set("emergencyContactName", e.target.value)}
              placeholder="Ad soyad"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emergency-phone">Acil Durum Telefonu</Label>
            <Input
              id="emergency-phone"
              type="tel"
              value={form.emergencyContactPhone}
              onChange={(e) => set("emergencyContactPhone", e.target.value)}
              placeholder="05xx xxx xx xx"
            />
          </div>
        </div>
        <FieldError message={shownErrors.emergencyContactName} />

        {/* Sağlık bilgisi */}
        <div className="space-y-1.5">
          <Label htmlFor="student-health">
            Sağlık Bilgisi{rules.requireHealthInfo && <span className="text-destructive"> *</span>}
          </Label>
          <textarea
            id="student-health"
            rows={2}
            placeholder="Tanı, ilaç, alerji vb."
            value={form.healthInfo}
            onChange={(e) => set("healthInfo", e.target.value)}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <FieldError message={shownErrors.healthInfo} />
        </div>

        {/* KVKK */}
        <div className="space-y-1.5">
          <label
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer",
              shownErrors.kvkkConsent ? "border-destructive/50" : "border-border"
            )}
          >
            <input
              type="checkbox"
              className="mt-0.5 rounded"
              checked={form.kvkkConsent}
              onChange={(e) => set("kvkkConsent", e.target.checked)}
            />
            <span className="text-sm">
              Veliden KVKK aydınlatma onayı alındı
              {rules.requireKvkkConsent && <span className="text-destructive"> *</span>}
              {initialData?.kvkkConsentDate && form.kvkkConsent && (
                <span className="block text-xs text-muted-foreground">Onay tarihi: {initialData.kvkkConsentDate}</span>
              )}
            </span>
          </label>
          <FieldError message={shownErrors.kvkkConsent} />
        </div>

        <Separator />

        {/* Eğitim Türleri */}
        <div className="space-y-2">
          <Label>Eğitim Türleri</Label>
          <div className="space-y-2">
            {educationTypeOptions.map((et) => (
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
