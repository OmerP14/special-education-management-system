import { ensureSchema, sql } from "@/lib/server/db";

// ─── The institution's data document ────────────────────────────────────────
//
// One row: the whole PersistedState as jsonb plus a version. A save names the
// version it was based on and only succeeds if nobody saved in between
// (optimistic locking) — otherwise the caller gets the newer state back and
// merges (src/lib/data/merge.ts).

export interface StoredState {
  data: Record<string, unknown> | null;
  version: number;
}

export async function readState(): Promise<StoredState> {
  await ensureSchema();
  const rows = await sql()`select data, version from app_state where id = 1`;
  return rows[0] ? { data: rows[0].data as Record<string, unknown>, version: rows[0].version as number } : { data: null, version: 0 };
}

export async function readVersion(): Promise<number> {
  await ensureSchema();
  const rows = await sql()`select version from app_state where id = 1`;
  return rows[0] ? (rows[0].version as number) : 0;
}

/** Postgres text/jsonb can't hold the NUL character (it can arrive inside an
 *  imported Excel cell); one would make every later save fail, so it is
 *  dropped from every string. */
export function stripNul(value: unknown): unknown {
  if (typeof value === "string") return value.includes("\u0000") ? value.replaceAll("\u0000", "") : value;
  if (Array.isArray(value)) return value.map(stripNul);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[stripNul(k) as string] = stripNul(v);
    return out;
  }
  return value;
}

/** The new version, or null when `baseVersion` is no longer the latest. */
export async function writeState(data: Record<string, unknown>, baseVersion: number): Promise<number | null> {
  await ensureSchema();
  const now = new Date().toISOString();
  const json = JSON.stringify(stripNul(data));
  const rows =
    baseVersion === 0
      ? await sql()`
          insert into app_state (id, data, version, updated_at) values (1, ${json}::jsonb, 1, ${now})
          on conflict (id) do nothing
          returning version`
      : await sql()`
          update app_state set data = ${json}::jsonb, version = version + 1, updated_at = ${now}
          where id = 1 and version = ${baseVersion}
          returning version`;
  return rows[0] ? (rows[0].version as number) : null;
}
