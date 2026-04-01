# SSO Integration: gwsvr Gateway + monoapp

## Background

monoapp runs as an application on the Tier0 platform. The gwsvr gateway serves as the unified traffic entry point. This document describes how SSO authentication works between the platform and app, and how development/production modes coexist cleanly.

**Core principle:** The app's standard auth system (`auth.ts`, `users.ts`, `permissions.ts`) only knows about `mes-session` cookies. SSO is a thin adapter layer that translates external identity into that cookie. Everything downstream is mode-agnostic.

---

## Architecture Overview

```
┌─────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│  Browser     │      │  gwsvr Gateway        │      │  monoapp         │
│              │      │                      │      │                 │
│  SSO button ──────► │  /login (gateway UI)  │      │                 │
│              │      │  auth + check-token   │      │                 │
│  callback   ◄────── │  query app_role table ──────► │  /api/auth/cb   │
│              │      │  inject user header   │      │  → write cookie  │
│              │      │                      │      │  → standard auth │
└─────────────┘      └──────────────────────┘      └─────────────────┘
```

---

## 1. Role Ownership

**Roles are the app's private concept.** The platform does not define or hardcode them.

The app exposes a manifest endpoint that declares its roles:

```
GET /api/manifest → { appId, roles: [{ key, label }], defaultRole }
```

This data comes directly from `permissions.ts` — when the app adds/removes roles, the manifest auto-updates. The platform reads this endpoint to populate its admin UI for role assignment.

## 2. Platform Side: Role Assignment

### Database Table

```sql
CREATE TABLE app_role_assignment (
  user_id   BIGINT NOT NULL,
  app_id    TEXT   NOT NULL,
  app_role  TEXT   NOT NULL,
  PRIMARY KEY (user_id, app_id)
);
```

One table for all apps platform-wide.

### Admin Flow

1. Admin opens "App Permissions" page in platform console
2. Platform backend calls app's `GET /api/manifest` → gets current role list
3. Admin assigns roles to users via dropdown
4. Saved to `app_role_assignment` table

## 3. Gateway Side: Inject appRole

### Config

Each app's proxy routes include an `appId` in `SetParam`:

```yaml
- Location: "/api/bff/:suffix"
  ProxyPass: "http://monoapp:3000/api/bff/{{.suffix}}"
  SetParam:
    needAuth: true
    appId: "monoapp-mes"
```

### Auth Middleware Addition

After `check-token` succeeds, before injecting the `user` header:

```
check-token → UserCtx { userID, userName, roleCode, ... }
    │
    ▼
read conf.SetParam["appId"] → "monoapp-mes"
    │
    ▼
SELECT app_role FROM app_role_assignment WHERE user_id = ? AND app_id = ?
    │
    ├─ found → appRole = result
    └─ not found → appRole = "" (app uses its defaultRole)
    │
    ▼
inject into user header as JSON
```

### Injected Header

```json
{
  "userID": "10001",
  "userName": "alice",
  "roleCode": "admin",
  "appRole": "operator"
}
```

## 4. App Side: SSO Adapter Layer

### Scaffold-Provided Files (DO NOT MODIFY)


| File                                 | Purpose                                                                                 |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/lib/sso.ts`                     | SSO config helpers: `isSSOEnabled()`, `getLoginURL()`, `checkToken()`, `mapToAppUser()` |
| `src/app/api/auth/callback/route.ts` | SSO callback: verify token → write cookie → redirect                                    |
| `src/app/api/auth/logout/route.ts`   | Clear cookie, optionally redirect to gateway logout                                     |
| `src/app/api/manifest/route.ts`      | Expose role list from `PERMISSION_MATRIX`                                               |
| `src/proxy.ts`                       | Auth proxy: auto-create session from gateway `user` header                              |


### Files the Agent Generates (unchanged from standard flow)


| File                            | What Agent Does                                    |
| ------------------------------- | -------------------------------------------------- |
| `src/lib/users.ts`              | Populate with 5+ local dev users                   |
| `src/lib/permissions.ts`        | Define roles, actions, PERMISSION_MATRIX           |
| `src/app/(auth)/login/page.tsx` | Build login UI with SSO button + quick login panel |
| All Route Handlers              | Use `requireAuth()` as normal                      |
| All pages                       | Use `can()` as normal                              |


### Login Page Layout

```
┌──────────────────────────────────────────┐
│  Left half (dark)    │  Right half        │
│                      │                    │
│  App brand           │  "Welcome back"    │
│  Title + tagline     │                    │
│  Feature highlights  │  [SSO Login ▸]     │
│                      │                    │
│                      │  ─── or ───        │
│                      │                    │
│                      │  Quick Login       │
│                      │  [Admin] [Opr]     │
│                      │  [Supv]  [QC]      │
└──────────────────────────────────────────┘
```

- SSO button calls `getLoginURL()` from `@/lib/sso` → redirects to gateway login page
- If SSO is not configured (`GATEWAY_URL` not set), button auto-hides
- Quick Login panel always available for dev/debug

## 5. Development vs Production Mode

### Environment Variables

```env
# .env (development - default)
DATABASE_URL="postgresql://..."
# No NEXT_PUBLIC_GATEWAY_URL → SSO button hidden, local-only login

# .env.production (add when deploying behind gateway)
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_GATEWAY_URL=https://gateway.example.com
NEXT_PUBLIC_GATEWAY_LOGIN_PATH=/login
GATEWAY_CHECK_TOKEN_URL=http://gateway-internal:8795/api/bff/auth/check-token
```

`NEXT_PUBLIC_` vars are readable by client components (SSO button in login page).
`GATEWAY_CHECK_TOKEN_URL` is server-only (used by callback route handler).

### Who Knows About the Mode?


| Component                | Knows mode? | How?                                           |
| ------------------------ | ----------- | ---------------------------------------------- |
| `src/lib/sso.ts`         | Yes         | Reads `GATEWAY_URL` env var                    |
| `src/proxy.ts`           | Yes         | Checks for `user` header                       |
| `/login` page            | Yes         | Calls `isSSOEnabled()` to show/hide SSO button |
| `/api/auth/callback`     | Yes         | Only used in SSO flow                          |
| `src/lib/auth.ts`        | **No**      | Only reads `mes-session` cookie                |
| `src/lib/users.ts`       | **No**      | Static user list, unchanged                    |
| `src/lib/permissions.ts` | **No**      | Role + action definitions, unchanged           |
| All Route Handlers       | **No**      | Call `requireAuth()` as always                 |
| All page components      | **No**      | Call `can()` as always                         |
| AGENTS.md rules          | **No**      | Agent follows same patterns regardless         |


### Flow Comparison

```
Development (AUTH_MODE=local):
  Browser → /login → click user card → POST /api/auth/login
  → verify users.ts → write mes-session cookie → redirect /
  → auth.ts reads cookie → normal operation

Production (AUTH_MODE=sso):
  Path A: Via login page
  Browser → /login → click SSO button → redirect to gateway /login
  → gateway auth → callback /api/auth/callback?token=xxx
  → verify token → read appRole → write mes-session cookie → redirect /
  → auth.ts reads cookie → normal operation

  Path B: Gateway direct proxy (user already logged in)
  Browser → gateway → inject user header → monoapp
  → proxy.ts detects header, no cookie
  → parse header → write mes-session cookie → continue
  → auth.ts reads cookie → normal operation
```

### Cookie Format (Self-Contained)

```json
{
  "userId": "10001",
  "role": "operator",
  "displayName": "Alice Wang",
  "username": "alice"
}
```

`getCurrentUser()` first tries `getUserById()` (finds local dev users), then falls back to constructing an `AppUser` from the cookie payload itself. This means SSO users don't need to exist in `users.ts`.

## 6. Change Summary

### Gateway Side


| Change                                  | Effort           |
| --------------------------------------- | ---------------- |
| Add `app_role_assignment` table         | 1 DDL            |
| Add `AppRole` field to `UserCtx` struct | 1 line           |
| Query table in `init.go` after auth     | ~10 lines        |
| Add `appId` to route YAML `SetParam`    | 1 line per route |
| CRUD API for role assignment management | Standard CRUD    |
| Admin UI page for role assignment       | 1 page           |


### App Side (Scaffold)


| Change                                             | Effort           |
| -------------------------------------------------- | ---------------- |
| `src/lib/sso.ts` — SSO helpers                     | ~40 lines        |
| `src/lib/auth.ts` — self-contained cookie fallback | ~5 lines changed |
| `src/app/api/auth/callback/route.ts`               | ~30 lines        |
| `src/app/api/auth/logout/route.ts`                 | ~15 lines        |
| `src/app/api/manifest/route.ts`                    | ~15 lines        |
| `src/proxy.ts` — auth proxy                       | ~30 lines        |
| AGENTS.md — mention SSO button in Step 2           | ~10 lines added  |


### App Side (Agent-Generated, Zero Change to Pattern)

The Agent generates login page with SSO button + quick login panel as part of normal Step 2. No new concepts needed — just "render a button that calls `getLoginURL()`".