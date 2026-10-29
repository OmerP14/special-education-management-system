"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { SettingsField } from "@/components/settings/SettingsField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateDMY } from "@/lib/helpers/finance";
import type { CalendarSettings } from "@/types/settings";
import { createId } from "@/lib/data/ids";

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "Pazartesi" },
  { value: 2, label: "Salı" },
  { value: 3, label: "Çarşamba" },
  { value: 4, label: "Perşembe" },
  { value: 5, label: "Cuma" },
  { value: 6, label: "Cumartesi" },
  { value: 0, label: "Pazar" },
];

function CalendarSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel } =
    useSettingsSection("calendar");
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayLabel, setNewHolidayLabel] = useState("");

  const set = <K extends keyof CalendarSettings>(key: K, value: CalendarSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleWorkingDay = (day: number) => {
    const has = draft.workingDays.includes(day);
    set(
      "workingDays",
      has ? draft.workingDays.filter((d) => d !== day) : [...draft.workingDays, day].sort()
    );
  };

  const addHoliday = () => {
    if (!newHolidayDate || !newHolidayLabel.trim()) return;
    set("holidays", [
      ...draft.holidays,
      { id: createId("holiday"), date: newHolidayDate, label: newHolidayLabel.trim() },
    ]);
    setNewHolidayDate("");
    setNewHolidayLabel("");
  };

  const removeHoliday = (id: string) => {
    set("holidays", draft.holidays.filter((h) => h.id !== id));
  };

  return (
    <SettingsFormSection
      title="Çalışma Saatleri"
      description="Kurumun açık olduğu günler ve saatler. Kapalı günlere, saatlere ve tatillere ders girilirken sistem uyarır; tekrarlanan dersler tatil günlerini atlar."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      onSave={save}
      onCancel={cancel}
    >
      {/* Working days */}
      <SettingsField label="Açık olduğunuz günler" description="Seçili günler koyu renkte görünür. Değiştirmek için güne dokunun." error={errors.workingDays}>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleWorkingDay(d.value)}
              aria-pressed={draft.workingDays.includes(d.value)}
              className={cn(
                "rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
                draft.workingDays.includes(d.value)
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </SettingsField>

      {/* Hours */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SettingsField label="Açılış saati" error={errors.dayEndTime}>
          <Input type="time" value={draft.dayStartTime} onChange={(e) => set("dayStartTime", e.target.value)} />
        </SettingsField>
        <SettingsField label="Kapanış saati">
          <Input type="time" value={draft.dayEndTime} onChange={(e) => set("dayEndTime", e.target.value)} />
        </SettingsField>
        <SettingsField label="Öğle arası başlangıcı" description="Öğle arası yoksa boş bırakın.">
          <Input
            type="time"
            value={draft.lunchBreakStart ?? ""}
            onChange={(e) => set("lunchBreakStart", e.target.value || null)}
          />
        </SettingsField>
        <SettingsField label="Öğle arası bitişi">
          <Input
            type="time"
            value={draft.lunchBreakEnd ?? ""}
            onChange={(e) => set("lunchBreakEnd", e.target.value || null)}
          />
        </SettingsField>
      </div>

      {/* Holidays */}
      <div className="space-y-3 border-t border-border/60 pt-5">
        <p className="text-base font-semibold text-foreground">Tatil Günleri</p>
        <p className="text-sm text-muted-foreground">Tarihi ve adını yazıp Ekle&apos;ye basın. Değişikliği en altta Kaydet ile saklayın.</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tarih</label>
            <Input aria-label="Tatil tarihi" type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} className="w-40" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="text-sm font-medium text-foreground">Tatilin adı</label>
            <Input aria-label="Tatil açıklaması"
              value={newHolidayLabel}
              onChange={(e) => setNewHolidayLabel(e.target.value)}
              placeholder="örn. Kurban Bayramı"
            />
          </div>
          <Button type="button" size="lg" variant="outline" onClick={addHoliday} className="gap-1.5">
            <Plus className="h-4 w-4" aria-hidden />
            Ekle
          </Button>
        </div>

        {draft.holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz tatil eklenmedi.</p>
        ) : (
          <div className="divide-y divide-border/60 rounded-lg border border-border/60">
            {[...draft.holidays]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums text-muted-foreground">{formatDateDMY(h.date)}</span>
                    <span className="text-sm text-foreground">{h.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHoliday(h.id)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`${h.label} tatilini kaldır`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Kaldır
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </SettingsFormSection>
  );
}

export default function CalendarSettingsPage() {
  return <CalendarSettingsContent />;
}
