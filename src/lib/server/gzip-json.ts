import { gunzipSync, gzipSync } from "node:zlib";

// ─── Compressed JSON bodies for /api/state ──────────────────────────────────
//
// The whole data document travels on every load and save. Vercel caps a
// function's request and response bodies at 4.5 MB; gzip shrinks this JSON
// about tenfold, so the institution can grow well past that.

/** Hard ceiling on the uncompressed document — far above any real
 *  institution, it only stops a hostile upload from exhausting memory. */
export const MAX_STATE_BYTES = 60 * 1024 * 1024;

export function gzipJsonResponse(body: unknown, status = 200): Response {
  return new Response(gzipSync(JSON.stringify(body)), {
    status,
    headers: { "Content-Type": "application/octet-stream", "X-Content-Encoding": "gzip", "Cache-Control": "no-store" },
  });
}

/** Null when the body is not gzip-compressed JSON within the size limit. */
export async function readGzipJson<T>(request: Request): Promise<T | null> {
  try {
    const compressed = Buffer.from(await request.arrayBuffer());
    const raw = gunzipSync(compressed, { maxOutputLength: MAX_STATE_BYTES });
    return JSON.parse(raw.toString("utf8")) as T;
  } catch {
    return null;
  }
}
