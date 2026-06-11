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
| `NEXT_PUBLIC_BASE_PATH` | Legacy fallback only | Read by `apiUrl()` if `VITE_BASE_PATH` is missing |
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

### Supported Header Formats

The `role` field is optional. If the gateway provides it, the app uses it
directly. If not, the app falls back to `/login` for role selection.

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

At minimum, a user id must be present. If `name` or `email` is missing, the
app falls back to the user id. If `role` is missing, the app does not
automatically sign a session.

### Authentication Flow (Mode A: gateway role first)

```text
Browser -> Gateway (validates platform login) -> injects user + role headers -> App
  -> src/start.ts middleware:

      has mes-session cookie
        -> allow request

      no cookie + gateway role exists in PERMISSION_MATRIX
        -> sign mes-session cookie automatically
        -> 302 back to the same URL
        -> allow request

      no cookie + gateway role missing or invalid
        -> 302 /login?from=...
        -> POST /api/auth/select-role writes cookie

      no cookie + no gateway header
        -> 401
```

The second branch is the core of Mode A: users never see `/login` when the
gateway already provides a valid app role.

### Role Management

Role definitions belong to the app. Role assignment belongs to the platform.

1. The agent defines `PERMISSION_MATRIX` in `permissions.ts`
2. The platform calls `GET /api/manifest` to discover valid roles
3. The platform assigns a role to each user in its admin UI
4. The gateway injects that role into forwarded requests
5. The app validates the role against `PERMISSION_MATRIX` and signs the session

The injected `role` string must exactly match a `PERMISSION_MATRIX` key.
`"Operator"` and `"operator"` are different values. Unknown roles fail closed:
they do not gain access automatically and fall back to `/login`.

The Shell no longer exposes a "Switch Role" action. In Mode A, the platform is
authoritative for role changes.

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
# Optional legacy fallback:
# NEXT_PUBLIC_BASE_PATH="/session-xyz789"
```

**Gateway routing:**

For matched requests, the gateway must inject user headers in either JSON or
separate-header format and then proxy the request to the app.

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
| `NEXT_PUBLIC_BASE_PATH` | `lib/utils.ts`, and as a fallback in `vite.config.ts` / `router.tsx` |
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
