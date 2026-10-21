// ─── Small helpers shared by the API routes ─────────────────────────────────

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
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function forbidden(): Response {
  return Response.json({ success: false, error: "unknown", errorMessage: "İzin verilmeyen istek." }, { status: 403 });
}
