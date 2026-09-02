# Platform Integration and Deployment

## Environment Variables

There is no explicit mode switch. If a variable is missing, the app uses its
local/default behavior. If the variable is present, the corresponding platform
capability is enabled.

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. The database name should match the project id. |

### Optional

| Variable | Description |
|---|---|
| `DIRECT_DATABASE_URL` | Direct DB connection that bypasses the pool. Preferred by `db:push` and `seed.ts`. |

### Platform-Injected

These variables are platform-driven. Local development does not need them.

| Variable | Behavior when unset | Behavior when set |
|---|---|---|
| `DB_SCHEMA` | Uses the `public` schema | Binds `appSchema`, runtime queries and `drizzle-kit push` to the specified schema |
| `DB_SYNC_ALLOW_DESTRUCTIVE` | `db:push` fails on any DROP/TRUNCATE | `1` lets `db:push` apply destructive statements; only after a verified backup |
| `APP_ID` | `local-app` (local-development placeholder only) | Platform-injected agent-platform App UUID (36 chars); echoed by `/api/manifest` and used wherever the app identifies itself to the platform (e.g. notification `sender.id`) |
| `VITE_BASE_PATH` | No URL prefix | Applied by `apiUrl()` and Vite `base` |
| `NEXT_PUBLIC_BASE_PATH` | Legacy fallback only | Read by `apiUrl()` if `VITE_BASE_PATH` is missing |
| `TIER0_API_HOST` | — | Tier0 OpenAPI host injected by the platform |
| `TIER0_API_KEY` | — | Tier0 API credential injected by the platform; shared by OpenAPI and MQTT |
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
Project (proj-abc123)
  └─ Database: proj-abc123
       ├─ schema: session-001  <- app 1
       ├─ schema: session-002  <- app 2
       └─ schema: session-003  <- app 3
```

One session equals one app. `DB_SCHEMA` is the schema the platform assigns to
the app and `APP_ID` is the app's platform UUID; both are injected, and neither
is derived from the other by the app.

### Platform Responsibilities

**When creating a project:**

```sql
CREATE DATABASE "proj-abc123";
```

**When creating a session:**

```sql
CREATE SCHEMA IF NOT EXISTS "session-xyz789";
```

**Environment injection:**

```env
DATABASE_URL="postgresql://appbuilder:appbuilder@db-host:5432/proj-abc123"
DB_SCHEMA="session-xyz789"
APP_ID="session-xyz789"
VITE_BASE_PATH="/session-xyz789"
TIER0_API_HOST="<platform-injected>"
TIER0_API_KEY="<platform-injected>"
TIER0_MQTT_HOST="<platform-injected>"
TIER0_MQTT_PORT="8084"
# Optional legacy fallback:
# NEXT_PUBLIC_BASE_PATH="/session-xyz789"
```

**Gateway routing:**

For matched requests, the gateway must inject user headers in either JSON or
separate-header format and then proxy the request to the app.

For deployed apps, the gateway must inject `X-Tier0-Runtime: deployed`,
`X-Tier0-Business-Roles` with every assigned app role, and optionally
`X-Tier0-Active-Role` as the primary display role. Preview uses
`X-Tier0-Runtime: preview` plus one `X-Tier0-Preview-Role`.

### App Container Startup

Once the platform has prepared the database, schema, and env vars, it can start
the app:

```bash
npm install
npm run db:push         # sync tables under DB_SCHEMA through scripts/db-sync-guard.mjs (non-zero exit on any destructive plan)
npx tsx src/db/seed.ts  # seed DB_SCHEMA on first use
npm run build           # outputs dist/{client,server}
node server.mjs         # equivalent to npm start, listens on PORT (default 3000)
```

---

## Schema Declaration and Migration Safety

One app owns exactly one PostgreSQL schema (`DB_SCHEMA`). When the platform
deploys or replaces an app it runs `npx drizzle-kit push --force` in a
migration container with `DB_SCHEMA` and `DATABASE_URL` injected, reading
`drizzle.config.ts` and `src/db/schema.ts` directly. drizzle-kit diffs only
tables whose declared schema is inside `schemaFilter`; anything it finds in
`DB_SCHEMA` that is not declared there is dropped, and `--force` skips the
confirmation. The scaffold therefore makes the declaration shape itself the
safety guarantee:

- `src/db/schema.ts` exports one `appSchema = pgSchema(DB_SCHEMA || "public")`
  and declares every table and enum through `appSchema.table(...)` /
  `appSchema.enum(...)`. Local, preview and deployed environments share that
  single definition; a bare `pgTable(...)` fails the build.
- Table declarations live only in `src/db/schema.ts`, the one file
  `drizzle.config.ts` reads. A declaration in any other file is invisible to
  push and its table would be dropped; the build rejects it.
- `bootstrapModule(...)` accepts declared table objects, not names. A runtime
  table cannot exist without a declaration, so push never sees it as garbage.
- `drizzle.config.ts` keeps `schemaFilter: [DB_SCHEMA]` so a sync never reads
  or writes another app's schema.

These are enforced by `src/lib/db-schema-contracts.test.mjs` in `postbuild`.

For developers and CI, `npm run db:push` runs `scripts/db-sync-guard.mjs`
instead of raw push: it verifies the binding, prints the plan, and exits
non-zero before applying anything if the plan contains `DROP TABLE`,
`DROP SCHEMA`, `DROP COLUMN`, `TRUNCATE` or a drizzle-reported data-loss
statement, unless `DB_SYNC_ALLOW_DESTRUCTIVE=1`. `npm run db:push:check` is
the dry run. Raw `drizzle-kit push` exits 0 even when it drops tables or
throws, so its exit code must never be treated as a success signal.

## Where Each Variable Is Read

| Variable | Read from |
|---|---|
| `DATABASE_URL` | `db/index.ts`, `drizzle.config.ts`, `db/seed.ts` |
| `DIRECT_DATABASE_URL` | `drizzle.config.ts`, `db/seed.ts` |
| `DB_SCHEMA` | `db/schema.ts` (`appSchema`), `db/index.ts` (`search_path`), `drizzle.config.ts` (`schemaFilter`), `db/seed.ts`, `services/bootstrap.ts`, `scripts/db-sync-guard.mjs` |
| `DB_SYNC_ALLOW_DESTRUCTIVE` | `scripts/db-sync-guard.mjs` |
| `APP_ID` | `lib/app-id.ts` (`resolveAppId`), used by `routes/api/manifest.ts` and by application code wherever it identifies itself to the platform (e.g. SDK notification `sender.id`); always read at runtime |
| `VITE_BASE_PATH` | `vite.config.ts` (`base`), `router.tsx` (`basepath`), `lib/utils.ts` (`apiUrl` primary source) |
| `NEXT_PUBLIC_BASE_PATH` | `lib/utils.ts`, and as a fallback in `vite.config.ts` / `router.tsx` |
| `TIER0_API_HOST` | Injected by the platform; read by `@tier0/sdk/openapi` at runtime |
| `TIER0_API_KEY` | Injected by the platform; read by `@tier0/sdk/openapi` and `@tier0/sdk/mq` |
| `TIER0_MQTT_HOST` | Injected by the platform; read by `@tier0/sdk/mq` |
| `TIER0_MQTT_PORT` | Injected by the platform; read by `@tier0/sdk/mq` |

---

## Scenario Matrix

| Scenario | `DATABASE_URL` | `DB_SCHEMA` | `APP_ID` | Base path |
|---|---|---|---|---|
| Local development | ✅ | optional | optional | optional |
| Platform preview session | ✅ | ✅ | ✅ | depends on runtime |
| Production behind gateway | ✅ | ✅ | ✅ | depends on gateway |

`optional` means the scaffold can fall back to defaults when the platform does
not provide a value.
