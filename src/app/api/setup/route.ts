import { getAuth } from "@/lib/server/auth-repo";
import { writeSessionToken } from "@/lib/server/session-cookie";
import { readJson, serverError } from "@/lib/server/http";

/** First-run setup: creates the institution's account. Refused once one exists. */
export async function POST(request: Request) {
  const body = await readJson<{ name?: string; username?: string; password?: string }>(request);
  if (!body || typeof body.name !== "string" || typeof body.username !== "string" || typeof body.password !== "string") {
    return Response.json({ success: false, error: "unknown", errorMessage: "Tüm alanları doldurun." }, { status: 400 });
  }
  try {
    const { result, token } = await (await getAuth()).setup({ name: body.name, username: body.username, password: body.password });
    if (token) await writeSessionToken(token, true);
    return Response.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    return serverError(err);
  }
}
