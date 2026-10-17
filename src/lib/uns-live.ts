import { useEffect, useRef } from "react";
import type { UnsChange, UnsChangeKind, UnsFilter, UnsRecord } from "./uns-types";
import { apiUrl } from "./utils";

export type { UnsChange, UnsChangeKind } from "./uns-types";

export interface UseUnsChangesParams {
  collections: string[];
  records?: string[];
  /**
   * Default `["record", "sample"]`. Add `"delete"` to see deletions, `"leave"`
   * together with `filter`, `"lock"` to show who is editing.
   */
  kinds?: UnsChangeKind[];
  /** Merge each record's changes within this window (default 1000 ms on the server route, minimum 200). */
  coalesceMs?: number;
  /**
   * Server-side filter on record events (exactly one collection), same
   * language as `find`. Records that stop matching arrive as `leave` events
   * (request `kinds: [..., "leave"]`) — remove them from the list.
   */
  filter?: UnsFilter;
  enabled?: boolean;
}

export interface UseUnsChangesHandlers {
  /** Every (re)connect. */
  onOpen?: () => void;
  /**
   * The server could not resume from the last event (gap too old, slow
   * consumer, stream rebuilt): reload the snapshot. Defaults to `onOpen`.
   */
  onReset?: (reason?: string) => void;
}

const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 30_000;

/**
 * Subscribe to live UNS changes in the browser. Connects to the app's own
 * `/api/uns/subscribe` route (which forwards the platform SSE stream with the
 * server-side app key) and calls `onChange` for every event:
 *
 * - `record` with `full: true`: `ev.data` is the whole document — **replace**
 *   the record's data (merging would keep fields removed by `$unset` /
 *   `replaceOne`). Without `full` (older servers) merge it.
 * - `sample`: the changed sample fields (merged per `coalesceMs`).
 * - `delete` / `leave`: remove the record (opt in with `kinds`).
 * - `lock`: `ev.data` is the lease (`{ principal, label, expiresAt }`) or null.
 *
 * `applyUnsChange(rows, ev)` does all of this for a list of records.
 * Reconnects resume from the last event id; when the server cannot resume it
 * sends `reset` and `onReset` (default `onOpen`) should reload the snapshot.
 *
 *   const [rows, setRows] = useState<UnsRecord<Order>[]>([]);
 *   useUnsChanges({ collections: [ordersId], kinds: ["record", "delete"] },
 *     (ev) => setRows((cur) => applyUnsChange(cur, ev)),
 *     { onReset: () => reload() });
 */
export function useUnsChanges<D = Record<string, unknown>>(
  params: UseUnsChangesParams,
  onChange: (change: UnsChange<D>) => void,
  handlers?: (() => void) | UseUnsChangesHandlers,
): void {
  const onChangeRef = useRef(onChange);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    onChangeRef.current = onChange;
    handlersRef.current = handlers;
  });
  const query = new URLSearchParams({ collections: params.collections.join(",") });
  if (params.records?.length) query.set("records", params.records.join(","));
  if (params.kinds?.length) query.set("kinds", params.kinds.join(","));
  if (params.coalesceMs) query.set("coalesce", String(params.coalesceMs));
  if (params.filter) query.set("filter", JSON.stringify(params.filter));
  const key = query.toString();
  const enabled = params.enabled !== false && params.collections.length > 0;

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    let source: EventSource | null = null;
    let lastEventId = "";
    let retryMs = RETRY_MIN_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const handlerOf = () => {
      const h = handlersRef.current;
      return typeof h === "function" ? { onOpen: h } : (h ?? {});
    };
    const handleOpen = () => {
      retryMs = RETRY_MIN_MS;
      handlerOf().onOpen?.();
    };
    const handleChange = (event: Event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) lastEventId = message.lastEventId;
      try {
        onChangeRef.current(JSON.parse(message.data) as UnsChange<D>);
      } catch {
        // ignore malformed events
      }
    };
    const handleReset = (event: Event) => {
      const message = event as MessageEvent<string>;
      if (message.lastEventId) lastEventId = message.lastEventId;
      let reason: string | undefined;
      try {
        reason = (JSON.parse(message.data) as { reason?: string }).reason;
      } catch {
        // no reason
      }
      const h = handlerOf();
      (h.onReset ?? h.onOpen)?.(reason);
    };
    const handleError = () => {
      // CONNECTING: the browser retries on its own (sending Last-Event-ID).
      // CLOSED: it gave up (non-200 such as 429 / 502 while the platform
      // restarts) — open a new EventSource with backoff.
      if (closed || !source || source.readyState !== EventSource.CLOSED) return;
      disconnect();
      retryTimer = setTimeout(connect, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    };
    const disconnect = () => {
      if (!source) return;
      source.removeEventListener("open", handleOpen);
      source.removeEventListener("change", handleChange);
      source.removeEventListener("reset", handleReset);
      source.removeEventListener("error", handleError);
      source.close();
      source = null;
    };
    const connect = () => {
      const url = new URLSearchParams(key);
      // A fresh EventSource carries the resume position in the query.
      if (lastEventId) url.set("lastEventId", lastEventId);
      source = new EventSource(apiUrl(`/api/uns/subscribe?${url}`));
      source.addEventListener("open", handleOpen);
      source.addEventListener("change", handleChange);
      source.addEventListener("reset", handleReset);
      source.addEventListener("error", handleError);
    };
    connect();
    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      disconnect();
    };
  }, [key, enabled]);
}

/**
 * Applies one change event to a list of records and returns the new list (the
 * same array when nothing changed), for `setRows((cur) => applyUnsChange(cur, ev))`.
 *
 * - `record`: `full: true` replaces `data`; otherwise fields are merged. Older
 *   revisions than the row's are ignored. A full record that is not in the
 *   list yet is inserted (`insert: "start"` by default, `"end"`, or `false` to
 *   ignore unknown records — e.g. when the list is one filtered page).
 * - `delete` / `leave`: removes the record.
 * - `lock`: sets `record.lock`.
 * - `sample`: merges into `record.latest`.
 * Events of other collections are ignored when `collection` is given.
 */
export function applyUnsChange<D = Record<string, unknown>>(
  rows: UnsRecord<D>[],
  ev: UnsChange<D>,
  opts: { collection?: string; insert?: "start" | "end" | false } = {},
): UnsRecord<D>[] {
  if (opts.collection && ev.collection !== opts.collection) return rows;
  const index = rows.findIndex((r) => r.id === ev.recordId);
  const row = index >= 0 ? rows[index] : undefined;
  const replaceAt = (next: UnsRecord<D>) => rows.map((r, i) => (i === index ? next : r));
  switch (ev.kind) {
    case "delete":
    case "leave":
      return row ? rows.filter((_, i) => i !== index) : rows;
    case "lock":
      return row ? replaceAt({ ...row, lock: ev.data }) : rows;
    case "sample": {
      if (!row) return rows;
      const prev = (row.latest?.data ?? {}) as Record<string, unknown>;
      return replaceAt({ ...row, latest: { time: ev.time, quality: ev.quality, data: { ...prev, ...ev.data } } });
    }
    case "record": {
      if (!row) {
        const insert = opts.insert ?? "start";
        if (!ev.full || insert === false) return rows;
        const added: UnsRecord<D> = { id: ev.recordId, data: ev.data, revision: ev.revision ?? 0, createdAt: ev.time, updatedAt: ev.time };
        return insert === "end" ? [...rows, added] : [added, ...rows];
      }
      if (ev.revision !== undefined && ev.revision < row.revision) return rows;
      const data = ev.full ? ev.data : ({ ...row.data, ...ev.data } as D);
      return replaceAt({ ...row, data, revision: ev.revision ?? row.revision, updatedAt: ev.time });
    }
    default:
      return rows;
  }
}
