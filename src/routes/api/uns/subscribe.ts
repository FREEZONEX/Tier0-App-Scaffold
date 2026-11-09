/**
 * Record change stream (Server-Sent Events) for the browser's
 * `useRecordChanges` (src/lib/record-changes.ts).
 *
 * The one route that uses the data layer directly: `streamChanges` fans the
 * process's single upstream subscription out to this browser, resuming from
 * `Last-Event-ID`. Locked (scripts/gate-integrity.mjs): every stream needs
 * a signed-in user, each reconnect is authenticated again, and the user only
 * hears about the changes `canSeeChange` (src/lib/change-visibility.ts) lets
 * through.
 */

import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { canSeeChange } from "@/lib/change-visibility";
import { streamChanges } from "@/lib/data/changes";
import { withErrors } from "@/lib/route-handlers";

export const Route = createFileRoute("/api/uns/subscribe")({
  server: {
    handlers: {
      GET: withErrors(async ({ request }) => {
        const user = await requireAuth();
        return streamChanges(request, (change) => canSeeChange(user, change));
      }),
    },
  },
});
