import type { AuthResult, AuthUser } from "@/types/auth";

// ─── AuthService — the auth boundary ─────────────────────────────────────────
//
// Every component consumes this through useAuth(), never a concrete
// implementation. Today's implementation talks to the app's own API routes
// (http-auth-service.ts → src/app/api/auth/*).

export interface AuthService {
  signIn(input: { username: string; password: string; remember?: boolean }): Promise<AuthResult<{ user: AuthUser }>>;

  signOut(): Promise<void>;

  /** Who is signed in on this device (null = nobody) and whether the
   *  first-run setup is still pending; undefined when the server could not
   *  be reached (the caller keeps its current state). */
  getStatus(): Promise<{ user: AuthUser | null; needsSetup: boolean } | undefined>;

  /** First run only: creates the institution's account and signs in. */
  setup(input: {
    name: string;
    username: string;
    password: string;
    institutionName: string;
    institutionPhone: string;
  }): Promise<AuthResult<{ user: AuthUser }>>;

  changePassword(input: { currentPassword: string; newPassword: string }): Promise<AuthResult>;

  /** Profil page: display name and username. */
  updateProfile(input: { name: string; username: string }): Promise<AuthResult<{ user: AuthUser }>>;
}
