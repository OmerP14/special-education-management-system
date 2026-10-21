import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// ─── Postgres (Neon) connection and schema ──────────────────────────────────
//
// DATABASE_URL is set by the Vercel ↔ Neon integration (and pulled into
// .env.local for development with `npx vercel env pull .env.local`).
// The schema is created on first use, so a fresh database needs no manual
// step; ensureSchema() runs once per server instance. The account row is
// created by the first-run setup screen (/setup), never seeded.

let client: NeonQueryFunction<false, false> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  schemaReady ??= createSchema().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

async function createSchema(): Promise<void> {
  const db = sql();
  await db`
    create table if not exists account (
      id smallint primary key default 1 check (id = 1),
      username text not null,
      name text not null,
      password_hash text not null,
      credential_version text not null,
      failed_attempts integer not null default 0,
      locked_until text,
      last_login_at text
    )`;
  await db`
    create table if not exists auth_sessions (
      token_hash text primary key,
      credential_version text not null,
      remember boolean not null,
      created_at text not null,
      expires_at text not null
    )`;
}
