import { cookies } from "next/headers";
import { getUserById, type AppUser } from "./users";

const SESSION_COOKIE = "mes-session";

/**
 * Read the current user from the session cookie (server-side).
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) return null;
    const { userId } = JSON.parse(raw);
    return getUserById(userId);
  } catch {
    return null;
  }
}

/**
 * Require that the current request is authenticated.
 * Optionally restrict to specific roles.
 * Throws an object with { status, message } on failure — catch in route handlers.
 */
export async function requireAuth(...roles: string[]): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw { status: 401, message: "Authentication required" };
  }
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw { status: 403, message: `Requires role: ${roles.join(" or ")}` };
  }
  return user;
}
