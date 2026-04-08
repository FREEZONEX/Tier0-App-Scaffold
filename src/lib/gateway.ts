/**
 * Gateway header adapter — extracts platform user identity from gateway-injected headers.
 *
 * Accepts three header formats (checked in order):
 *
 *   Format 1 (JSON): `user: {"userID":"uuid","userName":"mercy","email":"m@x.com"}`
 *   Format 2 (individual): `X-App-User-ID`, `X-App-User-Name`, `X-App-User-Email`
 *   Format 3 (minimal): `X-App-User-ID` only (name/email default to ID)
 *
 * At minimum, a user ID must be present.
 */

export interface GatewayUser {
  id: string;
  name: string;
  email: string;
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
        };
      }
    } catch {
      // malformed JSON, fall through to individual headers
    }
  }

  // Format 2 & 3: individual X-App-User-* headers
  const id = headers.get("X-App-User-ID") || headers.get("x-app-user-id");
  if (id) {
    return {
      id,
      name: headers.get("X-App-User-Name") || headers.get("x-app-user-name") || id,
      email: headers.get("X-App-User-Email") || headers.get("x-app-user-email") || "",
    };
  }

  return null;
}
