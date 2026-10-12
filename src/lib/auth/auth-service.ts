import type { AuthResult, AuthSession, AuthUser } from "@/types/auth";

// ─── AuthService — the replaceable auth boundary ────────────────────────────
//
// Every component consumes this interface (via useAuth(), never a concrete
// implementation import) so LocalAuthService can later be swapped for a
// backend-backed service without touching a single page — see
// local-auth-service.ts for today's implementation.

export interface AuthService {
  signIn(input: {
    username: string;
    password: string;
    remember?: boolean;
  }): Promise<AuthResult<{ user: AuthUser; session: AuthSession }>>;

  signOut(): Promise<void>;

  getSession(): AuthSession | null;

  /** Null when there is no session or it was opened with an old password. */
  getCurrentUser(): AuthUser | null;

  changePassword(input: { currentPassword: string; newPassword: string }): Promise<AuthResult>;
}
