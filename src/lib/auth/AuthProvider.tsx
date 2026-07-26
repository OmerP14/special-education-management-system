"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMockStore } from "@/lib/mock/store";
import { createLocalAuthService } from "@/lib/auth/local-auth-service";
import { hasPermission as hasPermissionHelper } from "@/lib/auth/permissions";
import type { AuthResult, AuthUser, Invitation, PermissionKey, Role } from "@/types/auth";
import type { AuthService } from "@/lib/auth/auth-service";

interface AuthContextValue {
  user: AuthUser | null;
  role: Role | null;
  permissions: PermissionKey[];
  isAuthenticated: boolean;
  /** True until the one-time post-mount session-validity check has run — see
   *  the file-level comment below on why this is a single synchronous check,
   *  not a second async localStorage read. */
  isLoading: boolean;
  loginTime: string | null;
  lastActivityAt: string | null;
  sessionExpiresAt: string | null;
  /** True in the last 60s before an inactivity-triggered logout (only ever
   *  true when institutionSettings.security.inactivityLogoutEnabled is on). */
  isInactivityWarning: boolean;
  signIn: AuthService["signIn"];
  signOut: () => Promise<void>;
  changePassword: AuthService["changePassword"];
  requestPasswordReset: AuthService["requestPasswordReset"];
  resetPassword: AuthService["resetPassword"];
  acceptInvitation: AuthService["acceptInvitation"];
  getInvitationByToken: (token: string) => Invitation | null;
  hasPermission: (key: PermissionKey) => boolean;
  /** Resets the inactivity clock — called by the "Oturumu Uzat" banner button
   *  and, throttled, by the passive activity listeners below. */
  extendSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// How often the passive activity listeners are allowed to write a fresh
// lastActivityAt — real interaction happens far more often than this, but
// every write goes through the store's setAuthSession -> its debounced
// localStorage save, so this cap keeps that from firing on every mousemove.
const ACTIVITY_THROTTLE_MS = 30_000;
const TICK_MS = 30_000;
const WARNING_WINDOW_MS = 60_000;

/**
 * Mounted inside MockDataProvider (needs useMockStore()) and above both
 * (app)/layout.tsx's RouteGuard and /login — see src/app/providers.tsx.
 *
 * Session validity: MockDataProvider already hydrates `authSession` from
 * localStorage synchronously (lazy useState initializers — see
 * lib/mock/persistence.ts), so by the time this component's body runs there
 * is no "waiting for a second async read" the way a real cookie/token fetch
 * would need. `isLoading` here only covers the one expiry check that has to
 * happen after mount (never on the server, since Date.now() must be a client
 * clock), not a real hydration race.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useMockStore();
  const {
    appUsers,
    credentials,
    roles,
    institutionSettings,
    authSession,
    invitations,
    passwordResets,
    updateAppUser,
    setCredential,
    setAuthSession,
    setActorName,
    setInvitation,
    setPasswordReset,
    logAuditEvent,
  } = store;
  const security = institutionSettings.security;

  const [isLoading, setIsLoading] = useState(true);
  const [isInactivityWarning, setIsInactivityWarning] = useState(false);
  const lastActivityWriteRef = useRef(0);

  const authService = useMemo(
    () =>
      createLocalAuthService({
        appUsers,
        credentials,
        roles,
        invitations,
        passwordResets,
        security,
        session: authSession,
        updateAppUser,
        setCredential,
        setAuthSession,
        setInvitation,
        setPasswordReset,
        logAuditEvent,
      }),
    [
      appUsers,
      credentials,
      roles,
      invitations,
      passwordResets,
      security,
      authSession,
      updateAppUser,
      setCredential,
      setAuthSession,
      setInvitation,
      setPasswordReset,
      logAuditEvent,
    ]
  );

  // One-time post-mount validity check — an expired session from a previous
  // visit is cleared rather than silently treated as "still logged in."
  useEffect(() => {
    if (authSession && new Date(authSession.expiresAt).getTime() <= Date.now()) {
      setAuthSession(null);
    }
    // One-time flip after the mount-only expiry check above — deliberately
    // not a "sync external state" effect the lint rule expects to only ever
    // subscribe, so it's exempted rather than restructured.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(false);
    // Deliberately mount-only: this checks the session hydrated at load time,
    // not "whenever authSession changes" (that's the 30s-tick effect below).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const user = authSession ? authService.getCurrentUser() : null;
  const role = user ? roles.find((r) => r.id === user.roleId) ?? null : null;
  const permissions = role?.permissions ?? [];

  // Keeps store.tsx's pre-existing internal audit calls (addEducationType,
  // updateSession, addPayment, ...) attributed to the real signed-in user
  // instead of a hardcoded name — see actorNameRef/FALLBACK_ACTOR_NAME there.
  useEffect(() => {
    setActorName(user?.name ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name]);

  const extendSession = useCallback(() => {
    void authService.refreshSession();
    setIsInactivityWarning(false);
    lastActivityWriteRef.current = Date.now();
  }, [authService]);

  // Passive activity listeners — real interaction refreshes lastActivityAt
  // (throttled), which is what the inactivity deadline below is computed
  // from. No listener runs at all once signed out.
  useEffect(() => {
    if (!authSession) return;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastActivityWriteRef.current < ACTIVITY_THROTTLE_MS) return;
      lastActivityWriteRef.current = now;
      setAuthSession({ ...authSession, lastActivityAt: new Date(now).toISOString() });
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!authSession]);

  // The 30s-tick deadline check — mirrors store.tsx's existing
  // autoCompletePastPlanned timer's cadence/shape.
  useEffect(() => {
    if (!authSession) return;

    function check() {
      if (!authSession) return;
      const now = Date.now();
      const absoluteDeadline = new Date(authSession.expiresAt).getTime();

      // Reuses sessionTimeoutMinutes as the inactivity threshold too — the
      // security settings model has one duration field, not two; when
      // inactivity logout is on, "N minutes of inactivity" and "N minutes
      // since login" both apply and whichever comes first wins.
      const inactivityDeadline = security.inactivityLogoutEnabled
        ? new Date(authSession.lastActivityAt).getTime() + security.sessionTimeoutMinutes * 60_000
        : Infinity;
      const effectiveDeadline = Math.min(absoluteDeadline, inactivityDeadline);

      if (now >= effectiveDeadline) {
        setIsInactivityWarning(false);
        void authService.signOut();
        return;
      }
      setIsInactivityWarning(
        security.inactivityLogoutEnabled && effectiveDeadline - now <= WARNING_WINDOW_MS
      );
    }

    check();
    const timer = setInterval(check, TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSession?.expiresAt, authSession?.lastActivityAt, security.inactivityLogoutEnabled, security.sessionTimeoutMinutes]);

  const value: AuthContextValue = {
    user,
    role,
    permissions,
    isAuthenticated: !!user,
    isLoading,
    loginTime: authSession?.loginAt ?? null,
    lastActivityAt: authSession?.lastActivityAt ?? null,
    sessionExpiresAt: authSession?.expiresAt ?? null,
    isInactivityWarning,
    signIn: (input) => authService.signIn(input),
    signOut: () => authService.signOut(),
    changePassword: (input) => authService.changePassword(input),
    requestPasswordReset: (email) => authService.requestPasswordReset(email),
    resetPassword: (input) => authService.resetPassword(input),
    acceptInvitation: (input) => authService.acceptInvitation(input),
    getInvitationByToken: (token) => authService.getInvitationByToken(token),
    hasPermission: (key) => hasPermissionHelper(permissions, key),
    extendSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export type { AuthResult };
