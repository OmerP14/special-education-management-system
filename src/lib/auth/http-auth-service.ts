import type { AuthResult, AuthUser } from "@/types/auth";
import type { AuthService } from "@/lib/auth/auth-service";

// ─── AuthService over the app's API routes ──────────────────────────────────
//
// The session itself is an httpOnly cookie the server sets and clears; this
// file only sends the forms and reads the answers.

const OFFLINE: AuthResult<never> = {
  success: false,
  error: "unknown",
  errorMessage: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.",
};

async function post<T>(path: string, body?: unknown): Promise<AuthResult<T>> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await res.json()) as AuthResult<T>;
  } catch {
    return OFFLINE;
  }
}

export const httpAuthService: AuthService = {
  signIn: (input) => post("/api/auth/login", { ...input, remember: input.remember ?? false }),

  async signOut() {
    await post("/api/auth/logout");
  },

  async getStatus() {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return undefined;
      return (await res.json()) as { user: AuthUser | null; needsSetup: boolean };
    } catch {
      return undefined;
    }
  },

  setup: (input) => post("/api/setup", input),

  changePassword: (input) => post("/api/auth/password", input),

  updateProfile: (input) => post("/api/auth/profile", input),
};
