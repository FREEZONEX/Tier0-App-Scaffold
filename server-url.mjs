/**
 * Rebuild the browser-facing origin of a production request.
 *
 * AENV's port proxy rewrites `Host` to the guest address (`guestIP:port`) and
 * carries the public authority in `X-Forwarded-Host` / `X-Forwarded-Proto`.
 * TanStack Start's request middleware compares a write's `Origin` with
 * `request.url`, so the Web Request must be built from the public origin;
 * otherwise every same-origin POST is rejected as cross-origin.
 *
 * Only a single, syntactically valid forwarded host whose first label is this
 * App's id is accepted. Anything else falls back to the socket `Host`, keeping
 * the previous behavior (and the CSRF guard) for direct/unknown callers.
 */

const APP_ID_RE = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const HOST_RE =
  /^(\[(?:[A-Fa-f0-9:.]+)\]|(?:[A-Za-z0-9_-]+\.)*[A-Za-z0-9_-]+|(?:\d{1,3}\.){3}\d{1,3})(:\d{1,5})?$/;

function singleHeader(value) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && !trimmed.includes(",") ? trimmed : undefined;
}

/**
 * Resolve the public origin from forwarded headers.
 *
 * @param {Record<string, string | string[] | undefined>} headers
 * @param {string | undefined} appId
 * @returns {{ host: string, proto: "http" | "https" } | undefined}
 */
export function forwardedOrigin(headers, appId) {
  const id = typeof appId === "string" ? appId.trim() : "";
  if (!APP_ID_RE.test(id)) return undefined;

  const host = singleHeader(headers["x-forwarded-host"]);
  if (!host || !HOST_RE.test(host)) return undefined;

  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  if (!hostname.includes(".") || hostname.split(".")[0] !== id.toLowerCase()) {
    return undefined;
  }

  const proto =
    singleHeader(headers["x-forwarded-proto"]) === "http" ? "http" : "https";
  return { host, proto };
}

/**
 * Build the Web Request base URL and keep the copied headers consistent with it.
 *
 * Mutates `headers.host` / `headers["x-forwarded-proto"]` only when a trusted
 * forwarded origin is accepted, so the App sees the same origin in
 * `request.url` and in `request.headers`.
 *
 * @param {Record<string, string | string[] | undefined>} headers
 * @param {string | undefined} appId
 * @param {string} fallbackHost
 * @param {number | string} fallbackPort
 * @returns {string}
 */
export function requestBaseUrl(headers, appId, fallbackHost, fallbackPort) {
  const origin = forwardedOrigin(headers, appId);
  if (origin) {
    headers.host = origin.host;
    headers["x-forwarded-proto"] = origin.proto;
    return `${origin.proto}://${origin.host}`;
  }
  const host = headers.host || `${fallbackHost}:${fallbackPort}`;
  return `https://${host}`;
}
