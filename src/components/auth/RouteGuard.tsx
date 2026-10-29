"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { canAccessPath } from "@/lib/auth/access";

/**
 * Mounted once in (app)/layout.tsx, wrapping every /app/* route: before the
 * first-run setup every visitor is sent to /setup; afterwards a visitor
 * without a session is sent to /login?next=<path>. The admin may open every
 * page; a staff account opening an admin-only one (finance, reports,
 * settings…) is sent to the dashboard — see lib/auth/access.ts.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, needsSetup, user } = useAuth();
  const pathname = usePathname();
  const allowed = !user || canAccessPath(user.role, pathname);
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace(needsSetup ? "/setup" : `/login?next=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace("/app/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, needsSetup, pathname, allowed]);

  // Render nothing while loading or before the redirect above commits —
  // avoids a flash of protected content for a signed-out visitor.
  if (isLoading || !isAuthenticated || !allowed) return null;

  return <>{children}</>;
}
