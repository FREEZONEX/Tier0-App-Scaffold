# Platform Integration and Deployment

## Tier0 SDK (`@tier0/sdk-v2`)

The scaffold declares `@tier0/sdk-v2` `^0.1.0`. Load it only on the server
through the lazy helpers in `@/lib/tier0`:

| Helper | Module | Use |
|---|---|---|
| `loadTier0Sdk()` | `@tier0/sdk-v2` | `createClient()`: `tier0.system`, `members`, `notifications`, `files`, `uns`, `mqttAuth`, `capabilities`, `controls`, `source`, `stream`, `agent` |
| `loadTier0OpenApi()` | `@tier0/sdk-v2/openapi` | `createOpenAPI()` / `configureClient()` for the raw generated operations |
| `loadTier0Files()` | `@tier0/sdk-v2/files` | `createFilesClient()` |
| `loadTier0Mq()` | `@tier0/sdk-v2/mq` | `Tier0MQClient`, `toWebSocketUrl()`, `parseMqttBroker()` |

```ts
import { loadTier0Sdk } from "@/lib/tier0";

const { createClient } = await loadTier0Sdk();
const tier0 = createClient(); // reads TIER0_API_HOST / TIER0_API_KEY
const user = await tier0.system.whoami();
```

`createClient()` instances share no configuration. Reuse one for work done as
the App; create a fresh instance per request when passing employee data
delegation. The App key represents the App, never the current user, and never
reaches the browser — browser pages call the App's own server routes.

v2 has no UNS v1, legacy Flow, project member queries or `getCurrentProjectId()`.
Workspace members are not the members who can use this App: use
`tier0.members.listApp({ appId: resolveAppId() })` for App-scoped member pickers.
App records still go through `@/lib/data` (see [App Data](#app-data)).
Updating injected guidance alone does not upgrade an application's installed SDK.

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

`Tier0MQClient` reads `TIER0_MQTT_HOST` / `TIER0_MQTT_PORT` and uses
`TIER0_API_KEY` as the password. A workspace-encoded key
(`sk-<type>-ws<base36>_<secret>`) supplies the MQTT identity: the client derives
username and clientId from it. A key it cannot parse is rejected unless
username, clientId and password are all passed explicitly; there is no
Enterprise fallback. Alternatively create dedicated credentials with
`tier0.mqttAuth.create()` — the full credential is returned only once.

Changing the key through `connect({ password })` recalculates derived fields
while preserving explicitly passed ones. Disconnect an established connection
before reconnecting with new credentials.

For `Not authorized`, CONNACK code 5 or repeated reconnects, check the installed
version with `npm ls @tier0/sdk-v2`, the key type in the failing runtime (without
printing its value), the broker endpoint/transport, and backend support for that
key type. Do not hard-code username/clientId to bypass identity derivation,
never log the complete key, and never hard-code a Workspace identity. A build
does not prove broker authorization or message delivery.

## Environment Variables

There is no explicit mode switch. If a variable is missing, the app uses its
local/default behavior. If the variable is present, the corresponding platform
capability is enabled.

Apps have no database connection variables: App data lives in Tier0 UNS
collections reached with `TIER0_API_HOST` / `TIER0_API_KEY` (see
[App Data](#app-data)).

### Platform-Injected

These variables are platform-driven. Local development does not need them.

| Variable | Behavior when unset | Behavior when set |
|---|---|---|
| `APP_ID` | `local-app` (local-development placeholder only) | Platform-injected agent-platform App UUID (36 chars); echoed by `/api/manifest` and used wherever the app identifies itself to the platform (e.g. notification `sender.id`) |
| `VITE_BASE_PATH` | No URL prefix | Applied by `apiUrl()` and Vite `base` |
| `NEXT_PUBLIC_BASE_PATH` | Legacy fallback only | Read by `apiUrl()` if `VITE_BASE_PATH` is missing |
| `TIER0_API_HOST` | App data calls fail with `DATA_NOT_CONFIGURED` (503) | Tier0 OpenAPI gateway host injected by the platform (Preview: the sandbox-reachable public API host; deployment: the in-cluster gateway). No scheme means `http://` |
| `TIER0_API_KEY` | App data calls fail with `DATA_NOT_CONFIGURED` (503) | The platform-issued App key (`app` / `internal` / `full_access`); shared by OpenAPI, MQTT and the App data layer |
| `TIER0_MQTT_HOST` | — | Tier0 MQTT WebSocket broker host injected by the platform |
| `TIER0_MQTT_PORT` | Defaults to `8084` | Tier0 MQTT WebSocket port injected by the platform |

`APP_ID` is platform-owned: the agent-platform App UUID the platform can
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

Authentication is handled by the platform gateway. The app does not manage
passwords or user accounts. The platform's `_t0_gw_session` remains owned and
verified by the Gateway. The App resolves identity
and roles from trusted headers on every request.

### Supported Identity Header Formats

At minimum, a user id must be present. The app accepts these identity formats:

**Format 1: JSON `user` header**

```text
user: {"userID":"uuid-123","userName":"mercy","email":"mercy@example.com","role":"operator"}
```

**Format 2: separate headers**

```text
X-App-User-ID:    uuid-123
X-App-User-Name:  mercy
X-App-User-Email: mercy@example.com
X-App-User-Role:  operator
```

**Format 3: minimum set**

```text
X-App-User-ID: uuid-123
```

If `name` is missing, the app falls back to the user id. If `email` is
missing, the app stores an empty string.

Role header values may be plain ASCII, percent-encoded UTF-8, or raw UTF-8
bytes read as latin-1. The gateway parser normalizes all three before matching
`PERMISSION_MATRIX`, so non-ASCII role keys remain stable across proxies.

### Runtime Role Resolution

When the platform is authoritative, the app resolves roles as follows:

1. Preview: use `X-Tier0-Preview-Role` as the single view-as role.
2. Deployed: use every comma-separated `X-Tier0-Business-Roles` value;
   `X-Tier0-Active-Role` remains first as the primary display role.
3. Legacy fallback: `X-Tier0-Active-Role`, `X-Tier0-Preview-Role`,
   `X-App-User-Role`, then `user.role`.

Effective deployed permissions are the union across all assigned roles. The
active role does not limit or replace that union.

### Authentication Flow (platform roles are authoritative)

```text
Browser -> Platform resolves the user's app role assignments
        -> Gateway injects user + all business roles -> App
        -> src/start.ts middleware:

            mutating request with cross-origin Origin
              -> 403 blocked

            public path (/login, /api/health, /api/manifest, runtime/build assets)
              -> allow request

            Tier0 runtime role set is authoritative
              -> continue the same request
              -> known roles contribute their permission union
              -> unknown trusted roles contribute zero permissions

            role present but unknown AND not gateway-injected
            (a forgeable legacy/login value)
              -> 403 fail closed

            preview gateway user present but no selected role
              -> enter with zero roles and zero permissions
                 (the scaffold reserves no fallback role)

            gateway user present but no applicable role context
              -> 403

            no gateway user
              -> 401
```

An explicit empty deployed role set stays empty; no request falls back to any role.
The App does not read, write, or clear platform login Cookies.

`/login` is only a hidden platform-auth error bridge. It does not mint a Cookie
or render a role picker.

### Role Management

Role definitions belong to the app. Role assignment belongs to the platform.

1. The agent defines `PERMISSION_MATRIX` in `permissions.ts` and mirrors the
   roles in `roles.json`
2. The platform registers the `roles.json` roles on import/fork (or via the
   builder's `sync_business_roles` tool)
3. The platform assigns one or more registered roles to each user in its admin UI
4. The gateway injects all assigned app roles in `X-Tier0-Business-Roles`
5. The gateway may also inject one `X-Tier0-Active-Role` as the primary label
6. The app unions permissions across every role for the current request

Each injected role key should match a `PERMISSION_MATRIX` key exactly
(`"Operator"` ≠ `"operator"`) so it carries permissions. A gateway-injected
Tier0 role with no matrix entry still contributes zero permissions; only unknown
roles that are NOT gateway-injected fail closed. Full rules and the three-file
sync convention are in [`role-registration.md`](./role-registration.md).

The Shell should not be treated as the authority for role switching. In the
platform-authoritative model, the platform owns role assignment and the iframe
app only consumes the forwarded identity and role set.

---

## Platform Resource Model

```text
Workspace
  ├─ App (APP_ID = agent-platform App UUID)
  │    ├─ App key (TIER0_API_KEY)          <- issued by the platform, injected into Preview and deployments
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

**Environment injection:**

```env
APP_ID="<agent-platform App UUID>"
VITE_BASE_PATH="/<app base path>"
TIER0_API_HOST="<platform-injected>"
TIER0_API_KEY="<platform-injected>"
TIER0_MQTT_HOST="<platform-injected>"
TIER0_MQTT_PORT="8084"
# Optional legacy fallback:
# NEXT_PUBLIC_BASE_PATH="/<app base path>"
```

**Gateway routing:**

For matched requests, the gateway must inject user headers in either JSON or
separate-header format and then proxy the request to the app.

For deployed apps, the gateway must inject `X-Tier0-Runtime: deployed`,
`X-Tier0-Business-Roles` with every assigned app role, and optionally
`X-Tier0-Active-Role` as the primary display role. Preview uses
`X-Tier0-Runtime: preview` plus one `X-Tier0-Preview-Role`. The gateway also
signs the current employee into `X-Tier0-App-Data-Subject`; the App forwards
it to UNS (see below) and never reads or forges it.

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

`src/lib/data` is the only UNS client in an App. It is a locked platform
contract written in the Mongo driver's style; it will move into `@tier0/sdk-v2`
with the same API. All calls are `POST {TIER0_API_HOST}/openapi/v2/...` with
`x-api-key: TIER0_API_KEY` and a 15 s timeout; responses use the
`{ code, msg, requestId, data }` envelope.

| Data layer | UNS operation |
|---|---|
| first access (bootstrap) | `appCollectionsEnsure` `POST /uns/app/collections/ensure` `{ collections: [{ alias, recordSchema, indexes, description }] }` (≤64 declarations) |
| `find` / `findOne` | `recordFind` `records:find` (cursor pages ≤200) |
| `aggregate` | `records:aggregate`: cursor pages for `$match`/`$sort`-only pipelines, offset pages otherwise, no page for a final `$count`; `$lookup.from` (declared collection or alias) becomes `collectionId` |
| `findPage` | `recordAggregatePipeline` (offset page) + `recordCount` |
| `countDocuments` / `distinct` | `records:count` / `records:distinct` (offset pages) |
| `insertOne` / `insertMany` | `records` / `records:insertMany` (`atomic: true`, ≤200 documents) |
| `updateOne` / `updateMany` / `replaceOne` | `records:updateOne` / `records:updateMany` (`atomic: false` like Mongo, follows `resumeAfter`) / `records:replaceOne` |
| `deleteOne` / `deleteMany` | `records:deleteOne` / `records:deleteMany` (`atomic: false`, follows `resumeAfter`; soft delete; needs `uns.delete`) |
| `findOneAndUpdate` / `findOneAndReplace` / `findOneAndDelete` | `records:findOneAnd*` |
| `bulkWrite` | `records:bulkWrite` (`atomic: true`, ≤200 operations) |
| `data.transact` | `recordTransactionExecute` `POST /uns/records:transact` with `mode: "sync"` (≤200 steps) |

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
  reported `created`: fixed IDs, atomic `insertMany` chunks of 200, each with a
  stable idempotency key and retried up to three times on retryable errors. A
  chunk that still fails is logged; the collection is not reseeded later.
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

Schemas are converted from Zod 4 by `toRecordSchema` (`src/lib/data/schema.ts`)
into the stored subset: `type`, `properties`, `required` (sorted),
`additionalProperties: false` on every object, `items`, `enum`, `minimum`,
`maximum`, `title`, `description`. `npm run data:schema` prints the exact
ensure payload. Evolution rules and the worker's tier0 MCP operations
(`schema:replace`, `archive`, `restore`, dry runs, error codes) are in
[AGENTS.md → App Data](../AGENTS.md#app-data).

### Errors

Failures become `DataError { status, code, upstreamStatus, requestId,
retryable, details }`; `withErrors` answers `{ error, code, requestId }` with
`status`:

| UNS answer | App status |
|---|---|
| 400 / 403 / 404 / 409 / 413 / 422 / 429 | same (except the retryable 403 below) |
| 401 (credential rejected) | 502 — a platform credential problem, not the user's session |
| 403 with `error.retryable: true` (e.g. `FORBIDDEN` "hosted App is not ready" right after an import) | 503 (`retryable`) — a platform state, not a denied action |
| 502 / 503 / 504, timeout, network failure | 503 (`retryable`); a network failure answers without the gateway address, which goes to the server log only |
| other 5xx | 502 |
| missing `TIER0_API_HOST` / `TIER0_API_KEY` | 503 `DATA_NOT_CONFIGURED` |
| batch over 200 items | 400 `BATCH_LIMIT_EXCEEDED` (not sent) |

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

### Data subject

`src/start.ts` runs every request — public paths such as `/_serverFn`
included — inside an `AsyncLocalStorage` context holding the request's
`X-Tier0-App-Data-Subject`. The header is signed by the Gateway and verified
by UNS, so the App can neither forge nor widen it. Record calls made
while serving that request forward the header, so UNS applies employee data
rules and binds record leases to that employee. Ensure, seed writes, calls made
outside a request and calls inside `runAsApp(...)` carry no subject; a lease
taken with a subject cannot be released by such App-level work.

## Where Each Variable Is Read

| Variable | Read from |
|---|---|
| `APP_ID` | `lib/app-id.ts` (`resolveAppId`), used by `routes/api/manifest.ts` and by application code wherever it identifies itself to the platform (e.g. SDK notification `sender.id`); always read at runtime |
| `VITE_BASE_PATH` | `vite.config.ts` (`base`), `router.tsx` (`basepath`), `lib/utils.ts` (`apiUrl` primary source) |
| `NEXT_PUBLIC_BASE_PATH` | `lib/utils.ts`, and as a fallback in `vite.config.ts` / `router.tsx` |
| `TIER0_API_HOST` | Injected by the platform; read by `lib/data/transport.ts` and the SDK client (`createClient()`) at call time |
| `TIER0_API_KEY` | Injected by the platform; read by `lib/data/transport.ts`, the SDK client and `@tier0/sdk-v2/mq` |
| `NODE_ENV` | `lib/data/client.ts`: `production` selects deployed ensure behavior, anything else Preview behavior |
| `TIER0_MQTT_HOST` | Injected by the platform; read by `@tier0/sdk-v2/mq` |
| `TIER0_MQTT_PORT` | Injected by the platform; read by `@tier0/sdk-v2/mq` |

## Scaffold Version Marker

`package.json` carries a top-level `tier0Scaffold` field:

```json
"tier0Scaffold": { "version": 14, "ref": "e4f1c2a" }
```

| Field | Format | Meaning |
|---|---|---|
| `version` | positive integer | Scaffold version the App was generated from. Bumped by one whenever a contract-affecting scaffold change merges; compared by strict equality only |
| `ref` | 7–40 lowercase hex | Scaffold commit the version was stamped on. Informational; lets the align Skill locate the scaffold source |

The platform reads the field when an App package is imported. If it is missing
or its `version` differs from the platform's current scaffold version, the
import reports a `scaffold_missing` / `scaffold_mismatch` warning and the
Builder prompts the user to align the App the first time it opens after
import; the user can dismiss the prompt, and choosing to align places an
`align-platform-app` prompt pinned to the current version and `ref` in the
conversation. After alignment the Skill updates the field; the App must be
redeployed before an export carries the new version.

Nothing at runtime depends on the marker: the App does not read it, the
platform does not inject it, and `npm run build` only warns when it is missing
or malformed (`scripts/scaffold-version.mjs`). Apps and agents must not edit
it by hand.

---

## Scenario Matrix

| Scenario | `TIER0_API_HOST` / `TIER0_API_KEY` | `APP_ID` | Base path |
|---|---|---|---|
| Local development | optional (needed only to reach App data) | optional | optional |
| Platform preview session | ✅ (sandbox-reachable host) | ✅ | depends on runtime |
| Production behind gateway | ✅ (in-cluster gateway) | ✅ | depends on gateway |

`optional` means the scaffold can fall back to defaults when the platform does
not provide a value.
