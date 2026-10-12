"use client";

import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { SettingsField } from "@/components/settings/SettingsField";
import { NumericInput } from "@/components/ui/numeric-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPaymentMethodLabel } from "@/lib/helpers/finance";
import { cn } from "@/lib/utils";
import type { FinanceSettings } from "@/types/settings";
import type { PaymentMethod } from "@/types";

const ALL_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "credit_card", "other"];

function FinanceSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("finance");

  const set = <K extends keyof FinanceSettings>(key: K, value: FinanceSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleMethod = (m: PaymentMethod) => {
    const has = draft.enabledPaymentMethods.includes(m);
    set(
      "enabledPaymentMethods",
      has ? draft.enabledPaymentMethods.filter((x) => x !== m) : [...draft.enabledPaymentMethods, m]
    );
  };

  return (
    <SettingsFormSection
      title="Finans Ayarları"
      description="Ödeme yöntemleri ve borç uyarısı. Tutarlar Türk lirasıyla gösterilir; makbuzlar MKB-yıl-sıra biçiminde otomatik numaralanır."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      {/* Debt warning */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsField
          label="Öğrenci Borç Uyarı Eşiği"
          description="Bu tutarı aşan borçlar öğrenci listesinde ve detayında işaretlenir (Öğrenci ve Veli → Borç uyarısı açıkken)."
        >
          <NumericInput
            min={0}
            value={draft.studentDebtWarningThreshold}
            onValueChange={(v) => set("studentDebtWarningThreshold", v ?? 0)}
          />
        </SettingsField>
      </div>

      {/* Payment methods */}
      <div className="space-y-3">
        <SettingsField label="Aktif Ödeme Yöntemleri" error={errors.enabledPaymentMethods}>
          <div className="flex flex-wrap gap-1.5">
            {ALL_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  draft.enabledPaymentMethods.includes(m)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {getPaymentMethodLabel(m)}
              </button>
            ))}
          </div>
        </SettingsField>
        <SettingsField
          label="Varsayılan Ödeme Yöntemi"
          className="sm:max-w-xs"
          error={errors.defaultPaymentMethod}
        >
          <Select
            value={draft.defaultPaymentMethod}
            onValueChange={(v) => { if (v) set("defaultPaymentMethod", v as PaymentMethod); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(val: PaymentMethod) => getPaymentMethodLabel(val)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {draft.enabledPaymentMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {getPaymentMethodLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </div>

    </SettingsFormSection>
  );
}

export default function FinanceSettingsPage() {
  return <FinanceSettingsContent />;
}
