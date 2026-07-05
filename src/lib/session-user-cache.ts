import type { AppUser } from "@/lib/users";

const SESSION_USER_CACHE_TTL_MS = 30_000;

let cachedSessionUser:
  | { user: AppUser | null; expiresAt: number }
  | undefined;
let sessionUserCacheEnabled = false;

export function enableSessionUserCache() {
  if (typeof window === "undefined") return;
  sessionUserCacheEnabled = true;
}

export function rememberSessionUser(user: AppUser | null) {
  if (typeof window === "undefined") return;
  cachedSessionUser = {
    user,
    expiresAt: Date.now() + SESSION_USER_CACHE_TTL_MS,
  };
}

export function getCachedSessionUser(): AppUser | null | undefined {
  if (!sessionUserCacheEnabled) return undefined;
  if (typeof window === "undefined") return undefined;
  if (!cachedSessionUser || cachedSessionUser.expiresAt <= Date.now()) {
    return undefined;
  }
  return cachedSessionUser.user;
}
