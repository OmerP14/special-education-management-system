import { beforeEach, describe, expect, it, vi } from "vitest";

// persistence.ts keeps module-level state (last write, stale flag), so every
// test imports a fresh copy over a fresh fake browser.
type Listener = (e: { key: string | null }) => void;

function fakeBrowser(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const listeners: Record<string, Listener[]> = {};
  const reload = vi.fn();
  const setItem = vi.fn((k: string, v: string) => void store.set(k, v));
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem, removeItem: (k: string) => void store.delete(k) },
    location: { reload },
    addEventListener: (t: string, l: Listener) => (listeners[t] ??= []).push(l),
    removeEventListener: () => {},
  });
  const doc = { visibilityState: "hidden" as "hidden" | "visible", addEventListener: (t: string, l: Listener) => (listeners[t] ??= []).push(l), removeEventListener: () => {} };
  vi.stubGlobal("document", doc);
  const fire = (t: string, e: { key: string | null } = { key: null }) => (listeners[t] ?? []).forEach((l) => l(e));
  return { store, setItem, reload, doc, fire };
}

async function load() {
  vi.resetModules();
  return import("@/lib/mock/persistence");
}

const envelope = (data: unknown) => JSON.stringify({ version: 1, savedAt: "2026-01-01T00:00:00Z", data });

describe("mock store persistence across tabs", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("skips a write whose data did not change, so a freshly loaded tab does not bounce a write back", async () => {
    const b = fakeBrowser({ "mock-store-v1": envelope({ a: 1 }) });
    const p = await load();
    expect(p.loadPersistedStore()).toEqual({ a: 1 });
    p.savePersistedStore({ a: 1 });
    expect(b.setItem).not.toHaveBeenCalled();
    p.savePersistedStore({ a: 2 });
    expect(b.setItem).toHaveBeenCalledTimes(1);
  });

  it("stops writing once another tab writes, and reloads when the tab is next shown", async () => {
    const b = fakeBrowser({ "mock-store-v1": envelope({ status: "invited" }) });
    const p = await load();
    p.loadPersistedStore();
    p.watchOtherTabWrites();

    b.fire("storage", { key: "mock-store-v1" });
    expect(b.reload).not.toHaveBeenCalled();

    // The stale tab's next change must not overwrite the other tab's write.
    b.store.set("mock-store-v1", envelope({ status: "active" }));
    p.savePersistedStore({ status: "invited", touched: true });
    expect(JSON.parse(b.store.get("mock-store-v1")!).data).toEqual({ status: "active" });

    b.doc.visibilityState = "visible";
    b.fire("visibilitychange");
    expect(b.reload).toHaveBeenCalled();
  });

  it("ignores writes to other keys", async () => {
    const b = fakeBrowser();
    const p = await load();
    p.watchOtherTabWrites();
    b.fire("storage", { key: "mock-store-auto-backups" });
    p.savePersistedStore({ a: 1 });
    expect(b.setItem).toHaveBeenCalledTimes(1);
  });
});

describe("mock store persistence when storage is full or unreadable", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("drops the automatic backups to make room for the live data", async () => {
    const b = fakeBrowser({ "mock-store-auto-backups-v1": "[big]" });
    let full = true;
    b.setItem.mockImplementation((k: string, v: string) => {
      if (k === "mock-store-v1" && full && b.store.has("mock-store-auto-backups-v1")) throw new Error("QuotaExceeded");
      b.store.set(k, v);
    });
    const p = await load();
    expect(p.savePersistedStore({ a: 1 })).toBe(true);
    expect(b.store.has("mock-store-auto-backups-v1")).toBe(false);
    expect(JSON.parse(b.store.get("mock-store-v1")!).data).toEqual({ a: 1 });
    full = false;
  });

  it("reports failure when even that doesn't help, and retries on the next change", async () => {
    const b = fakeBrowser();
    b.setItem.mockImplementation(() => {
      throw new Error("QuotaExceeded");
    });
    const p = await load();
    expect(p.savePersistedStore({ a: 1 })).toBe(false);
    b.setItem.mockImplementation((k: string, v: string) => void b.store.set(k, v));
    expect(p.savePersistedStore({ a: 1 })).toBe(true);
  });

  it("keeps an unreadable snapshot aside instead of letting demo data overwrite it", async () => {
    const b = fakeBrowser({ "mock-store-v1": "{not json" });
    const p = await load();
    expect(p.loadPersistedStore()).toBeNull();
    expect(b.store.get("mock-store-v1-unreadable")).toBe("{not json");
    const old = JSON.stringify({ version: 0, data: { a: 1 } });
    const b2 = fakeBrowser({ "mock-store-v1": old });
    const p2 = await load();
    expect(p2.loadPersistedStore()).toBeNull();
    expect(b2.store.get("mock-store-v1-unreadable")).toBe(old);
  });
});
