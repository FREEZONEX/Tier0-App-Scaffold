# Platform Integration and Deployment

## Tier0 SDK (`@tier0/sdk-v2`)

The unified `@tier0/sdk-v2@0.10.0-aenv.1` is pinned to the verified published archive
`file:vendor/tier0-sdk-v2-0.10.0-aenv.1.tgz`. It supplies data, platform, Stream request
and message APIs using `/openapi/v2`. The archive integrity is checked by the
lockfile and tests; installation alone does not prove a live deployment.

HTTP Sources use `http-api` with `config.role: client | server`. New Source
configurations omit `configVersion`; native Stream documents use
`script: { code, timeoutMs }` without `sdkVersion`. The separate Runtime
program input retains a complete script string. Source/Stream management
uses `source.documents.*`, `stream.documents.*` and `stream.programs.*`;
there is no legacy protocol, facade or interpreter-selector fallback.
Load the SDK only on the server through the lazy helpers in `@/lib/tier0`:

| Helper | Module | Use |
|---|---|---|
| `loadTier0Sdk()` | `@tier0/sdk-v2` | `createClient()`: `tier0.system`, `members`, `notifications`, `files`, `uns`, `mqttAuth`, `capabilities`, `source`, `stream`, `agent` |
| `loadTier0OpenApi()` | `@tier0/sdk-v2/openapi` | `createOpenAPI()` / `configureClient()` for the raw generated operations |
| `loadTier0Files()` | `@tier0/sdk-v2/files` | `createFilesClient()` |
| `loadTier0Mq()` | `@tier0/sdk-v2/mq` | `Tier0MQClient`, `toWebSocketUrl()`, `parseMqttBroker()` |

```ts
import { loadTier0Sdk } from "@/lib/tier0";

const { createClient } = await loadTier0Sdk();
const tier0 = createClient(); // reads TIER0_API_HOST and the App credential
const user = await tier0.system.whoami();
```

`createClient()` instances share no configuration. Reuse one for work done as
the App; create a fresh instance per request when passing employee data
The App credential represents the App, never the current user, and never reaches
the browser — browser pages call the App's own server routes. Calls made while
serving a request forward its `X-Tier0-Delegation`; `runAsApp` calls do not.

v2 has no UNS v1, legacy Flow, project member queries or `getCurrentProjectId()`.
Workspace members are not the members who can use this App: use
`tier0.members.listApp({ appId: resolveAppId() })` for App-scoped member pickers.
Locally `resolveAppId()` (`TIER0_APP_ID`, then `APP_ID`) is the `local-app` placeholder, so the platform rejects
the call; that failure is expected — App-scoped calls only work in Preview and
deployed runs, where `APP_ID` is injected.
App records still go through `@/lib/data` (see [App Data](#app-data)).
Updating injected guidance alone does not upgrade an application's installed SDK.

### Browser App Stream requests and messages

The same `@tier0/sdk-v2` package provides browser Stream interactions. The
trusted App Gateway runtime supplies identity; no browser key or endpoint is
configured by App code. Retain the exact SDK archive in source ZIPs.

```ts
import { client } from "@tier0/sdk-v2";

const request = client.streams.requests.use({ code: "pump.start" });
const contract = await request.describe();
const result = await request.invoke({ speed: 10 }, { idempotencyKey: commandId });
const topic = client.streams.messages.use({ topic: "sdk/contract" });
const subscription = await topic.subscribe(onMessage);
await topic.publish({ state: "ready" });
// On view cleanup:
await subscription.dispose();
```

Call these from browser actions/effects inside a deployed, authenticated App.
The existing trusted Gateway runtime provider supplies the current App/user
authorization. Do not configure browser keys, service tokens, seeds or arbitrary
workspace identities, and do not fall back to server data credentials when the
provider is unavailable. App policy and published Stream manifest must both
authorize each topic/direction. Requests make one attempt; resolve uncertain
outcomes before deliberately replaying with the same idempotency key. Business
messages use ephemeral NATS Core WSS credentials, with no offline queue, replay
or receiver ACK. Keep the `tier0-stream/v3` machine script contract and current
single-model shape without generation selectors; do not use retired Control or
legacy execution aliases.

The same package provides server-only `@/lib/data` and `@tier0/sdk-v2/data`.
Existing Apps pinned to older packages need an explicit migration. A request
makes one POST without automatic retries; `outcomeUnknown` is an SDK classifier,
not proof that execution did not start. Reconcile uncertain results before replay.
Installation alone does not prove Gateway, SYS, broker or browser readiness.

Node Apps use the same SDK with automatically injected `TIER0_API_HOST`,
`TIER0_CREDENTIALS_FILE` and `TIER0_APP_ID`. Fresh App/internal Keys use unified persisted
request/message mode ceilings; current Workspace/App policy and entry/topic
grants still constrain every operation. Existing Keys lacking those stored
scopes require explicit migration/reissue, never silent expansion. Pure system
DataKeys remain data-only. Server HTTP mapping and real authority/legacy migration
acceptance are separate checks; browser-provider success does not prove either.

### Notification channels

`tier0.notifications.send()` expands channels before sending the HTTP request:

| Input | Reminder scope |
|---|---|
| Omitted or `undefined` | Web & Desktop plus Mobile (`['web', 'mobile']`) |
| `[]` | Inbox only |
| `['web']` | Web & Desktop |
| `['mobile']` | Mobile |

Explicit arrays are deduplicated without adding channels. There is no `desktop`
value; any value other than `web` / `mobile` throws a `TypeError` before the
request. The raw backend endpoint does not share the SDK's default expansion.
Do not infer a narrower channel from the application's page layout. Reminder
eligibility does not establish actual delivery.

Use `mode: 'test'` in development/Preview and `mode: 'live'` for published runs.
Do not add or detect a `[Test]` title prefix; test/live is represented by message
mode. Identify the App with `sender: { type: 'app', id: resolveAppId() }`.

### MQTT broker addresses

Use the MQ module's `toWebSocketUrl()` when converting a platform `mqttBroker`
string to a WebSocket URL; `parseMqttBroker()` is available when endpoint fields
are needed. Do not concatenate a broker string into `wss://...` or reuse a TCP
port such as 1883 for WebSocket connections. Non-WebSocket inputs use the
configured `wssPort` (default 8084); existing `ws://`/`wss://` URLs retain their
scheme, port, path and query. Handle an undefined result as a configuration error.

For non-WebSocket inputs, port 8084 or an HTTPS browser context selects WSS;
other ports use WS outside HTTPS browsers. Explicit `secure: true/false`
overrides inference; explicit `ws://`/`wss://` URLs retain their transport.
A server cannot infer the eventual browser's scheme, so pass `secure: true`
when that browser requires WSS on another port.

`Tier0MQClient` accepts a bare `host:port` as a WebSocket endpoint, so
`emqx:8083` uses WS in Node.js. This differs from `toWebSocketUrl()`, which
uses its `wssPort` option for non-WebSocket inputs. Explicit TCP/MQTT URL
ports are not WebSocket ports and must not be reused.

### MQTT credentials

`Tier0MQClient` takes a fresh token for every connection: from
`TIER0_CREDENTIALS_FILE` on the server, from the page runtime in the browser. It
derives username and clientId from the token, so pass neither. The broker comes
from `TIER0_MQTT_URL`.

`clean` defaults to `false`: with QoS 1 a subscriber crosses token expiry without
losing messages. Messages beyond the broker's offline queue (`max_mqueue_len`,
EMQX default 1000) during a disconnect are still lost. A disconnected client
queues `publish`; it never opens a second client. The server reconnects forever
with a backoff of up to 5 minutes. The browser stops when authorization fails and
continues on `resumed`. An employee with `rowScope=own` or field-narrowed data
rules gets no MQTT subscription in this version.

## Environment Variables

There is no explicit mode switch. If a variable is missing, the app uses its
local/default behavior. If the variable is present, the corresponding platform
capability is enabled.

Apps have no database connection variables: App data lives in Tier0 UNS
collections reached with `TIER0_API_HOST` and the App credential (see
[App Data](#app-data)).

### Platform-Provided

These variables are platform-driven. Local development does not need them.

| Variable | Behavior when unset | Behavior when set |
|---|---|---|
| `TIER0_APP_ID` | Falls back to `APP_ID`, then `local-app` (local-development placeholder only) | The agent-platform App id; used wherever the app identifies itself to the platform |
| `APP_ID` | `local-app` (local-development placeholder only) | Older name of `TIER0_APP_ID`; echoed by `/api/manifest` |
| `VITE_BASE_PATH` | No URL prefix | Applied by `apiUrl()` and Vite `base` |
| `NEXT_PUBLIC_BASE_PATH` | Legacy fallback only | Read by `apiUrl()` if `VITE_BASE_PATH` is missing |
| `TIER0_API_HOST` | App data calls fail with `DATA_NOT_CONFIGURED` (503) | Backend entry for the SDK |
| `TIER0_CREDENTIALS_FILE` | The SDK falls back to `TIER0_API_KEY` for local development | Path of the App credential token. Only the SDK reads it; never read, print or copy it |
| `TIER0_JWKS_DIR` | Requests answer 503 outside `vite dev` | Directory of the front door's public keys, used to verify `X-Tier0-Visitor` |
| `TIER0_MQTT_URL` | — | MQTT broker for the SDK |

`TIER0_APP_ID` is platform-owned: the agent-platform App UUID the platform can
resolve back to the app's name, icon and Open button. Read it at runtime
through `resolveAppId()` (`src/lib/app-id.ts`) — never hard-code the value at
generation time, because an imported copy of the app gets a new UUID and a
hard-coded value keeps pointing at the source app. Without injection it
resolves to `local-app`, a placeholder that must never be treated as the app's
identity; Preview and deployed runs always carry the platform value. Tier0 SDK
variables are injected by the platform during deployment. Do not place them in
`.env.example`, and do not generate application UI for end users to edit them.

### Agent-registered visual assets

File-based App Icon and Cover updates use workspace paths. Keep the final
registration sources at stable project-root paths so the same files remain in
Download Source Code and in Snapshots created after the update:

- Icon: root `icon.png` is the registration/export source and matches the
  platform import/export package name. Copy it byte-for-byte to
  `public/app-icon.png` for the App runtime, set
  `APP_ICON = "/app-icon.png"`, and register `icon_path: "icon.png"`.
- Designed/generated Cover: save root `cover.png`, matching the platform
  package name, and register `cover_path: "cover.png"`.

Do not use a temporary directory, a workspace-external path, or a separately
generated file as the only registration source. On replacement, persist every
root/runtime copy before calling `update_app_info`; if persistence fails, do not
leave the platform pointing at an asset the App source does not retain. This is a
Scaffold/Agent contract for file-based `update_app_info` calls; the platform
remains authoritative for uploads and automatic captures performed outside the
Agent workspace.

---

## Authentication Model

Authentication belongs to the platform front door. The App has no passwords,
accounts or session cookie. It trusts one thing: the visitor token
`X-Tier0-Visitor`, signed by the front door with Ed25519 and valid for 60 seconds.

```text
{iss: tier0-frontdoor, aud: app:<app_id>, typ: visitor, sub_type: employee|machine,
 sub, grant, ws, runtime: deployed|preview, app_roles, active_role, iat, exp, jti}
```

```text
Browser -> front door authorizes and signs the visitor -> App
        -> src/start.ts:

            mutating request with cross-origin Origin  -> 403
            public path (/login, /api/health, /api/manifest, assets) -> allow
            server function -> an employee, unless named publicServerFn<Name>
            no token, or it does not verify -> 401
            machine visitor outside src/lib/webhooks.ts -> 403
            otherwise -> continue
```

The signature, `kid`, `iss`, `typ`, `aud` and time window are checked with 60
seconds of tolerance. The release is not: the front door cannot know which release
serves the request. Keys are read from `TIER0_JWKS_DIR`, and a rotation takes
effect without a restart. Without keys the App answers 503.

`app_roles` is the complete role set and permissions are its union. An empty set
means zero permissions. The token has no name or email; read them through
`tier0.members` under `platform.users.read`.

Under `npm run dev` a development signer stands in for the front door: set
`PREVIEW_USER_ID` and `PREVIEW_USER_ROLE` (comma-separated). Its key is generated
at each start and a production build ignores it. Inside a platform session it only
signs loopback requests without a token, for the route smoke.

### Role Management

Role definitions belong to the app. Role assignment belongs to the platform.

1. The agent defines `PERMISSION_MATRIX` in `permissions.ts` and mirrors the
   roles in `roles.json`
2. The platform registers the `roles.json` roles on import/fork (or via the
   builder's `sync_business_roles` tool)
3. The platform assigns one or more registered roles to each user in its admin UI
4. The front door signs all assigned App roles into `app_roles`
5. The app unions permissions across every role for the current request

Each role key should match a `PERMISSION_MATRIX` key exactly (`"Operator"` ≠
`"operator"`). A role with no matrix entry contributes zero permissions. Full
rules are in [`role-registration.md`](./role-registration.md).

---

### Page runtime and sleep

`src/routes/__root.tsx` loads `/__tier0/runtime.js` from the front door. It owns
presence and the sleep and reauthorization banners; App code does not send
heartbeats. `requestJson`, `useRequest`, `usePolling` and `useRecordChanges` follow
it: nothing refreshes while the App sleeps, `resumed` reloads, and authorization
failures go to the runtime. Keep client timeouts at 20 seconds or more: the front
door holds a request for up to 15 seconds while the App starts.

---

## Platform Resource Model

```text
Workspace
  ├─ App (APP_ID = agent-platform App UUID)
  │    ├─ App credential token                <- issued by the platform, renewed in the VM
  │    └─ App data policy (UNS)            <- grants of this App's collections (record:read/write[/delete])
  └─ UNS
       └─ App directory "<App name> · <short id>"
            ├─ collection work_orders      <- ownerAppId = APP_ID, created by ensure
            └─ collection customers
```

Each App owns the collections it ensures. They are created in the App's own
UNS directory, tagged with the App ID, and granted to the App in the same
transaction (`record:read`, `record:write`, plus `record:delete` when the key
holds `uns.delete`). Ownership follows the App ID, not the directory, so a user
may move or rename a collection. Preview and the deployed App use the same
App key and therefore the same collections and records. Deleting the App
archives its collections and releases their indexes; nothing else removes them.

### App Container Startup

```bash
npm ci
npm run build           # outputs dist/{client,server}; postbuild runs the gates
node server.mjs         # equivalent to npm start, listens on PORT (default 3000)
```

There is no migration or seed step: the App ensures and seeds its collections
on first data access.

---

## App Data

App records go through `data` from `@/lib/data`, the App's instance of the
`@tier0/sdk-v2/data` client (Mongo-driver style) built from
`src/data/collections.ts`; services never use `tier0.uns` or fetch UNS for
App records. All calls are `POST {TIER0_API_HOST}/openapi/v2/...` with
the App credential as `Authorization: Bearer`; responses use the `{ code, msg, requestId, data }`
envelope, errors add `error` (below). The data layer's call policy:

- 25 s per attempt (the gateway gives UNS at most 20 s);
- at most 6 data requests in flight per server process, the rest queue;
- a failed call is resent at most twice, only when UNS (or, for a read
  without an answer, the SDK) marks it `retry.safe`, after `retry.afterMs`
  or a jittered exponential backoff; a `retry.afterMs` over 5 s is not waited
  for — the error surfaces at once;
- every write that takes an idempotency key gets a fresh UUID per call,
  reused by its resends, so a resend never applies the write twice.

| Data layer | UNS operation |
|---|---|
| first access (bootstrap) | `appCollectionsEnsure` `POST /uns/app/collections/ensure` `{ collections: [{ alias, recordSchema, indexes, description }] }` (≤64 declarations) |
| `find` / `findOne` | `recordFind` `records:find` (cursor pages ≤200) |
| `get` | `recordGet` `records:get` (≤100 IDs per request, chunked) → `{ items, missing }` |
| `data.queryBatch` | `recordQueryBatch` `POST /uns/records:queryBatch`: ≤20 reads built with `collection.query.*`, one request, one snapshot |
| `aggregate` | `records:aggregate`: cursor pages for `$match`/`$sort`-only pipelines, offset pages otherwise, no page for a final `$count`; `$lookup.from` (declared collection or alias) becomes `collectionId` |
| `findPage` | `recordAggregatePipeline` (offset page) with `count: { max? }`: page and `total: { count, capped }` in one request and snapshot |
| `countDocuments` | `records:count` with `maxCount?` → `{ count, capped }` |
| `countBy` | `records:aggregate` with `$group` + `$sort` by count |
| `distinct` | `records:aggregate` with `$match` + `$group` (offset pages) |
| `insertOne` / `insertMany` | `records` (`returnDocument: "after"` answers the created record) / `records:bulkWrite` with `insertOne` operations (`atomic: true`, ≤200 documents) |
| `updateOne` / `updateMany` / `replaceOne` | `records:updateOne` / `records:updateMany` (`atomic: false` like Mongo, follows `resumeAfter`) / `records:replaceOne` |
| `deleteOne` / `deleteMany` | `records:deleteOne` / `records:deleteMany` (`atomic: false`, follows `resumeAfter`; soft delete; needs `uns.delete`) |
| `findOneAndUpdate` / `findOneAndReplace` / `findOneAndDelete` | `records:updateOne` / `records:replaceOne` with `returnDocument` (default `"after"`) / `records:deleteOne` with `returnDocument: "before"` |
| `bulkWrite` | `records:bulkWrite` (`atomic: true`, ≤200 operations) |
| `data.transact` | `recordTransactionExecute` `POST /uns/records:transact` with `mode: "sync"` (≤200 steps) |
| `data.subscribe` | `GET /uns/records:subscribe` (server-sent events; every declared collection, ≤64, listed by ID; see Change stream) |

The 200-item limits are UNS's synchronous atomic batch size (`SyncItems`); the
data layer rejects larger batches with `BATCH_LIMIT_EXCEEDED` before sending.

Record bodies are flattened: `{ id, data, revision, createdAt, updatedAt }`
reads as `{ _id, ...data, _meta: { revision, createdAt, updatedAt } }`.
Filters are passed through unchanged; `queryRequestToFind` maps the kit's
`LIKE` to UNS `$contains`, a 1–256 byte substring match that folds case for
ASCII letters only, never matches missing / null / non-string values, cannot
use an index, and fails with `INVALID_REQUEST` on non-string fields.

### Bootstrap

The first data access of a server process sends every declaration of
`src/data/collections.ts` in one ensure call:

- ensure creates missing collections and widens existing ones (join of the
  stored and declared schema); it never narrows, so builds of different ages
  can cold-start in any order. Results are `created`, `unchanged` or
  `widened`, with `ignored` notes and `warnings` (`REQUIRED_NOT_ENFORCED`,
  `INDEX_BUILD_FAILED`).
- ensure never writes annotations: `title` / `description` of existing nodes
  and the collection description keep their stored values (otherwise builds
  of different ages would overwrite each other), and a differing declaration
  comes back in `ignored` as `ANNOTATION_NOT_APPLIED`. New fields and new
  collections take their annotations on creation. The bootstrap logs those
  notes as a warning pointing at `schema:replace`, in Preview too, and never
  fails on them; other `ignored` notes (storage wider than the declaration,
  retired paths) are logged as info. The normalizer is deterministic, so an
  unchanged declaration sends the stored annotations back unchanged and
  produces no note.
- The result is memoized per data client, i.e. per server process; a Vite dev
  reload of `src/data/collections.ts` creates a new client and ensures again.
  A failed ensure is not memoized; the next data access retries it.
- Seed documents (≤1000 per collection) are inserted only for collections
  reported `created`: fixed IDs, atomic `records:bulkWrite` chunks of 200, each with a
  stable idempotency key, so a chunk whose outcome is unknown is replayed
  (up to three times) instead of duplicated. A chunk that still fails is
  logged; the collection is not reseeded later.
- Self-healing: a Preview reset hard-deletes the App's collections and a
  worker or admin may archive one, while the process still holds the old IDs.
  Every record call (including `aggregate` with its `$lookup` targets and
  `data.transact`) runs through `recover`. It decides by the stable
  `data.reason` code UNS adds to App data-access refusals (the top-level
  code stays `FORBIDDEN` / `NOT_FOUND`; never the message text):
  `COLLECTION_NOT_FOUND` (403 or 404: archived or hard-deleted) and
  `COLLECTION_NOT_GRANTED` (403: archive and purge remove the App grant) make
  the data layer drop the ensure memo, ensure again (seeding collections
  reported `created`) and retry the call once — only if some collection ID
  changed, so a rebuild that finds nothing new never repeats a write.
  `APP_PERMISSION_MISSING` (the key lacks e.g. `uns.delete`) does not
  rebuild. The codes appear only on whole-request errors, not on per-item
  results of a batch or transaction. Concurrent failures share one
  rebuild, and a process rebuilds at most once per 30 s
  (`REBUILD_INTERVAL_MS`). `APP_GRANT_REVOKED` is not retried, and an ensure
  error during the rebuild (e.g. `APP_GRANT_REVOKED`) is what the caller
  sees. Calls that continue a cursor or `resumeAfter` token of the old
  collection rebuild but do not retry.
- Preview (`NODE_ENV` ≠ `production`) fails the request on `SCHEMA_CONFLICT`
  (every reason, including `JOIN_UNSUPPORTED` and `DATA_RULE_FIELD`, with a
  hint per reason) and on warnings. A deployment logs them, re-ensures the
  non-conflicting declarations and serves conflicting ones with their
  existing collection ID.

Schemas are converted from Zod 4 by `compileCollection` (`@tier0/sdk-v2/data/define`)
into the stored subset: `type`, `properties`, `required` (sorted),
`additionalProperties: false` on every object, `items`, `enum`, `minimum`,
`maximum`, a declared `format` (`int32`, `float`, `double`, `date-time`),
`title`, `description`. `npm run data:schema` prints the exact
ensure payload. Evolution rules and the worker's tier0 MCP operations
(`schema:replace`, `archive`, `restore`, dry runs, error codes) are in
[app-data.md](app-data.md).

### Errors

UNS error envelopes carry
`error: { code, reason, details, execution, retry: { safe, afterMs? }, repair? }`.
Failures become `DataError { status, code, reason, upstreamStatus, requestId,
execution, retry, outcomeUnknown, attempts, details }`, with the SDK's
`UnsV2Error` as `cause`; `details` holds the `data` object of the UNS error
envelope (or data-layer details), `outcomeUnknown` is
`execution === "unknown"`, and `attempts` counts the requests sent, resends
included.

| `execution` | Meaning |
|---|---|
| `notStarted` | Refused before running (admission, authorization, data-layer checks before sending) |
| `rolledBack` | Ran and rolled back; nothing changed |
| `committed` | Took effect (e.g. ensure applied, only its warnings failed) |
| `unknown` | Writes only: no answer, or the connection broke while committing; it may have landed |

`withErrors` answers `{ error, code, requestId }` with `status`, plus
`Retry-After` (seconds, rounded up from `retry.afterMs`) only on a 429 / 503
that is safe to repeat: `retry.safe` is true, `execution` is not `unknown`,
and `retry.afterMs` is set. `execution` and
`retry.safe` stay on the server: an App request may span several data calls,
so one call being safe to repeat does not make the request safe to resend.

| UNS answer | App status |
|---|---|
| 400 / 403 / 404 / 409 / 413 / 422 / 429 | same (except the platform states below) |
| 401 (credential rejected) | 502 — a platform credential problem, not the user's session |
| `APP_NOT_READY`, `DEPENDENCY_UNAVAILABLE`, `CREDENTIAL_CHANGED`, `OUTCOME_UNKNOWN`, `TEMPORARILY_UNAVAILABLE` | 503 — a platform state, not a denied action or a conflict |
| 502 / 503 / 504 with the UNS envelope (`QUERY_TIMEOUT` is 504) | 503 |
| 502 / 503 / 504 without the envelope (ingress or load balancer during a rollout) | 503 `HTTP_502` / `HTTP_503` / `HTTP_504` |
| timeout / network failure | 503 `DATA_TIMEOUT` / `DATA_UNREACHABLE`; the message never contains the gateway address |
| other invalid response | 502 `DATA_BAD_RESPONSE` |
| other 5xx | 502 |
| missing `TIER0_API_HOST` or App credential | 503 `DATA_NOT_CONFIGURED` |
| batch over 200 items | 400 `BATCH_LIMIT_EXCEEDED` (not sent) |

Without an error body (timeouts, network failures, unenveloped 502/503/504)
a read counts as `rolledBack` and safe to resend, a write as `unknown` and
never resent. `OVERLOADED` (429) is the workspace's data concurrency share
being full; the data layer waited and resent, and a 429 that still reaches the
App means it sends too many requests (merge page reads with
`data.queryBatch`). `QUERY_TIMEOUT` is not resent: narrow the query as
`repair` suggests.

`DataError.reason` carries `data.reason`. `APP_PERMISSION_MISSING` with
`data.missingPermission: "uns.delete"` explains that deletes need
`uns.delete` on the App key; `COLLECTION_NOT_GRANTED` / `COLLECTION_NOT_FOUND`
explain the grant or the missing collection when recovery cannot help.
`APP_QUOTA_EXCEEDED` explains the limit named by `data.resource`
(`collections`, `indexes` or `archivedCollections`, 64 each per App);
`COLLECTION_TOO_LARGE` (archive / restore over 2000 records) and
`DUPLICATE_KEY` (a unique index, also from a restore that collides with an
active record) carry their own hints. Structured details stay in
`DataError.details`. Validation failures against the declaration are
`ZodError`s (400) raised before any call.

### Delegation

`src/start.ts` runs every request inside the `@tier0/sdk-v2/data` request context
(`runWithRequestContext(request, ...)`), which holds the request's
`X-Tier0-Delegation` and abort signal. Every platform call made while serving it
forwards the token as received, together with the App credential, so Backend
applies the employee's data rules and binds record leases to that employee. Ensure,
seed writes, calls outside a request and calls inside `runAsApp(...)` carry none.
When the caller goes away, data calls still waiting for a slot are dropped unsent
and those in flight are cancelled. A delegation lasts 10 minutes; longer background
work uses `runAsApp` and records who started it.
