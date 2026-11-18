/**
 * Server route handler helpers.
 *
 * `withErrors` wraps a handler body so the route file can stay focused on
 * "translate HTTP ↔ service call" without re-implementing error mapping.
 *
 * Throw `HttpError` for client-facing failures; throw `ZodError` (i.e. let
 * `schema.parse(...)` propagate) for validation failures. Data-layer
 * `DataError`s (`@tier0/sdk-v2/data`) keep their mapped status and UNS error
 * code (`DUPLICATE_KEY`, `VERSION_CONFLICT`, ...); a 429 / 503 that is safe
 * to repeat (`retry.safe`, not `execution: "unknown"`) also sends
 * `retry.afterMs` as `Retry-After`. Their `execution`, `retry.safe`,
 * `details` (the UNS envelope `data`) and `cause` stay server-side: one App
 * request may span several data calls, so a call that is safe to repeat
 * does not make the whole request safe to resend. Anything else is a 500.
 *
 * Usage:
 *
 *   export const Route = createFileRoute("/api/work-orders")({
 *     server: {
 *       handlers: {
 *         GET: withErrors(async () => {
 *           await requireAuth();
 *           return Response.json(await listWorkOrders());
 *         }),
 *         POST: withErrors(async ({ request }) => {
 *           const user = await requireAuth("warehouse_manager");
 *           const data = createWorkOrderInput.parse(await request.json());
 *           return Response.json(await createWorkOrder(data, user.id));
 *         }),
 *       },
 *     },
 *   });
 */

import { ZodError } from "zod";

/**
 * Throw this for any client-facing error from a route handler or service.
 * `withErrors` translates it into `Response.json({ error }, { status })`.
 */
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function isHttpErrorShape(
  e: unknown,
): e is { status: number; message: string } {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    typeof (e as { status: unknown }).status === "number" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  );
}

export function withErrors<Args extends any[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof HttpError) {
        return Response.json({ error: e.message }, { status: e.status });
      }
      // Plain `{status, message}` errors, including data-layer `DataError`s,
      // which also carry the UNS error `code`, `requestId` and `retry`; only
      // the first two and the wait are answered to the caller.
      if (isHttpErrorShape(e)) {
        const { code, requestId, retry, execution } = e as {
          code?: unknown;
          requestId?: unknown;
          retry?: { safe?: unknown; afterMs?: unknown };
          execution?: unknown;
        };
        const afterMs = retry?.afterMs;
        // Only a wait the platform marked safe; never for a write that may have landed.
        const waits =
          (e.status === 429 || e.status === 503) &&
          retry?.safe === true &&
          execution !== "unknown" &&
          typeof afterMs === "number" &&
          afterMs > 0;
        return Response.json(
          {
            error: e.message,
            ...(typeof code === "string" ? { code } : {}),
            ...(typeof requestId === "string" ? { requestId } : {}),
          },
          {
            status: e.status,
            ...(waits ? { headers: { "Retry-After": String(Math.ceil(afterMs / 1000)) } } : {}),
          },
        );
      }
      if (e instanceof ZodError) {
        const first = e.issues[0];
        const path = first?.path?.length ? `${first.path.join(".")}: ` : "";
        return Response.json(
          { error: `${path}${first?.message ?? "Validation failed"}` },
          { status: 400 },
        );
      }
      // Unknown — log server-side, return generic 500. In dev we leak the
      // cause back so agents can debug without grepping the server log.
      console.error("[route] unhandled error:", e);
      const isDev = process.env.NODE_ENV !== "production";
      return Response.json(
        {
          error: "Internal error",
          ...(isDev && e instanceof Error
            ? { cause: e.message, stack: e.stack }
            : {}),
        },
        { status: 500 },
      );
    }
  };
}
