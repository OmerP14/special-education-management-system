import type { PersistedState } from "@/lib/data/store";
import { serverDataSource } from "@/lib/data/server-source";

// ─── Where the data lives ───────────────────────────────────────────────────
//
// The whole app reaches its data through this one interface: DataProvider
// loads once after sign-in, hands over the full state after every change and
// listens for changes made on other devices. Every business rule (billing,
// teacher earnings, devir, imports) runs in the app on top of it, so the
// server only stores and returns what it is given. See docs/BACKEND.md.

export type SyncStatus = "saving" | "saved" | "error" | "signed_out";

export interface SyncListener {
  onStatus(status: SyncStatus): void;
  /** Another device's changes (merged with this device's unsaved ones). The
   *  store replaces its data with this. */
  onRemoteChange(state: PersistedState): void;
}

export interface DataSource {
  /** Everything, once after sign-in. Null when nothing is saved yet — the app
   *  then starts empty. Throws when it can't be loaded: the app must never
   *  start empty over data it merely failed to read. */
  load(): Promise<PersistedState | null>;
  /** The full current state, after every change; saved shortly after. */
  save(state: PersistedState): void;
  /** Sends anything still waiting; true when all of it reached the server. */
  flush(): Promise<boolean>;
  /** Starts syncing; returns the cleanup. */
  watch(listener: SyncListener): () => void;
}

export const dataSource: DataSource = serverDataSource;
