"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMockStore } from "@/lib/mock/store";
import { LANDING_PAGE_ROUTES } from "@/lib/settings/landing-page";

// Client component (not a server redirect) because the configured landing
// page — Ayarlar → Belge ve Görünüm's defaultLandingPage — lives in
// localStorage-backed institutionSettings, which only exists client-side in
// this mock-store architecture. RouteGuard (mounted inside (app)/layout.tsx)
// still handles the actual auth check once we get there.
export default function RootPage() {
  const router = useRouter();
  const { institutionSettings } = useMockStore();

  useEffect(() => {
    router.replace(LANDING_PAGE_ROUTES[institutionSettings.appearance.defaultLandingPage]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
