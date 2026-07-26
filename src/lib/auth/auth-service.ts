import type { AuthResult, AuthSession, AuthUser, Invitation } from "@/types/auth";

// ─── AuthService — the replaceable auth boundary ────────────────────────────
//
// Every component consumes this interface (via useAuth(), never a concrete
// implementation import) so LocalAuthService can later be swapped for a
// SupabaseAuthService without touching a single page — see local-auth-service.ts
// for today's implementation and its file-level notes on what a real backend
// swap would need to change.

export interface AuthService {
  signIn(input: {
    email: string;
    password: string;
    remember?: boolean;
  }): Promise<AuthResult<{ user: AuthUser; session: AuthSession }>>;

  signOut(): Promise<void>;

  getSession(): AuthSession | null;

  getCurrentUser(): AuthUser | null;

  refreshSession(): Promise<AuthSession | null>;

  changePassword(input: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }): Promise<AuthResult>;

  /** Generates a single-use, expiring reset token (see PasswordResetToken)
   *  and "sends" it — mock delivery, the /forgot-password page surfaces the
   *  link directly instead of emailing it. Always returns success (never
   *  reveals whether the email exists) unless the input itself is invalid. */
  requestPasswordReset(email: string): Promise<AuthResult<{ token: string } | void>>;

  /** Validates the token (unexpired, unused), writes a new password hash,
   *  marks the token used. See /reset-password?token=. */
  resetPassword(input: { token: string; newPassword: string }): Promise<AuthResult>;

  /** Validates an invitation token (unexpired, still "pending"), sets the
   *  account's password, activates the AppUser, marks the invitation
   *  "accepted", and signs the user in — one flow, matching
   *  /accept-invite?token=. */
  acceptInvitation(input: {
    token: string;
    password: string;
  }): Promise<AuthResult<{ user: AuthUser; session: AuthSession }>>;

  /** Pure lookup — used by the accept-invite page to show the invited
   *  email/role before the user sets a password. Not a mutation. */
  getInvitationByToken(token: string): Invitation | null;
}
