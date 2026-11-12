"use client";

/**
 * Browser calls of the batch MES API. Callers pass `apiUrl("/api/...")` so the
 * base path is applied once and every write route keeps a visible UI caller.
 */

/** A failed write with the server's business message (`withErrors` `{ error }`). */
export class MesRequestError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MesRequestError";
    this.status = status;
  }
}

export async function sendJson<T>(
  url: string,
  init: { method: "POST" | "PUT" | "PATCH"; body?: unknown; signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(url, {
    method: init.method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(init.body ?? {}),
    cache: "no-store",
    signal: init.signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text.trim() || `请求失败（${response.status}）`;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      if (typeof parsed.error === "string" && parsed.error.trim()) message = parsed.error;
    } catch {
      // Not JSON (proxy page): keep the raw text.
    }
    console.error("[api]", init.method, url, response.status, message);
    throw new MesRequestError(response.status, message);
  }
  return (await response.json()) as T;
}

export function errorText(error: unknown): string {
  if (error instanceof MesRequestError) {
    if (error.status === 409 && /revision|VERSION_CONFLICT/i.test(error.message)) {
      return "记录已被他人更新，请刷新后重试";
    }
    return error.message;
  }
  return error instanceof Error && error.message ? error.message : "操作失败，请稍后重试";
}
