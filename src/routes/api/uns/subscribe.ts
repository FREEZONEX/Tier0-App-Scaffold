import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { parseSubscribeRequest, subscribeUpstream } from "@/lib/uns.server";

/**
 * Live UNS changes for the browser (Server-Sent Events). The app key stays on
 * the server; the browser connects here with `useUnsChanges()` from
 * `@/lib/uns-live`. Query: `collections=a,b` (required), `records=x,y`,
 * `kinds=record,sample,delete,lock,leave` (default record,sample),
 * `coalesce=<ms>` (default 1000, minimum 200), `filter=<JSON>` (server-side
 * filter, exactly one collection; non-matching records arrive as `leave`).
 *
 * Resume: EventSource sends `Last-Event-ID` on reconnect (or pass
 * `lastEventId=`); it is forwarded upstream, and the upstream stream —
 * including every `id:` line and `event: reset` — is passed through unchanged.
 */
export const Route = createFileRoute("/api/uns/subscribe")({
  server: {
    handlers: {
      GET: withErrors(async ({ request }) => {
        await requireAuth();
        const params = parseSubscribeRequest(new URL(request.url), request.headers);
        return subscribeUpstream(params, request.signal);
      }),
    },
  },
});
