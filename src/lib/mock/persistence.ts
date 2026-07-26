// ─── Versioned localStorage persistence for the mock store ──────────────────
//
// One generic load/save pair, not per-field bespoke code — MockDataProvider
// hydrates every domain's useState from loadPersistedStore() (via a lazy
// initializer, same pattern institutionSettings already used for its
// structuredClone default) and a single debounced effect writes the whole
// aggregate state back on change. See MockDataProvider in store.tsx.
//
// SCHEMA_VERSION exists so a future shape change can invalidate old snapshots
// outright (fall back to seed data) instead of crashing on a mismatched
// shape — bump it whenever a field is added/removed/renamed in a
// non-backward-compatible way.

const STORAGE_KEY = "mock-store-v1";
const SCHEMA_VERSION = 1;

interface PersistedEnvelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

export function loadPersistedStore<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedEnvelope<T>;
    if (parsed.version !== SCHEMA_VERSION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function savePersistedStore<T>(data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: PersistedEnvelope<T> = { version: SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // Storage unavailable/full — this visit just runs session-only, not fatal.
  }
}

export function clearPersistedStore(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do if storage itself is unavailable.
  }
}
