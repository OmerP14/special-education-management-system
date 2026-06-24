"use client";

import { useState, useEffect } from "react";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useMockStore } from "@/lib/mock/store";
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

  useEffect(() => {
    if (open) {
      setForm(initialData ? buildFromGuardian(initialData) : buildEmpty());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id]);

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

    // Sync selected students' guardianIds
    form.studentIds.forEach((sid) => {
      const student = store.students.find((s) => s.id === sid);
      if (student && !student.guardianIds.includes(id)) {
        store.updateStudent({ ...student, guardianIds: [...student.guardianIds, id] });
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
              {store.students.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={form.studentIds.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                  />
                  <div>
                    <p className="text-sm font-medium">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{s.status}</p>
                  </div>
                </label>
              ))}
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
