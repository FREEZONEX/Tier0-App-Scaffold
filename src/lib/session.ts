/**
 * Session cookie codec — HMAC-signed payload.
 *
 * Cookie format: `<base64url(payload)>.<base64url(hmac)>`
 *
 * The browser cannot tamper with `role` or other fields without invalidating
 * the signature; verification uses constant-time comparison so timing leaks
 * don't reveal the secret.
 *
 * Secret resolution:
 *   - `SESSION_SECRET` env (>= 32 chars) is required in production.
 *   - In dev, if unset, a random per-process secret is generated and warned
 *     about — sessions reset on every dev restart, which is fine for local.
 *
 * Server-only. Never import from client components.
 */

import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const SESSION_SECRET: string = (() => {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 32) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set (>= 32 chars) in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  const generated = randomBytes(32).toString("hex");
  console.warn(
    "[session] SESSION_SECRET not set — using a random per-process key. " +
      "Existing sessions will invalidate on every restart. " +
      "Set SESSION_SECRET in .env for stable dev sessions.",
  );
  return generated;
})();

function sign(payloadB64: string): string {
  return createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
}

/** Encode + sign a session payload for `setCookie`. */
export function encodeSession(payload: unknown): string {
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Decode + verify a signed session cookie. Returns `null` if the cookie is
 * absent, malformed, or the signature does not match.
 */
export function decodeSession<T = unknown>(raw: string | undefined): T | null {
  if (!raw) return null;
  const dot = raw.indexOf(".");
  if (dot < 0) return null;

  const payloadB64 = raw.slice(0, dot);
  const sigB64 = raw.slice(dot + 1);

  const expected = Buffer.from(sign(payloadB64), "base64url");
  const actual = Buffer.from(sigB64, "base64url");
  if (expected.length !== actual.length) return null;
  if (!timingSafeEqual(expected, actual)) return null;

  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
