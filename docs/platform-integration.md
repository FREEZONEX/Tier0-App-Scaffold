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

### MQTT compatibility and diagnostics

The current lockfile uses SDK 0.5.4. When troubleshooting an existing App, inspect
its installed version with `npm ls @tier0/sdk`; changing documentation does not
upgrade a deployed App. Workspace-encoded non-service MQTT keys require at least
0.5.2; 0.5.4 includes the connection and endpoint fixes used by this scaffold.

Let the SDK derive MQTT username/clientId and retain the original Key as password.
Disconnect before reconnecting with changed credentials. For authorization
failures, check version, key type/scope/expiry and endpoint transport without
logging secrets. HTTP success does not establish MQTT delivery.

Before switching an existing App's key type, verify its SDK and MQTT use, upgrade
and restart if needed, and test the new key before retiring the working one.
Do not infer HTTP-only incompatibility from a MQTT version requirement.

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

- Icon: root `icon.png` (512×512, ≤2 MB) is the registration/export source and matches the
  platform import/export package name. Copy it byte-for-byte to
  `public/app-icon.png` for the App runtime, set
  `APP_ICON = "/app-icon.png"`, and register `icon_path: "icon.png"`.
- Designed/generated Cover: save root `cover.png` (PNG, ≤8 MB), matching the platform
  package name, and register `cover_path: "cover.png"`.

Register with Builder's `update_app_info` when available, including current name
and description. Persist all root/runtime copies before registering either asset.

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

Role registration, matrix updates and Gateway role-union behavior are maintained
in [role registration](role-registration.md). The App consumes assignments; it
does not provide its own login, role-switch authority or user database.

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

Provisioning, App grants, metadata and schema evolution are defined in
[App API development](app-api-development.md). The deployment UUID is not an
implicit data identity; resolve aliases/grants from the data Key's `apps/context`.

### Deployment Boundary

Preserve the Gateway/authentication contract above. API App deployment must
explicitly inject the private data API configuration and pre-provisioned grants;
it must not execute SQL bootstrap or migration for the App. The outstanding
template/deployment work is tracked in [the migration checklist](scaffold-api-migration.md).
Missing data authorization is an error, not permission to use mock data or a
management Key.

## Scaffold Version Marker

`package.json.tier0Scaffold` identifies the inherited scaffold contract. Import
can prompt alignment when the version differs; the marker does not perform
runtime migration or inject configuration. See the
[maintainer procedure](../README.md#scaffold-version-maintainers).
