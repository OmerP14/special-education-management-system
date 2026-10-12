"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * Mounted once in (app)/layout.tsx, wrapping every /app/* route: a visitor
 * without a session is sent to /login?next=<path>. There is one account with
 * full access, so a signed-in visitor may open every page.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isAuthenticated, pathname]);

  // Render nothing while loading or before the redirect above commits —
  // avoids a flash of protected content for a signed-out visitor.
  if (isLoading || !isAuthenticated) return null;

  return <>{children}</>;
}
