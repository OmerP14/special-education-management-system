"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { FormDrawer } from "@/components/shared/FormDrawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mockEducationTypes } from "@/lib/mock/education-types";
import { useMockStore } from "@/lib/mock/store";
import {
  getDefaultStudentPrice,
  getDefaultTeacherEarningPrice,
  getTeacherCustomPriceForEducationType,
  getStudentGuardian,
  formatCurrency,
} from "@/lib/helpers/finance";
import type { Session, SessionStatus } from "@/types";
import { cn } from "@/lib/utils";

// ─── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: "planned", label: "Planlandı" },
  { value: "completed", label: "Tamamlandı" },
  { value: "cancelled", label: "İptal" },
  { value: "no_show", label: "Gelmedi" },
  { value: "makeup", label: "Telafi" },
];

// ─── Preview row ───────────────────────────────────────────────────────────────

function PreviewRow({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: "neutral" | "warning" | "success";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-semibold tabular-nums",
          variant === "neutral" && "text-foreground",
          variant === "warning" && "text-amber-600",
          variant === "success" && "text-emerald-600"
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  studentId: string;
  teacherId: string;
  educationTypeId: string;
  date: string;
  time: string;
  sessionCount: number;
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
  sessionCount: 1,
  studentPrice: 0,
  teacherEarningPrice: 0,
  status: "planned",
  notes: "",
};

function buildFromSession(session: Session): FormState {
  const dateObj = new Date(session.date);
  const dateStr = dateObj.toISOString().split("T")[0];
  const timeStr = dateObj.toISOString().split("T")[1]?.slice(0, 5) ?? "";
  return {
    studentId: session.studentId,
    teacherId: session.teacherId,
    educationTypeId: session.educationTypeId,
    date: dateStr,
    time: timeStr,
    sessionCount: session.sessionCount,
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
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SessionFormDrawer({
  open,
  onOpenChange,
  initialData,
}: SessionFormDrawerProps) {
  const store = useMockStore();
  const isEditing = !!initialData;

  const [form, setForm] = useState<FormState>(() =>
    initialData ? buildFromSession(initialData) : EMPTY_FORM
  );

  useEffect(() => {
    if (open) {
      setForm(initialData ? buildFromSession(initialData) : EMPTY_FORM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialData?.id]);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleTeacherChange = (teacherId: string) => {
    set("teacherId", teacherId);
    if (form.educationTypeId) {
      const custom = getTeacherCustomPriceForEducationType(
        teacherId,
        form.educationTypeId,
        store.teacherCustomPrices
      );
      set(
        "teacherEarningPrice",
        custom ?? getDefaultTeacherEarningPrice(form.educationTypeId, mockEducationTypes)
      );
    }
  };

  const handleEducationTypeChange = (etId: string) => {
    setForm((prev) => {
      const defaultStudent = getDefaultStudentPrice(etId, mockEducationTypes);
      const custom = prev.teacherId
        ? getTeacherCustomPriceForEducationType(
            prev.teacherId,
            etId,
            store.teacherCustomPrices
          )
        : null;
      const teacherEarning =
        custom ?? getDefaultTeacherEarningPrice(etId, mockEducationTypes);
      return {
        ...prev,
        educationTypeId: etId,
        studentPrice: defaultStudent,
        teacherEarningPrice: teacherEarning,
      };
    });
  };

  const handleSave = () => {
    if (!form.studentId || !form.teacherId || !form.educationTypeId || !form.date) return;

    const tenantId = initialData?.tenantId ?? "tenant-1";
    const id = initialData?.id ?? `session-${Date.now()}`;
    const dateStr = form.time ? `${form.date}T${form.time}:00Z` : `${form.date}T00:00:00Z`;

    const session: Session = {
      id,
      tenantId,
      studentId: form.studentId,
      teacherId: form.teacherId,
      educationTypeId: form.educationTypeId,
      date: dateStr,
      durationMinutes: initialData?.durationMinutes ?? 50,
      sessionCount: form.sessionCount,
      studentPrice: form.studentPrice,
      teacherEarning: form.teacherEarningPrice,
      status: form.status,
      notes: form.notes.trim() || undefined,
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };

    if (isEditing) {
      store.updateSession(session);
    } else {
      store.addSession(session);
    }

    onOpenChange(false);
  };

  // Derived values
  const connectedGuardian = form.studentId
    ? getStudentGuardian(form.studentId, store.students, store.guardians)
    : null;
  const previewTotal = form.studentPrice * form.sessionCount;
  const previewTeacherEarning = form.teacherEarningPrice * form.sessionCount;
  const previewCenterProfit = previewTotal - previewTeacherEarning;

  const hasCustomPrice =
    !!form.teacherId &&
    !!form.educationTypeId &&
    getTeacherCustomPriceForEducationType(
      form.teacherId,
      form.educationTypeId,
      store.teacherCustomPrices
    ) !== null;

  const showPreview = !!form.educationTypeId;
  const activeStudents = store.students.filter((s) => s.status !== "inactive");
  const activeTeachers = store.teachers.filter((t) => t.status === "active");

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? "Seans Düzenle" : "Yeni Seans"}
      description="Eğitim türü seçildiğinde fiyatlar otomatik dolar. Dilerseniz manuel olarak değiştirebilirsiniz."
      onSave={handleSave}
      saveLabel={isEditing ? "Değişiklikleri Kaydet" : "Seans Ekle"}
    >
      <div className="space-y-5">
        {/* Öğrenci */}
        <div className="space-y-1.5">
          <Label>Öğrenci</Label>
          <Select
            value={form.studentId || ""}
            onValueChange={(val) => { if (val) set("studentId", val); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Öğrenci seçin" />
            </SelectTrigger>
            <SelectContent>
              {activeStudents.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Connected Veli info */}
        {connectedGuardian && (
          <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">
                Bağlı Veli
              </p>
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
          <Select
            value={form.teacherId || ""}
            onValueChange={(val) => { if (val) handleTeacherChange(val); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Öğretmen seçin" />
            </SelectTrigger>
            <SelectContent>
              {activeTeachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Eğitim Türü */}
        <div className="space-y-1.5">
          <Label>Eğitim Türü</Label>
          <Select
            value={form.educationTypeId || ""}
            onValueChange={(val) => { if (val) handleEducationTypeChange(val); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Eğitim türü seçin" />
            </SelectTrigger>
            <SelectContent>
              {mockEducationTypes.map((et) => (
                <SelectItem key={et.id} value={et.id}>
                  {et.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tarih + Saat */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="session-date">Tarih</Label>
            <Input
              id="session-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="session-time">Saat</Label>
            <Input
              id="session-time"
              type="time"
              value={form.time}
              onChange={(e) => set("time", e.target.value)}
            />
          </div>
        </div>

        {/* Seans Sayısı */}
        <div className="space-y-1.5">
          <Label htmlFor="session-count">Seans Sayısı</Label>
          <Input
            id="session-count"
            type="number"
            min={1}
            value={form.sessionCount}
            onChange={(e) =>
              set("sessionCount", Math.max(1, parseInt(e.target.value) || 1))
            }
          />
        </div>

        {/* Fiyatlar */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="student-price">Öğrenci Birim Fiyatı (₺)</Label>
            <Input
              id="student-price"
              type="number"
              min={0}
              value={form.studentPrice}
              onChange={(e) => set("studentPrice", parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="teacher-earning">
              Öğretmen Hakedişi (₺)
              {hasCustomPrice && (
                <span className="ml-1 inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary leading-none">
                  Özel
                </span>
              )}
            </Label>
            <Input
              id="teacher-earning"
              type="number"
              min={0}
              value={form.teacherEarningPrice}
              onChange={(e) =>
                set("teacherEarningPrice", parseFloat(e.target.value) || 0)
              }
            />
          </div>
        </div>

        {/* Durum */}
        <div className="space-y-1.5">
          <Label>Durum</Label>
          <Select
            value={form.status}
            onValueChange={(val) => set("status", val as SessionStatus)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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

        {/* Ön İzleme */}
        {showPreview && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ön İzleme
              </p>
              <div className="rounded-lg bg-muted/50 p-3 space-y-2.5">
                <PreviewRow
                  label={`Toplam Tutar (${form.sessionCount} × ₺${form.studentPrice})`}
                  value={formatCurrency(previewTotal)}
                  variant="neutral"
                />
                <PreviewRow
                  label={`Öğretmen Hakedişi (${form.sessionCount} × ₺${form.teacherEarningPrice})`}
                  value={formatCurrency(previewTeacherEarning)}
                  variant="warning"
                />
                <div className="border-t border-border/60 pt-2.5">
                  <PreviewRow
                    label="Merkez Kârı"
                    value={formatCurrency(previewCenterProfit)}
                    variant="success"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </FormDrawer>
  );
}
