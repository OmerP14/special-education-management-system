import { getAuth } from "@/lib/server/auth-repo";
import { readSessionToken } from "@/lib/server/session-cookie";
import { readVersion } from "@/lib/server/state-repo";
import { serverError } from "@/lib/server/http";

/** Cheap poll: has another device saved since this one loaded? */
export async function GET() {
  try {
    if (!(await (await getAuth()).getUser(await readSessionToken()))) {
      return Response.json({ error: "signed_out" }, { status: 401 });
    }
    return Response.json({ version: await readVersion() }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return serverError(err);
  }
}
