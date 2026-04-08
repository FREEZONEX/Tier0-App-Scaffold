/**
 * Next.js 16 proxy — gateway auth bridge.
 *
 * All traffic arrives through the UNS-SWE App Gateway, which injects
 * a user identity header for authenticated platform users.
 *
 * Flow:
 *   1. Has mes-session cookie → pass through (already selected a role)
 *   2. Has gateway user header but no cookie → redirect to /login (role selection)
 *   3. Neither → 401 (not a platform user, blocked)
 */

import { NextRequest, NextResponse } from "next/server";
import { parseGatewayUser } from "@/lib/gateway";

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

export function proxy(req: NextRequest) {
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

  const gatewayUser = parseGatewayUser(req.headers);
  if (gatewayUser) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return new NextResponse(
    JSON.stringify({ error: "Platform authentication required" }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
