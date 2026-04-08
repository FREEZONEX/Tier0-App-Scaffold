/**
 * Logout endpoint — clears the session cookie.
 * User is redirected back to /login to re-select a role.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const SESSION_COOKIE = "mes-session";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return NextResponse.json({ redirect: "/login" });
}
