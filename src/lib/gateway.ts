/**
 * Gateway header adapter — extracts platform user identity from gateway-injected headers.
 *
 * Accepts three header formats (checked in order):
 *
 *   Format 1 (JSON):
 *     `user: {"userID":"uuid","userName":"mercy","email":"m@x.com","role":"admin"}`
 *
 *   Format 2 (individual): `X-App-User-ID`, `X-App-User-Name`,
 *                          `X-App-User-Email`, `X-App-User-Role`
 *
 *   Format 3 (minimal): `X-App-User-ID` only (name/email/role default)
 *
 * At minimum, a user ID must be present.
 *
 * `role` is OPTIONAL. When the gateway supplies it, `src/start.ts` middleware
 * auto-issues a session cookie (Mode A: gateway-driven role assignment) and
 * the user skips the hidden auth bridge. When absent, the bridge currently
 * creates an admin session until the platform iframe owns role selection.
 */

export interface GatewayUser {
  id: string;
  name: string;
  email: string;
  /** Gateway-supplied role. Validated against PERMISSION_MATRIX before use. */
  role?: string;
}

/**
 * Parse gateway-injected user identity from request headers.
 * Returns null if no recognizable user header is found.
 */
export function parseGatewayUser(headers: Headers): GatewayUser | null {
  // Format 1: JSON `user` header
  const userHeader = headers.get("user");
  if (userHeader) {
    try {
      const parsed = JSON.parse(userHeader);
      const id = String(parsed.userID ?? parsed.userId ?? parsed.id ?? "");
      if (id) {
        return {
          id,
          name: parsed.userName ?? parsed.username ?? parsed.name ?? id,
          email: parsed.email ?? "",
          role: typeof parsed.role === "string" && parsed.role.length > 0
            ? parsed.role
            : undefined,
        };
      }
    } catch {
      // malformed JSON, fall through to individual headers
    }
  }

  // Format 2 & 3: individual X-App-User-* headers
  const id = headers.get("X-App-User-ID") || headers.get("x-app-user-id");
  if (id) {
    const role =
      headers.get("X-App-User-Role") || headers.get("x-app-user-role") || "";
    return {
      id,
      name:
        headers.get("X-App-User-Name") ||
        headers.get("x-app-user-name") ||
        id,
      email:
        headers.get("X-App-User-Email") ||
        headers.get("x-app-user-email") ||
        "",
      role: role.length > 0 ? role : undefined,
    };
  }

  return null;
}
