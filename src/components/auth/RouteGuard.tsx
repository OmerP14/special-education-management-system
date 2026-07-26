"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { canAccessRoute } from "@/lib/auth/route-permissions";

/**
 * Mounted once in (app)/layout.tsx, wrapping every /app/* route. Owns
 * *redirect* behavior — unauthenticated -> /login?next=<path>, authenticated
 * but unauthorized -> /app/403 — unlike PermissionGuard/SettingsAccessGuard,
 * which render an inline UnauthorizedState without navigating away. Both
 * read the same canAccessRoute/hasPermission helpers so "who can see what"
 * is defined once regardless of which guard is asking.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, permissions } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const allowed = isAuthenticated && canAccessRoute(pathname, permissions);

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!canAccessRoute(pathname, permissions)) {
      router.replace("/app/403");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, pathname, permissions]);

  // Render nothing while loading or before the redirect above commits —
  // avoids a flash of protected content for an unauthenticated/unauthorized
  // visitor between mount and the effect above running.
  if (isLoading || !allowed) return null;

  return <>{children}</>;
}
