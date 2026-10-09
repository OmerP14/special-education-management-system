import type { LandingPage } from "@/types/settings";
import type { PermissionKey } from "@/types/auth";
import { canAccessRoute } from "@/lib/auth/route-permissions";

/** Ayarlar → Belge ve Görünüm's `defaultLandingPage` → the actual route it
 *  sends a visitor to. Shared by the root page (src/app/page.tsx) and the
 *  login page's post-login redirect so the two never drift. */
export const LANDING_PAGE_ROUTES: Record<LandingPage, string> = {
  dashboard: "/app/dashboard",
  calendar: "/app/calendar",
  sessions: "/app/sessions",
};

const FALLBACK_ROUTE = "/app/dashboard";

/** Where to go after signing in: the `?next=` page when it is an in-app path
 *  this user may open, otherwise the institution's landing page if they may
 *  open that (a guardian has no calendar), otherwise the dashboard. Never an
 *  external URL — `?next=` comes straight from the address bar. */
export function resolvePostLoginPath(
  next: string | null,
  landingPage: LandingPage,
  permissions: PermissionKey[]
): string {
  if (next && /^\/app(\/|$)/.test(next) && canAccessRoute(next.split(/[?#]/)[0], permissions)) {
    return next;
  }
  const landing = LANDING_PAGE_ROUTES[landingPage];
  return canAccessRoute(landing, permissions) ? landing : FALLBACK_ROUTE;
}
