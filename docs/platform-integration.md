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

The App Data target architecture uses Enterprise APIs, not injected PostgreSQL
credentials. This is a documentation contract; the current SQL template and
deployment pipeline still need the [maintainer migration](scaffold-api-migration.md).
Do not claim automatic API configuration or remove existing databases.

### Proposed App Data Configuration (server-only)

| Variable | Meaning |
|---|---|
| `TIER0_APP_API_BASE` | Explicit trusted Enterprise base ending in `/openapi/v2` |
| `TIER0_APP_API_KEY` | Restricted App data Key used by the server-only client |

Deployment must provision and inject these values explicitly. Missing values
fail clearly; no SQL/mock fallback. Do not expose them via `VITE_*`, build-time
constants, logs or user settings. Do not assume the SDK key has App data grants.

### Existing Platform Runtime and SDK Variables

| Variable | Behavior |
|---|---|
| `APP_ID` | Platform App UUID, read at runtime with `resolveAppId()`; local fallback `local-app` is only a placeholder |
| `VITE_BASE_PATH` | Applied by `apiUrl()`, router and Vite base |
| `NEXT_PUBLIC_BASE_PATH` | Legacy base-path fallback |
| `TIER0_API_HOST` | SDK OpenAPI service host |
| `TIER0_API_KEY` | SDK credential for supported OpenAPI/MQTT capabilities; distinct from App Data authorization |
| `TIER0_MQTT_HOST` | SDK MQTT WebSocket host |
| `TIER0_MQTT_PORT` | SDK MQTT WebSocket port, default `8084` |

`APP_ID` identifies the platform's name/icon/Open target and changes on import
into another project. Never hard-code it. The UNS App metadata identity and its
Collection grants are resolved through the data Key's `apps/context`; there is
no implicit equality with the deployment UUID.

SDK variables retain their existing platform injection contract. Do not add
them to `.env.example` or business UI. App Data configuration is a separate
pending deployment integration, not a reason to alter SDK credentials.

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

The API App model separates deployment identity from data authorization:

```text
Platform App deployment (APP_ID) → Gateway → App server
                                             ↓ private App data Key
UNS App metadata + Collection grants ← apps/context
         ↓ permitted aliases
Collections → Records / Samples
Optional Topics expose data in Namespace; Source/Stream handle ingestion.
```

Workspace/table isolation is the platform's responsibility. App code neither
creates a database/schema nor depends on physical `uns_*` tables. `kind=app`
is data-access metadata, not an image, container or deployment history.

### Provisioning and Runtime Responsibilities

1. An authorized Agent/operator checks the API catalog and creates the required
   Collection schemas and App grants through management APIs. Topic/Source/Stream
   provisioning is only needed for the product's actual integration workflow.
2. Issue a restricted data Key; never ship the management credential to the App.
   Rebinding an imported App requires target-environment grants and credentials.
3. Resolve `apps/context` at runtime, use aliases and validate required grants.
   App Keys must not create their own metadata or broaden their scope.
4. The App server owns user-specific access, lifecycle rules and query/change
   composition. The platform API enforces collection access and DB consistency.

See [the API specification](app-api-development.md) for endpoints, transactions,
query snapshots, retry semantics and verification. No arbitrary SQL endpoint or
implicit per-App database is required by this model.

### Gateway and Deployment

For deployed Apps the Gateway forwards trusted user identity,
`X-Tier0-Runtime: deployed`, the complete `X-Tier0-Business-Roles` set and an
optional `X-Tier0-Active-Role` display label. Preview uses
`X-Tier0-Runtime: preview` plus `X-Tier0-Preview-Role`. Preserve the authentication,
role-union and CSRF behavior above; a data Key does not replace user identity.

After runtime migration, API App startup requires explicit data API configuration
and pre-provisioned grants, followed by the existing build/Node server pipeline.
It must not execute `drizzle-kit push`, create SQL tables or require a database
password. This branch does not implement that deployment change: maintainers
must update template hooks and the platform provision/migration stages together.
Do not run the old SQL setup to conceal a missing API integration.

### Schema Evolution

Business contracts use Zod plus platform-supported record/sample JSON Schema.
Update Collection definitions through authorized management APIs after checking
existing records and compatibility. An App runtime Key cannot migrate metadata.
Backfills use approved API batches with pagination, stable idempotency and
verification; renaming a field does not automatically rewrite existing JSON.
Do not drop source data or recreate collections to make a schema edit pass.

### Where Configuration Is Read

| Variable | Consumer |
|---|---|
| `TIER0_APP_API_BASE`, `TIER0_APP_API_KEY` | Proposed server-only App Data initializer, to be implemented during template migration |
| `APP_ID` | Existing `src/lib/app-id.ts`, manifest and platform identity calls |
| `VITE_BASE_PATH`, `NEXT_PUBLIC_BASE_PATH` | Existing Vite/router configuration and `apiUrl()` |
| `TIER0_API_HOST`, `TIER0_API_KEY` | Existing SDK server-side helpers |
| `TIER0_MQTT_HOST`, `TIER0_MQTT_PORT` | Existing SDK MQTT runtime |

Legacy `DATABASE_URL`, `DIRECT_DATABASE_URL`, `DB_SCHEMA` and DB sync controls
still have consumers in the current source tree. They are listed in the
[migration checklist](scaffold-api-migration.md), not an API App requirement.

## Scaffold Version Marker

`package.json` carries a top-level `tier0Scaffold` field:

```json
{ "tier0Scaffold": { "version": 14, "ref": "e4f1c2a" } }
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

This matrix is the target after runtime migration, not a claim of automatic
configuration in this documentation branch.

| Scenario | App data API/Key | Data provisioning | Gateway identity | Base path |
|---|---|---|---|---|
| Local integration test | Explicit restricted test Key | Isolated approved collections | Trusted test harness; no production bypass | Optional |
| Platform preview | Explicit runtime injection | Preview grants and aliases | Preview user and selected role | Runtime-dependent |
| Production | Private runtime secret | Target-environment App grants | Deployed user and complete role set | Gateway-dependent |

Missing data authorization is an actionable configuration error. It must not
enable local storage, fake users or an unrestricted management credential.
