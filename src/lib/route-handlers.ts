/**
 * Server route handler helpers.
 *
 * `withErrors` wraps a handler body so the route file can stay focused on
 * "translate HTTP ↔ service call" without re-implementing error mapping.
 *
 * Throw `HttpError` for client-facing failures; throw `ZodError` (i.e. let
 * `schema.parse(...)` propagate) for validation failures. Anything else is a 500.
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
 *           const user = await requireAuth("admin");
 *           const data = insertWorkOrderSchema.parse(await request.json());
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
      // Backwards compatibility: services that still throw plain `{status, message}`.
      if (isHttpErrorShape(e)) {
        return Response.json({ error: e.message }, { status: e.status });
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
