"use client";

import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { SettingsField } from "@/components/settings/SettingsField";
import { Input } from "@/components/ui/input";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getPaymentMethodLabel } from "@/lib/helpers/finance";
import { cn } from "@/lib/utils";
import type { FinanceSettings, OverpaymentPolicy, CashClosingBehavior } from "@/types/settings";
import type { PaymentMethod } from "@/types";

const ALL_METHODS: PaymentMethod[] = ["cash", "bank_transfer", "credit_card", "other"];

const OVERPAYMENT_LABELS: Record<OverpaymentPolicy, string> = {
  credit: "Bakiye olarak kaydet (sonraki borca sayılır)",
  block: "Fazla ödemeye izin verme",
  warn: "Uyar, yine de kaydetmeye izin ver",
};

const CASH_CLOSING_LABELS: Record<CashClosingBehavior, string> = {
  manual: "Manuel kapanış",
  auto_lock: "Gün sonunda otomatik kilitle",
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
      description="Para birimi, ödeme yöntemleri ve kasa kurallarını yönetin. Bu ayarlar ödeme ve kasa formlarındaki varsayılanları belirler; mevcut Ciro/Tahsilat hesaplama mantığını değiştirmez."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      {/* Currency */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsField label="Para Birimi">
          <Input value={draft.currency} onChange={(e) => set("currency", e.target.value)} placeholder="TRY" />
        </SettingsField>
        <SelectField
          label="Sembol Konumu"
          value={draft.currencySymbolPosition}
          onChange={(v) => set("currencySymbolPosition", v)}
          labels={{ before: "Tutardan önce (₺100)", after: "Tutardan sonra (100₺)" }}
        />
        <SettingsField label="Öğrenci Borç Uyarı Eşiği (₺)">
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

      {/* Installments & overpayment */}
      <div className="space-y-3 border-t border-border/60 pt-5">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Taksitli Ödemeye İzin Ver</p>
            <p className="text-xs text-muted-foreground">Kapalı olduğunda yeni taksit planı oluşturulamaz.</p>
          </div>
          <Switch checked={draft.allowInstallments} onCheckedChange={(v) => set("allowInstallments", v)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SettingsField label="Varsayılan Taksit Aralığı (gün)">
            <NumericInput
              min={1}
              value={draft.defaultInstallmentIntervalDays}
              onValueChange={(v) => set("defaultInstallmentIntervalDays", v ?? 0)}
            />
          </SettingsField>
          <SettingsField label="Gecikme Toleransı (gün)">
            <NumericInput
              min={0}
              value={draft.latePaymentToleranceDays}
              onValueChange={(v) => set("latePaymentToleranceDays", v ?? 0)}
            />
          </SettingsField>
          <SelectField
            label="Fazla Ödeme Politikası"
            value={draft.overpaymentPolicy}
            onChange={(v) => set("overpaymentPolicy", v)}
            labels={OVERPAYMENT_LABELS}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <p className="text-sm text-foreground">Gecikmiş taksitleri vurgula</p>
          <Switch
            checked={draft.highlightOverdueInstallments}
            onCheckedChange={(v) => set("highlightOverdueInstallments", v)}
          />
        </div>
      </div>

      {/* Receipts */}
      <div className="grid gap-4 border-t border-border/60 pt-5 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsField label="Başlangıç Ödeme Numarası">
          <NumericInput
            min={1}
            value={draft.paymentNumberStart}
            onValueChange={(v) => set("paymentNumberStart", v ?? 0)}
          />
        </SettingsField>
        <SettingsField label="Makbuz Numara Formatı" description="{YYYY} yıl, {0000} sıra numarası olarak yerine geçer.">
          <Input value={draft.receiptNumberFormat} onChange={(e) => set("receiptNumberFormat", e.target.value)} />
        </SettingsField>
        <SettingsField
          label="Tahsilat Açıklama Şablonu"
          description="{ogrenciAdi} ve {ay} otomatik doldurulur."
        >
          <Input
            value={draft.collectionDescriptionTemplate}
            onChange={(e) => set("collectionDescriptionTemplate", e.target.value)}
          />
        </SettingsField>
      </div>

      {/* Cash & visibility */}
      <div className="space-y-3 border-t border-border/60 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Kasa Kapanış Davranışı"
            value={draft.cashClosingBehavior}
            onChange={(v) => set("cashClosingBehavior", v)}
            labels={CASH_CLOSING_LABELS}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
            <p className="text-sm text-foreground">Negatif kasa bakiyesinde uyar</p>
            <Switch checked={draft.negativeCashWarning} onCheckedChange={(v) => set("negativeCashWarning", v)} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
            <p className="text-sm text-foreground">Genel dashboard&apos;da finans göster</p>
            <Switch
              checked={draft.showFinanceOnGeneralDashboard}
              onCheckedChange={(v) => set("showFinanceOnGeneralDashboard", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 sm:col-span-2">
            <div>
              <p className="text-sm font-medium text-foreground">Finansı yalnızca yetkili rollere göster</p>
              <p className="text-xs text-muted-foreground">
                Şu an yalnızca bir tercih olarak kaydedilir — gerçek rol/izin motoru devreye girdiğinde uygulanacaktır.
              </p>
            </div>
            <Switch
              checked={draft.restrictFinanceToAuthorized}
              onCheckedChange={(v) => set("restrictFinanceToAuthorized", v)}
            />
          </div>
        </div>
      </div>
    </SettingsFormSection>
  );
}

export default function FinanceSettingsPage() {
  return (
    <SettingsAccessGuard sectionKey="finance">
      <FinanceSettingsContent />
    </SettingsAccessGuard>
  );
}
