/**
 * Current user endpoint — returns session user info.
 * Used by Shell and frontend components to display user identity and role.
 */

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    email: user.email,
  });
}
