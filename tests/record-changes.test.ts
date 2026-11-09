import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { createChangeRelay, createDataClient, defineCollection, type RecordChange } from "@tier0/sdk-v2/data";
import { z } from "zod";
import { changeFilter, matchesFilter } from "../src/lib/data/changes";
import { canSeeChange } from "../src/lib/change-visibility";
import { HttpError } from "../src/lib/route-handlers";

// What /api/uns/subscribe adds to the SDK's change relay: the filter a browser
// asks for and the App's visibility rule. The relay itself (one upstream per
// process, positions, Last-Event-ID resume, upstream lifecycle) is tested in
// @tier0/sdk-v2.

const AT = Date.UTC(2026, 9, 22);

function change(recordId: string, collection = "orders"): RecordChange {
  return { type: "change", eventId: `e-${recordId}`, collection, collectionId: `c-${collection}`, recordId, revision: 1, change: "record", occurredAt: AT };
}

const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

/** The first `count` dispatched SSE frames of a response, waiting up to `timeoutMs` for them. */
async function frames(response: Response, count: number, timeoutMs = 5000) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const parse = () => text
    .split("\n\n")
    .slice(0, -1)
    .map((block) => Object.fromEntries(block.split("\n").filter((line) => /^(event|data):/.test(line)).map((line) => [line.slice(0, line.indexOf(":")), line.slice(line.indexOf(":") + 1).trim()])))
    .filter((fields) => fields.event)
    .map((fields) => ({ event: fields.event as string, data: JSON.parse(fields.data as string) as Record<string, unknown> }));
  const until = Date.now() + timeoutMs;
  while (parse().length < count && Date.now() < until) {
    const result = await Promise.race([reader.read(), tick(until - Date.now()).then(() => undefined)]);
    if (!result || result.done) break;
    text += decoder.decode(result.value);
  }
  void reader.cancel();
  return parse().slice(0, count);
}

describe("matchesFilter", () => {
  it("narrows by collection aliases and record IDs, everything when empty", () => {
    assert.equal(matchesFilter({ collections: [], recordIds: [] }, change("r-1")), true);
    assert.equal(matchesFilter({ collections: ["orders"], recordIds: [] }, change("r-1", "lines")), false);
    assert.equal(matchesFilter({ collections: [], recordIds: ["r-2"] }, change("r-1")), false);
    assert.equal(matchesFilter({ collections: ["orders"], recordIds: ["r-1"] }, change("r-1")), true);
  });
});

describe("canSeeChange", () => {
  it("lets every change through until the App defines its rules", () => {
    const user = { id: "u1", username: "u1", displayName: "u1", primaryRole: "", roles: [] };
    assert.equal(canSeeChange(user, change("r-1")), true);
  });
});

describe("change stream over data.subscribe", () => {
  it("opens the upstream as the App and forwards only what the browser asked for and may see", async () => {
    const opened: Record<string, string>[] = [];
    const frame = (recordId: string) =>
      `id: e-${recordId}\nevent: change\ndata: ${JSON.stringify({ eventId: `e-${recordId}`, collectionId: "c-cases", recordId, revision: 2, change: "record", occurredAt: AT })}\n\n`;
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
          controller.enqueue(new TextEncoder().encode(frame("k-1") + frame("k-2") + frame("k-3")));
          init?.signal?.addEventListener("abort", () => controller.error(new Error("aborted")));
        },
      });
      return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8" } });
    }) as typeof globalThis.fetch;
    const cases = defineCollection({ alias: "cases", name: "Cases", schema: z.object({ title: z.string() }) });
    const data = createDataClient({
      collections: [cases], fetch, apiHost: "http://gw.local", apiKey: "sk-app", logger: { info() {}, warn() {}, error() {} },
    });
    const relay = createChangeRelay(data, { idleCloseMs: 0 });
    const filter = changeFilter(new Request("http://app.local/api/uns/subscribe?collections=cases&recordIds=k-1,k-2"), ["cases"]);
    const controller = new AbortController();

    const received = await frames(relay.stream({
      filter: (event) => matchesFilter(filter, event) && event.recordId !== "k-2",
      lastEventId: "garbage",
      signal: controller.signal,
    }), 2);
    controller.abort();

    assert.equal(opened.length, 1);
    assert.equal(opened[0]["x-api-key"], "sk-app");
    assert.equal(opened[0]["last-event-id"], undefined);
    assert.deepEqual(received.map((item) => [item.event, item.data.recordId]), [
      ["reset", undefined],
      ["change", "k-1"],
    ]);
  });
});

describe("browser change streams", () => {
  it("go through openEventStream, which closes while the page is hidden and resumes from the last event", () => {
    const walk = (path: string): string[] => statSync(path).isDirectory()
      ? readdirSync(path).flatMap((name) => walk(join(path, name)))
      : [path];
    const sources = walk("src").filter((path) => /\.(ts|tsx)$/.test(path) && !/\.test\./.test(path));
    for (const path of sources) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(source, /new EventSource\(/u, path);
      assert.doesNotMatch(source, /pauseWhenHidden\s*:\s*false/u, path);
    }
    assert.match(readFileSync("src/lib/record-changes.ts", "utf8"), /openEventStream\(/u);
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
