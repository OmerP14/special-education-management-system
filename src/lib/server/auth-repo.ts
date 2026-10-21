import { ensureSchema, sql } from "@/lib/server/db";
import { createAuthCore, type AccountRow, type AuthRepo, type SessionRow } from "@/lib/server/auth-core";

// ─── AuthRepo on Postgres ───────────────────────────────────────────────────
//
// Times are stored as ISO text, exactly as auth-core writes them, so a
// session's credentialVersion compares equal to the account's without any
// timestamp precision round-trip.

type Row = Record<string, unknown>;

function toAccount(r: Row): AccountRow {
  return {
    username: r.username as string,
    name: r.name as string,
    passwordHash: r.password_hash as string,
    credentialVersion: r.credential_version as string,
    failedAttempts: r.failed_attempts as number,
    lockedUntil: (r.locked_until as string | null) ?? null,
    lastLoginAt: (r.last_login_at as string | null) ?? null,
  };
}

function toSession(r: Row): SessionRow {
  return {
    tokenHash: r.token_hash as string,
    credentialVersion: r.credential_version as string,
    remember: r.remember as boolean,
    createdAt: r.created_at as string,
    expiresAt: r.expires_at as string,
  };
}

const postgresAuthRepo: AuthRepo = {
  async getAccount() {
    const rows = await sql()`select * from account where id = 1`;
    return rows[0] ? toAccount(rows[0]) : null;
  },
  async createAccount(a) {
    const rows = await sql()`
      insert into account (id, username, name, password_hash, credential_version, failed_attempts)
      values (1, ${a.username}, ${a.name}, ${a.passwordHash}, ${a.credentialVersion}, 0)
      on conflict (id) do nothing
      returning id`;
    return rows.length === 1;
  },
  async updateAccount(patch) {
    const current = await this.getAccount();
    if (!current) return;
    const a = { ...current, ...patch };
    await sql()`
      update account set
        username = ${a.username}, name = ${a.name}, password_hash = ${a.passwordHash},
        credential_version = ${a.credentialVersion}, failed_attempts = ${a.failedAttempts},
        locked_until = ${a.lockedUntil}, last_login_at = ${a.lastLoginAt}
      where id = 1`;
  },
  async createSession(s) {
    await sql()`
      insert into auth_sessions (token_hash, credential_version, remember, created_at, expires_at)
      values (${s.tokenHash}, ${s.credentialVersion}, ${s.remember}, ${s.createdAt}, ${s.expiresAt})`;
    // Housekeeping: drop sessions that expired or belong to an old password.
    await sql()`
      delete from auth_sessions
      where expires_at < ${new Date().toISOString()}
         or credential_version <> (select credential_version from account where id = 1)`;
  },
  async getSession(tokenHash) {
    const rows = await sql()`select * from auth_sessions where token_hash = ${tokenHash}`;
    return rows[0] ? toSession(rows[0]) : null;
  },
  async updateSession(tokenHash, patch) {
    if (patch.credentialVersion === undefined) return;
    await sql()`update auth_sessions set credential_version = ${patch.credentialVersion} where token_hash = ${tokenHash}`;
  },
  async deleteSession(tokenHash) {
    await sql()`delete from auth_sessions where token_hash = ${tokenHash}`;
  },
  async getClientLock(clientKey) {
    const rows = await sql()`select failures, locked_until from login_failures where client_key = ${clientKey}`;
    return rows[0] ? { failures: rows[0].failures as number, lockedUntil: (rows[0].locked_until as string | null) ?? null } : null;
  },
  async saveClientLock(clientKey, lock) {
    const now = new Date().toISOString();
    await sql()`
      insert into login_failures (client_key, failures, locked_until, updated_at)
      values (${clientKey}, ${lock.failures}, ${lock.lockedUntil}, ${now})
      on conflict (client_key) do update
        set failures = excluded.failures, locked_until = excluded.locked_until, updated_at = excluded.updated_at`;
    // Housekeeping: forget clients that have been quiet for a day.
    await sql()`delete from login_failures where updated_at < ${new Date(Date.now() - 86_400_000).toISOString()}`;
  },
  async clearClientLock(clientKey) {
    await sql()`delete from login_failures where client_key = ${clientKey}`;
  },
};

/** The auth rules on the real database, schema guaranteed. */
export async function getAuth() {
  await ensureSchema();
  return createAuthCore(postgresAuthRepo);
}
