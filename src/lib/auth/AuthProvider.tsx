"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "@/lib/data/store";
import { createLocalAuthService } from "@/lib/auth/local-auth-service";
import type { AuthResult, AuthUser } from "@/types/auth";
import type { AuthService } from "@/lib/auth/auth-service";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the one-time post-mount session-validity check has run — see
   *  the file-level comment below on why this is a single synchronous check,
   *  not a second async localStorage read. */
  isLoading: boolean;
  loginTime: string | null;
  signIn: AuthService["signIn"];
  signOut: () => Promise<void>;
  changePassword: AuthService["changePassword"];
}

const AuthContext = createContext<AuthContextValue | null>(null);

// "Beni hatırla" off → the session must not survive closing the browser.
// The whole store (session included) lives in localStorage, so a cookie with
// no expiry marks "this browser session" — browsers drop it on exit, and it is
// shared across tabs, unlike sessionStorage.
const BROWSER_SESSION_COOKIE = "oe_browser_session";

function markBrowserSession() {
  document.cookie = `${BROWSER_SESSION_COOKIE}=1; path=/; SameSite=Lax`;
}

function hasBrowserSessionMark(): boolean {
  return document.cookie.split("; ").some((c) => c === `${BROWSER_SESSION_COOKIE}=1`);
}

/**
 * Mounted inside DataProvider (needs useStore()) and above both
 * (app)/layout.tsx's RouteGuard and /login — see src/app/providers.tsx.
 *
 * Session validity: DataProvider already hydrates `authSession` from
 * localStorage synchronously (lazy useState initializers — see
 * lib/data/persistence.ts), so by the time this component's body runs there
 * is no "waiting for a second async read" the way a real cookie/token fetch
 * would need. `isLoading` here only covers the one expiry check that has to
 * happen after mount (never on the server, since Date.now() must be a client
 * clock), not a real hydration race.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    account,
    credential,
    authSession,
    saveAccountState,
    setCredential,
    setAuthSession,
    setActorName,
  } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  const authService = useMemo(
    () =>
      createLocalAuthService({
        account,
        credential,
        session: authSession,
        saveAccountState,
        setCredential,
        setAuthSession,
      }),
    [account, credential, authSession, saveAccountState, setCredential, setAuthSession]
  );

  // One-time post-mount check — there is no idle timeout (see
  // lib/auth/security-policy.ts); the only way a stored session ends on its
  // own is "Beni hatırla" off and the browser closed since.
  useEffect(() => {
    if (authSession && !authSession.remember && !hasBrowserSessionMark()) setAuthSession(null);
    // One-time flip after the mount-only expiry check above — deliberately
    // not a "sync external state" effect the lint rule expects to only ever
    // subscribe, so it's exempted rather than restructured.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(false);
    // Deliberately mount-only: this checks the session hydrated at load time,
    // not "whenever authSession changes" (that's the 30s-tick effect below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const user = authService.getCurrentUser();

  // Settings metadata records the signed-in account's name as "updatedBy" —
  // see actorNameRef/FALLBACK_ACTOR_NAME in store.tsx.
  useEffect(() => {
    setActorName(user?.name ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    loginTime: authSession?.loginAt ?? null,
    signIn: async (input) => {
      const result = await authService.signIn(input);
      if (result.success) markBrowserSession();
      return result;
    },
    signOut: () => authService.signOut(),
    changePassword: (input) => authService.changePassword(input),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export type { AuthResult };
