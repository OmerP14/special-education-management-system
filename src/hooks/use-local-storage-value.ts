"use client";

import { useCallback, useSyncExternalStore } from "react";

// Same-tab writes don't fire the native "storage" event, so writers notify
// subscribers through this set as well.
const listeners = new Set<() => void>();
// Fallback when storage is unavailable, so preferences still work for the
// rest of this visit.
const memory = new Map<string, string>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Current stored value, read at call time (e.g. inside event handlers). */
export function readLocalStorageValue(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage unavailable (private browsing, etc.).
    return memory.get(key) ?? null;
  }
}

/**
 * Raw localStorage string for `key`, kept in sync across components and tabs.
 * Renders `null` on the server and during hydration, then switches to the
 * stored value right after — React handles that hand-off itself, so callers
 * never cause a hydration mismatch.
 */
export function useLocalStorageValue(key: string) {
  const value = useSyncExternalStore(
    subscribe,
    () => readLocalStorageValue(key),
    () => null
  );

  const write = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        memory.set(key, next);
      }
      listeners.forEach((l) => l());
    },
    [key]
  );

  return [value, write] as const;
}

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true once running on the client. */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
