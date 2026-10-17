import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  appCollectionChanges,
  appCollectionId,
  appCollectionPrefix,
  defineAppCollection,
  ensureAppCollection,
  resetAppCollection,
  UnsError,
} from "./uns.server";

type Call = { method: string; path: string; body?: any };

/** Minimal in-memory UNS: collections + records, enough for the app-collection helpers. */
function fakeUns() {
  const calls: Call[] = [];
  const collections = new Map<string, any>();
  const records = new Map<string, Map<string, any>>();
  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const err = (status: number, code: string) => json(status, { error: { code, message: code } });

  const fetchImpl = async (input: string | URL | Request, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    const path = url.pathname.replace(/^\/openapi\/uns\/v1/, "");
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: path + url.search, body });
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    if (parts[0] !== "collections") return err(404, "not_found");
    if (parts.length === 1 && method === "POST") {
      if (collections.has(body.id)) return err(409, "conflict");
      const c = { ...body, ownerApp: "app-uuid", revision: 1, schemaVersion: 1 };
      collections.set(body.id, c);
      records.set(body.id, new Map());
      return json(201, c);
    }
    const id = parts[1];
    const c = collections.get(id);
    if (parts.length === 2) {
      if (!c) return err(404, "not_found");
      if (method === "GET") return json(200, { ...c, recordCount: records.get(id)!.size });
      if (method === "PATCH") {
        if (body.revision && body.revision !== c.revision) return err(409, "conflict");
        const next = { ...c };
        for (const [k, v] of Object.entries(body)) {
          if (k === "revision") continue;
          if (v === null) delete next[k];
          else next[k] = v;
        }
        next.revision = c.revision + 1;
        collections.set(id, next);
        return json(200, next);
      }
      if (method === "DELETE") {
        if (records.get(id)!.size > 0 && url.searchParams.get("purge") !== "true") return err(409, "not_empty");
        collections.delete(id);
        records.delete(id);
        return new Response(null, { status: 204 });
      }
    }
    if (!c) return err(404, "not_found");
    const rows = records.get(id)!;
    if (parts.length === 3 && method === "POST") {
      if (rows.has(body.id)) return err(409, "conflict");
      const r = { id: body.id, data: body.data, revision: 1, createdAt: 1, updatedAt: 1 };
      rows.set(body.id, r);
      return json(201, r);
    }
    if (parts.length === 3 && method === "GET") return json(200, { items: [...rows.values()], total: rows.size });
    const rid = parts[3];
    const r = rows.get(rid);
    if (method === "GET") return r ? json(200, r) : err(404, "not_found");
    if (method === "PUT") {
      if (!r) return err(404, "not_found");
      if (body.revision && body.revision !== r.revision) return err(409, "conflict");
      const next = { ...r, data: body.data, revision: r.revision + 1 };
      rows.set(rid, next);
      return json(200, next);
    }
    return err(400, "bad_request");
  };
  return { calls, collections, records, fetchImpl };
}

const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = ["TIER0_API_HOST", "TIER0_API_KEY", "TIER0_APP_COLLECTION_PREFIX", "APP_ID"] as const;
let savedEnv: Record<string, string | undefined> = {};
let uns: ReturnType<typeof fakeUns>;

describe("app-owned collections", () => {
  beforeEach(() => {
    savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
    process.env.TIER0_API_HOST = "http://gw.test";
    process.env.TIER0_API_KEY = "sk-app-test";
    process.env.TIER0_APP_COLLECTION_PREFIX = "app.7bdba8039b80.";
    delete process.env.APP_ID;
    uns = fakeUns();
    globalThis.fetch = uns.fetchImpl as typeof fetch;
  });
  afterEach(async () => {
    globalThis.fetch = ORIGINAL_FETCH;
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it("derives ids from the injected prefix, else from the App UUID, else fails clearly", () => {
    assert.equal(appCollectionId("orders"), "app.7bdba8039b80.orders");
    assert.equal(appCollectionId("app.7bdba8039b80.orders"), "app.7bdba8039b80.orders");
    assert.throws(() => appCollectionId("bad name"), UnsError);
    assert.equal(
      appCollectionPrefix({ APP_ID: "7BDBA803-9B80-4c1e-9a2b-0123456789ab" } as NodeJS.ProcessEnv),
      "app.7bdba8039b80.",
    );
    assert.throws(() => appCollectionPrefix({ APP_ID: "local-app" } as NodeJS.ProcessEnv), /not configured/);
    assert.throws(() => appCollectionPrefix({ TIER0_APP_COLLECTION_PREFIX: "app.x" } as NodeJS.ProcessEnv), /malformed/);
  });

  it("detects definition changes but ignores server-managed fields and UNS normalization", () => {
    const def = {
      recordSchema: { type: "object" as const, properties: { code: { type: "string" as const, nullable: false } }, required: [] },
      indexes: [],
    };
    const stored = {
      id: "app.7bdba8039b80.orders",
      name: "orders",
      recordMode: "merge" as const,
      recordSchema: { type: "object" as const, properties: { code: { type: "string" as const } }, "x-order": ["code"] } as any,
      ownerApp: "app-uuid",
      revision: 4,
      recordCount: 2,
    };
    assert.deepEqual(appCollectionChanges("orders", def, stored), {});
    const changed = appCollectionChanges("orders", { ...def, indexes: ["code"] }, stored);
    assert.deepEqual(changed, { indexes: ["code"] });
    assert.deepEqual(appCollectionChanges("orders", def, { ...stored, sampleSchema: { type: "object" } }), { sampleSchema: null });
  });

  it("creates, then patches a changed definition, and resets with purge", async () => {
    const v1 = { recordSchema: { type: "object" as const, properties: { code: { type: "string" as const } } } };
    await ensureAppCollection("orders", v1);
    assert.equal(uns.collections.get("app.7bdba8039b80.orders").name, "orders");
    await ensureAppCollection("orders", v1); // memoized: no further requests
    assert.equal(uns.calls.length, 2); // GET 404 + POST

    await ensureAppCollection("orders", { ...v1, indexes: ["code"] });
    const patch = uns.calls.find((c) => c.method === "PATCH");
    assert.deepEqual(patch?.body, { indexes: ["code"], revision: 1 });

    await resetAppCollection("orders");
    assert.ok(uns.calls.some((c) => c.method === "DELETE" && c.path.endsWith("?purge=true")));
    assert.equal(uns.collections.has("app.7bdba8039b80.orders"), false);
    await resetAppCollection("orders"); // already gone: no error
  });

  it("treats a 409 create race as existing", async () => {
    const def = { recordSchema: { type: "object" as const } };
    const realFetch = uns.fetchImpl;
    let raced = false;
    globalThis.fetch = (async (input: any, init: any = {}) => {
      if (!raced && init.method === "POST") {
        raced = true; // another process wins the create between our GET and POST
        await realFetch("http://gw.test/openapi/uns/v1/collections", {
          method: "POST",
          body: JSON.stringify({ id: "app.7bdba8039b80.race", name: "race", recordMode: "merge", recordSchema: { type: "object" } }),
        });
      }
      return realFetch(input, init);
    }) as typeof fetch;
    const c = await ensureAppCollection("race", def);
    assert.equal(c.id, "app.7bdba8039b80.race");
  });

  it("seeds an empty collection with fixed ids and updates with revision retries", async () => {
    type Order = { code: string; status: string };
    const orders = defineAppCollection<Order>(
      "orders2",
      { recordSchema: { type: "object", properties: { code: { type: "string" }, status: { type: "string" } } } },
      { seed: () => [{ id: "WO-1", data: { code: "WO-1", status: "DRAFT" } }, { id: "WO-2", data: { code: "WO-2", status: "DRAFT" } }] },
    );
    const { items } = await orders.list();
    assert.deepEqual(items.map((r) => r.id).sort(), ["WO-1", "WO-2"]);

    let bumped = false;
    const updated = await orders.update("WO-1", (cur) => {
      if (!bumped) {
        bumped = true; // concurrent writer bumps the revision once
        const rows = uns.records.get("app.7bdba8039b80.orders2")!;
        const r = rows.get("WO-1");
        rows.set("WO-1", { ...r, revision: r.revision + 1 });
      }
      return { ...cur, status: "RELEASED" };
    });
    assert.equal(updated.data.status, "RELEASED");
    await assert.rejects(orders.update("missing", (cur) => cur), (e: unknown) => e instanceof UnsError && e.status === 404);
  });
});
