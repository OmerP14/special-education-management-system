// ─── Auth — single shared institution account ───────────────────────────────
//
// The app has exactly ONE login account with full access. Several people may
// sign in with it at the same time, on different devices — there are no
// roles, permissions, invitations or per-person accounts. Teacher and
// guardian records are institution data (Öğretmenler / Veliler), never logins.
//
// See src/lib/auth/local-auth-service.ts (sign-in, lockout, password change)
// and AuthProvider.tsx (useAuth()).

/** The one account record. The password lives separately in `Credential`
 *  so nothing that renders the account ever carries a hash. */
export interface Account {
  /** Typed on the login screen. Compared case-insensitively. */
  username: string;
  /** Shown in the topbar. */
  name: string;
  lastLoginAt?: string;
  /** Reset to 0 on a successful sign-in; LocalAuthService locks sign-in once
   *  this reaches MAX_FAILED_LOGIN_ATTEMPTS (lib/auth/security-policy.ts). */
  failedLoginAttempts?: number;
  /** Sign-in is refused until this passes; no separate unlock step. */
  lockedUntil?: string;
  updatedAt?: string;
}

/** Lives ONLY in the store's `credential` slice — read/written exclusively by
 *  src/lib/auth/local-auth-service.ts. */
export interface Credential {
  salt: string;
  hash: string;
  updatedAt: string;
}

/** The UI-facing identity useAuth() exposes — never the lockout bookkeeping
 *  or the credential. */
export interface AuthUser {
  username: string;
  name: string;
}

/** One per browser/device. Every device holding a session acts as the same
 *  account. */
export interface AuthSession {
  loginAt: string;
  remember: boolean;
  /** The credential's `updatedAt` when this session was opened — a session
   *  whose version no longer matches (the password was changed on another
   *  device) is treated as signed out. */
  credentialVersion: string;
}

export type AuthErrorCode = "invalid_credentials" | "account_locked" | "unknown";

export interface AuthResult<T = void> {
  success: boolean;
  data?: T;
  error?: AuthErrorCode;
  /** Turkish, user-facing — built once by LocalAuthService, never re-derived
   *  from `error` in a component. */
  errorMessage?: string;
  /** Set with error "account_locked" so the login form can count down. */
  lockedUntil?: string;
}
