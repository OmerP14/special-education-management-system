import type { PersistedState } from "@/lib/data/store";
import { loadPersistedStore, savePersistedStore, watchOtherTabWrites } from "@/lib/data/persistence";

// ─── Where the data lives ───────────────────────────────────────────────────
//
// The whole app reaches its data through this one interface: DataProvider
// loads once at start-up, saves the full state after every change and listens
// for changes made elsewhere. Every business rule (billing, teacher earnings,
// devir, imports) runs in the app on top of it, so a backend only has to
// store and return what it is given. Today the data lives in this browser
// (localDataSource); a server implementation goes in `dataSource` below and
// nothing else changes. See docs/BACKEND.md.

export interface DataSource {
  /** Everything, once at start-up. Null when nothing is saved yet — the app
   *  then starts empty. */
  load(): Promise<PersistedState | null>;
  /** The full current state, after every change. False when it could not be
   *  saved — the app warns that changes may be lost. */
  save(state: PersistedState): Promise<boolean>;
  /** Starts listening for changes saved elsewhere (another tab or device);
   *  returns the cleanup. */
  watch(): () => void;
}

/** This browser's localStorage. Saves synchronously inside the call, so a
 *  reload right after a change (e.g. after signing in) never loses it. */
export const localDataSource: DataSource = {
  load: async () => loadPersistedStore<PersistedState>(),
  save: async (state) => savePersistedStore(state),
  watch: () => watchOtherTabWrites(),
};

export const dataSource: DataSource = localDataSource;
