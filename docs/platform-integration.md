# Platform Integration and Deployment

## Tier0 SDK (`@tier0/sdk-v2`)

The unified `@tier0/sdk-v2` is the npm release `0.11.0`, pinned exactly in
`package.json`. It keeps the 0.10.1 data, platform and Stream contracts and
accepts only employee visitors. The lockfile records its registry URL and
integrity, and tests check both; installation alone does not prove a live
deployment.
The SDK must preserve `directoryPath` in collection ensure payloads (Backend
`app-collections/2`); follow [the directory rollout plan](collection-directory-release.md)
before distributing the template or deploying its backend dependency.

Read `node_modules/@tier0/sdk-v2/skills/tier0-sdk-v2/SKILL.md` before SDK
work, then follow its nested domain Skill for the operation. The installed
package's types and Skills describe this version; an SDK repository update
alone neither upgrades the App nor refreshes platform-managed Skills.

HTTP Sources use `http-api` with `config.role: client | server`. New Source
configurations omit `configVersion`; native Stream documents use
`script: { code, timeoutMs }` without `sdkVersion`. The separate Runtime
program input retains a complete script string. Source/Stream management
uses `source.documents.*`, `stream.documents.*` and `stream.programs.*`;
there is no legacy protocol, facade or interpreter-selector fallback.
Load the SDK only on the server through the lazy helpers in `@/lib/tier0`:

| Helper | Module | Use |
|---|---|---|
| `loadTier0Sdk()` | `@tier0/sdk-v2` | `createClient()`: `tier0.system.info()`, `members.listWorkspace()`, `notifications`, `files`, `uns` (see the availability note below) |
| `loadTier0OpenApi()` | `@tier0/sdk-v2/openapi` | `createOpenAPI()` / `configureClient()` for the raw generated operations |
| `loadTier0Files()` | `@tier0/sdk-v2/files` | `createFilesClient()` |
| `loadTier0Mq()` | `@tier0/sdk-v2/mq` | `Tier0MQClient`, `appTopic()`, `toWebSocketUrl()`, `parseMqttBroker()`; server only |

```ts
import { loadTier0Sdk } from "@/lib/tier0";

const { createClient } = await loadTier0Sdk();
const tier0 = createClient(); // reads TIER0_API_HOST and the App's key TIER0_API_KEY
const info = await tier0.system.info();
```

In Preview and deployments the platform puts the App's key into the App's
process environment as `TIER0_API_KEY` (a secret; Preview runs with the App's
preview key, deployments with the deployed one, so notifications sent from
Preview count as test), next to `TIER0_API_HOST`. The SDK uses them by itself
and sends the key as its single `X-API-Key` header. App code never reads,
copies, logs or returns the key, and calls the platform through the SDK
rather than a hand-written `fetch`. Which routes the App's key may call is a
fixed allowlist (see the availability note below). Every App has the same
fixed platform capabilities: `openapi.base`, `platform.users.read`,
`notifications.send`, `asset.file.upload` / `download` / `delete`,
`stream.requests.read` / `invoke` / `write` and `stream.messages.publish` /
`subscribe`. What takes effect is their intersection with the key's own
permissions, its mode and the workspace plan (`uns.dataAppContext({})` returns
it as `platformPermissions`); a plan without Stream still refuses Stream
requests and messages. Nothing is configured or approved per App.

`createClient()` instances share no configuration. Reuse one for work done as
the App.
The App's key represents the App, never the current user, and never reaches
the browser — browser pages call the App's own server routes. Every platform
call is the App's own and carries no visitor: the platform does not narrow
the App's data by user, so the App's services apply its role rules.

v2 has no UNS v1, legacy Flow, project member queries or `getCurrentProjectId()`.
Workspace members are not the members who can use this App: use
`tier0.members.listApp({ appId: resolveAppId() })` for App-scoped member pickers.
Locally `resolveAppId()` is the `local-app` placeholder, so the platform rejects
the call; that failure is expected — App-scoped calls only work in Preview and
deployed runs, where `TIER0_APP_ID` is injected.
The SDK sends `scope` from the platform-injected `TIER0_RUNTIME`: Preview
(`preview`) lists members of the current draft roles, even before the first
publish, and a deployed App (`deployed`) lists its published roles. Do not pass
`scope`, set `TIER0_RUNTIME` in `artifact.toml` or `.env`, or block on the
response's `published` flag; render the returned roles with a normal empty
state for a role nobody holds. The App's key may call it like
`listWorkspace` and gets no email: `email` is empty, so label members by
`userName`.

**Availability in Preview and deployments.** The App's key may call only
`uns` data operations, files (`client.files`, routes `assets/files/**` only;
`assets/upload` is refused), `notifications.send`,
`members.listWorkspace()` (`platform/getMembers`), `members.listApp()`
(`apps/access-members/list`), `client.streams.requests`
(`stream-requests/discover`, `stream-requests/<code>/describe|invoke`),
`client.streams.messages` (`stream-messages/connect`), `capabilities.discover()`
and `system.info()`; Backend enforces this on every entry. `system.whoami()`,
`notifications.get`, `mqttAuth` and `agent` are not supported for Apps (403
`hosted_app_key_route_forbidden`); `source` and `stream` management is refused
for the App's key (403). Do not build App features on them.
App records still go through `@/lib/data` (see [App Data](#app-data)).
Updating injected guidance alone does not upgrade an application's installed SDK.

### Current user's display name

The layout server functions enrich the visitor through
`src/services/user-display.ts`. This is display metadata only: authentication,
`requireAuth()` and `/api/auth/me` continue to use the visitor header without
depending on a member lookup. `useVisitor()` still returns that identity-only
profile; layout descendants can read the enriched user from route context.

The service queries `members.listWorkspace({ keyword: user.id, page, size })`
and accepts only an exact `userId` match, following pages for keyword
collisions. The Workspace query deliberately finds the current caller even
when a Builder is not assigned to the preview's business roles; it is not a
member picker and returns no other members to the browser. Member pickers
must continue to use `listApp` as described above.

Display uses nonblank `nickName`, then `userName`, matching platform account
chrome. Missing names, unavailable membership and SDK failures retain the
visitor ID. A two-second deadline bounds the whole lookup; failures log a
sanitized message, not member data or SDK response bodies. No name cache is
shared between requests: a refresh resolves the name again after an account
switch or rename. Member roles never replace the visitor's effective roles.

Existing generated Apps need these layout/service changes before their user
block changes. This does not add platform avatars (Backend #1426).

### Members before publication

The SDK maps platform-injected `TIER0_RUNTIME=preview` to `scope=draft` and
`deployed` to `scope=production`. Without `TIER0_RUNTIME` (local development
with a key of its own) the SDK sends no `scope` and the server's production
default applies. Any other value is a configuration error the SDK throws
before sending, unless `TIER0_API_KEY` is set. App code calls `members.listApp({ appId })`
without selecting scope or writing `TIER0_RUNTIME` to `.env` / `artifact.toml`.
Preview uses current draft roles and effective direct/group assignments even
when `published=2`; that flag is deployment metadata, not an assignment gate.
Production continues to use published-version roles.

An unexpected empty picker is not evidence that publication is required.
Check the actual installed SDK version, App ID, current role bindings, filters,
and the preview process runtime (an Agent shell is not the preview process).
When available, compare `list_app_role_members` with the App response to isolate
SDK/runtime/API drift. Preserve API errors instead of converting them to `[]`.
The no-role `allActiveMembers=1` state is distinct from no assigned members;
do not silently substitute the entire Workspace or fabricate users.

Existing Apps require the new vendor archive, matching package.json/lockfile,
and a managed preview restart. Upgrading a Skill or the default template alone
does not modify an existing App.

### App Stream requests and messages

`client.streams` runs on the server only, with a client that holds a key
(`createClient()` reads `TIER0_API_HOST` / `TIER0_API_KEY`). Browser code never
calls it directly: pages call the App's own server routes, which apply the
App's role rules. There is no browser host bridge. Retain the exact SDK
archive in source ZIPs.

```ts
import { loadTier0Sdk } from "@/lib/tier0";

const { createClient } = await loadTier0Sdk();
const tier0 = createClient();
const request = tier0.streams.requests.use({ code: "pump.start" });
const contract = await request.describe();
const result = await request.invoke({ speed: 10 }, { idempotencyKey: commandId });
const topic = tier0.streams.messages.use({ topic: "sdk/contract" });
const subscription = await topic.subscribe(onMessage);
await topic.publish({ state: "ready" });
// When the service stops:
await subscription.dispose();
await tier0.dispose();
```

Do not configure broker URLs, service tokens, seeds or arbitrary workspace
identities. Stream requests and messages are fixed capabilities of every App,
bounded by the workspace plan (a plan without Stream refuses them). A request
code must be granted to this App in the Stream request grants. Message topics
come from published Stream manifests: the App may subscribe to a topic a
published Stream declares it publishes, and publish to a topic an active
Stream subscribes to; there is no per-App topic list. These are logical Stream
topics, separate from the App's MQTT namespace. Requests make one attempt; resolve uncertain outcomes before
deliberately replaying with the same idempotency key. Business messages use
ephemeral NATS Core WSS credentials (Node.js 22+), with no offline queue,
replay or receiver ACK. Keep the `tier0-stream/v3` machine script contract and
current single-model shape without generation selectors; do not use retired
Control or legacy execution aliases.

The same package provides server-only `@/lib/data` and `@tier0/sdk-v2/data`.
Existing Apps pinned to older packages need an explicit migration. A request
makes one POST without automatic retries; `outcomeUnknown` is an SDK classifier,
not proof that execution did not start. Reconcile uncertain results before replay.
Installation alone does not prove Gateway, SYS or broker readiness.

Node Apps use the same SDK with automatically injected `TIER0_API_HOST`,
`TIER0_API_KEY` and `TIER0_APP_ID`. The App's key carries persisted
request/message mode ceilings; the workspace plan, the Stream request grants
and the published manifests' topics constrain every operation. Pure system
DataKeys remain data-only.

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

In Preview and deployments the platform sets `TIER0_MQTT_HOST` and
`TIER0_MQTT_PORT`, the broker entry the App's server can reach. Create
`Tier0MQClient` without `host`, `port`, `username`, `clientId` or `password`:
the SDK takes the broker from those variables and the credential from the
platform-provided environment. MQTT runs on the server only: pages never
connect to the broker.

`clean` defaults to `false`: with QoS 1 a subscriber crosses a reconnect without
losing messages. Messages beyond the broker's offline queue (`max_mqueue_len`,
EMQX default 1000) during a disconnect are still lost. A disconnected client
queues `publish`; it never opens a second client. The server reconnects forever
with a backoff of up to 5 minutes. Real-time collection data goes through
`useRecordChanges`, not MQTT.

### MQTT topics

The App's key may publish and subscribe only in the App's own namespace
`apps/<TIER0_APP_ID>/<preview|deployed>/…`: the Preview key under `preview`,
the deployed key under `deployed` (Backend takes the segment from the key).
Wildcards `+` / `#` work inside it; the broker refuses another App's topics,
the other runtime's segment and every other topic. Nothing about topics is
configured in the App settings.

Build every topic with `appTopic(suffix)` from `@tier0/sdk-v2/mq` (through
`loadTier0Mq()`): it returns `apps/<TIER0_APP_ID>/<TIER0_RUNTIME>/<suffix>`
from the platform-injected variables, and throws when either is missing or
`TIER0_RUNTIME` is not `preview` / `deployed`, so it throws in local
development. Never hard-code the App id or the runtime segment.

```ts
const { Tier0MQClient, appTopic } = await loadTier0Mq();
const mq = new Tier0MQClient();
mq.subscribe(appTopic("alarms/#"), onAlarm);
await mq.publish(appTopic("alarms/line-1"), { level: "high" }, { qos: 1 });
```

Preview and the deployed App never see each other's messages. A device or
outside system that feeds the live App publishes under
`apps/<TIER0_APP_ID>/deployed/` with its own credential (for example an
external App key issued in the App settings).

### Forwarding MQTT messages to the browser

A page that needs live messages gets them from the App's server: one
`Tier0MQClient` per server process subscribes, and an App route streams what
the current user may see as server-sent events. The route authenticates like
any other (`requireAuth()`), filters by the user's roles, and every stream
ends after a while so the reconnect is authenticated again. The browser reads
it with `openEventStream` from `@tier0/sdk-v2/event-stream`, which closes the
connection while the page is hidden and reconnects when it is visible again.
Messages are not replayed across a reconnect, so the route starts every stream
with a `reset` event and the page reloads what it shows when it gets one.

```ts
// src/services/line-alarms.ts — server only
import { loadTier0Mq } from "@/lib/tier0";
import type { AppUser } from "@/lib/users";
import { can } from "@/lib/permissions";

type Listener = (topic: string, payload: string) => void;
const listeners = new Set<Listener>();
let started: Promise<void> | undefined;

async function start() {
  const { Tier0MQClient, appTopic } = await loadTier0Mq();
  const mq = new Tier0MQClient();
  mq.on("error", (error) => console.warn("[line-alarms]", error.message));
  mq.subscribe(appTopic("alarms/#"), (topic, payload) => {
    for (const listener of listeners) listener(topic, payload);
  });
}

/** SSE of the alarm topics `user` may see; ends with `signal` or after 10 minutes. */
export async function alarmStream(user: AppUser, signal: AbortSignal): Promise<Response> {
  started ??= start();
  await started;
  const encoder = new TextEncoder();
  let stop = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send: Listener = (topic, payload) => {
        if (!can(user.roles, "view_alarms")) return; // the App's own rule
        controller.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify({ topic, payload })}\n\n`));
      };
      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": heartbeat\n\n")), 15_000);
      const expiry = setTimeout(() => stop(), 600_000);
      stop = () => {
        listeners.delete(send);
        clearInterval(heartbeat);
        clearTimeout(expiry);
        signal.removeEventListener("abort", stop);
        try { controller.close(); } catch {}
      };
      // Every (re)connect may follow missed messages: the page reloads on reset.
      controller.enqueue(encoder.encode("event: reset\ndata: {}\n\n"));
      listeners.add(send);
      signal.addEventListener("abort", stop, { once: true });
    },
    cancel: () => stop(),
  });
  return new Response(body, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
}
```

```ts
// src/routes/api/alarms.ts
GET: withErrors(async ({ request }) => alarmStream(await requireAuth(), request.signal)),
```

```ts
// in the page: reload the alarm list on every reset, append live messages
const stream = openEventStream({
  url: apiUrl("/api/alarms"),
  onEvent(event) {
    if (event.event === "reset") alarms.refresh();
    else if (event.event === "message") append(JSON.parse(event.data));
  },
  onResume: () => alarms.refresh(),
});
// on unmount: stream.close();
```

Messages published while a browser was disconnected or hidden are not replayed
to it; the `reset` at the start of each connection makes the page reload.

## Environment Variables

There is no explicit mode switch. If a variable is missing, the app uses its
local/default behavior. If the variable is present, the corresponding platform
capability is enabled.

Apps have no database connection variables: App data lives in Tier0 UNS
collections reached with `TIER0_API_HOST` and the App's key (see
[App Data](#app-data)).

### Platform-Provided

These variables are platform-driven. Local development does not need them.

| Variable | Behavior when unset | Behavior when set |
|---|---|---|
| `TIER0_APP_ID` | Falls back to `APP_ID`, then `local-app` (local-development placeholder only) | The agent-platform App id; used wherever the app identifies itself to the platform |
| `APP_ID` | `local-app` (local-development placeholder only) | Older name of `TIER0_APP_ID`; echoed by `/api/manifest` |
| `VITE_BASE_PATH` | No URL prefix | Applied by `apiUrl()` and Vite `base` |
| `NEXT_PUBLIC_BASE_PATH` | Legacy fallback only | Read by `apiUrl()` if `VITE_BASE_PATH` is missing |
| `TIER0_API_HOST` | App data calls fail with `DATA_NOT_CONFIGURED` (503) | Platform API gateway root. A bare host name means `https://` |
| `TIER0_API_KEY` | App data calls fail with `DATA_NOT_CONFIGURED` (503) | The App's key: a secret in the runtime process only, never at build. Preview gets the App's preview key, deployments the deployed one |
| `TIER0_MQTT_HOST`, `TIER0_MQTT_PORT` | `Tier0MQClient` needs an explicit `host` | MQTT broker entry the App's server can reach |
| `TIER0_WORKSPACE_ID` | — | Workspace of the App; the SDK uses it for MQTT |
| `TIER0_RUNTIME` | No `scope` on member queries (local development) | `deployed` or `preview`; selects the member `scope`. Without `TIER0_API_KEY` the SDK would switch to its platform proxy mode, which the platform does not use today; any other value without a key is a configuration error |

Only `TIER0_API_KEY` is a secret; the others are identifiers.

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
accounts or session cookie. It trusts one thing: the `X-Tier0-Visitor` header
the front door sets on every request it forwards, after stripping every
`X-Tier0-*` the client sent. The front door is the only way into the App, so
the header is not signed: it is the unpadded base64url of a JSON object of at
most 8192 bytes.

```text
{ws, app, runtime: deployed|preview, sub_type: employee, sub, grant,
 app_roles, active_role?}
```

```text
Browser -> front door authorizes the visitor and sets X-Tier0-Visitor -> App
        -> src/start.ts:

            mutating request with cross-origin Origin  -> 403
            public path (/login, /api/health, /api/manifest, assets) -> allow
            server function -> an employee, unless named publicServerFn<Name>
            no header, malformed header or non-employee identity -> 401
            otherwise -> continue
```

`src/lib/visitor.ts` parses it with the SDK's `parseVisitorHeader`: an unknown
or missing field, a wrong type or length, a non-employee identity, an empty
grant, or an `app` other than `TIER0_APP_ID` makes the request a 401.
Without `TIER0_APP_ID` the App answers 503. There is no machine identity,
call-token route or webhook whitelist exception; public health/build paths
remain unauthenticated, not a separate identity mechanism.

`app_roles` is the complete role set and permissions are its union. An empty set
means zero permissions. `active_role` appears only in Preview's "view as" and is
display metadata. The header has no name or email; read them through
`tier0.members` under `platform.users.read`.

The visitor is the App's to authorize: platform calls are the App's own and
carry no visitor, so which records the current user may read or change by
role is decided in the App's services (`requireAuth()`, `can(user.roles,
action)`), and which record changes a browser hears about in
`src/lib/change-visibility.ts`.

Under `npm run dev` the development front door in `vite.config.ts` sets the
header for `PREVIEW_USER_ID` and `PREVIEW_USER_ROLE` (comma-separated). Inside a
platform session it only sets it on loopback requests that came without one,
for the route smoke.

### Role Management

Role definitions belong to the app. Role assignment belongs to the platform.

1. The agent defines `PERMISSION_MATRIX` in `permissions.ts` and mirrors the
   roles in `roles.json`
2. The platform registers the `roles.json` roles on import/fork (or via the
   builder's `sync_business_roles` tool). It computes a role plan first:
   roles it would create or newly reuse are written only after a Builder
   confirms the plan (on import, an extra Confirm roles step). An app with a
   pending role plan cannot be published, however it was created
3. The platform assigns one or more registered roles to each user in its admin UI
4. The front door puts all assigned App roles into `app_roles`
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
  │    ├─ App API key                      <- issued by the platform, in the App's process as TIER0_API_KEY
  │    └─ App data policy (UNS)            <- grants: own collections + authorized external collections
  └─ UNS
       └─ North Plant                     <- verified business scope, shared directory
            ├─ Assembly Line 1
            │    └─ MES                    <- App/module directory within that scope
            │         └─ collection work_orders  <- ownerAppId = APP_ID
            └─ collection quality_records  <- plant-wide data at the common ancestor
```

Each App owns the collections it ensures (`ownerAppId = APP_ID`). Every new
collection declares a `directoryPath` from the workspace root; the backend
reuses or creates those business directories and grants the collection to the
App in the same transaction (`record:read`, `record:write`, plus `record:delete`
when the key holds `uns.delete`). The App accesses granted external collections
through `data.collection({ collectionId })`. Before linking an external
collection or expanding access, follow the incremental Builder grant workflow in
`AGENTS.md`. A grant or its removal applies from the next request. The diagram assumes
its business scopes are verified; its names are examples, not defaults. An
App/module directory such as MES is valid within the known factory/line scope, and shared data
belongs at a suitable common ancestor. Use only known, meaningful levels;
do not force five levels or default to a root-level App container.

Directories are shared business structure, not App-owned resources. Collection
ownership and grants remain independent of location. Ensure preserves the
location and name of an existing alias; moving or renaming an existing
collection requires a separate authorized metadata operation. Preview and the
deployed App use the same App key and therefore the same collections and
records. Deleting the App does not reclaim shared business directories.

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
App records. All calls are `POST {TIER0_API_HOST}/openapi/v2/...` with the
App's key `TIER0_API_KEY` as the single `X-API-Key` header; responses use the `{ code, msg, requestId, data }`
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
| first access (bootstrap) | `appCollectionsEnsure` `POST /uns/app/collections/ensure` `{ collections: [{ alias, name, directoryPath, recordSchema, indexes, description }] }` (≤64 declarations); `directoryPath` is the business directory path from the workspace root, required for new aliases; existing aliases never move during ensure |
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
  (every reason, including `JOIN_UNSUPPORTED`, with a hint per reason) and on warnings. A deployment logs them, re-ensures the
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
| missing `TIER0_API_HOST` or `TIER0_API_KEY` | 503 `DATA_NOT_CONFIGURED` |
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

### Request abort signal

`src/start.ts` hands every request's abort signal to the data layer
(`runWithAbortSignal(request.signal, ...)` from `@tier0/sdk-v2/data`): when the
caller goes away, data calls still waiting for a slot are dropped unsent and
those in flight are cancelled. Ensure, seed writes and the change stream never
take a request's signal; work that must outlive the request runs inside
`runDetached(...)`. Every call is the App's own, with the App's key.

Preview behaves exactly like a deployment: the App reads and writes its own
data as the App, seeds are written by ensure as the App, and `useRecordChanges`
shares one upstream per server process.

## Employee-only visitor cutover

SDK `0.11.0` rejects all non-employee visitors. The scaffold
removes the machine branch and `src/lib/webhooks.ts`; it has no `[[webhooks]]`
artifact field. The platform App Key remains the App's outbound identity and
is not an inbound visitor or a replacement call token.

Already deployed Apps keep their bundled SDK and old parsing code. This
cutover does not rebuild or republish them: the platform front door must
close the machine/token entry points and strip client-supplied identity
headers before forwarding employee requests. Old call tokens then have no
entry path. An alternate ingress that bypasses that boundary remains unsafe;
updating the template alone does not update deployed code.

When an App is explicitly upgraded later, set its `@tier0/sdk-v2` dependency
to `0.11.0`, run `npm install` so the lockfile points at the npm release,
delete its old `vendor/tier0-sdk-v2-*.tgz`, remove machine/webhook branches
and keep its employee role checks. Do not automatically republish other people's Apps.

## Migrating an existing App to scaffold v28

Scaffold v28 (`@tier0/sdk-v2@0.10.0-aenv.11`) follows the platform's App key
model: fixed platform capabilities, no per-App platform policy, MQTT limited to
the App's namespace. An App made from a scaffold older than v27 first applies
the v27 steps below, taking the SDK archive from v28. From v27:

- **SDK archive**: replace `vendor/tier0-sdk-v2-*.tgz` with v28's, and take
  `package.json`'s `@tier0/sdk-v2` entry and its `package-lock.json` entry
  (version, `resolved`, `integrity`) from v28. The SDK no longer has any App
  platform policy operation: capabilities are fixed.
- **MQTT topics**: the broker refuses every topic outside
  `apps/<TIER0_APP_ID>/<preview|deployed>/`. Build each topic with
  `appTopic(suffix)` (see [MQTT topics](#mqtt-topics)), and have devices or
  outside systems that feed the live App publish under
  `apps/<TIER0_APP_ID>/deployed/`.
- **Stream requests and messages** now work from the App's server (see
  [App Stream requests and messages](#app-stream-requests-and-messages)).

Then `npm install` and `npm run build`, and check that every `subscribe` /
`publish` on a `Tier0MQClient` takes its topic from `appTopic`.

## Migrating an existing App to scaffold v27

Scaffold v27 (`@tier0/sdk-v2@0.10.0-aenv.10`) changes how the App reads its
visitor and calls the platform. Upgrading the vendored SDK alone breaks the
build of an App made from an older scaffold: its code still imports removed
APIs. Bring these over from v27 in one change, then `npm install` and
`npm run build`:

- **SDK archive**: replace `vendor/tier0-sdk-v2-*.tgz` with v27's, and take
  `package.json`'s `@tier0/sdk-v2` entry and its `package-lock.json` entry
  (version, `resolved`, `integrity`) from v27.
- **Visitor**: the front door now sets a plain `X-Tier0-Visitor` (base64url
  JSON) instead of a signed token. Replace `src/lib/visitor.ts` and
  `src/lib/visitor.test.ts` (it uses `parseVisitorHeader` from
  `@tier0/sdk-v2/server`; `createVisitorTokenVerifier`, `visitorReady`,
  `DEV_SIGNER_KEY`, `TIER0_JWKS_DIR` and `TIER0_JWKS_URL` are gone) and
  `src/lib/auth.ts` (no `await visitorReady()`).
- **Local front door**: delete `src/lib/dev-signer.ts` and replace
  `vite.config.ts`; its dev front door sets the plain header and detects a
  platform session by `TIER0_RUNTIME`.
- **Request context**: replace `src/start.ts` (`runWithAbortSignal` instead of
  `runWithRequestContext`) and `eslint.config.mjs`. Employee delegation
  (`X-Tier0-Delegation`, `runWithRequestContext`,
  `runWithRequiredEmployeeContext`, `currentDataSubject`) is removed: every
  platform call is the App's own, so the App's services apply its role rules.
  In App code, `runAsApp(fn)` becomes `runDetached(fn)` (exported from
  `@/lib/data`) for work that must outlive the request; take
  `src/lib/data/index.ts` from v27.
- **Record changes**: replace `src/lib/data/changes.ts`,
  `src/lib/record-changes.ts` and `src/routes/api/uns/subscribe.ts`, and add
  `src/lib/change-visibility.ts` (`canSeeChange`, where the App decides which
  changes a user hears about). Change events have no `restricted` flag and no
  collection-level event any more.
- **Browser MQTT**: `getMqttToken` and the browser token source are removed;
  browsers never connect to the broker. Subscribe with `Tier0MQClient` on the
  server and forward what the visitor may see through an App route (see
  [Forwarding MQTT messages to the browser](#forwarding-mqtt-messages-to-the-browser)).
- **Browser Stream calls**: `@tier0/sdk-v2/runtime` and browser
  `client.streams` are removed; call `client.streams` from server code only.
- **Credentials**: the platform injects the App's key as `TIER0_API_KEY`;
  replace hand-written platform calls (and their node-proxy headers) with SDK
  calls.
- **Gates**: take `scripts/gate-integrity.json` and `scripts/gate-integrity.mjs`
  from v27 together with the locked files above; do not regenerate the hashes
  over App-edited copies.

Then check that nothing still references the removed names:
`grep -rnE "createVisitorTokenVerifier|dev-signer|visitorReady|runWithRequestContext|runAsApp|getMqttToken|sdk-v2/runtime" src vite.config.ts`
must print nothing.
