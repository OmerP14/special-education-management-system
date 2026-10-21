import { getAuth } from "@/lib/server/auth-repo";
import { readSessionToken } from "@/lib/server/session-cookie";
import { serverError } from "@/lib/server/http";

/** The signed-in account for this device's cookie (`user: null` when signed
 *  out), and whether the first-run setup still has to create the account. */
export async function GET() {
  try {
    const auth = await getAuth();
    const [user, needsSetup] = await Promise.all([auth.getUser(await readSessionToken()), auth.needsSetup()]);
    return Response.json({ user, needsSetup });
  } catch (err) {
    return serverError(err);
  }
}
