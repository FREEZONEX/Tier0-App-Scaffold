/**
 * Tier0 UNS v2 server client — the only supported way for an app to read and
 * write platform data (collections, records, samples, latest values).
 *
 * - Server-only: it uses the platform-injected `TIER0_API_HOST` and app key
 *   `TIER0_API_KEY`. Call it from route handlers (`createFileRoute(...).server`)
 *   or `createServerFn` handlers, never from browser code.
 * - Never connect to the platform database or its UNS tables directly; the API
 *   validates schemas, keeps revisions / latest values and emits change events.
 * - The app key (`sk-app-`) may only use data endpoints. It can read every
 *   collection, record, sample and the topic tree of the workspace, but it can
 *   only create, change, purge, write and lock the app's OWN collections — ids
 *   that start with `TIER0_APP_COLLECTION_PREFIX` (`app.<appKey>.`). Every
 *   other collection is read-only for the app (403). It cannot change sources,
 *   streams or workspace settings.
 * - App business data (orders, approvals, form submissions…) lives in
 *   app-owned collections: declare them with `defineAppCollection()` (or
 *   `ensureAppCollection()` + `appCollection()`), then use the MongoDB-style
 *   handle: `find` / `findOne` / `count` / `aggregate` (with `lookup` joins),
 *   `insertOne` / `updateOne` (`$set`, `$inc`, upsert) / `findOneAndUpdate`
 *   (state transitions, counters), `lock` (edit locks, work queues) and
 *   `transact()` for atomic writes across collections. There is no app database.
 * - Other collections: `collection(id)` is a read-only handle with the same
 *   query methods.
 * - Controlling devices (lights, valves, setpoints): `sendCommand()` sends a
 *   command to the device behind a record of a `commandable` collection; the
 *   device acknowledges and reports its new state through the normal data flow.
 * - Live updates: `subscribeUpstream()` returns the SSE stream; expose it with
 *   `src/routes/api/uns/subscribe.ts` and consume it in the browser with
 *   `useUnsChanges()` from `@/lib/uns-live`.
 *
 * All times are Unix milliseconds. Errors throw `UnsError` (an `HttpError`, so
 * `withErrors` maps it to a JSON response) carrying the UNS error `code`
 * (`locked`, `duplicate_key`, `lock_lost`, `precondition_failed`, …).
 */
import { HttpError } from "./route-handlers";
import type {
  UnsAggregateResult,
  UnsAssertLock,
  UnsBucket,
  UnsBulkOp,
  UnsBulkResult,
  UnsChangeKind,
  UnsCollection,
  UnsCollectionInput,
  UnsCommand,
  UnsCommandStatus,
  UnsDeleteResult,
  UnsExplainResult,
  UnsFilter,
  UnsFindOneAndOptions,
  UnsFindOptions,
  UnsFindResult,
  UnsIndex,
  UnsInsertDocument,
  UnsInsertManyResult,
  UnsLatest,
  UnsLockGrant,
  UnsLockRef,
  UnsLockRequest,
  UnsManyOptions,
  UnsManyResult,
  UnsNode,
  UnsPipelineStage,
  UnsProjection,
  UnsRecord,
  UnsRecordQuery,
  UnsSample,
  UnsSeries,
  UnsSeriesQuery,
  UnsSort,
  UnsTime,
  UnsTransactOp,
  UnsTransactResult,
  UnsUpdate,
  UnsUpdateOneOptions,
  UnsUpdateResult,
  UnsWriteError,
  UnsWriteOneOptions,
} from "./uns-types";

export type * from "./uns-types";

const API_PREFIX = "/openapi/uns/v1";
const REQUEST_TIMEOUT_MS = 30_000;

// Upstream statuses passed through to the app's callers; platform auth or
// server problems become 502.
const PASS_THROUGH = [400, 404, 409, 412, 413, 422, 423, 429];

/**
 * Upstream UNS error. `code` is the UNS error code; the important ones:
 *
 * | status | code | meaning / what to do |
 * |---|---|---|
 * | 400 | `bad_request`, `bad_query`, `validation_failed`, `upsert_requires_unique_index`, `lookup_requires_index`, `too_many_documents` | fix the request |
 * | 403 | (`upstreamStatus`) | the app may not write this collection (not app-owned) |
 * | 404 | `not_found` | collection / record missing |
 * | 409 | `duplicate_key` | a unique index (or the id) already has this value |
 * | 409 | `conflict` | stale `revision` in the body |
 * | 409 | `precondition_failed` | a `transact` op with `require: "matched"` matched nothing (`opIndex`) |
 * | 409 | `lock_lost` | your lease expired or was taken over: abandon the work |
 * | 409 | `source_written`, `collection_not_writable`, `write_conflict` | not allowed on this collection now |
 * | 412 | `precondition_failed` | `If-Match` ETag no longer matches: reload |
 * | 413 | `document_too_large` | a document is over 1 MB |
 * | 423 | `locked` | someone else holds a lease (`lockedUntil`, `lockPrincipal`) |
 * | 429 | `too_many_requests` | back off and retry |
 *
 * `details` holds the extra fields of the error body and, for partly applied
 * batches, the counts of what was committed (`matchedCount`, `writeErrors`,
 * `results`, …).
 */
export class UnsError extends HttpError {
  readonly code: string;
  readonly upstreamStatus: number;
  readonly details: Record<string, unknown>;
  constructor(upstreamStatus: number, code: string, message: string, details: Record<string, unknown> = {}) {
    super(PASS_THROUGH.includes(upstreamStatus) ? upstreamStatus : 502, message);
    this.name = "UnsError";
    this.code = code;
    this.upstreamStatus = upstreamStatus;
    this.details = details;
  }
  /** 423 `locked`: when the other holder's lease expires (Unix ms). */
  get lockedUntil(): number | undefined {
    return typeof this.details.lockedUntil === "number" ? this.details.lockedUntil : undefined;
  }
  /** 423 `locked`: who holds the lease (`user:<id>`, `app:<id>`, `key:<id>`). */
  get lockPrincipal(): string | undefined {
    return typeof this.details.lockPrincipal === "string" ? this.details.lockPrincipal : undefined;
  }
  /** Index of the failing op (`bulkWrite`, `transact`). */
  get opIndex(): number | undefined {
    return typeof this.details.index === "number" ? this.details.index : undefined;
  }
  /** Per-document errors of a partly applied batch. */
  get writeErrors(): UnsWriteError[] {
    return Array.isArray(this.details.writeErrors) ? (this.details.writeErrors as UnsWriteError[]) : [];
  }
}

/** True when `e` is an `UnsError`, optionally with one of the given codes or upstream statuses. */
export function isUnsError(e: unknown, ...match: Array<string | number>): e is UnsError {
  if (!(e instanceof UnsError)) return false;
  return match.length === 0 || match.some((m) => (typeof m === "number" ? e.upstreamStatus === m : e.code === m));
}

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("@/lib/uns.server must only run on the server (route handler or server function).");
  }
}

/** True when the platform injected UNS credentials (preview sandbox or deployed runtime). */
export function isUnsConfigured(): boolean {
  return Boolean(process.env.TIER0_API_HOST && process.env.TIER0_API_KEY);
}

function config() {
  assertServerOnly();
  const host = process.env.TIER0_API_HOST?.replace(/\/+$/, "");
  const key = process.env.TIER0_API_KEY;
  if (!host || !key) {
    throw new UnsError(503, "not_configured", "UNS is not configured: TIER0_API_HOST / TIER0_API_KEY are injected by the platform at preview and deploy time");
  }
  return { base: host + API_PREFIX, key };
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Extra headers (`If-Match`, `X-Tier0-Lock-Token`, `Idempotency-Key`); undefined values are skipped. */
  headers?: Record<string, string | undefined>;
}

function buildUrl(base: string, path: string, query?: Query) {
  const url = new URL(base + path);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url;
}

/** Turns a non-2xx UNS response into an `UnsError`, keeping the code, extra fields and partial results. */
function errorFrom(status: number, statusText: string, text: string, json: unknown): UnsError {
  const body = (json && typeof json === "object" ? json : {}) as Record<string, unknown>;
  const err = body.error;
  if (err && typeof err === "object") {
    const { code, message, ...extra } = err as Record<string, unknown>;
    const partial: Record<string, unknown> = { ...body };
    delete partial.error;
    return new UnsError(status, typeof code === "string" ? code : "upstream_error", typeof message === "string" ? message : statusText, {
      ...partial,
      ...extra,
    });
  }
  return new UnsError(status, "upstream_error", typeof err === "string" ? err : text.slice(0, 300) || statusText);
}

async function send<T>(method: string, path: string, opts: RequestOptions = {}): Promise<{ data: T; headers: Headers }> {
  const { base, key } = config();
  const signal = opts.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  for (const [k, v] of Object.entries(opts.headers ?? {})) {
    if (v !== undefined && v !== "") headers[k] = v;
  }
  const res = await fetch(buildUrl(base, path, opts.query), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal,
  });
  if (res.status === 204) return { data: undefined as T, headers: res.headers };
  const text = await res.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // non-JSON body (gateway errors)
  }
  if (!res.ok) throw errorFrom(res.status, res.statusText, text, json);
  return { data: json as T, headers: res.headers };
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  return (await send<T>(method, path, opts)).data;
}

const enc = encodeURIComponent;

/** Drops undefined keys so the strict document endpoints never see them. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = v;
  return out as Partial<T>;
}

function recordQuery(q: UnsRecordQuery = {}): Query {
  const out: Query = { limit: q.limit, offset: q.offset, q: q.q, sort: q.sort, ids: q.ids?.join(",") };
  for (const [field, value] of Object.entries(q.filter ?? {})) {
    if (value === null || typeof value !== "object") {
      out[`filter.${field}`] = value as string | number | boolean;
      continue;
    }
    for (const [op, v] of Object.entries(value)) {
      if (v === undefined) continue;
      out[`filter.${field}.${op}`] = Array.isArray(v) ? v.join(",") : (v as string | number | boolean);
    }
  }
  return out;
}

// ---------------- collections ----------------

/** All collections of the workspace (with record counts). */
export async function listCollections(): Promise<UnsCollection[]> {
  return (await request<{ items: UnsCollection[] }>("GET", "/collections")).items;
}

/** One collection, including `indexStatus`. */
export async function getCollection(id: string): Promise<UnsCollection> {
  return request<UnsCollection>("GET", `/collections/${enc(id)}`);
}

/**
 * Low-level: create the collection if it does not exist yet; an existing
 * collection is returned unchanged. App keys may only create ids with the
 * app's prefix — prefer `ensureAppCollection(name, def)`, which also keeps the
 * definition up to date.
 */
export async function ensureCollection(def: UnsCollectionInput): Promise<UnsCollection> {
  try {
    return await getCollection(def.id);
  } catch (e) {
    if (!(e instanceof UnsError) || e.upstreamStatus !== 404) throw e;
  }
  try {
    return await request<UnsCollection>("POST", "/collections", { body: def });
  } catch (e) {
    if (e instanceof UnsError && e.upstreamStatus === 409) return getCollection(def.id);
    throw e;
  }
}

/**
 * Merge fields into a collection definition (top-level keys; `null` removes
 * one). Pass `revision` to fail with 409 on a concurrent change. App keys may
 * only change the app's own collections.
 */
export async function patchCollection(
  id: string,
  patch: Partial<Omit<UnsCollectionInput, "id">>,
  opts: { revision?: number } = {},
): Promise<UnsCollection> {
  return request("PATCH", `/collections/${enc(id)}`, { body: { ...patch, revision: opts.revision } });
}

/**
 * Delete a collection. Without `purge` the collection must be empty (409
 * `not_empty`); `purge: true` removes it together with all records and
 * samples. App keys may only delete the app's own collections.
 */
export async function deleteCollection(id: string, opts: { purge?: boolean } = {}): Promise<void> {
  await request("DELETE", `/collections/${enc(id)}`, { query: { purge: opts.purge ? "true" : undefined } });
}

// ---------------- records (simple REST) ----------------

/**
 * ETag of a record as the API sends it (`"<createdAt>.<revision>"`). Pass it
 * (or the record) as `ifMatch` to make a write fail with 412
 * `precondition_failed` when someone changed the record in between.
 */
export function etagOf(record: Pick<UnsRecord, "createdAt" | "revision">): string {
  return `"${record.createdAt}.${record.revision}"`;
}

/** Options of the simple record writes. */
export interface UnsRecordWriteOptions {
  /** Legacy optimistic lock: 409 `conflict` when the stored revision differs. */
  revision?: number;
  /** ETag (or the record you read): 412 `precondition_failed` when it changed. `"*"` = must exist. */
  ifMatch?: string | Pick<UnsRecord, "createdAt" | "revision">;
  /** Token of your lease on this record (required while it is leased, else 423 `locked`). */
  lockToken?: string;
}

function writeHeaders(opts: UnsRecordWriteOptions & { ifNoneMatch?: "*" }) {
  const ifMatch = typeof opts.ifMatch === "object" ? etagOf(opts.ifMatch) : opts.ifMatch;
  return { "If-Match": ifMatch, "If-None-Match": opts.ifNoneMatch, "X-Tier0-Lock-Token": opts.lockToken };
}

/**
 * Legacy list query: `filter: { status: "RUN", qty: { gte: 10 }, line: { in: ["L1", "L2"] } }`
 * (top-level ASCII fields, text comparison). Prefer `findRecords` (typed
 * filters, any path, cursor paging, joins).
 */
export async function listRecords<D = Record<string, unknown>>(
  collection: string,
  query: UnsRecordQuery = {},
): Promise<{ items: UnsRecord<D>[]; total: number }> {
  return request("GET", `/collections/${enc(collection)}/records`, { query: recordQuery(query) });
}

/** One record, or null when it does not exist. */
export async function getRecord<D = Record<string, unknown>>(collection: string, id: string): Promise<UnsRecord<D> | null> {
  try {
    return await request<UnsRecord<D>>("GET", `/collections/${enc(collection)}/records/${enc(id)}`);
  } catch (e) {
    if (e instanceof UnsError && e.upstreamStatus === 404) return null;
    throw e;
  }
}

/** Create a record with a known id; 409 when it exists. */
export async function createRecord<D = Record<string, unknown>>(collection: string, id: string, data: D): Promise<UnsRecord<D>> {
  return request("POST", `/collections/${enc(collection)}/records`, { body: { id, data } });
}

/** Merge fields into a record (creates it when missing). `revision` → 409, `ifMatch` → 412 on a concurrent change. */
export async function patchRecord<D = Record<string, unknown>>(
  collection: string,
  id: string,
  data: Partial<D>,
  opts: UnsRecordWriteOptions = {},
): Promise<UnsRecord<D>> {
  return request("PATCH", `/collections/${enc(collection)}/records/${enc(id)}`, {
    body: { data, revision: opts.revision },
    headers: writeHeaders(opts),
  });
}

/** Replace a record's data (creates it when missing). `ifNoneMatch: "*"` = create only (412 when it exists). */
export async function putRecord<D = Record<string, unknown>>(
  collection: string,
  id: string,
  data: D,
  opts: UnsRecordWriteOptions & { ifNoneMatch?: "*" } = {},
): Promise<UnsRecord<D>> {
  return request("PUT", `/collections/${enc(collection)}/records/${enc(id)}`, {
    body: { data, revision: opts.revision },
    headers: writeHeaders(opts),
  });
}

/** Soft-delete a record. */
export async function deleteRecord(collection: string, id: string, opts: UnsRecordWriteOptions = {}): Promise<void> {
  await request("DELETE", `/collections/${enc(collection)}/records/${enc(id)}`, {
    query: { revision: opts.revision },
    headers: writeHeaders(opts),
  });
}

// ---------------- samples & latest ----------------

/** Latest value of one record (latest sample, else the record itself); null when missing. */
export async function getLatest<D = Record<string, unknown>>(collection: string, record: string): Promise<UnsLatest<D> | null> {
  try {
    return await request<UnsLatest<D>>("GET", "/latest", { query: { collection, record } });
  } catch (e) {
    if (e instanceof UnsError && e.upstreamStatus === 404) return null;
    throw e;
  }
}

/** Latest sample of several records (all records with samples when `records` is omitted; at most 500 ids). */
export async function getLatestMany<D = Record<string, unknown>>(
  collection: string,
  records?: string[],
): Promise<Array<UnsLatest<D> & { recordId: string }>> {
  const res = await request<{ items: Array<UnsLatest<D> & { recordId: string }> }>("GET", "/latest", {
    query: { collection, records: records?.join(",") },
  });
  return res.items;
}

/** Raw samples of one record, newest first (default: last hour, 1000 points). */
export async function listSamples<D = Record<string, unknown>>(
  collection: string,
  record: string,
  opts: { from?: UnsTime; to?: UnsTime; limit?: number } = {},
): Promise<UnsSample<D>[]> {
  const res = await request<{ items: UnsSample<D>[] }>("GET", `/collections/${enc(collection)}/records/${enc(record)}/samples`, {
    query: { from: opts.from, to: opts.to, limit: opts.limit },
  });
  return res.items;
}

/** Aggregated series of one numeric field, oldest first. Counters: use `last - first` per bucket. */
export async function getSeries(
  collection: string,
  record: string,
  opts: { bucket: string; field?: string; from?: UnsTime; to?: UnsTime; limit?: number },
): Promise<UnsBucket[]> {
  const res = await request<{ items: UnsBucket[] }>("GET", `/collections/${enc(collection)}/records/${enc(record)}/samples`, {
    query: { bucket: opts.bucket, field: opts.field, from: opts.from, to: opts.to, limit: opts.limit },
  });
  return res.items;
}

/** Several records (and fields) in one call — for dashboards and charts. At most 100 series. */
export async function querySamples(query: UnsSeriesQuery): Promise<UnsSeries[]> {
  return (await request<{ items: UnsSeries[] }>("POST", "/samples:query", { body: query })).items;
}

/**
 * Append samples to a record (the collection needs a sampleSchema). Give each
 * sample an `id` to make retries idempotent. At most 10000 per call.
 */
export async function appendSamples<D = Record<string, unknown>>(
  collection: string,
  record: string,
  samples: Array<{ id?: string; time: number | string; data: D; quality?: string }>,
): Promise<{ accepted: number; inserted: number }> {
  return request("POST", `/collections/${enc(collection)}/records/${enc(record)}/samples`, { body: { samples } });
}

// ---------------- device commands ----------------

/** Statuses after which a command no longer changes (`sent` is final only for sources that do not wait for an acknowledgement). */
export const COMMAND_DONE: readonly UnsCommandStatus[] = ["acked", "failed", "timeout"];

/**
 * Send a command to the device behind a record — switch a light, set a
 * setpoint, start a pump. Only for collections with `commandable: true`
 * (check with `getCollection`); the record must exist.
 *
 * The record is **not** changed by the command: the device executes it,
 * acknowledges, and then reports its new state through the normal data flow
 * (record / sample change events). Show the command as pending in the UI and
 * take the device's reported state as the truth.
 *
 * `wait` (ms, max 30000) returns once the device answered; without it the
 * command comes back `sent` / `pending` — poll with `getCommand(id, { wait })`.
 * Allowed names and argument shapes are defined by the source instance (400
 * `validation_failed` when they do not match). Errors: 404 record missing,
 * 409 `not_commandable`, 429 too many commands.
 */
export async function sendCommand<A extends Record<string, unknown> = Record<string, unknown>>(
  collection: string,
  recordId: string,
  command: { name?: string; args?: A; wait?: number; timeoutMs?: number },
): Promise<UnsCommand<A>> {
  const wait = Math.min(Math.max(command.wait ?? 0, 0), 30000);
  return request("POST", `/collections/${enc(collection)}/records/${enc(recordId)}/commands`, {
    body: { name: command.name ?? "set", args: command.args ?? {}, timeoutMs: command.timeoutMs },
    query: { wait: wait || undefined },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS + wait),
  });
}

/** One command; with `wait` (ms, max 30000) it returns as soon as the command finishes. */
export async function getCommand(id: string, opts: { wait?: number } = {}): Promise<UnsCommand> {
  const wait = Math.min(Math.max(opts.wait ?? 0, 0), 30000);
  return request("GET", `/commands/${enc(id)}`, { query: { wait: wait || undefined }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS + wait) });
}

/** Recent commands of a record, newest first (default 20, max 200). */
export async function listCommands(collection: string, recordId: string, opts: { limit?: number; status?: UnsCommandStatus } = {}): Promise<UnsCommand[]> {
  return (await request<{ items: UnsCommand[] }>("GET", `/collections/${enc(collection)}/records/${enc(recordId)}/commands`, { query: opts })).items;
}

// ---------------- topic tree & search ----------------

export async function listNodes(): Promise<UnsNode[]> {
  return (await request<{ items: UnsNode[] }>("GET", "/nodes")).items;
}

/** Data of a topic: records (list topic) or current field values (field topic). */
export async function getNodeView(id: string, opts: { limit?: number; offset?: number } = {}): Promise<unknown> {
  return request("GET", `/nodes/${enc(id)}/view`, { query: opts });
}

export async function search(q: string, limit = 20): Promise<Array<{ kind: string; id: string; name: string; path?: string }>> {
  return (await request<{ items: Array<{ kind: string; id: string; name: string; path?: string }> }>("GET", "/search", { query: { q, limit } })).items;
}


/**
 * Delete samples of a collection in a time range (all records, or only
 * `records`). Needs delete rights: app keys only on the app's own collections.
 */
export async function deleteSamples(
  collection: string,
  range: { from: UnsTime; to: UnsTime; records?: string[] },
): Promise<UnsDeleteResult> {
  return request("POST", `/collections/${enc(collection)}/samples:delete`, { body: compact({ ...range }) });
}

// ---------------- documents (MongoDB-style) ----------------
//
// `POST /collections/{id}/records:<verb>` — query any collection, write only
// the app's own ones. Filters, update operators and the differences from
// MongoDB are documented on the types in `./uns-types` and in
// docs/uns-data.md ("Documents"). The handles below (`appCollection`,
// `defineAppCollection`, `collection`) wrap these functions.

const recordsPath = (collection: string, verb: string) => `/collections/${enc(collection)}/records:${verb}`;

/**
 * Query records with a MongoDB-style filter, projection, sort, cursor paging
 * and joins. Pages hold at most `limit` (default 20, max 1000) records; pass
 * `nextCursor` back as `cursor` for the next page.
 *
 * ```ts
 * const page = await findRecords<Order>(ordersId, {
 *   filter: { status: { $in: ["open", "released"] }, qty: { $gte: 10 } },
 *   sort: [["dueAt", 1]],
 *   limit: 50,
 *   lookup: [{ from: customersId, localField: "customerId", foreignField: "_id", as: "customer", limit: 1 }],
 * });
 * ```
 */
export async function findRecords<D = Record<string, unknown>>(collection: string, opts: UnsFindOptions<D> = {}): Promise<UnsFindResult<D>> {
  return request("POST", recordsPath(collection, "find"), { body: compact({ ...opts }) });
}

/** The first record matching `filter` (by `sort`), or null. */
export async function findOneRecord<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D> = {},
  opts: Pick<UnsFindOptions<D>, "projection" | "sort" | "lookup" | "withLatest"> = {},
): Promise<UnsRecord<D> | null> {
  const { items } = await findRecords<D>(collection, { ...opts, filter, limit: 1 });
  return items[0] ?? null;
}

/**
 * Every record matching the query, page by page (cursor paging). Stops after
 * `max` records (default 10000) so a broad filter cannot exhaust memory.
 *
 * ```ts
 * for await (const r of iterateRecords(id, { filter: { status: "open" }, limit: 500 })) { … }
 * ```
 */
export async function* iterateRecords<D = Record<string, unknown>>(
  collection: string,
  opts: Omit<UnsFindOptions<D>, "cursor" | "skip" | "count"> & { max?: number } = {},
): AsyncGenerator<UnsRecord<D>, void, undefined> {
  const { max = 10_000, ...query } = opts;
  let cursor: string | undefined;
  let seen = 0;
  do {
    const page = await findRecords<D>(collection, { ...query, cursor });
    for (const item of page.items) {
      if (seen++ >= max) return;
      yield item;
    }
    cursor = page.nextCursor;
  } while (cursor);
}

/** Number of matching records (capped at `limit`, default and max 100000; then `capped: true`). */
export async function countRecords<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D> = {},
  opts: { limit?: number } = {},
): Promise<{ count: number; capped: boolean }> {
  return request("POST", recordsPath(collection, "count"), { body: compact({ filter, limit: opts.limit }) });
}

/** Distinct values of a path (array values are unwound; default 1000, max 10000 values). */
export async function distinctValues<V = unknown, D = Record<string, unknown>>(
  collection: string,
  field: string,
  filter?: UnsFilter<D>,
  opts: { limit?: number } = {},
): Promise<{ values: V[]; truncated: boolean }> {
  return request("POST", recordsPath(collection, "distinct"), { body: compact({ field, filter, limit: opts.limit }) });
}

/**
 * Aggregation pipeline (`$match $group $sort $limit $skip $project $addFields
 * $count $unwind $lookup`, ≤ 16 stages, ≤ 10000 output documents). Documents
 * entering the pipeline look like `{ _id, _meta, ...data }`.
 *
 * ```ts
 * const perDay = await aggregateRecords<{ _id: number; qty: number }>(id, [
 *   { $match: { status: "done" } },
 *   { $group: { _id: { $dateTrunc: { date: "$doneAt", unit: "day", timezone: "Asia/Shanghai" } }, qty: { $sum: "$qty" } } },
 *   { $sort: { _id: 1 } },
 * ]);
 * ```
 */
export async function aggregateRecords<R = Record<string, unknown>>(collection: string, pipeline: UnsPipelineStage[]): Promise<UnsAggregateResult<R>> {
  return request("POST", recordsPath(collection, "aggregate"), { body: { pipeline } });
}

/** Dry run of a bulk write: how many documents `filter` matches (≤ 10000), sample ids, index or scan. */
export async function explainWrite<D = Record<string, unknown>>(
  collection: string,
  op: "updateMany" | "deleteMany" | "updateOne" | "deleteOne" | "replaceOne",
  filter: UnsFilter<D>,
): Promise<UnsExplainResult> {
  return request("POST", recordsPath(collection, "explain"), { body: { op, filter } });
}

/**
 * Insert documents (ids default to server ULIDs). A duplicate id or unique
 * value is 409 `duplicate_key`; with `ordered: false` the rest still go in and
 * the error carries `writeErrors` + `insertedIds`. Without ids, pass an
 * `idempotencyKey` so a retried request does not insert twice.
 */
export async function insertManyRecords<D = Record<string, unknown>>(
  collection: string,
  documents: ReadonlyArray<UnsInsertDocument<D>>,
  opts: { ordered?: boolean; idempotencyKey?: string } = {},
): Promise<UnsInsertManyResult> {
  return request("POST", recordsPath(collection, "insertMany"), {
    body: compact({ documents, ordered: opts.ordered }),
    headers: { "Idempotency-Key": opts.idempotencyKey },
  });
}

/** Insert one document (`opts.id`, default a ULID); returns its id. 409 `duplicate_key` when the id / a unique value exists. */
export async function insertOneRecord<D = Record<string, unknown>>(
  collection: string,
  data: D,
  opts: { id?: string; idempotencyKey?: string } = {},
): Promise<{ insertedId: string }> {
  const res = await insertManyRecords(collection, [{ id: opts.id, data }], { idempotencyKey: opts.idempotencyKey });
  return { insertedId: res.insertedIds[0] };
}

/**
 * Update the first matching document with operators — single-document
 * atomic. Typical: counters (`$inc`), status changes guarded by the filter
 * (`{ _id, status: "open" }` → `matchedCount: 0` when it moved on), natural-key
 * upserts (`upsert: true` + a unique index on the filter field).
 */
export async function updateOneRecord<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  update: UnsUpdate<D>,
  opts: UnsUpdateOneOptions = {},
): Promise<UnsUpdateResult> {
  return request("POST", recordsPath(collection, "updateOne"), { body: compact({ filter, update, ...opts }) });
}

/**
 * Update all matching documents in batches: each document is atomic, the
 * whole call is not. At most `maxDocs` (10000) per call — check `hasMore`
 * and pass `resumeAfter`, or use `updateManyAll`. Documents leased by others
 * are skipped (`lockedCount`).
 */
export async function updateManyRecords<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  update: UnsUpdate<D>,
  opts: UnsManyOptions & { arrayFilters?: Record<string, unknown>[] } = {},
): Promise<UnsManyResult> {
  return request("POST", recordsPath(collection, "updateMany"), { body: compact({ filter, update, ...opts }) });
}

/** Replace the data of the first matching document (no operators; use `updateOneRecord` for partial changes). */
export async function replaceOneRecord<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  replacement: D,
  opts: UnsUpdateOneOptions = {},
): Promise<UnsUpdateResult> {
  return request("POST", recordsPath(collection, "replaceOne"), { body: compact({ filter, replacement, ...opts }) });
}

/** Soft-delete the first matching document. */
export async function deleteOneRecord<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  opts: UnsWriteOneOptions & { sort?: UnsSort } = {},
): Promise<UnsDeleteResult> {
  return request("POST", recordsPath(collection, "deleteOne"), { body: compact({ filter, ...opts }) });
}

/** Soft-delete matching documents in batches (≤ `maxDocs` per call; see `deleteManyAll`). */
export async function deleteManyRecords<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  opts: Omit<UnsManyOptions, "ordered"> = {},
): Promise<UnsManyResult> {
  return request("POST", recordsPath(collection, "deleteMany"), { body: compact({ filter, ...opts }) });
}

/** Result of the `findOneAnd*` calls: the document (before or after) and the upserted id. */
export interface UnsFindOneAndResult<D = Record<string, unknown>> {
  value: UnsRecord<D> | null;
  upsertedId?: string;
}

/**
 * Atomically update one document and return it — the tool for state
 * transitions, stock / counters and "take the next number". `value` is null
 * when nothing matched (e.g. the status already moved on). `returnDocument`
 * defaults to `before`, like MongoDB; pass `after` to get the new state.
 *
 * ```ts
 * const { value } = await findOneAndUpdateRecord(stockId,
 *   { _id: "SKU-1", qty: { $gte: 3 } }, { $inc: { qty: -3 } }, { returnDocument: "after" });
 * if (!value) throw new HttpError(409, "Not enough stock");
 * ```
 */
export async function findOneAndUpdateRecord<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  update: UnsUpdate<D>,
  opts: UnsFindOneAndOptions = {},
): Promise<UnsFindOneAndResult<D>> {
  return request("POST", recordsPath(collection, "findOneAndUpdate"), { body: compact({ filter, update, ...opts }) });
}

/** Atomically replace one document and return it (`before` by default). */
export async function findOneAndReplaceRecord<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  replacement: D,
  opts: UnsFindOneAndOptions = {},
): Promise<UnsFindOneAndResult<D>> {
  return request("POST", recordsPath(collection, "findOneAndReplace"), { body: compact({ filter, replacement, ...opts }) });
}

/** Atomically delete one document and return it (null when nothing matched). */
export async function findOneAndDeleteRecord<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  opts: { sort?: UnsSort; projection?: UnsProjection; lockToken?: string; release?: boolean; assertLocks?: UnsAssertLock[] } = {},
): Promise<UnsFindOneAndResult<D>> {
  return request("POST", recordsPath(collection, "findOneAndDelete"), { body: compact({ filter, ...opts }) });
}

/**
 * Several writes on one collection in one call. Not atomic by default (each
 * document is); `atomic: true` runs everything in one transaction (≤ 1000
 * documents). `idempotencyKey` makes a retried call return the first result.
 */
export async function bulkWriteRecords<D = Record<string, unknown>>(
  collection: string,
  ops: ReadonlyArray<UnsBulkOp<D>>,
  opts: { ordered?: boolean; atomic?: boolean; lockTokens?: Record<string, string>; idempotencyKey?: string } = {},
): Promise<UnsBulkResult> {
  const { idempotencyKey, ...rest } = opts;
  return request("POST", recordsPath(collection, "bulkWrite"), {
    body: compact({ ops, ...rest }),
    headers: { "Idempotency-Key": idempotencyKey },
  });
}

/**
 * Atomic writes across collections: up to 100 single-document ops
 * (`insertOne`, `updateOne`, `replaceOne`, `deleteOne`) in one database
 * transaction. An op with `require: "matched"` that matches nothing rolls
 * everything back (409 `precondition_failed`, `opIndex`). Every collection must
 * be writable by the caller (app keys: own collections only).
 *
 * ```ts
 * await transact([
 *   { collection: orders.id, op: "updateOne", filter: { _id: "O-1", status: "paid" }, update: { $set: { status: "shipped" } }, require: "matched" },
 *   { collection: stock.id, op: "updateOne", filter: { _id: "SKU-1", qty: { $gte: 1 } }, update: { $inc: { qty: -1 } }, require: "matched" },
 *   { collection: events.id, op: "insertOne", document: { data: { type: "shipped", order: "O-1" } } },
 * ]);
 * ```
 */
export async function transact(
  ops: ReadonlyArray<UnsTransactOp>,
  opts: { assertLocks?: UnsAssertLock[]; idempotencyKey?: string } = {},
): Promise<UnsTransactResult> {
  return request("POST", "/transact", {
    body: compact({ ops, assertLocks: opts.assertLocks }),
    headers: { "Idempotency-Key": opts.idempotencyKey },
  });
}

/**
 * Lease records: either specific `ids` (all or nothing; 423 `locked` when one
 * is held by someone else) or claim up to `limit` unleased records matching
 * `filter` (work queue — concurrent claimers never get the same record; an
 * empty array means nothing to do). While a lease is valid, other writers get
 * 423; you write with `lockToken` (and `release: true` on the last write).
 * Leases expire after `ttlMs` (1000–300000, default 30000): renew in time, and
 * treat 409 `lock_lost` as "stop, someone else took over". Source-written
 * collections cannot be locked.
 */
export async function lockRecords<D = Record<string, unknown>>(collection: string, req: UnsLockRequest<D>): Promise<UnsLockGrant<D>[]> {
  return (await request<{ locks: UnsLockGrant<D>[] }>("POST", recordsPath(collection, "lock"), { body: compact({ ...req }) })).locks;
}

/** Extend leases (a lease can be held for 1 hour in total). 409 `lock_lost` when one expired or was taken. */
export async function renewLocks(collection: string, locks: ReadonlyArray<UnsLockRef>, ttlMs?: number): Promise<Array<{ id: string; expiresAt: number }>> {
  return (await request<{ locks: Array<{ id: string; expiresAt: number }> }>("POST", recordsPath(collection, "renew"), { body: compact({ locks, ttlMs }) })).locks;
}

/** Release leases. */
export async function unlockRecords(collection: string, locks: ReadonlyArray<UnsLockRef>): Promise<{ released: number }> {
  return request("POST", recordsPath(collection, "unlock"), { body: { locks } });
}

/** Release other holders' leases (needs full access; app keys: own collections only). Logged. */
export async function forceUnlockRecords(collection: string, ids: string[]): Promise<{ released: number }> {
  return request("POST", recordsPath(collection, "unlock"), { body: { ids, force: true } });
}

/** Joined records of `record.lookups[as]` and whether the per-document limit cut them. */
export function lookupOf<L = Record<string, unknown>>(record: Pick<UnsRecord, "lookups">, as: string): { items: UnsRecord<L>[]; truncated: boolean } {
  const items = record.lookups?.[as];
  return { items: Array.isArray(items) ? (items as UnsRecord<L>[]) : [], truncated: record.lookups?.[`${as}Truncated`] === true };
}

// ---------------- resumable bulk writes ----------------

/** Totals of a resumed `updateManyAll` / `deleteManyAll`. */
export interface UnsManyTotals {
  matchedCount: number;
  modifiedCount: number;
  deletedCount: number;
  lockedCount: number;
  /** Calls made. */
  rounds: number;
  /** True when `maxRounds` stopped the loop before the server reported done. */
  hasMore: boolean;
  /** Pass it as `resumeAfter` to continue later. */
  resumeAfter?: string;
}

/**
 * Runs a `*Many` call until the server reports `hasMore: false`, passing
 * `resumeAfter` each time so no document is processed twice (a rerun without
 * it would repeat `$inc`). Stops after `maxRounds` calls (default 20 × 10000
 * documents) and reports `hasMore` / `resumeAfter` so a job can continue later.
 * A failing round throws an `UnsError` whose `details` include the totals so
 * far (`details.totals`).
 */
async function resumeMany(
  run: (resumeAfter: string | undefined) => Promise<UnsManyResult>,
  opts: { resumeAfter?: string; maxRounds?: number; onProgress?: (totals: UnsManyTotals) => void },
): Promise<UnsManyTotals> {
  const totals: UnsManyTotals = { matchedCount: 0, modifiedCount: 0, deletedCount: 0, lockedCount: 0, rounds: 0, hasMore: false, resumeAfter: opts.resumeAfter };
  const maxRounds = opts.maxRounds ?? 20;
  while (totals.rounds < maxRounds) {
    let res: UnsManyResult;
    try {
      res = await run(totals.resumeAfter);
    } catch (e) {
      if (e instanceof UnsError) (e.details as Record<string, unknown>).totals = { ...totals };
      throw e;
    }
    totals.rounds++;
    totals.matchedCount += res.matchedCount ?? 0;
    totals.modifiedCount += res.modifiedCount ?? 0;
    totals.deletedCount += res.deletedCount ?? 0;
    totals.lockedCount += res.lockedCount ?? 0;
    totals.hasMore = Boolean(res.hasMore && res.resumeAfter);
    totals.resumeAfter = totals.hasMore ? res.resumeAfter : undefined;
    opts.onProgress?.({ ...totals });
    if (!totals.hasMore) break;
  }
  return totals;
}

/** `updateManyRecords` resumed with `resumeAfter` until every matching document is done (see `resumeMany` rules above). */
export function updateManyAll<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  update: UnsUpdate<D>,
  opts: Omit<UnsManyOptions, "atomic"> & { arrayFilters?: Record<string, unknown>[]; maxRounds?: number; onProgress?: (totals: UnsManyTotals) => void } = {},
): Promise<UnsManyTotals> {
  const { maxRounds, onProgress, resumeAfter, ...rest } = opts;
  return resumeMany((after) => updateManyRecords(collection, filter, update, { ...rest, resumeAfter: after }), { resumeAfter, maxRounds, onProgress });
}

/** `deleteManyRecords` resumed with `resumeAfter` until every matching document is deleted. */
export function deleteManyAll<D = Record<string, unknown>>(
  collection: string,
  filter: UnsFilter<D>,
  opts: Omit<UnsManyOptions, "atomic" | "ordered"> & { maxRounds?: number; onProgress?: (totals: UnsManyTotals) => void } = {},
): Promise<UnsManyTotals> {
  const { maxRounds, onProgress, resumeAfter, ...rest } = opts;
  return resumeMany((after) => deleteManyRecords(collection, filter, { ...rest, resumeAfter: after }), { resumeAfter, maxRounds, onProgress });
}

// ---------------- live changes ----------------

/** Change kinds the subscribe route accepts. */
export const UNS_CHANGE_KINDS: readonly UnsChangeKind[] = ["record", "sample", "delete", "lock", "leave"];

/** Parameters of the upstream SSE subscription. */
export interface UnsSubscribeParams {
  collections: string[];
  records?: string[];
  /** Default (server): record, sample. `delete`, `lock`, `leave` must be listed explicitly. */
  kinds?: UnsChangeKind[];
  /** Merge each record's changes within this window (ms). */
  coalesceMs?: number;
  /**
   * Server-side filter on record events (exactly one collection). Records that
   * stop matching arrive as `leave` events when `kinds` includes `leave`.
   */
  filter?: UnsFilter | string;
  /** Resume after this event id (the `id:` of the last event received). */
  lastEventId?: string;
}

/**
 * Open the upstream SSE stream of changes. Return the `Response` from a route
 * handler as-is to forward it to the browser (see `src/routes/api/uns/subscribe.ts`):
 * the body is passed through unchanged, including each event's `id:` line,
 * `event: reset` and pings. `coalesceMs` merges the changes of each record
 * within that window (machine samples can arrive hundreds of times per
 * second); browsers should use ≥ 500.
 */
export async function subscribeUpstream(params: UnsSubscribeParams, signal?: AbortSignal): Promise<Response> {
  const { base, key } = config();
  const filter = typeof params.filter === "string" ? params.filter : params.filter ? JSON.stringify(params.filter) : undefined;
  const url = buildUrl(base, "/subscribe", {
    collections: params.collections.join(","),
    records: params.records?.join(","),
    kinds: params.kinds?.join(","),
    // merge changes per record within this window (sample fields merged, latest wins)
    coalesce: params.coalesceMs,
    filter,
  });
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, Accept: "text/event-stream" };
  if (params.lastEventId) headers["Last-Event-ID"] = params.lastEventId;
  const res = await fetch(url, { headers, signal });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      // not JSON
    }
    const err = errorFrom(res.status, res.statusText, text, json);
    throw err.code === "upstream_error" ? new UnsError(res.status, "subscribe_failed", err.message, err.details) : err;
  }
  return new Response(res.body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" },
  });
}

const SUBSCRIBE_MAX_IDS = 200;
const SUBSCRIBE_MAX_FILTER = 4096;
// Browser-facing default: merge each record's changes per second. Plant data
// can produce hundreds of samples per second; rendering each one freezes pages.
const SUBSCRIBE_DEFAULT_COALESCE_MS = 1000;
const SUBSCRIBE_MIN_COALESCE_MS = 200;

function csv(value: string | null): string[] {
  return (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parses the browser's subscribe request (`/api/uns/subscribe?collections=…`)
 * into upstream parameters: `collections` (required), `records`, `kinds`
 * (record, sample, delete, lock, leave), `coalesce` (default 1000, min 200),
 * `filter` (JSON, one collection only) and the resume position from the
 * `Last-Event-ID` header (sent by EventSource on reconnect) or `lastEventId`.
 * Throws `HttpError(400)` for invalid input.
 */
export function parseSubscribeRequest(url: URL, headers: Headers): UnsSubscribeParams {
  const q = url.searchParams;
  const collections = csv(q.get("collections"));
  const records = csv(q.get("records"));
  const kinds = csv(q.get("kinds")).filter((k): k is UnsChangeKind => (UNS_CHANGE_KINDS as readonly string[]).includes(k));
  if (collections.length === 0) throw new HttpError(400, "collections is required");
  if (collections.length > SUBSCRIBE_MAX_IDS || records.length > SUBSCRIBE_MAX_IDS) throw new HttpError(400, "too many collections or records");
  const coalesceMs = Math.max(SUBSCRIBE_MIN_COALESCE_MS, Number(q.get("coalesce")) || SUBSCRIBE_DEFAULT_COALESCE_MS);
  const rawFilter = q.get("filter")?.trim() || undefined;
  if (rawFilter) {
    if (collections.length !== 1) throw new HttpError(400, "filter needs exactly one collection");
    if (rawFilter.length > SUBSCRIBE_MAX_FILTER) throw new HttpError(400, "filter is too long");
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawFilter);
    } catch {
      throw new HttpError(400, "filter must be JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new HttpError(400, "filter must be a JSON object");
  }
  const lastEventId = (headers.get("Last-Event-ID") ?? q.get("lastEventId") ?? "").trim();
  if (lastEventId && !/^\d{1,20}$/.test(lastEventId)) throw new HttpError(400, "bad Last-Event-ID");
  return {
    collections,
    records: records.length ? records : undefined,
    kinds: kinds.length ? kinds : undefined,
    coalesceMs,
    filter: rawFilter,
    lastEventId: lastEventId || undefined,
  };
}

// ---------------- app-owned collections ----------------
//
// The app's own business data (orders it manages, approvals, form
// submissions, settings…) lives in UNS collections owned by the app. Their ids
// start with the platform-injected `TIER0_APP_COLLECTION_PREFIX`
// (`app.<first 12 hex of the App id>.`); the platform records the owner and
// purges these collections when the app is deleted. Declare each one once
// with `defineAppCollection(name, def, { seed })` and call its methods from
// services — there is no database and no migration step: definitions are kept
// in sync on first use and seeds use fixed record ids. Writes use MongoDB-style
// operators (`updateOne`, `findOneAndUpdate`, upsert on a unique index),
// atomic multi-collection changes use `transact()`, and records can be leased
// with `lock()`.

/**
 * Collection definition without the id (the id is `appCollectionId(name)`).
 * `name` is the display name shown in the UNS console (defaults to the short name).
 */
export type AppCollectionDef = Omit<UnsCollectionInput, "id" | "name"> & { name?: string };

/** One seed record: a fixed, readable id makes re-seeding idempotent (409 = exists). */
export interface AppSeedRecord<D = Record<string, unknown>> {
  id: string;
  data: D;
}

const APP_PREFIX_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]*\.$/;
const APP_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/;
const MAX_COLLECTION_ID = 128;

/**
 * Id prefix of this app's own collections, e.g. `app.7bdba8039b80.`.
 *
 * Preview and deployed runs get `TIER0_APP_COLLECTION_PREFIX` from the
 * platform. Without it the prefix is derived from `APP_ID` when that is the
 * App UUID (same rule as the platform). Plain local development has neither
 * (and no UNS credentials either), so this throws `not_configured` — show an
 * empty state with `isUnsConfigured()` instead of inventing a prefix.
 */
export function appCollectionPrefix(env: NodeJS.ProcessEnv = process.env): string {
  const injected = env.TIER0_APP_COLLECTION_PREFIX?.trim();
  if (injected) {
    if (!APP_PREFIX_RE.test(injected)) {
      throw new UnsError(503, "not_configured", `TIER0_APP_COLLECTION_PREFIX is malformed: "${injected}" (expected app.<appKey>.)`);
    }
    return injected;
  }
  const hex = (env.APP_ID ?? "").trim().replace(/-/g, "").toLowerCase();
  if (/^[0-9a-f]{32}$/.test(hex)) return `app.${hex.slice(0, 12)}.`;
  throw new UnsError(
    503,
    "not_configured",
    "App collections are not configured: TIER0_APP_COLLECTION_PREFIX (or the App UUID in APP_ID) is injected by the platform at preview and deploy time",
  );
}

/** Full collection id of an app-owned collection: `appCollectionId("orders")` → `app.7bdba8039b80.orders`. */
export function appCollectionId(name: string, env: NodeJS.ProcessEnv = process.env): string {
  const prefix = appCollectionPrefix(env);
  if (name.startsWith(prefix)) name = name.slice(prefix.length);
  if (!APP_NAME_RE.test(name)) {
    throw new UnsError(400, "validation_failed", `Invalid app collection name "${name}": letters, digits and _ . : - only`);
  }
  const id = prefix + name;
  if (id.length > MAX_COLLECTION_ID) {
    throw new UnsError(400, "validation_failed", `App collection id "${id}" is longer than ${MAX_COLLECTION_ID} characters`);
  }
  return id;
}

/** True when `id` belongs to this app (starts with its prefix). */
export function isAppCollection(id: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return id.startsWith(appCollectionPrefix(env));
}

/** This app's own collections (with record counts). */
export async function listAppCollections(): Promise<UnsCollection[]> {
  const prefix = appCollectionPrefix();
  return (await listCollections()).filter((c) => c.id.startsWith(prefix));
}

// Keys of a definition that ensureAppCollection keeps in sync.
const DEF_KEYS = ["name", "description", "recordSchema", "sampleSchema", "recordMode", "indexes"] as const;

/** Normalizes one index the way UNS stores it (defaults omitted). */
function canonicalIndex(index: UnsIndex): unknown {
  if (typeof index === "string") return index;
  const out: Record<string, unknown> = {};
  if (index.paths && index.paths.length > 1) out.paths = index.paths;
  else if (index.paths?.length === 1) out.path = index.paths[0];
  else if (index.path) out.path = index.path;
  if (index.kind && index.kind !== "btree") out.kind = index.kind;
  if (index.unique) out.unique = true;
  if (index.expireAfterMs) out.expireAfterMs = index.expireAfterMs;
  return out;
}

/** Normalizes a definition the way UNS stores it, for change detection. */
function canonical(value: unknown, key = ""): unknown {
  if (value === undefined || value === null || value === "") return undefined;
  if (key === "indexes" && Array.isArray(value)) {
    return value.length ? canonical(value.map((i) => canonicalIndex(i as UnsIndex))) : undefined;
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => canonical(v)).filter((v) => v !== undefined);
    return items.length ? items : undefined;
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = canonical((value as Record<string, unknown>)[k], k);
      if (v !== undefined) out[k] = v;
    }
    return Object.keys(out).length ? out : undefined;
  }
  // UNS omits `nullable: false`; every other boolean (additionalProperties: false) is kept.
  if (key === "nullable" && value === false) return undefined;
  return value;
}

/** Strips keys UNS adds for its own UI (`x-order`) unless the app declares them too. */
function withoutUiKeys(current: unknown, wanted: unknown): unknown {
  if (!current || typeof current !== "object" || Array.isArray(current)) return current;
  const w = (wanted && typeof wanted === "object" ? wanted : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(current as Record<string, unknown>)) {
    if (k === "x-order" && !("x-order" in w)) continue;
    out[k] = withoutUiKeys(v, w[k]);
  }
  return out;
}

function desiredDefinition(name: string, def: AppCollectionDef): Record<(typeof DEF_KEYS)[number], unknown> {
  return {
    name: def.name ?? name,
    description: def.description,
    recordSchema: def.recordSchema,
    sampleSchema: def.sampleSchema,
    recordMode: def.recordMode ?? "merge",
    indexes: def.indexes,
  };
}

/** Definition keys whose stored value differs from the wanted one (`null` = remove). */
export function appCollectionChanges(
  name: string,
  def: AppCollectionDef,
  current: Partial<UnsCollection>,
): Partial<Record<(typeof DEF_KEYS)[number], unknown>> {
  const want = desiredDefinition(name, def);
  const changes: Partial<Record<(typeof DEF_KEYS)[number], unknown>> = {};
  for (const key of DEF_KEYS) {
    const cur = key === "recordMode" ? (current.recordMode ?? "merge") : current[key];
    const a = JSON.stringify(canonical(want[key], key) ?? null);
    const b = JSON.stringify(canonical(withoutUiKeys(cur, want[key]), key) ?? null);
    if (a !== b) changes[key] = want[key] ?? null;
  }
  return changes;
}

function isStatus(e: unknown, status: number): e is UnsError {
  return e instanceof UnsError && e.upstreamStatus === status;
}

const INDEX_WAIT_MS = 20_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits (bounded) until the object-form indexes of a freshly created or
 * changed collection are built: upserts without `_id` need a ready unique
 * index and `$lookup` needs a ready index on the joined field. A failed
 * index (typically a unique index over existing duplicates) throws 409
 * `index_failed` with the server's example. Servers that do not report
 * `indexStatus` are not waited for.
 */
async function waitForIndexes(id: string, def: AppCollectionDef, current: UnsCollection | null, waitMs = INDEX_WAIT_MS): Promise<UnsCollection | null> {
  if (!def.indexes?.some((i) => typeof i === "object")) return current;
  const deadline = Date.now() + waitMs;
  let c = current;
  for (let delay = 200; ; delay = Math.min(delay * 2, 2000)) {
    if (!c) c = await getCollection(id);
    const status = c.indexStatus;
    if (!status) return c;
    const failed = status.find((s) => s.state === "failed");
    if (failed) {
      throw new UnsError(409, "index_failed", `Index ${failed.path ?? failed.paths?.join("+")} of ${id} failed: ${failed.error ?? "unknown error"}`, {
        index: failed,
      });
    }
    if (status.every((s) => s.state === "ready")) return c;
    if (Date.now() + delay > deadline) return c;
    await sleep(delay);
    c = null;
  }
}

async function ensureAppCollectionState(
  name: string,
  def: AppCollectionDef,
): Promise<{ collection: UnsCollection; created: boolean }> {
  const id = appCollectionId(name);
  for (let attempt = 0; ; attempt++) {
    let current: UnsCollection | null = null;
    try {
      current = await getCollection(id);
    } catch (e) {
      if (!isStatus(e, 404)) throw e;
    }
    if (!current) {
      try {
        const created = await request<UnsCollection>("POST", "/collections", {
          body: { id, ...desiredDefinition(name, def) },
        });
        const built = await waitForIndexes(id, def, null);
        return { collection: { ...created, ...(built?.indexStatus ? { indexStatus: built.indexStatus } : {}), recordCount: 0 }, created: true };
      } catch (e) {
        // another process created it first: read it and compare
        if (isStatus(e, 409) && e.code !== "index_failed" && attempt < 3) continue;
        throw e;
      }
    }
    const changes = appCollectionChanges(name, def, current);
    if (Object.keys(changes).length === 0) {
      const built = await waitForIndexes(id, def, current);
      return { collection: built ?? current, created: false };
    }
    try {
      const patched = await patchCollection(id, changes as Partial<AppCollectionDef>, { revision: current.revision });
      const built = await waitForIndexes(id, def, null);
      return { collection: { ...patched, ...(built?.indexStatus ? { indexStatus: built.indexStatus } : {}), recordCount: current.recordCount }, created: false };
    } catch (e) {
      // concurrent definition change: reload and compare again
      if (isStatus(e, 409) && e.code !== "index_failed" && attempt < 3) continue;
      throw e;
    }
  }
}

// Per-process memo: id → (variant → promise). Failures are evicted so the next call retries.
const ensured = new Map<string, Map<string, Promise<unknown>>>();

function memo<T>(id: string, variant: string, run: () => Promise<T>): Promise<T> {
  let byVariant = ensured.get(id);
  if (!byVariant) ensured.set(id, (byVariant = new Map()));
  const hit = byVariant.get(variant) as Promise<T> | undefined;
  if (hit) return hit;
  const p = run().catch((e) => {
    if (ensured.get(id)?.get(variant) === p) ensured.get(id)?.delete(variant);
    throw e;
  });
  byVariant.set(variant, p);
  return p;
}

/**
 * Make sure the app-owned collection `name` exists with this definition:
 * GET; 404 → create; definition changed → PATCH (schema, indexes, name…);
 * a 409 race with another process → read again. New object-form indexes
 * (`{ path, unique: true }` …) are awaited until built (bounded), so an upsert
 * right after the first call works; a unique index that cannot be built over
 * existing duplicates throws 409 `index_failed`. Runs once per process for a
 * given definition (the result is cached until `resetAppCollection`).
 *
 * Schema changes apply to new writes; existing records are not rewritten, so
 * make new fields optional (or backfill them) instead of adding `required`
 * fields to a collection that already has data. Changing `indexes` is limited
 * to once per minute per collection by the server.
 */
export function ensureAppCollection(name: string, def: AppCollectionDef): Promise<UnsCollection> {
  const id = appCollectionId(name);
  return memo(id, "def:" + JSON.stringify(canonical(desiredDefinition(name, def))), async () =>
    (await ensureAppCollectionState(name, def)).collection,
  );
}

/**
 * Write seed records with fixed ids. A 409 means the record already exists
 * (another process or an earlier run seeded it) and is left unchanged.
 */
export async function seedAppRecords<D = Record<string, unknown>>(
  name: string,
  records: ReadonlyArray<AppSeedRecord<D>>,
): Promise<{ created: number; existing: number }> {
  const id = appCollectionId(name);
  let created = 0;
  let existing = 0;
  for (const record of records) {
    try {
      await createRecord(id, record.id, record.data);
      created++;
    } catch (e) {
      if (!isStatus(e, 409)) throw e;
      existing++;
    }
  }
  return { created, existing };
}

/**
 * Delete the app-owned collection together with all its records and samples
 * (`DELETE ?purge=true`). Missing collections are ignored. The next use
 * recreates it (and re-seeds it when declared with `defineAppCollection`).
 */
export async function resetAppCollection(name: string): Promise<void> {
  const id = appCollectionId(name);
  ensured.delete(id);
  try {
    await deleteCollection(id, { purge: true });
  } catch (e) {
    if (!isStatus(e, 404)) throw e;
  } finally {
    ensured.delete(id);
  }
}

// ---------------- collection handles ----------------

/** Read-only, MongoDB-style queries on one collection (any collection of the workspace). */
export interface UnsReadHandle<D = Record<string, unknown>> {
  /** Full collection id. */
  readonly id: string;
  /** One page: `{ items, nextCursor?, total? }`. */
  find<R = D>(opts?: UnsFindOptions<D>): Promise<UnsFindResult<R>>;
  /** First match (by `sort`), or null. */
  findOne<R = D>(filter?: UnsFilter<D>, opts?: Pick<UnsFindOptions<D>, "projection" | "sort" | "lookup" | "withLatest">): Promise<UnsRecord<R> | null>;
  /** Every match, page by page (stops after `max`, default 10000). */
  iterate(opts?: Omit<UnsFindOptions<D>, "cursor" | "skip" | "count"> & { max?: number }): AsyncGenerator<UnsRecord<D>, void, undefined>;
  count(filter?: UnsFilter<D>, opts?: { limit?: number }): Promise<{ count: number; capped: boolean }>;
  distinct<V = unknown>(field: string, filter?: UnsFilter<D>, opts?: { limit?: number }): Promise<{ values: V[]; truncated: boolean }>;
  aggregate<R = Record<string, unknown>>(pipeline: UnsPipelineStage[]): Promise<UnsAggregateResult<R>>;
  /** One record by id, or null. */
  get(id: string): Promise<UnsRecord<D> | null>;
}

/** Full read / write / lock access to one of the app's own collections. */
export interface AppDocuments<D extends Record<string, unknown> = Record<string, unknown>> extends UnsReadHandle<D> {
  /** Insert one document (`opts.id`, default a ULID); 409 `duplicate_key` when the id / a unique value exists. */
  insertOne(data: D, opts?: { id?: string; idempotencyKey?: string }): Promise<{ insertedId: string }>;
  insertMany(docs: ReadonlyArray<UnsInsertDocument<D>>, opts?: { ordered?: boolean; idempotencyKey?: string }): Promise<UnsInsertManyResult>;
  updateOne(filter: UnsFilter<D>, update: UnsUpdate<D>, opts?: UnsUpdateOneOptions): Promise<UnsUpdateResult>;
  /** One call (≤ `maxDocs`); check `hasMore` / `resumeAfter`, or use `updateManyAll`. */
  updateMany(filter: UnsFilter<D>, update: UnsUpdate<D>, opts?: UnsManyOptions & { arrayFilters?: Record<string, unknown>[] }): Promise<UnsManyResult>;
  /** `updateMany` resumed until every match is done (bounded by `maxRounds`). */
  updateManyAll(filter: UnsFilter<D>, update: UnsUpdate<D>, opts?: Parameters<typeof updateManyAll>[3]): Promise<UnsManyTotals>;
  replaceOne(filter: UnsFilter<D>, replacement: D, opts?: UnsUpdateOneOptions): Promise<UnsUpdateResult>;
  deleteOne(filter: UnsFilter<D>, opts?: UnsWriteOneOptions & { sort?: UnsSort }): Promise<UnsDeleteResult>;
  deleteMany(filter: UnsFilter<D>, opts?: Omit<UnsManyOptions, "ordered">): Promise<UnsManyResult>;
  deleteManyAll(filter: UnsFilter<D>, opts?: Parameters<typeof deleteManyAll>[2]): Promise<UnsManyTotals>;
  /** Atomic update returning the document (`returnDocument: "after"` for the new state); null when nothing matched. */
  findOneAndUpdate(filter: UnsFilter<D>, update: UnsUpdate<D>, opts?: UnsFindOneAndOptions): Promise<UnsRecord<D> | null>;
  findOneAndReplace(filter: UnsFilter<D>, replacement: D, opts?: UnsFindOneAndOptions): Promise<UnsRecord<D> | null>;
  findOneAndDelete(filter: UnsFilter<D>, opts?: Parameters<typeof findOneAndDeleteRecord>[2]): Promise<UnsRecord<D> | null>;
  bulkWrite(ops: ReadonlyArray<UnsBulkOp<D>>, opts?: Parameters<typeof bulkWriteRecords>[2]): Promise<UnsBulkResult>;
  /** Lease ids (all or nothing, 423 when held) or claim up to `limit` matches (work queue). */
  lock(req: UnsLockRequest<D>): Promise<UnsLockGrant<D>[]>;
  renew(locks: ReadonlyArray<UnsLockRef>, ttlMs?: number): Promise<Array<{ id: string; expiresAt: number }>>;
  unlock(locks: ReadonlyArray<UnsLockRef>): Promise<{ released: number }>;
  /** How many documents a bulk write would touch, before running it. */
  explain(op: Parameters<typeof explainWrite>[1], filter: UnsFilter<D>): Promise<UnsExplainResult>;
}

function readMethods<D>(id: () => string, before: () => Promise<unknown>): UnsReadHandle<D> {
  return {
    get id() {
      return id();
    },
    async find<R = D>(opts?: UnsFindOptions<D>) {
      await before();
      return findRecords<R>(id(), (opts ?? {}) as unknown as UnsFindOptions<R>);
    },
    async findOne<R = D>(filter?: UnsFilter<D>, opts?: Pick<UnsFindOptions<D>, "projection" | "sort" | "lookup" | "withLatest">) {
      await before();
      return findOneRecord<R>(id(), (filter ?? {}) as unknown as UnsFilter<R>, (opts ?? {}) as unknown as Pick<UnsFindOptions<R>, "projection" | "sort" | "lookup" | "withLatest">);
    },
    async *iterate(opts) {
      await before();
      yield* iterateRecords<D>(id(), opts);
    },
    async count(filter, opts) {
      await before();
      return countRecords<D>(id(), filter, opts);
    },
    async distinct<V = unknown>(field: string, filter?: UnsFilter<D>, opts?: { limit?: number }) {
      await before();
      return distinctValues<V, D>(id(), field, filter, opts);
    },
    async aggregate<R = Record<string, unknown>>(pipeline: UnsPipelineStage[]) {
      await before();
      return aggregateRecords<R>(id(), pipeline);
    },
    async get(rid) {
      await before();
      return getRecord<D>(id(), rid);
    },
  };
}

function documentMethods<D extends Record<string, unknown>>(id: () => string, before: () => Promise<unknown>): AppDocuments<D> {
  const read = readMethods<D>(id, before);
  const docs: Omit<AppDocuments<D>, keyof UnsReadHandle<D>> = {
    async insertOne(data, opts) {
      await before();
      return insertOneRecord<D>(id(), data, opts);
    },
    async insertMany(list, opts) {
      await before();
      return insertManyRecords<D>(id(), list, opts);
    },
    async updateOne(filter, update, opts) {
      await before();
      return updateOneRecord<D>(id(), filter, update, opts);
    },
    async updateMany(filter, update, opts) {
      await before();
      return updateManyRecords<D>(id(), filter, update, opts);
    },
    async updateManyAll(filter, update, opts) {
      await before();
      return updateManyAll<D>(id(), filter, update, opts);
    },
    async replaceOne(filter, replacement, opts) {
      await before();
      return replaceOneRecord<D>(id(), filter, replacement, opts);
    },
    async deleteOne(filter, opts) {
      await before();
      return deleteOneRecord<D>(id(), filter, opts);
    },
    async deleteMany(filter, opts) {
      await before();
      return deleteManyRecords<D>(id(), filter, opts);
    },
    async deleteManyAll(filter, opts) {
      await before();
      return deleteManyAll<D>(id(), filter, opts);
    },
    async findOneAndUpdate(filter, update, opts) {
      await before();
      return (await findOneAndUpdateRecord<D>(id(), filter, update, opts)).value;
    },
    async findOneAndReplace(filter, replacement, opts) {
      await before();
      return (await findOneAndReplaceRecord<D>(id(), filter, replacement, opts)).value;
    },
    async findOneAndDelete(filter, opts) {
      await before();
      return (await findOneAndDeleteRecord<D>(id(), filter, opts)).value;
    },
    async bulkWrite(ops, opts) {
      await before();
      return bulkWriteRecords<D>(id(), ops, opts);
    },
    async lock(req) {
      await before();
      return lockRecords<D>(id(), req);
    },
    async renew(locks, ttlMs) {
      await before();
      return renewLocks(id(), locks, ttlMs);
    },
    async unlock(locks) {
      await before();
      return unlockRecords(id(), locks);
    },
    async explain(op, filter) {
      await before();
      return explainWrite<D>(id(), op, filter);
    },
  };
  return Object.defineProperties(docs, Object.getOwnPropertyDescriptors(read)) as AppDocuments<D>;
}

const ready0 = () => Promise.resolve();

/**
 * Read-only handle for any collection of the workspace (plant data, ERP,
 * other apps). Writes to collections the app does not own are rejected by
 * the platform (403), so this handle has none.
 *
 * ```ts
 * const machines = collection<Machine>("equipment");
 * const { items } = await machines.find({ filter: { line: "L1", status: { $ne: "OFF" } }, sort: [["name", 1]] });
 * ```
 */
export function collection<D = Record<string, unknown>>(id: string): UnsReadHandle<D> {
  return readMethods<D>(() => id, ready0);
}

/**
 * Document handle for one of the app's own collections, by short name. It
 * does not create the collection: declare it with `defineAppCollection` (whose
 * handle has the same methods and ensures the definition first) or call
 * `ensureAppCollection(name, def)` before using this.
 */
export function appCollection<D extends Record<string, unknown> = Record<string, unknown>>(name: string): AppDocuments<D> {
  if (!APP_NAME_RE.test(name)) throw new Error(`Invalid app collection name "${name}": letters, digits and _ . : - only`);
  return documentMethods<D>(() => appCollectionId(name), ready0);
}

/** Typed access to one app-owned collection. Every method ensures (and seeds) it first. */
export interface AppCollection<D extends Record<string, unknown> = Record<string, unknown>> extends AppDocuments<D> {
  /** Short name, e.g. `orders`. */
  readonly name: string;
  /** Full collection id (`app.<appKey>.orders`), resolved at runtime. */
  readonly id: string;
  /** Ensure the definition, then seed an empty collection once per process. */
  ready(): Promise<UnsCollection>;
  /** Legacy list query (`filter.<field>=`); prefer `find`. */
  list(query?: UnsRecordQuery): Promise<{ items: UnsRecord<D>[]; total: number }>;
  /** Create a record with a known id; 409 when the id exists. */
  create(id: string, data: D): Promise<UnsRecord<D>>;
  /** Merge fields into a record by id (creates it when missing). */
  patch(id: string, data: Partial<D>, opts?: UnsRecordWriteOptions): Promise<UnsRecord<D>>;
  /** Replace the data of a record by id. */
  put(id: string, data: D, opts?: UnsRecordWriteOptions & { ifNoneMatch?: "*" }): Promise<UnsRecord<D>>;
  remove(id: string, opts?: UnsRecordWriteOptions): Promise<void>;
  /**
   * Read-modify-write in application code, retried on a concurrent change
   * (409). Only for changes that operators cannot express (e.g. recomputing a
   * nested structure). For state transitions and counters use
   * `findOneAndUpdate` / `updateOne` with a guarded filter and `$set` / `$inc`:
   * one atomic request, no retry loop. Missing records throw 404.
   */
  update(id: string, next: (current: D, record: UnsRecord<D>) => D | Promise<D>, opts?: { retries?: number }): Promise<UnsRecord<D>>;
  /** Purge the collection (all records and samples); the next call recreates and re-seeds it. */
  reset(): Promise<void>;
}

/**
 * Declare an app-owned collection once (e.g. in `src/services/orders.ts`) and
 * use the returned handle from services:
 *
 * ```ts
 * export const orders = defineAppCollection<Order>("orders", {
 *   name: "Orders",
 *   recordSchema: { type: "object", properties: { code: { type: "string" }, status: { type: "string", enum: ["DRAFT", "RELEASED"] } }, required: ["code", "status"] },
 *   indexes: [{ path: "code", unique: true }, { path: "status" }],
 * }, {
 *   seed: () => [{ id: "WO-0001", data: { code: "WO-0001", status: "DRAFT" } }],
 * });
 * const { items, nextCursor } = await orders.find({ filter: { status: "DRAFT" }, sort: [["_meta.updatedAt", -1]], limit: 50 });
 * const released = await orders.findOneAndUpdate({ _id: id, status: "DRAFT" }, { $set: { status: "RELEASED" } }, { returnDocument: "after" });
 * ```
 *
 * `seed` runs when the collection was just created or is empty — not on every
 * start — so records the user deleted do not come back.
 */
export function defineAppCollection<D extends Record<string, unknown> = Record<string, unknown>>(
  name: string,
  def: AppCollectionDef,
  opts: { seed?: () => ReadonlyArray<AppSeedRecord<D>> | Promise<ReadonlyArray<AppSeedRecord<D>>> } = {},
): AppCollection<D> {
  if (!APP_NAME_RE.test(name)) throw new Error(`Invalid app collection name "${name}": letters, digits and _ . : - only`);
  const id = () => appCollectionId(name);
  const ready = () =>
    memo(id(), "handle:" + JSON.stringify(canonical(desiredDefinition(name, def))), async () => {
      const state = await ensureAppCollectionState(name, def);
      if (opts.seed && (state.created || !state.collection.recordCount)) {
        await seedAppRecords(name, await opts.seed());
      }
      return state.collection;
    });

  const extra: Omit<AppCollection<D>, keyof AppDocuments<D>> = {
    name,
    ready,
    async list(query) {
      await ready();
      return listRecords<D>(id(), query);
    },
    async create(rid, data) {
      await ready();
      return createRecord<D>(id(), rid, data);
    },
    async patch(rid, data, o) {
      await ready();
      return patchRecord<D>(id(), rid, data, o);
    },
    async put(rid, data, o) {
      await ready();
      return putRecord<D>(id(), rid, data, o);
    },
    async remove(rid, o) {
      await ready();
      return deleteRecord(id(), rid, o);
    },
    async update(rid, next, o = {}) {
      await ready();
      const retries = o.retries ?? 3;
      for (let attempt = 0; ; attempt++) {
        const current = await getRecord<D>(id(), rid);
        if (!current) throw new UnsError(404, "not_found", `record ${rid} not found in ${id()}`);
        const data = await next(current.data, current);
        try {
          return await putRecord<D>(id(), rid, data, { revision: current.revision });
        } catch (e) {
          if (isStatus(e, 409) && attempt < retries) continue;
          throw e;
        }
      }
    },
    reset() {
      return resetAppCollection(name);
    },
  };
  return Object.defineProperties(extra, Object.getOwnPropertyDescriptors(documentMethods<D>(id, ready))) as AppCollection<D>;
}
