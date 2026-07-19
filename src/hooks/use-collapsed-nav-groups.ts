"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "nav-collapsed-groups";

/**
 * Persists which sidebar nav groups the user has collapsed, keyed by group id.
 * Starts "all expanded" on both server and first client render (avoids a
 * hydration mismatch) and corrects itself from localStorage right after mount —
 * same trade-off the sidebar-width cookie/useIsMobile hooks already make
 * elsewhere in this app.
 *
 * This is deliberately a SEPARATE concern from the sidebar's own expanded/
 * collapsed/hidden mode (see use-sidebar-mode.ts) — a group's open/closed
 * preference persists independently of whether the sidebar itself is
 * currently showing labels at all.
 */
export function useCollapsedNavGroups() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {
      // Malformed value or storage unavailable (private browsing, etc.) —
      // fall back to everything expanded.
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Record<string, boolean>) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable — state still updates for this session.
    }
  }, []);

  const toggle = useCallback(
    (groupId: string) => {
      setCollapsed((prev) => {
        const next = { ...prev, [groupId]: !prev[groupId] };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  /** Forces a single group open — used to auto-open whichever group contains
   *  the active route. No-ops (no state update, no persist write) if the
   *  group is already open, so it never fights a manual re-collapse of the
   *  SAME group later in the same visit — see AppSidebar's effect. */
  const ensureOpen = useCallback(
    (groupId: string) => {
      setCollapsed((prev) => {
        if (!prev[groupId]) return prev;
        const next = { ...prev, [groupId]: false };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const isCollapsed = useCallback((groupId: string) => !!collapsed[groupId], [collapsed]);

  return { isCollapsed, toggle, ensureOpen, hydrated };
}
