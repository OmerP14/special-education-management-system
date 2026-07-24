import {
  Building2,
  GraduationCap,
  CalendarClock,
  CalendarDays,
  Wallet,
  Banknote,
  UsersRound,
  Bell,
  UserCog,
  Database,
  Palette,
  ShieldCheck,
  History,
  type LucideIcon,
} from "lucide-react";
import type { InstitutionSettingsKey, SettingsSectionKey } from "@/types/settings";

// ─── Permission-ready section registry ──────────────────────────────────────
//
// The full roles/permissions engine doesn't exist yet (see permissions.ts —
// canAccessSettingsSection is the one, centralized place that reads this
// metadata today). What's built here is the part that has to exist BEFORE a
// real engine can be dropped in without a redesign: every section already
// declares its required permission key, and whether it's owner-only,
// finance-sensitive, or system-sensitive — so wiring a real role→permission
// matrix later is a change to canAccessSettingsSection's *implementation*,
// never to every settings page that calls it.

export interface SettingsSectionMeta {
  key: SettingsSectionKey;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Not enforced by a real permission engine yet — see canAccessSettingsSection. */
  permissionKey: string;
  ownerOnly: boolean;
  financeSensitive: boolean;
  systemSensitive: boolean;
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  {
    key: "institution",
    label: "Kurum Bilgileri",
    description: "Kurum adı, logo, iletişim ve resmi bilgiler",
    href: "/app/settings/institution",
    icon: Building2,
    permissionKey: "settings.institution.manage",
    ownerOnly: false,
    financeSensitive: false,
    systemSensitive: false,
  },
  {
    key: "educationTypes",
    label: "Eğitim Türleri",
    description: "Süre, ücret ve renk ayarlarını yönetin",
    href: "/app/settings/education-types",
    icon: GraduationCap,
    permissionKey: "settings.education_types.manage",
    ownerOnly: false,
    financeSensitive: false,
    systemSensitive: false,
  },
  {
    key: "sessions",
    label: "Seans Ayarları",
    description: "Süre, çakışma ve otomatik tamamlanma kuralları",
    href: "/app/settings/sessions",
    icon: CalendarClock,
    permissionKey: "settings.sessions.manage",
    ownerOnly: false,
    financeSensitive: false,
    systemSensitive: false,
  },
  {
    key: "calendar",
    label: "Takvim ve Çalışma Saatleri",
    description: "Çalışma günleri, saatleri ve takvim görünümü",
    href: "/app/settings/calendar",
    icon: CalendarDays,
    permissionKey: "settings.calendar.manage",
    ownerOnly: false,
    financeSensitive: false,
    systemSensitive: false,
  },
  {
    key: "finance",
    label: "Finans Ayarları",
    description: "Para birimi, ödeme yöntemleri ve kasa kuralları",
    href: "/app/settings/finance",
    icon: Wallet,
    permissionKey: "settings.finance.manage",
    ownerOnly: true,
    financeSensitive: true,
    systemSensitive: false,
  },
  {
    key: "teacherEarnings",
    label: "Öğretmen ve Hakediş Ayarları",
    description: "Kurum geneli hakediş politikaları ve varsayılanlar",
    href: "/app/settings/teacher-earnings",
    icon: Banknote,
    permissionKey: "settings.teacher_earnings.manage",
    ownerOnly: true,
    financeSensitive: true,
    systemSensitive: false,
  },
  {
    key: "students",
    label: "Öğrenci ve Veli Ayarları",
    description: "Kayıt kuralları ve zorunlu alanlar",
    href: "/app/settings/students",
    icon: UsersRound,
    permissionKey: "settings.students.manage",
    ownerOnly: false,
    financeSensitive: false,
    systemSensitive: false,
  },
  {
    key: "notifications",
    label: "Bildirim Ayarları",
    description: "Kanal, olay ve hatırlatma tercihleri",
    href: "/app/settings/notifications",
    icon: Bell,
    permissionKey: "settings.notifications.manage",
    ownerOnly: false,
    financeSensitive: false,
    systemSensitive: false,
  },
  {
    key: "users",
    label: "Kullanıcılar ve Roller",
    description: "Ekip üyeleri, davetler ve rol etiketleri",
    href: "/app/settings/users",
    icon: UserCog,
    permissionKey: "settings.users.manage",
    ownerOnly: true,
    financeSensitive: false,
    systemSensitive: true,
  },
  {
    key: "data",
    label: "Excel ve Veri Yönetimi",
    description: "İçe aktarım, dışa aktarım, yedekleme ve veri sağlığı",
    href: "/app/settings/data",
    icon: Database,
    permissionKey: "settings.data.manage",
    ownerOnly: true,
    financeSensitive: false,
    systemSensitive: true,
  },
  {
    key: "appearance",
    label: "Belge ve Görünüm Ayarları",
    description: "Marka, belge şablonları ve arayüz yoğunluğu",
    href: "/app/settings/appearance",
    icon: Palette,
    permissionKey: "settings.appearance.manage",
    ownerOnly: false,
    financeSensitive: false,
    systemSensitive: false,
  },
  {
    key: "security",
    label: "Güvenlik ve Sistem",
    description: "Oturum, parola politikası ve onay kuralları (mock)",
    href: "/app/settings/security",
    icon: ShieldCheck,
    permissionKey: "settings.security.manage",
    ownerOnly: true,
    financeSensitive: false,
    systemSensitive: true,
  },
  {
    key: "audit",
    label: "İşlem Geçmişi",
    description: "Kurum genelindeki değişikliklerin kaydı",
    href: "/app/settings/audit",
    icon: History,
    permissionKey: "settings.audit.view",
    ownerOnly: true,
    financeSensitive: false,
    systemSensitive: true,
  },
];

export function getSettingsSectionMeta(key: SettingsSectionKey): SettingsSectionMeta {
  const meta = SETTINGS_SECTIONS.find((s) => s.key === key);
  if (!meta) throw new Error(`Unknown settings section: ${key}`);
  return meta;
}

/** Human-readable labels for the raw InstitutionSettings data fields — used
 *  by audit log entries, which record what data changed. Deliberately
 *  separate from SETTINGS_SECTIONS (nav labels): "documents" and
 *  "appearance" are two data fields edited from the one "Belge ve Görünüm
 *  Ayarları" nav page, so the two registries can't share keys. */
export const INSTITUTION_SETTINGS_FIELD_LABELS: Record<InstitutionSettingsKey, string> = {
  institution: "Kurum Bilgileri",
  sessions: "Seans Ayarları",
  calendar: "Takvim ve Çalışma Saatleri",
  finance: "Finans Ayarları",
  teacherEarnings: "Öğretmen ve Hakediş Ayarları",
  students: "Öğrenci ve Veli Ayarları",
  notifications: "Bildirim Ayarları",
  documents: "Belge Ayarları",
  appearance: "Görünüm Ayarları",
  security: "Güvenlik ve Sistem",
  dataManagement: "Veri Yönetimi",
};
