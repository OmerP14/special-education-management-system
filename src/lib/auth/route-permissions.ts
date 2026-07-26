import type { PermissionKey } from "@/types/auth";
import { SETTINGS_SECTIONS } from "@/lib/settings/sections";
import { hasPermission } from "@/lib/auth/permissions";

// ─── Route → permission map ──────────────────────────────────────────────────
//
// Covers every top-level /app/* route. Prefix-matched the same way
// isNavItemActive (lib/nav.ts) already treats a href as "active" for anything
// nested under it — one rule, not two independently-drifting ones.
//
// A route with no entry here is "authenticated only, no specific permission
// required" (matches how the app worked before this phase for anything the
// nav didn't already gate).

interface RoutePermissionEntry {
  pattern: string;
  permission: PermissionKey;
}

const SETTINGS_ROUTES: RoutePermissionEntry[] = SETTINGS_SECTIONS.map((s) => ({
  pattern: s.href,
  permission: s.permissionKey,
}));

export const ROUTE_PERMISSION_MAP: RoutePermissionEntry[] = [
  { pattern: "/app/dashboard", permission: "dashboard.view" },
  { pattern: "/app/calendar", permission: "calendar.view" },
  { pattern: "/app/students", permission: "students.view" },
  { pattern: "/app/guardians", permission: "guardians.view" },
  { pattern: "/app/teachers", permission: "teachers.view" },
  { pattern: "/app/sessions", permission: "sessions.view" },
  { pattern: "/app/finance", permission: "finance.dashboard.view" },
  { pattern: "/app/payments", permission: "finance.student_payments.view" },
  { pattern: "/app/teacher-earnings", permission: "finance.teacher_earnings.view" },
  { pattern: "/app/cash-register", permission: "finance.cash.view" },
  { pattern: "/app/reports", permission: "reports.view" },
  { pattern: "/app/import", permission: "import.view" },
  // Longer/more specific settings paths must be checked before the bare
  // "/app/settings" index below — see canAccessRoute's longest-match sort.
  ...SETTINGS_ROUTES,
  { pattern: "/app/settings", permission: "settings.view" },
];

/** Longest matching pattern wins (so "/app/settings/security" doesn't fall
 *  through to the bare "/app/settings" entry). Returns true (route allowed)
 *  when nothing matches — an unlisted route is "authenticated only." */
export function canAccessRoute(pathname: string, permissions: PermissionKey[]): boolean {
  const matches = ROUTE_PERMISSION_MAP.filter(
    (r) => pathname === r.pattern || pathname.startsWith(`${r.pattern}/`)
  ).sort((a, b) => b.pattern.length - a.pattern.length);

  const best = matches[0];
  if (!best) return true;
  return hasPermission(permissions, best.permission);
}
