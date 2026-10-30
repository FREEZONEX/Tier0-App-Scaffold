# App Data

Full reference for App records (Tier0 UNS collections). `AGENTS.md` → App Data
keeps the rules that always apply; read this file before declaring or changing
collections, writing services that read or write records, adding live updates,
or evolving a schema. Runtime wiring (UNS operations, call policy, error
mapping) is in [platform-integration.md → App Data](platform-integration.md#app-data).

Business data lives in Tier0 UNS collections owned by this App. There is no
SQL database, ORM, connection string, migration or `db:push` step. Preview and
the deployed App use the **same** collections and the same records.

## Declare collections

Declare every collection in `src/data/collections.ts` and list it in
`collections`:

```ts
import { z } from "zod";
import { defineCollection, type Doc } from "@tier0/sdk-v2/data/define";
import { seedTimestamp } from "./seed-utils";

export const workOrders = defineCollection({
  alias: "work_orders",                     // unique per App, case-insensitive
  name: "Work orders",                      // required business name
  description: "Production work orders",
  schema: z.object({
    code: z.string(),
    status: z.enum(["DRAFT", "RELEASED", "DONE", "CANCELLED"]),
    targetQty: z.number().int().min(1),
    line: z.object({ id: z.string(), name: z.string() }),
    items: z.array(z.object({ sku: z.string(), qty: z.number().int().min(1) })),
    notes: z.string().optional(),
    dueAt: z.string(),                        // ISO instant from toISOString()
  }),
  indexes: [{ path: "code", unique: true }, { path: "status" }],
  seed: [
    { _id: "wo-001", code: "WO-001", status: "RELEASED", targetQty: 50,
      line: { id: "line-1", name: "Line 1" }, items: [], dueAt: seedTimestamp(2) },
  ],
});
export type WorkOrder = Doc<typeof workOrders>;   // { _id, ...fields, _meta }

export const collections = [workOrders] as const;
```

The collection schema is a **storage** schema. UNS stores this subset only, and
`npm run build` fails with the replacement for anything else:

| Use | Instead of |
|---|---|
| `z.string()`, `z.number()`, `z.number().int()`, `z.boolean()` | `z.date()`, `z.bigint()`, `z.any()`, `z.unknown()` |
| `.min()` / `.max()` on numbers (inclusive) | `.positive()`, `.gt()`, `.lt()`, `.multipleOf()` |
| `z.enum([...])` | `z.literal()`, unions, `.nullable()`, `.nullish()` |
| `.optional()` (field may be absent) | `null` values — leave the field out, clear with `$unset` |
| `z.object({...})` (always closed), `z.array(item)` | `z.record()`, `z.looseObject()`, `.catchall()`, `z.tuple()` |
| plain `z.string()`; validate format/length in the API input schema | `z.email()`, `z.uuid()`, `z.iso.datetime()`, `.regex()`, `.min(1)` on strings |
| type annotations via `.meta({ format })`: `"int32"` on `z.number().int()`, `"float"` / `"double"` on `z.number()`, `"date-time"` on `z.string()` | any other `format`; the annotation shows the type in UNS but checks and converts nothing |
| defaults applied in the service | `.default()`, `.catch()`, `.transform()` |

Store dates as `"YYYY-MM-DD"` strings and instants as ISO-8601 UTC strings
from `toISOString()`; both sort and range-filter as strings (a TTL field is
the exception: Unix milliseconds, see TTL below). Record IDs (`_id`)
and `_meta` (`revision`, `createdAt`, `updatedAt` in Unix ms) are system
fields: never declare them. Objects nest at most 8 levels, 128 properties per
object, 100 enum values per field; `.describe()` text is at most 2048 UTF-8
bytes (about 680 CJK characters). An App declares at most 64 collections, and
a collection `description` is at most 512 characters. Descriptions are stored
when a collection or field is first created; changing one later takes
`schema:replace` (see Schema evolution).

API input schemas derive from the declaration and add input rules:

```ts
export const createWorkOrderInput = workOrders.schema
  .omit({ status: true })
  .extend({ code: z.string().trim().min(1).max(32) });
```

Indexes: `{ path }` or compound `{ paths }` (≤3 distinct paths), `unique: true`
for business keys, `kind: "gin"` for one array/object field; at most 16 per
collection. Paths follow object properties only: `items.sku` (a field inside
array items) cannot be indexed — index `items` with `kind: "gin"` or keep the
value in a top-level field. Index the fields lists filter and sort on.

TTL: records that should disappear on their own (login codes, short-lived
reservations, transient sensor alerts) get one TTL index instead of a cleanup
job — `{ path: "issuedAt", expireAfterSeconds: 300 }` on a
`z.number().int()` field holding Unix milliseconds (`Date.now()`; ISO strings
cannot expire). UNS deletes a record `expireAfterSeconds` (60–31536000) after
that instant, physically and with up to minutes of delay, so reads still
compare the time themselves; records without the field never expire. One TTL
index per collection, on a single `path` and not `unique`. ensure may add a
TTL or lengthen it; shortening or removing it takes `schema:replace`.

Seed: baseline records with fixed `_id`s, coherent across lifecycle states,
referencing each other by those IDs (`requireSeedRef()`), dates from
`seedDate()` / `seedTimestamp()`; at most 1000 documents per collection. Seeds
are written **once**, when the collection is created (in atomic chunks of 200,
retried safely); editing `seed` never changes an existing collection. The
build validates every seed document against its schema and unique indexes.
Never insert baseline data from services (on startup, or when a list is empty).

## Model documents, not tables

- Embed what belongs to one record and changes with it (order lines, checklist
  steps, approval history) as arrays inside that document; one write keeps it
  consistent. Keep arrays bounded.
- Reference shared entities by ID plus a snapshot of the fields you display
  (`customer: { id, name }`) instead of joining at read time. `$lookup` exists
  in `aggregate` (see below) but has row limits; do not build list pages on it.
- One collection per business object kind, not per screen.
- Use `_meta.createdAt` / `_meta.updatedAt` for "newest first"; they are kept by
  UNS.

## Read and write

Data access happens only in services:

```ts
import { data } from "@/lib/data";
import { workOrders } from "@/data/collections";

const orders = data.collection(workOrders);

await orders.find({ status: { $in: ["RELEASED", "DONE"] } }, { sort: { "_meta.createdAt": -1 }, limit: 50 }).toArray();
await orders.findOne({ _id: id });
await orders.get([id1, id2]);                              // { items (in request order), missing }
await orders.findPage(filter, { sort, page, pageSize });   // { items, total: { count, capped }, page, pageSize }
await orders.countDocuments({ status: "RELEASED" });       // { count, capped }
await orders.countBy("status", { "line.id": lineId });     // [{ value, count }], largest first
await orders.insertOne({ code, status: "DRAFT", ... });     // optional _id
await orders.insertOne(doc, { returnDocument: "after" });  // { insertedId, value }: the created record with _meta.revision, no extra read
await orders.updateOne({ _id: id }, { $set: { notes } }, { expectedRevision });
await orders.findOneAndUpdate({ _id: id, status: "DRAFT" }, { $set: { status: "RELEASED" } });
await orders.aggregate([{ $match: { status: "DONE" } }, { $group: { _id: "$line.id", total: { $sum: "$targetQty" } } }]).toArray();
```

Also available: `insertMany`, `updateMany`, `replaceOne`, `deleteOne`,
`deleteMany`, `findOneAndReplace`, `findOneAndDelete`, `bulkWrite`
(`insertOne` / `updateOne` / `replaceOne` / `deleteOne`), `distinct`, and
`data.transact(...)`.

A screen that shows several things (a list with its total, status chips, a
selected record, a lookup list) loads them with **one** `data.queryBatch`:
up to 20 reads in one request, all from the same snapshot, typed by name.

```ts
const { list, byStatus, selected } = await data.queryBatch({
  list: orders.query.findPage(filter, { sort, page, pageSize }),
  byStatus: orders.query.countBy("status"),
  ...(selectedId ? { selected: orders.query.get([selectedId]) } : {}),
});
```

`collection.query` builds `find` (first page; `maxCount` adds a capped
total), `findPage`, `count`, `countBy`, `distinct`, `aggregate` and `get`;
each item returns one page (≤200 rows; `query.get` takes 1–100 IDs and
throws a `TypeError` for none, so add it only when there is an ID). A refused item
rejects the whole call with its `DataError`; pass `{ settle: true }` to get
`{ ok: true, value } | { ok: false, error }` per item instead. A statement
timeout or more than 2000 rows / 8 MiB in total fails the batch. Several
separate reads per screen are the main cause of `OVERLOADED`.

Read records by ID with `get(ids)`: IDs that do not exist, are deleted or are
hidden from the current employee by data rules are all listed in `missing`;
treat them all as not found (404), never as "forbidden". More than 100 IDs
are read in chunks.

Batch sizes and atomicity:

| Call | Limit | Atomic |
|---|---|---|
| `insertMany`, `bulkWrite`, `data.transact` | ≤200 items per call; more fails with `BATCH_LIMIT_EXCEEDED` before sending | yes, all or nothing |
| `updateMany`, `deleteMany` | none; pages through every match | no — like Mongo: UNS commits chunks of 50 documents; a failure after some committed is `execution: "committed"` (see below) |

Write more than 200 records in chunks of 200 (a loop over chunks is fine). When
several documents must change all or nothing, use one `data.transact` (≤200
steps), not `updateMany`.

When `updateMany` / `deleteMany` fails after part of it committed, the
`DataError` keeps the failing `code` but has `execution: "committed"`,
`retry.safe: false`, and `details` with the totals so far
(`status: "partiallyCommitted"`, `resumeAfter`). Never rerun the whole call —
`$inc` / `$push` would apply twice to the committed records; continue from
the failure point instead:

```ts
try {
  await orders.updateMany(filter, update);
} catch (error) {
  const resumeAfter = error instanceof DataError && error.execution === "committed" ? error.details.resumeAfter : undefined;
  if (typeof resumeAfter !== "string") throw error;
  await orders.updateMany(filter, update, { resumeAfter });
}
```

`insertMany` and `bulkWrite` never commit part of a batch: when UNS rejects
an item, the whole batch is rolled back and the error is `WRITE_ERRORS` with
`execution: "rolledBack"` and only `details.writeErrors` (no `resumeAfter`).
Fix or drop the rejected items and send the batch again.

Do not pass idempotency keys: the data layer gives every write call its own
and reuses it when it resends the call, so a retry never applies a write
twice. A new call is a new write; when you re-run work after
`outcomeUnknown`, fixed `_id`s and conditional updates keep it from
duplicating.

- Filters use field paths without `data.` (`status`, `line.id`, `_id`,
  `_meta.updatedAt`) with `$eq $ne $gt $gte $lt $lte $in $nin $exists $all $size
  $elemMatch $not $and $or $nor` and `$contains`. `$contains` is a substring
  match (1–256 bytes, no wildcards or regex) that ignores case for ASCII
  letters only (`É` and `é` differ); missing, null and non-string values never
  match, and it works on fields declared as strings only — on an array or
  number field it fails with `INVALID_REQUEST`. It cannot use an index: on
  large collections it can hit the query time limit (`QUERY_TIMEOUT`),
  so combine it with an indexed condition. `$in` takes at most 200 values.
  Sort by at most 4 fields.
- `find()` returns a cursor that pages 200 at a time; always give list reads a
  `limit`. For numbered list pages (MetaListPage `meta/query`) convert the
  request with `queryRequestToFind(request, { paths, instantFields })`, call
  `findPage(...)` (one request: the page and its total from the same
  snapshot) and answer `toQueryResult(page, { map, groups })`. Kit `LIKE` /
  `NOT_LIKE` become `$contains` / `$nor`, so offer them only on string fields.
- Counts are capped: `findPage` counts up to 10000 (`maxCount` up to 100000),
  `countDocuments` up to 100000. `capped: true` means "at least `count`" —
  show it as "10000+" (`toQueryResult` sets `totalCapped`, which the kit
  renders that way); never page through records to count them.
- Statistics (status chips, per-line totals, dashboard tiles) are one
  `countBy(field, filter)` or one `aggregate` with `$group`, never one count
  per value.
- `aggregate()` supports `$match`, `$sort` (`{ field: 1 | -1 }`), `$group`,
  `$project`, `$set`, `$unwind`, `$skip`, `$limit`, `$count` and `$lookup`. Write
  `$lookup` with `from` set to a declared collection (or its alias):
  `{ $lookup: { from: customers, localField: "customer.id", foreignField: "_id", as: "customer" } }`;
  the data layer turns it into the collection ID. The `$exists`, `$distinct` and
  `$frequencies` stages are not executed for records; use `countBy`,
  `countDocuments`, `distinct` or `$group`.
- Writes are validated against the declaration before they are sent: unknown
  fields, wrong types and undeclared update paths fail with 400. Reads are
  **not** strictly parsed: a record may hold fields written by another code
  version, a newer enum value, or lack a field added later. Render enums with a
  fallback label and treat fields added later as possibly absent.
- Update with `updateOne` + `$set` / `$inc` / `$push` / `$unset`.
  `replaceOne` rewrites the whole body and drops fields written by other code
  versions.
- Never call the data layer once per loop iteration or per `map` item (ESLint
  flags it): read with one `get` / `$in` or `data.queryBatch`, write with
  `insertMany` / `updateMany` / `bulkWrite`, or use `data.transact`. Looping
  over 200-item chunks of a batch call is the exception and is not flagged.
- Deletes are soft and need `uns.delete` on the App key; without it the call
  fails with a 403 that says so (`error.reason` `APP_PERMISSION_MISSING`). Business records usually end with a status
  (`CANCELLED`, `ARCHIVED`) rather than a delete.

## Consistency

- One document is written atomically: keep data that must change together in
  one document.
- State transitions: put the expected state in the filter,
  `findOneAndUpdate({ _id, status: "DRAFT" }, { $set: { status: "RELEASED" } })`.
  `null` means the record is missing or already moved — answer 409.
- Concurrent edits: send `_meta.revision` from the edit form as
  `expectedRevision`; `VERSION_CONFLICT` (409) means reload and retry.
- Cross-document invariants (stock + reservation, order + audit entry): one
  `data.transact([...])` (≤200 steps) with `record.check` / `record.update` /
  `record.create` steps, `dependsOn` and `bindings`; a `record.query` step can
  assert `expectCount: { min, max }`. It commits all or nothing; it is not a
  session, so there is no read-then-decide inside it. Step `data` never holds
  `_id` (set `id` on the step); fields filled by `bindings` are checked when
  UNS commits, every literal field is validated before sending.
- Counters and sequence numbers: declare a counters collection and use
  `findOneAndUpdate({ _id: "work_orders" }, { $inc: { value: 1 } }, { upsert: true })`.
- An upsert filter must contain `_id` or every field of a **ready** unique index
  (`UPSERT_REQUIRES_UNIQUE_INDEX` otherwise; a new unique index builds
  asynchronously).
- `DUPLICATE_KEY` (409) means a unique index rejected the value; show it as a
  field error.

## Live updates

Pages that must show other users' changes without a reload (boards, queues,
station screens) subscribe in the browser instead of polling:

```tsx
import { useRecordChanges } from "@/lib/record-changes";

const list = useRequest("work-orders", (signal) => requestJson<WorkOrder[]>("/api/work-orders", { signal }));
useRecordChanges(["work_orders"], () => list.refresh());
useRecordChanges(["work_orders"], () => detail.refresh(), { recordIds: [id] });
```

Pass collection aliases, not declarations: importing `@/data/collections`
into a page ships its schemas and seeds to the browser.

- An event says only which record changed (`collection`, `recordId`,
  `revision`, `change: "record" | "delete"`), never its data. Reload through
  the App's own API: that is where roles and employee data rules apply. The
  callback receives the events of the last 300 ms as one batch
  (`batch.changes`); `batch.reset: true` means changes may have been missed,
  so reload everything the view shows (sent when UNS dropped the resume
  position, access changed or a collection was recreated, when the App
  server lost its upstream, and when the stream itself was closed for good,
  e.g. a 401 after the session expired).
- Use an event only as "reload this". Changes of one record may arrive out
  of order: the data layer drops a `record` change older than what it
  already passed on, but passes every `delete`, even one that arrives after
  a newer change, and a record deleted and written again under the same ID
  starts over at revision 1. Never compare `revision`s, remove a row on
  `delete` without reloading, or rebuild state from the order of events.
- A collection with employee data rules never reveals which record changed:
  its changes arrive as aliases in `batch.collections` (also when you passed
  `recordIds`). Reload whatever the view shows from that collection.
- The App server holds one upstream subscription per process for every
  declared collection (`/api/uns/subscribe`, `src/lib/data/changes.ts`) and
  fans it out to all browsers; subscribing per page is cheap. Browsers
  reconnect and resume on their own; the server ends each stream after about
  10 minutes so the reconnect is authenticated again.
- Every signed-in user may subscribe to every declared collection; a
  user learns record IDs only of collections without employee data rules.
- App records are always covered by a subscription: do not poll them with
  `refetchInterval` / `usePolling`, and never subscribe from services.

## Who the call acts as

Every call uses the platform-injected App key. While serving a business request
the data layer also forwards the Gateway's employee assertion
(`X-Tier0-App-Data-Subject`), so UNS data rules and record leases apply to that
employee. Collection ensure and seed writes run as the App. Work detached from
the request (timers, queues, fire-and-forget follow-ups) must run inside
`runAsApp(() => ...)`; a lease taken under an employee cannot be released by
such App-level work. `src/start.ts` opens the SDK's request context
(`runWithRequestContext(request, ...)` from `@tier0/sdk-v2/data`, which also
cancels data calls when the caller goes away); never add a context of
your own — data calls would silently run as the App. A malformed subject
header is a `TypeError` (500), not a `DataError`.

## First load

The first data access in a server process ensures every declared collection in
one batch: missing collections are created (then seeded), wider declarations
widen storage, and nothing is ever narrowed. A failed ensure is retried by the
next request (a freshly imported App may briefly answer `APP_NOT_READY`,
which the data layer retries and the App answers as 503). Do not ensure
manually, do not touch data at import time, and do not cache your own
"initialized" flags.

A running process also recovers when a collection it uses disappears (a
Preview reset deletes collections; a worker or admin may archive one): a call
that UNS refuses with `COLLECTION_NOT_FOUND` or `COLLECTION_NOT_GRANTED` (the
`data.reason` code) makes the data layer ensure again — recreating and reseeding what is missing — and retry the
call once when a collection ID changed. This happens at most once per 30 s per
process; `APP_GRANT_REVOKED` (an admin decision) is never retried. Cursor
pages and `updateMany` / `deleteMany` continuations of the old collection fail
instead of retrying; the next request uses the new collection.

In Preview, a schema conflict or an ensure warning fails the request with the
details; fix the declaration. The deployed App logs them and keeps serving.
`ignored` notes never fail a request: parts of storage wider than the
declaration are logged as info, and `ANNOTATION_NOT_APPLIED` (an edited
`.describe()` or collection `description` that ensure does not write) as a
warning that points at `schema:replace`.

Runtime data failures are `DataError`s (`status`, `code`, `reason`,
`execution`, `retry`, `outcomeUnknown`, `attempts`, `details` = the UNS
envelope `data`, `cause`); let them reach `withErrors`. The data layer has
already resent the call when `retry.safe` allowed it (overload `OVERLOADED`
429, `APP_NOT_READY`, temporary failures, a read whose answer did not arrive
— not `QUERY_TIMEOUT`, which needs a narrower query), so do not
wrap data calls in retry loops of your own. Branch on `code` / `reason`, never
on message text. `execution` says how far the request got: `notStarted` /
`rolledBack` changed nothing, `unknown` (`outcomeUnknown: true`, writes only)
means it may have landed — read back before writing again. `withErrors`
answers `{ error, code, requestId }` and, for a 429 / 503 that is safe to
repeat, `Retry-After`. A
frequent `OVERLOADED` means the App sends too many requests: merge page reads
into one `data.queryBatch` and drop per-record loops. Full mapping:
`docs/platform-integration.md` → Errors.

## Schema evolution

Preview and the deployed App share collections, and an older deployed build
cold-starts with its older declaration at any time. ensure therefore only
**widens**: storage is the union of every declaration that ever ran, and every
version's writes stay valid. Plan each change by its row:

| Change | How |
|---|---|
| Add an optional field (any depth, also inside array items), add an enum value, make a field optional, `int` → `number`, widen or remove `min`/`max`, add an index | Edit `collections.ts`; ensure applies it on next access. |
| Change a `.describe()` text or the collection `description` | Edit `collections.ts`, then `schema:replace` through the tier0 MCP with `npm run data:schema -- <alias>` (`dryRun` first: expect `widened`; `narrowed` means storage holds more than this declaration, e.g. fields of another version — merge them into the body or stop). ensure keeps stored annotations and reports `ANNOTATION_NOT_APPLIED`; new fields and new collections take their descriptions on creation. |
| Add a field every record must have | Add it `.optional()`, write it everywhere, backfill old records, then make it required with `schema:replace` once the deployed App writes it. |
| Remove or rename a field | Stop using the old field in code (it may stay in storage); a new name is a new optional field. Backfill once through the tier0 MCP (`records:updateMany` with `$rename` / `$set`). |
| Change a field's type | Use a new field name, backfill, read the old field as fallback. ensure never converts types (`SCHEMA_CONFLICT`). |
| Remove an enum value, make an optional field required, drop a field from storage, remove an index, tighten `min`/`max` | Only after the deployed App no longer writes the old shape: `schema:replace` through the tier0 MCP, `dryRun` first. |

Never `deleteMany` or recreate a collection to "reset" a schema: it deletes the
deployed App's data too. Changing `seed` does not reseed.

## Collections through the tier0 MCP

Workers inspect and change this App's collections with `tier0_execute`
(`tier0.request({ method: "POST", path, body })`); runtime code must not call
these (the build flags `schema:replace`, `archive` and `restore` paths in App
code to catch mistakes).

| Need | Call (`/openapi/v2` prefix) |
|---|---|
| App ID, collections, grants, current schemas, revisions, index status, TTL and limits | `POST /uns/app/context` with `{}` (whoami does not return the App ID) |
| Preview a declaration change | `npm run data:schema`, then `POST /uns/app/collections/ensure` with that body plus `"dryRun": true` |
| Narrow a schema | `npm run data:schema -- <alias>` for the target, then `POST /uns/app/collections/schema:replace` with `{ alias, recordSchema, indexes, expectedRevision, dryRun: true }`; repeat with `dryRun: false` |
| Change descriptions of existing fields or the collection | Same as narrowing: `schema:replace` with the `npm run data:schema -- <alias>` body (status `widened`) |
| Retire / bring back a collection | `POST /uns/app/collections/archive` or `restore` with `{ alias }`; at most 2000 records each (archive tombstones them, restore brings that batch back) |
| One-off data fix or backfill | `POST /uns/collections/{collectionId}/records:updateMany` (collection ID from the context) |

`expectedRevision` is the collection `revision` from `/uns/app/context` or an
ensure result (a `dryRun: true` ensure returns it without changing anything). Schema paths in
`ignored`, `warnings`, `conflicts` and `violations` join properties with `.`
and array items with `[]` (`items.[].qty`). The spec may take up to 10 minutes
to list new operations in `tier0_search`.

| Error | Meaning and action |
|---|---|
| `SCHEMA_CONFLICT` (409) | The declaration cannot be joined with storage; nothing changed. `data.conflicts` lists `{ alias, path, reason, current?, declared? }`: `TYPE_CONFLICT` → use a new field name; `LIMIT_EXCEEDED` → split the structure; `JOIN_UNSUPPORTED` → storage holds a node the declaration cannot widen (e.g. enum values outside its `min`/`max`), repair it with `schema:replace`; `DATA_RULE_FIELD` → an employee data rule (owner/state field) uses the path, keep it required with the same type or ask an admin to change the rule; `OPEN_OBJECT` → use the generated body; `ALIAS_IN_USE` / `NAME_IN_USE` → pick another alias; `INVALID_INDEX` → fix the index. |
| `ANNOTATION_NOT_APPLIED` (`ignored` note) | Not an error: ensure keeps stored titles/descriptions. Apply the change with `schema:replace`. |
| `REQUIRED_NOT_ENFORCED` (warning) | The declaration requires a field storage keeps optional. Make it optional again, or narrow with `schema:replace` after the backfill. |
| `INDEX_BUILD_FAILED` (warning) | Existing records violate a new unique index. Fix the duplicates; the next ensure retries. |
| `OLD_WRITERS_REJECTED` (warning, replace) | Code that still writes the removed shape will now fail; deploy the new code first. |
| `SCHEMA_DATA_VIOLATION` (409, replace) | Records do not fit the narrower schema; `data.violations` lists up to 20 `{ recordId, path }`. Fix them first. |
| `SCHEMA_MIGRATION_TOO_LARGE` (409, replace) | More than 10,000 records or 16 MB. Keep the field optional in storage; enforce the rule in code. |
| `VERSION_CONFLICT` (409, replace) | The collection changed; read the context again and retry with its revision. |
| `REFERENCED` (409, replace) | A topic field or data rule still uses the path; remove that use first. |
| `TEMPORARILY_UNAVAILABLE` | Retry the same request later. |
| `APP_GRANT_REVOKED` (403) | A workspace admin removed this App's access (ensure, replace, archive); ensure does not re-grant. Ask the admin. |
| `APP_QUOTA_EXCEEDED` (409) | `data.resource` says which per-App limit of 64 was hit: `collections` (active) → archive unused ones; `indexes` → drop indexes from the declaration and `schema:replace`; `archivedCollections` (archive) → restore one or ask an admin to clean up. |
| `INDEX_QUOTA_EXCEEDED` (409) | The workspace holds 200 indexes that physically exist (archiving keeps unique indexes); drop unused indexes. |
| `COLLECTION_TOO_LARGE` (409, archive / restore) | More than 2000 records (`data.maxRecords`). Do not archive large collections; stop using them in code. |
| `DUPLICATE_KEY` (409, restore) | A restored record collides with an active record on a unique index; nothing was restored. Fix the active record first. |
| `NOT_FOUND` (404) | The alias is not one of this App's collections. |
| `data.reason` on record calls | `COLLECTION_NOT_GRANTED` (403): the grant does not cover the collection or operation; `COLLECTION_NOT_FOUND` (403/404): archived or deleted — the App's data layer re-ensures on both; `APP_PERMISSION_MISSING` (403, `data.missingPermission`): the key lacks e.g. `uns.delete`. Judge by these codes, never by message text. |
| `DUPLICATE` (409, restore) | An active collection already uses the alias (`data.activeCollectionId`); archive it first. |
| `FORBIDDEN` (403) | The key may not do this (another App's or a shared collection), or it was revoked. |
| `APP_NOT_READY` (503) | The platform is still preparing a freshly imported App; retry shortly. |
