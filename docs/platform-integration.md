# Platform Integration and Deployment

## SDK 0.5.4

The scaffold declares `@tier0/sdk` `^0.5.4` and locks `0.5.4`. Load OpenAPI,
Files and MQ through the existing `@/lib/tier0` server-side lazy helpers.
Updating injected guidance alone does not upgrade an application's installed SDK.

### Notification channels

The SDK expands channels before sending the HTTP request:

| Input | Reminder scope |
|---|---|
| Omitted or `undefined` | Web & Desktop plus Mobile (`['web', 'mobile']`) |
| `[]` | Inbox only |
| `['web']` | Web & Desktop |
| `['mobile']` | Mobile |

Explicit arrays are deduplicated without adding channels. There is no `desktop`
value. TypeScript restricts channel values; the SDK does not validate them at
runtime. The raw backend endpoint does not share the SDK's default expansion.

When upgrading from 0.4.0 or earlier, review existing notification calls. Preserve
intentional silent delivery with `channels: []`; generic notification requests
can omit channels. Do not infer a narrower channel from the application's page
layout. Reminder eligibility does not establish actual delivery.

Use `mode: 'test'` in development/Preview and `mode: 'live'` for published runs.
Do not add or detect a `[Test]` title prefix; test/live is represented by message
mode. Keep notification App identity resolved at runtime through `resolveAppId()`.

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

### MQTT API-key compatibility

Workspace-encoded keys (`sk-<type>-ws<base36>_<secret>`) supply MQTT identity.
Non-service types require SDK 0.5.2 or later; use the 0.5.4 baseline for the
additional connect-time credential and endpoint fixes. Preserve the original
key as the password and let the SDK derive username/clientId. Legacy keys keep
the Enterprise fallback; deliberate deployment-specific identity overrides
remain explicit. Changing the key through `connect({ password })` recalculates
automatically derived fields while preserving each explicit field. Disconnect
an established connection before reconnecting with new credentials.

For `Not authorized`, CONNACK code 5, repeated reconnects, or OpenAPI succeeding
while MQTT fails:

1. Check the actually installed version with `npm ls @tier0/sdk`, not only
   the manifest range. Inspect key presence/type in the failing runtime without
   printing its value. OpenAPI sends an opaque credential; HTTP 401 alone does
   not establish an SDK incompatibility.
2. If a workspace-encoded non-service key is used below 0.5.2, upgrade to the
   selected supported baseline. Keep the package range and authoritative
   lockfile consistent. Managed preview owns installation/restart; do not race
   it with a manual install. In an unmanaged checkout, validate a clean install.
3. If the SDK compatibility diagnostic is available in the installed package
   or injected guidance, run it from the application root. Check that the script
   exists first: SDK 0.5.4 includes
   `skills/tier0-sdk/scripts/check-api-key-compat.mjs`; published 0.5.3 omitted it.
   Its absence in an older package is a packaging limitation, not an
   authentication failure; continue the checks here.
4. Once the installed SDK is compatible, inspect runtime injection, key
   revocation/expiry/permissions, broker endpoint/transport, and backend support
   for that key type. Do not repeatedly upgrade or replace credentials without
   evidence, and never log the complete key or hard-code a Workspace identity.

After an upgrade, restart the runtime and verify its installed version and the
affected MQTT connection/subscription. A build or local compatibility check does
not prove broker authorization or message delivery.

### Existing App API-key type changes

Before the platform changes an existing App to a workspace-encoded non-service
API key, inspect the SDK version actually running in that App and whether it
uses MQTT. For MQTT apps below 0.5.2, upgrading the SDK is a prerequisite to the
key-type change; target 0.5.4 for the complete fixes described above. Updating
the scaffold or replacing a Skill does not upgrade deployed Apps.

Upgrade and restart the App first, confirm the installed version, and verify
its MQTT connection/subscription. Validate the target key in an authorized
staging or controlled cutover before retiring the old credential; a successful
connection using only the old key does not prove the new key works. If upgrade
or verification cannot be completed, do not automatically switch credentials;
report the compatibility blocker. Preserve a rollback path for the controlled
cutover rather than invalidating the working credential first.

An HTTP-only App must not be marked incompatible solely because its SDK is
below 0.5.2; check the target key's permissions and endpoint support. Unknown
runtime versions or unknown MQTT usage are unresolved checks, not evidence that
a switch is safe. This is a requirement for the platform credential-switch
workflow; these scaffold instructions do not implement platform enforcement.

## Environment Variables

There is no explicit mode switch. If a variable is missing, the app uses its
local/default behavior. If the variable is present, the corresponding platform
capability is enabled.

There is no app database and no required variable: an app runs locally with
none of them (UNS-backed pages then show their `not_configured` empty state).

### Platform-Injected

These variables are platform-driven. Local development does not need them.

| Variable | Behavior when unset | Behavior when set |
|---|---|---|
| `APP_ID` | `local-app` (local-development placeholder only) | Platform-injected agent-platform App UUID (36 chars); echoed by `/api/manifest` and used wherever the app identifies itself to the platform (e.g. notification `sender.id`) |
| `VITE_BASE_PATH` | No URL prefix | Applied by `apiUrl()` and Vite `base` |
| `NEXT_PUBLIC_BASE_PATH` | Legacy fallback only | Read by `apiUrl()` if `VITE_BASE_PATH` is missing |
| `TIER0_API_HOST` | UNS calls fail with 503 `not_configured` | Tier0 OpenAPI host injected by the platform; `@/lib/uns.server` calls `<host>/openapi/uns/v1` |
| `TIER0_API_KEY` | — | App key (`sk-app-…`) injected by the platform; server-only. Limited to UNS data endpoints; writes only to the app's own collections (see `docs/uns-data.md`) |
| `TIER0_APP_COLLECTION_PREFIX` | Derived from `APP_ID` when that is the App UUID; otherwise app-collection helpers fail with 503 `not_configured` | `app.<first 12 hex of the App id>.` — id prefix of the app-owned collections (`appCollectionId()`, `defineAppCollection()`) |
| `TIER0_MQTT_HOST` | — | Tier0 MQTT WebSocket broker host injected by the platform |
| `TIER0_MQTT_PORT` | Defaults to `8084` | Tier0 MQTT WebSocket port injected by the platform |

`APP_ID` is platform-owned: the agent-platform App UUID the platform can
resolve back to the app's name, icon and Open button. Read it at runtime
through `resolveAppId()` (`src/lib/app-id.ts`) — never hard-code the value at
generation time, because an app imported into another project gets a new UUID
and a hard-coded value keeps pointing at the source app. Without injection it
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
leave the platform pointing at an asset the project does not retain. This is a
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
  ├─ UNS (shared by every app and data source of the workspace)
  │    ├─ equipment, work_orders, …            <- plant data: read-only for apps
  │    ├─ app.7bdba8039b80.inspections         <- app-owned (ownerApp = App 1)
  │    └─ app.0c41f5e2d9aa.requests            <- app-owned (ownerApp = App 2)
  └─ Project
       ├─ App 1 (id 7bdba803-9b80-…)
       └─ App 2 (id 0c41f5e2-d9aa-…)
```

Apps have no database. Each app stores its own data in UNS collections whose
ids start with its prefix `app.<appKey>.` (`appKey` = the App id without `-`,
first 12 hex characters). UNS records the owner (`ownerApp`) when the app key
creates such a collection.

### Platform Responsibilities

- **Environment injection** (sandbox preview and deployed runtime):

```env
APP_ID="7bdba803-9b80-4c1e-9a2b-0123456789ab"
VITE_BASE_PATH="/a/7bdba803-9b80-4c1e-9a2b-0123456789ab/"
TIER0_API_HOST="<platform-injected>"
TIER0_API_KEY="<platform-injected sk-app-…>"
TIER0_APP_COLLECTION_PREFIX="app.7bdba8039b80."
TIER0_MQTT_HOST="<platform-injected>"
TIER0_MQTT_PORT="8084"
```

- **App deletion** (and project deletion, for each app): purge every
  collection with `ownerApp` = the app (`DELETE /collections/{id}?purge=true`,
  records and samples included) and revoke the app's `sk-app-` key.
- **Template-library preview reset**: purge the preview app's collections.
- Nothing is provisioned at app creation: collections are created by the app
  itself on first use (`defineAppCollection`).

**Gateway routing:**

For matched requests, the gateway must inject user headers in either JSON or
separate-header format and then proxy the request to the app.

For deployed apps, the gateway must inject `X-Tier0-Runtime: deployed`,
`X-Tier0-Business-Roles` with every assigned app role, and optionally
`X-Tier0-Active-Role` as the primary display role. Preview uses
`X-Tier0-Runtime: preview` plus one `X-Tier0-Preview-Role`.

### App Container Startup

Once the platform has injected the env vars, it can start the app. There is no
migration or seed step: the app creates and seeds its collections on first use.

```bash
npm install
npm run build           # outputs dist/{client,server}
node server.mjs         # equivalent to npm start, listens on PORT (default 3000)
```

---

## Collection Definitions Instead of Migrations

App-owned collections replace tables and migrations. `defineAppCollection(name,
def, { seed })` / `ensureAppCollection(name, def)` (`src/lib/uns.server.ts`)
converge the stored definition on first use in every process: create on 404,
PATCH when the definition differs, re-read on a 409 race. Changes are additive
by nature — existing records are not rewritten — so new fields should be
optional or backfilled by the owning service (`updateManyAll`). Object-form
indexes (`{ path, unique?, kind? }`) are part of the definition and are awaited
until built on first use. Removing a collection (with its
data) is an explicit `resetAppCollection(name)` call, never a side effect of a
deploy. `src/lib/app-data-contracts.test.mjs` (locked, run in `postbuild`)
rejects database drivers, ORMs, `src/db/` and hard-coded prefixes.

## Where Each Variable Is Read

| Variable | Read from |
|---|---|
| `APP_ID` | `lib/app-id.ts` (`resolveAppId`), used by `routes/api/manifest.ts` and by application code wherever it identifies itself to the platform (e.g. SDK notification `sender.id`); always read at runtime |
| `VITE_BASE_PATH` | `vite.config.ts` (`base`), `router.tsx` (`basepath`), `lib/utils.ts` (`apiUrl` primary source) |
| `NEXT_PUBLIC_BASE_PATH` | `lib/utils.ts`, and as a fallback in `vite.config.ts` / `router.tsx` |
| `TIER0_API_HOST` | Injected by the platform; read by `lib/uns.server.ts` and `@tier0/sdk/openapi` at runtime |
| `TIER0_API_KEY` | Injected by the platform; read by `lib/uns.server.ts`, `@tier0/sdk/openapi` and `@tier0/sdk/mq` |
| `TIER0_APP_COLLECTION_PREFIX` | Injected by the platform; read by `lib/uns.server.ts` (`appCollectionPrefix`, falls back to `APP_ID`) |
| `TIER0_MQTT_HOST` | Injected by the platform; read by `@tier0/sdk/mq` |
| `TIER0_MQTT_PORT` | Injected by the platform; read by `@tier0/sdk/mq` |

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

| Scenario | `TIER0_API_HOST` / `TIER0_API_KEY` | `TIER0_APP_COLLECTION_PREFIX` | `APP_ID` | Base path |
|---|---|---|---|---|
| Local development | optional (UNS pages empty without them) | optional | optional | optional |
| Platform preview session | ✅ | ✅ | ✅ | depends on runtime |
| Production behind gateway | ✅ | ✅ | ✅ | depends on gateway |

`optional` means the scaffold can fall back to defaults when the platform does
not provide a value.
