"use client";

import { useState } from "react";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMockStore } from "@/lib/mock/store";
import { cn } from "@/lib/utils";
import { getStudentIdsWithOtherGuardian } from "@/lib/helpers/student-rules";
import { getStudentStatusLabel } from "@/lib/helpers/finance";
import type { Guardian } from "@/types";

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  fullName: string;
  phone: string;
  email: string;
  relationship: string;
  customRelationship: string;
  address: string;
  studentIds: string[];
  notes: string;
}

const RELATIONSHIP_OPTIONS = ["Anne", "Baba", "Veli", "Büyükanne", "Büyükbaba", "Diğer"];

function buildEmpty(): FormState {
  return {
    fullName: "",
    phone: "",
    email: "",
    relationship: "Anne",
    customRelationship: "",
    address: "",
    studentIds: [],
    notes: "",
  };
}

function buildFromGuardian(guardian: Guardian): FormState {
  const isCustom = !RELATIONSHIP_OPTIONS.slice(0, -1).includes(guardian.relationship);
  return {
    fullName: guardian.fullName,
    phone: guardian.phone,
    email: guardian.email ?? "",
    relationship: isCustom ? "Diğer" : guardian.relationship,
    customRelationship: isCustom ? guardian.relationship : "",
    address: guardian.address ?? "",
    studentIds: guardian.studentIds,
    notes: guardian.notes ?? "",
  };
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface GuardianFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Guardian;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function GuardianFormDrawer({
  open,
  onOpenChange,
  initialData,
}: GuardianFormDrawerProps) {
  const store = useMockStore();
  const isEditing = !!initialData;

  const [form, setForm] = useState<FormState>(() =>
    initialData ? buildFromGuardian(initialData) : buildEmpty()
  );

  // Reset when the drawer opens (or targets another record). Done during
  // render rather than in an effect so stale values never paint.
  const resetKey = open ? initialData?.id ?? "" : null;
  const [prevResetKey, setPrevResetKey] = useState<string | null>(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    if (open) {
      setForm(initialData ? buildFromGuardian(initialData) : buildEmpty());
    }
  }

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const toggleStudent = (id: string) => {
    setForm((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(id)
        ? prev.studentIds.filter((x) => x !== id)
        : [...prev.studentIds, id],
    }));
  };

  const studentsWithOtherGuardian = getStudentIdsWithOtherGuardian(store.guardians, initialData?.id);

  const handleSave = () => {
    if (!form.fullName.trim() || !form.phone.trim()) return;

    const tenantId = initialData?.tenantId ?? "tenant-1";
    const id = initialData?.id ?? `guardian-${Date.now()}`;
    const relationship =
      form.relationship === "Diğer" && form.customRelationship.trim()
        ? form.customRelationship.trim()
        : form.relationship;

    const guardian: Guardian = {
      id,
      tenantId,
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      relationship,
      studentIds: form.studentIds,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };

    if (isEditing) {
      store.updateGuardian(guardian);
    } else {
      store.addGuardian(guardian);
    }

    // Sync students' guardianIds both ways: newly linked students gain this
    // guardian, unlinked ones lose it.
    form.studentIds.forEach((sid) => {
      const student = store.students.find((s) => s.id === sid);
      if (student && !student.guardianIds.includes(id)) {
        store.updateStudent({ ...student, guardianIds: [...student.guardianIds, id] });
      }
    });
    (initialData?.studentIds ?? [])
      .filter((sid) => !form.studentIds.includes(sid))
      .forEach((sid) => {
        const student = store.students.find((s) => s.id === sid);
        if (student?.guardianIds.includes(id)) {
          store.updateStudent({ ...student, guardianIds: student.guardianIds.filter((g) => g !== id) });
        }
      });

    onOpenChange(false);
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Veli Düzenle" : "Yeni Veli"}
      description="Veli bilgilerini doldurun. Bağlı öğrencileri ilişkilendirin."
      onSave={handleSave}
      saveLabel={isEditing ? "Değişiklikleri Kaydet" : "Veli Ekle"}
    >
      <div className="space-y-5">
        {/* Ad Soyad */}
        <div className="space-y-1.5">
          <Label htmlFor="guardian-name">Ad Soyad</Label>
          <Input
            id="guardian-name"
            placeholder="Veli adı ve soyadı"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
          />
        </div>

        {/* Telefon */}
        <div className="space-y-1.5">
          <Label htmlFor="guardian-phone">Telefon</Label>
          <Input
            id="guardian-phone"
            type="tel"
            placeholder="05XX XXX XX XX"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>

        {/* E-posta */}
        <div className="space-y-1.5">
          <Label htmlFor="guardian-email">E-posta</Label>
          <Input
            id="guardian-email"
            type="email"
            placeholder="veli@ornek.com"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
          />
          {initialData && store.appUsers.some((u) => u.guardianId === initialData.id && u.status !== "inactive") && (
            <p className="text-xs text-muted-foreground">
              Bu velinin giriş hesabı var: ad ve e-posta hesaba da yansır, veli yeni e-postayla giriş yapar.
            </p>
          )}
        </div>

        {/* Yakınlık */}
        <div className="space-y-1.5">
          <Label>Yakınlık</Label>
          <div className="flex flex-wrap gap-2">
            {RELATIONSHIP_OPTIONS.map((rel) => (
              <button
                key={rel}
                type="button"
                onClick={() => set("relationship", rel)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors border",
                  form.relationship === rel
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                ].join(" ")}
              >
                {rel}
              </button>
            ))}
          </div>
          {form.relationship === "Diğer" && (
            <Input
              placeholder="Yakınlık derecesini girin…"
              value={form.customRelationship}
              onChange={(e) => set("customRelationship", e.target.value)}
            />
          )}
        </div>

        {/* Adres */}
        <div className="space-y-1.5">
          <Label htmlFor="guardian-address">Adres</Label>
          <textarea
            id="guardian-address"
            rows={2}
            placeholder="Ev veya iletişim adresi…"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <Separator />

        {/* Bağlı Öğrenciler */}
        {store.students.length > 0 && (
          <div className="space-y-2">
            <Label>Bağlı Öğrenciler</Label>
            <div className="space-y-2">
              {store.students.map((s) => {
                // Ayarlar → Öğrenci ve Veli → Birden fazla veliye izin ver
                const takenElsewhere =
                  !store.institutionSettings.students.allowMultipleGuardians &&
                  studentsWithOtherGuardian.has(s.id) &&
                  !form.studentIds.includes(s.id);
                return (
                <label
                  key={s.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors",
                    takenElsewhere ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/50"
                  )}
                >
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={form.studentIds.includes(s.id)}
                    disabled={takenElsewhere}
                    onChange={() => toggleStudent(s.id)}
                  />
                  <div>
                    <p className="text-sm font-medium">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {takenElsewhere ? "Başka bir veliye bağlı" : getStudentStatusLabel(s.status)}
                    </p>
                  </div>
                </label>
                );
              })}
            </div>
          </div>
        )}

        <Separator />

        {/* Notlar */}
        <div className="space-y-1.5">
          <Label htmlFor="guardian-notes">Notlar</Label>
          <textarea
            id="guardian-notes"
            rows={3}
            placeholder="Özel durumlar veya iletişim notları…"
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
    </FormDrawer>
  );
}
