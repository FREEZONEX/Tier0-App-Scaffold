/**
 * Next.js middleware — auto-creates session from gateway `user` header.
 *
 * When deployed behind the gwsvr gateway, authenticated requests arrive
 * with a `user` JSON header but no `mes-session` cookie (on first visit).
 * This middleware bridges the gap:
 *
 *   1. If mes-session cookie exists → pass through (already logged in)
 *   2. If `user` header exists (gateway injected) → parse it, write cookie, continue
 *   3. Neither → redirect to /login (unless the path is public)
 *
 * Scaffold-provided. DO NOT modify unless extending auth middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import { parsePlatformUser, mapToAppUser } from "@/lib/sso";

const SESSION_COOKIE = "mes-session";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/",
  "/api/health",
  "/api/manifest",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const hasSession = req.cookies.has(SESSION_COOKIE);
  if (hasSession) {
    return NextResponse.next();
  }

  const userHeader = req.headers.get("user");
  const platformUser = parsePlatformUser(userHeader);

  if (platformUser) {
    const appUser = mapToAppUser(platformUser);
    const response = NextResponse.next();
    response.cookies.set(SESSION_COOKIE, JSON.stringify({
      userId: appUser.id,
      role: appUser.role,
      displayName: appUser.displayName,
      username: appUser.username,
    }), {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
