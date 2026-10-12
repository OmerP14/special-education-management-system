import type { LandingPage } from "@/types/settings";

/** Ayarlar → Belge ve Görünüm's `defaultLandingPage` → the actual route it
 *  sends a visitor to. Shared by the root page (src/app/page.tsx) and the
 *  login page's post-login redirect so the two never drift. */
export const LANDING_PAGE_ROUTES: Record<LandingPage, string> = {
  dashboard: "/app/dashboard",
  calendar: "/app/calendar",
  sessions: "/app/sessions",
};

/** Where to go after signing in: the `?next=` page when it is an in-app
 *  path, otherwise the institution's landing page. Never an external URL —
 *  `?next=` comes straight from the address bar. */
export function resolvePostLoginPath(next: string | null, landingPage: LandingPage): string {
  if (next && /^\/app(\/|$)/.test(next)) return next;
  return LANDING_PAGE_ROUTES[landingPage];
}
