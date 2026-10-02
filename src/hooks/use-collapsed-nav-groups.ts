"use client";

import { useCallback, useMemo } from "react";
import { readLocalStorageValue, useHydrated, useLocalStorageValue } from "@/hooks/use-local-storage-value";

const STORAGE_KEY = "nav-collapsed-groups";

function parse(raw: string | null): Record<string, boolean> {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    // Malformed value — fall back to everything expanded.
    return {};
  }
}

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
  const [raw, write] = useLocalStorageValue(STORAGE_KEY);
  const collapsed = useMemo(() => parse(raw), [raw]);
  const hydrated = useHydrated();

  // Both read the latest stored value at call time (not the render-time
  // `collapsed`) so their identities stay stable for memoized consumers.
  const toggle = useCallback(
    (groupId: string) => {
      const prev = parse(readLocalStorageValue(STORAGE_KEY));
      write(JSON.stringify({ ...prev, [groupId]: !prev[groupId] }));
    },
    [write]
  );

  /** Forces a single group open — used to auto-open whichever group contains
   *  the active route. No-ops (no persist write) if the group is already
   *  open, so it never fights a manual re-collapse of the SAME group later in
   *  the same visit — see AppSidebar's effect. */
  const ensureOpen = useCallback(
    (groupId: string) => {
      const prev = parse(readLocalStorageValue(STORAGE_KEY));
      if (!prev[groupId]) return;
      write(JSON.stringify({ ...prev, [groupId]: false }));
    },
    [write]
  );

  const isCollapsed = useCallback((groupId: string) => !!collapsed[groupId], [collapsed]);

  return { isCollapsed, toggle, ensureOpen, hydrated };
}
