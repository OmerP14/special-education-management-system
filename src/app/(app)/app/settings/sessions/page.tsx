"use client";

import { useSettingsSection } from "@/hooks/use-settings-section";
import { SettingsFormSection } from "@/components/settings/SettingsFormSection";
import { SettingsField } from "@/components/settings/SettingsField";
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

// Auto-completion, late-cancellation notice, past-date entry and editing of
// completed lessons run on fixed values (FIXED_SETTINGS in
// lib/settings/defaults.ts); only these two choices stay on screen.

const MAKEUP_BILLING_LABELS: Record<MakeupSessionBillingBehavior, string> = {
  billable: "Evet, normal ücret alınsın",
  non_billable: "Hayır, ücretsiz olsun",
};

const breakLabel = (m: number) => (m === 0 ? "Mola yok" : `${m} dakika`);

function SessionSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel } =
    useSettingsSection("sessions");

  const set = <K extends keyof SessionSettings>(key: K, value: SessionSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <SettingsFormSection
      title="Ders Kuralları"
      description={`Bir ders ${LESSON_MINUTES} dakikadır; blok ders iki dersin arka arkaya yapılmasıdır (${lessonDuration(2)} dakika). Aynı saatte bir öğretmene veya bir öğrenciye iki ders verilmesine sistem izin vermez.`}
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      onSave={save}
      onCancel={cancel}
    >
      <div className="space-y-6">
        <SettingsField
          label="Dersler arası mola"
          error={errors.breakMinutes}
          description="Aynı öğretmenin veya aynı öğrencinin iki dersi arasında bırakılacak süre."
        >
          <Select
            value={String(draft.breakMinutes)}
            onValueChange={(val) => { if (val !== null) set("breakMinutes", Number(val)); }}
          >
            <SelectTrigger className="h-11 w-full text-base sm:max-w-xs">
              <SelectValue>{() => breakLabel(draft.breakMinutes)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BREAK_MINUTE_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)} className="py-2 text-base">
                  {breakLabel(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label="Telafi dersi için veliden ücret alınsın mı?"
          description="Kaçırılan bir dersin yerine yapılan telafi dersi. Bundan sonra kaydedilen telafi derslerine uygulanır."
        >
          <Select
            value={draft.makeupSessionBehavior}
            onValueChange={(val) => { if (val) set("makeupSessionBehavior", val as MakeupSessionBillingBehavior); }}
          >
            <SelectTrigger className="h-11 w-full text-base sm:max-w-sm">
              <SelectValue>{(val: MakeupSessionBillingBehavior) => MAKEUP_BILLING_LABELS[val]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(MAKEUP_BILLING_LABELS) as MakeupSessionBillingBehavior[]).map((key) => (
                <SelectItem key={key} value={key} className="py-2 text-base">
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
