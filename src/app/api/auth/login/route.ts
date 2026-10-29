import { getAuth } from "@/lib/server/auth-repo";
import { writeSessionToken } from "@/lib/server/session-cookie";
import { clientKeyFor, forbidden, isSameOrigin, readJson, serverError } from "@/lib/server/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const body = await readJson<{ username?: string; password?: string; remember?: boolean }>(request);
  if (!body || typeof body.username !== "string" || typeof body.password !== "string") {
    return Response.json({ success: false, error: "unknown", errorMessage: "Kullanıcı adı ve şifre gereklidir." }, { status: 400 });
  }
  try {
    const auth = await getAuth();
    const remember = body.remember !== false;
    const { result, token } = await auth.signIn({
      username: body.username,
      password: body.password,
      remember,
      clientKey: clientKeyFor(request),
    });
    if (token) await writeSessionToken(token, remember);
    return Response.json(result, { status: result.success ? 200 : 401 });
  } catch (err) {
    return serverError(err);
  }
}
