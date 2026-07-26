"use client";

import { useEffect, useState } from "react";
import { FileText, Palette } from "lucide-react";
import { useSettingsSection } from "@/hooks/use-settings-section";
import { useSettingsDirty } from "@/components/settings/settings-dirty-context";
import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
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
  DocumentSettings,
  AppearanceSettings,
  CsvDelimiter,
  PdfPageSize,
  ExportOrientation,
  UiDensity,
  CardRadiusPreference,
  SidebarDefaultState,
  LandingPage,
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

// ─── Belge ayarları ──────────────────────────────────────────────────────────

function DocumentSettingsCard({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("documents");

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const set = <K extends keyof DocumentSettings>(key: K, value: DocumentSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <SettingsFormSection
      title="Belge Ayarları"
      description="Makbuz, fatura ve PDF çıktılarında kullanılan şablon bilgileri."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Makbuz Başlığı">
          <Input value={draft.receiptTitle} onChange={(e) => set("receiptTitle", e.target.value)} />
        </SettingsField>
        <SettingsField label="Tarih Formatı">
          <Input value={draft.dateFormat} onChange={(e) => set("dateFormat", e.target.value)} placeholder="DD.MM.YYYY" />
        </SettingsField>
        <SettingsField label="Fatura Notu" className="sm:col-span-2">
          <Input value={draft.invoiceNote} onChange={(e) => set("invoiceNote", e.target.value)} />
        </SettingsField>
        <SettingsField label="PDF Alt Bilgi Metni" className="sm:col-span-2">
          <Input value={draft.pdfFooterText} onChange={(e) => set("pdfFooterText", e.target.value)} />
        </SettingsField>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="CSV Ayırıcı"
          value={draft.csvDelimiter}
          onChange={(v: CsvDelimiter) => set("csvDelimiter", v)}
          labels={{ ",": "Virgül (,)", ";": "Noktalı Virgül (;)" }}
        />
        <SelectField
          label="PDF Sayfa Boyutu"
          value={draft.pdfPageSize}
          onChange={(v: PdfPageSize) => set("pdfPageSize", v)}
          labels={{ A4: "A4", Letter: "Letter" }}
        />
        <SelectField
          label="Varsayılan Yönlendirme"
          value={draft.defaultExportOrientation}
          onChange={(v: ExportOrientation) => set("defaultExportOrientation", v)}
          labels={{ portrait: "Dikey", landscape: "Yatay" }}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">İmza alanı göster</p>
          <Switch checked={draft.showSignatureArea} onCheckedChange={(v) => set("showSignatureArea", v)} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">Kaşe alanı göster</p>
          <Switch checked={draft.showStampArea} onCheckedChange={(v) => set("showStampArea", v)} />
        </div>
      </div>
    </SettingsFormSection>
  );
}

// ─── Görünüm ayarları ────────────────────────────────────────────────────────

function AppearanceSettingsCard({ onDirtyChange }: { onDirtyChange: (dirty: boolean) => void }) {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("appearance");

  useEffect(() => {
    onDirtyChange(isDirty);
    return () => onDirtyChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty]);

  const set = <K extends keyof AppearanceSettings>(key: K, value: AppearanceSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <SettingsFormSection
      title="Görünüm Ayarları"
      description="Arayüz yoğunluğu ve varsayılan davranış tercihleri. Bu değerler kaydedilir; sidebar varsayılan durumu ve tablo yoğunluğu gibi bazı alanlar şu an yalnızca tercih olarak saklanır, canlı arayüze henüz bağlı değildir (mock-only)."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Ana Marka Rengi">
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
        <SettingsField label="Vurgu Rengi">
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
        <SettingsField label="Kurum Alt Bilgi Metni" className="sm:col-span-2">
          <Input value={draft.institutionFooterText} onChange={(e) => set("institutionFooterText", e.target.value)} />
        </SettingsField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Karanlık mod (hazır)</p>
            <p className="text-xs text-muted-foreground">Yalnızca tercih olarak kaydedilir — henüz bir tema anahtarı yoktur.</p>
          </div>
          <Switch checked={draft.darkModeReady} onCheckedChange={(v) => set("darkModeReady", v)} />
        </div>
      </div>
    </SettingsFormSection>
  );
}

// ─── Page: two independent sections sharing one nav entry ─────────────────────
// "Belge ve Görünüm Ayarları" is one SettingsSectionKey but edits two distinct
// InstitutionSettings fields (documents + appearance) — each keeps its own
// save/cancel/reset via its own useSettingsSection call. Both report dirty
// state into the shared SettingsDirtyProvider independently; this combiner
// effect (registered after both cards' own effects) always runs last in the
// same commit, so the shell's "unsaved changes" warning reflects EITHER card
// being dirty instead of whichever hook's effect happened to run last.
function DirtyCombiner({ documentsDirty, appearanceDirty }: { documentsDirty: boolean; appearanceDirty: boolean }) {
  const { setDirty } = useSettingsDirty();
  useEffect(() => {
    setDirty(documentsDirty || appearanceDirty);
  }, [documentsDirty, appearanceDirty, setDirty]);
  return null;
}

function AppearanceSettingsContent() {
  const [documentsDirty, setDocumentsDirty] = useState(false);
  const [appearanceDirty, setAppearanceDirty] = useState(false);

  return (
    <div className="space-y-4">
      <DirtyCombiner documentsDirty={documentsDirty} appearanceDirty={appearanceDirty} />
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        Belge Ayarları
      </div>
      <DocumentSettingsCard onDirtyChange={setDocumentsDirty} />
      <div className="flex items-center gap-2 pt-2 text-xs font-medium text-muted-foreground">
        <Palette className="h-3.5 w-3.5" />
        Görünüm Ayarları
      </div>
      <AppearanceSettingsCard onDirtyChange={setAppearanceDirty} />
    </div>
  );
}

export default function AppearanceSettingsPage() {
  return (
    <SettingsAccessGuard sectionKey="appearance">
      <AppearanceSettingsContent />
    </SettingsAccessGuard>
  );
}
