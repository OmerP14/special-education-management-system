import {
  Building2,
  GraduationCap,
  CalendarClock,
  CalendarDays,
  Wallet,
  Banknote,
  UsersRound,
  Database,
  Palette,
  ShieldCheck,
  History,
  type LucideIcon,
} from "lucide-react";
import type { InstitutionSettingsKey, SettingsSectionKey } from "@/types/settings";

// ─── Settings section registry ──────────────────────────────────────────────
// One entry per Ayarlar page — drives the settings nav and overview cards.

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
    description: "Kurum adı, logo, iletişim ve resmi bilgiler",
    href: "/app/settings/institution",
    icon: Building2,
  },
  {
    key: "educationTypes",
    label: "Eğitim Türleri",
    description: "Süre, ücret ve renk ayarlarını yönetin",
    href: "/app/settings/education-types",
    icon: GraduationCap,
  },
  {
    key: "sessions",
    label: "Seans Ayarları",
    description: "Süre, çakışma ve otomatik tamamlanma kuralları",
    href: "/app/settings/sessions",
    icon: CalendarClock,
  },
  {
    key: "calendar",
    label: "Takvim ve Çalışma Saatleri",
    description: "Çalışma günleri, saatleri ve takvim görünümü",
    href: "/app/settings/calendar",
    icon: CalendarDays,
  },
  {
    key: "finance",
    label: "Finans Ayarları",
    description: "Para birimi, ödeme yöntemleri ve makbuz kuralları",
    href: "/app/settings/finance",
    icon: Wallet,
  },
  {
    key: "teacherEarnings",
    label: "Öğretmen ve Hakediş Ayarları",
    description: "Kurum geneli hakediş politikaları ve varsayılanlar",
    href: "/app/settings/teacher-earnings",
    icon: Banknote,
  },
  {
    key: "students",
    label: "Öğrenci ve Veli Ayarları",
    description: "Kayıt kuralları ve zorunlu alanlar",
    href: "/app/settings/students",
    icon: UsersRound,
  },
  {
    key: "data",
    label: "Excel ve Veri Yönetimi",
    description: "İçe aktarım, dışa aktarım, yedekleme ve veri sağlığı",
    href: "/app/settings/data",
    icon: Database,
  },
  {
    key: "appearance",
    label: "Görünüm Ayarları",
    description: "Tema ve açılış sayfası",
    href: "/app/settings/appearance",
    icon: Palette,
  },
  {
    key: "security",
    label: "Güvenlik ve Sistem",
    description: "Parola, giriş, işlem geçmişi, onay ve bildirim kuralları",
    href: "/app/settings/security",
    icon: ShieldCheck,
  },
  {
    key: "audit",
    label: "İşlem Geçmişi",
    description: "Kurum genelindeki değişikliklerin kaydı",
    href: "/app/settings/audit",
    icon: History,
  },
];

export function getSettingsSectionMeta(key: SettingsSectionKey): SettingsSectionMeta {
  const meta = SETTINGS_SECTIONS.find((s) => s.key === key);
  if (!meta) throw new Error(`Unknown settings section: ${key}`);
  return meta;
}

/** Human-readable labels for the raw InstitutionSettings data fields — used
 *  by audit log entries, which record what data changed. Separate from
 *  SETTINGS_SECTIONS (nav labels): `dataManagement` has no nav entry of its
 *  own and the audit page has no data field. */
export const INSTITUTION_SETTINGS_FIELD_LABELS: Record<InstitutionSettingsKey, string> = {
  institution: "Kurum Bilgileri",
  sessions: "Seans Ayarları",
  calendar: "Takvim ve Çalışma Saatleri",
  finance: "Finans Ayarları",
  teacherEarnings: "Öğretmen ve Hakediş Ayarları",
  students: "Öğrenci ve Veli Ayarları",
  appearance: "Görünüm Ayarları",
  dataManagement: "Veri Yönetimi",
};
