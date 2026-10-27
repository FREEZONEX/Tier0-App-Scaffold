import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDataClient, defineCollection, runAsApp, runWithRequestContext, type SubscriptionEvent } from "@tier0/sdk-v2/data";
import { z } from "zod";
import { changeFilter, createChangeHub, type ChangeHubOptions } from "../src/lib/data/changes";
import { HttpError } from "../src/lib/route-handlers";

// The fan-out of /api/uns/subscribe: one upstream per process, per-browser
// filters, the hub's own positions, Last-Event-ID resume and the upstream
// lifecycle. The upstream itself (data.subscribe) is tested in @tier0/sdk-v2.

/** Upstream whose events the test pushes; records every open. */
function fakeUpstream() {
  const opens: { options: Record<string, unknown>; signal: AbortSignal }[] = [];
  let push: (item: SubscriptionEvent | Error | null) => void = () => {};
  const open: ChangeHubOptions["open"] = (options) => {
    opens.push({ options: { ...options }, signal: options.signal });
    const queue: (SubscriptionEvent | Error | null)[] = [];
    let wake: (() => void) | undefined;
    push = (item) => {
      queue.push(item);
      wake?.();
    };
    options.signal.addEventListener("abort", () => push(null));
    return (async function* () {
      for (;;) {
        if (queue.length === 0) await new Promise<void>((resolve) => (wake = resolve));
        const item = queue.shift();
        if (item === null || item === undefined) return;
        if (item instanceof Error) throw item;
        yield item;
      }
    })();
  };
  return { open, opens, push: (item: SubscriptionEvent | Error | null) => push(item) };
}

const AT = Date.UTC(2026, 9, 22);

function change(eventId: string, collection = "orders", recordId = `r-${eventId}`): SubscriptionEvent {
  return { type: "change", eventId, collection, collectionId: `c-${collection}`, recordId, revision: 1, change: "record", restricted: false, occurredAt: AT };
}

/** A change of a collection with employee data rules, as data.subscribe yields it by default. */
function collectionChange(eventId: string, collection: string): SubscriptionEvent {
  return { type: "change", eventId, collection, collectionId: `c-${collection}`, change: "collection", restricted: true, occurredAt: AT };
}

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

interface Frame {
  event: string;
  id?: string;
  data: Record<string, unknown>;
}

/** Reads SSE frames of a response; `lastId` follows every `id` field, id-only frames included, like EventSource. */
function frames(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let done = false;
  let lastId: string | undefined;
  const read = async () => {
    const result = await reader.read();
    if (result.done) done = true;
    else text += decoder.decode(result.value);
  };
  return {
    /** Dispatched frames received within `ms`. */
    async take(ms = 20): Promise<Frame[]> {
      const until = Date.now() + ms;
      while (!done && Date.now() < until) await Promise.race([read(), tick(ms)]);
      const blocks = text.split("\n\n");
      text = blocks.pop() ?? "";
      const out: Frame[] = [];
      for (const block of blocks) {
        const fields = Object.fromEntries(
          block
            .split("\n")
            .filter((line) => /^(event|id|data):/.test(line))
            .map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()]),
        );
        if (fields.id !== undefined) lastId = fields.id;
        if (fields.event) out.push({ event: fields.event, id: fields.id, data: JSON.parse(fields.data) });
      }
      return out;
    },
    get lastId() {
      return lastId;
    },
    get ended() {
      return done;
    },
  };
}

const ALL = { collections: [], recordIds: [] };
const quiet = { warn() {} };

describe("record change hub", () => {
  it("fans one upstream out to every browser by collection and record", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open });
    const orders = frames(hub.stream({ collections: ["orders"], recordIds: [] }, {}));
    const one = frames(hub.stream({ collections: [], recordIds: ["r-2"] }, {}));
    await tick();

    upstream.push(change("1"));
    upstream.push(change("2", "lines"));
    const ordersFrames = await orders.take();
    const oneFrames = await one.take();

    assert.equal(upstream.opens.length, 1);
    assert.deepEqual(ordersFrames.map((frame) => [frame.event, frame.data.recordId]), [["change", "r-1"]]);
    assert.deepEqual(oneFrames.map((frame) => frame.data.collection), ["lines"]);
    assert.equal(ordersFrames[0].data.eventId, ordersFrames[0].id);
    assert.deepEqual(Object.keys(ordersFrames[0].data).sort(), ["change", "collection", "eventId", "occurredAt", "recordId", "revision"]);
    assert.equal(hub.size, 2);
  });

  it("numbers events itself and never hands upstream cursors to browsers", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open });
    const browser = frames(hub.stream(ALL, {}));
    await tick();
    upstream.push(change("upstream-cursor-secret", "orders", "r-1"));
    const [received] = await browser.take();
    assert.match(String(received.id), /^[0-9a-f]{8}\.1$/);
    assert.equal(JSON.stringify(received).includes("upstream-cursor-secret"), false);
  });

  it("resumes a reconnecting browser from the buffer of the current session", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open });
    const first = frames(hub.stream(ALL, {}));
    await tick();
    for (const id of ["1", "2", "3"]) upstream.push(change(id));
    const [one] = await first.take();

    const resumed = await frames(hub.stream(ALL, { lastEventId: one.id })).take();
    assert.deepEqual(resumed.map((frame) => frame.data.recordId), ["r-2", "r-3"]);
    assert.deepEqual(await frames(hub.stream(ALL, { lastEventId: first.lastId })).take(), []);
  });

  it("answers a forged or stale Last-Event-ID with a reset for that browser only and never opens the upstream from it", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open });
    // Cold start: the first browser brings an ID the hub never issued.
    const forged = frames(hub.stream(ALL, { lastEventId: "garbage" }));
    const other = frames(hub.stream(ALL, {}));
    await tick();

    assert.deepEqual((await forged.take()).map((frame) => frame.event), ["reset"]);
    assert.deepEqual(await other.take(), []);
    assert.equal(upstream.opens.length, 1);
    assert.deepEqual(Object.keys(upstream.opens[0].options), ["signal"]);

    // The upstream works for everyone, the forging browser included.
    upstream.push(change("1"));
    assert.equal((await forged.take()).length, 1);
    assert.equal((await other.take()).length, 1);
    for (const lastEventId of ["deadbeef.0", "", `${String(forged.lastId).split(".")[0]}.99`]) {
      const answer = await frames(hub.stream(ALL, { lastEventId })).take();
      assert.deepEqual(answer.map((frame) => frame.event), lastEventId ? ["reset"] : []);
    }
    assert.equal(upstream.opens.length, 1);
  });

  it("gives every browser a resume point on connect, so one that saw no event yet still catches up", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open });
    const keepAlive = frames(hub.stream(ALL, {}));
    const controller = new AbortController();
    const quietBrowser = frames(hub.stream(ALL, { signal: controller.signal }));
    await quietBrowser.take();
    const resumeAt = quietBrowser.lastId;
    assert.ok(resumeAt);
    controller.abort();

    upstream.push(change("1"));
    await keepAlive.take();
    const resumed = await frames(hub.stream(ALL, { lastEventId: resumeAt })).take();
    assert.deepEqual(resumed.map((frame) => frame.data.recordId), ["r-1"]);
  });

  it("opens the upstream detached from the request that connected first", async () => {
    const upstream = fakeUpstream();
    let detached = 0;
    const hub = createChangeHub({
      open: upstream.open,
      detach: (fn) => {
        detached += 1;
        return fn();
      },
    });
    hub.stream(ALL, {});
    await tick();
    assert.equal(upstream.opens.length, 1);
    assert.equal(detached, 1);
  });

  it("forwards a collection-level change to every subscriber of the collection, recordIds or not", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open });
    const one = frames(hub.stream({ collections: ["cases"], recordIds: ["r-other"] }, {}));
    const elsewhere = frames(hub.stream({ collections: ["orders"], recordIds: [] }, {}));
    await tick();

    upstream.push(change("0", "orders"));
    upstream.push(collectionChange("1", "cases"));
    const received = await one.take();
    assert.equal(received.length, 1);
    assert.deepEqual(received[0].data, { eventId: received[0].id, collection: "cases", change: "collection", occurredAt: AT });
    const [orderChange] = await elsewhere.take();
    assert.equal(orderChange.data.recordId, "r-0");

    const resumed = await frames(hub.stream(ALL, { lastEventId: orderChange.id })).take();
    assert.deepEqual(resumed.map((frame) => [frame.data.change, frame.data.recordId]), [["collection", undefined]]);
  });

  it("turns an upstream reset into a new session", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open });
    const browser = frames(hub.stream({ collections: ["orders"], recordIds: ["r-1"] }, {}));
    await tick();
    upstream.push(change("1"));
    upstream.push({ type: "reset", reason: "CURSOR_EXPIRED" });
    const received = await browser.take();
    assert.deepEqual(received.map((frame) => frame.event), ["change", "reset"]);
    assert.equal(received[1].data.reason, "CURSOR_EXPIRED");
    assert.notEqual(received[1].id?.split(".")[0], received[0].id?.split(".")[0]);
    const stale = await frames(hub.stream(ALL, { lastEventId: received[0].id })).take();
    assert.deepEqual(stale.map((frame) => frame.event), ["reset"]);
  });

  it("keeps browsers connected through an upstream failure: reset, new session, reopened upstream", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open, restartIntervalMs: 0, logger: quiet });
    const browser = frames(hub.stream(ALL, {}));
    await tick();
    upstream.push(change("7"));
    upstream.push(new Error("cursor rejected"));
    const received = await browser.take();
    assert.deepEqual(received.map((frame) => frame.event), ["change", "reset"]);
    assert.equal(received[1].data.reason, "upstream-failed");
    assert.equal(browser.ended, false);
    assert.equal(upstream.opens.length, 2);
    assert.deepEqual(Object.keys(upstream.opens[1].options), ["signal"]);

    upstream.push(change("8"));
    assert.deepEqual((await browser.take()).map((frame) => frame.data.recordId), ["r-8"]);
    const stale = await frames(hub.stream(ALL, { lastEventId: received[0].id })).take();
    assert.deepEqual(stale.map((frame) => frame.event), ["reset"]);
  });

  it("backs off between reopens of an upstream that keeps failing", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open, restartIntervalMs: 30, logger: quiet });
    hub.stream(ALL, {});
    await tick();
    upstream.push(new Error("refused"));
    await tick(15);
    assert.equal(upstream.opens.length, 1);
    await tick(30);
    assert.equal(upstream.opens.length, 2);
    upstream.push(new Error("refused"));
    await tick(40);
    assert.equal(upstream.opens.length, 2);
    await tick(40);
    assert.equal(upstream.opens.length, 3);
  });

  it("closes the upstream and forgets the session once the last browser has been gone for idleCloseMs", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open, idleCloseMs: 10 });
    const controller = new AbortController();
    const browser = frames(hub.stream(ALL, { signal: controller.signal }));
    await tick();
    upstream.push(change("1"));
    const [seen] = await browser.take();
    controller.abort();
    assert.equal(hub.size, 0);
    assert.equal(upstream.opens[0].signal.aborted, false);
    await tick(30);
    assert.equal(upstream.opens[0].signal.aborted, true);

    // Later: the old position is not replayed from; the browser reloads.
    const later = await frames(hub.stream(ALL, { lastEventId: seen.id })).take();
    assert.deepEqual(later.map((frame) => frame.event), ["reset"]);
    assert.equal(upstream.opens.length, 2);
  });

  it("ends every browser stream after maxStreamMs so the route authenticates the reconnect", async () => {
    const upstream = fakeUpstream();
    const hub = createChangeHub({ open: upstream.open, maxStreamMs: 20 });
    const browser = frames(hub.stream(ALL, {}));
    await browser.take(60);
    assert.equal(browser.ended, true);
    assert.equal(hub.size, 0);
  });
});

describe("record change hub over data.subscribe", () => {
  it("opens the upstream as the App, not as the employee whose browser connected first", async () => {
    const opened: Record<string, string>[] = [];
    const frame = (eventId: string, extra: Record<string, unknown>) =>
      `id: ${eventId}\nevent: change\ndata: ${JSON.stringify({ eventId, collectionId: "c-cases", recordId: "k-1", revision: 2, change: "record", occurredAt: AT, ...extra })}\n\n`;
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/uns/app/collections/ensure")) {
        return Response.json({
          code: 200, msg: "ok", requestId: "req-1",
          data: { appId: "app-1", results: [{ alias: "cases", collectionId: "c-cases", revision: 1, status: "unchanged", ignored: [], warnings: [], indexStatus: [] }] },
        });
      }
      opened.push(Object.fromEntries(new Headers(init?.headers).entries()));
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(frame("1", { restricted: false }) + frame("2", { recordId: "k-2", restricted: true })));
          init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
        },
      });
      return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
    }) as typeof globalThis.fetch;
    const cases = defineCollection({ alias: "cases", schema: z.object({ title: z.string() }) });
    const data = createDataClient({
      collections: [cases], fetch, apiHost: "http://gw.local", apiKey: "sk-app", logger: { info() {}, warn() {}, error() {} },
    });
    const hub = createChangeHub({ open: (options) => data.subscribe(options), detach: runAsApp, idleCloseMs: 0 });
    const controller = new AbortController();

    const browser = frames(
      runWithRequestContext(new Headers({ "X-Tier0-App-Data-Subject": "h.employee.s" }), () =>
        hub.stream({ collections: ["cases"], recordIds: [] }, { lastEventId: "garbage", signal: controller.signal }),
      ),
    );
    const received = await browser.take(100);
    controller.abort();

    assert.equal(opened.length, 1);
    assert.equal(opened[0]["x-tier0-app-data-subject"], undefined);
    assert.equal(opened[0].accept, "text/event-stream");
    assert.equal(opened[0]["last-event-id"], undefined);
    assert.deepEqual(received.map((frame) => [frame.event, frame.data.change, frame.data.recordId]), [
      ["reset", undefined, undefined],
      ["change", "record", "k-1"],
      ["change", "collection", undefined],
    ]);
  });
});

// Declarations are passed in, so these hold whatever the App itself declares
// and never open the process's upstream.
describe("changeFilter", () => {
  const subscribe = (query: string) => new Request(`http://app.local/api/uns/subscribe${query}`);
  const status = (expected: number) => (error: unknown) => error instanceof HttpError && error.status === expected;

  it("rejects aliases that are not declared and more than 100 recordIds", () => {
    assert.throws(() => changeFilter(subscribe("?collections=nope"), ["orders"]), status(400));
    const ids = Array.from({ length: 101 }, (_, index) => `r${index}`).join(",");
    assert.throws(() => changeFilter(subscribe(`?recordIds=${ids}`), ["orders"]), status(400));
    assert.deepEqual(changeFilter(subscribe("?collections=orders&recordIds=r1,r1"), ["orders"]), {
      collections: ["orders"],
      recordIds: ["r1"],
    });
  });

  it("answers 404 while the App declares no collections", () => {
    assert.throws(() => changeFilter(subscribe(""), []), status(404));
  });
});
