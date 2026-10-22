/**
 * HTTP transport for Tier0 OpenAPI v2 UNS.
 *
 * Every call is `POST {TIER0_API_HOST}/openapi/v2{path}` with the App key in
 * `x-api-key`. Responses use the `{ code, msg, requestId, data }` envelope;
 * failures add `error: { code, retryable, ... }`. Failures become `DataError`,
 * which `withErrors` (src/lib/route-handlers.ts) turns into an HTTP response.
 */
import { DATA_SUBJECT_HEADER } from "./context";

export interface TransportConfig {
  fetch?: typeof fetch;
  /** Defaults to `process.env.TIER0_API_HOST`. */
  apiHost?: () => string | undefined;
  /** Defaults to `process.env.TIER0_API_KEY`. */
  apiKey?: () => string | undefined;
  /** Per-request timeout, default 15 s (UNS statements time out at 15 s). */
  timeoutMs?: number;
}

export interface CallOptions {
  /** Employee assertion forwarded from the current business request. */
  dataSubject?: string;
}

/**
 * Stable `data.reason` codes UNS adds when it refuses App data access; the
 * top-level code stays FORBIDDEN / NOT_FOUND. Only whole-request errors carry
 * them, never per-item results of a batch or transaction.
 */
export const ACCESS_REASONS = {
  /** 403: the collection exists, but this App's grant does not cover it or the operation. */
  notGranted: "COLLECTION_NOT_GRANTED",
  /** 403 or 404: the collection is gone (hard-deleted or archived). */
  notFound: "COLLECTION_NOT_FOUND",
  /** 403: the grant covers the operation, the App key lacks `data.missingPermission`. */
  permissionMissing: "APP_PERMISSION_MISSING",
} as const;

export class DataError extends Error {
  /** HTTP status the App should answer with (see `appStatus`). */
  readonly status: number;
  /** UNS error code, e.g. `DUPLICATE_KEY`, or a local code. */
  readonly code: string;
  /** Stable `data.reason` code, e.g. `COLLECTION_NOT_FOUND` (see ACCESS_REASONS). */
  readonly reason?: string;
  /** HTTP status UNS answered with; 0 for network failures. */
  readonly upstreamStatus: number;
  readonly requestId?: string;
  readonly retryable: boolean;
  /** `data` and `error` detail objects from the error envelope. */
  readonly details: Record<string, unknown>;

  constructor(init: {
    message: string;
    status: number;
    code: string;
    reason?: string;
    upstreamStatus?: number;
    requestId?: string;
    retryable?: boolean;
    details?: Record<string, unknown>;
  }) {
    super(init.message);
    this.name = "DataError";
    this.status = init.status;
    this.code = init.code;
    this.reason = init.reason;
    this.upstreamStatus = init.upstreamStatus ?? 0;
    this.requestId = init.requestId;
    this.retryable = init.retryable ?? false;
    this.details = init.details ?? {};
  }
}

/** Same normalization as `@tier0/sdk`: trim, drop trailing `/`, default to `http://`. */
export function normalizeApiHost(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

/**
 * Maps an upstream UNS status to the status the App answers its own caller
 * with. Credential failures are the platform's problem, not the user's
 * session, so a 401 from UNS becomes 502 instead of looking like a logout,
 * and a retryable 403 becomes 503 instead of looking like a denied action.
 */
export function appStatus(upstream: number, retryable = false): number {
  if (upstream === 401) return 502;
  // A retryable refusal is a platform state, not the caller's permission:
  // e.g. FORBIDDEN "hosted App is not ready" right after an import.
  if (upstream === 403 && retryable) return 503;
  if (upstream === 400 || upstream === 403 || upstream === 404 || upstream === 409 || upstream === 413 || upstream === 422 || upstream === 429) {
    return upstream;
  }
  if (upstream === 502 || upstream === 503 || upstream === 504) return 503;
  if (upstream >= 500) return 502;
  return upstream >= 400 ? 400 : 502;
}

const CODE_HINTS: Record<string, string> = {
  UPSERT_REQUIRES_UNIQUE_INDEX:
    "An upsert filter must contain `_id` or every field of a unique index that is already ready; a newly declared unique index may still be building.",
  DUPLICATE_KEY:
    "A unique index already holds this value. (From restore: an active record took the value meanwhile; nothing was restored.)",
  VERSION_CONFLICT: "The record changed since it was read; reload it and retry with the new revision.",
  APP_GRANT_REVOKED:
    "A workspace admin revoked this App's access to the collection; it is not re-granted automatically. Ask the admin to restore the grant.",
  INDEX_QUOTA_EXCEEDED:
    "The workspace index quota (200, counting every index that physically exists) is exhausted. Remove unused indexes through the tier0 MCP.",
  COLLECTION_TOO_LARGE:
    "archive / restore handle at most 2000 records; stop using a large collection in code instead of archiving it.",
};

/** `APP_QUOTA_EXCEEDED` per `data.resource`; each per-App limit is 64. */
const QUOTA_HINTS: Record<string, string> = {
  collections: "This App owns 64 active collections. Archive unused ones through the tier0 MCP.",
  indexes: "This App's collections hold 64 indexes. Drop unused indexes from src/data/collections.ts, then apply that with schema:replace through the tier0 MCP.",
  archivedCollections:
    "This App keeps 64 archived collections. Restore one, or ask a workspace admin to clean up archived collections.",
};

function codeHint(code: string, details: Record<string, unknown>): string | undefined {
  if (code === "APP_QUOTA_EXCEEDED") {
    const resource = typeof details.resource === "string" ? details.resource : "";
    return QUOTA_HINTS[resource] ?? "This App reached a collection/index quota. Remove unused collections or indexes through the tier0 MCP.";
  }
  return CODE_HINTS[code];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorFromEnvelope(httpStatus: number, body: unknown, path: string): DataError {
  const envelope = isObject(body) ? body : {};
  const error = isObject(envelope.error) ? envelope.error : {};
  const data = isObject(envelope.data) ? envelope.data : {};
  const code =
    (typeof error.code === "string" && error.code) ||
    (typeof data.code === "string" && data.code) ||
    `HTTP_${httpStatus}`;
  const msg = typeof envelope.msg === "string" && envelope.msg ? envelope.msg : `UNS request failed with HTTP ${httpStatus}`;
  const requestId = typeof envelope.requestId === "string" ? envelope.requestId : undefined;

  const details = { ...error, ...data };
  // Only `data.reason` is a code; `error.reason` repeats the message text.
  const reason = typeof data.reason === "string" ? data.reason : undefined;
  const retryable = error.retryable === true || httpStatus === 503 || httpStatus === 504;
  const hint = codeHint(code, details);
  let message = `${msg} (${code})`;
  if (httpStatus === 403 && retryable) {
    message = `${msg} (${code}). The platform is still preparing this App; retry shortly.`;
  } else if (reason === ACCESS_REASONS.permissionMissing) {
    message =
      data.missingPermission === "uns.delete"
        ? `Deleting records requires the App key to hold uns.delete, and this App's key does not (${code}). ` +
          "Model removal as a status change such as `archived`, or ask a workspace admin to grant uns.delete."
        : `The App key lacks ${typeof data.missingPermission === "string" ? data.missingPermission : "a permission"} for this operation (${code}); ask a workspace admin.`;
  } else if (reason === ACCESS_REASONS.notGranted) {
    message = `${message} This App's grant does not cover the collection or operation; ask a workspace admin to restore the grant.`;
  } else if (reason === ACCESS_REASONS.notFound) {
    message = `${message} The collection was archived or deleted; the data layer ensures the declared collections again.`;
  } else if (httpStatus === 401) {
    message = `Tier0 rejected the App credential for ${path} (${code}). The platform injects TIER0_API_KEY; do not replace it.`;
  } else if (hint) {
    message = `${message} ${hint}`;
  }

  return new DataError({
    message,
    status: appStatus(httpStatus, retryable),
    code,
    reason,
    upstreamStatus: httpStatus,
    requestId,
    retryable,
    details,
  });
}

export type Transport = <T>(path: string, body: unknown, options?: CallOptions) => Promise<T>;

export function createTransport(config: TransportConfig = {}): Transport {
  const fetchImpl = config.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const readHost = config.apiHost ?? (() => process.env.TIER0_API_HOST);
  const readKey = config.apiKey ?? (() => process.env.TIER0_API_KEY);
  const timeoutMs = config.timeoutMs ?? 15_000;

  return async function call<T>(path: string, body: unknown, options: CallOptions = {}): Promise<T> {
    const host = readHost()?.trim();
    const key = readKey()?.trim();
    if (!host || !key) {
      throw new DataError({
        message:
          "TIER0_API_HOST and TIER0_API_KEY are not set. The platform injects them in Preview and deployments; for local development export them before `npm run dev`.",
        status: 503,
        code: "DATA_NOT_CONFIGURED",
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": key,
    };
    if (options.dataSubject) headers[DATA_SUBJECT_HEADER] = options.dataSubject;

    const url = `${normalizeApiHost(host)}/openapi/v2${path}`;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      // The gateway address is deployment detail: keep it in the server log, not in responses.
      console.error(`[data] UNS request ${path} to ${normalizeApiHost(host)} failed:`, error);
      throw new DataError({
        message: timedOut
          ? `UNS did not answer ${path} within ${timeoutMs} ms; the write outcome is unknown.`
          : "Cannot reach the Tier0 data service; see the server log.",
        status: 503,
        code: timedOut ? "DATA_TIMEOUT" : "DATA_UNREACHABLE",
        retryable: true,
      });
    }

    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { msg: text.slice(0, 300) };
      }
    }

    if (!response.ok || (isObject(parsed) && isObject(parsed.error))) {
      throw errorFromEnvelope(response.ok ? 500 : response.status, parsed, path);
    }
    if (!isObject(parsed) || !("data" in parsed)) {
      throw new DataError({
        message: `UNS answered ${path} without a data envelope.`,
        status: 502,
        code: "DATA_BAD_RESPONSE",
        upstreamStatus: response.status,
      });
    }
    return parsed.data as T;
  };
}
