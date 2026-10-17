import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { HttpError, withErrors } from "./route-handlers";
import { applyUnsChange } from "./uns-live";
import type { UnsChange, UnsRecord } from "./uns-types";
import {
  appCollection,
  appCollectionChanges,
  collection,
  countRecords,
  defineAppCollection,
  deleteManyAll,
  distinctValues,
  ensureAppCollection,
  etagOf,
  findOneAndUpdateRecord,
  findRecords,
  insertManyRecords,
  isUnsError,
  iterateRecords,
  lookupOf,
  parseSubscribeRequest,
  patchRecord,
  putRecord,
  resetAppCollection,
  subscribeUpstream,
  transact,
  updateManyAll,
  updateManyRecords,
  UnsError,
} from "./uns.server";

// Document API of the UNS server client (records:find / update operators /
// locks / transact / SSE), tested against a scripted fetch.

type Call = { method: string; path: string; query: URLSearchParams; headers: Headers; body?: any };
type Reply = { status?: number; body?: unknown; headers?: Record<string, string> } | ((call: Call) => Response | Promise<Response>);

const PREFIX = "app.7bdba8039b80.";
const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = ["TIER0_API_HOST", "TIER0_API_KEY", "TIER0_APP_COLLECTION_PREFIX", "APP_ID"] as const;

let savedEnv: Record<string, string | undefined> = {};
let calls: Call[] = [];
let replies: Reply[] = [];

function json(status: number, body?: unknown, headers: Record<string, string> = {}) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/** Queue the next responses (in order). */
function reply(...r: Reply[]) {
  replies.push(...r);
}

function installFetch() {
  globalThis.fetch = (async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const call: Call = {
      method: init.method ?? "GET",
      path: decodeURIComponent(url.pathname.replace(/^\/openapi\/uns\/v1/, "")),
      query: url.searchParams,
      headers: new Headers(init.headers),
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const next = replies.shift();
    if (!next) throw new Error(`unexpected request ${call.method} ${call.path}`);
    if (typeof next === "function") return next(call);
    return json(next.status ?? 200, next.body, next.headers);
  }) as typeof fetch;
}

const rec = <D>(id: string, data: D, revision = 1): UnsRecord<D> => ({ id, data, revision, createdAt: 1000, updatedAt: 2000 });

beforeEach(() => {
  savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.TIER0_API_HOST = "http://gw.test/";
  process.env.TIER0_API_KEY = "sk-app-test";
  process.env.TIER0_APP_COLLECTION_PREFIX = PREFIX;
  delete process.env.APP_ID;
  calls = [];
  replies = [];
  installFetch();
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
  assert.equal(replies.length, 0, "every scripted reply was consumed");
});

describe("document queries", () => {
  it("posts find with only the given options and the app key", async () => {
    reply({ body: { items: [rec("WO-1", { status: "open" })], nextCursor: "c2" } });
    const page = await findRecords<{ status: string }>("work_orders", {
      filter: { status: { $in: ["open", "released"] }, "line.code": "L1" },
      sort: [["dueAt", 1]],
      limit: 50,
      cursor: undefined,
    });
    assert.equal(page.items[0].data.status, "open");
    assert.equal(page.nextCursor, "c2");
    const [c] = calls;
    assert.equal(c.method, "POST");
    assert.equal(c.path, "/collections/work_orders/records:find");
    assert.equal(c.headers.get("Authorization"), "Bearer sk-app-test");
    assert.deepEqual(c.body, { filter: { status: { $in: ["open", "released"] }, "line.code": "L1" }, sort: [["dueAt", 1]], limit: 50 });
  });

  it("iterates pages by cursor and stops at max", async () => {
    reply({ body: { items: [rec("a", {}), rec("b", {})], nextCursor: "n1" } }, { body: { items: [rec("c", {}), rec("d", {})], nextCursor: "n2" } });
    const ids: string[] = [];
    for await (const r of iterateRecords("c1", { filter: { x: 1 }, limit: 2, max: 3 })) ids.push(r.id);
    assert.deepEqual(ids, ["a", "b", "c"]);
    assert.equal(calls[1].body.cursor, "n1");
    assert.deepEqual(calls[1].body.filter, { x: 1 });
  });

  it("counts, lists distinct values and reads lookups", async () => {
    reply({ body: { count: 7, capped: false } }, { body: { values: ["L1", "L2"], truncated: false } });
    assert.deepEqual(await countRecords("c1", { status: "open" }), { count: 7, capped: false });
    assert.deepEqual((await distinctValues<string>("c1", "line")).values, ["L1", "L2"]);
    assert.deepEqual(calls[0].body, { filter: { status: "open" } });
    assert.deepEqual(calls[1].body, { field: "line" });

    const withJoin = { ...rec("o1", {}), lookups: { customer: [rec("C-1", { name: "ACME" })], customerTruncated: true } };
    const joined = lookupOf<{ name: string }>(withJoin, "customer");
    assert.equal(joined.items[0].data.name, "ACME");
    assert.equal(joined.truncated, true);
    assert.deepEqual(lookupOf(rec("o2", {}), "customer"), { items: [], truncated: false });
  });

  it("collection(id) is a read-only handle", async () => {
    const machines = collection<{ line: string }>("equipment");
    assert.equal(machines.id, "equipment");
    assert.equal("updateOne" in machines, false);
    reply({ body: { items: [rec("m1", { line: "L1" })] } });
    const first = await machines.findOne({ line: "L1" }, { sort: [["name", 1]] });
    assert.equal(first?.id, "m1");
    assert.deepEqual(calls[0].body, { filter: { line: "L1" }, sort: [["name", 1]], limit: 1 });
  });
});

describe("errors keep the UNS code", () => {
  it("maps 423 locked with holder details", async () => {
    reply({ status: 423, body: { error: { code: "locked", message: "record is leased", lockedUntil: 1760000000000, lockPrincipal: "user:7", id: "WO-1" } } });
    const err = await findOneAndUpdateRecord("c1", { _id: "WO-1" }, { $set: { a: 1 } }).catch((e) => e);
    assert.ok(err instanceof UnsError);
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 423);
    assert.equal(err.code, "locked");
    assert.equal(err.lockedUntil, 1760000000000);
    assert.equal(err.lockPrincipal, "user:7");
    assert.ok(isUnsError(err, "locked"));
    assert.ok(isUnsError(err, 423));
    assert.equal(isUnsError(err, "lock_lost"), false);
  });

  it("keeps duplicate_key, precondition_failed and lock_lost; hides platform auth errors as 502", async () => {
    reply(
      { status: 409, body: { error: { code: "duplicate_key", message: "dup" } } },
      { status: 412, body: { error: { code: "precondition_failed", message: "etag" } } },
      { status: 409, body: { error: { code: "lock_lost", message: "lost" } } },
      { status: 403, body: { error: { code: "forbidden", message: "not your collection" } } },
    );
    const codes: Array<[number, string, number]> = [];
    for (const run of [
      () => insertManyRecords("c1", [{ id: "x", data: {} }]),
      () => patchRecord("c1", "x", {}, { ifMatch: '"1.1"' }),
      () => updateManyRecords("c1", { a: 1 }, { $set: { b: 2 } }),
      () => findRecords("other"),
    ]) {
      const e = (await run().catch((x) => x)) as UnsError;
      codes.push([e.status, e.code, e.upstreamStatus]);
    }
    assert.deepEqual(codes, [
      [409, "duplicate_key", 409],
      [412, "precondition_failed", 412],
      [409, "lock_lost", 409],
      [502, "forbidden", 403],
    ]);
  });

  it("carries partial batch results and op index", async () => {
    reply(
      { status: 409, body: { error: { code: "duplicate_key", message: "dup" }, matchedCount: 3, modifiedCount: 2, writeErrors: [{ index: 2, code: "duplicate_key", message: "dup" }] } },
      { status: 409, body: { error: { code: "precondition_failed", message: "op 1 matched nothing", index: 1 }, results: [{ matchedCount: 1, modifiedCount: 1 }] } },
    );
    const e1 = (await updateManyRecords("c1", {}, { $inc: { n: 1 } }, { ordered: false }).catch((e) => e)) as UnsError;
    assert.equal(e1.details.modifiedCount, 2);
    assert.equal(e1.writeErrors[0].index, 2);
    const e2 = (await transact([{ collection: "a", op: "deleteOne", filter: { _id: "x" }, require: "matched" }]).catch((e) => e)) as UnsError;
    assert.equal(e2.code, "precondition_failed");
    assert.equal(e2.opIndex, 1);
    assert.ok(Array.isArray(e2.details.results));
  });

  it("withErrors forwards the code to the browser", async () => {
    const handler = withErrors(async () => {
      throw new UnsError(423, "locked", "Being edited by someone else");
    });
    const res = await handler();
    assert.equal(res.status, 423);
    assert.deepEqual(await res.json(), { error: "Being edited by someone else", code: "locked" });
  });
});

describe("write headers", () => {
  it("sends If-Match, If-None-Match, lock tokens and idempotency keys", async () => {
    reply({ body: rec("x", {}) }, { body: rec("x", {}) }, { body: { insertedCount: 1, insertedIds: ["01J"] } });
    assert.equal(etagOf({ createdAt: 5, revision: 3 }), '"5.3"');
    await patchRecord("c1", "x", { a: 1 }, { ifMatch: { createdAt: 5, revision: 3 }, lockToken: "tok" });
    await putRecord("c1", "x", { a: 1 }, { ifNoneMatch: "*" });
    await insertManyRecords("c1", [{ data: { a: 1 } }], { idempotencyKey: "req-1" });
    assert.equal(calls[0].headers.get("If-Match"), '"5.3"');
    assert.equal(calls[0].headers.get("X-Tier0-Lock-Token"), "tok");
    assert.deepEqual(calls[0].body, { data: { a: 1 } });
    assert.equal(calls[1].headers.get("If-None-Match"), "*");
    assert.equal(calls[1].headers.has("If-Match"), false);
    assert.equal(calls[2].headers.get("Idempotency-Key"), "req-1");
  });
});

describe("resumable bulk writes", () => {
  it("follows resumeAfter until done and sums the counts", async () => {
    reply(
      { body: { matchedCount: 10000, modifiedCount: 9990, lockedCount: 10, hasMore: true, resumeAfter: "r1" } },
      { body: { matchedCount: 5, modifiedCount: 5 } },
    );
    const progress: number[] = [];
    const totals = await updateManyAll("c1", { status: "open" }, { $set: { status: "closed" } }, { onProgress: (t) => progress.push(t.rounds) });
    assert.deepEqual(totals, { matchedCount: 10005, modifiedCount: 9995, deletedCount: 0, lockedCount: 10, rounds: 2, hasMore: false, resumeAfter: undefined });
    assert.deepEqual(progress, [1, 2]);
    assert.equal(calls[0].body.resumeAfter, undefined);
    assert.equal(calls[1].body.resumeAfter, "r1");
    assert.deepEqual(calls[1].body.filter, { status: "open" });
  });

  it("stops at maxRounds with the resume position, and reports totals on failure", async () => {
    reply({ body: { matchedCount: 2, deletedCount: 2, hasMore: true, resumeAfter: "r1" } });
    const partial = await deleteManyAll("c1", { old: true }, { maxRounds: 1, maxDocs: 2 });
    assert.equal(partial.hasMore, true);
    assert.equal(partial.resumeAfter, "r1");
    assert.equal(partial.deletedCount, 2);
    assert.equal(calls[0].body.maxDocs, 2);

    reply({ body: { matchedCount: 1, deletedCount: 1, hasMore: true, resumeAfter: "r2" } }, { status: 429, body: { error: { code: "too_many_requests", message: "slow down" } } });
    const err = (await deleteManyAll("c1", { old: true }, { resumeAfter: "r1" }).catch((e) => e)) as UnsError;
    assert.equal(err.code, "too_many_requests");
    assert.equal(calls[1].body.resumeAfter, "r1");
    assert.equal(calls[2].body.resumeAfter, "r2");
    assert.deepEqual((err.details.totals as { deletedCount: number }).deletedCount, 1);
  });
});

describe("app collection handles", () => {
  type Order = { code: string; status: string; qty?: number };

  it("appCollection(name) resolves the prefixed id and wraps every document call", async () => {
    const orders = appCollection<Order>("orders");
    assert.equal(orders.id, `${PREFIX}orders`);
    reply(
      { body: { value: rec("O-1", { code: "O-1", status: "released" }, 2) } },
      { body: { insertedCount: 1, insertedIds: ["O-2"] } },
      { body: { matchedCount: 1, modifiedCount: 1, upsertedId: "01J" } },
      { body: { locks: [{ id: "O-1", token: "t1", fence: 4, expiresAt: 99, record: rec("O-1", { code: "O-1", status: "released" }) }] } },
      { body: { locks: [{ id: "O-1", expiresAt: 199 }] } },
      { body: { released: 1 } },
      { body: { matchedCount: 3, capped: false, sampleIds: ["a"], plan: "index" } },
      { body: { deletedCount: 1 } },
      { body: { items: [{ _id: "open", n: 2 }] } },
    );
    const released = await orders.findOneAndUpdate({ _id: "O-1", status: "draft" }, { $set: { status: "released" } }, { returnDocument: "after" });
    assert.equal(released?.data.status, "released");
    assert.deepEqual(await orders.insertOne({ code: "O-2", status: "draft" }, { id: "O-2" }), { insertedId: "O-2" });
    await orders.updateOne({ code: "O-3" }, { $setOnInsert: { status: "draft" }, $inc: { qty: 1 } }, { upsert: true });
    const [lease] = await orders.lock({ ids: ["O-1"], ttlMs: 30000, label: "editing" });
    await orders.renew([{ id: lease.id, token: lease.token }], 60000);
    await orders.unlock([{ id: lease.id, token: lease.token }]);
    await orders.explain("deleteMany", { status: "draft" });
    await orders.deleteOne({ _id: "O-2" }, { lockToken: "t9", release: true });
    const { items } = await orders.aggregate<{ _id: string; n: number }>([{ $group: { _id: "$status", n: { $count: {} } } }]);
    assert.equal(items[0].n, 2);

    const base = `/collections/${PREFIX}orders/records:`;
    assert.deepEqual(
      calls.map((c) => c.path),
      ["findOneAndUpdate", "insertMany", "updateOne", "lock", "renew", "unlock", "explain", "deleteOne", "aggregate"].map((v) => base + v),
    );
    assert.deepEqual(calls[0].body, { filter: { _id: "O-1", status: "draft" }, update: { $set: { status: "released" } }, returnDocument: "after" });
    assert.deepEqual(calls[1].body, { documents: [{ id: "O-2", data: { code: "O-2", status: "draft" } }] });
    assert.deepEqual(calls[2].body.upsert, true);
    assert.deepEqual(calls[3].body, { ids: ["O-1"], ttlMs: 30000, label: "editing" });
    assert.deepEqual(calls[4].body, { locks: [{ id: "O-1", token: "t1" }], ttlMs: 60000 });
    assert.deepEqual(calls[5].body, { locks: [{ id: "O-1", token: "t1" }] });
    assert.deepEqual(calls[6].body, { op: "deleteMany", filter: { status: "draft" } });
    assert.deepEqual(calls[7].body, { filter: { _id: "O-2" }, lockToken: "t9", release: true });
  });

  it("findOneAndUpdate returns null when nothing matched; claim mode sends filter + sort + limit", async () => {
    const queue = appCollection<Order>("jobs");
    reply({ body: { value: null } }, { body: { locks: [] } });
    assert.equal(await queue.findOneAndUpdate({ _id: "J-1", status: "pending" }, { $set: { status: "running" } }), null);
    assert.deepEqual(await queue.lock({ filter: { status: "pending" }, sort: [["priority", -1]], limit: 5, ttlMs: 60000 }), []);
    assert.deepEqual(calls[1].body, { filter: { status: "pending" }, sort: [["priority", -1]], limit: 5, ttlMs: 60000 });
  });

  it("transact sends every op and assertLocks", async () => {
    reply({ body: { results: [{ matchedCount: 1, modifiedCount: 1 }, { insertedId: "E-1" }] } });
    const res = await transact(
      [
        { collection: `${PREFIX}orders`, op: "updateOne", filter: { _id: "O-1", status: "paid" }, update: { $set: { status: "shipped" } }, require: "matched" },
        { collection: `${PREFIX}events`, op: "insertOne", document: { data: { type: "shipped" } } },
      ],
      { assertLocks: [{ collection: `${PREFIX}locks`, id: "daily", token: "t" }], idempotencyKey: "ship-O-1" },
    );
    assert.equal(res.results.length, 2);
    assert.equal(calls[0].path, "/transact");
    assert.equal(calls[0].body.ops[0].require, "matched");
    assert.equal(calls[0].body.assertLocks[0].id, "daily");
    assert.equal(calls[0].headers.get("Idempotency-Key"), "ship-O-1");
  });

  it("defineAppCollection handles ensure the definition before document calls", async () => {
    const tickets = defineAppCollection<Order>("tickets", { recordSchema: { type: "object" } });
    reply(
      { status: 404, body: { error: { code: "not_found", message: "nope" } } }, // GET collection
      { status: 201, body: { id: `${PREFIX}tickets`, name: "tickets", recordSchema: { type: "object" }, revision: 1 } }, // POST
      { body: { items: [], nextCursor: undefined } }, // find
      { body: { count: 0, capped: false } }, // count (ready memoized)
    );
    await tickets.find({ filter: { status: "open" } });
    await tickets.count();
    assert.deepEqual(
      calls.map((c) => `${c.method} ${c.path}`),
      [`GET /collections/${PREFIX}tickets`, "POST /collections", `POST /collections/${PREFIX}tickets/records:find`, `POST /collections/${PREFIX}tickets/records:count`],
    );
    await resetAppCollectionQuietly("tickets");
  });
});

async function resetAppCollectionQuietly(name: string) {
  reply({ status: 204 });
  await resetAppCollection(name);
}

describe("object-form indexes", () => {
  it("compares indexes the way UNS stores them", () => {
    const stored = { recordSchema: { type: "object" as const }, recordMode: "merge" as const, name: "orders", indexes: [{ path: "code", unique: true }, "status"] };
    assert.deepEqual(
      appCollectionChanges("orders", { recordSchema: { type: "object" }, indexes: [{ path: "code", unique: true, kind: "btree", expireAfterMs: 0 }, "status"] }, stored),
      {},
    );
    assert.deepEqual(appCollectionChanges("orders", { recordSchema: { type: "object" }, indexes: [{ paths: ["code"], unique: true }, "status"] }, stored), {});
    const changed = appCollectionChanges("orders", { recordSchema: { type: "object" }, indexes: [{ path: "code" }, "status"] }, stored);
    assert.deepEqual(changed, { indexes: [{ path: "code" }, "status"] });
  });

  it("waits until new indexes are ready so an upsert right after works", async () => {
    const def = { recordSchema: { type: "object" as const }, indexes: [{ path: "code", unique: true }] };
    const view = (state: string) => ({ id: `${PREFIX}skus`, name: "skus", recordSchema: { type: "object" }, indexes: def.indexes, revision: 1, indexStatus: [{ path: "code", unique: true, state }] });
    reply(
      { status: 404, body: { error: { code: "not_found", message: "nope" } } },
      { status: 201, body: { id: `${PREFIX}skus`, name: "skus", recordSchema: { type: "object" }, revision: 1 } },
      { body: view("building") },
      { body: view("ready") },
    );
    const c = await ensureAppCollection("skus", def);
    assert.equal(c.indexStatus?.[0].state, "ready");
    assert.equal(calls.length, 4);
    await resetAppCollectionQuietly("skus");
  });

  it("fails clearly when a unique index cannot be built", async () => {
    const def = { recordSchema: { type: "object" as const }, indexes: [{ path: "code", unique: true }] };
    reply({
      body: {
        id: `${PREFIX}dups`,
        name: "dups",
        recordSchema: { type: "object" },
        recordMode: "merge",
        indexes: def.indexes,
        revision: 3,
        indexStatus: [{ path: "code", unique: true, state: "failed", error: 'duplicate value "A-1"' }],
      },
    });
    const err = (await ensureAppCollection("dups", def).catch((e) => e)) as UnsError;
    assert.equal(err.code, "index_failed");
    assert.match(err.message, /duplicate value "A-1"/);
  });
});

describe("live changes", () => {
  it("forwards kinds, filter and Last-Event-ID upstream and passes the stream through unchanged", async () => {
    const stream = 'id: 41\nevent: change\ndata: {"kind":"record","full":true}\n\nevent: reset\ndata: {"reason":"slow_consumer"}\nid: 42\n\n';
    reply(() => new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } }));
    const res = await subscribeUpstream({ collections: ["c1"], kinds: ["record", "delete", "leave"], filter: { status: "open" }, lastEventId: "40", coalesceMs: 500 });
    assert.equal(await res.text(), stream);
    assert.equal(res.headers.get("Content-Type"), "text/event-stream");
    const [c] = calls;
    assert.equal(c.path, "/subscribe");
    assert.equal(c.query.get("kinds"), "record,delete,leave");
    assert.equal(c.query.get("filter"), '{"status":"open"}');
    assert.equal(c.query.get("coalesce"), "500");
    assert.equal(c.headers.get("Last-Event-ID"), "40");
  });

  it("keeps the upstream error code of a refused subscription", async () => {
    reply({ status: 400, body: { error: { code: "bad_request", message: "filter needs exactly one collection in collections=" } } });
    const err = (await subscribeUpstream({ collections: ["a", "b"], filter: "{}" }).catch((e) => e)) as UnsError;
    assert.equal(err.code, "bad_request");
    assert.equal(err.status, 400);
  });

  it("parses the browser subscribe request", () => {
    const p = parseSubscribeRequest(
      new URL("http://app/api/uns/subscribe?collections=c1&kinds=record,delete,lock,leave,bogus&filter=%7B%22a%22%3A1%7D&lastEventId=7"),
      new Headers({ "Last-Event-ID": "9" }),
    );
    assert.deepEqual(p, { collections: ["c1"], records: undefined, kinds: ["record", "delete", "lock", "leave"], coalesceMs: 1000, filter: '{"a":1}', lastEventId: "9" });
    const q = parseSubscribeRequest(new URL("http://app/x?collections=a,b&coalesce=50&lastEventId=12"), new Headers());
    assert.equal(q.coalesceMs, 200);
    assert.equal(q.lastEventId, "12");
    assert.equal(q.kinds, undefined);
    const bad = (search: string, headers?: Record<string, string>) => {
      assert.throws(() => parseSubscribeRequest(new URL(`http://app/x?${search}`), new Headers(headers)), (e: unknown) => e instanceof HttpError && e.status === 400);
    };
    bad("records=a");
    bad("collections=a,b&filter=%7B%7D");
    bad("collections=a&filter=nope");
    bad("collections=a&filter=%5B1%5D");
    bad("collections=a", { "Last-Event-ID": "x; drop" });
  });

  it("applyUnsChange replaces full documents, merges partial ones and drops deleted / left records", () => {
    type T = { status: string; note?: string };
    const rows: UnsRecord<T>[] = [rec("a", { status: "open", note: "x" }, 3), rec("b", { status: "open" }, 1)];
    const ev = (e: Partial<UnsChange<T>> & Pick<UnsChange<T>, "kind">) => ({ collection: "c1", recordId: "a", time: 5000, ...e }) as UnsChange<T>;

    const full = applyUnsChange(rows, ev({ kind: "record", full: true, revision: 4, data: { status: "done" } }));
    assert.deepEqual(full[0].data, { status: "done" }); // note removed by $unset is gone
    assert.equal(full[0].revision, 4);
    assert.equal(full[0].updatedAt, 5000);

    const merged = applyUnsChange(rows, ev({ kind: "record", revision: 4, data: { status: "done" } }));
    assert.deepEqual(merged[0].data, { status: "done", note: "x" });

    assert.equal(applyUnsChange(rows, ev({ kind: "record", full: true, revision: 2, data: { status: "old" } })), rows); // stale
    assert.equal(applyUnsChange(rows, ev({ kind: "record", full: true, data: { status: "x" } }), { collection: "other" }), rows);

    const added = applyUnsChange(rows, ev({ kind: "record", full: true, recordId: "c", revision: 1, data: { status: "new" } }));
    assert.deepEqual(added.map((r) => r.id), ["c", "a", "b"]);
    assert.deepEqual(applyUnsChange(rows, ev({ kind: "record", full: true, recordId: "c", data: { status: "new" } }), { insert: "end" }).map((r) => r.id), ["a", "b", "c"]);
    assert.equal(applyUnsChange(rows, ev({ kind: "record", full: true, recordId: "c", data: { status: "new" } }), { insert: false }), rows);
    assert.equal(applyUnsChange(rows, ev({ kind: "record", recordId: "c", data: { status: "partial" } })), rows); // partial unknown: ignored

    assert.deepEqual(applyUnsChange(rows, ev({ kind: "delete" })).map((r) => r.id), ["b"]);
    assert.deepEqual(applyUnsChange(rows, ev({ kind: "leave", recordId: "b" })).map((r) => r.id), ["a"]);
    assert.equal(applyUnsChange(rows, ev({ kind: "delete", recordId: "zz" })), rows);

    const locked = applyUnsChange(rows, ev({ kind: "lock", data: { principal: "user:1", label: "editing", expiresAt: 9, fence: 2 } }));
    assert.equal(locked[0].lock?.label, "editing");
    assert.equal(applyUnsChange(locked, ev({ kind: "lock", data: null }))[0].lock, null);

    const sampled = applyUnsChange(applyUnsChange(rows, ev({ kind: "sample", data: { temp: 20 } })), ev({ kind: "sample", time: 6000, data: { rpm: 5 } }));
    assert.deepEqual(sampled[0].latest, { time: 6000, quality: undefined, data: { temp: 20, rpm: 5 } });
  });
});
