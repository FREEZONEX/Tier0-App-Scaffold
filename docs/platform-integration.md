# Platform Integration and Deployment

## Environment Variables

There is no explicit mode switch. If a variable is missing, the app uses its
local/default behavior. If the variable is present, the corresponding platform
capability is enabled.

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. The database name should match the project id. |
| `SESSION_SECRET` | HMAC signing key for the session cookie (32+ chars). **Required in production**. If omitted locally, the process generates a random value at startup and all sessions are invalidated on restart. Example: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### Optional

| Variable | Description |
|---|---|
| `DIRECT_DATABASE_URL` | Direct DB connection that bypasses the pool. Preferred by `drizzle-kit push` and `seed.ts`. |

### Platform-Injected

These variables are platform-driven. Local development does not need them.

| Variable | Behavior when unset | Behavior when set |
|---|---|---|
| `DB_SCHEMA` | Uses the `public` schema | Runs all queries in the specified schema |
| `APP_ID` | Defaults to `"monoapp"` | Returned by `/api/manifest` as the app id |
| `VITE_BASE_PATH` | No URL prefix | Applied by `apiUrl()` and Vite `base` |
| `TIER0_API_HOST` | — | Tier0 OpenAPI host injected by the platform |
| `TIER0_API_KEY` | — | Tier0 API credential injected by the platform; shared by OpenAPI and MQTT |
| `TIER0_MQTT_HOST` | — | Tier0 MQTT WebSocket broker host injected by the platform |
| `TIER0_MQTT_PORT` | Defaults to `8084` | Tier0 MQTT WebSocket port injected by the platform |

`DB_SCHEMA` and `APP_ID` are typically set to the same session id. Tier0 SDK
variables are injected by the platform during deployment. Do not place them in
`.env.example`, and do not generate application UI for end users to edit them.

---

## Authentication Model

Authentication is handled by the platform gateway. The app does not manage
passwords or user accounts.

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

### Active Role Header Precedence

When the platform is the authority for role switching, the app reads the active
role in this order:

1. `X-Tier0-Runtime: preview` + `X-Tier0-Preview-Role`
2. `X-Tier0-Active-Role`
3. `X-Tier0-Preview-Role`
4. `X-App-User-Role`
5. `user.role`

This allows the platform to switch roles by updating its own active-role state,
reloading the iframe, and re-injecting the next request with the desired role.

### Authentication Flow (platform role is authoritative)

```text
Browser -> Platform UI switches active role
        -> Platform session / gateway context stores active role
        -> iframe reloads
        -> Gateway injects user + active role headers -> App
        -> src/start.ts middleware:

            mutating request with cross-origin Origin
              -> 403 blocked

            public path (/login, /api/auth/*, /api/health, /api/manifest, runtime/build assets)
              -> allow request

            gateway role authoritative (in PERMISSION_MATRIX, OR a
            gateway-injected Tier0 runtime role — see role-registration.md)
              -> refresh mes-session if missing or stale
              -> continue the same request
              -> allow request (a gateway-injected role with no matrix entry
                 enters with zero permissions via can())

            role present but unknown AND not gateway-injected
            (a forgeable legacy/login value)
              -> 403 fail closed

            no gateway role + valid mes-session cookie
              -> allow request

            gateway user present but no role + no session
              -> role not registered/bound yet: stay open with a
                 permission-less guest session (view-only) and allow the
                 request, without granting real access
              -> if the app defines no guest role, 302 /login?from=...

            no gateway user and no session
              -> 401
```

The key behavior is that the gateway role now overrides a stale app session.
A previously signed `mes-session` cookie is treated as a cache, not the source
of truth, whenever the platform sends a role header.

`/login` is now only a hidden fallback auth bridge. It tries to create a
permission-less guest session from gateway identity and redirects back to
`from`; it does not render the old role-picker UI and does not grant real
access.

### Role Management

Role definitions belong to the app. Role assignment belongs to the platform.

1. The agent defines `PERMISSION_MATRIX` in `permissions.ts`
2. The platform calls `GET /api/manifest` to discover valid roles
3. The platform assigns one or more roles to each user in its admin UI
4. The platform stores the user's current active role in its own session/context
5. The gateway injects that active role into forwarded requests
6. The app validates the role against `PERMISSION_MATRIX` and refreshes session state

The injected role string should match a `PERMISSION_MATRIX` key exactly
(`"Operator"` ≠ `"operator"`) so it also carries permissions. A gateway-injected
Tier0 role with no matrix entry still enters (zero permissions); only unknown
roles that are NOT gateway-injected fail closed. Full rules and the three-file
sync convention are in [`role-registration.md`](./role-registration.md).

The Shell should not be treated as the authority for role switching. In the
platform-authoritative model, the platform owns the active role and the iframe
app only consumes the forwarded identity and role.

---

## Platform Resource Model

```text
Project (proj-abc123)
  └─ Database: proj-abc123
       ├─ schema: session-001  <- app 1
       ├─ schema: session-002  <- app 2
       └─ schema: session-003  <- app 3
```

One session equals one app. `DB_SCHEMA` and `APP_ID` should normally use the
same value.

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
SESSION_SECRET="<32+ chars random hex; per-app or per-session, never reuse across tenants>"
DB_SCHEMA="session-xyz789"
APP_ID="session-xyz789"
VITE_BASE_PATH="/session-xyz789"
TIER0_API_HOST="<platform-injected>"
TIER0_API_KEY="<platform-injected>"
TIER0_MQTT_HOST="<platform-injected>"
TIER0_MQTT_PORT="8084"
```

**Gateway routing:**

For matched requests, the gateway must inject user headers in either JSON or
separate-header format and then proxy the request to the app.

For platform-authoritative role switching, the gateway should additionally
inject the currently active app role using either Tier0 role headers or the
legacy `X-App-User-Role` header. After the platform changes the active role,
it should reload the iframe so the next request carries the updated role.

### App Container Startup

Once the platform has prepared the database, schema, and env vars, it can start
the app:

```bash
npm install
npx drizzle-kit push    # create tables under DB_SCHEMA
npx tsx src/db/seed.ts  # seed DB_SCHEMA on first use
npm run build           # outputs dist/{client,server}
node server.mjs         # equivalent to npm start, listens on PORT (default 3000)
```

---

## Where Each Variable Is Read

| Variable | Read from |
|---|---|
| `DATABASE_URL` | `db/index.ts`, `drizzle.config.ts`, `db/seed.ts` |
| `SESSION_SECRET` | `lib/session.ts` (validated at startup; generated locally when absent outside production) |
| `DIRECT_DATABASE_URL` | `drizzle.config.ts`, `db/seed.ts` |
| `DB_SCHEMA` | `db/index.ts` (`search_path`), `drizzle.config.ts` (`schemaFilter`), `db/seed.ts` |
| `APP_ID` | `routes/api/manifest.ts` |
| `VITE_BASE_PATH` | `vite.config.ts` (`base`), `router.tsx` (`basepath`), `lib/utils.ts` (`apiUrl` primary source) |
| `TIER0_API_HOST` | Injected by the platform; read by `@tier0/sdk/openapi` at runtime |
| `TIER0_API_KEY` | Injected by the platform; read by `@tier0/sdk/openapi` and `@tier0/sdk/mq` |
| `TIER0_MQTT_HOST` | Injected by the platform; read by `@tier0/sdk/mq` |
| `TIER0_MQTT_PORT` | Injected by the platform; read by `@tier0/sdk/mq` |

---

## Scenario Matrix

| Scenario | `DATABASE_URL` | `SESSION_SECRET` | `DB_SCHEMA` | `APP_ID` | Base path |
|---|---|---|---|---|---|
| Local development | ✅ | optional, auto-randomized | optional | optional | optional |
| Platform preview session | ✅ | ✅ | ✅ | ✅ | depends on runtime |
| Production behind gateway | ✅ | ✅ | ✅ | ✅ | depends on gateway |

`optional` means the scaffold can fall back to defaults when the platform does
not provide a value.
