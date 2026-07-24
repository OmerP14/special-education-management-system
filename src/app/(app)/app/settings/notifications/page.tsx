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
import { cn } from "@/lib/utils";
import type {
  NotificationSettings,
  NotificationEventKey,
  NotificationChannel,
  NotificationRecipientType,
} from "@/types/settings";

const EVENT_LABELS: Record<NotificationEventKey, string> = {
  session_upcoming: "Yaklaşan Seans Hatırlatması",
  session_cancelled: "Seans İptali",
  student_no_show: "Öğrenci Gelmedi",
  payment_received: "Ödeme Alındı",
  installment_due: "Taksit Vadesi Yaklaşıyor",
  installment_overdue: "Taksit Gecikti",
  teacher_earning_created: "Öğretmen Hakedişi Oluştu",
  teacher_payment_made: "Öğretmene Ödeme Yapıldı",
  user_invited: "Kullanıcı Davet Edildi",
  system_alert: "Sistem Uyarısı",
};

const EVENT_ORDER: NotificationEventKey[] = [
  "session_upcoming",
  "session_cancelled",
  "student_no_show",
  "payment_received",
  "installment_due",
  "installment_overdue",
  "teacher_earning_created",
  "teacher_payment_made",
  "user_invited",
  "system_alert",
];

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  inApp: "Uygulama İçi",
  email: "E-posta",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

const CHANNEL_ORDER: NotificationChannel[] = ["inApp", "email", "sms", "whatsapp"];

const RECIPIENT_LABELS: Record<NotificationRecipientType, string> = {
  guardian: "Veli",
  teacher: "Öğretmen",
  both: "Veli ve Öğretmen",
};

function NotificationSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("notifications");

  const set = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const toggleEventEnabled = (key: NotificationEventKey) => {
    setDraft((d) => ({
      ...d,
      events: { ...d.events, [key]: { ...d.events[key], enabled: !d.events[key].enabled } },
    }));
  };

  const toggleChannel = (key: NotificationEventKey, channel: NotificationChannel) => {
    setDraft((d) => ({
      ...d,
      events: {
        ...d.events,
        [key]: {
          ...d.events[key],
          channels: { ...d.events[key].channels, [channel]: !d.events[key].channels[channel] },
        },
      },
    }));
  };

  const setReminder = (key: NotificationEventKey, minutes: number | undefined) => {
    setDraft((d) => ({
      ...d,
      events: { ...d.events, [key]: { ...d.events[key], reminderMinutesBefore: minutes } },
    }));
  };

  return (
    <SettingsFormSection
      title="Bildirim Ayarları"
      description="Hangi olayların, hangi kanallardan, kime bildirileceğini yönetin. Kanallar bu ekranda yalnızca tercih olarak kaydedilir — gerçek e-posta/SMS gönderimi için harici bir sağlayıcı bağlantısı gerekir."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      {/* General */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SettingsField label="Varsayılan Alıcı">
          <Select
            value={draft.defaultRecipientType}
            onValueChange={(v) => { if (v) set("defaultRecipientType", v as NotificationRecipientType); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{() => RECIPIENT_LABELS[draft.defaultRecipientType]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RECIPIENT_LABELS) as NotificationRecipientType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {RECIPIENT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
        <SettingsField label="Sessiz Saat Başlangıcı" description="Boş bırakılırsa sessiz saat uygulanmaz.">
          <Input
            type="time"
            value={draft.quietHoursStart ?? ""}
            onChange={(e) => set("quietHoursStart", e.target.value || null)}
          />
        </SettingsField>
        <SettingsField label="Sessiz Saat Bitişi">
          <Input
            type="time"
            value={draft.quietHoursEnd ?? ""}
            onChange={(e) => set("quietHoursEnd", e.target.value || null)}
          />
        </SettingsField>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
        <p className="text-sm text-foreground">Hafta sonları bildirim gönder</p>
        <Switch checked={draft.notifyOnWeekends} onCheckedChange={(v) => set("notifyOnWeekends", v)} />
      </div>

      {/* Events matrix */}
      <div className="space-y-3 border-t border-border/60 pt-5">
        <p className="text-sm font-semibold text-foreground">Bildirim Olayları</p>
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Olay
                </th>
                {CHANNEL_ORDER.map((c) => (
                  <th key={c} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {CHANNEL_LABELS[c]}
                  </th>
                ))}
                <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Hatırlatma (dk)
                </th>
              </tr>
            </thead>
            <tbody>
              {EVENT_ORDER.map((key) => {
                const cfg = draft.events[key];
                return (
                  <tr key={key} className="border-b border-border/40 last:border-b-0">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggleEventEnabled(key)}
                        className="flex items-center gap-2 text-left"
                      >
                        <Switch checked={cfg.enabled} onCheckedChange={() => toggleEventEnabled(key)} />
                        <span className={cn("text-sm", !cfg.enabled && "text-muted-foreground")}>
                          {EVENT_LABELS[key]}
                        </span>
                      </button>
                    </td>
                    {CHANNEL_ORDER.map((c) => (
                      <td key={c} className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={cfg.channels[c]}
                          disabled={!cfg.enabled}
                          onChange={() => toggleChannel(key, c)}
                          className="h-4 w-4 rounded border-input accent-primary disabled:opacity-40"
                          aria-label={`${EVENT_LABELS[key]} — ${CHANNEL_LABELS[c]}`}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {"reminderMinutesBefore" in cfg && cfg.reminderMinutesBefore !== undefined ? (
                        <NumericInput
                          min={0}
                          value={cfg.reminderMinutesBefore}
                          onValueChange={(v) => setReminder(key, v)}
                          disabled={!cfg.enabled}
                          className="mx-auto w-20 text-center"
                        />
                      ) : (
                        <span className="block text-center text-xs text-muted-foreground/60">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SettingsFormSection>
  );
}

export default function NotificationSettingsPage() {
  return (
    <SettingsAccessGuard sectionKey="notifications">
      <NotificationSettingsContent />
    </SettingsAccessGuard>
  );
}
