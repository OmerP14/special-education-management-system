import { getAuth } from "@/lib/server/auth-repo";
import { clearSessionToken, readSessionToken } from "@/lib/server/session-cookie";
import { forbidden, isSameOrigin, serverError } from "@/lib/server/http";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  try {
    await (await getAuth()).signOut(await readSessionToken());
    await clearSessionToken();
    return Response.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
