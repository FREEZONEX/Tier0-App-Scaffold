/**
 * Role selection endpoint.
 *
 * Called from the login page after the user picks a role.
 * Reads gateway user header for identity, validates the chosen role
 * against PERMISSION_MATRIX, then writes the session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseGatewayUser } from "@/lib/gateway";
import { PERMISSION_MATRIX } from "@/lib/permissions";

const SESSION_COOKIE = "mes-session";

export async function POST(req: NextRequest) {
  const gatewayUser = parseGatewayUser(req.headers);
  if (!gatewayUser) {
    return NextResponse.json(
      { error: "Gateway user header missing" },
      { status: 401 },
    );
  }

  let body: { role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const role = body.role;
  if (!role) {
    return NextResponse.json({ error: "Role is required" }, { status: 400 });
  }

  const validRoles = Object.keys(PERMISSION_MATRIX);
  if (validRoles.length > 0 && !validRoles.includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Available: ${validRoles.join(", ")}` },
      { status: 400 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    JSON.stringify({
      userId: gatewayUser.id,
      role,
      displayName: gatewayUser.name,
      username: gatewayUser.name,
      email: gatewayUser.email,
    }),
    {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    },
  );

  return NextResponse.json({
    userId: gatewayUser.id,
    role,
    displayName: gatewayUser.name,
  });
}
