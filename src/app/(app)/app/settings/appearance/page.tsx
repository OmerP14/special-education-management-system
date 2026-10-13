"use client";

import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { SettingsField } from "@/components/settings/SettingsField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppearanceSettings, LandingPage, ThemePreference } from "@/types/settings";

function SelectField<T extends string>({
  label,
  value,
  onChange,
  labels,
  className,
  description,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
  className?: string;
  description?: string;
}) {
  return (
    <SettingsField label={label} className={className} description={description}>
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

// ─── Görünüm ayarları ────────────────────────────────────────────────────────

function AppearanceSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("appearance");

  const set = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <SettingsFormSection
      title="Görünüm Ayarları"
      description="Tema ve girişten sonra açılan sayfa. Renkler ve yerleşim sabittir; belgeler (PDF, CSV, makbuz) standart biçimde ve kurum bilgileriyle çıkar."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Tema"
          value={draft.theme}
          onChange={(v: ThemePreference) => set("theme", v)}
          labels={{ light: "Açık", dark: "Koyu", system: "Sistem ayarını izle" }}
        />
        <SelectField
          label="Varsayılan Açılış Sayfası"
          value={draft.defaultLandingPage}
          onChange={(v: LandingPage) => set("defaultLandingPage", v)}
          labels={{ dashboard: "Panel", calendar: "Takvim", sessions: "Seanslar" }}
        />
      </div>
    </SettingsFormSection>
  );
}

export default function AppearanceSettingsPage() {
  return <AppearanceSettingsContent />;
}
