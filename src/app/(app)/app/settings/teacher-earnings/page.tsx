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
  TeacherEarningsSettings,
  MakeupEarningBehavior,
  CancelledEarningBehavior,
  NoShowEarningBehavior,
} from "@/types/settings";

// Only the three choices that differ from one institution to the next stay
// on screen; every other earning rule runs on a fixed value (FIXED_SETTINGS
// in lib/settings/defaults.ts). How much a teacher earns per lesson is set
// on the teacher's own page.

const MAKEUP_LABELS: Record<MakeupEarningBehavior, string> = {
  full: "Tam ücret ödensin",
  half: "Yarım ücret ödensin",
  none: "Ödeme yapılmasın",
};

const CANCELLED_LABELS: Record<CancelledEarningBehavior, string> = {
  none: "Ödeme yapılmasın",
  partial: "Yarım ücret ödensin",
};

const NO_SHOW_LABELS: Record<NoShowEarningBehavior, string> = {
  none: "Ödeme yapılmasın",
  partial: "Yarım ücret ödensin",
  full: "Tam ücret ödensin",
};

function ChoiceField<T extends string>({
  label,
  description,
  value,
  onChange,
  labels,
}: {
  label: string;
  description: string;
  value: T;
  onChange: (v: T) => void;
  labels: Record<T, string>;
}) {
  return (
    <SettingsField label={label} description={description}>
      <Select value={value} onValueChange={(v) => { if (v) onChange(v as T); }}>
        <SelectTrigger className="h-11 w-full text-base sm:max-w-sm">
          <SelectValue>{() => labels[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(labels) as T[]).map((key) => (
            <SelectItem key={key} value={key} className="py-2 text-base">
              {labels[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsField>
  );
}

function TeacherEarningsSettingsContent() {
  const { draft, setDraft, isDirty, errors, savedMessage, save, cancel } = useSettingsSection("teacherEarnings");

  const set = <K extends keyof TeacherEarningsSettings>(key: K, value: TeacherEarningsSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <SettingsFormSection
      title="Öğretmen Ödemeleri"
      description="Öğretmenin bir dersten ne kadar kazanacağı, öğretmenin kendi sayfasından ayarlanır. Burada yalnızca özel durumlarda öğretmene ödeme yapılıp yapılmayacağını seçersiniz. Değişiklik, bundan sonra kaydedilen derslere uygulanır."
      isDirty={isDirty}
      errors={errors}
      savedMessage={savedMessage}
      onSave={save}
      onCancel={cancel}
    >
      <div className="space-y-6">
        <ChoiceField
          label="Öğrenci derse gelmezse"
          description="Öğretmen derse hazır olduğu halde öğrenci gelmediğinde."
          value={draft.noShowSessionEarning}
          onChange={(v) => set("noShowSessionEarning", v)}
          labels={NO_SHOW_LABELS}
        />
        <ChoiceField
          label="Ders iptal edilirse"
          description="Ders yapılmadan önce iptal edildiğinde."
          value={draft.cancelledSessionEarning}
          onChange={(v) => set("cancelledSessionEarning", v)}
          labels={CANCELLED_LABELS}
        />
        <ChoiceField
          label="Telafi dersinde"
          description="Kaçırılan bir dersin yerine yapılan telafi dersinde."
          value={draft.makeupSessionEarningBehavior}
          onChange={(v) => set("makeupSessionEarningBehavior", v)}
          labels={MAKEUP_LABELS}
        />
      </div>
    </SettingsFormSection>
  );
}

export default function TeacherEarningsSettingsPage() {
  return <TeacherEarningsSettingsContent />;
}
