/**
 * Logout endpoint — clears the session cookie.
 *
 * In SSO mode, optionally redirects to gateway logout page.
 *
 * Scaffold-provided. DO NOT modify unless extending SSO capabilities.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isSSOEnabled, getGatewayURL } from "@/lib/sso";

const SESSION_COOKIE = "mes-session";

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });

  if (isSSOEnabled()) {
    const gatewayLogout = `${getGatewayURL()}/api/bff/auth/logout`;
    return NextResponse.json({ redirect: gatewayLogout });
  }

  return NextResponse.json({ redirect: "/login" });
}
