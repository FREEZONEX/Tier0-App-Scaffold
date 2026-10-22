"use client";

/**
 * Live record changes in the browser — `/api/uns/subscribe` as a hook.
 *
 *   const list = useRequest("orders", (signal) => requestJson<Order[]>("/api/orders", { signal }));
 *   useRecordChanges(["work_orders"], () => list.refresh());
 *
 * Events only say that a record changed (`recordId`, `revision`, `change`);
 * they never carry record data. Reload through the App's own API, which
 * applies permissions and employee data rules, instead of patching state
 * from the event. A collection with employee data rules only reports that
 * something in it changed (`batch.collections`), never which record. A
 * `reset` means changes may have been missed (the App restarted, the stream
 * fell behind, access changed, or a collection was recreated): reload
 * everything the view shows. Changes of one record may arrive out of order,
 * a `delete` may arrive after a newer change, and revisions restart at 1
 * after a delete, so never compare revisions or rebuild state from the
 * order of events.
 *
 * The App server holds one upstream subscription per process and fans it out
 * to every browser, so a page may subscribe freely; the browser reconnects on
 * its own and resumes from the last event it saw. Pass collection aliases
 * (strings): importing declarations into a page puts their schemas and seeds
 * into the browser bundle.
 */

import { useEffect, useRef } from "react";
import { apiUrl } from "@/lib/utils";

/** A `change` event of `/api/uns/subscribe` naming the record. */
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

/** A `change` event of a collection with employee data rules: some record in it changed. */
export interface CollectionChange {
  eventId: string;
  collection: string;
  change: "collection";
  /** Unix milliseconds. */
  occurredAt: number;
}

export type ChangeEvent = RecordChange | CollectionChange;

/** What arrived since the previous callback. */
export interface RecordChangeBatch {
  changes: RecordChange[];
  /** Aliases of collections with employee data rules that changed: reload what they show. */
  collections: string[];
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
    if (!enabled || collections.length === 0 || typeof EventSource === "undefined") return;

    const source = new EventSource(url);
    let pending: RecordChangeBatch | null = null;
    let timer: number | undefined;

    function flush() {
      timer = undefined;
      const batch = pending;
      pending = null;
      if (batch) onChangeRef.current(batch);
    }

    function queue(update: (batch: RecordChangeBatch) => void) {
      pending ??= { changes: [], collections: [], reset: false };
      update(pending);
      timer ??= window.setTimeout(flush, batchMs);
    }

    function onChange(event: MessageEvent<string>) {
      try {
        const change = JSON.parse(event.data) as ChangeEvent;
        queue((batch) => {
          if (change.change !== "collection") batch.changes.push(change);
          else if (!batch.collections.includes(change.collection)) batch.collections.push(change.collection);
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

    // EventSource retries dropped connections itself; it gives up for good
    // on an HTTP error (401 after the session expired, 400, 404). Changes
    // stop arriving then, so let the page reload once.
    function onError() {
      if (source.readyState !== EventSource.CLOSED) return;
      console.warn("[record-changes] subscription closed by the server:", url);
      onReset();
    }

    source.addEventListener("change", onChange);
    source.addEventListener("reset", onReset);
    source.addEventListener("error", onError);

    return () => {
      source.removeEventListener("change", onChange);
      source.removeEventListener("reset", onReset);
      source.removeEventListener("error", onError);
      source.close();
      window.clearTimeout(timer);
    };
    // `collections` and `recordIds` are folded into `url`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, batchMs]);
}
