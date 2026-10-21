import { cookies } from "next/headers";
import { SESSION_DAYS } from "@/lib/server/auth-core";

// ─── This device's session cookie ───────────────────────────────────────────
//
// httpOnly, so page scripts can never read the token. "Beni hatırla" off →
// no maxAge, so the browser drops the cookie when it closes.

const COOKIE_NAME = "oe_session";

export async function readSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE_NAME)?.value;
}

export async function writeSessionToken(token: string, remember: boolean): Promise<void> {
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: SESSION_DAYS * 86_400 } : {}),
  });
}

export async function clearSessionToken(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}
