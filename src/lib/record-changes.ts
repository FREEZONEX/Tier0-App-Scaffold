"use client";

/**
 * Live record changes in the browser — `/api/uns/subscribe` as a hook.
 *
 *   const list = useRequest("orders", (signal) => requestJson<Order[]>("/api/orders", { signal }));
 *   useRecordChanges(["work_orders"], () => list.refresh());
 *
 * Events only say that a record changed (`recordId`, `revision`, `change`);
 * they never carry record data. Reload through the App's own API, which
 * applies the App's permissions, instead of patching state from the event.
 * The server only forwards the changes the user may hear about
 * (`src/lib/change-visibility.ts`). A `reset` means changes may have been missed (the App restarted, the stream
 * fell behind, access changed, or a collection was recreated): reload
 * everything the view shows. Changes of one record may arrive out of order,
 * a `delete` may arrive after a newer change, and revisions restart at 1
 * after a delete, so never compare revisions or rebuild state from the
 * order of events.
 *
 * The App server holds one upstream subscription per process and fans it out
 * to every browser, so a page may subscribe freely; the stream reconnects on
 * its own and resumes from the last event it saw. While the page is hidden
 * (background tab, minimized window) the connection is closed, so the page
 * does not hold a long connection to the App; when it is visible again the
 * stream resumes from the last event it saw: the server replays what was
 * missed, or sends `reset` when it cannot. It stops while the App sleeps and
 * comes back on the runtime's `resumed` with a `reset`, because changes in
 * between were missed. When the App server cannot reach UNS (for example
 * over the subscription limit) the stream says `unavailable` (logged here)
 * and the server keeps retrying. It runs over `fetch` (`openEventStream` from
 * `@tier0/sdk-v2/event-stream`): `EventSource` gives up for good on a 503. Pass collection aliases
 * (strings): importing declarations into a page puts their schemas and seeds
 * into the browser bundle.
 */

import { useEffect, useRef } from "react";
import { openEventStream } from "@tier0/sdk-v2/event-stream";
import { apiUrl } from "@/lib/utils";

/** A `change` event of `/api/uns/subscribe`. */
export interface RecordChange {
  /** Position in this App server's stream (the SSE `id`); not a UNS cursor. */
  eventId: string;
  /** Collection alias as declared in src/data/collections.ts. */
  collection: string;
  /** `record`: created, updated or restored; `delete`: deleted or expired. */
  change: "record" | "delete";
  recordId: string;
  /** Not monotonic per record: a record deleted and written again restarts at 1. */
  revision: number;
  /** Unix milliseconds. */
  occurredAt: number;
}

/** What arrived since the previous callback. */
export interface RecordChangeBatch {
  changes: RecordChange[];
  /** Changes may have been missed; reload instead of relying on `changes`. */
  reset: boolean;
}

export interface RecordChangeOptions {
  /** Only these records of the collections. */
  recordIds?: readonly string[];
  enabled?: boolean;
  /** Events arriving within this window are delivered as one batch. Defaults to 300 ms. */
  batchMs?: number;
}

type CollectionRef = string | { alias: string };

/** Three missed 15 s heartbeats of `/api/uns/subscribe`. */
const STREAM_IDLE_TIMEOUT_MS = 45_000;

/** URL of the change stream for the given collections (aliases or declarations). */
export function recordChangesUrl(
  collections: readonly CollectionRef[],
  recordIds: readonly string[] = [],
): string {
  const params = new URLSearchParams();
  params.set(
    "collections",
    collections.map((collection) => (typeof collection === "string" ? collection : collection.alias)).join(","),
  );
  if (recordIds.length > 0) params.set("recordIds", recordIds.join(","));
  return apiUrl(`/api/uns/subscribe?${params.toString()}`);
}

/**
 * Calls `onChange` when records of `collections` change. The callback is
 * read from a ref, so passing an inline function does not reconnect.
 */
export function useRecordChanges(
  collections: readonly CollectionRef[],
  onChange: (batch: RecordChangeBatch) => void,
  options: RecordChangeOptions = {},
): void {
  const { recordIds = [], enabled = true, batchMs = 300 } = options;
  const onChangeRef = useRef(onChange);
  const url = recordChangesUrl(collections, recordIds);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || collections.length === 0 || typeof fetch === "undefined") return;

    let pending: RecordChangeBatch | null = null;
    let timer: number | undefined;

    function flush() {
      timer = undefined;
      const batch = pending;
      pending = null;
      if (batch) onChangeRef.current(batch);
    }

    function queue(update: (batch: RecordChangeBatch) => void) {
      pending ??= { changes: [], reset: false };
      update(pending);
      timer ??= window.setTimeout(flush, batchMs);
    }

    function onChange(body: string) {
      try {
        const change = JSON.parse(body) as RecordChange;
        queue((batch) => {
          batch.changes.push(change);
        });
      } catch {
        onReset();
      }
    }

    function onReset() {
      queue((batch) => {
        batch.reset = true;
      });
    }

    const stream = openEventStream({
      url,
      idleTimeoutMs: STREAM_IDLE_TIMEOUT_MS,
      onEvent(event) {
        if (event.event === "change") onChange(event.data);
        else if (event.event === "reset") onReset();
        // The App server cannot reach UNS for now and keeps retrying; a reset follows if changes were missed.
        else if (event.event === "unavailable") console.warn("[record-changes] live updates are paused:", event.data);
      },
      onResume: onReset,
      // Refused for good (400, 404, or no page runtime): let the page reload once.
      onClose(error) {
        console.warn("[record-changes] subscription closed by the server:", url, error.message);
        onReset();
      },
    });

    return () => {
      stream.close();
      window.clearTimeout(timer);
    };
    // `collections` and `recordIds` are folded into `url`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, batchMs]);
}
