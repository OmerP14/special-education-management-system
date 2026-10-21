// ─── Backup files ────────────────────────────────────────────────────────────
//
// The live data lives on the server (lib/data/server-source.ts). What stays
// in the browser is the backup side: backup files the user downloads or
// restores, and a few daily automatic backups kept in this browser as an
// extra safety net.

// Key name predates the lib/mock → lib/data rename; kept so backups already
// saved in a browser are still found.
const AUTO_BACKUP_KEY = "mock-store-auto-backups-v1";
const SCHEMA_VERSION = 1;

// ─── Backups (Ayarlar → Yedekleme ve Excel) ─────────────────────────────

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
