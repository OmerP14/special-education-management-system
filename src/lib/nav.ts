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
  BookOpen,
  CircleDollarSign,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavGroup {
  /** Stable key used for persisting expand/collapse state — never derive from
   *  `label` (labels can change; ids shouldn't). */
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

// ─── Ungrouped top-level items — always visible, no section header ───────────

export const NAV_TOP_ITEMS: NavItem[] = [
  { label: "Panel", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Takvim", href: "/app/calendar", icon: Calendar },
];

// ─── Grouped sections — each independently collapsible in the sidebar ────────
// Routes/labels below are unchanged from the flat nav this replaces, except two
// labels ("Öğrenci Ödemeleri", "Öğretmen Hakedişleri") that were inconsistent
// with the pages' own on-screen titles — corrected here for clarity now that
// they sit grouped next to each other, not renamed anywhere else.

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "people",
    label: "Kişiler",
    icon: Users,
    items: [
      { label: "Öğrenciler", href: "/app/students", icon: Users },
      { label: "Veliler", href: "/app/guardians", icon: UserCheck },
      { label: "Öğretmenler", href: "/app/teachers", icon: GraduationCap },
    ],
  },
  {
    id: "education",
    label: "Eğitim",
    icon: BookOpen,
    items: [{ label: "Seanslar", href: "/app/sessions", icon: CalendarDays }],
  },
  {
    id: "finance",
    label: "Finans",
    icon: CircleDollarSign,
    items: [
      { label: "Öğrenci Ödemeleri", href: "/app/payments", icon: CreditCard },
      { label: "Öğretmen Hakedişleri", href: "/app/teacher-earnings", icon: Banknote },
      { label: "Günlük Kasa", href: "/app/cash-register", icon: Wallet },
    ],
  },
  {
    id: "reporting",
    label: "Raporlama",
    icon: BarChart3,
    items: [
      { label: "Raporlar", href: "/app/reports", icon: BarChart3 },
      { label: "Excel Aktarımı", href: "/app/import", icon: FileUp },
    ],
  },
];

// ─── Footer item — standalone, outside every group ────────────────────────────

export const NAV_SETTINGS_ITEM: NavItem = {
  label: "Ayarlar",
  href: "/app/settings",
  icon: Settings,
};

// ─── Active-route matching ─────────────────────────────────────────────────────
// Shared by the sidebar and the topbar breadcrumb so "what counts as active"
// never drifts between the two.

export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/app/dashboard" && pathname.startsWith(href));
}

export interface NavBreadcrumb {
  groupLabel: string | null;
  pageLabel: string;
}

/** Resolves the current route to a "Section / Page" label pair for the topbar.
 *  Falls back to null/null for routes outside the nav model (e.g. a detail page
 *  one level below a list item) — callers should fall back to the page's own
 *  title in that case rather than show nothing. */
export function resolveNavBreadcrumb(pathname: string): NavBreadcrumb | null {
  for (const item of NAV_TOP_ITEMS) {
    if (isNavItemActive(pathname, item.href)) return { groupLabel: null, pageLabel: item.label };
  }
  if (isNavItemActive(pathname, NAV_SETTINGS_ITEM.href)) {
    return { groupLabel: null, pageLabel: NAV_SETTINGS_ITEM.label };
  }
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (isNavItemActive(pathname, item.href)) {
        return { groupLabel: group.label, pageLabel: item.label };
      }
    }
  }
  return null;
}
