/**
 * SSO adapter layer — translates gateway identity into local auth.
 *
 * Scaffold-provided. DO NOT modify unless extending SSO capabilities.
 *
 * Environment variables:
 *   NEXT_PUBLIC_GATEWAY_URL  — Public gateway URL (browser-facing, for SSO redirect)
 *   NEXT_PUBLIC_GATEWAY_LOGIN_PATH — Gateway login page path (default: /login)
 *   GATEWAY_CHECK_TOKEN_URL  — Internal URL to verify token (server-side only, no NEXT_PUBLIC_)
 */

import type { AppUser } from "./users";

// ─── Gateway user context (injected via `user` header) ───

export interface PlatformUser {
  userID: number | string;
  userName: string;
  email?: string;
  roleCode?: string;
  workspaceID?: number | string;
  appRole?: string;
  ip?: string;
  clientType?: string;
}

// ─── SSO Configuration (client-safe — uses NEXT_PUBLIC_ vars) ───

export function isSSOEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_GATEWAY_URL;
}

export function getGatewayURL(): string {
  return process.env.NEXT_PUBLIC_GATEWAY_URL || "";
}

/**
 * Build the full SSO login URL.
 * Safe to call from client components.
 */
export function getLoginURL(): string {
  const gateway = getGatewayURL();
  if (!gateway) return "";
  const loginPath = process.env.NEXT_PUBLIC_GATEWAY_LOGIN_PATH || "/login";
  const callbackUrl = `${window.location.origin}/api/auth/callback`;
  return `${gateway}${loginPath}?redirect_uri=${encodeURIComponent(callbackUrl)}`;
}

/**
 * Verify a token with the gateway's check-token endpoint.
 * Server-side only — called from the callback route handler.
 */
export async function checkToken(token: string): Promise<PlatformUser | null> {
  const url = process.env.GATEWAY_CHECK_TOKEN_URL;
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Parse the `user` header injected by the gateway reverse proxy.
 * Server-side only — called from middleware.
 */
export function parsePlatformUser(userHeader: string | null): PlatformUser | null {
  if (!userHeader) return null;
  try {
    return JSON.parse(userHeader) as PlatformUser;
  } catch {
    return null;
  }
}

/**
 * Convert a platform user into a local AppUser.
 * Uses `appRole` from the gateway (looked up from app_role_assignment table).
 * Falls back to `defaultRole` if appRole is empty.
 */
export function mapToAppUser(pu: PlatformUser, defaultRole: string = "viewer"): AppUser {
  return {
    id: String(pu.userID),
    username: pu.userName,
    displayName: pu.userName,
    password: "",
    role: pu.appRole || defaultRole,
    email: pu.email,
  };
}
