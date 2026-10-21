// ─── Auth — single shared institution account ───────────────────────────────
//
// The app has exactly ONE login account with full access. Several people may
// sign in with it at the same time, on different devices — there are no
// roles, permissions, invitations or per-person accounts. Teacher and
// guardian records are institution data (Öğretmenler / Veliler), never logins.
//
// The account, its password and the sessions live on the server — see
// src/lib/server/auth-core.ts (rules) and src/lib/auth/AuthProvider.tsx
// (useAuth()). The browser only holds an httpOnly session cookie.

/** The UI-facing identity useAuth() exposes — never the lockout bookkeeping
 *  or the password hash. */
export interface AuthUser {
  username: string;
  name: string;
  /** When this device signed in. */
  loginAt: string;
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
