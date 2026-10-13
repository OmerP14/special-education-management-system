import { useSyncExternalStore } from "react";
import { buildBackupFile } from "@/lib/mock/persistence";

// ─── Backups written to a folder on this computer ───────────────────────────
//
// Uses the browser's File System Access API (Chrome / Edge). A web page can't
// pick a disk location on its own: the user chooses a folder once (the
// picker opens on the Desktop) and BACKUP_FOLDER_NAME is created inside it
// unless they picked that folder itself. The folder handle is kept in this
// browser's IndexedDB — like the session, it belongs to this device and is
// not part of backups. After a browser restart writing may need the user's
// permission again; that needs a click (grantBackupFolderPermission).

export const BACKUP_FOLDER_NAME = "ÖzelEğitim Yedekleri";
/** Daily files older than this many days are removed from the folder. */
export const KEEP_DAILY_BACKUP_FILES = 30;
const DAILY_FILE = /^yedek-\d{4}-\d{2}-\d{2}\.json$/;

export function dailyBackupFileName(dateKey: string): string {
  return `yedek-${dateKey}.json`;
}

type PermissionResult = "granted" | "denied" | "prompt";
interface BackupDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(descriptor: { mode: "readwrite" }): Promise<PermissionResult>;
  requestPermission(descriptor: { mode: "readwrite" }): Promise<PermissionResult>;
  keys(): AsyncIterable<string>;
}
interface StoredFolder {
  folder: BackupDirectoryHandle;
  /** Name of the folder the user picked (e.g. "Desktop") — for display. */
  parentName: string | null;
}
type DirectoryPicker = (options: {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: "desktop" | "documents" | "downloads";
}) => Promise<FileSystemDirectoryHandle>;

// ─── IndexedDB (one record: the chosen folder) ──────────────────────────────

const DB_NAME = "ozel-egitim-yedek-klasoru";
const DB_STORE = "folder";
const DB_KEY = "backup-folder";

function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(DB_STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const request = run(db.transaction(DB_STORE, mode).objectStore(DB_STORE));
      request.onsuccess = () => {
        resolve(request.result);
        db.close();
      };
      request.onerror = () => {
        reject(request.error);
        db.close();
      };
    };
  });
}

// ─── State shared with the UI ───────────────────────────────────────────────

export type BackupFolderStatus = "loading" | "unsupported" | "none" | "granted" | "needs-permission";

export interface BackupFolderState {
  status: BackupFolderStatus;
  /** "Desktop / ÖzelEğitim Yedekleri" */
  location: string | null;
  lastWrite: { fileName: string; at: string } | null;
  error: string | null;
}

let state: BackupFolderState = { status: "loading", location: null, lastWrite: null, error: null };
let stored: StoredFolder | null = null;
let initStarted = false;
const listeners = new Set<() => void>();

function setState(patch: Partial<BackupFolderState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const SERVER_STATE: BackupFolderState = state;

export function useBackupFolder(): BackupFolderState {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

function picker(): DirectoryPicker | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
  return typeof fn === "function" ? fn.bind(window) : null;
}

function locationOf(s: StoredFolder): string {
  return s.parentName && s.parentName !== s.folder.name ? `${s.parentName} / ${s.folder.name}` : s.folder.name;
}

/** Loads the remembered folder once per page and checks its permission
 *  without prompting (prompting needs a click). */
export async function initBackupFolder(): Promise<void> {
  if (initStarted) return;
  initStarted = true;
  if (!picker()) return setState({ status: "unsupported" });
  try {
    stored = (await withStore<StoredFolder | undefined>("readonly", (s) => s.get(DB_KEY))) ?? null;
  } catch {
    stored = null;
  }
  if (!stored) return setState({ status: "none" });
  const permission = await stored.folder.queryPermission({ mode: "readwrite" }).catch(() => "prompt" as const);
  setState({
    status: permission === "granted" ? "granted" : "needs-permission",
    location: locationOf(stored),
    error: null,
  });
}

/** Opens the folder picker (on the Desktop). Returns false when cancelled. */
export async function chooseBackupFolder(): Promise<boolean> {
  const pick = picker();
  if (!pick) return false;
  let picked: FileSystemDirectoryHandle;
  try {
    picked = await pick({ id: "ozel-egitim-yedek", mode: "readwrite", startIn: "desktop" });
  } catch {
    return false; // cancelled
  }
  try {
    const folder = (
      picked.name === BACKUP_FOLDER_NAME ? picked : await picked.getDirectoryHandle(BACKUP_FOLDER_NAME, { create: true })
    ) as BackupDirectoryHandle;
    const next: StoredFolder = { folder, parentName: picked.name === BACKUP_FOLDER_NAME ? null : picked.name };
    await withStore("readwrite", (s) => s.put(next, DB_KEY));
    stored = next;
    setState({ status: "granted", location: locationOf(next), lastWrite: null, error: null });
    return true;
  } catch {
    setState({ error: "Bu klasöre yazılamadı. Başka bir konum seçin." });
    return false;
  }
}

/** Asks again for write access to the remembered folder (needs a click). */
export async function grantBackupFolderPermission(): Promise<boolean> {
  if (!stored) return false;
  const permission = await stored.folder.requestPermission({ mode: "readwrite" }).catch(() => "denied" as const);
  setState({ status: permission === "granted" ? "granted" : "needs-permission" });
  return permission === "granted";
}

export async function forgetBackupFolder(): Promise<void> {
  await withStore("readwrite", (s) => s.delete(DB_KEY)).catch(() => undefined);
  stored = null;
  setState({ status: "none", location: null, lastWrite: null, error: null });
}

/**
 * Writes today's backup as `yedek-<YYYY-MM-DD>.json`, replacing the file
 * written earlier the same day, so each day's file holds that day's latest
 * data. Then removes daily files beyond KEEP_DAILY_BACKUP_FILES (only files
 * named like ours). Returns whether today's file was newly created.
 */
export async function writeBackupToFolder<T>(data: T, dateKey: string): Promise<"created" | "updated" | "unavailable"> {
  if (!stored || state.status !== "granted") return "unavailable";
  const { folder } = stored;
  const fileName = dailyBackupFileName(dateKey);
  try {
    const existed = await folder.getFileHandle(fileName).then(
      () => true,
      () => false
    );
    const writable = await (await folder.getFileHandle(fileName, { create: true })).createWritable();
    await writable.write(JSON.stringify(buildBackupFile(data)));
    await writable.close();

    const daily: string[] = [];
    for await (const name of folder.keys()) if (DAILY_FILE.test(name)) daily.push(name);
    daily.sort().reverse();
    for (const old of daily.slice(KEEP_DAILY_BACKUP_FILES)) await folder.removeEntry(old).catch(() => undefined);

    setState({ lastWrite: { fileName, at: new Date().toISOString() }, error: null });
    return existed ? "updated" : "created";
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      setState({ status: "needs-permission" });
    } else if (name === "NotFoundError") {
      // The folder was moved or deleted outside the app.
      await forgetBackupFolder();
      setState({ error: "Yedek klasörü bulunamadı (taşınmış ya da silinmiş olabilir). Klasörü yeniden seçin." });
    } else {
      setState({ error: "Yedek klasöre yazılamadı." });
    }
    return "unavailable";
  }
}
