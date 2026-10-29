import type { PersistedState } from "@/lib/data/store";
import type { DataSource, SyncListener } from "@/lib/data/source";
import { mergeStates, stableStringify } from "@/lib/data/merge";

// ─── DataSource on the server (/api/state) ──────────────────────────────────
//
// The browser keeps the last state it knows is on the server (`base`, with
// its `version`). Changes are batched for a moment and then sent whole, with
// the version they were based on. If another device saved first the server
// answers 409 with its newer state; this device merges its own changes onto
// it (lib/data/merge.ts), shows the result and saves that instead. Every few
// seconds — and whenever the tab comes back into view — it asks the server
// for the version, so changes made elsewhere appear without a reload.
//
// Bodies are gzip-compressed both ways (see src/lib/server/gzip-json.ts).

const SAVE_DELAY_MS = 400;
const POLL_MS = 8_000;
const RETRY_MS = 5_000;

export class SignedOutError extends Error {}

let base: PersistedState | null = null;
let baseKey = "";
let version = 0;
let latest: PersistedState | null = null;
let latestKey = "";
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let running: Promise<void> | null = null;
let listener: SyncListener | null = null;

async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
}

async function readGzipJson<T>(res: Response): Promise<T> {
  const stream = res.body!.pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text()) as T;
}

interface StoredState {
  data: PersistedState | null;
  version: number;
}

function adopt(remote: StoredState) {
  base = remote.data;
  baseKey = base ? stableStringify(base) : "";
  version = remote.version;
}

const hasUnsaved = () => saveTimer !== null || running !== null || (latest !== null && latestKey !== baseKey);

async function push(): Promise<void> {
  while (latest && latestKey !== baseKey) {
    const sending = latest;
    const sendingKey = latestKey;
    listener?.onStatus("saving");
    let res: Response;
    try {
      res = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: await gzip(JSON.stringify({ data: sending, baseVersion: version })),
      });
    } catch {
      return failed();
    }
    if (res.ok) {
      version = ((await res.json()) as { version: number }).version;
      base = sending;
      baseKey = sendingKey;
      continue;
    }
    if (res.status === 409) {
      const remote = await readGzipJson<StoredState>(res);
      const merged = remote.data ? mergeStates(base ?? remote.data, latest, remote.data) : latest;
      adopt(remote);
      latest = merged;
      latestKey = stableStringify(merged);
      listener?.onRemoteChange(merged);
      continue;
    }
    if (res.status === 401) {
      listener?.onStatus("signed_out");
      return;
    }
    return failed();
  }
  listener?.onStatus("saved");
}

function failed() {
  listener?.onStatus("error");
  setTimeout(() => startPush(), RETRY_MS);
}

function startPush() {
  if (running) return;
  running = push().finally(() => {
    running = null;
  });
}

async function poll() {
  if (hasUnsaved() || document.visibilityState !== "visible") return;
  try {
    const res = await fetch("/api/state/version", { cache: "no-store" });
    if (res.status === 401) return listener?.onStatus("signed_out");
    if (!res.ok) return;
    const { version: remoteVersion } = (await res.json()) as { version: number };
    if (remoteVersion === version) return;
    const full = await fetch("/api/state", { cache: "no-store" });
    if (!full.ok) return;
    const remote = await readGzipJson<StoredState>(full);
    // A change made while we were fetching wins: its save will merge.
    if (hasUnsaved() || !remote.data) return;
    adopt(remote);
    latest = remote.data;
    latestKey = baseKey;
    listener?.onRemoteChange(remote.data);
  } catch {
    // Offline for a moment — the next poll tries again.
  }
}

export const serverDataSource: DataSource = {
  async load() {
    base = null;
    baseKey = "";
    version = 0;
    latest = null;
    latestKey = "";
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.status === 401) throw new SignedOutError();
    if (!res.ok) throw new Error(`load failed: ${res.status}`);
    const remote = await readGzipJson<StoredState>(res);
    adopt(remote);
    latest = base;
    latestKey = baseKey;
    return remote.data;
  },

  save(state) {
    latest = state;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      if (latest !== state) return;
      latestKey = stableStringify(state);
      if (latestKey !== baseKey) startPush();
    }, SAVE_DELAY_MS);
  },

  async flush() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      if (latest) latestKey = stableStringify(latest);
      startPush();
    }
    while (running) await running;
    return latestKey === baseKey;
  },

  watch(next) {
    listener = next;
    const timer = setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    // Closing the tab with a change still on its way: let the browser warn.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsaved()) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      listener = null;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  },
};
