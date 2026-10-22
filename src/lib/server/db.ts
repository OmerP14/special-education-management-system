import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// ─── Postgres (Neon) connection and schema ──────────────────────────────────
//
// DATABASE_URL is set by the Vercel ↔ Neon integration (and pulled into
// .env.local for development with `npx vercel env pull .env.local`).
// The schema is created on first use, so a fresh database needs no manual
// step; ensureSchema() runs once per server instance. The admin account is
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
  // id 1 = admin (first-run setup), id 2 = optional staff account.
  await db`
    create table if not exists account (
      id smallint primary key,
      role text not null default 'admin',
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
  // Databases created before the staff account existed: one admin row whose
  // id was pinned to 1, sessions without an account.
  await db`alter table account add column if not exists role text not null default 'admin'`;
  await db`alter table account drop constraint if exists account_id_check`;
  await db`alter table auth_sessions add column if not exists account_id smallint not null default 1`;
  // Wrong-password counts per client (hashed network address) — see auth-core.ts.
  await db`
    create table if not exists login_failures (
      client_key text primary key,
      failures integer not null,
      locked_until text,
      updated_at text not null
    )`;
  // All institution data as one document; `version` goes up by one on every
  // save so two devices can't silently overwrite each other (see state-repo.ts).
  await db`
    create table if not exists app_state (
      id smallint primary key default 1 check (id = 1),
      data jsonb not null,
      version integer not null,
      updated_at text not null
    )`;
}
