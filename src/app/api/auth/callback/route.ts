/**
 * SSO callback endpoint.
 *
 * After the gateway login page authenticates the user, it redirects here
 * with a token (via query param or cookie). This handler:
 *   1. Extracts the token
 *   2. Verifies it with the gateway's check-token endpoint
 *   3. Maps the platform user to a local AppUser (using appRole from gateway)
 *   4. Writes the mes-session cookie
 *   5. Redirects to /
 *
 * Scaffold-provided. DO NOT modify unless extending SSO capabilities.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { checkToken, mapToAppUser } from "@/lib/sso";

const SESSION_COOKIE = "mes-session";

export async function GET(req: NextRequest) {
  const token =
    req.nextUrl.searchParams.get("token") ||
    req.cookies.get("tier0_auth_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=no_token", req.url));
  }

  const platformUser = await checkToken(token);
  if (!platformUser) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  const appUser = mapToAppUser(platformUser);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, JSON.stringify({
    userId: appUser.id,
    role: appUser.role,
    displayName: appUser.displayName,
    username: appUser.username,
  }), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return NextResponse.redirect(new URL("/", req.url));
}
