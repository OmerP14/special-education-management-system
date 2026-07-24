"use client";

import { useSettingsSection } from "@/hooks/use-settings-section";
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
import type { StudentSettings, GuardianContactPreference, InactiveStudentBehavior } from "@/types/settings";
import type { StudentStatus } from "@/types";

const CONTACT_PREF_LABELS: Record<GuardianContactPreference, string> = {
  phone: "Telefon",
  email: "E-posta",
  whatsapp: "WhatsApp",
};

const INACTIVE_BEHAVIOR_LABELS: Record<InactiveStudentBehavior, string> = {
  hide: "Listelerden gizle",
  show_greyed: "Soluk renkte göster",
};

const DEFAULT_STATUS_LABELS: Record<StudentStatus, string> = {
  active: "Aktif",
  on_hold: "Beklemede",
  inactive: "Pasif",
};

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

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function StudentSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("students");

  const set = <K extends keyof StudentSettings>(key: K, value: StudentSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <SettingsFormSection
      title="Öğrenci ve Veli Ayarları"
      description="Yeni öğrenci/veli kaydı sırasında uygulanacak kurallar ve zorunlu alanlar."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      {/* Numbering */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ToggleRow
          label="Öğrenci numarasını otomatik oluştur"
          description="Kapalı olduğunda öğrenci numarası manuel girilir."
          checked={draft.autoGenerateStudentNumber}
          onCheckedChange={(v) => set("autoGenerateStudentNumber", v)}
        />
        <SettingsField label="Öğrenci Numara Formatı" description="{0000} sıra numarası olarak yerine geçer.">
          <Input
            value={draft.studentNumberFormat}
            onChange={(e) => set("studentNumberFormat", e.target.value)}
            disabled={!draft.autoGenerateStudentNumber}
          />
        </SettingsField>
      </div>

      {/* Defaults */}
      <div className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
        <SelectField
          label="Varsayılan Öğrenci Durumu"
          value={draft.defaultStudentStatus}
          onChange={(v) => set("defaultStudentStatus", v)}
          labels={DEFAULT_STATUS_LABELS}
        />
        <SelectField
          label="Pasif Öğrenci Görünümü"
          value={draft.inactiveStudentBehavior}
          onChange={(v) => set("inactiveStudentBehavior", v)}
          labels={INACTIVE_BEHAVIOR_LABELS}
        />
        <SelectField
          label="Veli İletişim Tercihi"
          value={draft.guardianContactPreference}
          onChange={(v) => set("guardianContactPreference", v)}
          labels={CONTACT_PREF_LABELS}
        />
      </div>

      {/* Guardian rules */}
      <div className="grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-2">
        <ToggleRow
          label="Veli bilgisi zorunlu"
          description="Kapalı olduğunda veli olmadan öğrenci kaydedilebilir."
          checked={draft.guardianRequired}
          onCheckedChange={(v) => set("guardianRequired", v)}
        />
        <ToggleRow
          label="Birden fazla veliye izin ver"
          checked={draft.allowMultipleGuardians}
          onCheckedChange={(v) => set("allowMultipleGuardians", v)}
        />
        <ToggleRow
          label="Borç uyarısı göster"
          description="Öğrenci detayında bekleyen borç varsa uyarı gösterir."
          checked={draft.debtWarningEnabled}
          onCheckedChange={(v) => set("debtWarningEnabled", v)}
        />
      </div>

      {/* Required fields */}
      <div className="space-y-3 border-t border-border/60 pt-5">
        <p className="text-sm font-semibold text-foreground">Zorunlu Alanlar</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleRow label="Doğum tarihi" checked={draft.requireBirthDate} onCheckedChange={(v) => set("requireBirthDate", v)} />
          <ToggleRow label="KVKK onayı" checked={draft.requireKvkkConsent} onCheckedChange={(v) => set("requireKvkkConsent", v)} />
          <ToggleRow label="Sağlık bilgisi" checked={draft.requireHealthInfo} onCheckedChange={(v) => set("requireHealthInfo", v)} />
          <ToggleRow
            label="Acil durum kişisi"
            checked={draft.requireEmergencyContact}
            onCheckedChange={(v) => set("requireEmergencyContact", v)}
          />
        </div>
      </div>
    </SettingsFormSection>
  );
}

export default function StudentSettingsPage() {
  return (
    <SettingsAccessGuard sectionKey="students">
      <StudentSettingsContent />
    </SettingsAccessGuard>
  );
}
