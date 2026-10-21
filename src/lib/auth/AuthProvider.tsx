"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useStore } from "@/lib/data/store";
import { httpAuthService } from "@/lib/auth/http-auth-service";
import type { AuthResult, AuthUser } from "@/types/auth";
import type { AuthService } from "@/lib/auth/auth-service";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the server has answered whether this device is signed in. */
  isLoading: boolean;
  /** No account exists yet — every page sends the visitor to /setup. */
  needsSetup: boolean;
  setup: AuthService["setup"];
  signIn: AuthService["signIn"];
  signOut: () => Promise<void>;
  changePassword: AuthService["changePassword"];
  updateProfile: AuthService["updateProfile"];
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Mounted inside DataProvider and above both (app)/layout.tsx's RouteGuard
 * and /login — see src/app/providers.tsx.
 *
 * The session is an httpOnly cookie the page can't read, so the signed-in
 * user is asked from the server once on load and again whenever the tab
 * comes back into view — that is how a device notices the password was
 * changed elsewhere (its session then no longer counts).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { setActorName } = useStore();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  const refresh = useCallback(async () => {
    const status = await httpAuthService.getStatus();
    // `undefined` = server unreachable: keep whatever we had.
    if (status !== undefined) {
      setUser(status.user);
      setNeedsSetup(status.needsSetup);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load from the server
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

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
    needsSetup,
    setup: async (input) => {
      const result = await httpAuthService.setup(input);
      if (result.success && result.data) {
        setUser(result.data.user);
        setNeedsSetup(false);
      }
      return result;
    },
    signIn: async (input) => {
      const result = await httpAuthService.signIn(input);
      if (result.success && result.data) setUser(result.data.user);
      return result;
    },
    signOut: async () => {
      await httpAuthService.signOut();
      setUser(null);
    },
    changePassword: async (input) => {
      const result = await httpAuthService.changePassword(input);
      // Too many wrong current passwords end this session on the server.
      if (result.error === "account_locked") setUser(null);
      return result;
    },
    updateProfile: async (input) => {
      const result = await httpAuthService.updateProfile(input);
      if (result.success && result.data) setUser(result.data.user);
      return result;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export type { AuthResult };
