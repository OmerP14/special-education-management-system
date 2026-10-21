import type { PersistedState } from "@/lib/data/store";

// ─── Merging two devices' changes ───────────────────────────────────────────
//
// The whole state is saved as one document with a version number. When a
// save finds that another device saved first, this device's changes are
// replayed onto the newer state instead of overwriting it:
//
//   base   — the state this device last loaded/saved (the common ancestor)
//   local  — this device's state now
//   remote — what the other device saved
//
// Records are matched by `id`: a record this device added or edited replaces
// the remote one, a record it deleted is removed, everything else comes from
// the remote state. Settings merge per section the same way. When both
// devices edited the same record, this device's version wins.

type Json = unknown;

/** JSON with object keys sorted, so equal data gives equal text no matter how
 *  it was built (Postgres jsonb, for one, reorders keys). */
export function stableStringify(value: Json): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : stableStringify(v))).join(",")}]`;
  const entries = Object.keys(value as Record<string, Json>)
    .filter((k) => (value as Record<string, Json>)[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, Json>)[k])}`);
  return `{${entries.join(",")}}`;
}

const same = (a: Json, b: Json) => stableStringify(a) === stableStringify(b);

type WithId = { id: string };

function hasIds(list: unknown): list is WithId[] {
  return Array.isArray(list) && list.every((r) => r && typeof r === "object" && typeof (r as WithId).id === "string");
}

function mergeRecords(base: unknown, local: unknown, remote: unknown): unknown {
  if (!hasIds(base) || !hasIds(local) || !hasIds(remote)) {
    // Not a list of records: take this device's value if it changed it.
    return same(local, base) ? remote : local;
  }
  const baseById = new Map(base.map((r) => [r.id, r]));
  const localIds = new Set(local.map((r) => r.id));
  const changed = new Map<string, WithId>();
  for (const r of local) {
    const before = baseById.get(r.id);
    if (!before || !same(before, r)) changed.set(r.id, r);
  }
  const deleted = new Set(base.filter((r) => !localIds.has(r.id)).map((r) => r.id));

  const result: WithId[] = [];
  const placed = new Set<string>();
  for (const r of remote) {
    if (deleted.has(r.id)) continue;
    result.push(changed.get(r.id) ?? r);
    placed.add(r.id);
  }
  for (const r of local) {
    if (changed.has(r.id) && !placed.has(r.id) && !baseById.has(r.id)) result.push(r);
  }
  return result;
}

function mergeSettings(base: unknown, local: unknown, remote: unknown): unknown {
  if (!base || !local || !remote || typeof local !== "object" || typeof remote !== "object" || typeof base !== "object") {
    return same(local, base) ? remote : local;
  }
  const out: Record<string, unknown> = { ...(remote as Record<string, unknown>) };
  for (const [section, value] of Object.entries(local as Record<string, unknown>)) {
    if (section === "metadata") continue;
    if (!same(value, (base as Record<string, unknown>)[section])) out[section] = value;
  }
  // Each section's "last changed" stamp follows whichever side it came from.
  const meta = (s: unknown) => ((s as { metadata?: Record<string, unknown> }).metadata ?? {}) as Record<string, unknown>;
  const metadata = { ...meta(remote) };
  for (const section of Object.keys(local as Record<string, unknown>)) {
    if (section !== "metadata" && out[section] === (local as Record<string, unknown>)[section] && meta(local)[section]) {
      metadata[section] = meta(local)[section];
    }
  }
  out.metadata = metadata;
  return out;
}

export function mergeStates(base: PersistedState, local: PersistedState, remote: PersistedState): PersistedState {
  const out: Record<string, unknown> = { ...remote };
  const b = base as unknown as Record<string, unknown>;
  const r = remote as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(local as unknown as Record<string, unknown>)) {
    out[key] = key === "institutionSettings" ? mergeSettings(b[key], value, r[key]) : mergeRecords(b[key] ?? [], value, r[key] ?? []);
  }
  return out as unknown as PersistedState;
}
