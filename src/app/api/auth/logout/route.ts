import { getAuth } from "@/lib/server/auth-repo";
import { clearSessionToken, readSessionToken } from "@/lib/server/session-cookie";
import { serverError } from "@/lib/server/http";

export async function POST() {
  try {
    await (await getAuth()).signOut(await readSessionToken());
    await clearSessionToken();
    return Response.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
