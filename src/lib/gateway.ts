/**
 * Gateway header adapter — extracts platform user identity from gateway-injected headers.
 *
 * Accepts three identity formats (checked in order):
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
 * Active role precedence:
 *   1. Tier0 runtime headers (`X-Tier0-Preview-Role` / `X-Tier0-Active-Role`)
 *   2. Legacy gateway role headers (`X-App-User-Role`)
 *   3. JSON `user.role`
 *
 * This lets the platform remain the authority for role switching while the app
 * keeps backward compatibility with legacy gateway integrations.
 */

export interface GatewayUser {
  id: string;
  name: string;
  email: string;
  /** Gateway-supplied role. Validated against PERMISSION_MATRIX before use. */
  role?: string;
}

function readHeader(headers: Headers, key: string): string | null {
  return headers.get(key) ?? headers.get(key.toLowerCase());
}

function normalizeRole(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function getGatewayRole(headers: Headers): string | undefined {
  const runtime = readHeader(headers, "X-Tier0-Runtime")?.toLowerCase();
  const previewRole = normalizeRole(readHeader(headers, "X-Tier0-Preview-Role"));
  const activeRole = normalizeRole(readHeader(headers, "X-Tier0-Active-Role"));

  if (runtime === "preview" && previewRole) {
    return previewRole;
  }
  if (activeRole) {
    return activeRole;
  }
  if (previewRole) {
    return previewRole;
  }

  return normalizeRole(readHeader(headers, "X-App-User-Role"));
}

/**
 * Parse gateway-injected user identity from request headers.
 * Returns null if no recognizable user header is found.
 */
export function parseGatewayUser(headers: Headers): GatewayUser | null {
  const gatewayRole = getGatewayRole(headers);

  // Format 1: JSON `user` header
  const userHeader = readHeader(headers, "user");
  if (userHeader) {
    try {
      const parsed = JSON.parse(userHeader);
      const id = String(parsed.userID ?? parsed.userId ?? parsed.id ?? "");
      if (id) {
        return {
          id,
          name: parsed.userName ?? parsed.username ?? parsed.name ?? id,
          email: parsed.email ?? "",
          role:
            gatewayRole ??
            (typeof parsed.role === "string" && parsed.role.length > 0
              ? parsed.role
              : undefined),
        };
      }
    } catch {
      // malformed JSON, fall through to individual headers
    }
  }

  // Format 2 & 3: individual X-App-User-* headers
  const id = readHeader(headers, "X-App-User-ID");
  if (id) {
    return {
      id,
      name: readHeader(headers, "X-App-User-Name") || id,
      email: readHeader(headers, "X-App-User-Email") || "",
      role: gatewayRole,
    };
  }

  return null;
}
