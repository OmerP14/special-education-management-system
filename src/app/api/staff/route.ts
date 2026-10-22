import { getAuth } from "@/lib/server/auth-repo";
import { readSessionToken } from "@/lib/server/session-cookie";
import { forbidden, isSameOrigin, readJson, serverError } from "@/lib/server/http";

// The staff ("personel") account — admin only; auth-core refuses everyone else.

const statusOf = (r: { success: boolean }) => (r.success ? 200 : 403);

export async function GET() {
  try {
    const result = await (await getAuth()).getStaff(await readSessionToken());
    return Response.json(result, { status: statusOf(result) });
  } catch (err) {
    return serverError(err);
  }
}

/** Opens or changes it: { name, username, password? }. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const body = await readJson<{ name?: string; username?: string; password?: string }>(request);
  if (!body || typeof body.name !== "string" || typeof body.username !== "string" || (body.password !== undefined && typeof body.password !== "string")) {
    return Response.json({ success: false, error: "unknown", errorMessage: "Ad ve kullanıcı adı gereklidir." }, { status: 400 });
  }
  try {
    const result = await (await getAuth()).saveStaff(await readSessionToken(), {
      name: body.name,
      username: body.username,
      password: body.password,
    });
    return Response.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  try {
    const result = await (await getAuth()).deleteStaff(await readSessionToken());
    return Response.json(result, { status: statusOf(result) });
  } catch (err) {
    return serverError(err);
  }
}
