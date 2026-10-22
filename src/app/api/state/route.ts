import { getAuth } from "@/lib/server/auth-repo";
import { readSessionToken } from "@/lib/server/session-cookie";
import { readState, writeState } from "@/lib/server/state-repo";
import { gzipJsonResponse, readGzipJson } from "@/lib/server/gzip-json";
import { forbidden, isSameOrigin, serverError } from "@/lib/server/http";

// The institution's data: GET loads it, PUT saves it (gzip both ways — see
// gzip-json.ts). PUT carries the version it was based on; 409 means another
// device saved first and returns the newer state for the browser to merge.

function signedOut(): Response {
  return Response.json({ error: "signed_out" }, { status: 401 });
}

async function isSignedIn(): Promise<boolean> {
  return (await (await getAuth()).getUser(await readSessionToken())) !== null;
}

/** Collections every saved document must have as arrays. */
const REQUIRED_ARRAYS = ["students", "teachers", "educationTypes", "sessions", "payments", "teacherPayments"];

function isValidState(data: unknown): data is Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  const d = data as Record<string, unknown>;
  if (!REQUIRED_ARRAYS.every((k) => Array.isArray(d[k]))) return false;
  return Object.values(d).every((v) => Array.isArray(v) || (v !== null && typeof v === "object"));
}

export async function GET() {
  try {
    if (!(await isSignedIn())) return signedOut();
    return gzipJsonResponse(await readState());
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  try {
    if (!(await isSignedIn())) return signedOut();
    const body = await readGzipJson<{ data?: unknown; baseVersion?: unknown }>(request);
    if (!body || !isValidState(body.data) || !Number.isInteger(body.baseVersion) || (body.baseVersion as number) < 0) {
      return Response.json({ error: "invalid" }, { status: 400 });
    }
    const version = await writeState(body.data, body.baseVersion as number);
    if (version !== null) return Response.json({ version });
    return gzipJsonResponse(await readState(), 409);
  } catch (err) {
    return serverError(err);
  }
}
