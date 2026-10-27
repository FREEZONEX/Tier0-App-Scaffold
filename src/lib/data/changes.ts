/**
 * Record change stream — server-only; backs `/api/uns/subscribe`.
 *
 * A server process holds ONE upstream subscription (`data.subscribe` over
 * every declared collection, as the App) and fans it out to every browser
 * EventSource, filtered by the collection aliases and record IDs each one
 * asked for. Browsers never open their own upstream: UNS limits
 * subscriptions per App server process, not per user.
 *
 * Positions: browsers never see upstream cursors. Each upstream session has
 * a random epoch, and the hub numbers the events it forwards
 * `<epoch>.<seq>`; that is the SSE `id`, sent first as an id-only frame on
 * connect so every browser has a resume point. A reconnect's
 * `Last-Event-ID` is only looked up in the latest `BUFFER_SIZE` events of
 * the current session: found, the events after it are replayed; anything
 * else (another session, too old, forged) answers that browser with
 * `reset`. The upstream always starts from now and the SDK resumes it
 * across connections, so nothing a browser sends reaches UNS.
 *
 * A session ends when the upstream fails, UNS sends `reset`, or the upstream
 * closes `IDLE_CLOSE_MS` after the last browser left: the next session gets
 * a new epoch, and connected browsers get a `reset` carrying the new
 * position. A failed upstream reopens after `RESTART_INTERVAL_MS`, doubling
 * per consecutive failure up to `MAX_RESTART_INTERVAL_MS`. Every browser
 * stream ends after `MAX_STREAM_MS` (±10 %), so the browser reconnects and
 * the route authenticates it again.
 *
 * Events carry only collection, record ID, revision and kind of change. The
 * upstream runs as the App, so employee data rules do not filter them: for a
 * collection with such rules, `data.subscribe` already turns each change into
 * a collection-level `change: "collection"` event without record ID or
 * revision (its default), and the browser reloads through the App's API,
 * where the rules apply.
 */
import type { ChangeEvent, SubscriptionEvent } from "@tier0/sdk-v2/data";
import type { CollectionDefinition } from "@tier0/sdk-v2/data/define";
import { collections } from "../../data/collections";
import { HttpError } from "../route-handlers";
import type { ChangeEvent as BrowserChange } from "../record-changes";
import { data, runAsApp } from "./index";

export interface ChangeFilter {
  /** Collection aliases; every declared collection when empty. */
  collections: readonly string[];
  /** Only these records when non-empty. */
  recordIds: readonly string[];
}

export interface ChangeHubOptions {
  /** Opens the upstream from now; it ends when `signal` aborts. */
  open(options: { signal: AbortSignal }): AsyncIterable<SubscriptionEvent>;
  /** Runs the upstream detached from the request that started it. */
  detach?: <T>(fn: () => T) => T;
  bufferSize?: number;
  /** Close the upstream this long after the last browser left. */
  idleCloseMs?: number;
  /** Wait before reopening a failed upstream; doubles per consecutive failure. */
  restartIntervalMs?: number;
  maxRestartIntervalMs?: number;
  heartbeatMs?: number;
  /** A browser stream ends after this long (±10 %); the browser reconnects and is authenticated again. */
  maxStreamMs?: number;
  /** Browser reconnect delay sent as the SSE `retry` field. */
  retryMs?: number;
  logger?: Pick<Console, "warn">;
}

export interface ChangeHub {
  /** SSE response for one browser; it ends when `signal` aborts. */
  stream(filter: ChangeFilter, from: { lastEventId?: string; signal?: AbortSignal }): Response;
  /** Open browser streams. */
  readonly size: number;
}

const BUFFER_SIZE = 1000;
const IDLE_CLOSE_MS = 30_000;
const RESTART_INTERVAL_MS = 5_000;
const MAX_RESTART_INTERVAL_MS = 300_000;
const HEARTBEAT_MS = 15_000;
const MAX_STREAM_MS = 600_000;
const RETRY_MS = 5_000;

interface Subscriber {
  filter: ChangeFilter;
  send(chunk: string): void;
  close(): void;
}

/** One upstream subscription's numbering of the events it forwarded. */
interface Session {
  epoch: string;
  seq: number;
  /** Latest forwarded changes, oldest first, with their `seq`. */
  buffer: { seq: number; event: ChangeEvent }[];
}

/** The browser's view of a change: alias and the hub's position, no collection ID or `restricted`. */
function toBrowser(event: ChangeEvent, eventId: string): BrowserChange {
  const { collection, occurredAt } = event;
  return event.change === "collection"
    ? { eventId, collection, change: "collection", occurredAt }
    : { eventId, collection, change: event.change, recordId: event.recordId, revision: event.revision, occurredAt };
}

function changeFrame(event: ChangeEvent, eventId: string): string {
  return `event: change\nid: ${eventId}\ndata: ${JSON.stringify(toBrowser(event, eventId))}\n\n`;
}

/** A reset that also moves the browser to `position`, so its next reconnect resumes there. */
function resetFrame(reason: string, position: string): string {
  return `event: reset\nid: ${position}\ndata: ${JSON.stringify({ reason })}\n\n`;
}

/** A collection-level change may concern any record, so it reaches every subscriber of the collection. */
function matches(filter: ChangeFilter, event: ChangeEvent): boolean {
  return (
    (filter.collections.length === 0 || filter.collections.includes(event.collection)) &&
    (filter.recordIds.length === 0 || event.change === "collection" || filter.recordIds.includes(event.recordId))
  );
}

function newSession(): Session {
  return { epoch: crypto.randomUUID().slice(0, 8), seq: 0, buffer: [] };
}

export function createChangeHub(options: ChangeHubOptions): ChangeHub {
  const {
    open,
    detach = (fn) => fn(),
    bufferSize = BUFFER_SIZE,
    idleCloseMs = IDLE_CLOSE_MS,
    restartIntervalMs = RESTART_INTERVAL_MS,
    maxRestartIntervalMs = MAX_RESTART_INTERVAL_MS,
    heartbeatMs = HEARTBEAT_MS,
    maxStreamMs = MAX_STREAM_MS,
    retryMs = RETRY_MS,
    logger = console,
  } = options;
  const subscribers = new Set<Subscriber>();
  let session = newSession();
  let upstream: AbortController | null = null;
  let startTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let failures = 0;

  const position = () => `${session.epoch}.${session.seq}`;

  /** Ends the session: browsers still connected reload and resume in the next one. */
  function resetAll(reason: string) {
    session = newSession();
    const chunk = resetFrame(reason, position());
    for (const subscriber of subscribers) subscriber.send(chunk);
  }

  function forward(event: ChangeEvent) {
    session.seq += 1;
    session.buffer.push({ seq: session.seq, event });
    if (session.buffer.length > bufferSize) session.buffer.splice(0, session.buffer.length - bufferSize);
    const chunk = changeFrame(event, position());
    for (const subscriber of subscribers) if (matches(subscriber.filter, event)) subscriber.send(chunk);
  }

  async function run(controller: AbortController) {
    try {
      for await (const event of open({ signal: controller.signal })) {
        if (controller.signal.aborted) break;
        failures = 0;
        if (event.type === "reset") resetAll(event.reason ?? "upstream-reset");
        else forward(event);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        failures += 1;
        logger.warn(`[record-changes] upstream failed (${failures} in a row):`, error instanceof Error ? error.message : error);
      }
    } finally {
      if (upstream === controller) upstream = null;
      if (!controller.signal.aborted) {
        // Changes during the outage are lost to this session.
        resetAll("upstream-failed");
        schedule();
      }
    }
  }

  function start() {
    startTimer = undefined;
    if (upstream || subscribers.size === 0) return;
    const controller = new AbortController();
    upstream = controller;
    detach(() => void run(controller));
  }

  function schedule() {
    if (upstream || startTimer !== undefined || subscribers.size === 0) return;
    const delay = failures === 0 ? 0 : Math.min(maxRestartIntervalMs, restartIntervalMs * 2 ** (failures - 1));
    startTimer = setTimeout(start, delay);
    startTimer.unref?.();
  }

  function join(subscriber: Subscriber) {
    if (idleTimer !== undefined) {
      clearTimeout(idleTimer);
      idleTimer = undefined;
    }
    subscribers.add(subscriber);
    schedule();
  }

  function release(subscriber: Subscriber) {
    if (!subscribers.delete(subscriber) || subscribers.size > 0) return;
    if (startTimer !== undefined) {
      clearTimeout(startTimer);
      startTimer = undefined;
    }
    idleTimer = setTimeout(() => {
      idleTimer = undefined;
      upstream?.abort();
      upstream = null;
      session = newSession();
    }, idleCloseMs);
    idleTimer.unref?.();
  }

  /** Frames that bring a browser from `lastEventId` to the current position. */
  function catchUp(filter: ChangeFilter, lastEventId: string | undefined): string[] {
    if (!lastEventId) return [];
    const [epoch, seqText] = lastEventId.split(".");
    const seq = Number(seqText);
    const oldest = session.buffer[0]?.seq ?? session.seq + 1;
    const known = epoch === session.epoch && Number.isInteger(seq) && seq <= session.seq && seq >= oldest - 1;
    if (!known) return [resetFrame("unknown-event-id", position())];
    return session.buffer
      .filter((entry) => entry.seq > seq && matches(filter, entry.event))
      .map((entry) => changeFrame(entry.event, `${session.epoch}.${entry.seq}`));
  }

  return {
    get size() {
      return subscribers.size;
    },
    stream(filter, { lastEventId, signal }) {
      const encoder = new TextEncoder();
      let subscriber: Subscriber | undefined;
      let heartbeat: ReturnType<typeof setInterval> | undefined;
      let expiry: ReturnType<typeof setTimeout> | undefined;

      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          let closed = false;
          const close = () => {
            if (closed) return;
            closed = true;
            clearInterval(heartbeat);
            clearTimeout(expiry);
            signal?.removeEventListener("abort", close);
            if (subscriber) release(subscriber);
            try {
              controller.close();
            } catch {}
          };
          const send = (chunk: string) => {
            if (closed) return;
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              close();
            }
          };
          if (signal?.aborted) {
            closed = true;
            controller.close();
            return;
          }
          send(`retry: ${retryMs}\n\n`);
          for (const chunk of catchUp(filter, lastEventId)) send(chunk);
          // An id-only frame dispatches nothing; it moves the browser's resume point to now.
          send(`id: ${position()}\n\n`);
          subscriber = { filter, send, close };
          join(subscriber);
          heartbeat = setInterval(() => send(": heartbeat\n\n"), heartbeatMs);
          heartbeat.unref?.();
          expiry = setTimeout(close, maxStreamMs * (0.9 + Math.random() * 0.2));
          expiry.unref?.();
          signal?.addEventListener("abort", close, { once: true });
        },
        cancel() {
          subscriber?.close();
        },
      });

      return new Response(body, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    },
  };
}

const MAX_RECORD_IDS = 100;

function listParam(url: URL, name: string): string[] {
  return [...new Set((url.searchParams.get(name) ?? "").split(",").map((value) => value.trim()).filter(Boolean))];
}

/**
 * The filter a subscribe request asks for, checked against the `declared`
 * collection aliases: `?collections=<alias,...>` (every declared collection
 * when absent) and `?recordIds=<id,...>` (≤100). 404 when nothing is declared.
 */
export function changeFilter(request: Request, declared: readonly string[]): ChangeFilter {
  const url = new URL(request.url);
  const filter: ChangeFilter = { collections: listParam(url, "collections"), recordIds: listParam(url, "recordIds") };
  const unknown = filter.collections.filter((alias) => !declared.includes(alias));
  if (unknown.length > 0) throw new HttpError(400, `Unknown collection alias: ${unknown.join(", ")}`);
  if (filter.recordIds.length > MAX_RECORD_IDS) throw new HttpError(400, `At most ${MAX_RECORD_IDS} recordIds per subscription`);
  if (declared.length === 0) throw new HttpError(404, "This App declares no collections");
  return filter;
}

let hub: ChangeHub | undefined;

/**
 * `/api/uns/subscribe` for the request, filtered by `changeFilter` over the
 * App's declared collections and resumed from `Last-Event-ID`. Authenticate
 * before calling it.
 */
export function streamChanges(request: Request): Response {
  const filter = changeFilter(
    request,
    (collections as readonly CollectionDefinition[]).map((collection) => collection.alias),
  );

  hub ??= createChangeHub({
    open: ({ signal }) => data.subscribe({ signal }),
    detach: runAsApp,
  });
  return hub.stream(filter, { lastEventId: request.headers.get("Last-Event-ID") ?? undefined, signal: request.signal });
}
