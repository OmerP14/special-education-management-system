// ─── Auth — admin account and optional staff account ───────────────────────
//
// Two logins at most. The admin account (created by the first-run setup) has
// full access; the optional staff ("personel") account the admin opens sees
// lessons, the calendar, students and teachers — never money, reports or
// settings. Several people may share each login on different devices.
//
// Accounts, passwords and sessions live on the server — see
// src/lib/server/auth-core.ts (rules), src/lib/server/staff-view.ts (what
// staff may see/change) and src/lib/auth/AuthProvider.tsx (useAuth()). The
// browser only holds an httpOnly session cookie.

export type AccountRole = "admin" | "staff";

/** The UI-facing identity useAuth() exposes — never the lockout bookkeeping
 *  or the password hash. */
export interface AuthUser {
  username: string;
  name: string;
  role: AccountRole;
  /** When this device signed in. */
  loginAt: string;
}

/** What the admin's Ayarlar page shows about the staff account. */
export interface StaffAccountInfo {
  username: string;
  name: string;
  lastLoginAt: string | null;
}

export type AuthErrorCode = "invalid_credentials" | "account_locked" | "unknown";

export interface AuthResult<T = void> {
  success: boolean;
  data?: T;
  error?: AuthErrorCode;
  /** Turkish, user-facing — built once on the server, never re-derived from
   *  `error` in a component. */
  errorMessage?: string;
  /** Set with error "account_locked" so the login form can count down. */
  lockedUntil?: string;
}
