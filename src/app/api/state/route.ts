import { getAuth } from "@/lib/server/auth-repo";
import { readSessionToken } from "@/lib/server/session-cookie";
import { readState, writeState } from "@/lib/server/state-repo";
import { gzipJsonResponse, readGzipJson } from "@/lib/server/gzip-json";
import { forbidden, isSameOrigin, serverError } from "@/lib/server/http";
import { applyStaffChanges, stripForStaff } from "@/lib/server/staff-view";
import type { PersistedState } from "@/lib/data/store";
import type { AccountRole } from "@/types/auth";

// The institution's data: GET loads it, PUT saves it (gzip both ways — see
// gzip-json.ts). PUT carries the version it was based on; 409 means another
// device saved first and returns the newer state for the browser to merge.
// A staff account only ever sees and saves its stripped view (staff-view.ts).

function signedOut(): Response {
  return Response.json({ error: "signed_out" }, { status: 401 });
}

async function roleOf(): Promise<AccountRole | null> {
  return (await (await getAuth()).getUser(await readSessionToken()))?.role ?? null;
}

const asState = (data: Record<string, unknown>) => data as unknown as PersistedState;

/** Collections every saved document must have as arrays — a staff document
 *  has no money collections at all (staff-view.ts). */
const REQUIRED_ARRAYS: Record<AccountRole, string[]> = {
  admin: ["students", "teachers", "educationTypes", "sessions", "payments", "teacherPayments"],
  staff: ["students", "teachers", "educationTypes", "sessions"],
};

function isValidState(data: unknown, role: AccountRole): data is Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  if (!REQUIRED_ARRAYS[role].every((k) => Array.isArray(d[k]))) return false;
  return Object.values(d).every((v) => Array.isArray(v) || (v !== null && typeof v === "object"));
}

export async function GET() {
  try {
    const role = await roleOf();
    if (!role) return signedOut();
    const stored = await readState();
    if (role === "staff" && stored.data) return gzipJsonResponse({ ...stored, data: stripForStaff(asState(stored.data)) });
    return gzipJsonResponse(stored);
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  try {
    const role = await roleOf();
    if (!role) return signedOut();
    const body = await readGzipJson<{ data?: unknown; baseVersion?: unknown }>(request);
    if (!body || !isValidState(body.data, role) || !Number.isInteger(body.baseVersion) || (body.baseVersion as number) < 0) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    const baseVersion = body.baseVersion as number;
    if (role === "staff") {
      // Staff changes are applied onto the real document, so they must be
      // based on its latest version; otherwise the browser merges first.
      const current = await readState();
      if (!current.data || current.version !== baseVersion) {
        return gzipJsonResponse({ ...current, data: current.data && stripForStaff(asState(current.data)) }, 409);
      }
      const merged = applyStaffChanges(asState(current.data), body.data);
      const version = await writeState(merged as unknown as Record<string, unknown>, baseVersion);
      if (version !== null) return Response.json({ version });
      const latest = await readState();
      return gzipJsonResponse({ ...latest, data: latest.data && stripForStaff(asState(latest.data)) }, 409);
    }
    const version = await writeState(body.data, baseVersion);
    if (version !== null) return Response.json({ version });
    return gzipJsonResponse(await readState(), 409);
  } catch (err) {
    return serverError(err);
  }
}
