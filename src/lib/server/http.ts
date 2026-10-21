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
