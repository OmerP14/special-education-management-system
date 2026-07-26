"use client";

import { TimerReset } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Button } from "@/components/ui/button";

/** Mounted once in (app)/layout.tsx. Shown only in the last 60s before an
 *  inactivity-triggered logout (see AuthProvider's isInactivityWarning) —
 *  the absolute session timeout has no warning, only inactivity does, since
 *  activity is exactly what "Oturumu Uzat" (extendSession) resets. */
export function InactivityWarningBanner() {
  const { isInactivityWarning, extendSession } = useAuth();

  if (!isInactivityWarning) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm dark:bg-amber-950/30">
      <span className="flex items-center gap-2 text-amber-800 dark:text-amber-400">
        <TimerReset className="h-4 w-4 shrink-0" />
        Hareketsizlik nedeniyle oturumunuz yakında kapatılacak.
      </span>
      <Button size="sm" variant="outline" onClick={extendSession} className="shrink-0">
        Oturumu Uzat
      </Button>
    </div>
  );
}
