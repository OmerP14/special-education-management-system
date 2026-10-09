"use client";

import { Lock } from "lucide-react";
import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsAccessGuard } from "@/components/settings/SettingsAccessGuard";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { Switch } from "@/components/ui/switch";
import type { SecuritySettings } from "@/types/settings";
import { LOCKOUT_MINUTES, MAX_FAILED_LOGIN_ATTEMPTS, PASSWORD_RULES_TEXT } from "@/lib/auth/security-policy";

const SYSTEM_RULES = [
  { label: "Parola kuralı", value: PASSWORD_RULES_TEXT },
  {
    label: "Hatalı giriş kilidi",
    value: `${MAX_FAILED_LOGIN_ATTEMPTS} hatalı denemede hesap ${LOCKOUT_MINUTES} dakika kilitlenir.`,
  },
  {
    label: "Oturum",
    value: "Hareketsizlik nedeniyle otomatik çıkış yapılmaz. “Beni hatırla” seçilmezse oturum tarayıcı kapanınca biter.",
  },
  { label: "Sayı biçimi", value: "1.234.567,89 (Türkiye)" },
];

function SecuritySettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("security");

  const set = <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card px-4 py-4">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Sistem kuralları</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Bu kurallar sistem tarafından sabittir ve değiştirilemez; tüm kullanıcılar için aynı şekilde uygulanır.
        </p>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {SYSTEM_RULES.map((rule) => (
            <div key={rule.label} className="rounded-lg border border-border/60 px-3 py-2.5">
              <dt className="text-xs text-muted-foreground">{rule.label}</dt>
              <dd className="text-sm text-foreground">{rule.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <SettingsFormSection
        title="Denetim ve Onay Kuralları"
        description="İşlem geçmişi kaydı ve onay istenecek işlemler."
        isDirty={isDirty}
        errors={errors}
        savedMessage={savedMessage}
        metadata={metadata}
        onSave={save}
        onCancel={cancel}
        onReset={resetToDefaults}
      >
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm text-foreground">İşlem geçmişi kaydını etkinleştir</p>
                <p className="text-xs text-muted-foreground">Kapatılırsa yeni İşlem Geçmişi kaydı oluşturulmaz.</p>
              </div>
              <Switch checked={draft.auditLoggingEnabled} onCheckedChange={(v) => set("auditLoggingEnabled", v)} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm text-foreground">Hassas işlemlerde onay iste</p>
                <p className="text-xs text-muted-foreground">Silme ve kullanıcı/rol pasifleştirme öncesi.</p>
              </div>
              <Switch
                checked={draft.confirmSensitiveActions}
                onCheckedChange={(v) => set("confirmSensitiveActions", v)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm text-foreground">Finansal düzenlemede onay iste</p>
                <p className="text-xs text-muted-foreground">Ödeme/kasa düzenleme, silme ve taksit tahsili öncesi.</p>
              </div>
              <Switch
                checked={draft.confirmFinancialEdits}
                onCheckedChange={(v) => set("confirmFinancialEdits", v)}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
              <div>
                <p className="text-sm text-foreground">Veri dışa aktarımında onay iste</p>
                <p className="text-xs text-muted-foreground">CSV/PDF, rapor ve makbuz çıktısı öncesi.</p>
              </div>
              <Switch checked={draft.confirmDataExport} onCheckedChange={(v) => set("confirmDataExport", v)} />
            </div>
          </div>
        </div>

      </SettingsFormSection>
    </div>
  );
}

export default function SecuritySettingsPage() {
  return (
    <SettingsAccessGuard sectionKey="security">
      <SecuritySettingsContent />
    </SettingsAccessGuard>
  );
}
