"use client";

import { useCallback } from "react";
import { readLocalStorageValue, useLocalStorageValue } from "@/hooks/use-local-storage-value";

/**
 * Desktop sidebar has exactly two states — visible or hidden. Nothing else is
 * persisted here; per-GROUP open/closed state is a separate concern (see
 * use-collapsed-nav-groups.ts) and only matters while the sidebar is visible.
 */
const STORAGE_KEY = "sidebar-visible";
const DEFAULT_VISIBLE = true;

/** @param institutionDefaultVisible Ayarlar → Belge ve Görünüm's configured
 *  `sidebarDefaultState` — only used the very first time (no explicit
 *  per-browser preference saved yet); once a user has toggled the sidebar
 *  even once, their own preference always wins over the institution default. */
export function useSidebarVisibility(institutionDefaultVisible: boolean = DEFAULT_VISIBLE) {
  // The persisted preference is deliberately NOT read during the server
  // render or hydration (useLocalStorageValue yields null there). This state
  // drives a structural DOM attribute (data-state/data-collapsible on the
  // Sidebar root), and a hydration-time mismatch on that kind of attribute is
  // one React does not patch up — it left the sidebar stuck on the server's
  // default. useSyncExternalStore switches to the stored value as a normal
  // post-hydration update instead, which always repaints correctly.
  const [stored, write] = useLocalStorageValue(STORAGE_KEY);
  // No explicit preference saved yet — use institutionDefaultVisible.
  const visible = stored === "false" ? false : stored === "true" ? true : institutionDefaultVisible;

  const setVisible = useCallback((next: boolean) => write(String(next)), [write]);

  const toggle = useCallback(() => {
    const current = readLocalStorageValue(STORAGE_KEY);
    const prev = current === "false" ? false : current === "true" ? true : institutionDefaultVisible;
    write(String(!prev));
  }, [write, institutionDefaultVisible]);

  return { visible, setVisible, toggle };
}
