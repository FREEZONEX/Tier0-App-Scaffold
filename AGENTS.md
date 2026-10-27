# Tier0 Industrial App Scaffold

This repository is a TanStack Start 1.x application scaffold (Vite 8,
TanStack Router, React 19, Zod, TailwindCSS 4, and Tier0 UNS collections as
the only data store). It is not Next.js:
do not use `next/*`, App Router conventions, `next/headers`, or Next metadata.
Do not re-initialize the project.

Build a usable industrial application, not a demo. Prefer a small number of
complete workflows over a wide read-only shell.

## Delivery Floor: Complete the Legal Lifecycle

Infer each business object's lifecycle from the domain. Do not mechanically add
CRUD to every collection: a valid termination, correction, or operational
command is often safer than direct update/delete.

| Object kind | Expected first-slice lifecycle |
|---|---|
| Master data and configuration | create, view/search, edit, deactivate/archive; hard-delete only when safe |
| Transaction document | create, view, edit while draft, submit, cancel/void/correct after submission |
| Inventory, balance, ledger, or genealogy | view plus domain commands such as receive, issue, adjust, freeze, release, reverse; no arbitrary row editing |
| Task, approval, alert, or case | create/raise when applicable, assign/process, decide, close/reopen or cancel |
| Audit event or derived result | read-only unless the domain defines an explicit acknowledgement or recalculation action |

Only implement actions that have business meaning, but finish every applicable
path end to end: reachable UI → validation → permission check → service/API
mutation → persisted result → visible success/error feedback. Refreshing the
page must preserve successful changes. A visible capability without that path
is incomplete.

- Management applications are not read-only unless the user asks for a monitor,
  report, or prototype. Intentional read-only workspace pages carry a
  `READ_ONLY_SURFACE: <reason>` comment explaining why.
- Every mutation handler under `src/routes/api/**` has a UI caller using
  `apiUrl()`. External-only handlers carry an `EXTERNAL_CALLER` comment naming
  the caller.
- Seed data starts the experience; it does not replace operations. Use coherent,
  populated records across relevant lifecycle states (declared once as
  collection `seed`, see App Data).
- Avoid placeholder modules and copy such as “Coming soon”, “Demo mode”, or
  “can be added later”.
- Dangerous or irreversible operations show impact, ask for confirmation, and
  leave an audit trail when the domain requires one.

## Managed Preview Workflow

Dependencies are installed automatically by `preview_start`. Do not run
`npm install` manually or start a dev server yourself; both race the managed
preview environment.

1. Use `preview_start` after a meaningful implementation slice.
2. On failure, inspect `preview_logs`, fix the cause, then use `preview_restart`.
3. When a local preview URL is returned, run
   `npm run smoke:routes -- <local-url>`; it automatically checks every sidebar
   target. Add changed key routes that are intentionally outside the sidebar.
4. Tell the user the preview is ready; never paste the container-local URL.

After adding a dependency, restart the managed preview. If the same error
recurs three times, stop patching and report the blocker.

## Sources of Truth

- `specs/spec.md`: durable product intent when present. Update only affected
  business fields, roles, rules, workflows, or terminology; skip it for visual
  polish and build repairs.
- `DESIGN.md` and `src/styles/globals.css`: visual tokens and product feel.
- Component types/JSDoc under `src/components/**`: point-of-use composition
  guidance.
- `docs/platform-integration.md` and `docs/role-registration.md`: platform
  runtime and role contracts.

Platform-injected Builder guidance may own orchestration, UI generation,
responsive review, locale/copy, industrial patterns, and Tier0 SDK workflows.
Keep this scaffold Skill-name agnostic. `.agents/skills/` is an empty platform
placeholder; do not vendor Skills here.

## Scaffold Map

```text
src/
  start.ts                     gateway auth + CSRF middleware (do not modify)
  router.tsx                   router factory (do not modify)
  routes/
    __root.tsx                 root document + Toaster
    _app.tsx                   sidebar workspace layout
    _app.index.tsx             pre-generation Preview placeholder; replace or redirect
    station.tsx                scan/tap/confirm layout
    review.tsx                 evidence/decision layout
    monitor.tsx                passive fixed-board layout
    login.tsx                  hidden platform-auth error bridge
    api/**                     thin HTTP wrappers
    api/uns/subscribe.ts       record change stream for useRecordChanges (do not modify)
  services/**                  domain logic, state machines, data access
  data/collections.ts          collection declarations + seed (source of truth)
  data/seed-utils.ts           seed date/reference helpers
  components/
    ui/                        visual primitives
    forms/                     safe form composition
    overlays/                  dialogs, drawers, confirmation
    data/                      async and table helpers
    actions/                   transparent recommendation/impact actions
    layouts/                   route-group shells
  lib/                         auth, permissions, routing and runtime helpers
  lib/data/                    App instance of the @tier0/sdk-v2/data client (locked)
  lib/record-changes.ts        useRecordChanges(): live record changes in the browser
server.mjs                     production entry (do not modify)
artifact.toml                  platform build/run contract
```

Do not modify generated `src/routeTree.gen.ts`. Preserve `src/start.ts`,
`src/router.tsx`, `src/lib/data/**`, Gateway/auth helpers, the health,
manifest, auth and `api/uns/subscribe` routes, the root document structure,
production entry, and existing Vite SSR policy unless the user explicitly asks
for platform/runtime work.

## Architecture and Domain Rules

Use three layers:

1. `src/routes/api/**`: authenticate, parse with Zod, call a service, return a
   response through `withErrors`.
2. `src/services/**`: business invariants, lifecycle transitions, data
   access through `@/lib/data`, and audit side effects.
3. `src/data/collections.ts`: collection declarations (Zod schemas, indexes,
   seed) and the types derived from them.

Hard invariants:

- Import `@/lib/data` (and values from `@tier0/sdk-v2/data`) only from
  `src/services/**`; the data client is server-only and must not reach the
  browser bundle. ESLint and the locked `src/lib/data-contracts.test.mjs` flag
  accidental violations (static guard rails, not a security boundary). Any
  file may import declarations from `@/data/collections` and from
  `@tier0/sdk-v2/data/define`, and types from `@tier0/sdk-v2/data`.
- Keep `Request`, `Response`, and `Headers` out of services. Services return
  typed values and throw `HttpError` for caller-facing failures.
- Define lifecycle transitions once in the owning service. Reject illegal
  transitions with a conflict/error instead of silently rewriting state.
- Never fetch Tier0 UNS paths yourself and never put `TIER0_API_KEY` in the
  browser; the data layer is the only UNS client.

## App Data

Business data lives in Tier0 UNS collections owned by this App. There is no
SQL database, ORM, connection string, migration or `db:push` step. Preview and
the deployed App use the **same** collections and the same records.

### Declare collections

Declare every collection in `src/data/collections.ts` and list it in
`collections`:

```ts
import { z } from "zod";
import { defineCollection, type Doc } from "@tier0/sdk-v2/data/define";
import { seedTimestamp } from "./seed-utils";

export const workOrders = defineCollection({
  alias: "work_orders",                     // unique per App, case-insensitive
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

### Model documents, not tables

- Embed what belongs to one record and changes with it (order lines, checklist
  steps, approval history) as arrays inside that document; one write keeps it
  consistent. Keep arrays bounded.
- Reference shared entities by ID plus a snapshot of the fields you display
  (`customer: { id, name }`) instead of joining at read time. `$lookup` exists
  in `aggregate` (see below) but has row limits; do not build list pages on it.
- One collection per business object kind, not per screen.
- Use `_meta.createdAt` / `_meta.updatedAt` for "newest first"; they are kept by
  UNS.

### Read and write

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

### Consistency

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

### Live updates

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

### Who the call acts as

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

### First load

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

### Schema evolution

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

### Collections through the tier0 MCP

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

## Routing and Server Boundaries

TanStack Router uses file names as route structure:

| File | URL / purpose |
|---|---|
| `routes/_app.index.tsx` | `/`, sidebar workspace index |
| `routes/_app.settings.tsx` | `/settings`, standalone page with no child routes |
| `routes/_app.work-orders.tsx` | parent of the two rows below; renders `<Outlet />` only |
| `routes/_app.work-orders.index.tsx` | `/work-orders`, the default list |
| `routes/_app.work-orders.$id.tsx` | `/work-orders/:id`, nested detail |
| `routes/_app.reports_.$id.tsx` | `/reports/:id`, detail that opts OUT of nesting |
| `routes/station.receiving.tsx` | `/station/receiving` |
| `routes/review.exceptions.tsx` | `/review/exceptions` |
| `routes/monitor.line-status.tsx` | `/monitor/line-status` |
| `routes/api/work-orders.ts` | `/api/work-orders` |

Choose one coherent app chrome. Use `_app` for management/planning/admin work;
`station` for task-first execution; `review` for evidence/decisions; `monitor`
for passive boards. A custom prefixed layout is acceptable when none fits.
Do not add an empty pathless layout that conflicts with `/`.

**A resource with a detail page must use one of exactly two shapes.** The `.`
separator nests routes, so `_app.work-orders.$id.tsx` is a child of
`_app.work-orders.tsx` and renders through the parent's `<Outlet />`. A parent
that draws its own list markup without an outlet still type-checks, lints and
builds — the detail page simply never renders, and nobody finds out until they
click a row.

- **Nested**: parent renders `<Outlet />` only, the list lives in a sibling
  `.index.tsx`, the detail in `.$param.tsx`. A parent may also render its own
  content *plus* `<Outlet />` when a master-detail layout is intended.
- **Non-nested**: append `_` to the parent segment (`_app.reports_.$id.tsx`) so
  the detail page renders standalone and the list route stays a plain page.

`npm run build` fails on any other shape, naming the offending resource; the
check lives in `src/lib/route-nesting-contracts.test.mjs` and is a locked gate.

`Route.useParams()` and `Route.useSearch()` are synchronous. Define
`validateSearch` when reading query strings.

TanStack Start does not use React Server Components. Components and route files
enter the client bundle; server-only APIs belong inside API handlers,
middleware, or `createServerFn().handler(...)`. Never import or call
`@tanstack/react-start/server` APIs from client render code or effects.
`Headers` is iterable rather than enumerable: inspect it with `.get()` or
`Object.fromEntries(headers.entries())`, not `JSON.stringify(headers)`.

## Gateway Authentication and Roles

The platform Gateway owns login and injects identity. The App does not manage
passwords, users, cookies, local sessions, login/register APIs, or logout.

- Deployed roles come from the complete comma-separated
  `X-Tier0-Business-Roles` set. Effective permissions are the union of all
  assigned roles.
- `X-Tier0-Active-Role` / `user.primaryRole` is display metadata only; never
  choose one “highest” role for authorization.
- Preview uses the comma-separated `X-Tier0-Preview-Role` role set selected by
  the developer (one or several roles, permission union); a preview request
  without a selected role enters with zero roles and zero permissions.
- Unknown trusted roles contribute zero permissions; explicit empty deployed
  roles remain zero-access. Forgeable unknown legacy roles fail closed.

Register roles in one pass:

The scaffold ships with no roles: `PERMISSION_MATRIX`, `ROLE_METADATA`, and
`roles.json` start empty, and no role name is reserved — define `admin` only
if the business genuinely needs a role by that name. Default the first version
to no more than three roles chosen for materially different permission scopes.
Do not create one role per page, action, or job title.

1. Define actions and `PERMISSION_MATRIX` in `src/lib/permissions.ts`.
2. Mirror every matrix role in `src/lib/role-metadata.ts` and `roles.json` —
   every role, no exceptions. `role_key` values use ASCII snake_case.
3. Guard APIs with `requireAuth(...)` and UI actions with
   `can(user.roles, action)`; both use permission-union semantics.
4. Verify each role's reachable navigation and actions.

Role display belongs to the global `Shell` user block only. Do not add page-body copy explaining what Admin, Operator, Member, or another role can do;
show permission differences through real visibility and access behavior.
Do not modify `src/start.ts`, `src/lib/{gateway,auth}.ts`, or
`src/routes/api/auth/**`.

## UI and Client Runtime

Use `DESIGN.md`, existing tokens, and the shipped primitives as a neutral
toolkit; choose compositions from the workflow rather than treating this list
as a mandatory page recipe.

- `ui`: `Button`, `StatusBadge`, `Card`, `PageHeader`,
  `StatusFilterChips`, `RiskBanner`, `EmptyState`, `StatCard`.
- `forms`: `FieldGroup`, `FormGrid`, `RecordSelect`, `FileUpload`,
  `LineItemSection`.
- `overlays`: `Dialog`, `FormDialog`, `ConfirmDialog`, `Drawer`.
- `data`: `AsyncView`, `DataTable`, `TableViewport`, table cell helpers.
- `actions`: `RecommendationAction` and `ImpactPreviewDialog` for transparent
  automatic/recommended/bulk changes.

List-type pages (master data, ledgers, documents, tasks, and searchable record
collections) default to `MetaListPage` from
`@/components/kit/meta/meta-list-page`. Configure the object metadata and extend
its `onCreate`, `onOpenRecord`, `rowActions`, `batchActions`, `cellRenderers`,
`headerExtra`, and `toolbarExtra` hooks rather than rebuilding the query,
view, column, sorting, and pagination shell. Follow
[docs/component-kit.md](docs/component-kit.md#列表类型页面默认使用-metalistpage)
for the application-scoped provider, real data adapter, and permission contract.
`DataGrid` / `DataTable` are lower-level tables; `DetailTable` is for editable
line items, not the default list-page foundation. Enable only capabilities the
business needs and the application actually implements.

Use a different composition when the user explicitly requests it or a concrete
workflow does not fit a metadata list (for example a chart-first report,
Kanban/Gantt board, scan-first station, or embedded detail table). Record that
reason in implementation notes; do not invent a new list shell for cosmetic
variation. A narrow repair to an existing working page does not by itself
require migrating the whole page.

Wrap every ordinary `_app` workspace page in
`<div className="page-shell ...">`. The shared class provides responsive page
padding (compact on phones, wider on desktop) and keeps direct children
shrinkable; keep page-specific vertical rhythm such as `space-y-6` on the same
element. Do not add a second outer `px-*` / `py-*` layer. Station, review, and
monitor layouts own their spacing separately and do not use `page-shell`.

Required fields use `FieldGroup required` or `FieldLabel required` with plain
title text. Show exactly one red asterisk to the right of the title, never
below the control. Do not hand-write stars, reverse label direction, or put
controls inside `FieldLabel`. Keep `required` / `aria-required` and validation
on the control separately; the marker is visual only.

Keep forms controlled and stable: do not key fields from their current value or
declare field components inside a form render. Validate inputs and show
success/error through `toast()`.

Never call the browser-native `alert()`, `confirm()`, or `prompt()` APIs,
including through `window`, `globalThis`, or `self`. They expose the Preview
host, block the page, and cannot follow the app's theme, locale, or mobile
layout. Use the application primitives instead:

- Use `toast()` for success, failure, and other information that does not need
  acknowledgement. Use `Dialog` when acknowledgement is part of the workflow.
- Use `ConfirmDialog` for risky or irreversible actions. Name the affected
  object and consequence, use a concrete action label such as Delete or
  Deactivate, set `destructive` when appropriate, and wire `pending` so a
  submission cannot be repeated. Cancelling before submission must not mutate
  data. `pending` disables footer actions, but does not block Esc, backdrop or
  header-close dismissal. Choose the in-flight close policy for the workflow:
  guard `onOpenChange(false)` while pending if dismissal must wait; if dismissal
  is allowed, retain operation state and report the eventual result. Closing
  does not abort an already-submitted request. Handle async errors in the caller.
- Use `FormDialog` for requested input, with controlled fields, validation, and
  an explicit submit label.

Load local APIs with `requestJson()` (it applies `apiUrl()`); pass the loader
`signal` through. Shared loads use stable primitive request keys with
`useRequest()` / `usePolling()`; do not depend on a newly created loader
function each render. Render request state through `AsyncView` so failures show
an error and retry instead of indefinite loading.

Keep live data current without routine Refresh buttons: `useRequest` revalidates
on visible/reconnect; shared operational lists of App records refresh on
`useRecordChanges` (see Live updates). `{ refetchInterval: 15000 }` /
`usePolling` are only for data a subscription cannot cover (platform SDK data,
external systems). Call `refresh()` after a successful mutation and for error retry. Keep
form drafts separate from fetched data so background updates cannot erase edits;
immutable reads can disable `refetchOnWindowFocus` / `refetchOnReconnect`.

A failed request must reach `console.error`, never only an error state:
`requestJson()` reports a non-2xx response with the server `cause` before it
throws (a 5xx is also sent to the Builder preview as a `network` error, which
shows its blocking error card), and the hooks report any other loader failure. The Builder preview
console only sees `console.error`; a silently caught fetch looks like an empty
page while the real cause stays in the server log. Do not wrap `requestJson()`
in a `catch` that drops the error.

Route `errorComponent`s render `RouteErrorBoundary` and nothing else. It shows
no visible error UI: the Builder preview intercepts the failure through the
preview bridge and shows its own error card with Retry and Agent fix. Do not
add a page-level "failed to load" headline, message, or Retry button.

Do not add a page-introduction subtitle that explains navigation or repeats the title.
Put actionable rules and risk beside the affected record/control. Role
summaries stay out of page content. Shell `defaultModules` starts empty; declare
real workspace routes through `defineNavigationModules`, using one unique href
per clickable leaf. Do not create an Overview module unless the product needs one.

Wide tables own their horizontal scroll region. Interactive pages remain usable
at 375px without page-level overflow; station controls are touch-friendly and
monitor boards fit their intended viewport. `npm run build` checks known source
patterns through the locked `src/lib/responsive-contracts.test.mjs` gate; it
does not measure rendered layout or prove 375px usability. Inspect affected
pages at a real 375px viewport when browser tooling is available, and report
when that check could not be run. The static checks cover these patterns:

- A search or filter control declares a **bounded** width. `flex-1` alone lets it
  swallow the whole toolbar on a wide screen and squeeze its siblings on a narrow
  one, so pair it with a ceiling — `w-full max-w-xs`, or `min-w-0 flex-1 max-w-sm`
  when it must share a row. This applies to `input`, `select` and `textarea`;
  `flex-1` on layout containers is unaffected.
- A minimum width above 375px belongs **inside** a horizontal scroll region.
  Copy `TableViewport`: `overflow-x-auto` on the outer element, `min-w-[720px]`
  on the inner one, so the sideways scroll stays local instead of moving the page. Use `ClientOnly` for Recharts,
dnd-kit, motion layout, or browser-only render paths. Recharts also needs a
non-zero container and `ResponsiveContainer`.

Keep `.tsx` component modules component-only for Fast Refresh; put runtime
constants/helpers in sibling `.ts` files. Import motion from `@/lib/motion`.
Use TailwindCSS 4 through `src/styles/globals.css`; do not add
`tailwind.config.js`, PostCSS wiring, or a second design system.

## Tier0 SDK

Use the installed `@tier0/sdk-v2` (`0.3.0`, pinned exactly in `package.json`;
never change that dependency) when requirements involve the
Tier0 platform: user/platform info, members, notifications, files, MQTT/MQ/
WebSocket, controls or capabilities. Load it with the lazy helpers from
`@/lib/tier0` inside the concrete server action — `loadTier0Sdk()` and then
`createClient()` for `tier0.system`, `members`, `notifications`, `files`,
`mqttAuth`, `controls`; `loadTier0Mq()` for `Tier0MQClient`. Do not top-level
import or invoke SDK modules on SSR startup paths. Keep `vite.config.ts`
`ssr.external: ["@tier0/sdk-v2", "mqtt"]`. Create a fresh client per request
when passing employee data delegation; the App key never reaches the browser.

v2 has no UNS v1, legacy Flow or project member queries. Workspace members are
not the members who can use this App: use `tier0.members.listApp({ appId })`
with `resolveAppId()` for App-scoped pickers. Locally `resolveAppId()` is the
`local-app` placeholder and the platform rejects the call; that is expected —
App-scoped calls only work in Preview and deployed runs.

App records (UNS v2 collections) are the one exception: use `data` from
`@/lib/data` (see App Data) — the App's instance of the `@tier0/sdk-v2/data`
client — not `tier0.uns` and not hand-written fetches.

For notifications, omitted `channels` means Web & Desktop plus Mobile; use `[]`
for inbox only, `['web']` or `['mobile']` for explicit scope. There is no
`desktop` channel. See `docs/platform-integration.md` for notification mode,
MQTT broker handling and MQTT credentials. For MQTT authentication failures,
check the installed SDK and injected key type before changing credentials; do
not hard-code username/clientId to bypass SDK identity derivation.

The platform injects SDK hosts, keys, and connection details. Do not add them
to `.env.example`, collections, or user-facing settings unless the user
explicitly requests an operator-managed credential console. Keep human app
names separate from `APP_ID`/manifest runtime identifiers.

When the app must identify itself to the platform (notification `sender.id`
and similar), use `resolveAppId()` from `@/lib/app-id` — the platform-injected
`APP_ID`, i.e. the agent-platform App UUID — read at runtime. Never hard-code
its value at generation time: an imported copy of the app gets a new UUID and
a hard-coded value keeps pointing at the source app, so the notification's
name, icon and Open button silently break.

Do not use the sandbox file system for application-generated or user-uploaded
data. Use the platform File Storage API instead.

## App Identity and Product Copy

Set `APP_NAME` and `APP_LOCALE` once in `src/lib/app-chrome.ts`; update used
layout shells and platform App Info in the same closeout. Product UI uses one
explicit locale unless bilingual output is requested.

`APP_ID` is a platform-owned runtime identifier: the agent-platform App UUID,
injected into Preview and deployed runs. Never hard-code, rename, or surface
it as the app's name or business identity.
Without injection it resolves to `local-app` (`src/lib/app-id.ts`) — a
local-development placeholder only. The full contract lives in
`docs/platform-integration.md`.

On first generation and every rebrand, complete all four steps below before
reporting App Identity finished. Platform-registered image assets must have a
stable source copy at the project root so Download Source Code and Download
Snapshot retain the same files; never register a temporary or workspace-external
file as the only copy.

1. Create a domain-specific app icon following `DESIGN.md` → App Icons and export the final asset as
   root `icon.png` (512×512, ≤2 MB). This matches the platform import/export
   package name. Coded artwork is allowed: SVG,
   Canvas, Node, HTML/browser rendering, or another deterministic drawing path
   may be used to produce the PNG. Use a rounded-square tile, a vivid tonal
   gradient, and a centered white or lightly tinted business symbol with subtle
   highlights and shallow layered depth. Keep generous padding and a clear
   silhouette at 32px; omit text and fine detail. Do not leave the scaffold
   placeholder unchanged.
2. Copy that exact file byte-for-byte to `public/app-icon.png` (also 512×512,
   ≤2 MB), then set `APP_ICON = "/app-icon.png"` in `src/lib/app-chrome.ts`.
   The public copy is the runtime asset; root `icon.png` is the durable
   registration/export source. Never generate the two copies independently.
3. Sync the root source with `update_app_info({ icon_path: "icon.png" })`,
   including name/description when changed. If either root persistence or the
   public copy fails, do not register the icon or report App Identity complete.
4. When registering a designed/generated cover with `cover_path`, first save
   the final file as root `cover.png` (PNG, ≤8 MB), matching the platform
   package name, then call `update_app_info({ cover_path: "cover.png" })`.
   This rule applies on first generation and every cover change; do not
   register a temporary path or a second independently generated image. If
   both icon and cover change, persist both root files before one
   `update_app_info` call.

Page titles name the work. Visible copy describes business data, state, action,
or consequence—not design-system commentary or implementation notes. Remove
scaffold/default branding from the finished app.

## Build, Gates, and Deployment

Run `npm run build` for completion. Its postbuild verifies the client/SSR
bundle, gate integrity, TypeScript, ESLint, contracts, runtime safety, and
first-load behavior. UI advisories are review prompts rather than failures.
Do not bypass completion with `vite build` alone.

Contract files have two classes:

- `src/lib/template-state.test.mjs` describes the blank template and is the only
  contract test generated apps may adapt.
- Every other test under `src/lib/`, the data-layer wiring `src/lib/data/**`,
  gate/verify/audit scripts and `scripts/gate-integrity.json` are locked. Do
  not edit, weaken, or delete them. Use documented opt-outs such as
  `EXTERNAL_CALLER` / `READ_ONLY_SURFACE`, or report a genuine conflict.

`artifact.toml` `args` are literal POSIX argv. Shell semantics use an explicit
`["sh", "-c", "..."]`; plain commands use token arrays. Leave build/run args
unchanged unless the task is deployment work.

Environment contracts are documented in `docs/platform-integration.md`.
Important names are `TIER0_API_HOST` and `TIER0_API_KEY` (data layer and
SDK), `APP_ID`, and `VITE_BASE_PATH` (`NEXT_PUBLIC_BASE_PATH` is legacy only).
Apps have no database connection variables.

## Scaffold Version

`package.json.tier0Scaffold` (`{ "version": <positive integer>, "ref":
"<scaffold commit sha>" }`) records which Tier0-App-Scaffold version this app
was generated from. The platform reads it when the app is imported and prompts
alignment when it is missing or differs from the current scaffold; nothing at
runtime depends on it, and `npm run build` only warns when it is missing or
malformed.

- Never edit `tier0Scaffold` by hand, and never remove it. It is not an app
  setting, and changing the number does not align anything.
- The align-platform-app Skill writes the version and ref it was pinned to
  after a successful alignment; that is the only path that updates the field
  inside an app.

## Completion Check

- The requested core workflows satisfy their legal lifecycle rather than
  blanket CRUD or read-only listing.
- Every exposed action is reachable, permissioned, validated, persisted, and
  reports success/error; dangerous actions confirm impact.
- Service boundaries, state transitions, consistency patterns (conditional
  updates, `expectedRevision`, `data.transact`) and audit effects hold; every
  collection is declared, listed and seeded in `src/data/collections.ts`.
- Role matrix, metadata, `roles.json`, navigation, UI actions, and API guards
  agree; multiple roles grant the permission union.
- Loading, error/retry, empty, and populated states are visible and usable.
- App identity, locale, platform metadata, navigation, responsive behavior,
  and visible copy form one coherent product.
- `npm run build` and route smoke pass before completion is reported.

## Generic component kit

Before generating forms, tables or reusable editors, consult
[docs/component-kit.md](docs/component-kit.md) and reuse `src/components/kit`.
Keep business objects, services and roles in the application. Data-backed kit
components require an application-scoped `ComponentKitProvider`; logical resource
paths do not imply backend endpoints exist. Never import `gallery/fixtures.ts`
into an app. Preserve existing auth/permission guards and the scaffold theme;
enabled inputs use white surfaces, with gray fill reserved for disabled controls.
