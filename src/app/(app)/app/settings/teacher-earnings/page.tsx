"use client";

import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { SettingsField } from "@/components/settings/SettingsField";
import { NumericInput } from "@/components/ui/numeric-input";
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
  TeacherEarningsSettings,
  TeacherEarningTypeOption,
  EarningTriggerMoment,
  MakeupEarningBehavior,
  CancelledEarningBehavior,
  NoShowEarningBehavior,
  EarningRoundingRule,
  PostQuotaBehavior,
} from "@/types/settings";

const EARNING_TYPE_LABELS: Record<TeacherEarningTypeOption, string> = {
  per_session: "Seans Başı",
  salary_plus_quota: "Sabit Maaş + Kota Üstü Hakediş",
  percentage: "Yüzde Hakediş",
};

const TRIGGER_LABELS: Record<EarningTriggerMoment, string> = {
  on_completion: "Seans tamamlandığında",
  on_admin_approval: "Yönetici onayladığında",
};

const MAKEUP_LABELS: Record<MakeupEarningBehavior, string> = {
  full: "Tam hakediş",
  half: "Yarım hakediş",
  none: "Hakediş oluşturma",
};

const CANCELLED_LABELS: Record<CancelledEarningBehavior, string> = {
  none: "Hakediş oluşturma",
  partial: "Kısmi hakediş oluştur",
};

const NO_SHOW_LABELS: Record<NoShowEarningBehavior, string> = {
  none: "Hakediş oluşturma",
  partial: "Kısmi hakediş oluştur",
  full: "Tam hakediş oluştur",
};

const ROUNDING_LABELS: Record<EarningRoundingRule, string> = {
  none: "Yuvarlama yok",
  nearest_1: "1 TL'ye yuvarla",
  nearest_5: "5 TL'ye yuvarla",
  nearest_10: "10 TL'ye yuvarla",
};

const POST_QUOTA_LABELS: Record<PostQuotaBehavior, string> = {
  extra_rate: "Ek (kota üstü) oranla öde",
  same_rate: "Normal oranla öde",
  no_extra: "Ek ödeme yapma",
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

function TeacherEarningsSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("teacherEarnings");

  const set = <K extends keyof TeacherEarningsSettings>(key: K, value: TeacherEarningsSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleType = (t: TeacherEarningTypeOption) => {
    const has = draft.availableEarningTypes.includes(t);
    set(
      "availableEarningTypes",
      has ? draft.availableEarningTypes.filter((x) => x !== t) : [...draft.availableEarningTypes, t]
    );
  };

  return (
    <SettingsFormSection
      title="Öğretmen ve Hakediş Ayarları"
      description="Kurum geneli hakediş politikaları ve varsayılanlar. Öğretmen + Eğitim Türü ataması hâlâ gerçek hakediş kaynağıdır — bu ayarlar yalnızca genel davranışı ve yeni öğretmen varsayılanlarını belirler."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      {/* Earning types */}
      <div className="space-y-3">
        <SettingsField label="Kullanılabilir Ücretlendirme Türleri" error={errors.availableEarningTypes}>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EARNING_TYPE_LABELS) as TeacherEarningTypeOption[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleType(t)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  draft.availableEarningTypes.includes(t)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {EARNING_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </SettingsField>
        <SelectField
          label="Varsayılan Ücretlendirme Türü"
          value={draft.defaultEarningType}
          onChange={(v) => set("defaultEarningType", v)}
          labels={EARNING_TYPE_LABELS}
          className="sm:max-w-sm"
          description={errors.defaultEarningType}
        />
      </div>

      {/* Trigger & special cases */}
      <div className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2">
        <SelectField
          label="Hakediş Oluşturma Anı"
          value={draft.earningTriggerMoment}
          onChange={(v) => set("earningTriggerMoment", v)}
          labels={TRIGGER_LABELS}
        />
        <SelectField
          label="Yuvarlama Kuralı"
          value={draft.earningRoundingRule}
          onChange={(v) => set("earningRoundingRule", v)}
          labels={ROUNDING_LABELS}
        />
        <SelectField
          label="Telafi Seansı Hakedişi"
          value={draft.makeupSessionEarningBehavior}
          onChange={(v) => set("makeupSessionEarningBehavior", v)}
          labels={MAKEUP_LABELS}
        />
        <SelectField
          label="İptal Edilen Seans Hakedişi"
          value={draft.cancelledSessionEarning}
          onChange={(v) => set("cancelledSessionEarning", v)}
          labels={CANCELLED_LABELS}
        />
        <SelectField
          label="Gelmedi (No-show) Hakedişi"
          value={draft.noShowSessionEarning}
          onChange={(v) => set("noShowSessionEarning", v)}
          labels={NO_SHOW_LABELS}
        />
        <SelectField
          label="Kota Üstü Davranış"
          value={draft.postQuotaBehavior}
          onChange={(v) => set("postQuotaBehavior", v)}
          labels={POST_QUOTA_LABELS}
        />
      </div>

      {/* Numbers */}
      <div className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsField label="Varsayılan Kota (seans/ay)">
          <NumericInput min={0} value={draft.defaultQuota} onValueChange={(v) => set("defaultQuota", v ?? 0)} />
        </SettingsField>
        <SettingsField label="Hakediş Dönemi Başlangıç Günü" error={errors.payPeriodStartDay}>
          <NumericInput
            min={1}
            max={28}
            value={draft.payPeriodStartDay}
            onValueChange={(v) => set("payPeriodStartDay", v ?? 1)}
          />
        </SettingsField>
      </div>

      {/* Toggles */}
      <div className="grid gap-3 border-t border-border/60 pt-5 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">Kesintilere izin ver</p>
          <Switch checked={draft.allowDeductions} onCheckedChange={(v) => set("allowDeductions", v)} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">Avanslara izin ver</p>
          <Switch checked={draft.allowAdvances} onCheckedChange={(v) => set("allowAdvances", v)} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Fazla ödemeyi engelle</p>
            <p className="text-xs text-muted-foreground">Hesaplanan hakedişi aşan manuel ödemeyi engeller.</p>
          </div>
          <Switch checked={draft.preventOverpayment} onCheckedChange={(v) => set("preventOverpayment", v)} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">Geçmişe dönük yeniden hesaplamaya izin ver</p>
          <Switch
            checked={draft.allowHistoricalRecalculation}
            onCheckedChange={(v) => set("allowHistoricalRecalculation", v)}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 sm:col-span-2">
          <div>
            <p className="text-sm font-medium text-foreground">Eksik hakediş yapılandırmasında uyar</p>
            <p className="text-xs text-muted-foreground">
              Bir öğretmen için Eğitim Türü ataması hakediş bilgisi olmadan kaydedilirse uyarı gösterir.
            </p>
          </div>
          <Switch
            checked={draft.warnOnMissingEarningConfig}
            onCheckedChange={(v) => set("warnOnMissingEarningConfig", v)}
          />
        </div>
      </div>
    </SettingsFormSection>
  );
}

export default function TeacherEarningsSettingsPage() {
  return (
    <SettingsAccessGuard sectionKey="teacherEarnings">
      <TeacherEarningsSettingsContent />
    </SettingsAccessGuard>
  );
}
