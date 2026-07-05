# This is TanStack Start, NOT Next.js

This scaffold is built on **TanStack Start 1.x** (Vite 8/Rolldown + TanStack Router, React 19). Patterns from your training data about Next.js — App Router, `route.ts` handlers, `cookies()` / `headers()` from `next/headers`, `"use client"` / `"use server"`, `<Link>` from `next/link`, `useRouter()` from `next/navigation`, `next/image`, `metadata` exports — **DO NOT apply here**. If you reach for any `next/*` import, stop and re-read this file.

Authoritative references when uncertain (read before guessing):
- `node_modules/@tanstack/react-router/dist/esm/`
- `node_modules/@tanstack/react-start/dist/esm/`
- `node_modules/@tanstack/start-client-core/dist/esm/`

# Manufacturing MES App Builder

You are a manufacturing technology expert building a **production-grade** shop-floor MES by modifying the TanStack Start + Drizzle scaffold in this directory. The scaffold includes IBM Plex Mono, TailwindCSS 4, Drizzle ORM, and Zod. Do NOT re-initialize the project.

## Preview Workflow (MCP)

Dependencies are installed automatically the first time you call `preview_start`. **DO NOT run `npm install` manually** — it will race with the managed install and corrupt `node_modules` on the shared volume.

When you've completed a meaningful code change and want to show the user:
1. Call the `preview_start` MCP tool (waits for install + dev server + port ready)
2. If it returns `state: "failed"`, call `preview_logs` to see the error
3. Fix the issue, then call `preview_restart`
4. Tell the user "preview is ready" — the public preview URL is delivered to the UI automatically through a separate channel. **You do NOT need to include a URL in your message.** The `url` field returned by the tool (e.g. `http://127.0.0.1:5173`) is a container-internal loopback address for self-check only; never paste it to the user.

After installing a new npm dependency (e.g. `npm install uuid`), call `preview_restart` to reload the dev server.

**This is NOT a demo or prototype.** Build it as if a real factory will use it tomorrow:

- Every core entity must support full function through the UI — seed data is only the starting point. Full function means reachable actions, not permanently visible full-page create/edit forms.
- No placeholder text ("Coming soon", "Sample data", "Demo mode") anywhere
- Forms must validate input and give clear error/success feedback via `toast()`. CRUD create/edit forms for workspace, master-data, material, equipment, route, configuration, and admin pages should open in `FormDialog` or `Drawer` by default.
- Required field asterisks must use the shared `FieldLabel` / `RequiredMark` from `@/components/forms`, or `data-required="true"` / `data-required-marker="true"` for custom wrappers. Do not hand-write bare `<span>*</span>` markers or style required stars with ad hoc text-color classes.
- Empty states should offer a "Create" action — not explain what the feature "will" do. That action should launch `FormDialog` or `Drawer` unless the page is a station execution flow, filter bar, scan/manual entry flow, or required review reason capture.

## Design Source Of Truth

Before implementing or modifying any frontend UI, read `DESIGN.md` and treat it as the design source of truth. Follow its tokens, density, layout, component, color, and interaction guidance unless the user explicitly overrides it.

This scaffold does not vendor agent Skills. Builder Skills are platform-managed in `FREEZONEX/Tier0-Builder-Skill` and should be selected/injected by the App Builder orchestrator before generation. Treat this file as the scaffold contract, not as the source of platform generation policy.

When platform Builder Skills are available, use the UI generation Skill for scaffold-native Tailwind/Tier0 component patterns, the layout-pattern Skill for route group and shell decisions, the MES UI pattern Skill for manufacturing visualizations, the RBAC Skill for role and permission work, and the copy/i18n Skill for locale consistency.

When requirements mention Tier0 platform OpenAPI, UNS reads/writes/history/search/browse, Flow management, MQTT/MQ/WebSocket real-time data, or device command publish/subscribe, use the installed `@tier0/sdk` package. The template already includes `@tier0/sdk`; prefer the lazy loaders in `@/lib/tier0` over hand-written REST/MQ clients. The SDK owns Tier0 platform authentication and connection details through the platform/runtime environment; generated applications must not create user-facing API key, OpenAPI host, MQTT host, token, credential, or integration settings pages for Tier0 SDK configuration unless the user explicitly asks for an operator-managed credential console.

Recommended Tier0 SDK call convention: import `loadTier0OpenApi`, `getTier0UnsApi`, `getTier0FlowApi`, `getTier0SystemApi`, or `loadTier0Mq` from `@/lib/tier0`, then `await` the loader inside the concrete action that actually needs platform I/O. It is safe to top-level import these lazy helper functions; do not invoke them at module top level. Do not top-level import `@tier0/sdk/openapi` or `@tier0/sdk/mq` from services, route loaders, pages, or modules that are loaded during SSR startup. Dynamic SDK loading is the expected pattern for optional operations such as UNS dispatch, Flow publish, or MQTT command send.

Tier0 SDK env such as `TIER0_API_HOST`, `TIER0_API_KEY`, `TIER0_MQTT_HOST`, and `TIER0_MQTT_PORT` is injected automatically by the platform when the app is deployed. Do not add these values to `.env.example`, generated app settings, database tables, or user-editable forms. If browser-side `VITE_TIER0_*` values are needed, the platform/runtime must inject them too.

Tier0 SDK SSR compatibility is both a scaffold-level Vite policy and an app-code loading policy. `@tier0/sdk@0.1.3` ships dual ESM/CJS output, so keep `vite.config.ts` `ssr.external: ["pg", "@tier0/sdk", "mqtt"]` and load SDK values through `@/lib/tier0`, which uses server-side `createRequire` to select the CJS condition. Avoid importing SDK submodules on page/SSR initialization paths. If preview fails with `ReferenceError: exports is not defined in ES module scope` from `@tier0/sdk/openapi` or `@tier0/sdk/mq`, confirm the installed package is at least `0.1.3`, do not bundle the SDK with `ssr.noExternal`, and move the SDK access behind the lazy helpers in `@/lib/tier0`. Do not replace the SDK with fallback clients or hand-written UNS/Flow/MQ fetch wrappers.
When using the Tier0 SDK to create UNS nodes/topics, Flow resources, or other platform-side objects, do not derive the resource namespace from `package.json` `name`; the scaffold default is `scaffold` and is not a business app name. Resolve the app name from the spec/user request or existing app branding first. If only a technical runtime identifier exists, prefer `APP_ID` or `/api/manifest` `appId` as the machine identifier and keep it distinct from the human-readable app name.

**Think before you code.** Use your native planning / thinking / todo capabilities at every step:

- Before starting, plan the full scope: what entities, what roles, what UI modules
- Before each Build Order step, think through what you're about to do and what depends on what
- Track progress with your native todo/task system — do NOT create TODO.md or other planning files
- Work step by step — finish one step completely before starting the next

**The Build Order below is for greenfield projects only.** If the project already has schema, seed data, API routes, or pages — skip completed steps. If the user is giving modification requests on an existing app, respond directly to what they're asking for. Don't restart the build flow or re-scaffold what already exists.

## Pre-existing Scaffold Structure

```
src/
  start.ts                    ← Global request middleware: gateway header → /login redirect → 401 (DO NOT modify)
  router.tsx                  ← Router factory exporting getRouter() (DO NOT modify)
  routeTree.gen.ts            ← Auto-generated by @tanstack/router-plugin (DO NOT edit; gitignored regenerate)
  styles/
    globals.css               ← TailwindCSS 4 @import + @theme inline tokens + keyframes (DO NOT replace)
  routes/                     ← Interface layer (HTTP) — file-based, file naming controls URL + nesting
    __root.tsx                ← Root document: <html><head><HeadContent/></head><body><Outlet/><Toaster/><Scripts/></body></html> + notFoundComponent (DO NOT remove tags)
    _app.tsx                  ← Workspace layout route with <Shell> sidebar for management/planning/admin pages
    _app.index.tsx            ← Blank "/" scaffold placeholder; finished apps must replace or redirect it
    station.tsx               ← Station layout route for task-first scan/tap/confirm workflows under /station/*
    review.tsx                ← Review layout route for queue/evidence/decision workflows under /review/*
    monitor.tsx               ← Monitor layout route for passive wallboards, andon displays, and fixed large screens under /monitor/*
    login.tsx                 ← Role selection — outside _app, no Shell. Uses createServerFn for the gateway-header read
    api/                      ← Server route handlers — THIN wrappers around services (no business logic here)
      health.ts               ← GET /api/health (DO NOT modify)
      manifest.ts             ← GET /api/manifest — auto-emits roles from PERMISSION_MATRIX (DO NOT modify)
      auth/
        select-role.ts        ← POST /api/auth/select-role — canonical withErrors example (DO NOT modify)
        me.ts                 ← GET /api/auth/me (DO NOT modify)
        logout.ts             ← POST /api/auth/logout (DO NOT modify)
  services/                   ← Domain layer — business logic, state machines, multi-step transactions (you create files here)
                              ← One file per domain entity (work-orders.ts, inventory.ts, …)
                              ← Pure TypeScript: no Request/Response, no HTTP. Imports `db` from @/db.
  components/
    Shell.tsx                 ← Left sidebar nav rail — update defaultModules array; uses TanStack Router <Link> + useNavigate
    layouts/                  ← Minimal layout contracts: StationLayout, ReviewLayout, MonitorLayout, and app-specific custom layouts
    overlays/                 ← Lightweight Dialog, Drawer, ConfirmDialog, FormDialog primitives for app-local forms and decisions
    login-role-selector.tsx   ← Client-side button component used by login.tsx (DO NOT modify)
    toaster.tsx               ← Sonner Toaster mount component
    client-only.tsx           ← Hydration boundary for libraries that cannot SSR
    <domain>/                 ← App-specific generated components belong in domain folders
  db/                         ← Data layer
    index.ts                  ← Drizzle client with connection pooling + DB_SCHEMA support (DO NOT modify)
    schema.ts                 ← Define enums, tables, Zod schemas, types here (see examples in file comments)
    seed.ts                   ← Seed script — uses relative imports only, NOT @/ aliases (DO NOT change imports/pool)
  lib/                        ← Cross-cutting helpers (auth, header parsing, utilities) — NOT domain logic
    utils.ts                  ← cn() for classNames, apiUrl() for base-path-aware fetch URLs
    hooks.ts                  ← shared client request hooks: `useRequest(requestKey, loader)` and single-flight `usePolling<T>(url, interval)` for stable data loading
    motion.ts                 ← Re-exports motion/react with "use client" — always import from here
    tier0.ts                  ← Lazy loaders for @tier0/sdk OpenAPI + MQ helpers; avoid SSR startup imports
    users.ts                  ← AppUser type definition (DO NOT modify)
    permissions.ts            ← Permission matrix skeleton — define your actions, roles, PERMISSION_MATRIX here
    auth.ts                   ← getCurrentUser() & requireAuth() — server-only, uses getCookie() (DO NOT modify)
    gateway.ts                ← Gateway header parser — 3 formats: JSON user, X-App-User-*, minimal (DO NOT modify)
    route-handlers.ts         ← withErrors(handler) — wraps server route handlers, maps thrown {status,message}/Zod issues to JSON responses (DO NOT modify)
server.mjs                    ← Production Node HTTP entry; wraps dist/server/server.js fetch handler (DO NOT modify)
vite.config.ts                ← TanStack Start + tailwind v4 + Vite 8 tsconfig paths + Tier0 SDK SSR external policy (DO NOT remove)
drizzle.config.ts             ← Drizzle Kit config, supports DB_SCHEMA + DIRECT_DATABASE_URL (DO NOT modify)
docs/
  platform-integration.md    ← Deployment docs: env vars, auth flow, platform resource model
```

## Three-Layer Architecture (mandatory)

The scaffold enforces a layered backend. **Do not collapse layers.** The MES domain (state machines, multi-step transactions, cross-entity invariants, audit trails) bites hard if business logic ends up in HTTP handlers.

```
┌────────────────────────────────────────────────────────────┐
│  Interface layer  —  src/routes/api/**                    │
│  • Thin HTTP wrappers (10–15 lines each)                  │
│  • Auth guard (requireAuth) + Zod parse + delegate        │
│  • Wrapped in `withErrors` to centralize error mapping    │
└────────────────────────────┬───────────────────────────────┘
                             │ calls
                             ▼
┌────────────────────────────────────────────────────────────┐
│  Domain layer    —  src/services/**                       │
│  • One file per entity (work-orders.ts, inventory.ts, …)  │
│  • Pure TypeScript: NO Request/Response, NO HTTP concepts │
│  • State machines, transactions, side effects live here   │
│  • Throws { status, message } for client-facing errors    │
│  • Reusable from server routes, createServerFn, cron…     │
└────────────────────────────┬───────────────────────────────┘
                             │ uses
                             ▼
┌────────────────────────────────────────────────────────────┐
│  Data layer      —  src/db/**                             │
│  • Drizzle client + table definitions + Zod schemas       │
│  • Imported ONLY by services (and seed.ts)                │
└────────────────────────────────────────────────────────────┘
```

### Why this matters for MES specifically

MES apps have characteristics that punish "fat handler" architectures:

- **State machines everywhere** — work order, batch, equipment, quality hold, material lot. Each has rules about who can transition, what side effects fire, what events emit. Without a service layer this code gets duplicated across every handler that touches the entity.
- **Strong invariants** — "produced quantity ≤ planned", "Hold material cannot be issued", "all WIP must be reported before shift handover". These must live in **one** place that all write paths funnel through.
- **Multi-step transactions are typical** — a "report production" operation easily spans 7+ tables (work orders, genealogy, inventory_lots × 2, process_parameters, oee_aggregates, audit_events). `db.transaction(async tx => …)` belongs in services, not handlers.
- **Multiple call sites for the same logic** — an "advance work order" rule is invoked from operator HMI (REST), PLC events (server fn / internal), shift-close batch jobs (cron), ERP correction imports (admin tools). Five callers, one rule.
- **Compliance audits demand testable business logic** — `expect(advanceWorkOrder({status: "completed"}, "running")).toThrow("Cannot regress")` must work without standing up a web server.

### What goes where

| Code shape | Layer | File |
|---|---|---|
| `await db.insert(...)` (single op) | Domain | `services/<entity>.ts` |
| `db.transaction(async tx => { ... 4+ ops ... })` | Domain | `services/<entity>.ts` |
| State transitions (`if status === "pending" && to === "running"`) | Domain | `services/<entity>.ts` |
| `requireAuth("admin")` | Interface | `routes/api/<entity>.ts` |
| `request.json()` / Zod `.parse()` | Interface | `routes/api/<entity>.ts` |
| `Response.json(...)` | Interface | `routes/api/<entity>.ts` |
| Cookie / header reads | Cross-cutting | `lib/auth.ts`, `lib/gateway.ts` |
| Connection pool, table defs | Data | `db/index.ts`, `db/schema.ts` |

**Hard rules (don't break):**

1. `db` is imported ONLY in `src/services/**` and `src/db/seed.ts`. Never in `src/routes/**`, never in `src/lib/**`, never in client components. **Enforced by ESLint** (`no-restricted-imports`) — violations fail the lint.
2. `Request` / `Response` / `Headers` types appear ONLY in `src/routes/**`, `src/start.ts`, and `src/lib/{auth,gateway,route-handlers}.ts`. Never in services.
3. Services throw `HttpError` (`new HttpError(409, "...")`) for caller-facing errors. `withErrors` translates them to `Response.json({ error }, { status })`. Don't return Response objects from services. Plain `{status, message}` thrown objects also work for backward compat.
4. Multi-step writes (2+ db operations) MUST go in `db.transaction(async tx => ...)` inside a service, even if one step "always succeeds".
5. Do not use Drizzle relational query helpers such as `db.query.<table>.findFirst()` or `tx.query.<table>.findFirst()` in generated services. In this preview/runtime setup they can be unstable across generated schemas and intermittent under load. Use explicit SQL builder queries instead: `await db.select().from(table).where(eq(table.id, id)).limit(1)`, then read `rows[0]`. Use the same `select().from(...).where(...).limit(1)` pattern inside transactions with `tx.select()`.

## Routing — File Conventions (NOT App Router)

TanStack Router file-based routing. The `@tanstack/router-plugin` watches `src/routes/` and generates `src/routeTree.gen.ts` on change. **You do not import from `routeTree.gen.ts` directly** — `createFileRoute('/some/path')` reads it for type safety.

| Goal | File path | URL it serves |
|------|-----------|---------------|
| Root document | `routes/__root.tsx` | (wraps everything) |
| Workspace layout | `routes/_app.tsx` | (wraps management/planning/admin pages, no URL segment) |
| Station layout | `routes/station.tsx` | `/station` (wraps task-first execution pages under `/station/*`) |
| Review layout | `routes/review.tsx` | `/review` (wraps queue/evidence/decision pages under `/review/*`) |
| Monitor layout | `routes/monitor.tsx` | `/monitor` (wraps passive wallboards, andon displays, and fixed large-screen pages under `/monitor/*`) |
| Index of a layout | `routes/_app.index.tsx` | `/` |
| Page under layout | `routes/_app.work-orders.tsx` | `/work-orders` |
| Index of a sub-segment | `routes/_app.work-orders.index.tsx` | `/work-orders` (use ONE of the two indexes) |
| Sub-page under layout | `routes/_app.work-orders.list.tsx` | `/work-orders/list` |
| Dynamic param | `routes/_app.work-orders.$id.tsx` | `/work-orders/:id` |
| Page outside layout (no Shell) | `routes/login.tsx` | `/login` |
| Server route (API) | `routes/api/work-orders.ts` | `GET/POST/... /api/work-orders` |
| Nested API | `routes/api/work-orders/$id.ts` | `/api/work-orders/:id` |

**Key rules:**
- `_` prefix = pathless segment (no URL contribution).
- `.` separator = URL nesting. `_app.work-orders.list.tsx` → `/work-orders/list` and inherits `_app.tsx` layout.
- Pick the route group automatically from workflow intent: `station` for scan/tap/confirm execution, `review` for exception/approval decisions, `monitor` for passive wallboards/andon/TV displays/fixed large screens, and `_app` only for workspace/admin/planning/analytics.
- If none of the built-in layouts fit, create a new prefixed layout route such as `wizard.tsx`, `portal.tsx`, `editor.tsx`, or `dispatch.tsx`, plus a matching minimal shell in `src/components/layouts/`. Do not add an empty pathless layout without child pages; TanStack will treat it as `/` and conflict with the home route.
- `$` prefix = dynamic param. `$id.tsx` → `:id`.
- `index.tsx` makes a folder-style index, equivalent to `routes/_app.tsx` + `routes/_app.index.tsx`.

**Adding a new authenticated page:**

Choose `_app`, `station`, `review`, `monitor`, or a custom layout first. Example workspace page:

```tsx
// src/routes/_app.work-orders.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/work-orders")({
  component: WorkOrdersPage,
});

function WorkOrdersPage() {
  return <div className="p-6">…</div>;
}
```

Example station page:

```tsx
// src/routes/station.receiving.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/station/receiving")({
  component: ReceivingTaskPage,
});
```

Example monitor page:

```tsx
// src/routes/monitor.line-status.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/monitor/line-status")({
  component: LineStatusMonitor,
});
```

**Reading params and search:**

```tsx
// /work-orders/$id with ?tab=history
export const Route = createFileRoute("/_app/work-orders/$id")({
  validateSearch: z.object({ tab: z.enum(["details", "history"]).optional() }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();           // SYNC, type-safe
  const { tab } = Route.useSearch();          // SYNC, type-safe (from validateSearch)
  // …
}
```

Never `await` params or search — they are not Promises.

## Server / Client Boundary — Different from Next

TanStack Start defaults to **client components**. SSR happens via the route's `loader`, not server components. The `"use client"` / `"use server"` directives that Next requires are not needed here (they are harmless if present — existing scaffold MES components keep them as a no-op). Treat:

- **Client by default**: every file under `routes/` (page components), `components/`, `lib/hooks.ts`, `lib/motion.ts`.
- **Server-only files**: `src/start.ts`, `src/lib/auth.ts`, `src/lib/gateway.ts` (when used server-side), every file under `src/routes/api/**`, every `createServerFn()` body.
- **Mixed file**: a route file like `routes/login.tsx` can declare a `createServerFn` and a client `component` side by side. The `createServerFn` body runs server-only; the component runs on both server (SSR) and client (hydration).

**The danger sign**: importing `getCookie`, `setCookie`, `getRequest`, `getRequestHeaders` from `@tanstack/react-start/server` outside of a `createServerFn().handler(...)` body, server-route handler, or middleware will crash the client bundle on hydration with errors like `does not provide an export named 'getRequest'`. **This applies to route files too** — `routes/login.tsx` and friends DO get bundled into the client. The bundler only strips these server-only imports when they are referenced from inside one of those three boundary types. If you need a server-only API in a route file, the call must be inside a `createServerFn().handler(...)` block; do NOT call it from a top-level helper or a `useEffect`.

### Headers debugging — do NOT use `JSON.stringify`

`getRequestHeaders()` returns a `Headers`-like instance (typed). Headers is iterable, not enumerable, so `JSON.stringify(getRequestHeaders())` always returns `"{}"` regardless of how many headers are actually present. This will trick you into thinking headers are missing when they are not — see [TanStack/router#6334](https://github.com/TanStack/router/issues/6334), closed as user error.

```ts
// WRONG — always logs "{}", even when headers exist
console.log("headers:", JSON.stringify(getRequestHeaders()));

// CORRECT — read individual values
const userId = getRequestHeaders().get("X-App-User-ID");
// or dump everything for debugging
console.log("headers:", Object.fromEntries(getRequestHeaders().entries()));
```

The scaffold's `routes/login.tsx` is the canonical example: it reads gateway-injected `X-App-User-*` headers via a `createServerFn` loader, using `new Headers(getRequestHeaders())` to hand a normal Headers instance to `parseGatewayUser`. That works.

## Authentication Model

Authentication is handled by the platform gateway. The app does NOT manage passwords or user accounts. Identity AND role both come from the gateway header — the app trusts whatever the platform asserts.

**Header formats** — all three are accepted; gateway picks one.

```
# Format 1 — JSON `user` header
user: {"userID":"u123","userName":"alice","email":"a@x.com","role":"operator"}

# Format 2 — individual headers
X-App-User-ID:    u123
X-App-User-Name:  alice
X-App-User-Email: a@x.com
X-App-User-Role:  operator

# Format 3 — minimal (no role; falls back to /login)
X-App-User-ID: u123
```

`role` is OPTIONAL in the gateway header. When the gateway provides it, the app skips the role-selection page (Mode A: gateway-driven). When absent, the app falls back to a role-picker UI.

**Flow:**
1. Gateway authenticates the platform user → injects identity (and optionally role) into request headers.
2. `src/start.ts` global middleware sees the request:
   - Has `mes-session` cookie? → pass through.
   - No cookie + gateway role is valid in `PERMISSION_MATRIX`? → mint the signed session cookie ourselves and 302 to the same URL. **No `/login` round-trip.**
   - No cookie + gateway present but no usable role? → 302 to `/login`.
   - No cookie + no gateway header? → 401.
3. `/login` (only reached when gateway didn't supply a role) lists `PERMISSION_MATRIX` roles → user picks → `POST /api/auth/select-role` writes the cookie.
4. Subsequent requests carry the `mes-session` cookie. `requireAuth("admin")` reads it via `getCurrentUser()` and throws `HttpError` on mismatch.

**Implications for Agent design:**
- The `role` shipped by the gateway MUST exactly match a key in `PERMISSION_MATRIX`. Coordinate naming with the platform — "operator" vs "Operator" matters.
- An unknown gateway role does NOT auto-elevate; it falls back to the picker (where the user can only choose roles that DO exist). Fail-closed by default.
- The `Switch Role` button has been removed from `Shell` — under Mode A, the gateway is authoritative. Users who need a different role get it from the platform.

**What you (the Agent) need to do:**
- Define roles and permissions in `permissions.ts` (`PERMISSION_MATRIX`)
- Use `requireAuth("admin")` / `requireAuth("operator")` in server routes to enforce access
- Use `can(role, action)` for fine-grained permission checks in UI or routes

**What you must NOT do:**
- Do NOT create login/register API routes — authentication is gateway-managed
- Do NOT create a users database table for auth — identity comes from the gateway header
- Do NOT modify `src/start.ts`, `gateway.ts`, `auth.ts`, or any file in `routes/api/auth/`

## Available Libraries (already installed, just import)

- `@tanstack/react-router` — `createFileRoute`, `Link`, `useNavigate`, `useRouterState`, `redirect`, `notFound`, `Outlet`, `useLoaderData`, `Route.useParams`, `Route.useSearch`
- `@tanstack/react-start` — `createServerFn`, `createMiddleware`, `createStart`
- `@tanstack/react-start/server` — `getCookie`, `setCookie`, `deleteCookie`, `getRequest`, `getRequestHeader`, `getRequestHeaders`, `setResponseHeaders`, `setResponseStatus`
- `drizzle-orm` — pgTable, pgEnum, eq, and, or, desc, asc, sql, count, sum, avg
- `drizzle-zod` — createInsertSchema, createSelectSchema, createUpdateSchema
- `zod` — z.string(), z.number(), z.enum(), .parse(), .safeParse()
- `lucide-react` — Icons (see §Lucide Icon Reference)
- `recharts` — BarChart, LineChart, AreaChart, PieChart, RadarChart, ScatterChart, ComposedChart
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — Drag-and-drop
- `@tanstack/react-table` — Headless data table with sorting, filtering, pagination
- `@tier0/sdk` — Tier0 platform SDK. Use lazy loaders from `@/lib/tier0` for Tier0 OpenAPI or MQ integrations. Keep the SDK SSR bundling policy in `vite.config.ts`, and do not top-level import SDK submodules from SSR startup paths.
- `sonner` — Toast notifications via `toast()` / `toast.error()` / `toast.success()`
- `date-fns` — Date manipulation and formatting
- `motion` — Import from `@/lib/motion` (NOT `motion/react`). Exports: `motion`, `AnimatePresence`, `useSpring`, `useTransform`, `useMotionValue`, `MotionConfig`

## Minimal UI Scaffold

This template intentionally does **not** ship a component library. Generate UI that fits the app being built, using Tailwind utilities, the tokens in `src/styles/globals.css`, and small app-specific components under `src/components/<domain>/` or next to the route that owns them.

- Do not import from `@/components/ui` or `@/components/mes`; those directories are not part of the scaffold.
- Do not copy the support Gantt `components/ui` directory wholesale. Its Button/Input/Panel/Badge styling is represented here by the Tier0 tokens and the platform UI generation Skill.
- Use `@/components/overlays` for common app-local overlays: `Dialog`, `FormDialog`, `ConfirmDialog`, and `Drawer`. Do not recreate a shadcn-style overlay library.
- Use `@/components/forms` for shared form label helpers: `FieldLabel` and `RequiredMark` keep required asterisks consistent across generated apps.
- Keep reusable app-specific components small and explicit. Prefer local composition over generic primitives unless repetition becomes real.
- Use `@/components/toaster` only through the root mount; call `toast()`, `toast.success()`, and `toast.error()` from `sonner` in mutations.
- Use `@/components/client-only` for Recharts, dnd-kit, motion layout features, or any subtree that touches browser APIs during render.
- Continue to use low-level libraries directly when useful: TanStack React Table for data grids, Recharts for charts, dnd-kit for drag-and-drop, lucide-react for icons.

### Common Mistakes

```tsx
// WRONG — next/link
<Link href="/work-orders">Orders</Link>
// CORRECT — TanStack Router Link, type-checked against the route tree
import { Link } from "@tanstack/react-router";
<Link to="/work-orders">Orders</Link>

// WRONG — Next navigation
import { useRouter } from "next/navigation";
const router = useRouter(); router.push("/x");
// CORRECT
import { useNavigate } from "@tanstack/react-router";
const navigate = useNavigate(); navigate({ to: "/x" });
```

## Lucide Icon Reference (verified names)

| Category | Icons |
|----------|-------|
| **Navigation** | `LayoutDashboard`, `Home`, `Settings`, `Menu`, `ChevronDown`, `ChevronRight`, `ChevronLeft`, `ArrowLeft`, `ArrowRight`, `ExternalLink` |
| **CRUD** | `Plus`, `Pencil`, `Trash2`, `Save`, `X`, `Check`, `Copy`, `MoreHorizontal`, `MoreVertical`, `Search`, `Filter`, `SlidersHorizontal` |
| **MES / Factory** | `Factory`, `Wrench`, `Cog`, `Gauge`, `Activity`, `Zap`, `Thermometer`, `Timer`, `Clock`, `CalendarDays`, `CalendarClock` |
| **Status** | `CircleCheck`, `CircleX`, `CircleAlert`, `CirclePause`, `CircleDot`, `AlertTriangle`, `ShieldCheck`, `ShieldAlert`, `Ban` |
| **Data** | `BarChart3`, `LineChart`, `PieChart`, `TrendingUp`, `TrendingDown`, `FileText`, `FileSpreadsheet`, `Download`, `Upload`, `Clipboard`, `ClipboardList` |
| **Entities** | `Package`, `Box`, `Boxes`, `Layers`, `ListOrdered`, `ListChecks`, `Tags`, `Tag`, `Hash` |
| **Users** | `User`, `Users`, `UserCheck`, `UserCog`, `Shield`, `LogIn`, `LogOut`, `KeyRound` |
| **Equipment** | `Cpu`, `HardDrive`, `Server`, `Plug`, `Power`, `RotateCcw`, `RefreshCw`, `Play`, `Pause`, `Square`, `OctagonAlert` |

## Hydration Pitfalls

### `"use client"` is a no-op here

Unlike Next.js, TanStack Start does **not** split server/client bundles via the `"use client"` directive — it's harmless legacy. Every component runs through SSR by default. That means libraries that touch React context at module scope, or `window` / `document` in render, will crash during the SSR pass with errors like:

- `Cannot read properties of null (reading 'useContext')` ← **this is recharts**
- `document is not defined` ← dnd-kit, `motion` with layout features
- silent hydration mismatches (Date, Math.random, etc.)

### Use `<ClientOnly>` for libraries that can't SSR

Wrap recharts (and any other client-context-dependent subtree) in the shipped `ClientOnly` helper. It returns the `fallback` during SSR and swaps to children after `useEffect` fires post-hydration.

```tsx
import { ClientOnly } from "@/components/client-only";
import { ResponsiveContainer, LineChart, Line } from "recharts";

// Recharts MUST be inside ClientOnly — without it, every page that imports
// a chart will SSR-crash with "Cannot read properties of null (reading 'useContext')".
<div className="h-72">
  <ClientOnly fallback={<div className="h-full w-full rounded-sm border border-border bg-muted" />}>
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <Line dataKey="value" />
      </LineChart>
    </ResponsiveContainer>
  </ClientOnly>
</div>
```

A common pattern: extract the chart into its own file (`dashboard-charts.tsx`) and `<ClientOnly>` the whole import in the page. Keeps the page SSR-friendly while charts stay isolated.

### Other hydration footguns

```tsx
// 1. Date/Time — WRONG: mismatch between server SSR and client timezones
<span>{new Date().toLocaleString()}</span>
// CORRECT: render after hydration
const [time, setTime] = useState(""); useEffect(() => setTime(new Date().toLocaleString()), []);

// 2. Browser APIs — WRONG: window/localStorage don't exist during SSR
<div>{window.innerWidth}</div>
// CORRECT: guard with useEffect, or wrap in <ClientOnly>
const [width, setWidth] = useState(0); useEffect(() => setWidth(window.innerWidth), []);

// 3. Random values — WRONG: different on server vs client
<div id={Math.random().toString()}>
// CORRECT: use React.useId()

// 4. HTML nesting — WRONG: div inside p, button inside a
<p><div>X</div></p>
// CORRECT: valid nesting only

// 5. motion import — WRONG: bypasses the shared client wrapper
import { motion } from "motion/react";
// CORRECT:
import { motion } from "@/lib/motion";

// 6. Recharts — WRONG: zero-height container OR no ClientOnly
<div style={{ height: 0 }}><ResponsiveContainer>...</ResponsiveContainer></div>
// CORRECT: explicit height wrapper + ClientOnly (see above)

// 7. TanStack Router params/search — WRONG: do NOT await, they are sync
export const Route = createFileRoute("/_app/work-orders/$id")({ component: Page });
async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; }  // ← Next-ism, wrong
// CORRECT:
function Page() { const { id } = Route.useParams(); /* … */ }

// 8. Server-only imports leaking into client — WRONG
"use client";  // (Vite: harmless directive, but the import below still breaks the bundle)
import { getCookie } from "@tanstack/react-start/server";
// Even worse: a route file (routes/login.tsx) that imports from
// @tanstack/react-start/server at module top-level — that file IS in the
// client bundle, and any reference outside a createServerFn().handler(...)
// body will explode on hydration with "does not provide an export named ..."
//
// CORRECT: importing the symbol is fine; just call it ONLY inside one of:
//   - a server-route handler (routes/api/**, ctx.{request, params})
//   - a createServerFn().handler(...) body
//   - src/start.ts middleware
// The bundler tree-shakes the import out of the client bundle when calls
// only appear in those boundaries. Top-level helpers and useEffect calls
// don't qualify.

// 9. JSON.stringify on a Headers instance is always "{}" — WRONG
console.log("headers:", JSON.stringify(getRequestHeaders())); // logs "{}", lies
// CORRECT — Headers is iterable, not enumerable
console.log("headers:", Object.fromEntries(getRequestHeaders().entries()));
// or just read what you need
const userId = getRequestHeaders().get("X-App-User-ID");
```

**Layout + user identity:** the parent authenticated layout route (`_app.tsx`, `station.tsx`, `review.tsx`, or a custom authenticated layout) loads the user via `beforeLoad` (server-side, cookie-signed) and passes it to the selected layout. Read the user from any nested page via `Route.useRouteContext()` — synchronous, type-safe, no fetch round-trip. Do NOT add a separate `/api/auth/me` fetch in nested pages.

## Build Order (MANDATORY — sequential, no skipping)

### Step 1: Database Schema

- Edit `src/db/schema.ts` — define enums, tables, Zod schemas, and types (see examples in file comments)
- Every table MUST include `createdAt` and `updatedAt` timestamp columns
- Derive Zod schemas with `createInsertSchema()` / `createUpdateSchema()` — NEVER hand-write validation
- Derive types with `$inferSelect` / `$inferInsert` — NEVER hand-write type interfaces
- Runtime bootstrap is mandatory for implemented modules: each service must
  create its own tables with `bootstrapModule(...)` before first query, so
  preview and new tenant schemas do not require a prior `drizzle push`.

### Step 2: Auth Config + Seed Data

Pure configuration — no UI, no route handlers.

- Define actions and role→actions mapping in `src/lib/permissions.ts` (`PERMISSION_MATRIX`)
- Put small baseline data in the owning service's runtime bootstrap. Use
  `src/db/seed.ts` only for explicit bulk imports or local reset fixtures.
- seed.ts is excluded from tsconfig — use **relative imports only** (e.g., `import * as schema from "./schema"`), NOT `@/` aliases
- Use `db.insert(schema.table).values([...]).onConflictDoUpdate()` for idempotency
- Seed data must tell a coherent story: cross-references, realistic status distributions, timestamps spanning past 2 weeks
- Seed foreign keys must be explicit strings from declared parent records.
  Never rely on array positions without checking bounds, never pass
  `undefined`, and never omit a required FK property in a Drizzle `.values([...])`
  object. Drizzle turns missing/undefined properties into SQL `default`, which
  causes failures such as `sales_order_id = default` for child tables. Prefer
  named parent ID constants or `requireSeedRef()` / `requireSeedValue()` from
  `@/services/seed-utils` when constructing interlinked baseline rows.
- Runtime baseline seed must be idempotent and should run only when the module
  table is empty. The preview path must work even when this script is never run.
- `bootstrapModule(...)` runs in two phases inside one transaction: first all
  `prepare` / `createTable` / `createIndexes` statements for the module, then
  all `seed` callbacks. Do not hand-roll create/seed ordering in services.

### Step 3: Services + Server Routes

**Two sub-steps in strict order.** Write the service first, then the route. Never write the route first then "factor out" later.

#### Step 3a: Services (one file per domain entity in `src/services/`)

```ts
// src/services/work-orders.ts
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  workOrders,
  workOrderEvents,
  type NewWorkOrder,
  type WorkOrder,
} from "@/db/schema";
import { HttpError } from "@/lib/route-handlers";
import { bootstrapModule } from "@/services/bootstrap";

const WORK_ORDERS_BOOTSTRAP = bootstrapModule("work-orders", [
  {
    tableName: "work_orders",
    createTable: sql`
      create table if not exists work_orders (
        id text primary key,
        code text not null unique,
        product_name text not null,
        target_qty integer not null,
        status text not null default 'pending',
        notes text,
        created_at timestamp not null default now(),
        updated_at timestamp not null default now()
      )
    `,
    seed: async (tx) => {
      await tx.insert(workOrders).values([
        {
          id: "wo-baseline-001",
          code: "WO-BASELINE-001",
          productName: "Baseline Assembly",
          targetQty: 100,
          status: "pending",
        },
      ]).onConflictDoNothing();
    },
  },
  {
    tableName: "work_order_events",
    createTable: sql`
      create table if not exists work_order_events (
        id text primary key,
        work_order_id text not null references work_orders(id),
        type text not null,
        actor_id text not null,
        created_at timestamp not null default now()
      )
    `,
  },
]);

// State-machine table — rules live ONE place, reused by every caller.
const VALID_TRANSITIONS: Record<string, ReadonlyArray<string>> = {
  pending: ["running", "cancelled"],
  running: ["paused", "completed", "cancelled"],
  paused: ["running", "cancelled"],
  completed: [],
  cancelled: [],
};

export async function listWorkOrders(): Promise<WorkOrder[]> {
  await WORK_ORDERS_BOOTSTRAP;
  return db.select().from(workOrders);
}

export async function getWorkOrder(id: string): Promise<WorkOrder> {
  await WORK_ORDERS_BOOTSTRAP;
  const [row] = await db.select().from(workOrders).where(eq(workOrders.id, id));
  if (!row) throw new HttpError(404, "Work order not found");
  return row;
}

export async function createWorkOrder(
  input: NewWorkOrder,
  actorId: string,
): Promise<WorkOrder> {
  await WORK_ORDERS_BOOTSTRAP;
  return db.transaction(async (tx) => {
    const [wo] = await tx.insert(workOrders).values(input).returning();
    await tx.insert(workOrderEvents).values({
      workOrderId: wo.id,
      type: "created",
      actorId,
    });
    return wo;
  });
}

export async function advanceWorkOrder(
  id: string,
  toStatus: string,
  actorId: string,
): Promise<WorkOrder> {
  await WORK_ORDERS_BOOTSTRAP;
  return db.transaction(async (tx) => {
    const [wo] = await tx.select().from(workOrders).where(eq(workOrders.id, id));
    if (!wo) throw new HttpError(404, "Work order not found");
    const allowed = VALID_TRANSITIONS[wo.status];
    if (!allowed?.includes(toStatus)) {
      throw new HttpError(
        409,
        `Cannot transition ${wo.status} → ${toStatus}`,
      );
    }
    const [updated] = await tx
      .update(workOrders)
      .set({ status: toStatus, updatedAt: new Date() })
      .where(eq(workOrders.id, id))
      .returning();
    await tx.insert(workOrderEvents).values({
      workOrderId: id,
      type: `advance:${wo.status}->${toStatus}`,
      actorId,
    });
    return updated;
  });
}
```

**Service rules:**
- File name = entity name (plural): `work-orders.ts`, `inventory.ts`, `quality-holds.ts`
- Every implemented module defines a module-level `bootstrapModule(...)`
  promise and awaits it at the top of each service entrypoint before querying.
- Bootstrap SQL must use `create table if not exists` / `create index if not
  exists`, and small baseline seed must be idempotent.
- The shared bootstrap helper creates every table and index before any seed
  callback runs. Seed callbacks may insert related rows into other tables in
  the same module, as long as all referenced tables are listed in the same
  `bootstrapModule(...)` call. Keep `createTable` entries ordered by foreign-key
  dependencies.
- Bootstrap belongs in services only. Never run schema creation from routes,
  components, or `src/lib`.
- For seed callbacks with parent/child rows, construct parent rows first, insert
  them first, then construct child rows from named parent IDs. Before inserting
  child rows, verify every required FK is present. A generated insert must never
  contain `default` for a non-null FK column.
- Functions take typed inputs (`NewWorkOrder`) and an actor id, return typed outputs (`WorkOrder`)
- Throw `new HttpError(status, message)` for caller-facing errors (404 not found, 409 conflict, 422 invariant violated). `withErrors` translates them.
- Multi-step writes use `db.transaction(async tx => ...)` — pass `tx` to inner queries, not `db`
- Never accept `Request`/`Response`/`Headers` parameters; never call `Response.json()`

#### Step 3b: Server Routes (thin HTTP wrappers in `src/routes/api/`)

```ts
// src/routes/api/work-orders.ts
import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import { insertWorkOrderSchema } from "@/db/schema";
import { listWorkOrders, createWorkOrder } from "@/services/work-orders";

export const Route = createFileRoute("/api/work-orders")({
  server: {
    handlers: {
      GET: withErrors(async () => {
        await requireAuth();
        return Response.json(await listWorkOrders());
      }),
      POST: withErrors(async ({ request }) => {
        const user = await requireAuth("admin");
        const data = insertWorkOrderSchema.parse(await request.json());
        const wo = await createWorkOrder(data, user.id);
        return Response.json(wo);
      }),
    },
  },
});
```

```ts
// src/routes/api/work-orders/$id.ts
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withErrors } from "@/lib/route-handlers";
import {
  getWorkOrder,
  advanceWorkOrder,
} from "@/services/work-orders";

const advanceBodySchema = z.object({
  toStatus: z.enum(["running", "paused", "completed", "cancelled"]),
});

export const Route = createFileRoute("/api/work-orders/$id")({
  server: {
    handlers: {
      GET: withErrors(async ({ params }) => {
        await requireAuth();
        return Response.json(await getWorkOrder(params.id));
      }),
      POST: withErrors(async ({ params, request }) => {
        const user = await requireAuth("operator", "admin");
        const { toStatus } = advanceBodySchema.parse(await request.json());
        return Response.json(
          await advanceWorkOrder(params.id, toStatus, user.id),
        );
      }),
    },
  },
});
```

**Route rules:**
- Every handler is wrapped in `withErrors` — never write a bare `try/catch` in routes
- Handler body is at most 5 statements: `requireAuth → parse → service call → Response.json`
- If a handler exceeds ~10 lines, the logic belongs in a service
- Never `import { db }` here, never call `db.transaction`, never put `if (status === "pending")` style logic here

### Step 4: Frontend (all UI in one step)

- First classify each UI workflow and choose a route group automatically: `station` for task-first scan/tap/confirm execution, `review` for queue/evidence/decision work, `monitor` for passive wallboards/andon/TV displays/fixed large screens, `_app` for workspace/admin/planning/analytics, or a custom layout when the workflow needs another distinct interaction model.
- For `_app` workspace pages only: update `src/components/Shell.tsx`, add modules to `defaultModules`, and implement collapsible sidebar + mobile overlay when the app needs persistent module navigation.
- System configuration, admin configuration, role/permission setup, tenant settings, audit settings, and similar setup-only pages must be nested under a sidebar parent as second-level menu items. Do not put "System Configuration" or "Settings" as a first-level sidebar module unless the whole app is only a configuration console. Do not generate Tier0 SDK authentication, OpenAPI endpoint, MQTT endpoint, API key, token, or credential configuration pages; SDK auth is prebuilt and app users should not manage those values in generated MES UIs.
- Use Shell `NavModule` metadata (`badge`, `locked`, `disabledReason`) for sidebar-only product state such as beta, upgrade required, unavailable, or read-only. Do not create one-off sidebar badge/disabled-link implementations in page code.
- Same-app layout chrome must be consistent. Do not mix Shell-sidebar pages and no-sidebar pages in one app. Sidebar modules, role default routes, and in-app navigation targets must preserve the chosen app chrome.
- Sidebar modules must preserve the sidebar. Do not add `station`, `review`, `monitor`, or other no-sidebar task-flow routes to `defaultModules`; convert those workflows into workspace pages or split them into a separate app/entry surface.
- Every authenticated layout shell must include a visible logout action. Put it in the shared layout (`Shell`, `StationLayout`, `ReviewLayout`, `MonitorLayout`, or the custom shell), not individual pages.
- The scaffold keeps exactly one intentionally blank route: `src/routes/_app.index.tsx` with `TEMPLATE_BLANK_ROUTE`. Do not add any other blank route placeholders. Do not ship that blank placeholder in a finished app.
- Build dashboard at `src/routes/_app.index.tsx` only when the app has a management/analytics home; task-first station, review, monitor, kiosk, or other custom apps must replace `_app.index.tsx` with a redirect or matching root entry so `/` does not show a sidebar workspace starter.
- If the app has only one primary page or one primary workflow surface, make that surface own `/` directly. Do not leave `/` blank and put the only real screen under a secondary route.
- Build each page under its selected layout group (`src/routes/_app.<module>.tsx`, `station.<task>.tsx`, `review.<queue>.tsx`, `monitor.<view>.tsx`, or a custom `intent.<page>.tsx`) and vary UI patterns across modules.
- Pages use the selected route group's path in `createFileRoute(...)` and inherit that authenticated layout automatically: `"/_app/..."` for workspace, `"/station/..."`, `"/review/..."`, `"/monitor/..."`, or the matching custom route prefix.
- Interactive pages must be responsive by device profile. PDA/handheld scanner pages are portrait-first industrial station surfaces: test 360-480px width, larger operational text, scanner focus recovery, and 44-48px controls. General pages still need mobile (375px), tablet (768px), desktop (1024px+). Monitor pages are wallboard/TV surfaces, not desktop monitors; test the intended fixed viewport instead.
- **ALWAYS** use `apiUrl("/api/...")` from `@/lib/utils` — plain `"/api/..."` breaks under a base path
- If creating a request hook, polling hook, or page-local data loader, the effect dependency must be a stable request key made from primitive values (`"orders:list"`, route params, filters, pagination), not an inline loader function created during render. Prefer `useRequest(requestKey, loader)` from `@/lib/hooks` or `useEffect(..., [requestKey])`; do not depend on `() => fetchJson(...)` references because each render creates a new function and can cause infinite fetch/setState/render loops.
- Use `usePolling()` from `@/lib/hooks` for dashboard polling. It is single-flight and pauses interval-driven polling while the tab is hidden; do not stack your own overlapping `setInterval + fetch` loop on top of it.
- Use `<Link to="/path">` from `@tanstack/react-router` for navigation, `useNavigate()` for programmatic
- Use `useRouterState({ select: s => s.location.pathname })` if you need the current pathname

### Step 5: Final Build & Lint

- Run `npm run build` — fix errors and retry, max 3 attempts. In this scaffold `npm run build` is not build-only: `postbuild` automatically runs the required local verification flow (`typecheck`, `lint`, contract tests, and runtime-safety checks).
- Do not bypass the required gate by running `vite build` directly unless you are debugging the bundler itself. Normal completion must go through `npm run build`.
- When `postbuild` fails, fix the reported verification stage before declaring success.

## Key Rules

### Database
- Start with ~5 tables, max 10. Prefer JSON columns over many thin tables
- **NEVER use `drizzle-kit migrate`** — only `drizzle-kit push`
- Import: `import { db } from "@/db"`, `import { myTable } from "@/db/schema"`, `import { eq, desc } from "drizzle-orm"`
- Avoid Drizzle relational `db.query.*.findFirst()` / `tx.query.*.findFirst()` in services. Prefer explicit `select().from(...).where(...).limit(1)` queries for single-row lookups, including inside transactions.
- `db/index.ts` uses a global singleton pool (max 5 connections) with `DB_SCHEMA` search_path support
- Runtime bootstrap is required for every implemented module service:
  `bootstrapModule(...)` must create schema/table/indexes and seed small
  baseline records when the module table is empty. The helper runs all
  `prepare` / table / index SQL before any seed callback, so agents should not
  manually split or duplicate runtime bootstrap sequencing.
- Baseline seed must validate the FK graph before insertion. For child tables
  such as order items, batch lines, BOM components, route steps, genealogy, or
  inventory transactions, every required parent id must come from a declared
  parent row or a named constant. Missing/undefined FK properties are forbidden
  because Drizzle emits SQL `default` for them.
- `seed.ts` uses `DIRECT_DATABASE_URL` first (bypasses pooler), relative imports only (no `@/` aliases)

### Data Flow
- ALL data access goes through Server Routes. Pages fetch via `apiUrl()`
- **`db` imports ONLY in `src/services/**` and `src/db/seed.ts`** — never in routes, never in lib, never in client components
- Server routes are thin HTTP shells: `requireAuth → parse → service call → Response.json`. If you find yourself calling `db.*` from a route handler, move that code into a service first
- Client data fetching must be keyed by stable values, not render-created function identities. Prefer `useRequest(requestKey, loader)` from `@/lib/hooks` for reusable client loads. Page calls must pass stable keys for list/detail/filter state so successful `setState` does not immediately trigger another identical request. Reusable polling must stay single-flight; do not let slow responses accumulate across interval ticks.
- TanStack Router `Route.useParams()` and `Route.useSearch()` are **synchronous** — never `await`
- Define `validateSearch` (Zod) on routes that read query strings — gives type safety + validation
- `createServerFn().handler(...)` is the equivalent of a Next server action; like server routes, the handler should delegate to a service for any non-trivial work

### Fast Refresh / HMR
- **Component `.tsx` files export components only.** Put constants, plain helpers, hooks, and data into a sibling `.ts` module and import them. React Fast Refresh hot-replaces a module only when every export is a component; a single non-component export forces a full page reload on every edit — worst on widely-imported files like the app shell or shared layout/overlay modules
- `export type` / `export interface` are fine (type-only, erased at build). Route files that export `Route` via `createFileRoute` are handled by the router plugin and are exempt
- **`optimizeDeps.include` (in `vite.config.ts`) must list client deps reached only through code-split route/component boundaries**, using the exact imported subpath (e.g. `"motion/react"`, not `"motion"`). Otherwise Vite discovers them after its initial scan, re-optimizes, and forces a full reload
- Frequent full-page reloads during dev are an HMR defect, not a preview/startup failure. Use the platform preview/runtime stability Skill for the diagnosis playbook when it is available.

### Recharts
- **ALWAYS** wrap in `<ResponsiveContainer width="100%" height={300}>` inside a container with explicit height
- **NEVER** render inside `display:none` or zero-dimension containers
- Recharts uses `ResizeObserver` — mounting in invisible containers causes silent failures

### TailwindCSS 4
- Config via `@import "tailwindcss"` + `@theme inline` in `src/styles/globals.css` — NO `tailwind.config.js`
- Tailwind is wired via the `@tailwindcss/vite` plugin (in `vite.config.ts`) — no PostCSS step
- Vite 8 provides built-in tsconfig path resolution through `resolve.tsconfigPaths`; do not re-add `vite-tsconfig-paths`
- NO new `.css` files — keep all styles as Tailwind utility classes
- Theme uses CSS custom properties (oklch color space) — override via `globals.css` only

### Visual Style & UI/UX — Tier0 Design System

`DESIGN.md` is the source of truth. The single-app theme equivalent lives in `src/styles/globals.css`; use the `--tier0-*` CSS variables and Tailwind aliases before introducing local colors.

**Palette**
- Primary actions use the support Gantt near-black token: `--tier0-primary` / `bg-button-primary` (`#050b14`).
- Tier0 signal green is the highlight: `--tier0-highlight`, `bg-button-highlight`, `bg-highlight-bg-accent`, `text-highlight-text`. Use it for active, selected, progress, and optimistic states. Do not flood page backgrounds with green.
- Workspace surfaces are support Gantt white/near-white canvas, raised white panels, and light grey insets: `bg-bg`, `bg-background`, `bg-card`, `bg-surface-inset`, `border-border`, `border-border-secondary`.
- Enabled inputs, selects, textareas, and combobox-like controls use white backgrounds (`bg-background` or `bg-card`) with `border-input`. Disabled or read-only controls may use `bg-surface-inset`; do not create transparent form controls on white or off-white panels.
- Avoid pure black on pure white as the dominant reading surface. Use slate text hierarchy, soft neutral backgrounds, and semantic status colors for urgency.
- Status UI uses semantic tokens: success, error, warning, and info. Color must be paired with an icon and label.

**Typography**
- Default UI text uses `--font-app-sans`; headings use `--font-display-sans`; code, IDs, and tabular metrics use `font-mono`.
- Use `typo-h1`, `typo-h2`, `typo-h3`, `typo-h4`, `caption`, `text-sm`, and `text-base`. Keep letter spacing neutral.
- Add `tabular-nums` to changing metrics so values do not shift.

**Geometry & spacing**
- Default component radius is 4px. Cards and panels should stay at 8px or less.
- Use the 4px grid. Common workspace gaps are 8px, 12px, and 16px; station and review flows may use 16px, 20px, or 24px for touch and readability.
- Borders are the primary separation tool. Normal panels are flat; shadows are only for overlays such as dialogs, dropdowns, popovers, and tooltips.
- Match density to context: workspace can be compact, station must be touch-friendly, review should favor readable evidence and decision clarity.

**Components**
- Build app-specific controls locally from Tailwind utilities and Tier0 tokens; keep reusable pieces under `src/components/<domain>/`.
- Buttons: `default` is signal-green highlight, `primary` is neutral gray, `outline` is bordered, `secondary` is neutral filled, `ghost` is low-emphasis.
- Default controls are about 40px high; station, kiosk, PDA, scan, tap, and confirm flows should use 44-48px touch targets.
- Keep tables compact, with explicit truncation (`min-w-0`, `truncate`, `line-clamp-*`) and quiet row actions.
- Master data, workstation configuration, material, equipment, route, and process-parameter create/edit forms should normally open from a button in `FormDialog` or `Drawer` instead of staying permanently expanded on the page.
- Required fields use `FieldLabel required` or `RequiredMark`; the star color comes from the global required-marker rule, not local color classes.
- Tags use grey by default; use signal green only for Tier0 highlight states.

**Motion**
- Use motion for state clarity, not decoration. Normal transitions should be 150-250ms.
- Avoid broad gradients, decorative blobs, glass effects, heavy shadows, and animated page/list entrances.
- Import motion only through `@/lib/motion`.

**Layout & responsiveness**
- Pages are product workspaces: header, controls, content, and stable state regions.
- Use full-height flex layouts with `min-h-0` and explicit overflow regions.
- Keep the primary content region vertically scrollable for workspace, station, review, and interactive custom layouts; only monitor layouts are fixed non-scrolling surfaces.
- All pages must work at 375px width and avoid text overlap.
- PDA/handheld scanner pages should be portrait-first, single-column, larger-type station flows with visible/refocusable scanner input.
- Monitor pages should use the `monitor-*` utilities for large, distance-readable, fixed-board composition rather than desktop dashboard sizing.

### Commands
- `npm run build` — run ONCE at Step 5 (vite build → `dist/{client,server}`), then let the automatic `postbuild` verifier finish
- `npm run lint` — run at Step 5; required **0 warnings** to declare done. `npm run lint -- --fix` auto-fixes most.
- `npx drizzle-kit push` — optional local schema pre-sync; preview and new tenant schemas must not depend on it
- `npx tsx src/db/seed.ts` — optional explicit bulk seed/reset fixtures; runtime baseline seed belongs in services
- NEVER start dev servers manually (use `preview_start` MCP), NEVER run interactive commands
- If same error occurs 3 times, STOP and report to user

### Environment Variables
- `DATABASE_URL` (required) — PostgreSQL connection string
- `SESSION_SECRET` (required in production, ≥32 chars) — HMAC key that signs the session cookie. In dev, the process generates a random secret on startup if unset (warning logged; sessions reset every restart)
- `DIRECT_DATABASE_URL` — direct connection, preferred by drizzle-kit push and seed.ts
- `DB_SCHEMA` — PostgreSQL schema for multi-tenant isolation (default: `public`)
- `APP_ID` — app identifier for `/api/manifest` (default: `"monoapp"`)
- `VITE_BASE_PATH` — URL prefix for deployed apps; used by Vite `base`, router `basepath`, and `apiUrl()`
- `NEXT_PUBLIC_BASE_PATH` — backwards-compat alias for the above. Still read but logs a deprecation warning; rename to `VITE_BASE_PATH`
- See `docs/platform-integration.md` for deployment details.

## Definition of Done

- Schema: 5-10 tables with `createdAt`/`updatedAt`, Zod schemas via `createInsertSchema`/`createUpdateSchema`, types via `$inferSelect`
- Seed: 5-10 records/table, idempotent (`onConflictDoUpdate`), interlinked, coherent business story
- Auth: `PERMISSION_MATRIX` defined, `requireAuth()` on all write routes
- Services: one file per domain entity in `src/services/`, all multi-step writes wrapped in `db.transaction`, state machines defined as transition tables, throw `{ status, message }` for caller-facing errors. **No `db` imports outside `src/services/` and `src/db/seed.ts`.** Single-row lookups use explicit `select().from(...).where(...).limit(1)`, not `db.query.*.findFirst()` / `tx.query.*.findFirst()`.
- API: full CRUD per entity via `createFileRoute(...).server.handlers`, every handler wrapped in `withErrors`, body ≤ 10 lines (auth → parse → service call → Response.json). No business logic in handlers.
- UI: every page is mounted under the correct authenticated layout group (`_app`, `station`, `review`, `monitor`, or a custom layout when justified), and `/` lands in the correct primary experience. Every authenticated layout shell has a visible logout action. A single app does not mix Shell-sidebar pages with no-sidebar pages; sidebar modules, role default routes, and in-app navigation targets preserve the chosen app chrome. System configuration/settings pages are second-level sidebar items, not first-level modules, unless the entire app is only configuration. Tier0 SDK auth/connection configuration pages are not generated. All fetch via `apiUrl()` for local app APIs, reusable request hooks use stable request keys instead of inline loader function dependencies, recharts wrapped in `<ClientOnly>` AND `<ResponsiveContainer>`, toast on mutations, empty states with actions. Interactive pages are responsive at 375px+; monitor pages fit their intended fixed viewport. Workspace apps keep Shell navigation current; station/review/monitor/custom task apps remain no-sidebar consistently for the whole app. Product UI copy uses one explicit locale: normalize shell/dialog/loading/error copy to it, and do not ship mixed Chinese/English UI unless the user explicitly asks for bilingual output.
- Hydration: no date/browser-API at first render, motion from `@/lib/motion`, valid HTML nesting, `Route.useParams()` / `Route.useSearch()` (never awaited), no server-only imports in client components, recharts/dnd-kit subtrees wrapped in `<ClientOnly>`
- Branding: app-specific naming is applied consistently before declaring done. Check and update `src/routes/__root.tsx` `<title>` and `description`, `src/routes/login.tsx` login page brand copy, `src/components/Shell.tsx`, and any used layout shell in `src/components/layouts/`. Remove or replace scaffold/default copy such as "Application", "Home", "Ready", "MES", "MES App", "MES Console", "Industrial App", "Station Console", "Review Workspace", "Workspace Home", or "Industrial application scaffold" unless those names are intentionally part of the finished product.
- Product copy: when the user asks for i18n, localization, translation, or copy cleanup, apply the platform copy/i18n Skill if it is available. Default to a single explicit locale per app surface and keep visible shell, dialog, button, loading, error, tooltip, and accessibility labels in that locale. Only introduce a message catalog when the requirements explicitly need runtime multi-language support. Do not render design-system commentary or implementation notes in visible UI. Text like "FX green only for key states", "Tier0 signal green", color-token explanations, layout guidance, or component usage notes belongs in docs/comments only.
- Build: `npm run build` passes end to end, including the automatic `postbuild` verifier. That means `dist/{client,server}` exists, TypeScript passes, ESLint reports **0 warnings, 0 errors**, contract tests pass, and runtime-safety checks pass.
