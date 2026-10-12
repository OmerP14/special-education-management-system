"use client";

import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { NumericInput } from "@/components/ui/numeric-input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { NotificationEventKey } from "@/types/settings";

const EVENTS: { key: NotificationEventKey; label: string; description: string; reminderUnit?: "dk" | "saat" }[] = [
  {
    key: "session_upcoming",
    label: "Yaklaşan Seans Hatırlatması",
    description: "Planlanmış seans başlamadan belirtilen süre önce.",
    reminderUnit: "dk",
  },
  { key: "session_auto_completed", label: "Seans Otomatik Tamamlandı", description: "Otomatik tamamlama bir seansı kapattığında." },
  { key: "session_cancelled", label: "Seans İptali", description: "Bir seans iptal edildiğinde." },
  { key: "student_no_show", label: "Öğrenci Gelmedi", description: "Bir seans 'Gelmedi' olarak işaretlendiğinde." },
  { key: "payment_received", label: "Ödeme Alındı", description: "Öğrenci ödemesi veya taksit tahsil edildiğinde." },
  {
    key: "installment_due",
    label: "Taksit Vadesi Yaklaşıyor",
    description: "Ödenmemiş taksitin vadesine belirtilen süre kala.",
    reminderUnit: "saat",
  },
  { key: "installment_overdue", label: "Taksit Gecikti", description: "Taksit, gecikme toleransını da aşınca." },
  { key: "teacher_earning_created", label: "Öğretmen Hakedişi Oluştu", description: "Bir seans hakediş doğurduğunda." },
  { key: "teacher_payment_made", label: "Öğretmene Ödeme Yapıldı", description: "Öğretmene ödeme kaydedildiğinde." },
];

function NotificationSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("notifications");

  const setEnabled = (key: NotificationEventKey, enabled: boolean) =>
    setDraft((d) => ({ ...d, events: { ...d.events, [key]: { ...d.events[key], enabled } } }));

  const setReminder = (key: NotificationEventKey, minutes: number) =>
    setDraft((d) => ({
      ...d,
      events: { ...d.events, [key]: { ...d.events[key], reminderMinutesBefore: Math.max(1, minutes) } },
    }));

  return (
    <SettingsFormSection
      title="Bildirim Ayarları"
      description="Hangi olayların üst menüdeki bildirim zilinde gösterileceğini seçin. Öğretmenler yalnızca kendi seanslarıyla, veliler yalnızca kendi çocuklarıyla ilgili bildirimleri görür. E-posta/SMS/WhatsApp gönderimi sunucu altyapısıyla birlikte eklenecek."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      <div className="divide-y divide-border/60 rounded-lg border border-border/60">
        {EVENTS.map(({ key, label, description, reminderUnit }) => {
          const cfg = draft.events[key];
          const minutes = cfg.reminderMinutesBefore ?? 0;
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", cfg.enabled ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <div className="flex items-center gap-3">
                {reminderUnit && (
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <NumericInput
                      min={1}
                      integer
                      value={reminderUnit === "saat" ? Math.round(minutes / 60) : minutes}
                      onValueChange={(v) => setReminder(key, (v ?? 1) * (reminderUnit === "saat" ? 60 : 1))}
                      disabled={!cfg.enabled}
                      className="w-16 text-center"
                      aria-label={`${label} — süre`}
                    />
                    {reminderUnit === "saat" ? "saat önce" : "dk önce"}
                  </label>
                )}
                <Switch
                  checked={cfg.enabled}
                  onCheckedChange={(v) => setEnabled(key, v)}
                  aria-label={label}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SettingsFormSection>
  );
}

export default function NotificationSettingsPage() {
  return <NotificationSettingsContent />;
}
