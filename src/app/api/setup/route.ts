import { getAuth } from "@/lib/server/auth-repo";
import { writeSessionToken } from "@/lib/server/session-cookie";
import { forbidden, isSameOrigin, readJson, serverError } from "@/lib/server/http";
import { writeState } from "@/lib/server/state-repo";

/** An empty institution with just its name and phone (the rest of the
 *  settings come from the defaults when the app loads it). */
function initialState(institutionName: string, institutionPhone: string) {
  return {
    students: [], guardians: [], teachers: [], educationTypes: [], sessions: [], payments: [],
    teacherEarnings: [], teacherPayments: [], teacherEducationTypeAssignments: [], openingBalances: [],
    importBatches: [], teacherMergeHistory: [], weeklySessionPlans: [], notifications: [],
    institutionSettings: { institution: { name: institutionName, phone: institutionPhone } },
  };
}

/** First-run setup: creates the institution's account and its empty data.
 *  Refused once an account exists. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const body = await readJson<{
    name?: string;
    username?: string;
    password?: string;
    institutionName?: string;
    institutionPhone?: string;
  }>(request);
  const institutionName = typeof body?.institutionName === "string" ? body.institutionName.trim().slice(0, 200) : "";
  const institutionPhone = typeof body?.institutionPhone === "string" ? body.institutionPhone.trim().slice(0, 50) : "";
  if (!body || !institutionName || typeof body.name !== "string" || typeof body.username !== "string" || typeof body.password !== "string") {
    return Response.json({ success: false, error: "unknown", errorMessage: "Tüm alanları doldurun." }, { status: 400 });
  }
  try {
    const { result, token } = await (await getAuth()).setup({ name: body.name, username: body.username, password: body.password });
    if (token) {
      // Only if nothing is stored yet — never over existing data.
      await writeState(initialState(institutionName, institutionPhone), 0);
      await writeSessionToken(token, true);
    }
    return Response.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    return serverError(err);
  }
}
