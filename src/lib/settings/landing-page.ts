import type { LandingPage } from "@/types/settings";

/** Ayarlar → Belge ve Görünüm's `defaultLandingPage` → the actual route it
 *  sends a visitor to. Shared by the root page (src/app/page.tsx) and the
 *  login page's post-login redirect so the two never drift. */
export const LANDING_PAGE_ROUTES: Record<LandingPage, string> = {
  dashboard: "/app/dashboard",
  calendar: "/app/calendar",
  sessions: "/app/sessions",
};
