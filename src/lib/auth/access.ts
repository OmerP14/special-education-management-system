"use client";

import { useAuth } from "@/lib/auth/AuthProvider";
import type { AccountRole } from "@/types/auth";

// ─── What each account may open and see in the app ─────────────────────────
//
// The server already keeps money away from staff (src/lib/server/staff-view.ts
// strips it and ignores staff changes to it); this only shapes the screens so
// staff never see empty money columns or controls whose changes would be
// thrown away.

/** Pages a staff account may open; everything else is admin only. */
const STAFF_PATHS = ["/app/dashboard", "/app/calendar", "/app/sessions", "/app/students", "/app/teachers", "/app/profile"];

export function canAccessPath(role: AccountRole, pathname: string): boolean {
  if (role === "admin") return true;
  return STAFF_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function useAccess() {
  const { user } = useAuth();
  const role: AccountRole = user?.role ?? "admin";
  const isAdmin = role === "admin";
  return {
    isAdmin,
    /** Prices, debts, payments, teacher pay. */
    seesMoney: isAdmin,
    /** Teachers, education types and pay rates (staff only read them). */
    managesTeachers: isAdmin,
    /** Deleting records that payments and reports hang on. */
    deletesRecords: isAdmin,
    canAccess: (pathname: string) => canAccessPath(role, pathname),
  };
}
