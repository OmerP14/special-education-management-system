"use client";

import { ShieldAlert } from "lucide-react";
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
import type { NumberFormatPreference, SecuritySettings } from "@/types/settings";

const NUMBER_FORMAT_LABELS: Record<NumberFormatPreference, string> = {
  "1.234,56": "1.234,56 (Türkiye)",
  "1,234.56": "1,234.56 (Uluslararası)",
};

function SecuritySettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("security");

  const set = <K extends keyof SecuritySettings>(key: K, value: SecuritySettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:bg-amber-950/20">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-500" />
        <p className="text-xs text-amber-800 dark:text-amber-400">
          Oturum süresi, hareketsizlikte çıkış, parola politikası ve hatalı giriş kilidi giriş ekranında ve
          şifre formlarında uygulanır. Uygulama henüz sunucusuz çalıştığından bu kontroller tarayıcıda yapılır;
          sunucu altyapısı eklendiğinde aynı politika sunucu tarafında da zorunlu tutulacaktır.
        </p>
      </div>

      <SettingsFormSection
        title="Güvenlik ve Sistem"
        description="Oturum, parola politikası, giriş denemesi, işlem geçmişi ve onay kuralları."
        isDirty={isDirty}
        errors={errors}
        savedMessage={savedMessage}
        metadata={metadata}
        onSave={save}
        onCancel={cancel}
        onReset={resetToDefaults}
      >
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Oturum</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SettingsField label="Oturum Zaman Aşımı (dk)" description="Belirtilen süre işlemsiz kalınca oturum kapatılır (mock).">
              <NumericInput
                min={5}
                value={draft.sessionTimeoutMinutes}
                onValueChange={(v) => set("sessionTimeoutMinutes", v ?? 0)}
              />
            </SettingsField>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3 sm:col-span-2">
              <div>
                <p className="text-sm text-foreground">Hareketsizlikte otomatik çıkış</p>
                <p className="text-xs text-muted-foreground">Kullanıcı belirtilen süre işlem yapmazsa oturumu sonlandırır.</p>
              </div>
              <Switch
                checked={draft.inactivityLogoutEnabled}
                onCheckedChange={(v) => set("inactivityLogoutEnabled", v)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Parola Politikası</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SettingsField label="Minimum Parola Uzunluğu">
              <NumericInput
                min={4}
                max={64}
                value={draft.passwordMinLength}
                onValueChange={(v) => set("passwordMinLength", v ?? 0)}
              />
            </SettingsField>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
              <p className="text-sm text-foreground">Büyük harf zorunlu</p>
              <Switch checked={draft.requireUppercase} onCheckedChange={(v) => set("requireUppercase", v)} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
              <p className="text-sm text-foreground">Rakam zorunlu</p>
              <Switch checked={draft.requireNumber} onCheckedChange={(v) => set("requireNumber", v)} />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
              <p className="text-sm text-foreground">Özel karakter zorunlu</p>
              <Switch checked={draft.requireSpecialChar} onCheckedChange={(v) => set("requireSpecialChar", v)} />
            </div>
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Giriş Denemesi</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SettingsField label="Başarısız Giriş Eşiği" description="Bu sayıda hatalı denemeden sonra hesap kilitlenir.">
              <NumericInput
                min={1}
                value={draft.failedLoginThreshold}
                onValueChange={(v) => set("failedLoginThreshold", v ?? 0)}
              />
            </SettingsField>
            <SettingsField label="Kilit Süresi (dk)">
              <NumericInput
                min={1}
                value={draft.lockoutDurationMinutes}
                onValueChange={(v) => set("lockoutDurationMinutes", v ?? 0)}
              />
            </SettingsField>
          </div>
        </div>

        <div className="space-y-2 border-t border-border/60 pt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Denetim ve Onay Kuralları</p>
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

        <div className="space-y-2 border-t border-border/60 pt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Biçim</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SettingsField label="Sayı Formatı" description="Tüm tutar ve sayılarda binlik/ondalık ayırıcı.">
              <Select
                value={draft.numberFormat}
                onValueChange={(v) => { if (v) set("numberFormat", v as NumberFormatPreference); }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{() => NUMBER_FORMAT_LABELS[draft.numberFormat]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NUMBER_FORMAT_LABELS) as NumberFormatPreference[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {NUMBER_FORMAT_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsField>
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
