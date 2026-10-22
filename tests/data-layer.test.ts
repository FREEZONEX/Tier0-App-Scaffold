import assert from "node:assert/strict";
import { describe, it, mock as testMock } from "node:test";
import { z } from "zod";
import { REBUILD_INTERVAL_MS, type EnsureResult } from "../src/lib/data/bootstrap";
import { createDataClient, type DataClientConfig } from "../src/lib/data/client";
import { currentDataSubject, DATA_SUBJECT_HEADER, runAsApp, runWithRequestContext } from "../src/lib/data/context";
import { defineCollection } from "../src/lib/data/define";
import { compileCollection } from "../src/lib/data/schema";
import { DataError, normalizeApiHost } from "../src/lib/data/transport";
import { withErrors } from "../src/lib/route-handlers";
import { authBridge } from "../src/start";

const orders = defineCollection({
  alias: "orders",
  schema: z.object({ code: z.string(), status: z.enum(["OPEN", "DONE"]), qty: z.number().int().optional() }),
  indexes: [{ path: "code", unique: true }],
  seed: [
    { _id: "o-1", code: "A-1", status: "OPEN" },
    { _id: "o-2", code: "A-2", status: "DONE" },
  ],
});
const lines = defineCollection({
  alias: "lines",
  schema: z.object({ orderId: z.string(), sku: z.string() }),
  seed: [{ _id: "l-1", orderId: "o-1", sku: "S" }],
});

interface Sent {
  url: string;
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

type Reply = { status?: number; body: unknown } | ((sent: Sent) => { status?: number; body: unknown });

/** Mock UNS: replies are queued per path suffix (after /openapi/v2); the last one repeats. */
function mockUns(routes: Record<string, Reply | Reply[]>) {
  const sent: Sent[] = [];
  const queues = new Map(Object.entries(routes).map(([path, reply]) => [path, Array.isArray(reply) ? [...reply] : [reply]]));
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const path = url.slice(url.indexOf("/openapi/v2") + "/openapi/v2".length);
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([key, value]) => [key.toLowerCase(), value]));
    const entry: Sent = { url, path, headers, body: JSON.parse(String(init?.body ?? "{}")) };
    sent.push(entry);
    const queue = queues.get(path);
    if (!queue) return new Response(JSON.stringify({ code: 404, msg: `no mock for ${path}`, error: { code: "NOT_FOUND" } }), { status: 404 });
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    const reply = typeof next === "function" ? next(entry) : next;
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 });
  }) as typeof globalThis.fetch;
  return { fetch, sent, calls: (path: string) => sent.filter((entry) => entry.path === path) };
}

const ok = (data: unknown) => ({ body: { code: 0, msg: "ok", requestId: "req-1", data } });
const fail = (status: number, code: string, data: unknown = null, msg = code) => ({
  status,
  body: { code: status, msg, requestId: "req-err", data, error: { code, retryable: status === 503 } },
});

/** UNS fault: `error.reason` repeats the message text; App data-access refusals add a stable `data.reason` code. */
const fault = (status: number, code: string, message: string, data: Record<string, unknown> | null = null, retryable = false) => ({
  status,
  body: { code: status, msg: message, requestId: "req-err", data, error: { code, reason: message, retryable } },
});
const NOT_GRANTED = fault(403, "FORBIDDEN", "App has no permission for this Collection operation", {
  reason: "COLLECTION_NOT_GRANTED",
  collectionId: "c-orders",
  permission: "record:read",
});
const GONE = fault(404, "NOT_FOUND", "object not found", { reason: "COLLECTION_NOT_FOUND", collectionId: "c-lines" });
const NO_UNS_DELETE = fault(403, "FORBIDDEN", "App has no permission for this Collection operation", {
  reason: "APP_PERMISSION_MISSING",
  collectionId: "c-orders",
  permission: "record:delete",
  missingPermission: "uns.delete",
});

function ensured(...results: Partial<EnsureResult>[]) {
  return ok({
    appId: "app-1",
    results: results.map((result) => ({ revision: 1, status: "unchanged", ignored: [], warnings: [], indexStatus: [], ...result })),
  });
}

const silent = { info() {}, warn() {}, error() {} };

function client(mock: ReturnType<typeof mockUns>, overrides: Partial<DataClientConfig> = {}) {
  return createDataClient({
    collections: [orders, lines],
    fetch: mock.fetch,
    apiHost: () => "gw.local:8795/",
    apiKey: () => "sk-app",
    environment: "preview",
    logger: silent,
    ...overrides,
  });
}

const ENSURE = "/uns/app/collections/ensure";
const BOTH_UNCHANGED = ensured({ alias: "orders", collectionId: "c-orders" }, { alias: "lines", collectionId: "c-lines" });

describe("transport", () => {
  it("normalizes the host like @tier0/sdk", () => {
    assert.equal(normalizeApiHost("gw.local:8795/"), "http://gw.local:8795");
    assert.equal(normalizeApiHost(" https://api.example.com// "), "https://api.example.com");
  });

  it("sends the App key and parses the envelope", async () => {
    const mock = mockUns({ [ENSURE]: BOTH_UNCHANGED, "/uns/collections/c-orders/records:count": ok({ count: 7 }) });
    assert.equal(await client(mock).collection(orders).countDocuments({ status: "OPEN" }), 7);
    const count = mock.calls("/uns/collections/c-orders/records:count")[0];
    assert.equal(count.url, "http://gw.local:8795/openapi/v2/uns/collections/c-orders/records:count");
    assert.equal(count.headers["x-api-key"], "sk-app");
    assert.deepEqual(count.body, { collectionId: "c-orders", filter: { status: "OPEN" } });
  });

  it("maps UNS errors to DataError statuses and hints", async () => {
    const run = async (reply: Reply, action: (data: ReturnType<typeof client>) => Promise<unknown>) => {
      const mock = mockUns({
        [ENSURE]: BOTH_UNCHANGED,
        "/uns/collections/c-orders/records": reply,
        "/uns/collections/c-orders/records:deleteOne": reply,
      });
      return action(client(mock)).then(
        () => assert.fail("expected failure"),
        (error: unknown) => {
          assert.ok(error instanceof DataError, String(error));
          return error;
        },
      );
    };
    const insert = (data: ReturnType<typeof client>) => data.collection(orders).insertOne({ code: "A", status: "OPEN" });

    const duplicate = await run(fail(409, "DUPLICATE_KEY"), insert);
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.code, "DUPLICATE_KEY");
    assert.equal(duplicate.requestId, "req-err");

    const unauthorized = await run(fail(401, "UNAUTHORIZED"), insert);
    assert.equal(unauthorized.status, 502);

    const noDelete = await run(NO_UNS_DELETE, (data) => data.collection(orders).deleteOne({ _id: "o-1" }));
    assert.equal(noDelete.status, 403);
    assert.equal(noDelete.reason, "APP_PERMISSION_MISSING");
    assert.match(noDelete.message, /uns\.delete/);
    // The hint follows data.reason, not the operation: a delete refused for another reason does not blame uns.delete.
    const deleteNotGranted = await run(NOT_GRANTED, (data) => data.collection(orders).deleteOne({ _id: "o-1" }));
    assert.equal(deleteNotGranted.reason, "COLLECTION_NOT_GRANTED");
    assert.doesNotMatch(deleteNotGranted.message, /uns\.delete/);

    const notReady = await run(fault(403, "FORBIDDEN", "hosted App is not ready", null, true), insert);
    assert.equal(notReady.status, 503);
    assert.equal(notReady.upstreamStatus, 403);
    assert.equal(notReady.retryable, true);
    assert.match(notReady.message, /retry shortly/);
    const denied = await run(fault(403, "FORBIDDEN", "employee cannot access this Record"), insert);
    assert.equal(denied.status, 403);
    assert.equal(denied.retryable, false);

    const unavailable = await run(fail(503, "TEMPORARILY_UNAVAILABLE"), insert);
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.retryable, true);

    const archivedQuota = await run(fail(409, "APP_QUOTA_EXCEEDED", { resource: "archivedCollections", limit: 64 }), insert);
    assert.equal(archivedQuota.status, 409);
    assert.equal(archivedQuota.details.resource, "archivedCollections");
    assert.match(archivedQuota.message, /64 archived collections/);
    const indexQuota = await run(fail(409, "APP_QUOTA_EXCEEDED", { resource: "indexes" }), insert);
    assert.match(indexQuota.message, /64 indexes/);

    const tooLarge = await run(fail(409, "COLLECTION_TOO_LARGE", { records: 2500, maxRecords: 2000 }), insert);
    assert.equal(tooLarge.details.maxRecords, 2000);
    assert.match(tooLarge.message, /at most 2000 records/);
  });

  it("reports network failures and missing configuration", async () => {
    const down = createDataClient({
      collections: [orders],
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as typeof fetch,
      apiHost: () => "gw.local",
      apiKey: () => "k",
      logger: silent,
    });
    await assert.rejects(down.ensure(), (error: unknown) => error instanceof DataError && error.code === "DATA_UNREACHABLE" && error.status === 503);

    const hidden = createDataClient({
      collections: [orders],
      fetch: (async () => {
        throw new TypeError("connect ECONNREFUSED");
      }) as typeof fetch,
      apiHost: () => "secret-gw.internal:8795",
      apiKey: () => "k",
      logger: silent,
    });
    const originalError = console.error;
    console.error = () => {};
    try {
      await assert.rejects(hidden.ensure(), (error: unknown) => error instanceof DataError && !/secret-gw/.test(error.message));
    } finally {
      console.error = originalError;
    }

    const unconfigured = createDataClient({ collections: [orders], apiHost: () => undefined, apiKey: () => undefined, logger: silent });
    await assert.rejects(unconfigured.ensure(), (error: unknown) => error instanceof DataError && error.code === "DATA_NOT_CONFIGURED");
  });

  it("lets withErrors answer with the mapped status and code", async () => {
    const mock = mockUns({ [ENSURE]: BOTH_UNCHANGED, "/uns/collections/c-orders/records": fail(409, "DUPLICATE_KEY") });
    const data = client(mock);
    const handler = withErrors(async () => {
      await data.collection(orders).insertOne({ code: "A", status: "OPEN" });
      return Response.json({});
    });
    const response = await handler();
    assert.equal(response.status, 409);
    const body = await response.json();
    assert.equal(body.code, "DUPLICATE_KEY");
    assert.equal(body.requestId, "req-err");
  });
});

describe("bootstrap", () => {
  it("ensures every declaration in one batch, once", async () => {
    const mock = mockUns({ [ENSURE]: BOTH_UNCHANGED, "/uns/collections/c-orders/records:count": ok({ count: 1 }), "/uns/collections/c-lines/records:count": ok({ count: 2 }) });
    const data = client(mock);
    await Promise.all([data.collection(orders).countDocuments(), data.collection("lines").countDocuments(), data.collection(orders).countDocuments()]);
    const calls = mock.calls(ENSURE);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body, { collections: [compileCollection(orders), compileCollection(lines)] });
    assert.deepEqual((calls[0].body.collections as { indexes: unknown }[])[0].indexes, [{ path: "code", unique: true }]);
  });

  it("does not cache a failed ensure", async () => {
    const mock = mockUns({
      [ENSURE]: [fail(503, "TEMPORARILY_UNAVAILABLE", null, "hosted App is not ready"), BOTH_UNCHANGED],
      "/uns/collections/c-orders/records:count": ok({ count: 0 }),
    });
    const data = client(mock);
    await assert.rejects(data.collection(orders).countDocuments(), /hosted App is not ready/);
    assert.equal(await data.collection(orders).countDocuments(), 0);
    assert.equal(mock.calls(ENSURE).length, 2);
  });

  it("writes seeds only for collections ensure created", async () => {
    const mock = mockUns({
      [ENSURE]: ensured({ alias: "orders", collectionId: "c-orders", status: "created" }, { alias: "lines", collectionId: "c-lines", status: "widened" }),
      "/uns/collections/c-orders/records:insertMany": ok({ insertedCount: 2, insertedIds: { 0: "o-1", 1: "o-2" }, status: "committed", replayed: false }),
    });
    await client(mock).ensure();
    const inserts = mock.sent.filter((entry) => entry.path.endsWith("records:insertMany"));
    assert.equal(inserts.length, 1);
    const { idempotencyKey, ...body } = inserts[0].body;
    assert.match(String(idempotencyKey), /^seed-[0-9a-f]{40}-0$/);
    assert.deepEqual(body, {
      collectionId: "c-orders",
      documents: [
        { id: "o-1", data: { code: "A-1", status: "OPEN" } },
        { id: "o-2", data: { code: "A-2", status: "DONE" } },
      ],
      ordered: true,
      atomic: true,
    });
  });

  it("writes large seeds in 200-document chunks and retries a chunk with the same key", async () => {
    const big = defineCollection({
      alias: "big",
      schema: z.object({ n: z.number().int() }),
      seed: Array.from({ length: 450 }, (_, n) => ({ _id: `b-${n}`, n })),
    });
    const mock = mockUns({
      [ENSURE]: ensured({ alias: "big", collectionId: "c-big", status: "created" }),
      "/uns/collections/c-big/records:insertMany": [
        ok({ insertedCount: 200 }),
        fail(503, "TEMPORARILY_UNAVAILABLE"),
        ok({ insertedCount: 200, replayed: true }),
        ok({ insertedCount: 50 }),
      ],
    });
    const errors: unknown[] = [];
    await client(mock, { collections: [big], logger: { ...silent, error: (...args: unknown[]) => errors.push(args) } }).ensure();
    const chunks = mock.calls("/uns/collections/c-big/records:insertMany");
    assert.deepEqual(chunks.map((entry) => (entry.body.documents as unknown[]).length), [200, 200, 200, 50]);
    assert.deepEqual(chunks.map((entry) => String(entry.body.idempotencyKey).split("-").pop()), ["0", "1", "1", "2"]);
    assert.equal((chunks[3].body.documents as { id: string }[])[0].id, "b-400");
    assert.equal(errors.length, 0);
  });

  it("logs a failed seed and keeps serving", async () => {
    const errors: unknown[] = [];
    const mock = mockUns({
      [ENSURE]: ensured({ alias: "orders", collectionId: "c-orders", status: "created" }, { alias: "lines", collectionId: "c-lines", status: "created" }),
      "/uns/collections/c-orders/records:insertMany": fail(409, "DUPLICATE_KEY"),
      "/uns/collections/c-lines/records:insertMany": ok({ insertedCount: 1, insertedIds: { 0: "l-1" } }),
    });
    const state = await client(mock, { logger: { ...silent, error: (...args: unknown[]) => errors.push(args) } }).ensure();
    assert.equal(state.collectionIds.get("lines"), "c-lines");
    assert.equal(errors.length, 1);
    assert.equal(mock.calls("/uns/collections/c-lines/records:insertMany").length, 1);
  });

  it("throws SCHEMA_CONFLICT in preview", async () => {
    const conflict = fail(409, "SCHEMA_CONFLICT", { conflicts: [{ alias: "orders", collectionId: "c-orders", path: "qty", reason: "integer vs string" }] });
    const mock = mockUns({ [ENSURE]: conflict });
    await assert.rejects(client(mock).ensure(), (error: unknown) => error instanceof DataError && error.code === "SCHEMA_CONFLICT" && /orders\.qty/.test(error.message));
  });

  it("serves conflicting collections by their existing ID in a deployment", async () => {
    const logged: unknown[] = [];
    const mock = mockUns({
      [ENSURE]: [
        fail(409, "SCHEMA_CONFLICT", { conflicts: [{ alias: "orders", collectionId: "c-orders", path: "qty", reason: "type" }] }),
        ensured({ alias: "lines", collectionId: "c-lines" }),
      ],
      "/uns/collections/c-orders/records:count": ok({ count: 3 }),
    });
    const data = client(mock, { environment: "deployed", logger: { ...silent, error: (...args: unknown[]) => logged.push(args) } });
    assert.equal(await data.collection(orders).countDocuments(), 3);
    const [first, retry] = mock.calls(ENSURE);
    assert.equal((first.body.collections as unknown[]).length, 2);
    assert.deepEqual((retry.body.collections as { alias: string }[]).map((item) => item.alias), ["lines"]);
    assert.equal(logged.length, 1);
  });

  it("keeps removing conflicting declarations until the rest ensures", async () => {
    const mock = mockUns({
      [ENSURE]: [
        fail(409, "SCHEMA_CONFLICT", { conflicts: [{ alias: "orders", collectionId: "c-orders", path: "qty" }] }),
        fail(409, "SCHEMA_CONFLICT", { conflicts: [{ alias: "lines", collectionId: "c-lines", path: "sku" }] }),
      ],
    });
    const state = await client(mock, { environment: "deployed" }).ensure();
    assert.equal(mock.calls(ENSURE).length, 2);
    assert.equal(state.collectionIds.get("orders"), "c-orders");
    assert.equal(state.collectionIds.get("lines"), "c-lines");

    const opaque = mockUns({ [ENSURE]: fail(409, "SCHEMA_CONFLICT", { conflicts: [] }) });
    await assert.rejects(client(opaque, { environment: "deployed" }).ensure(), (error: unknown) => error instanceof DataError && error.code === "SCHEMA_CONFLICT");
  });

  it("explains JOIN_UNSUPPORTED and DATA_RULE_FIELD conflicts like any SCHEMA_CONFLICT", async () => {
    const conflict = fail(409, "SCHEMA_CONFLICT", {
      conflicts: [
        { alias: "orders", collectionId: "c-orders", path: "", reason: "JOIN_UNSUPPORTED" },
        { alias: "lines", collectionId: "c-lines", path: "sku", reason: "DATA_RULE_FIELD" },
      ],
    });
    await assert.rejects(
      client(mockUns({ [ENSURE]: conflict })).ensure(),
      (error: unknown) =>
        error instanceof DataError &&
        error.code === "SCHEMA_CONFLICT" &&
        /orders: JOIN_UNSUPPORTED — .*schema:replace/.test(error.message) &&
        /lines\.sku: DATA_RULE_FIELD — .*data rule/.test(error.message),
    );

    const state = await client(mockUns({ [ENSURE]: conflict }), { environment: "deployed" }).ensure();
    assert.equal(state.collectionIds.get("orders"), "c-orders");
    assert.equal(state.collectionIds.get("lines"), "c-lines");
    assert.deepEqual(state.conflicts.map((entry) => entry.reason), ["JOIN_UNSUPPORTED", "DATA_RULE_FIELD"]);
  });

  it("logs ANNOTATION_NOT_APPLIED as a schema:replace hint without failing Preview", async () => {
    const logged = { info: [] as string[], warn: [] as string[] };
    const logger = { ...silent, info: (message: string) => logged.info.push(message), warn: (message: string) => logged.warn.push(message) };
    const mock = mockUns({
      [ENSURE]: ensured(
        {
          alias: "orders",
          collectionId: "c-orders",
          ignored: [
            { path: "", reason: "ANNOTATION_NOT_APPLIED", message: "Collection description is only set at creation" },
            { path: "status", reason: "ANNOTATION_NOT_APPLIED" },
            { path: "legacy", reason: "UNDECLARED_PROPERTY" },
          ],
        },
        { alias: "lines", collectionId: "c-lines" },
      ),
    });
    const state = await client(mock, { logger }).ensure();
    assert.equal(state.collectionIds.get("orders"), "c-orders");
    assert.equal(logged.warn.length, 1);
    assert.match(logged.warn[0], /not applied: orders, orders\.status\. Apply them with schema:replace .*npm run data:schema -- orders/);
    assert.equal(logged.info.length, 1);
    assert.match(logged.info[0], /legacy UNDECLARED_PROPERTY/);
    assert.doesNotMatch(logged.info[0], /status/);
  });

  it("sends the same annotations for an unchanged declaration, so ensure reports no annotation difference", () => {
    const declare = () =>
      defineCollection({
        alias: "tickets",
        description: "Support tickets",
        schema: z
          .object({
            title: z.string().describe("Short summary"),
            severity: z.enum(["LOW", "HIGH"]).describe("Triage level").optional(),
            steps: z.array(z.object({ note: z.string().describe("步骤说明") })),
          })
          .describe("One ticket"),
      });
    const first = compileCollection(declare());
    const second = compileCollection(declare());
    assert.deepEqual(second, first);
    assert.equal(first.description, "Support tickets");
    const record = first.recordSchema as { description?: string; properties: Record<string, { description?: string; items?: { properties: Record<string, { description?: string }> } }> };
    assert.equal(record.description, "One ticket");
    assert.equal(record.properties.title.description, "Short summary");
    assert.equal(record.properties.severity.description, "Triage level");
    assert.equal(record.properties.steps.items?.properties.note.description, "步骤说明");
    // No description declared → none sent; ensure only flags a non-empty declared description that differs.
    assert.equal("description" in compileCollection(defineCollection({ alias: "bare", schema: z.object({ a: z.string() }) })), false);
  });

  it("throws ensure warnings in preview after seeding, and only logs them when deployed", async () => {
    const reply = ensured(
      { alias: "orders", collectionId: "c-orders", status: "created" },
      { alias: "lines", collectionId: "c-lines", warnings: [{ code: "REQUIRED_NOT_ENFORCED", path: "sku" }] },
    );
    const seeds = { "/uns/collections/c-orders/records:insertMany": ok({ insertedCount: 2 }) };

    const preview = mockUns({ [ENSURE]: reply, ...seeds });
    await assert.rejects(client(preview).ensure(), (error: unknown) => error instanceof DataError && error.code === "SCHEMA_WARNINGS");
    assert.equal(preview.calls("/uns/collections/c-orders/records:insertMany").length, 1);

    const warnings: unknown[] = [];
    const deployed = mockUns({ [ENSURE]: reply, ...seeds });
    const state = await client(deployed, { environment: "deployed", logger: { ...silent, warn: (...args: unknown[]) => warnings.push(args) } }).ensure();
    assert.equal(state.collectionIds.get("lines"), "c-lines");
    assert.equal(warnings.length, 1);
  });

  it("surfaces APP_GRANT_REVOKED without retrying grants", async () => {
    const mock = mockUns({ [ENSURE]: fail(403, "APP_GRANT_REVOKED") });
    await assert.rejects(client(mock).collection(orders).countDocuments(), (error: unknown) => error instanceof DataError && error.code === "APP_GRANT_REVOKED" && error.status === 403);
  });

  it("rejects more than 64 declarations", () => {
    const many = Array.from({ length: 65 }, (_, n) => defineCollection({ alias: `c${n}`, schema: z.object({ a: z.string() }) }));
    assert.throws(() => client(mockUns({}), { collections: many }), /at most 64 collections/);
  });

  it("rejects undeclared collections", () => {
    const data = client(mockUns({}));
    assert.throws(() => data.collection("ghost"), /not declared/);
    const stray = defineCollection({ alias: "stray", schema: z.object({ a: z.string() }) });
    assert.throws(() => data.collection(stray), /missing from the `collections` list/);
  });
});

describe("stale collection recovery", () => {
  const RECREATED = ensured({ alias: "orders", collectionId: "c-orders-2", status: "created" }, { alias: "lines", collectionId: "c-lines" });
  const count = (n: number) => ok({ count: n });

  it("re-ensures, reseeds and retries once when the App grant went with the collection", async () => {
    const mock = mockUns({
      [ENSURE]: [BOTH_UNCHANGED, RECREATED],
      "/uns/collections/c-orders/records:count": NOT_GRANTED,
      "/uns/collections/c-orders-2/records:insertMany": ok({ insertedCount: 2 }),
      "/uns/collections/c-orders-2/records:count": count(2),
    });
    assert.equal(await client(mock).collection(orders).countDocuments(), 2);
    assert.equal(mock.calls(ENSURE).length, 2);
    assert.equal(mock.calls("/uns/collections/c-orders/records:count").length, 1);
    assert.equal(mock.calls("/uns/collections/c-orders-2/records:insertMany").length, 1, "created again → seeded again");
  });

  it("recovers from COLLECTION_NOT_FOUND (404 or 403), including $lookup targets and transactions", async () => {
    const moved = ensured({ alias: "orders", collectionId: "c-orders" }, { alias: "lines", collectionId: "c-lines-2" });
    const mock = mockUns({
      [ENSURE]: [BOTH_UNCHANGED, moved],
      "/uns/collections/c-orders/records:aggregate": (sent) => {
        const lookup = (sent.body.pipeline as { $lookup?: { collectionId: string } }[])[0].$lookup!;
        return lookup.collectionId === "c-lines" ? GONE : ok({ items: [{ n: 1 }], pageInfo: { hasMore: false } });
      },
    });
    const data = client(mock);
    const rows = await data
      .collection(orders)
      .aggregate([{ $lookup: { from: lines, localField: "_id", foreignField: "orderId", as: "lines" } }, { $group: { _id: null, n: { $sum: 1 } } }])
      .toArray();
    assert.deepEqual(rows, [{ n: 1 }]);
    assert.equal(mock.calls(ENSURE).length, 2);

    const tx = mockUns({
      [ENSURE]: [BOTH_UNCHANGED, moved],
      "/uns/records:transact": (sent) =>
        (sent.body.items as { collectionId: string }[])[0].collectionId === "c-lines-2"
          ? ok({ status: "committed", results: [] })
          : // Not granted and gone: UNS answers 403 with COLLECTION_NOT_FOUND.
            fault(403, "FORBIDDEN", "App has no permission for this Collection operation", { reason: "COLLECTION_NOT_FOUND", collectionId: "c-lines" }),
    });
    await client(tx).transact([{ opId: "a", action: "record.create", collection: lines, data: { orderId: "o-1", sku: "S" } }]);
    assert.deepEqual(
      tx.calls("/uns/records:transact").map((sent) => (sent.body.items as { collectionId: string }[])[0].collectionId),
      ["c-lines", "c-lines-2"],
    );
  });

  it("does not retry when the rebuild changes no collection ID, nor without a stale-collection data.reason", async () => {
    const unchanged = mockUns({ [ENSURE]: BOTH_UNCHANGED, "/uns/collections/c-orders/records:count": NOT_GRANTED });
    await assert.rejects(client(unchanged).collection(orders).countDocuments(), (error: unknown) => error instanceof DataError && error.status === 403);
    assert.equal(unchanged.calls(ENSURE).length, 2);
    assert.equal(unchanged.calls("/uns/collections/c-orders/records:count").length, 1);

    for (const reply of [
      fault(404, "NOT_FOUND", "record filter matched no records"),
      fault(403, "FORBIDDEN", "employee cannot access this Record"),
      fault(403, "APP_GRANT_REVOKED", "an administrator revoked this App's grant for the Collection", { reason: "GRANT_REVOKED" }),
      NO_UNS_DELETE,
      // The message text alone no longer triggers a rebuild.
      fault(403, "FORBIDDEN", "App has no permission for this Collection operation"),
    ]) {
      const mock = mockUns({ [ENSURE]: BOTH_UNCHANGED, "/uns/collections/c-orders/records:count": reply });
      await assert.rejects(client(mock).collection(orders).countDocuments());
      assert.equal(mock.calls(ENSURE).length, 1, JSON.stringify(reply.body.data));
    }
  });

  it("surfaces APP_GRANT_REVOKED from the rebuild", async () => {
    const mock = mockUns({
      [ENSURE]: [BOTH_UNCHANGED, fail(403, "APP_GRANT_REVOKED")],
      "/uns/collections/c-orders/records:count": NOT_GRANTED,
    });
    await assert.rejects(client(mock).collection(orders).countDocuments(), (error: unknown) => error instanceof DataError && error.code === "APP_GRANT_REVOKED");
  });

  it("shares one rebuild between concurrent failures and rebuilds at most once per interval", async () => {
    testMock.timers.enable({ apis: ["Date"], now: 1_000_000 });
    try {
      const mock = mockUns({ [ENSURE]: BOTH_UNCHANGED, "/uns/collections/c-orders/records:count": NOT_GRANTED });
      const data = client(mock);
      const handle = data.collection(orders);
      await Promise.allSettled([handle.countDocuments(), handle.countDocuments(), handle.countDocuments()]);
      assert.equal(mock.calls(ENSURE).length, 2, "one initial ensure plus one shared rebuild");
      await assert.rejects(handle.countDocuments());
      assert.equal(mock.calls(ENSURE).length, 2, "inside the interval: no rebuild");
      testMock.timers.tick(REBUILD_INTERVAL_MS);
      await assert.rejects(handle.countDocuments());
      assert.equal(mock.calls(ENSURE).length, 3);
    } finally {
      testMock.timers.reset();
    }
  });

  it("rebuilds but does not retry a call that continues an old cursor", async () => {
    const mock = mockUns({
      [ENSURE]: [BOTH_UNCHANGED, RECREATED],
      "/uns/collections/c-orders/records:find": [
        ok({ items: [{ id: "o-1", data: { code: "A", status: "OPEN" }, revision: 1 }], pageInfo: { hasMore: true, nextCursor: "k1" } }),
        NOT_GRANTED,
      ],
      "/uns/collections/c-orders-2/records:insertMany": ok({ insertedCount: 2 }),
    });
    const data = client(mock);
    await assert.rejects(data.collection(orders).find({}, { limit: 400 }).toArray(), (error: unknown) => error instanceof DataError && error.status === 403);
    assert.equal(mock.calls(ENSURE).length, 2);
    assert.equal(mock.calls("/uns/collections/c-orders-2/records:find").length, 0);
  });
});

describe("collection operations", () => {
  const record = (id: string, data: Record<string, unknown>) => ({ id, collectionId: "c-orders", data, revision: 2, createdAt: 1, updatedAt: 5, sourceId: null, sourceTime: null });

  it("pages find() through nextCursor and flattens records", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records:find": [
        ok({ items: [record("o-1", { code: "A", status: "OPEN" }), record("o-2", { code: "B", status: "OPEN" })], pageInfo: { hasMore: true, nextCursor: "n1" } }),
        ok({ items: [record("o-3", { code: "C", status: "OPEN" })], pageInfo: { hasMore: false, nextCursor: null } }),
      ],
    });
    const docs = await client(mock).collection(orders).find({ status: "OPEN" }).sort({ code: -1 }).limit(3).toArray();
    assert.deepEqual(docs[0], { code: "A", status: "OPEN", _id: "o-1", _meta: { revision: 2, createdAt: 1, updatedAt: 5 } });
    assert.deepEqual(docs.map((doc) => doc._id), ["o-1", "o-2", "o-3"]);
    const [first, second] = mock.calls("/uns/collections/c-orders/records:find");
    assert.deepEqual(first.body, { collectionId: "c-orders", filter: { status: "OPEN" }, sort: [["code", -1]], limit: 3 });
    assert.deepEqual(second.body, { collectionId: "c-orders", filter: { status: "OPEN" }, sort: [["code", -1]], limit: 3, cursor: "n1" });
  });

  it("stops at the limit and returns findOne as null when empty", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records:find": ok({ items: [], pageInfo: { hasMore: false } }),
    });
    assert.equal(await client(mock).collection(orders).findOne({ _id: "missing" }), null);
    assert.equal(mock.calls("/uns/collections/c-orders/records:find")[0].body.limit, 1);
  });

  it("serves numbered pages through aggregate offset paging plus count", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records:aggregate": ok({ items: [{ _id: "o-3", code: "C", status: "OPEN", _meta: { revision: 1 } }], pageInfo: { hasMore: false } }),
      "/uns/collections/c-orders/records:count": ok({ count: 21 }),
    });
    const page = await client(mock).collection(orders).findPage({ status: "OPEN" }, { sort: { "_meta.createdAt": -1 }, page: 2, pageSize: 20 });
    assert.equal(page.total, 21);
    assert.equal(page.items[0]._id, "o-3");
    assert.deepEqual(mock.calls("/uns/collections/c-orders/records:aggregate")[0].body, {
      collectionId: "c-orders",
      pipeline: [{ $match: { status: "OPEN" } }, { $sort: [["_meta.createdAt", -1]] }],
      page: { mode: "offset", page: 2, size: 20 },
    });
  });

  it("collects every distinct page", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records:distinct": [ok({ values: ["OPEN"], pageInfo: { hasMore: true, nextPage: 2 } }), ok({ values: ["DONE"], pageInfo: { hasMore: false } })],
    });
    assert.deepEqual(await client(mock).collection(orders).distinct("status"), ["OPEN", "DONE"]);
  });

  it("pages transformed aggregates by offset and converts $sort objects", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records:aggregate": [
        ok({ items: [{ _id: "OPEN", total: 2 }], pageInfo: { mode: "offset", hasMore: true, nextPage: 2, nextCursor: null } }),
        ok({ items: [{ _id: "DONE", total: 1 }], pageInfo: { mode: "offset", hasMore: false, nextPage: null, nextCursor: null } }),
      ],
    });
    const rows = await client(mock).collection(orders).aggregate([{ $group: { _id: "$status", total: { $sum: 1 } } }, { $sort: { total: -1 } }]).toArray();
    assert.deepEqual(rows, [{ _id: "OPEN", total: 2 }, { _id: "DONE", total: 1 }]);
    const [first, second] = mock.calls("/uns/collections/c-orders/records:aggregate");
    assert.deepEqual(first.body.pipeline, [{ $group: { _id: "$status", total: { $sum: 1 } } }, { $sort: [["total", -1]] }]);
    assert.deepEqual(first.body.page, { mode: "offset", page: 1, size: 200 });
    assert.deepEqual(second.body.page, { mode: "offset", page: 2, size: 200 });
  });

  it("pages $match/$sort-only aggregates by cursor and sends no page for a final $count", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records:aggregate": [
        ok({ items: [{ _id: "o-1" }], pageInfo: { mode: "cursor", hasMore: true, nextCursor: "k1", nextPage: null } }),
        ok({ items: [{ _id: "o-2" }], pageInfo: { mode: "cursor", hasMore: false, nextCursor: null, nextPage: null } }),
        ok({ items: [{ open: 2 }], pageInfo: { hasMore: false } }),
      ],
    });
    const handle = client(mock).collection(orders);
    const rows = await handle.aggregate([{ $match: { status: "OPEN" } }, { $sort: { code: 1 } }]).toArray();
    assert.deepEqual(rows.map((row) => row._id), ["o-1", "o-2"]);
    assert.deepEqual(await handle.aggregate([{ $match: { status: "OPEN" } }, { $count: "open" }]).toArray(), [{ open: 2 }]);
    const [first, second, count] = mock.calls("/uns/collections/c-orders/records:aggregate");
    assert.deepEqual(first.body.page, { mode: "cursor", size: 200 });
    assert.deepEqual(second.body.page, { mode: "cursor", size: 200, cursor: "k1" });
    assert.equal(count.body.page, undefined);
  });

  it("resolves $lookup.from to the declared collection ID", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records:aggregate": ok({ items: [], pageInfo: { hasMore: false } }),
    });
    const handle = client(mock).collection(orders);
    await handle
      .aggregate([{ $lookup: { from: lines, localField: "_id", foreignField: "orderId", as: "lines", pipeline: [{ $sort: { sku: 1 } }] } }])
      .toArray();
    assert.deepEqual(mock.calls("/uns/collections/c-orders/records:aggregate")[0].body.pipeline, [
      { $lookup: { collectionId: "c-lines", localField: "_id", foreignField: "orderId", as: "lines", pipeline: [{ $sort: [["sku", 1]] }] } },
    ]);
    await assert.rejects(handle.aggregate([{ $lookup: { from: "ghost", localField: "a", foreignField: "b", as: "c" } }]).toArray(), /not declared/);
  });

  it("validates before writing and sends UNS write bodies", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records": ok({ insertedId: "o-9", status: "committed", replayed: false }),
      "/uns/collections/c-orders/records:updateOne": ok({ matchedCount: 1, modifiedCount: 1, status: "committed", replayed: false }),
      "/uns/collections/c-orders/records:findOneAndUpdate": ok({ value: record("o-9", { code: "A", status: "DONE" }), status: "committed", replayed: false }),
    });
    const handle = client(mock).collection(orders);
    await assert.rejects(handle.insertOne({ code: "A", status: "OPEN", colour: "red" } as never), z.ZodError);
    assert.equal(mock.calls("/uns/collections/c-orders/records").length, 0);

    assert.deepEqual(await handle.insertOne({ _id: "o-9", code: "A", status: "OPEN" }), { insertedId: "o-9" });
    assert.deepEqual(mock.calls("/uns/collections/c-orders/records")[0].body, { collectionId: "c-orders", id: "o-9", data: { code: "A", status: "OPEN" } });

    await handle.updateOne({ _id: "o-9" }, { $set: { status: "DONE" }, $inc: { qty: 1 } }, { expectedRevision: 2 });
    assert.deepEqual(mock.calls("/uns/collections/c-orders/records:updateOne")[0].body, {
      collectionId: "c-orders",
      filter: { _id: "o-9" },
      update: { $set: { status: "DONE" }, $inc: { qty: 1 } },
      expectedRevision: 2,
    });

    const moved = await handle.findOneAndUpdate({ _id: "o-9", status: "OPEN" }, { $set: { status: "DONE" } });
    assert.equal(moved?.status, "DONE");
    assert.equal(mock.calls("/uns/collections/c-orders/records:findOneAndUpdate")[0].body.returnDocument, "after");
  });

  it("runs updateMany and deleteMany non-atomically through resumeAfter", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records:updateMany": [
        ok({ matchedCount: 2, modifiedCount: 2, hasMore: true, resumeAfter: "r1" }),
        ok({ matchedCount: 1, modifiedCount: 1, hasMore: false }),
        ok({ matchedCount: 1, modifiedCount: 1, hasMore: false, writeErrors: [{ index: 1, code: "SCHEMA_MISMATCH" }] }),
      ],
      "/uns/collections/c-orders/records:deleteMany": ok({ deletedCount: 4, hasMore: false }),
    });
    const handle = client(mock).collection(orders);
    assert.deepEqual(await handle.updateMany({ status: "OPEN" }, { $set: { status: "DONE" } }), { matchedCount: 3, modifiedCount: 3 });
    const calls = mock.calls("/uns/collections/c-orders/records:updateMany");
    assert.equal(calls[0].body.atomic, false);
    assert.equal(calls[1].body.resumeAfter, "r1");
    await assert.rejects(
      handle.updateMany({ status: "OPEN" }, { $set: { status: "DONE" } }),
      (error: unknown) => error instanceof DataError && error.code === "WRITE_ERRORS" && /already committed: matchedCount=1, modifiedCount=1/.test(error.message),
    );
    assert.deepEqual(await handle.deleteMany({ status: "DONE" }), { deletedCount: 4 });
    assert.equal(mock.calls("/uns/collections/c-orders/records:deleteMany")[0].body.atomic, false);
  });

  it("rejects atomic batches over 200 items before sending", async () => {
    const mock = mockUns({ [ENSURE]: BOTH_UNCHANGED });
    const data = client(mock);
    const docs = Array.from({ length: 201 }, (_, n) => ({ code: `C-${n}`, status: "OPEN" as const }));
    const tooLarge = (error: unknown) => error instanceof DataError && error.code === "BATCH_LIMIT_EXCEEDED" && /chunks of 200/.test(error.message);
    await assert.rejects(data.collection(orders).insertMany(docs), tooLarge);
    await assert.rejects(data.collection(orders).bulkWrite(docs.map((document) => ({ insertOne: { document } }))), tooLarge);
    await assert.rejects(
      data.transact(docs.map((document, n) => ({ opId: `c${n}`, action: "record.create" as const, collection: orders, data: document }))),
      tooLarge,
    );
    assert.equal(mock.sent.filter((entry) => entry.path !== ENSURE).length, 0);
  });

  it("maps Mongo bulkWrite operations", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/collections/c-orders/records:bulkWrite": ok({ insertedCount: 1, matchedCount: 1, modifiedCount: 1, deletedCount: 1, upsertedCount: 0, insertedIds: { 0: "o-5" }, upsertedIds: {} }),
    });
    const result = await client(mock).collection(orders).bulkWrite([
      { insertOne: { document: { _id: "o-5", code: "E", status: "OPEN" } } },
      { updateOne: { filter: { _id: "o-1" }, update: { $set: { status: "DONE" } } } },
      { deleteOne: { filter: { _id: "o-2" } } },
    ]);
    assert.deepEqual(result.insertedIds, { 0: "o-5" });
    assert.deepEqual(mock.calls("/uns/collections/c-orders/records:bulkWrite")[0].body.operations, [
      { insertOne: { id: "o-5", data: { code: "E", status: "OPEN" } } },
      { updateOne: { filter: { _id: "o-1" }, update: { $set: { status: "DONE" } } } },
      { deleteOne: { filter: { _id: "o-2" } } },
    ]);
  });

  it("runs transactions synchronously with resolved collection IDs", async () => {
    const mock = mockUns({
      [ENSURE]: BOTH_UNCHANGED,
      "/uns/records:transact": [
        ok({ status: "committed", replayed: false, results: [{ opId: "create", action: "record.create", id: "l-9", status: "committed", document: record("l-9", { orderId: "o-1", sku: "S" }) }] }),
        ok({ status: "failed", replayed: false, results: [{ opId: "check", action: "record.check", id: "o-1", status: "failed", error: { code: "CHECK_FAILED" } }] }),
      ],
    });
    const data = client(mock);
    const result = await data.transact([
      { opId: "check", action: "record.check", collection: orders, filter: { _id: "o-1", status: "OPEN" } },
      { opId: "create", action: "record.create", collection: "lines", id: "l-9", data: { orderId: "o-1", sku: "S" }, dependsOn: ["check"] },
    ]);
    assert.equal(result.results[0].document?._id, "l-9");
    const body = mock.calls("/uns/records:transact")[0].body;
    assert.equal(body.mode, "sync");
    assert.deepEqual(body.items, [
      { opId: "check", action: "record.check", collectionId: "c-orders", filter: { _id: "o-1", status: "OPEN" } },
      { opId: "create", action: "record.create", collectionId: "c-lines", id: "l-9", data: { orderId: "o-1", sku: "S" }, dependsOn: ["check"] },
    ]);
    await assert.rejects(
      data.transact([{ opId: "check", action: "record.check", collection: orders, filter: { _id: "o-1" } }]),
      (error: unknown) => error instanceof DataError && error.code === "TRANSACTION_FAILED" && /CHECK_FAILED/.test(error.message),
    );
  });
});

describe("transaction step validation", () => {
  const data = () => client(mockUns({ [ENSURE]: BOTH_UNCHANGED, "/uns/records:transact": ok({ status: "committed", results: [] }) }));

  it("rejects _id in step data and points to id", async () => {
    await assert.rejects(
      data().transact([{ opId: "c", action: "record.create", collection: orders, data: { _id: "o-1", code: "A", status: "OPEN" } }]),
      (error: unknown) => error instanceof z.ZodError && /with `id`/.test(error.message),
    );
  });

  it("validates literal fields of a step with bindings and lets bound fields through", async () => {
    const step = (fields: Record<string, unknown>) => [
      { opId: "read", action: "record.read" as const, collection: orders, id: "o-1" },
      {
        opId: "line",
        action: "record.create" as const,
        collection: lines,
        data: fields,
        bindings: [{ path: "data.orderId", ref: "read", resultPath: "id" }],
        dependsOn: ["read"],
      },
    ];
    const client = data();
    await client.transact(step({ sku: "S" }));
    await assert.rejects(client.transact(step({ sku: 5 })), z.ZodError);
    await assert.rejects(client.transact(step({ sku: "S", colour: "red" })), /Unknown field/);
    await assert.rejects(client.transact(step({})), z.ZodError);
  });

  it("passes record.query count expectations through", async () => {
    const mock = mockUns({ [ENSURE]: BOTH_UNCHANGED, "/uns/records:transact": ok({ status: "committed", results: [] }) });
    await client(mock).transact([
      { opId: "q", action: "record.query", collection: orders, query: { filter: { code: "A" }, sort: { code: 1 }, expectCount: { min: 1, max: 1 } } },
    ]);
    assert.deepEqual((mock.calls("/uns/records:transact")[0].body.items as Record<string, unknown>[])[0].query, {
      filter: { code: "A" },
      sort: [["code", 1]],
      expectCount: { min: 1, max: 1 },
    });
  });
});

describe("data subject", () => {
  const routes = () => ({
    [ENSURE]: BOTH_UNCHANGED,
    "/uns/collections/c-orders/records:count": ok({ count: 1 }),
    "/uns/collections/c-orders/records:insertMany": ok({ insertedCount: 0 }),
  });
  const subjectOf = (entry: Sent) => entry.headers[DATA_SUBJECT_HEADER.toLowerCase()];

  it("forwards the request's subject to record calls but never to ensure", async () => {
    const mock = mockUns(routes());
    const data = client(mock);
    const headers = new Headers({ [DATA_SUBJECT_HEADER]: "jwt-subject" });
    await runWithRequestContext(headers, () => data.collection(orders).countDocuments());
    assert.equal(subjectOf(mock.calls(ENSURE)[0]), undefined);
    assert.equal(subjectOf(mock.calls("/uns/collections/c-orders/records:count")[0]), "jwt-subject");
  });

  it("keeps the subject per request across concurrent async work", async () => {
    const mock = mockUns(routes());
    const data = client(mock);
    await data.ensure();
    await Promise.all(
      ["s-1", "s-2", "s-3"].map((subject) =>
        runWithRequestContext(new Headers({ [DATA_SUBJECT_HEADER]: subject }), async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return data.collection(orders).countDocuments({ by: subject });
        }),
      ),
    );
    for (const entry of mock.calls("/uns/collections/c-orders/records:count")) {
      assert.equal(subjectOf(entry), (entry.body.filter as { by: string }).by);
    }
  });

  it("opens the request context in src/start.ts for every path, including /_serverFn", async () => {
    const serve = (path: string, headers: Record<string, string>) =>
      (authBridge.options.server as unknown as (context: { request: Request; pathname: string; next: () => Promise<unknown> }) => Promise<unknown>)({
        request: new Request(`http://app.local${path}`, { headers }),
        pathname: path,
        next: async () => currentDataSubject(),
      });
    assert.equal(await serve("/_serverFn/abc", { [DATA_SUBJECT_HEADER]: "jwt-fn" }), "jwt-fn");
    assert.equal(
      await serve("/api/orders", { [DATA_SUBJECT_HEADER]: "jwt-api", "X-App-User-ID": "u1", "X-Tier0-Runtime": "deployed", "X-Tier0-Business-Roles": "" }),
      "jwt-api",
    );
    assert.equal(await serve("/_serverFn/abc", {}), undefined);
  });

  it("omits the subject outside requests, in runAsApp and for seeds", async () => {
    const mock = mockUns({ ...routes(), [ENSURE]: ensured({ alias: "orders", collectionId: "c-orders", status: "created" }, { alias: "lines", collectionId: "c-lines" }) });
    const data = client(mock);
    await runWithRequestContext(new Headers({ [DATA_SUBJECT_HEADER]: "jwt" }), async () => {
      await data.collection(orders).countDocuments();
      await runAsApp(() => data.collection(orders).countDocuments());
    });
    await data.collection(orders).countDocuments();
    const counts = mock.calls("/uns/collections/c-orders/records:count").map(subjectOf);
    assert.deepEqual(counts, ["jwt", undefined, undefined]);
    assert.equal(subjectOf(mock.calls("/uns/collections/c-orders/records:insertMany")[0]), undefined);
  });
});
