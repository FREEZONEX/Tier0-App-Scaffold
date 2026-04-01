import { cookies } from "next/headers";
import { getUserById, type AppUser } from "./users";

const SESSION_COOKIE = "mes-session";

/**
 * Read the current user from the session cookie (server-side).
 *
 * Tries getUserById() first (matches local dev users from users.ts).
 * Falls back to constructing an AppUser from the cookie payload itself,
 * which supports SSO users that don't exist in the static users array.
 */
export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE)?.value;
    if (!raw) return null;
    const session = JSON.parse(raw);
    const localUser = getUserById(session.userId);
    if (localUser) return localUser;
    if (session.userId && session.role) {
      return {
        id: session.userId,
        username: session.username || session.userId,
        displayName: session.displayName || session.username || session.userId,
        password: "",
        role: session.role,
      };
    }
    return null;
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
