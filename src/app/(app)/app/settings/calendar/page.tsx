"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { SettingsField } from "@/components/settings/SettingsField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  CalendarSettings,
  CalendarView,
  CalendarColorSource,
  CalendarOverlapDisplay,
  CalendarMobileView,
} from "@/types/settings";

const DAY_LABELS: { value: number; label: string }[] = [
  { value: 1, label: "Pzt" },
  { value: 2, label: "Sal" },
  { value: 3, label: "Çar" },
  { value: 4, label: "Per" },
  { value: 5, label: "Cum" },
  { value: 6, label: "Cmt" },
  { value: 0, label: "Paz" },
];

const VIEW_LABELS: Record<CalendarView, string> = {
  month: "Aylık",
  week: "Haftalık",
  day: "Günlük",
  agenda: "Ajanda",
};

const MOBILE_VIEW_LABELS: Record<CalendarMobileView, string> = {
  agenda: "Ajanda",
  day: "Günlük",
};

const COLOR_SOURCE_LABELS: Record<CalendarColorSource, string> = {
  educationType: "Eğitim Türüne Göre",
  status: "Duruma Göre",
  teacher: "Öğretmene Göre",
};

const OVERLAP_LABELS: Record<CalendarOverlapDisplay, string> = {
  side_by_side: "Yan Yana",
  compact: "Sıkıştırılmış",
};

function SelectField<T extends string>({
  label,
  value,
  onChange,
  labels,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
  className?: string;
}) {
  return (
    <SettingsField label={label} className={className}>
      <Select value={value} onValueChange={(v) => { if (v) onChange(v as T); }}>
        <SelectTrigger className="w-full">
          <SelectValue>{() => labels[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(labels) as T[]).map((key) => (
            <SelectItem key={key} value={key}>
              {labels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsField>
  );
}

function CalendarSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
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
      { id: `holiday-${Date.now()}`, date: newHolidayDate, label: newHolidayLabel.trim() },
    ]);
    setNewHolidayDate("");
    setNewHolidayLabel("");
  };

  const removeHoliday = (id: string) => {
    set("holidays", draft.holidays.filter((h) => h.id !== id));
  };

  return (
    <SettingsFormSection
      title="Takvim ve Çalışma Saatleri"
      description="Çalışma günleri ve saatleri, Takvim'in Günlük ve Haftalık görünümlerinin zaman aralığını doğrudan belirler."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      {/* Working days */}
      <SettingsField label="Çalışma Günleri" error={errors.workingDays}>
        <div className="flex flex-wrap gap-1.5">
          {DAY_LABELS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleWorkingDay(d.value)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
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
        <SettingsField label="Gün Başlangıcı" error={errors.dayEndTime}>
          <Input type="time" value={draft.dayStartTime} onChange={(e) => set("dayStartTime", e.target.value)} />
        </SettingsField>
        <SettingsField label="Gün Bitişi">
          <Input type="time" value={draft.dayEndTime} onChange={(e) => set("dayEndTime", e.target.value)} />
        </SettingsField>
        <SettingsField label="Öğle Arası Başlangıç" description="Boş bırakılırsa öğle arası uygulanmaz.">
          <Input
            type="time"
            value={draft.lunchBreakStart ?? ""}
            onChange={(e) => set("lunchBreakStart", e.target.value || null)}
          />
        </SettingsField>
        <SettingsField label="Öğle Arası Bitiş">
          <Input
            type="time"
            value={draft.lunchBreakEnd ?? ""}
            onChange={(e) => set("lunchBreakEnd", e.target.value || null)}
          />
        </SettingsField>
      </div>

      {/* View preferences */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField label="Varsayılan Görünüm" value={draft.defaultView} onChange={(v) => set("defaultView", v)} labels={VIEW_LABELS} />
        <SelectField
          label="Mobilde Varsayılan Görünüm"
          value={draft.mobileDefaultView}
          onChange={(v) => set("mobileDefaultView", v)}
          labels={MOBILE_VIEW_LABELS}
        />
        <SelectField
          label="Haftanın İlk Günü"
          value={String(draft.weekStartsOn) as "0" | "1"}
          onChange={(v) => set("weekStartsOn", Number(v) as 0 | 1)}
          labels={{ "1": "Pazartesi", "0": "Pazar" }}
        />
        <SelectField
          label="Saat Formatı"
          value={draft.timeFormat}
          onChange={(v) => set("timeFormat", v)}
          labels={{ "24h": "24 Saat", "12h": "12 Saat (AM/PM)" }}
        />
        <SelectField
          label="Seans Renklendirme"
          value={draft.colorSource}
          onChange={(v) => set("colorSource", v)}
          labels={COLOR_SOURCE_LABELS}
        />
        <SelectField
          label="Çakışan Seans Görünümü"
          value={draft.overlapDisplay}
          onChange={(v) => set("overlapDisplay", v)}
          labels={OVERLAP_LABELS}
        />
        <SettingsField label="Saat Dilimi">
          <Input value={draft.timezone} onChange={(e) => set("timezone", e.target.value)} />
        </SettingsField>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">Hafta sonlarını göster</p>
          <Switch checked={draft.showWeekends} onCheckedChange={(v) => set("showWeekends", v)} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">Boş saatleri gizle</p>
          <Switch checked={draft.hideEmptyHours} onCheckedChange={(v) => set("hideEmptyHours", v)} />
        </div>
      </div>

      {/* Holidays */}
      <div className="space-y-3 border-t border-border/60 pt-5">
        <p className="text-sm font-semibold text-foreground">Resmi Tatiller</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tarih</label>
            <Input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} className="w-40" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Açıklama</label>
            <Input
              value={newHolidayLabel}
              onChange={(e) => setNewHolidayLabel(e.target.value)}
              placeholder="örn. Kurban Bayramı"
            />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={addHoliday} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Ekle
          </Button>
        </div>

        {draft.holidays.length === 0 ? (
          <p className="text-xs text-muted-foreground">Henüz tatil eklenmedi.</p>
        ) : (
          <div className="divide-y divide-border/60 rounded-lg border border-border/60">
            {[...draft.holidays]
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">{h.date}</span>
                    <span className="text-sm text-foreground">{h.label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHoliday(h.id)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Tatili kaldır"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
  return (
    <SettingsAccessGuard sectionKey="calendar">
      <CalendarSettingsContent />
    </SettingsAccessGuard>
  );
}
