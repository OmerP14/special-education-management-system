import {
  Building2,
  GraduationCap,
  CalendarClock,
  CalendarDays,
  Wallet,
  Banknote,
  Database,
  type LucideIcon,
} from "lucide-react";
import type { SettingsSectionKey } from "@/types/settings";

// ─── Settings section registry ──────────────────────────────────────────────
// One entry per Ayarlar page — drives the settings nav and overview cards.
// Kept short and in plain words on purpose: the people using this are not
// technical, so rarely-needed options were taken off these screens and run on
// fixed values (see FIXED_SETTINGS in lib/settings/defaults.ts).

export interface SettingsSectionMeta {
  key: SettingsSectionKey;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  {
    key: "institution",
    label: "Kurum Bilgileri",
    description: "Kurumun adı, logosu, telefonu ve adresi",
    href: "/app/settings/institution",
    icon: Building2,
  },
  {
    key: "educationTypes",
    label: "Eğitim Türleri ve Ücretler",
    description: "Verilen eğitimler ve ders ücretleri",
    href: "/app/settings/education-types",
    icon: GraduationCap,
  },
  {
    key: "calendar",
    label: "Çalışma Saatleri",
    description: "Çalışılan günler, saatler ve tatiller",
    href: "/app/settings/calendar",
    icon: CalendarDays,
  },
  {
    key: "sessions",
    label: "Ders Kuralları",
    description: "Dersler arası mola ve telafi dersi ücreti",
    href: "/app/settings/sessions",
    icon: CalendarClock,
  },
  {
    key: "finance",
    label: "Öğrenci Ödemeleri",
    description: "Ödeme yöntemleri ve borç uyarısı",
    href: "/app/settings/finance",
    icon: Wallet,
  },
  {
    key: "teacherEarnings",
    label: "Öğretmen Ödemeleri",
    description: "Telafi, iptal ve gelmeyen öğrenci derslerinde öğretmene ödeme",
    href: "/app/settings/teacher-earnings",
    icon: Banknote,
  },
  {
    key: "data",
    label: "Yedekleme ve Excel",
    description: "Yedek alma, geri yükleme ve Excel dosyaları",
    href: "/app/settings/data",
    icon: Database,
  },
];

