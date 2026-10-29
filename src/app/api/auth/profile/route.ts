import { getAuth } from "@/lib/server/auth-repo";
import { readSessionToken } from "@/lib/server/session-cookie";
import { forbidden, isSameOrigin, readJson, serverError } from "@/lib/server/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const body = await readJson<{ name?: string; username?: string }>(request);
  if (!body || typeof body.name !== "string" || typeof body.username !== "string") {
    return Response.json({ success: false, error: "unknown", errorMessage: "Ad ve kullanıcı adı gereklidir." }, { status: 400 });
  }
  try {
    const result = await (await getAuth()).updateProfile(await readSessionToken(), { name: body.name, username: body.username });
    return Response.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    return serverError(err);
  }
}
