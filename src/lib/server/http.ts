import { createHash } from "node:crypto";

// ─── Small helpers shared by the API routes ─────────────────────────────────

/** Who is typing a password, for the per-client lock (auth-core.ts): the
 *  caller's network address, hashed so no IP is stored. On Vercel the
 *  first x-forwarded-for entry is set by the platform itself. */
export function clientKeyFor(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  return createHash("sha256").update(`login:${ip}`).digest("hex");
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as T) : null;
  } catch {
    return null;
  }
}

/** Logs the real error on the server; the browser only gets a Turkish message. */
export function serverError(err: unknown): Response {
  console.error(err);
  return Response.json(
    { success: false, error: "unknown", errorMessage: "Sunucuya ulaşılamadı. Biraz sonra tekrar deneyin." },
    { status: 500 }
  );
}

/** Requests that change data must come from this site's own pages. The
 *  session cookie is SameSite=Lax already; this also stops a cross-site form
 *  or script from riding on it. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    // The address the browser actually used (Host / x-forwarded-host behind
    // Vercel or a custom domain); a cross-site page can't set these.
    const hosts = [new URL(request.url).host, request.headers.get("host"), request.headers.get("x-forwarded-host")];
    return hosts.includes(new URL(origin).host);
  } catch {
    return false;
  }
}

export function forbidden(): Response {
  return Response.json({ success: false, error: "unknown", errorMessage: "İzin verilmeyen istek." }, { status: 403 });
}
