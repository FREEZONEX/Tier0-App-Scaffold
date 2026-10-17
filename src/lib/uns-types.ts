/**
 * Tier0 UNS v2 data types shared by the server client (`@/lib/uns.server`)
 * and browser code (`@/lib/uns-live`).
 *
 * UNS keeps every workspace's data in three platform tables — definitions,
 * records and samples. Apps never touch those tables; they read and write
 * through the UNS REST API so schemas, revisions, latest values and change
 * events stay consistent. All times are Unix milliseconds.
 */

/** JSON Schema subset accepted by UNS collections. */
export interface UnsSchema {
  type: "object";
  properties?: Record<string, UnsSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface UnsSchemaProperty {
  type?: "string" | "number" | "integer" | "boolean" | "object" | "array";
  title?: string;
  unit?: string;
  description?: string;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
  nullable?: boolean;
  items?: UnsSchemaProperty;
  properties?: Record<string, UnsSchemaProperty>;
}

/** A collection (dataset): one kind of object, e.g. work orders or machines. */
export interface UnsCollection {
  id: string;
  name: string;
  description?: string;
  recordSchema: UnsSchema;
  /** Present when the collection stores time series (samples) per record. */
  sampleSchema?: UnsSchema;
  /** merge (default) | upsert | append */
  recordMode?: "merge" | "upsert" | "append";
  /**
   * Indexes. Object form (`{ path, unique?, kind?, expireAfterMs? }`) powers
   * `findRecords` filters / sorts, `$lookup`, unique constraints (409
   * `duplicate_key`, upsert without `_id`) and TTL; the legacy string form
   * (`"status"`) only serves the old `listRecords({ filter })` query.
   */
  indexes?: UnsIndex[];
  /** Build state of each index (returned by `getCollection`). Upserts on a unique index need `ready`. */
  indexStatus?: UnsIndexStatus[];
  /**
   * App that owns the collection (agent-platform App id), set by the platform
   * for collections created with an app key. Owned collections are deleted
   * with the app.
   */
  ownerApp?: string;
  /**
   * The records accept device commands (`sendCommand`): an enabled source
   * instance writing this collection has commands turned on.
   */
  commandable?: boolean;
  recordCount?: number;
  sampleCount7d?: number;
  revision?: number;
  updatedAt?: number;
}

/** Fields accepted by `ensureCollection` / `POST /collections`. */
export type UnsCollectionInput = Pick<
  UnsCollection,
  "id" | "name" | "description" | "recordSchema" | "sampleSchema" | "recordMode" | "indexes"
>;

/**
 * One index declaration.
 * - `"field"` (legacy): text index for the old `listRecords({ filter })` query only.
 * - `{ path }`: btree on a JSON path (equality, ranges, sort, `$lookup` target).
 * - `{ path, unique: true }`: a second document with the same value gets 409
 *   `duplicate_key`; documents without the field are not constrained (Mongo
 *   `unique + sparse`). Enables upsert without `_id`. Not allowed on
 *   collections written by data sources.
 * - `{ path, kind: "prefix" }`: for `$prefix` / `$regex: "^…"`.
 * - `{ path, kind: "gin" }`: array containment / `$all`.
 * - `{ path, kind: "ttl", expireAfterMs }`: documents whose field (a Unix ms
 *   number) is older than now − expireAfterMs are deleted (≥ 60000, one per collection).
 * - `{ paths: [a, b] }`: compound (≤ 3 paths).
 * Paths are dotted (`a.b`); a literal dot is `\.` (in a JS string `"a\\.b"`).
 * At most 16 per collection; changing `indexes` is limited to once per minute
 * per collection.
 */
export type UnsIndex = string | UnsIndexSpec;

export interface UnsIndexSpec {
  path?: string;
  paths?: string[];
  kind?: "btree" | "prefix" | "gin" | "ttl";
  unique?: boolean;
  expireAfterMs?: number;
}

export interface UnsIndexStatus extends UnsIndexSpec {
  state: "pending" | "building" | "ready" | "failed";
  /** Why the build failed (for unique indexes: an example of a duplicate value). */
  error?: string;
}

/** Latest sample (or record state) of one record. */
export interface UnsLatest<D = Record<string, unknown>> {
  time: number;
  quality?: string;
  data: D;
  revision?: number;
}

/** One row of a collection: the current state of an object. */
export interface UnsRecord<D = Record<string, unknown>> {
  id: string;
  data: D;
  /** Optimistic lock: send it back on update to detect concurrent writes (409). */
  revision: number;
  sourceId?: string;
  sourceTime?: number;
  createdAt: number;
  updatedAt: number;
  /** Latest sample, for collections with a sampleSchema. */
  latest?: UnsLatest | null;
  /** Active lease (`records:lock`); the token is never included. */
  lock?: UnsLockInfo | null;
  /**
   * `findRecords(..., { lookup })` results by `as` name: an array of joined
   * records, plus `<as>Truncated: true` when the per-document limit cut it.
   * Read it with `lookupOf(record, as)`.
   */
  lookups?: Record<string, UnsRecord[] | boolean>;
}

/** Lease state shown on a record. `label` is written by the holder (display it as such). */
export interface UnsLockInfo {
  principal: string;
  label?: string;
  expiresAt: number;
  fence: number;
}

/** One raw time-series point. */
export interface UnsSample<D = Record<string, unknown>> {
  time: number;
  id: string;
  quality?: string;
  data: D;
  sourceId?: string;
}

/** One aggregation bucket over a numeric sample field. */
export interface UnsBucket {
  time: number;
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
  sum: number | null;
  first: number | null;
  last: number | null;
}

/** Record list filters. Plain values are equality; use operators for ranges. */
export type UnsFilterValue =
  | string
  | number
  | boolean
  | {
      gt?: string | number;
      gte?: string | number;
      lt?: string | number;
      lte?: string | number;
      ne?: string | number;
      in?: Array<string | number>;
      prefix?: string;
      exists?: boolean;
    };

export interface UnsRecordQuery {
  limit?: number;
  offset?: number;
  /** Record id contains this text. */
  q?: string;
  ids?: string[];
  sort?: "id" | "-id" | "updatedAt" | "-updatedAt" | "createdAt" | "-createdAt";
  filter?: Record<string, UnsFilterValue>;
}

/** Time arguments accept milliseconds, RFC3339 or a relative duration such as "-24h". */
export type UnsTime = number | string;

export interface UnsSeriesQuery {
  collection: string;
  records: string[];
  from?: UnsTime;
  to?: UnsTime;
  /** 1m, 5m, 1h, 1d … omit for raw samples. */
  bucket?: string;
  /** Numeric sample fields to aggregate (default ["value"]). */
  fields?: string[];
  limit?: number;
}

export interface UnsSeries {
  recordId: string;
  field?: string;
  items: Array<UnsSample | UnsBucket>;
}

/** A topic-tree node: directory, list topic (records of one collection) or field topic. */
export interface UnsNode {
  id: string;
  kind: "directory" | "topic";
  name: string;
  parentId?: string;
  order?: number;
  description?: string;
  viewMode?: "records" | "fields";
  collectionId?: string;
  fields?: Array<{ name: string; kind: "record" | "sample"; collectionId: string; recordId: string; fieldPath?: string }>;
}

/**
 * Change event kinds. `record` and `sample` are delivered by default; the
 * others must be requested with `kinds`:
 * - `record`  a record was written; with `full: true` `data` is the whole document (replace, never merge)
 * - `sample`  new time-series point(s) of a record (`data` holds the sample fields)
 * - `delete`  the record was deleted
 * - `lock`    lease changed (`data` is the lease or `null`); the revision does not change
 * - `leave`   the record no longer matches the subscription `filter` (drop it from the list)
 */
export type UnsChangeKind = "record" | "sample" | "delete" | "lock" | "leave";

interface UnsChangeBase {
  collection: string;
  recordId: string;
  time: number;
  revision?: number;
}

/** Server-sent change event. Narrow on `kind` before reading `data`. */
export type UnsChange<D = Record<string, unknown>> =
  | (UnsChangeBase & { kind: "record"; data: D; full?: boolean; quality?: string })
  | (UnsChangeBase & { kind: "sample"; data: Partial<D> & Record<string, unknown>; quality?: string })
  | (UnsChangeBase & { kind: "lock"; data: UnsLockInfo | null })
  | (UnsChangeBase & { kind: "delete" | "leave"; data?: undefined });

/**
 * Status of a device command:
 * - `pending`  queued (HTTP devices fetch it)
 * - `sent`     delivered, waiting for the device to acknowledge (final when the source does not wait)
 * - `acked`    the device executed it
 * - `failed`   the device or the target system reported an error (see `error`)
 * - `timeout`  no acknowledgement in time (the device may be offline)
 */
export type UnsCommandStatus = "pending" | "sent" | "acked" | "failed" | "timeout";

/** A command sent to the device behind a record (e.g. switch a light). */
export interface UnsCommand<A = Record<string, unknown>> {
  id: string;
  collection: string;
  recordId: string;
  name: string;
  args: A;
  status: UnsCommandStatus;
  /** What the device / target system answered. */
  result?: unknown;
  error?: string;
  /** Acknowledged after the timeout. */
  late?: boolean;
  createdAt: number;
  sentAt?: number;
  doneAt?: number;
  expiresAt: number;
  sourceId: string;
  instanceId: string;
  requestedBy?: { type: string; id?: string; name?: string };
}

// ---------------------------------------------------------------------------
// Document API (MongoDB-style records:find / update operators / locks).
// The server compiles these to SQL; see docs/uns-data.md "Documents".
// ---------------------------------------------------------------------------

/** Any JSON value. */
export type UnsJson = string | number | boolean | null | UnsJson[] | { [key: string]: UnsJson };

/** `$type` names (JSON types plus `integer`). */
export type UnsJsonType = "null" | "boolean" | "number" | "integer" | "string" | "array" | "object";

type ElementOf<V> = V extends readonly (infer E)[] ? E : never;
/** A field accepts its own type, and an element when it is an array (schema-declared arrays match by containment). */
type FieldValue<V> = [ElementOf<V>] extends [never] ? V : V | ElementOf<V>;

/**
 * Operators on one path. Comparisons are type-strict: `5` never equals `"5"`
 * and `$gt: 10` only matches numbers. `{ f: null }` / `$eq: null` match null
 * and missing; `$ne` / `$nin` also match missing fields.
 */
export interface UnsCondition<V = unknown> {
  $eq?: FieldValue<V> | null;
  $ne?: FieldValue<V> | null;
  $gt?: FieldValue<V>;
  $gte?: FieldValue<V>;
  $lt?: FieldValue<V>;
  $lte?: FieldValue<V>;
  /** At most 1000 values. */
  $in?: Array<FieldValue<V> | null>;
  $nin?: Array<FieldValue<V> | null>;
  $exists?: boolean;
  $type?: UnsJsonType;
  /** Array contains all of these. */
  $all?: Array<ElementOf<V> | UnsJson>;
  /** One array element matches all conditions (no `$regex` inside, ≤ 2 levels). */
  $elemMatch?: Record<string, unknown>;
  $size?: number;
  /** PostgreSQL POSIX regex, ≤ 256 characters. Prefer `$prefix` (index-friendly with a `prefix` index). */
  $regex?: string;
  $options?: "i";
  /** Starts with (extension). */
  $prefix?: string;
  /** `[divisor, remainder]`, numbers only. */
  $mod?: [number, number];
  $not?: UnsCondition<V>;
}

/** Top-level logical operators of a filter. */
export interface UnsFilterLogic<D = Record<string, unknown>> {
  $and?: UnsFilter<D>[];
  $or?: UnsFilter<D>[];
  $nor?: UnsFilter<D>[];
  /** Whitelisted aggregation expression; cannot use an index, combine it with indexed conditions. */
  $expr?: Record<string, unknown>;
  /** Substring match on `_id` and text fields (extension). */
  $search?: string | { text: string; fields?: string[] };
}

/**
 * MongoDB-style filter. Keys are dotted paths (`"line.code"`, `"items.0.sku"`,
 * Chinese names are fine; a literal dot is `"FMaterialId\\.FNumber"`), plus
 * system fields `_id`, `_meta.revision`, `_meta.createdAt`, `_meta.updatedAt`,
 * `_meta.sourceId`, `_meta.sourceTime`, `_meta.locked`. Top-level fields of `D`
 * are type-checked; other paths accept anything.
 *
 * Differences from MongoDB: arrays are not traversed implicitly (`{ tags: "a" }`
 * matches an array only when the schema declares `tags` as `array`; otherwise
 * use `$elemMatch` / `$all`); no `$where`, `$text`, `$geo*`; unknown operators → 400.
 */
export type UnsFilter<D = Record<string, unknown>> = {
  [K in keyof D]?: FieldValue<D[K]> | UnsCondition<D[K]> | null;
} & UnsFilterLogic<D> & { [path: string]: unknown };

/** Sort keys: `[["priority", -1], ["_id", 1]]` (≤ 4). Default `[["_meta.updatedAt", -1]]`; missing fields sort last ascending. */
export type UnsSort = Array<[string, 1 | -1]>;

/** Include (`{ a: 1, b: 1 }`) or exclude (`{ a: 0 }`) paths of `data`; never mix the two. */
export type UnsProjection = Record<string, 0 | 1>;

/** Equality join (`$lookup`). Results land in `record.lookups[as]` (see `lookupOf`). */
export interface UnsLookup {
  /** Collection id in the same workspace (read access is enough). */
  from: string;
  /** Path in this collection; an array value matches any element. Missing / null never matches. */
  localField: string;
  /** `_id` or a path covered by a ready object-form index of `from` (else 400 `lookup_requires_index`). Types must match: `5` ≠ `"5"`. */
  foreignField: string;
  as: string;
  /** Extra condition on the joined documents (cannot reference this collection). */
  filter?: UnsFilter;
  projection?: UnsProjection;
  sort?: UnsSort;
  /** Per document, default 10, max 100; `<as>Truncated` tells when it cut. */
  limit?: number;
}

export interface UnsFindOptions<D = Record<string, unknown>> {
  filter?: UnsFilter<D>;
  projection?: UnsProjection;
  sort?: UnsSort;
  /** Default 20, max 1000. */
  limit?: number;
  /** `nextCursor` of the previous page. */
  cursor?: string;
  /** Legacy offset paging (≤ 10000); not with `cursor`. */
  skip?: number;
  /** Also return `total` (capped at 100000, then `totalCapped`). */
  count?: boolean;
  /** Attach each record's latest sample (`record.latest`). */
  withLatest?: boolean;
  /** At most 2 joins. */
  lookup?: UnsLookup[];
}

export interface UnsFindResult<D = Record<string, unknown>> {
  items: UnsRecord<D>[];
  /** Present when more pages exist: pass it as `cursor`. */
  nextCursor?: string;
  total?: number;
  totalCapped?: boolean;
  /** e.g. `{ code: "lookup_type_mismatch", count }` when join keys had the wrong type. */
  warnings?: Array<{ code: string; count?: number; [key: string]: unknown }>;
}

/** Push modifiers (`$push: { tags: { $each: [...], $slice: -10 } }`). */
export interface UnsPushEach {
  $each: unknown[];
  $slice?: number;
  $position?: number;
  $sort?: 1 | -1 | Record<string, 1 | -1>;
}

/**
 * Update operators (at least one; whole-document replacement is `replaceOne`).
 * Numbers are exact decimals (0.1 + 0.2 = 0.3, big integers keep precision);
 * `$currentDate` writes Unix ms. Positional paths: `items.$.qty` (first array
 * element matched by the filter), `items.$[].qty` (all), `items.$[it].qty` with
 * `arrayFilters: [{ "it.sku": "A" }]`. `_id` / `_meta` cannot be changed.
 */
export interface UnsUpdate<D = Record<string, unknown>> {
  $set?: Partial<D> & Record<string, unknown>;
  $unset?: Record<string, "" | 1 | true>;
  $inc?: Record<string, number>;
  $mul?: Record<string, number>;
  $min?: Record<string, unknown>;
  $max?: Record<string, unknown>;
  $rename?: Record<string, string>;
  /** Only applied when an upsert inserts. */
  $setOnInsert?: Partial<D> & Record<string, unknown>;
  $currentDate?: Record<string, true>;
  $push?: Record<string, unknown | UnsPushEach>;
  $addToSet?: Record<string, unknown | { $each: unknown[] }>;
  $pop?: Record<string, 1 | -1>;
  /** Remove elements equal to a value or matching a condition. */
  $pull?: Record<string, unknown>;
  $pullAll?: Record<string, unknown[]>;
}

/** A lease that must still be held by the caller when the write commits (else 409 `lock_lost`). */
export interface UnsAssertLock {
  collection: string;
  id: string;
  token: string;
}

/** Options shared by single-document writes. */
export interface UnsWriteOneOptions {
  /** Token of the caller's lease on the matched record (required while it is leased; else 423 `locked`). */
  lockToken?: string;
  /** Release that lease in the same transaction. */
  release?: boolean;
  /** Leases that must still be held (leader election / singleton jobs). */
  assertLocks?: UnsAssertLock[];
}

export interface UnsUpdateOneOptions extends UnsWriteOneOptions {
  /** Insert when nothing matches. Without `_id` in the filter a ready unique index on the filter's equality fields is required (400 `upsert_requires_unique_index`). */
  upsert?: boolean;
  /** Which match to update first (best effort under concurrency). */
  sort?: UnsSort;
  arrayFilters?: Record<string, unknown>[];
}

export interface UnsFindOneAndOptions extends UnsUpdateOneOptions {
  /** `before` (default, like MongoDB) or `after` the write. */
  returnDocument?: "before" | "after";
  projection?: UnsProjection;
}

export interface UnsUpdateResult {
  matchedCount: number;
  modifiedCount: number;
  /** Id of the inserted document when an upsert inserted. */
  upsertedId?: string;
}

export interface UnsDeleteResult {
  deletedCount: number;
}

/** One failed document of a batch. */
export interface UnsWriteError {
  index?: number;
  id?: string;
  code: string;
  message: string;
}

export interface UnsManyOptions {
  /** Stop after this many documents (default and max 10000); continue with `resumeAfter`. */
  maxDocs?: number;
  /** `resumeAfter` of the previous response. Without it a rerun starts over (and repeats `$inc`). */
  resumeAfter?: string;
  /** One transaction for everything (≤ 1000 documents, else 400); a leased document fails it with 423. */
  atomic?: boolean;
  /** Default true: stop at the first error; false collects `writeErrors` and continues. */
  ordered?: boolean;
  /** Tokens of the caller's leases, by record id. */
  lockTokens?: Record<string, string>;
}

export interface UnsManyResult {
  matchedCount: number;
  modifiedCount?: number;
  deletedCount?: number;
  /** Skipped because someone else holds a lease. */
  lockedCount?: number;
  hasMore?: boolean;
  resumeAfter?: string;
  writeErrors?: UnsWriteError[];
}

export interface UnsInsertDocument<D = Record<string, unknown>> {
  /** Defaults to a server-generated ULID. A duplicate id is 409 `duplicate_key`. */
  id?: string;
  data: D;
}

export interface UnsInsertManyResult {
  insertedCount: number;
  insertedIds: string[];
  writeErrors?: UnsWriteError[];
}

/** One operation of `bulkWrite` (exactly one key). */
export type UnsBulkOp<D = Record<string, unknown>> =
  | { insertOne: { document: UnsInsertDocument<D> } }
  | { updateOne: { filter: UnsFilter<D>; update: UnsUpdate<D>; upsert?: boolean; sort?: UnsSort; arrayFilters?: Record<string, unknown>[]; lockToken?: string; release?: boolean } }
  | { updateMany: { filter: UnsFilter<D>; update: UnsUpdate<D>; arrayFilters?: Record<string, unknown>[]; maxDocs?: number } }
  | { replaceOne: { filter: UnsFilter<D>; replacement: D; upsert?: boolean; lockToken?: string; release?: boolean } }
  | { deleteOne: { filter: UnsFilter<D>; sort?: UnsSort; lockToken?: string; release?: boolean } }
  | { deleteMany: { filter: UnsFilter<D>; maxDocs?: number } };

export interface UnsBulkResult {
  insertedCount: number;
  matchedCount: number;
  modifiedCount: number;
  deletedCount: number;
  upsertedCount: number;
  lockedCount?: number;
  /** op index → id */
  insertedIds: Record<string, string>;
  upsertedIds: Record<string, string>;
  writeErrors?: UnsWriteError[];
}

/** One single-document operation of `transact` (all run in one database transaction). */
export type UnsTransactOp =
  | { collection: string; op: "insertOne"; document: UnsInsertDocument }
  | { collection: string; op: "updateOne"; filter: UnsFilter; update: UnsUpdate; upsert?: boolean; arrayFilters?: Record<string, unknown>[]; lockToken?: string; release?: boolean; require?: "matched" }
  | { collection: string; op: "replaceOne"; filter: UnsFilter; replacement: Record<string, unknown>; upsert?: boolean; lockToken?: string; release?: boolean; require?: "matched" }
  | { collection: string; op: "deleteOne"; filter: UnsFilter; lockToken?: string; release?: boolean; require?: "matched" };

/** Per-op results of `transact`, in request order. */
export type UnsTransactOpResult = { insertedId: string } | { matchedCount: number; modifiedCount: number; upsertedId?: string } | { deletedCount: number };

export interface UnsTransactResult {
  results: UnsTransactOpResult[];
}

/** Lease specific records (all or nothing; 423 when one is held by someone else). */
export interface UnsLockIds {
  ids: string[];
  /** 1000–300000 ms, default 30000. Renew before it expires; a lease can be held for 1 hour at most. */
  ttlMs?: number;
  /** Shown to others ("edited in planning board"). */
  label?: string;
}

/** Claim up to `limit` unleased records matching `filter` (work queue; concurrent claimers never get the same record). */
export interface UnsLockClaim<D = Record<string, unknown>> {
  filter: UnsFilter<D>;
  sort?: UnsSort;
  /** 1–100. */
  limit?: number;
  ttlMs?: number;
  label?: string;
}

export type UnsLockRequest<D = Record<string, unknown>> = UnsLockIds | UnsLockClaim<D>;

/** A granted lease. The token is returned only here; it only works for the caller that took it. */
export interface UnsLockGrant<D = Record<string, unknown>> {
  id: string;
  token: string;
  /** Increases on every lease of the record (fencing). */
  fence: number;
  expiresAt: number;
  record: UnsRecord<D>;
}

export interface UnsLockRef {
  id: string;
  token: string;
}

export interface UnsExplainResult {
  matchedCount: number;
  capped: boolean;
  sampleIds: string[];
  plan: "index" | "scan";
}

/** Aggregation stage (`$match $group $sort $limit $skip $project $addFields $set $count $unwind $lookup`). Documents look like `{ _id, _meta, ...data }`. */
export type UnsPipelineStage = Record<string, unknown>;

export interface UnsAggregateResult<R = Record<string, unknown>> {
  items: R[];
  truncated?: boolean;
}
