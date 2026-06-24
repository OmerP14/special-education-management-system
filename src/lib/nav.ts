import {
  LayoutDashboard,
  Users,
  UserCheck,
  GraduationCap,
  Calendar,
  CalendarDays,
  CreditCard,
  Banknote,
  Wallet,
  BarChart3,
  FileUp,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Panel", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Takvim", href: "/app/calendar", icon: Calendar },
  { label: "Öğrenciler", href: "/app/students", icon: Users },
  { label: "Öğretmenler", href: "/app/teachers", icon: GraduationCap },
  { label: "Veliler", href: "/app/guardians", icon: UserCheck },
  { label: "Seanslar", href: "/app/sessions", icon: CalendarDays },
  { label: "Ödemeler", href: "/app/payments", icon: CreditCard },
  { label: "Günlük Kasa", href: "/app/cash-register", icon: Wallet },
  { label: "Öğretmen Kazançları", href: "/app/teacher-earnings", icon: Banknote },
  { label: "Raporlar", href: "/app/reports", icon: BarChart3 },
  { label: "Excel Aktarımı", href: "/app/import", icon: FileUp },
  { label: "Ayarlar", href: "/app/settings", icon: Settings },
];
