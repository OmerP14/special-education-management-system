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
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel } =
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
      title="Veli Ödemeleri"
      description="Velilerden ödeme alırken hangi yöntemlerin seçilebileceği ve borç uyarısı. Makbuz numaraları otomatik verilir."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      onSave={save}
      onCancel={cancel}
    >
      {/* Debt warning */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsField
          label="Borç uyarısı (TL)"
          description="Borcu bu tutarı geçen öğrenciler listede kırmızı ile işaretlenir."
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
        <SettingsField label="Kullanılan ödeme yöntemleri" description="Seçili olanlar koyu renkte görünür." error={errors.enabledPaymentMethods}>
          <div className="flex flex-wrap gap-2">
            {ALL_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggleMethod(m)}
                aria-pressed={draft.enabledPaymentMethods.includes(m)}
                className={cn(
                  "rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors",
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
          label="Ödeme alırken önce seçili gelen yöntem"
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
