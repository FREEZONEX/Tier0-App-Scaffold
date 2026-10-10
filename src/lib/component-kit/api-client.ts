/** Transport-neutral component requests. These paths are contract keys, not routes
 * installed by the scaffold. An application explicitly supplies the adapter. */
export interface KitRequest {
  path: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}
export interface KitApi {
  getJson<T>(path: string, options?: { signal?: AbortSignal }): Promise<T>;
  sendJson<T = unknown>(path: string, options: { method: Exclude<KitRequest["method"], "GET">; body?: unknown; signal?: AbortSignal }): Promise<T>;
}
export function createKitApi(request: (request: KitRequest) => Promise<unknown>): KitApi {
  async function run<T>(input: KitRequest): Promise<T> {
    input.signal?.throwIfAborted();
    try {
      const result = await request(input);
      input.signal?.throwIfAborted();
      return result as T;
    } catch (error) {
      if (!isAbortError(error)) console.error("[component-kit] request failed", input.method, input.path, error);
      throw error;
    }
  }
  return {
    getJson: <T>(path: string, options: { signal?: AbortSignal } = {}) => run<T>({ ...options, path, method: "GET" }),
    sendJson: <T>(path: string, options: Parameters<KitApi["sendJson"]>[1]) => run<T>({ ...options, path }),
  };
}
export function resourcePath(path: string): string { return path; }
export const SESSION_EXPIRED_EVENT = "tier0:session-expired";
export const SESSION_EXPIRED_MESSAGE = "登录已过期，请重新登录";
export function errorMessage(error: unknown, fallback = "操作失败，请稍后重试"): string {
  return error instanceof Error && error.message.trim() ? error.message : typeof error === "string" && error.trim() ? error : fallback;
}
export function isAbortError(error: unknown): boolean { return error instanceof Error && error.name === "AbortError"; }
