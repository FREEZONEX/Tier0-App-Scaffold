# UNS Data (Tier0 UNS v2)

Tier0 UNS is the workspace's shared data layer: machines, work orders,
inventory, quality results and their time series, collected from factory
systems or written by apps. It is also where the app keeps its **own**
business data (app-owned collections); there is no app database. Collections
work like MongoDB collections: query with filters, sorts, cursors and joins,
write with update operators, upserts, atomic find-and-modify, cross-collection
transactions and leases. Read this before building any page that shows or
records data.

## Model

| Concept | Meaning | Example |
|---|---|---|
| Collection | One kind of object with a JSON schema (≈ a MongoDB collection) | `equipment`, `work_orders` |
| Record | One object's current state (≈ a document: `id` ↔ `_id`, `data` ↔ body, `revision`) | `equipment/A-VMC-01` |
| Sample | A time-series point of a record (collections with a `sampleSchema`) | spindle speed every second |
| Latest | The newest sample of a record | current machine state |
| Topic tree | Directories and topics users browse (`listNodes`) | `Plant0 / Machining / A-VMC-01` |
| App-owned collection | A collection the app created under its prefix; deleted with the app | `app.7bdba8039b80.inspections` |
| Lease (lock) | A time-limited claim on a record: others get 423 until it expires | edit lock, work-queue item |
| Command | An action sent to the device behind a record (collections with `commandable: true`) | `set {on: true}` to `lights/light-01` |

All times are Unix milliseconds. The platform stores everything in three
internal tables; **never connect to the platform database or those tables**:
schemas, revisions, latest values and change events are maintained by the API.

## Access rules

- Server code only: import from `@/lib/uns.server` inside route handlers
  (`createFileRoute(...).server.handlers`), `createServerFn` handlers or
  services. The platform injects `TIER0_API_HOST`, the app key `TIER0_API_KEY`
  and `TIER0_APP_COLLECTION_PREFIX` in Preview and in deployed runs; never
  expose them to the browser, never add them to `.env.example` or settings UI.
- Browser code calls the app's own API routes (`apiUrl('/api/...')` through
  `useRequest`) and gets live updates with `useUnsChanges()` from
  `@/lib/uns-live`, which connects to `src/routes/api/uns/subscribe.ts`.
- What the app key (`sk-app-`) may do:

  | Operation | App-owned collections (`app.<appKey>.*`) | Every other collection |
  |---|---|---|
  | Read: definitions, `find` / `count` / `distinct` / `aggregate` / `lookup`, samples, latest, subscribe, topic tree, search | yes | yes |
  | Create a collection | only ids with the app prefix (else 403) | — |
  | Change the definition (schema, indexes, name) | yes | 403 |
  | Delete with all data (`DELETE ?purge=true`) | yes | 403 |
  | Write records / samples (all write calls, `transact`) | yes | 403 (read-only) |
  | Lease records (`lock` / `renew` / `unlock`, force unlock) | yes | 403 |
  | Send device commands (`sendCommand`) | — | yes, to `commandable` collections |
  | Sources, streams, instances, settings, MCP | no | no |

  The app key has full access *within* those limits (it may delete and
  force-unlock in its own collections), but every write, lock and `transact`
  op is checked against the collection owner.
- Do not use `@tier0/sdk` `unsApi` / `flowApi`, MQTT topics, `Metric/Action/State`
  paths or Node-RED flows: they belong to the retired v1 platform and fail.

## App-owned collections (the app's own data)

Business data the app manages itself (forms, approvals, app-specific orders,
settings) goes to app-owned collections. Their ids are
`<TIER0_APP_COLLECTION_PREFIX><name>`, where the prefix is
`app.<first 12 hex characters of the App id>.` (for example
`app.7bdba8039b80.inspections`). The platform records the owning app
(`ownerApp`) and **purges these collections when the app is deleted**; a
template-library preview reset purges them too. An app imported into another
project gets a new id, so never hard-code the prefix: use `appCollectionId(name)`
or a collection handle. Without the prefix variable the helpers derive it from
`APP_ID` when that is the App UUID, otherwise they throw 503 `not_configured`
(plain local development).

Declare each collection once, in the service that owns it:

```ts
// src/services/inspections.ts
import { defineAppCollection } from "@/lib/uns.server";
import { HttpError } from "@/lib/route-handlers";

export type Inspection = { code: string; workOrder: string; result: "pending" | "pass" | "fail"; inspector?: string; decidedAt?: number };

export const inspections = defineAppCollection<Inspection>("inspections", {
  name: "Inspections",
  recordSchema: {
    type: "object",
    properties: {
      code: { type: "string" },
      workOrder: { type: "string" },
      result: { type: "string", enum: ["pending", "pass", "fail"] },
      inspector: { type: "string" },
      decidedAt: { type: "number" },
    },
    required: ["code", "workOrder", "result"],
  },
  indexes: [
    { path: "code", unique: true },      // natural key: 409 duplicate_key, upsert by code
    { path: "workOrder" },               // filter / lookup target
    { paths: ["result", "decidedAt"] },  // filter by result, sort by time
  ],
}, {
  // runs when the collection was just created or is empty; fixed ids → 409 = already there
  seed: () => [{ id: "INS-0001", data: { code: "INS-0001", workOrder: "WO2610-0505", result: "pending" } }],
});

// A state transition is ONE atomic request: the filter is the precondition.
export async function decide(id: string, result: "pass" | "fail", inspector: string) {
  const updated = await inspections.findOneAndUpdate(
    { _id: id, result: "pending" },
    { $set: { result, inspector }, $currentDate: { decidedAt: true } },
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(409, `Inspection ${id} is not pending any more`);
  return updated;
}
```

- **Definitions converge automatically.** Each handle method first calls
  `ready()`: GET the collection; 404 → create it; definition differs → PATCH
  it (schema, `indexes`, name, description, `sampleSchema`, `recordMode`); a
  409 race with another process → read again. New object-form indexes are
  awaited until built (bounded), so an upsert right after the first call
  works; a unique index that cannot be built over existing duplicates throws
  409 `index_failed` with an example. This runs once per process.
  `ensureAppCollection(name, def)` does the same without a handle;
  `appCollection(name)` gives the same document methods for a collection that
  is ensured elsewhere.
- **Schema evolution.** Existing records are not rewritten. Add new fields as
  optional (or backfill them with `updateManyAll`) instead of adding them to
  `required` on a collection that already has data. Changing `indexes` is
  limited to once per minute per collection.
- **Indexes.** Declare the fields you filter, sort or join on as object-form
  indexes: `{ path }` (btree), `{ path, unique: true }`, `{ path, kind:
  "prefix" }` (for `$prefix`), `{ path, kind: "gin" }` (array containment),
  `{ path, kind: "ttl", expireAfterMs }` (auto-delete by a Unix-ms field),
  `{ paths: [a, b] }` (compound, ≤ 3). The legacy string form (`"status"`)
  only serves the old `listRecords({ filter })` query. ≤ 16 per collection.
- **Seeding.** `seed` runs only when the collection was created or is empty,
  so user deletions stay deleted. Use fixed, readable ids; never
  `randomUUID()` / `Date.now()` in a seed (the runtime audit rejects it).
  `seedAppRecords(name, records)` is the low-level form.
- **Reset.** `resetAppCollection(name)` / `handle.reset()` deletes the
  collection with all records and samples (`DELETE ?purge=true`); the next
  call recreates and re-seeds it. Use it for explicit "reset data" actions
  only.
- `listAppCollections()` lists the app's own collections; `isAppCollection(id)`
  tells whether an id belongs to the app.
- Writing to *other* collections is not possible from the app: data that
  other systems must see goes to the app's own collections (they are readable
  by the whole workspace).

## Discover before you build

Data already flowing into the workspace is the main reason to build on UNS.
Inspect it first instead of inventing collections:

```ts
import { listCollections, collection, getLatestMany } from "@/lib/uns.server";

const collections = await listCollections();                         // ids, names, schemas, counts, indexes
const sample = await collection("work_orders").find({ limit: 5 });   // newest first
const live = await getLatestMany("equipment");                       // newest sample per machine
```

When you need to explore interactively, a temporary server route that returns
these values is fine; remove it before finishing. Use the field names exactly as
they appear in `recordSchema` / `sampleSchema` and in real records (Chinese
names and names with dots are common in plant data).

## Reading (documents)

Every collection has the same read handle: `collection(id)` for workspace
data, your `defineAppCollection` / `appCollection` handle for app data.

```ts
import { collection, lookupOf } from "@/lib/uns.server";

type WorkOrder = { code: string; status: string; line: string; qty: number; customerId: string; dueAt: number };
const workOrders = collection<WorkOrder>("work_orders");

// one page; filters use MongoDB operators, keys are dotted paths
const page = await workOrders.find({
  filter: { status: { $in: ["RELEASED", "RUNNING"] }, qty: { $gte: 10 }, "工单号": { $prefix: "WO26" } },
  projection: { code: 1, status: 1, qty: 1, dueAt: 1 },
  sort: [["dueAt", 1]],
  limit: 50,
  cursor: req.cursor,          // nextCursor from the previous page
  count: true,                 // also return total (capped at 100000)
});
// → { items: UnsRecord<WorkOrder>[], nextCursor?, total? }

const one = await workOrders.findOne({ code: "WO2610-0505" });           // null when missing
const byId = await workOrders.get("WO2610-0505");                         // by record id
const { count } = await workOrders.count({ status: "RUNNING" });
const { values: lines } = await workOrders.distinct<string>("line");

// join: each order with its customer (foreignField must be _id or an indexed path)
const withCustomer = await workOrders.find({
  filter: { status: "RELEASED" },
  lookup: [{ from: "customers", localField: "customerId", foreignField: "_id", as: "customer", projection: { name: 1 }, limit: 1 }],
});
const customer = lookupOf<{ name: string }>(withCustomer.items[0], "customer").items[0]?.data.name;

// aggregation: documents in the pipeline look like { _id, _meta, ...data }
const perDay = await workOrders.aggregate<{ _id: number; qty: number; orders: number }>([
  { $match: { status: "DONE" } },
  { $group: { _id: { $dateTrunc: { date: "$dueAt", unit: "day", timezone: "Asia/Shanghai" } }, qty: { $sum: "$qty" }, orders: { $count: {} } } },
  { $sort: { _id: 1 } },
]);

// walk every match (cursor paging under the hood; stops after max, default 10000)
for await (const wo of workOrders.iterate({ filter: { line: "L1" }, limit: 500 })) { /* … */ }
```

- **Filter operators**: `$eq $ne $gt $gte $lt $lte $in $nin $exists $type $all
  $elemMatch $size $regex ($options: "i") $prefix $mod $not`, top-level `$and
  $or $nor $expr $search`. System fields: `_id`, `_meta.revision`,
  `_meta.createdAt`, `_meta.updatedAt`, `_meta.sourceId`, `_meta.sourceTime`,
  `_meta.locked`. A key with a literal dot is written `"FMaterialId\\.FNumber"`.
- **Paging**: `limit` default 20, max 1000; use `nextCursor` (stable under
  inserts), not `skip` (legacy, ≤ 10000). Expose the cursor through your API
  route (`?cursor=`) for "load more" / infinite lists. Default sort is
  `[["_meta.updatedAt", -1]]`; ≤ 4 sort keys.
- **Projection** in `find` keeps responses small (the public entry is slow);
  `{a: 1}` includes, `{a: 0}` excludes, never mixed. The record's `data` then
  holds only those fields: do not write it back.
- **Joins** (`lookup`, ≤ 2): left outer, equality only, results in
  `record.lookups[as]` (read with `lookupOf`), `<as>Truncated` when more than
  `limit` (default 10, max 100) matched. The joined field must be `_id` or have
  a ready object-form index in the other collection (400
  `lookup_requires_index`). Types must match (`"5"` ≠ `5`; a
  `lookup_type_mismatch` warning tells you); join on the string form with
  `$addFields` + `$toString` in an aggregation.
- **`withLatest: true`** attaches each record's latest sample in one call.
- Legacy: `listRecords(collection, { filter: { status: "RUN", qty: { gte: 10 } }, sort: "-updatedAt", offset })`
  still works (top-level fields, text comparison), but use `find` for new code.

### Differences from MongoDB

| Topic | UNS | MongoDB |
|---|---|---|
| Types | Strict: `5` ≠ `"5"`, `$gt: 10` matches numbers only; JSON types only (dates are Unix ms or ISO strings) | type brackets, Date / ObjectId |
| Arrays | Not traversed implicitly: `{ tags: "a" }` matches an array only when the schema declares `tags` as `array`; otherwise use `$elemMatch` / `$all`. A path through an undeclared array is 400 | implicit |
| Sort order | `null < string < number < boolean < array < object`; arrays / objects compare by length first; missing fields sort **last** ascending | missing first |
| Upsert without `_id` | Needs a ready **unique** index on the filter's equality fields (400 `upsert_requires_unique_index`) | allowed (can duplicate) |
| Unique index | Missing fields are not constrained (like `unique + sparse`) | `null` and missing collide |
| Collections | Must exist with a schema; every write is validated against `recordSchema` | created on insert |
| Writes | App: own collections only (403 elsewhere); `_id` / `_meta` cannot be written | — |
| Lookup | Equality only, indexed target, no `let`/`pipeline`, missing local value matches nothing, unknown `from` is 404 | — |
| Expressions | Wrong types give `null` (no error); `$round` rounds half up; `$dateTrunc` weeks start Monday | errors, banker's rounding, Sunday |
| Not supported | `$where`, `$function`, `$text`, `$geo*`, `$facet`, `$merge`, interactive sessions / transactions | — |

## Writing (documents)

App writes go to app-owned collections. Pick the operation by intent:

| Need | Use | Not |
|---|---|---|
| Status transition / approval | `findOneAndUpdate({ _id, status: "from" }, { $set: { status: "to" } }, { returnDocument: "after" })` → `null` = precondition failed | read → modify → write with `revision` → retry on 409 |
| Counter, stock, sequence number | `$inc` (`findOneAndUpdate` with `{ qty: { $gte: n } }` in the filter for "only if enough") | reading, adding in JS, writing back |
| Create-or-update by a natural key | `{ path, unique: true }` index + `updateOne({ code }, { $set, $setOnInsert }, { upsert: true })` | find then insert (races) |
| Create with a known id | `insertOne(data, { id })` → 409 `duplicate_key` when it exists | — |
| Change many records | `updateManyAll(filter, update)` / `deleteManyAll(filter)` (resumes with `resumeAfter`) | client-side loops over pages |
| Several records must change together | `transact([...])` (≤ 100 single-document ops, one DB transaction) | ordered writes with manual compensation |
| Someone is editing / a worker owns an item | `lock` / `renew` / `unlock` (below) | a `lockedBy` field |

```ts
import { appCollection, transact } from "@/lib/uns.server";

const stock = appCollection<{ sku: string; qty: number }>("stock");
const orders = appCollection<{ code: string; status: string; sku: string; qty: number }>("orders");
const events = appCollection<{ type: string; order: string }>("events");

// counter / stock: one atomic request; null = not enough stock
const left = await stock.findOneAndUpdate({ _id: "SKU-1", qty: { $gte: 3 } }, { $inc: { qty: -3 } }, { returnDocument: "after" });

// upsert by natural key (needs { path: "sku", unique: true } on stock)
await stock.updateOne({ sku: "SKU-9" }, { $setOnInsert: { qty: 0 }, $set: { name: "Bolt M6" } }, { upsert: true });

// insert: id defaults to a ULID; pass one for deterministic, retry-safe ids
const { insertedId } = await orders.insertOne({ code: "O-1", status: "new", sku: "SKU-1", qty: 3 }, { id: "O-1" });
await orders.insertMany(rows.map((r) => ({ id: r.code, data: r })), { ordered: false });

// bulk change, resumed until done (each document atomic, the whole run is not)
const totals = await orders.updateManyAll({ status: "new", createdBy: userId }, { $set: { status: "cancelled" } });

// several collections atomically: all or nothing
await transact([
  { collection: orders.id, op: "updateOne", filter: { _id: "O-1", status: "paid" }, update: { $set: { status: "shipped" } }, require: "matched" },
  { collection: stock.id, op: "updateOne", filter: { _id: "SKU-1", qty: { $gte: 3 } }, update: { $inc: { qty: -3 } }, require: "matched" },
  { collection: events.id, op: "insertOne", document: { data: { type: "shipped", order: "O-1" } } },
]);
```

- **Update operators**: `$set $unset $inc $mul $min $max $rename $setOnInsert
  $currentDate (Unix ms) $push ($each $slice $position $sort) $addToSet $pop
  $pull $pullAll`, positional `items.$.qty`, `items.$[].qty`,
  `items.$[it].qty` with `arrayFilters: [{ "it.sku": "A" }]`. Numbers are
  exact decimals (0.1 + 0.2 = 0.3). An update needs at least one operator;
  whole-document replacement is `replaceOne`.
- **Atomicity**: every single-document call is atomic. `updateMany` /
  `deleteMany` / `bulkWrite` are atomic per document only (like MongoDB) and
  process ≤ 10000 documents per call: `hasMore` + `resumeAfter` mean "call
  again with it" (`updateManyAll` / `deleteManyAll` do that, bounded by
  `maxRounds`). A rerun without `resumeAfter` starts over and repeats `$inc`.
  `atomic: true` makes one call a single transaction (≤ 1000 documents).
  Before a large change, `explain("updateMany", filter)` returns how many
  documents match.
- **`transact`** ops: `insertOne`, `updateOne`, `replaceOne`, `deleteOne`, each
  with its own `collection` (all must be the app's). `require: "matched"`
  makes an op that matches nothing roll everything back (409
  `precondition_failed`, `err.opIndex`).
- **Retries**: give documents ids, or pass `idempotencyKey` to `insertMany` /
  `insertOne` / `bulkWrite` / `transact`; a repeated request with the same
  key returns the first result (24 h).
- **Optimistic checks**, when a user edits a form based on what they saw:
  put `"_meta.revision": rev` in the filter (no match → `matchedCount: 0` /
  `null`), or pass `ifMatch: record` (ETag) to `patchRecord` / `putRecord` /
  `deleteRecord` (412 `precondition_failed` when it changed). `handle.update(id,
  next)` (read-modify-write with retries) remains only for changes operators
  cannot express.
- Simple REST writes still exist: `createRecord`, `patchRecord` (merge),
  `putRecord` (replace, `ifNoneMatch: "*"` = create only), `deleteRecord`,
  and on handles `create` / `patch` / `put` / `remove`.
- Collection and record ids: letters, digits, `_ . : -`; record ids may contain
  `/` (URL-encoded automatically). Collection ids are at most 128 characters
  including the prefix. Data must satisfy the schema (400 `validation_failed`);
  top-level keys `_id` / `_meta` are reserved; a document is at most 1 MB.
- Writes from the app trigger the same change events as factory data, so
  other apps and UNS automations see them immediately.

Time series (collection needs a `sampleSchema`; give ids so retries do not
duplicate):

```ts
import { appendSamples, deleteSamples, appCollectionId } from "@/lib/uns.server";
await appendSamples(appCollectionId("line_kpis"), "L1", [{ id: `L1-${t}`, time: t, data: { oee: 0.82 } }]);
await deleteSamples(appCollectionId("line_kpis"), { records: ["L1"], from: "-30d", to: "-7d" });
```

## Locks (leases)

A lease marks a record as taken for `ttlMs` (1000–300000, default 30000).
While it is valid, every other writer gets **423 `locked`** (`err.lockedUntil`,
`err.lockPrincipal`); the holder writes with its `lockToken` and may release in
the same write. Leases expire on their own, so a crashed worker or closed tab
never blocks forever. They do not block reads; records show `lock: {
principal, label, expiresAt }` (no token). Source-written collections cannot
be locked.

```ts
// Edit lock: lock when the form opens, renew every ~20 s, save + release.
const [lease] = await orders.lock({ ids: [id], ttlMs: 60_000, label: user.name });    // 423 when someone else edits
await orders.renew([{ id, token: lease.token }], 60_000);                              // 409 lock_lost → tell the user
await orders.updateOne({ _id: id }, { $set: changes }, { lockToken: lease.token, release: true });
await orders.unlock([{ id, token: lease.token }]);                                     // cancel

// Work queue: claim up to 10 pending jobs; concurrent workers never get the same one.
const jobs = await queue.lock({ filter: { status: "pending" }, sort: [["priority", -1]], limit: 10, ttlMs: 120_000 });
for (const job of jobs) {
  await process(job.record.data);
  await queue.updateOne({ _id: job.id }, { $set: { status: "done" } }, { lockToken: job.token, release: true });
}

// Singleton job / leader: lease a fixed record (create it once, e.g. as a seed) and assert it on every write.
const [leader] = await locks.lock({ ids: ["daily-report"], ttlMs: 300_000 });
const held = [{ collection: locks.id, id: "daily-report", token: leader.token }];
await reports.updateOne({ _id: day }, { $set: report }, { upsert: true, assertLocks: held });   // 409 lock_lost if it expired
```

- Tokens appear once (in the `lock` result) and only work for the caller that
  took the lease. For app server code that caller is the app key, shared by
  every user of the app, so the token is what tells users apart: return it
  only to the page that took the edit lock, have that page send it back on
  renew / save / cancel, and pass it on as `lockToken`. Put the user's name in
  `label` so others see who is editing (`record.lock.label`, display it as
  "reported by the client").
- 409 `lock_lost` (renew / write with an expired or taken-over lease): stop
  the work, reload, tell the user.
- `*Many` writes skip records leased by others (`lockedCount`); `atomic: true`
  fails with 423 instead.
- A lease can be renewed for 1 hour in total; then lock again.
  `forceUnlockRecords` releases someone else's lease (app: own collections;
  logged) for "take over" buttons.

## Controlling devices (commands)

UNS is two-way. A record of a device collection is the device's **reported
state**; a **command** travels back to the device through the same source
(MQTT device, HTTP device, HTTP API, broker). Collections that accept commands
have `commandable: true`.

```ts
import { getCollection, collection, sendCommand, getCommand, listCommands } from "@/lib/uns.server";

const lights = await getCollection("lights");                  // lights.commandable === true
const { items } = await collection("lights").find();           // reported state: { on, brightness, ... }

// switch light-01 on and wait up to 8 s for the device to answer
const cmd = await sendCommand("lights", "light-01", { name: "set", args: { on: true }, wait: 8000 });
if (cmd.status === "acked") { /* done; the new state arrives as a record change */ }
else if (cmd.status === "failed") { /* show cmd.error */ }
else if (cmd.status === "timeout") { /* the device did not answer (offline?) */ }
else { const final = await getCommand(cmd.id, { wait: 10000 }); }   // still sent / pending

const history = await listCommands("lights", "light-01", { limit: 10 });
```

- Look at the collection description, records and the command history to learn
  the device's command names and arguments (for example `set {on, brightness}`,
  `toggle`); a wrong name or argument returns 400 `validation_failed`.
- **The command never edits the record.** Do not write a device collection to
  "switch" it (403 anyway). Show the control as pending (spinner / disabled)
  until the command finishes, then let the record change event
  (`useUnsChanges` on the device collection) update the UI. If the command
  fails or times out, show the error and keep the reported state.
- Call `sendCommand` from a server route or server function (POST), never
  from the browser; disable the button while a command is running so users do
  not queue duplicates. Commands are rate-limited per device source (429).
- Do not simulate devices in the app or write fake state; when
  `commandable` is false the data is read-only.

## Live updates

```ts
// server: src/routes/api/uns/subscribe.ts already forwards the SSE stream.
// browser:
import { useUnsChanges, applyUnsChange } from "@/lib/uns-live";

// a list: replace / insert / remove records as they change
useUnsChanges<Order>(
  { collections: [ordersId], kinds: ["record", "delete", "leave"], filter: { status: "open" } },
  (ev) => setRows((cur) => applyUnsChange(cur, ev)),
  { onReset: () => reload() },          // the server could not resume: reload the snapshot
);

// one machine's live values
useUnsChanges({ collections: ["equipment"], records: [machineId], kinds: ["sample"] }, (ev) => {
  if (ev.kind === "sample") setLive((prev) => ({ ...prev, ...ev.data, time: ev.time }));
});
```

- Load the initial snapshot through an API route (`find`), then apply changes;
  do not poll UNS in a tight loop.
- **Kinds**: `record` and `sample` by default; request `delete` (record
  deleted), `leave` (no longer matches `filter`, remove it), `lock` (lease
  changed: `ev.data` is the lease or `null`) explicitly.
- **`record` events carry the whole document** (`full: true`): replace the
  record's data, never merge (merging keeps fields removed by `$unset` or
  `replaceOne`). `applyUnsChange` does this, ignores stale revisions, inserts
  new full records (`insert: "start" | "end" | false`) and removes deleted /
  left ones.
- **`filter`** (same language as `find`, exactly one collection, ≤ 32
  conditions) is evaluated on the server; records that stop matching arrive as
  `leave`. Delete and sample events are not filtered.
- **Resume and reset**: each event has an id; reconnects resume from the last
  one (`Last-Event-ID`, kept for about an hour). When that is not possible the
  server sends `reset` and `onReset` (default: the `onOpen` callback) must
  reload the snapshot. Joins are not pushed: subscribe to both collections and
  re-query on change.
- Machine data can produce hundreds of samples per second, so the subscribe
  route merges each record's changes per second by default (`coalesceMs` to
  change it, minimum 200): a `sample` event holds the latest value of every
  sample field that changed. Re-render only the affected record.

## Errors

Functions throw `UnsError` (`status`, `code`, `message`, `details`); it extends
`HttpError`, so `withErrors` turns it into a JSON response `{ error, code }`.
Branch on `code` (or `isUnsError(e, "locked")`):

| Status | `code` | Meaning |
|---|---|---|
| 400 | `bad_request`, `bad_query`, `validation_failed`, `upsert_requires_unique_index`, `lookup_requires_index` | fix the request / schema / indexes |
| 404 | `not_found` | collection or record missing (`getRecord`, `getLatest`, `findOne`, `get` return `null` instead) |
| 409 | `duplicate_key` | the id or a unique index value exists |
| 409 | `conflict` | stale `revision` (legacy body field) |
| 409 | `precondition_failed` | a `transact` op with `require: "matched"` matched nothing (`err.opIndex`) |
| 409 | `lock_lost` | your lease expired or was taken: stop the work |
| 409 | `index_failed` | a declared unique index could not be built (duplicates exist) |
| 412 | `precondition_failed` | `ifMatch` ETag no longer matches: reload |
| 413 | `document_too_large` | document over 1 MB |
| 423 | `locked` | leased by someone else (`err.lockedUntil`, `err.lockPrincipal`) |
| 429 | `too_many_requests` | back off and retry |
| 502 | (upstream 403 / 5xx, see `err.upstreamStatus`) | not allowed for the app key (e.g. writing a collection it does not own) or platform trouble |

Partly applied batches throw with the committed counts in `err.details`
(`matchedCount`, `modifiedCount`, `writeErrors`, `results`). When
`TIER0_API_HOST` / `TIER0_API_KEY` (or the collection prefix) are absent
(plain local development) calls fail with 503 `not_configured`; check
`isUnsConfigured()` to show an empty state instead.
