"use client";

import { useSettingsSection } from "@/hooks/use-settings-section";
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
import type {
  SessionSettings,
  MakeupSessionBillingBehavior,
} from "@/types/settings";
import { BREAK_MINUTE_OPTIONS, LESSON_MINUTES, lessonDuration } from "@/lib/helpers/scheduling-rules";

const MAKEUP_BILLING_LABELS: Record<MakeupSessionBillingBehavior, string> = {
  billable: "Telafi seansı ücretlendirilir",
  non_billable: "Telafi seansı ücretsizdir",
};

function SessionSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel, resetToDefaults, metadata } =
    useSettingsSection("sessions");

  const set = <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <SettingsFormSection
      title="Seans Ayarları"
      description="Mola, iptal ve telafi kuralları. Öğrenci ve öğretmen çakışması her zaman engellenir. Yeni/Düzenle Seans formu, haftalık plan oluşturma ve otomatik tamamlama bu ayarlara göre çalışır."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      {/* Lesson length + break */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsField
          label="Ders Süresi"
          description={`Sabit. Blok ders iki dersin arka arkaya yapılmasıdır (${lessonDuration(2)} dk); seans ve haftalık plan formunda seçilir.`}
        >
          <p className="flex h-9 items-center rounded-lg border border-border/60 bg-muted/40 px-3 text-sm text-foreground">
            {LESSON_MINUTES} dakika
          </p>
        </SettingsField>
        <SettingsField
          label="Mola (dk)"
          error={errors.breakMinutes}
          description="Aynı öğretmenin veya aynı öğrencinin iki seansı arasında bırakılan süre. Sonraki ders bu moladan sonra eklenebilir. Blok dersin içinde mola yoktur."
        >
          <Select
            value={String(draft.breakMinutes)}
            onValueChange={(val) => { if (val !== null) set("breakMinutes", Number(val)); }}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue>{() => (draft.breakMinutes === 0 ? "Mola yok" : `${draft.breakMinutes} dakika`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BREAK_MINUTE_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m === 0 ? "Mola yok" : `${m} dakika`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </div>

      {/* Cancellation notice */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsField
          label="İptal İçin Minimum Bildirim (saat)"
          description="Daha geç iptallerde form uyarır ve seansın 'Gelmedi' (ücretli) işaretlenmesini önerir. 0 = kural yok."
        >
          <NumericInput
            min={0}
            value={draft.cancellationMinNoticeHours}
            onValueChange={(v) => set("cancellationMinNoticeHours", v ?? 0)}
          />
        </SettingsField>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Seansları Otomatik Tamamla</p>
          <p className="text-xs text-muted-foreground">
            Planlanmış bir seans, bitişinden (başlangıç + seans süresi) belirtilen süre sonra otomatik olarak &quot;Tamamlandı&quot; durumuna geçer.
          </p>
        </div>
        <Switch checked={draft.autoCompleteEnabled} onCheckedChange={(v) => set("autoCompleteEnabled", v)} />
      </div>
      {draft.autoCompleteEnabled && (
        <SettingsField label="Otomatik Tamamlama Gecikmesi (dk)" className="sm:max-w-xs">
          <NumericInput
            min={0}
            value={draft.autoCompleteDelayMinutes}
            onValueChange={(v) => set("autoCompleteDelayMinutes", v ?? 0)}
          />
        </SettingsField>
      )}

      {/* Other rules */}
      <div className="space-y-3 border-t border-border/60 pt-5">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Geçmiş Tarihe Seans Girişine İzin Ver</p>
            <p className="text-xs text-muted-foreground">Kapalı olduğunda yalnızca bugün ve sonrası için seans oluşturulabilir.</p>
          </div>
          <Switch checked={draft.allowPastDateSessions} onCheckedChange={(v) => set("allowPastDateSessions", v)} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Tamamlanmış Seansların Düzenlenmesine İzin Ver</p>
            <p className="text-xs text-muted-foreground">Kapalı olduğunda &quot;Tamamlandı&quot; durumundaki seanslar kilitlenir.</p>
          </div>
          <Switch
            checked={draft.allowEditingCompletedSessions}
            onCheckedChange={(v) => set("allowEditingCompletedSessions", v)}
          />
        </div>
        <SettingsField
          label="Telafi Seansı Ücretlendirmesi"
          className="sm:max-w-md"
          description="Ücretsiz seçilirse bir seans 'Telafi' yapıldığında ücreti 0'a çekilir."
        >
          <Select
            value={draft.makeupSessionBehavior}
            onValueChange={(val) => { if (val) set("makeupSessionBehavior", val as MakeupSessionBillingBehavior); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(val: MakeupSessionBillingBehavior) => MAKEUP_BILLING_LABELS[val]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MAKEUP_BILLING_LABELS) as MakeupSessionBillingBehavior[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {MAKEUP_BILLING_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </div>
    </SettingsFormSection>
  );
}

export default function SessionSettingsPage() {
  return <SessionSettingsContent />;
}
