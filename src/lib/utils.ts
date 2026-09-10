import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let warnedLegacyEnv = false;
function warnLegacyEnv() {
  if (warnedLegacyEnv) return;
  warnedLegacyEnv = true;
  if (typeof console !== "undefined") {
    console.warn(
      "[scaffold] NEXT_PUBLIC_BASE_PATH is deprecated; rename to VITE_BASE_PATH.",
    );
  }
}

/**
 * Prefix a path with the configured base path.
 *
 * Reads `VITE_BASE_PATH` first; if it is unset, falls back to
 * `NEXT_PUBLIC_BASE_PATH` and logs a deprecation warning once.
 * The fallback exists so platform deployments that still inject the
 * old variable name keep working during migration.
 */
export function apiUrl(path: string): string {
  const fromVite =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_BASE_PATH as string | undefined)
      : undefined;
  if (fromVite) return `${fromVite}${path}`;

  const fromLegacy =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.NEXT_PUBLIC_BASE_PATH as string | undefined)
      : undefined;
  if (fromLegacy) {
    warnLegacyEnv();
    return `${fromLegacy}${path}`;
  }

  if (typeof process !== "undefined") {
    const fromProcess = process.env?.VITE_BASE_PATH;
    if (fromProcess) return `${fromProcess}${path}`;
    const fromProcessLegacy = process.env?.NEXT_PUBLIC_BASE_PATH;
    if (fromProcessLegacy) {
      warnLegacyEnv();
      return `${fromProcessLegacy}${path}`;
    }
  }

  return path;
}

/** Longest server-side failure detail kept on an ApiRequestError. */
const API_ERROR_DETAIL_LIMIT = 300;

/**
 * A non-2xx response from a local API route.
 *
 * `detail` is the server's explanation: `withErrors()` returns `{ error }` for
 * client-facing failures and, in dev, `{ error, cause }` for unhandled ones.
 * The `cause` is what actually went wrong (a failed query, a missing schema);
 * surfacing it is the difference between "Load failed" and a fixable report.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly path: string;
  readonly detail: string;
  /** Already written to console.error; hooks must not log it again. */
  readonly reported = true;

  constructor(status: number, path: string, detail: string) {
    super(`HTTP ${status} ${path}${detail ? `: ${detail}` : ""}`);
    this.name = "ApiRequestError";
    this.status = status;
    this.path = path;
    this.detail = detail;
  }
}

function extractApiErrorDetail(body: string): string {
  const text = body.trim();
  if (!text) return "";
  let detail = text;
  try {
    const parsed = JSON.parse(text) as { cause?: unknown; error?: unknown };
    if (typeof parsed.cause === "string" && parsed.cause.trim()) {
      detail = parsed.cause;
    } else if (typeof parsed.error === "string" && parsed.error.trim()) {
      detail = parsed.error;
    }
  } catch {
    // Not JSON (proxy HTML, plain text): keep the raw body.
  }
  detail = detail.replace(/\s+/g, " ").trim();
  return detail.length > API_ERROR_DETAIL_LIMIT
    ? `${detail.slice(0, API_ERROR_DETAIL_LIMIT)}…`
    : detail;
}

/**
 * Fetch a local API route and parse its JSON body.
 *
 * A non-2xx response is **reported with `console.error` and then thrown** as
 * `ApiRequestError`. Never swallow it silently: the Builder preview console
 * only sees what the app writes to `console.error`, so a quiet failure looks
 * like an empty page while the real cause (e.g. a failed query) stays hidden
 * in the server log. Pass the `signal` from `useRequest` loaders so aborted
 * navigations cancel the request instead of racing it.
 */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(apiUrl(path), { cache: "no-store", ...init });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const error = new ApiRequestError(
      res.status,
      path,
      extractApiErrorDetail(body),
    );
    console.error("[api]", error.message);
    throw error;
  }
  return (await res.json()) as T;
}
