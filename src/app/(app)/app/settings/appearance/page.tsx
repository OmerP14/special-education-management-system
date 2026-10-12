"use client";

import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { SettingsField } from "@/components/settings/SettingsField";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AppearanceSettings,
  UiDensity,
  CardRadiusPreference,
  SidebarDefaultState,
  LandingPage,
  ThemePreference,
} from "@/types/settings";

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
      description="Uygulamanın görünümü: renkler, tema, yoğunluk ve açılış sayfası. Belgeler (PDF, CSV, makbuz) standart biçimde ve kurum bilgileriyle çıkar."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Ana Marka Rengi" description="Butonlar ve vurgulu öğeler.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.primaryBrandColor}
              onChange={(e) => set("primaryBrandColor", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
            />
            <Input value={draft.primaryBrandColor} onChange={(e) => set("primaryBrandColor", e.target.value)} />
          </div>
        </SettingsField>
        <SettingsField label="Vurgu Rengi" description="Odak halkaları ve grafiklerdeki ciro çubukları.">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={draft.accentColor}
              onChange={(e) => set("accentColor", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-input bg-transparent"
            />
            <Input value={draft.accentColor} onChange={(e) => set("accentColor", e.target.value)} />
          </div>
        </SettingsField>
        <SettingsField label="Kurum Alt Bilgi Metni" className="sm:col-span-2" description="Her sayfanın altında gösterilir.">
          <Input value={draft.institutionFooterText} onChange={(e) => set("institutionFooterText", e.target.value)} />
        </SettingsField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Tema"
          value={draft.theme}
          onChange={(v: ThemePreference) => set("theme", v)}
          labels={{ light: "Açık", dark: "Koyu", system: "Sistem ayarını izle" }}
        />
        <SelectField
          label="Arayüz Yoğunluğu"
          value={draft.density}
          onChange={(v: UiDensity) => set("density", v)}
          labels={{ comfortable: "Rahat", compact: "Sıkışık" }}
        />
        <SelectField
          label="Tablo Satır Yoğunluğu"
          value={draft.tableRowDensity}
          onChange={(v: UiDensity) => set("tableRowDensity", v)}
          labels={{ comfortable: "Rahat", compact: "Sıkışık" }}
        />
        <SelectField
          label="Kart Köşe Yuvarlaklığı"
          value={draft.cardRadius}
          onChange={(v: CardRadiusPreference) => set("cardRadius", v)}
          labels={{ sm: "Küçük", md: "Orta", lg: "Büyük", xl: "Ekstra Büyük" }}
        />
        <SelectField
          label="Sidebar Varsayılan Durumu"
          value={draft.sidebarDefaultState}
          onChange={(v: SidebarDefaultState) => set("sidebarDefaultState", v)}
          labels={{ expanded: "Açık", collapsed: "Kapalı" }}
        />
        <SelectField
          label="Varsayılan Açılış Sayfası"
          value={draft.defaultLandingPage}
          onChange={(v: LandingPage) => set("defaultLandingPage", v)}
          labels={{ dashboard: "Panel", calendar: "Takvim", sessions: "Seanslar" }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">Animasyonları etkinleştir</p>
          <Switch checked={draft.animationsEnabled} onCheckedChange={(v) => set("animationsEnabled", v)} />
        </div>
      </div>
    </SettingsFormSection>
  );
}

export default function AppearanceSettingsPage() {
  return <AppearanceSettingsContent />;
}
