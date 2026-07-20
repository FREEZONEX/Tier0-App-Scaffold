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

function isLatin1Only(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) > 0xff) {
      return false;
    }
  }

  return true;
}

/**
 * HTTP header values are latin-1 on the wire, so a non-ASCII role key
 * (e.g. `老板`) arrives either percent-encoded or as raw UTF-8 bytes read
 * back as latin-1 mojibake. Decode both so the role matches
 * PERMISSION_MATRIX keys; plain ASCII values pass through untouched.
 */
function decodeHeaderText(value: string): string {
  if (/%[0-9A-Fa-f]{2}/.test(value)) {
    try {
      return decodeURIComponent(value);
    } catch {
      // not actually percent-encoded — fall through
    }
  }

  // Only code units 0x80-0xFF can be latin-1-misread UTF-8; anything already
  // outside latin-1 range is genuine text and must not be re-decoded.
  if (
    /[\u0080-\u00ff]/.test(value) &&
    isLatin1Only(value)
  ) {
    const decoded = Buffer.from(value, "latin1").toString("utf8");
    if (!decoded.includes("�")) {
      return decoded;
    }
  }

  return value;
}

function normalizeRole(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? decodeHeaderText(trimmed) : undefined;
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
 * Resolve the role ONLY when it is injected by the gateway's Tier0 runtime
 * headers (`X-Tier0-Preview-Role` / `X-Tier0-Active-Role` under an explicit
 * `X-Tier0-Runtime`). The gateway strips and re-injects `X-Tier0-*` on every
 * request (B4) after validating the user against previewRoleStore / the
 * runtime-roles API, so such a role cannot be forged by the client and is
 * authoritative even when it is not present in the app's PERMISSION_MATRIX.
 *
 * Returns undefined for the legacy `X-App-User-Role` / JSON `user.role` paths,
 * which are NOT stripped by the gateway and therefore must stay gated by
 * PERMISSION_MATRIX. Reuses the same decode as getGatewayRole so non-ASCII
 * role keys (e.g. `老板`) match.
 */
export function getTrustedGatewayRole(headers: Headers): string | undefined {
  const runtime = readHeader(headers, "X-Tier0-Runtime")?.toLowerCase();
  if (runtime === "preview") {
    return normalizeRole(readHeader(headers, "X-Tier0-Preview-Role"));
  }
  if (runtime === "deployed") {
    return normalizeRole(readHeader(headers, "X-Tier0-Active-Role"));
  }
  return undefined;
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
      const parsed = JSON.parse(decodeHeaderText(userHeader));
      const id = String(parsed.userID ?? parsed.userId ?? parsed.id ?? "");
      if (id) {
        return {
          id,
          name: parsed.userName ?? parsed.username ?? parsed.name ?? id,
          email: parsed.email ?? "",
          role: gatewayRole ?? normalizeRole(parsed.role),
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
