"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Desktop sidebar has exactly two states — visible or hidden. Nothing else is
 * persisted here; per-GROUP open/closed state is a separate concern (see
 * use-collapsed-nav-groups.ts) and only matters while the sidebar is visible.
 */
const STORAGE_KEY = "sidebar-visible";
const DEFAULT_VISIBLE = true;

export function useSidebarVisibility() {
  const [visible, setVisibleState] = useState<boolean>(DEFAULT_VISIBLE);

  // Correct from the persisted preference right after mount — deliberately
  // NOT read in the initial useState value. This state drives a structural
  // DOM attribute (data-state/data-collapsible on the Sidebar root), and a
  // hydration-time mismatch on that kind of attribute is one React explicitly
  // does not patch up (confirmed via testing: the console says as much) — it
  // left the sidebar visibly stuck on the server's default until some
  // unrelated click forced an ordinary re-render. Setting it here instead
  // runs as a normal post-mount state update, which always repaints
  // correctly, at the cost of a brief correction for returning users whose
  // preference isn't the default — the standard, safe trade-off for any
  // localStorage-backed (as opposed to cookie-backed) preference.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "false") {
        setVisibleState(false);
      }
    } catch {
      // Storage unavailable (private browsing, etc.) — stay at the default.
    }
  }, []);

  const persist = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Storage unavailable — state still updates for this session.
    }
  }, []);

  const setVisible = useCallback(
    (next: boolean) => {
      setVisibleState(next);
      persist(next);
    },
    [persist]
  );

  const toggle = useCallback(() => {
    setVisibleState((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, [persist]);

  return { visible, setVisible, toggle };
}
