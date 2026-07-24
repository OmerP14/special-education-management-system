"use client";

import { Building2, Upload, X } from "lucide-react";
import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { SettingsField } from "@/components/settings/SettingsField";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { InstitutionProfileSettings } from "@/types/settings";

function InstitutionSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("institution");

  const set = <K extends keyof InstitutionProfileSettings>(key: K, value: InstitutionProfileSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set("logoUrl", reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <SettingsFormSection
      title="Kurum Bilgileri"
      description="Kurum adı ve logo, sidebar ve belgelerde otomatik olarak kullanılır."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      {/* Logo */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/30">
          {draft.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded data URL preview, not a static asset
            <img src={draft.logoUrl} alt="Kurum logosu" className="h-full w-full object-cover" />
          ) : (
            <Building2 className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-background px-3 text-sm font-medium transition-colors hover:bg-muted">
            <Upload className="h-3.5 w-3.5" />
            Logo Yükle
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </label>
          {draft.logoUrl && (
            <Button variant="ghost" size="sm" onClick={() => set("logoUrl", null)} className="gap-1.5">
              <X className="h-3.5 w-3.5" />
              Kaldır
            </Button>
          )}
        </div>
      </div>

      {/* Identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Kurum Adı" required error={errors.name}>
          <Input value={draft.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} />
        </SettingsField>
        <SettingsField label="Kısa Kurum Adı" description="Sidebar'da kurum adının altında görünür.">
          <Input value={draft.shortName} onChange={(e) => set("shortName", e.target.value)} />
        </SettingsField>
      </div>

      {/* Contact */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Telefon" error={errors.phone}>
          <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} aria-invalid={!!errors.phone} placeholder="0532 123 45 67" />
        </SettingsField>
        <SettingsField label="E-posta" error={errors.email}>
          <Input type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} />
        </SettingsField>
        <SettingsField label="Web Sitesi" error={errors.website}>
          <Input value={draft.website} onChange={(e) => set("website", e.target.value)} aria-invalid={!!errors.website} placeholder="https://" />
        </SettingsField>
      </div>

      {/* Address */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Adres" className="sm:col-span-2">
          <Input value={draft.address} onChange={(e) => set("address", e.target.value)} />
        </SettingsField>
        <SettingsField label="İl">
          <Input value={draft.city} onChange={(e) => set("city", e.target.value)} />
        </SettingsField>
        <SettingsField label="İlçe">
          <Input value={draft.district} onChange={(e) => set("district", e.target.value)} />
        </SettingsField>
        <SettingsField label="Posta Kodu">
          <Input value={draft.postalCode} onChange={(e) => set("postalCode", e.target.value)} />
        </SettingsField>
      </div>

      {/* Legal */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField label="Vergi Dairesi">
          <Input value={draft.taxOffice} onChange={(e) => set("taxOffice", e.target.value)} />
        </SettingsField>
        <SettingsField label="Vergi Numarası" error={errors.taxNumber}>
          <Input value={draft.taxNumber} onChange={(e) => set("taxNumber", e.target.value)} aria-invalid={!!errors.taxNumber} />
        </SettingsField>
        <SettingsField label="MERSİS Numarası" error={errors.mersisNumber}>
          <Input value={draft.mersisNumber} onChange={(e) => set("mersisNumber", e.target.value)} aria-invalid={!!errors.mersisNumber} />
        </SettingsField>
      </div>

      {/* Contact person */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SettingsField label="Kurum Yetkilisi">
          <Input value={draft.contactPersonName} onChange={(e) => set("contactPersonName", e.target.value)} />
        </SettingsField>
        <SettingsField label="Yetkili Telefon" error={errors.contactPersonPhone}>
          <Input value={draft.contactPersonPhone} onChange={(e) => set("contactPersonPhone", e.target.value)} aria-invalid={!!errors.contactPersonPhone} />
        </SettingsField>
        <SettingsField label="Yetkili E-posta" error={errors.contactPersonEmail}>
          <Input type="email" value={draft.contactPersonEmail} onChange={(e) => set("contactPersonEmail", e.target.value)} aria-invalid={!!errors.contactPersonEmail} />
        </SettingsField>
      </div>
    </SettingsFormSection>
  );
}

export default function InstitutionSettingsPage() {
  return (
    <SettingsAccessGuard sectionKey="institution">
      <InstitutionSettingsContent />
    </SettingsAccessGuard>
  );
}
