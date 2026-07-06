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
 * Preview / deployed role override (checked in order):
 *   1. `X-Tier0-Preview-Role`  — gateway-injected preview role (preview mode)
 *   2. `X-Tier0-Active-Role`   — gateway-injected active role (deployed mode)
 *   3. `X-App-User-Role`       — legacy individual header
 *   These are distinct from `pfRoleCode` in the `user` JSON header, which is
 *   the workspace/platform membership role and must NOT be used as the app
 *   business role.
 *
 * At minimum, a user ID must be present.
 *
 * `role` is OPTIONAL. When the gateway supplies it, `src/start.ts` middleware
 * auto-issues a session cookie (Mode A: gateway-driven role assignment) and
 * keeps that cookie aligned with later preview role changes. When absent, the
 * bridge falls back to `/login`.
 */

export interface GatewayUser {
  id: string;
  name: string;
  email: string;
  /** Gateway-supplied role. Validated against PERMISSION_MATRIX before use. */
  role?: string;
}

function normalizeHeaderValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function resolveGatewayRole(headers: Headers, fallback: unknown): string | undefined {
  return (
    normalizeHeaderValue(headers.get("X-Tier0-Preview-Role")) ??
    normalizeHeaderValue(headers.get("X-Tier0-Active-Role")) ??
    normalizeHeaderValue(headers.get("X-App-User-Role")) ??
    normalizeHeaderValue(fallback)
  );
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
          role: resolveGatewayRole(headers, parsed.role),
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
      name:
        headers.get("X-App-User-Name") ||
        headers.get("x-app-user-name") ||
        id,
      email:
        headers.get("X-App-User-Email") ||
        headers.get("x-app-user-email") ||
        "",
      role: resolveGatewayRole(headers, undefined),
    };
  }

  return null;
}
