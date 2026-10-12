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
const AUTO_BACKUP_KEY = "mock-store-auto-backups-v1";

interface PersistedEnvelope<T> {
  version: number;
  savedAt: string;
  data: T;
}

// ─── Cross-tab safety ───────────────────────────────────────────────────────
//
// Every open tab holds the whole store in memory and writes it back on each
// change. Without coordination a tab left open on an old snapshot silently
// overwrites what another tab just saved. So: once another tab writes, this tab stops
// writing and reloads to pick the new snapshot up. Writes whose data didn't
// actually change are skipped, so a reload's first save never bounces back
// and reloads the other tab in turn.
let lastSavedData: string | null = null;
let staleFromOtherTab = false;

export function loadPersistedStore<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    let parsed: PersistedEnvelope<T> | null = null;
    try {
      parsed = JSON.parse(raw) as PersistedEnvelope<T>;
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.version !== SCHEMA_VERSION || !parsed.data) {
      // The app falls back to demo data and its first save overwrites this
      // key — keep the unreadable snapshot aside instead of losing it.
      preserveUnreadable(raw);
      return null;
    }
    lastSavedData = JSON.stringify(parsed.data);
    return parsed.data;
  } catch {
    return null;
  }
}

const UNREADABLE_KEY = `${STORAGE_KEY}-unreadable`;

function preserveUnreadable(raw: string) {
  try {
    if (!window.localStorage.getItem(UNREADABLE_KEY)) window.localStorage.setItem(UNREADABLE_KEY, raw);
  } catch {
    // Nothing more we can do without storage space.
  }
}

/** Returns false when the data could not be written (storage full or
 *  unavailable) — the caller must tell the user, since everything changed
 *  from then on is lost on reload. */
export function savePersistedStore<T>(data: T): boolean {
  if (typeof window === "undefined" || staleFromOtherTab) return true;
  const serialized = JSON.stringify(data);
  if (serialized === lastSavedData) return true;
  const write = () => {
    const envelope: PersistedEnvelope<T> = { version: SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    lastSavedData = serialized;
  };
  try {
    write();
    return true;
  } catch {
    // The live data matters more than the in-browser automatic backups that
    // share the same quota: drop those and try once more.
    try {
      window.localStorage.removeItem(AUTO_BACKUP_KEY);
      write();
      return true;
    } catch {
      return false;
    }
  }
}

export function clearPersistedStore(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    lastSavedData = null;
  } catch {
    // Nothing to do if storage itself is unavailable.
  }
}

/** Starts the cross-tab guard described above; returns its cleanup. A tab
 *  in the background reloads when it is next shown, a visible one at once. */
export function watchOtherTabWrites(): () => void {
  if (typeof window === "undefined") return () => {};
  const reloadWhenVisible = () => {
    if (document.visibilityState === "visible") window.location.reload();
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY && e.key !== null) return;
    staleFromOtherTab = true;
    reloadWhenVisible();
    document.addEventListener("visibilitychange", reloadWhenVisible);
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    document.removeEventListener("visibilitychange", reloadWhenVisible);
  };
}

// ─── Backups (Ayarlar → Excel ve Veri Yönetimi) ─────────────────────────────

export const BACKUP_APP_ID = "ozel-egitim-yonetim";

export interface BackupFile<T> {
  app: typeof BACKUP_APP_ID;
  schemaVersion: number;
  createdAt: string;
  data: T;
}

export function buildBackupFile<T>(data: T): BackupFile<T> {
  return { app: BACKUP_APP_ID, schemaVersion: SCHEMA_VERSION, createdAt: new Date().toISOString(), data };
}

/** Parses a backup file's text; returns the data or a Turkish error. */
export function parseBackupFile<T>(text: string): { data: T; createdAt: string } | { error: string } {
  try {
    const parsed = JSON.parse(text) as Partial<BackupFile<T>>;
    if (parsed.app !== BACKUP_APP_ID || !parsed.data || typeof parsed.data !== "object") {
      return { error: "Bu dosya bu uygulamaya ait bir yedek değil." };
    }
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return { error: "Yedek, uygulamanın farklı bir sürümüne ait ve geri yüklenemiyor." };
    }
    return { data: parsed.data, createdAt: parsed.createdAt ?? "" };
  } catch {
    return { error: "Dosya okunamadı — geçerli bir JSON yedek dosyası seçin." };
  }
}

/** Daily automatic backups kept in this browser (newest first). */
export const MAX_AUTO_BACKUPS = 3;

export function loadAutoBackups<T>(): BackupFile<T>[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AUTO_BACKUP_KEY);
    const list = raw ? (JSON.parse(raw) as BackupFile<T>[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Saves an automatic backup unless one already exists for today. Returns
 *  true when a new backup was written. */
export function saveDailyAutoBackup<T>(data: T, todayKey: string): boolean {
  if (typeof window === "undefined") return false;
  const existing = loadAutoBackups<T>();
  const localDay = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  if (existing.some((b) => localDay(b.createdAt) === todayKey)) return false;
  const next = [buildBackupFile(data), ...existing].slice(0, MAX_AUTO_BACKUPS);
  try {
    window.localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(next));
    return true;
  } catch {
    // Storage full — keep only the newest one and try once more.
    try {
      window.localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(next.slice(0, 1)));
      return true;
    } catch {
      return false;
    }
  }
}
