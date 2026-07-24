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
import type {
  SessionSettings,
  SessionTimeStepMinutes,
  SessionConflictBehavior,
  MakeupSessionBillingBehavior,
} from "@/types/settings";

const TIME_STEP_OPTIONS: SessionTimeStepMinutes[] = [5, 10, 15, 30];

const CONFLICT_BEHAVIOR_LABELS: Record<SessionConflictBehavior, string> = {
  block_full_and_partial: "Tam ve kısmi çakışmayı engelle",
  block_full_only: "Yalnızca tam (birebir) çakışmayı engelle",
};

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
      description="Seans süresi, çakışma kontrolü ve devam/telafi kurallarını yönetin. Bu ayarlar Yeni/Düzenle Seans formunu ve haftalık plan oluşturmayı doğrudan etkiler."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      metadata={metadata}
      onSave={save}
      onCancel={cancel}
      onReset={resetToDefaults}
    >
      {/* Duration */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SettingsField label="Varsayılan Süre (dk)" error={errors.defaultDurationMinutes}>
          <NumericInput
            min={1}
            value={draft.defaultDurationMinutes}
            onValueChange={(v) => set("defaultDurationMinutes", v ?? 0)}
          />
        </SettingsField>
        <SettingsField label="Varsayılan Mola (dk)">
          <NumericInput
            min={0}
            value={draft.defaultBreakMinutes}
            onValueChange={(v) => set("defaultBreakMinutes", v ?? 0)}
          />
        </SettingsField>
        <SettingsField label="Minimum Süre (dk)" error={errors.minDurationMinutes}>
          <NumericInput
            min={1}
            value={draft.minDurationMinutes}
            onValueChange={(v) => set("minDurationMinutes", v ?? 0)}
          />
        </SettingsField>
        <SettingsField label="Maksimum Süre (dk)">
          <NumericInput
            min={1}
            value={draft.maxDurationMinutes}
            onValueChange={(v) => set("maxDurationMinutes", v ?? 0)}
          />
        </SettingsField>
      </div>

      <SettingsField label="Zaman Adımı" description="Seans formundaki saat seçicide kullanılan aralık.">
        <Select
          value={String(draft.timeStepMinutes)}
          onValueChange={(val) => { if (val) set("timeStepMinutes", Number(val) as SessionTimeStepMinutes); }}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>{() => `${draft.timeStepMinutes} dakika`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TIME_STEP_OPTIONS.map((step) => (
              <SelectItem key={step} value={String(step)}>
                {step} dakika
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsField>

      {/* Auto-complete & tolerances */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SettingsField
          label="Geç Kalma Toleransı (dk)"
          description="Öğrenci bu süreyi aşarsa geç kalmış sayılır."
        >
          <NumericInput
            min={0}
            value={draft.lateToleranceMinutes}
            onValueChange={(v) => set("lateToleranceMinutes", v ?? 0)}
          />
        </SettingsField>
        <SettingsField
          label="Devamsızlık Eşiği (dk)"
          description="Bu süreyi aşan gecikme, gelmedi (no-show) sayılır."
        >
          <NumericInput
            min={0}
            value={draft.noShowThresholdMinutes}
            onValueChange={(v) => set("noShowThresholdMinutes", v ?? 0)}
          />
        </SettingsField>
        <SettingsField
          label="İptal İçin Minimum Bildirim (saat)"
          description="Bir seans, başlangıcından en az bu kadar önce iptal edilebilir."
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
            Planlanmış bir seans, bitişinden belirtilen süre sonra otomatik olarak &quot;Tamamlandı&quot; durumuna geçer.
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

      {/* Conflict rules */}
      <div className="space-y-3 border-t border-border/60 pt-5">
        <p className="text-sm font-semibold text-foreground">Çakışma Kontrolü</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
            <p className="text-sm text-foreground">Öğrenci çakışmasını engelle</p>
            <Switch
              checked={draft.preventStudentConflict}
              onCheckedChange={(v) => set("preventStudentConflict", v)}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-4 py-3">
            <p className="text-sm text-foreground">Öğretmen çakışmasını engelle</p>
            <Switch
              checked={draft.preventTeacherConflict}
              onCheckedChange={(v) => set("preventTeacherConflict", v)}
            />
          </div>
        </div>
        <SettingsField label="Çakışma Davranışı" className="sm:max-w-md">
          <Select
            value={draft.conflictBehavior}
            onValueChange={(val) => { if (val) set("conflictBehavior", val as SessionConflictBehavior); }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>{(val: SessionConflictBehavior) => CONFLICT_BEHAVIOR_LABELS[val]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CONFLICT_BEHAVIOR_LABELS) as SessionConflictBehavior[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {CONFLICT_BEHAVIOR_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </div>

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
        <SettingsField label="Telafi Seansı Ücretlendirmesi" className="sm:max-w-md">
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
  return (
    <SettingsAccessGuard sectionKey="sessions">
      <SessionSettingsContent />
    </SettingsAccessGuard>
  );
}
