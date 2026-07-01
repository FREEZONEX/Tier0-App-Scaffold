import type { AppUser } from "@/lib/users";

const SESSION_USER_CACHE_TTL_MS = 30_000;

let cachedSessionUser:
  | { user: AppUser | null; expiresAt: number }
  | undefined;

export function rememberSessionUser(user: AppUser | null) {
  if (typeof window === "undefined") return;
  cachedSessionUser = {
    user,
    expiresAt: Date.now() + SESSION_USER_CACHE_TTL_MS,
  };
}

export function getCachedSessionUser(): AppUser | null | undefined {
  if (typeof window === "undefined") return undefined;
  if (!cachedSessionUser || cachedSessionUser.expiresAt <= Date.now()) {
    return undefined;
  }
  return cachedSessionUser.user;
}
