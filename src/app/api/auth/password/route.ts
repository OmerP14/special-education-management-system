import { getAuth } from "@/lib/server/auth-repo";
import { clearSessionToken, readSessionToken } from "@/lib/server/session-cookie";
import { clientKeyFor, forbidden, isSameOrigin, readJson, serverError } from "@/lib/server/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const body = await readJson<{ currentPassword?: string; newPassword?: string }>(request);
  if (!body || typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
    return Response.json({ success: false, error: "unknown", errorMessage: "Şifre alanları gereklidir." }, { status: 400 });
  }
  try {
    const { signedOut, ...result } = await (await getAuth()).changePassword(await readSessionToken(), {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      clientKey: clientKeyFor(request),
    });
    if (signedOut) await clearSessionToken();
    return Response.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    return serverError(err);
  }
}
