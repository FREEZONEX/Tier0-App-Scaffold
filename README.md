# Tier0 App Scaffold

A **TanStack Start 1.x** + React + TailwindCSS 4 scaffold for Tier0 business
applications. Retain the UI, Gateway identity, roles, routes and deployment
shell; new Apps persist business data through **Enterprise OpenAPI v2**.

Start with the [API-only App development guide](docs/app-api-development.md)
and [CRM lessons and acceptance cases](docs/crm-api-lessons.md).

**This branch delivers the development specification, not a completed runtime
migration.** The template still contains Drizzle dependencies, bootstrap and
SQL-oriented build/deployment checks. The [migration checklist](docs/scaffold-api-migration.md)
identifies what maintainers must change before publishing an API-ready template.
No CRM application, preview credentials or business fixtures are included.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start 1.x (Vite 8/Rolldown + TanStack Router, React 19 SSR) |
| Business persistence target | Enterprise OpenAPI v2, server-only App Data client; runtime migration pending |
| Validation | Zod inputs/types and platform-supported JSON Schema |
| Styling | TailwindCSS 4 (Vite plugin, no PostCSS) + Tier0 design tokens |
| UI | Lightweight layout contracts + Tailwind utilities + Tier0 tokens; no prebuilt business component library |
| Charts | Recharts 3 (must be wrapped in `<ResponsiveContainer>`) |
| Tables | TanStack React Table 8 |
| Drag and drop | dnd-kit |
| Tier0 Platform SDK | `@tier0/sdk` (OpenAPI REST + MQTT over WebSocket) |
| Icons | Lucide React |
| Toasts | Sonner (`Toaster` is mounted in `__root.tsx`) |
| Motion | `motion` imported from `@/lib/motion`, never directly from `motion/react` |

## API App Workflow

1. Read [AGENTS.md](AGENTS.md) and the [API guide](docs/app-api-development.md).
2. Check the target Enterprise catalog, provision Collections and an App data
   identity through management APIs, then issue a restricted App data Key.
3. Complete the template migration checklist before using this branch as a
   runnable API-only starter. Do not run the old `db:push`/seed workflow for it.
4. Implement business schemas, permissions, services, server routes and UI;
   test real API persistence, conflict recovery, aggregation and role isolation.

Managed preview owns dependency installation and startup; use its preview tools.
In an unmanaged checkout, the existing `npm install` / `npm run dev` commands
start the template shell but do not perform the API migration or provision data.
See [platform integration](docs/platform-integration.md) for runtime contracts.

## Environment Variables

Missing App Data configuration is an error, not permission to use a local DB.
The following App Data names are a **proposed private server contract**; this
documentation does not implement automatic injection or a client loader.

| Variable | Contract |
|---|---|
| `TIER0_APP_API_BASE` | Explicit trusted Enterprise base ending in `/openapi/v2` |
| `TIER0_APP_API_KEY` | Restricted App data Key, server-only; never a `VITE_*` value |
| `APP_ID` | Existing platform-injected runtime App UUID; read with `resolveAppId()`. Not automatically the UNS App data identity |
| `VITE_BASE_PATH` | Existing Vite, router and `apiUrl()` deployment prefix |
| `NEXT_PUBLIC_BASE_PATH` | Existing legacy base-path fallback only |

Resolve data aliases/grants from `apps/context` using the App data Key. Do not
hard-code preview collection IDs or copy keys to another environment. Legacy
`DATABASE_URL` / `DB_SCHEMA` files remain only until maintainer migration.

The existing SDK variables below remain a separate contract for supported SDK
capabilities. Do not substitute an App data Key for the SDK key or expose data
credentials in settings, `.env.example`, logs or browser bundles.

### Variables Injected for the SDK

| Variable | Purpose |
|---|---|
| `TIER0_API_HOST` | OpenAPI service host used by `@tier0/sdk/openapi` |
| `TIER0_API_KEY` | API credential used by both OpenAPI and MQTT |
| `TIER0_MQTT_HOST` | MQTT WebSocket broker host |
| `TIER0_MQTT_PORT` | MQTT WebSocket port, default `8084` |

If the platform explicitly requires browser-side Vite env access, the runtime
is responsible for injecting `VITE_TIER0_*`. Generated apps should not turn
those values into user-editable settings.

## Tier0 SDK SSR Compatibility

`@tier0/sdk` ships as a dual ESM/CJS package. This scaffold still keeps
SDK access behind server-side lazy loaders so preview startup and normal SSR do
not execute optional platform I/O during page initialization. The SSR policy is
pinned in `vite.config.ts`:

```ts
ssr: {
  external: ["pg", "@tier0/sdk", "mqtt"],
}
```

SDK calls are loaded on the server through the lazy helper in
`src/lib/tier0.ts`. Generated apps should not top-level import SDK submodules,
should not move the SDK into `ssr.noExternal`, and should not bypass the SDK
with fallback MQTT clients or hand-written replacements for supported SDK calls.
App Data v2 is a separate contract: use the pinned source client documented in
the API guide until an official package implements it. The `pg` SSR entry above
describes existing template code, not a dependency to add to API Apps.

For deployment details, see
[docs/platform-integration.md](docs/platform-integration.md).

## Project Structure

```text
src/
  start.ts                    <- TanStack Start global request middleware (CSRF guard + Gateway-only auth, do not modify)
  router.tsx                  <- Router factory exporting getRouter() (do not modify)
  routeTree.gen.ts            <- Generated by @tanstack/router-plugin (gitignored, do not edit)
  styles/globals.css          <- TailwindCSS 4 + theme tokens + keyframes (do not replace)
  routes/                     <- Interface layer (HTTP): file names define URLs and nesting
    __root.tsx                <- HTML document shell with Toaster (do not modify)
    _app.tsx                  <- Workspace layout with Shell for management/planning/analytics/admin
    _app.index.tsx            <- Blank "/" scaffold placeholder; finished apps must replace or redirect it
    station.tsx               <- Station layout without sidebar for /station/* task-first workflows
    review.tsx                <- Review layout without sidebar for /review/* evidence/approval flows
    monitor.tsx               <- Passive wallboard layout without sidebar for /monitor/* displays
    login.tsx                 <- Hidden platform-auth error bridge outside Shell
    api/                      <- Server routes: thin wrappers that delegate to services/
      health.ts               <- Health check
      manifest.ts             <- Role manifest (do not modify)
      auth/
        me.ts                 <- Current Gateway-resolved user snapshot (do not modify)
  services/                   <- Domain layer: business rules, state machines, API change batches
  components/
    Shell.tsx                 <- Left navigation shell; update defaultModules here
    layouts/                  <- StationLayout, ReviewLayout, MonitorLayout, and similar shell contracts
    toaster.tsx               <- Sonner mount point
    client-only.tsx           <- Hydration boundary for SSR-incompatible libraries
    <domain>/                 <- App-local components generated per business need
  db/{index,schema,seed}.ts   <- Legacy SQL implementation; pending maintainer migration, do not extend
  lib/                        <- Cross-cutting utilities, not domain logic
    auth.ts                   <- getCurrentUser() / requireAuth() (do not modify)
    gateway.ts                <- Gateway header parsing (do not modify)
    preview-bridge.ts         <- Preview host bridge for surfacing auth/page errors
    route-handlers.ts         <- withErrors() response/error wrapper (do not modify)
    users.ts                  <- AppUser type (do not modify)
    permissions.ts            <- Permission matrix definition
    hooks.ts                  <- Polling and request hooks
    motion.ts                 <- motion/react re-export
    tier0.ts                  <- Server-side lazy loader for @tier0/sdk
    utils.ts                  <- cn(), apiUrl(), requestJson()
server.mjs                    <- Production Node HTTP entrypoint (do not modify)
vite.config.ts                <- TanStack Start + Tailwind v4 + Vite 8 paths + Tier0 SDK SSR external rules
```

## Route File Naming

TanStack Router is file-based:

| File | URL | Notes |
|---|---|---|
| `routes/__root.tsx` | — | Wraps every page |
| `routes/_app.tsx` | — | Workspace layout for management/planning/analytics/configuration |
| `routes/station.tsx` | `/station` | Station layout for scan/tap/confirm execution |
| `routes/review.tsx` | `/review` | Review layout for exceptions/quality/approvals |
| `routes/_app.index.tsx` | `/` | Blank scaffold placeholder; finished apps must replace or redirect it |
| `routes/_app.settings.tsx` | `/settings` | Standalone page, no child routes |
| `routes/station.receiving.tsx` | `/station/receiving` | Under `station` |
| `routes/review.exceptions.tsx` | `/review/exceptions` | Under `review` |
| `routes/_app.work-orders.tsx` | — | Parent of the rows below; renders `<Outlet />` only |
| `routes/_app.work-orders.index.tsx` | `/work-orders` | Default list page |
| `routes/_app.work-orders.$id.tsx` | `/work-orders/:id` | Detail page, nested under the parent |
| `routes/_app.reports_.$id.tsx` | `/reports/:id` | Detail page that opts OUT of nesting |
| `routes/login.tsx` | `/login` | Outside `_app`, no Shell |
| `routes/api/work-orders.ts` | `/api/work-orders` | Server route |
| `routes/api/work-orders/$id.ts` | `/api/work-orders/:id` | Nested server route |

- `_` prefix: pathless, contributes no URL segment
- `.` separator: URL nesting
- `$` prefix: dynamic param
- `_` **suffix** on a segment (`reports_`): opts out of nesting, so the route
  renders standalone instead of inside its would-be parent
- Choose layout by workflow: `station` for execution/scan flows, `review`
  for review/approval flows, `_app` for management/analytics work
- If built-in layouts do not fit, create a new prefixed layout such as
  `monitor.tsx`, `wizard.tsx`, `portal.tsx`, or `editor.tsx`

### List and Detail Pages

The `.` separator nests routes, so `_app.work-orders.$id.tsx` is a **child** of
`_app.work-orders.tsx`. A parent renders its children through `<Outlet />`. If
the parent draws its own list markup and forgets the outlet, `/work-orders/:id`
still matches but nothing renders — TypeScript, ESLint and the build all pass,
and the blank detail page only shows up when someone clicks a row.

Pick one of the two shapes below. `npm run build` fails if a resource matches
neither (see `src/lib/route-nesting-contracts.test.mjs`).

**Nested** — the URL prefix is shared and the detail page lives under it:

```
routes/_app.work-orders.tsx        parent, renders <Outlet /> only
routes/_app.work-orders.index.tsx  /work-orders      → the list
routes/_app.work-orders.$id.tsx    /work-orders/:id  → the detail
```

```tsx
// src/routes/_app.work-orders.tsx — the parent owns no markup of its own
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/work-orders")({
  component: () => <Outlet />,
});
```

The list markup belongs in `_app.work-orders.index.tsx`, not in the parent.
A parent that renders both its own content and `<Outlet />` is also valid when
you actually want a master-detail layout where the list stays visible.

**Non-nested** — the detail page is a full-screen replacement, so append `_` to
the parent segment and let the list route stay a plain page:

```
routes/_app.reports.tsx        /reports      → the list, renders its own markup
routes/_app.reports_.$id.tsx   /reports/:id  → standalone detail, no outlet needed
```

### Reading Dynamic Params

```tsx
// src/routes/_app.work-orders.$id.tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_app/work-orders/$id")({
  validateSearch: z.object({ tab: z.enum(["details", "history"]).optional() }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  return <div>Order {id}, tab: {tab ?? "details"}</div>;
}
```

The matching API route is `src/routes/api/work-orders/$id.ts`, where the
handler reads `params.id` from the first argument.

## Add a New Page

Only workspace pages belong under `_app` and appear in `Shell.tsx`
`defaultModules`. The scaffold keeps exactly one structurally blank route,
`_app.index.tsx`, and presents it as a branded pre-generation state before the
first generation begins. A finished app must replace `/` with a real dashboard,
a redirect, or the actual entry experience; replacing the blank route removes
the Preview placeholder automatically. If the app has only one primary page,
make that page own `/` instead of leaving `/` blank and placing the only real
screen at a secondary route.

```tsx
// src/routes/_app.settings.tsx — a page with no child routes renders directly
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return <div className="p-6">Settings</div>;
}
```

This shape is correct only while the route has no children. The moment you add
a nested detail route such as `_app.settings.$id.tsx`, this component must
render `<Outlet />` — see [List and Detail Pages](#list-and-detail-pages).

Task-first station pages belong under `station` and should not appear in the
sidebar:

```tsx
// src/routes/station.receiving.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/station/receiving")({
  component: ReceivingPage,
});
```

If the workflow needs a fundamentally different interaction model, create a
custom layout such as `src/routes/monitor.tsx` with
`src/components/layouts/MonitorLayout.tsx`. Custom layouts should stay minimal
and should not preload business cards, charts, or forms. Do not create an
empty pathless layout with no child pages, because it will conflict with `/`.

Single-experience apps such as monitor, station, review, or kiosk should not
keep the default sidebar home page. `/` must route directly to the real app
experience.

## Add an API Endpoint

**Step 1: Define a business command and input schema.** Register the required
roles and actions; identify which Collection aliases and record/sample grants
it needs. Management provisioning is separate from runtime requests.

**Step 2: Write the service** in `src/services/`. Check ownership and lifecycle
rules using the authenticated actor, then build a constrained query or one
atomic API change batch. Carry revision/conditions and stable idempotency data.
No SQL connection or runtime table bootstrap belongs here.

**Step 3: Write the route** in `src/routes/api/`. Keep it thin:
`requireAuth()` → Zod parse → service → response, wrapped in `withErrors()`.
Never expose a generic proxy that accepts browser-supplied Keys or arbitrary
collection operations. Return useful conflict and unknown-result states.

**Step 4: Wire the UI.** Load with `requestJson<T>("/api/work-orders", { signal })`
(it applies `apiUrl()`). Never hardcode an unprefixed API URL or catch and drop
errors. Re-read successful changes; retain drafts and offer recovery on conflict.

See the [transaction and query examples](docs/app-api-development.md) and
[five distinct CRM acceptance cases](docs/crm-api-lessons.md).

## Application Boundaries

```text
Browser → requestJson/apiUrl → App server route → business service
                              auth + Zod          roles + ownership + lifecycle
                                                       ↓
                                              server-only App Data client
                                                       ↓
                                              Enterprise OpenAPI v2
                                                       ↓
                                              platform transaction / storage
```

- App services construct business operations; platform APIs own database
  transactions, revisions, schema validation and authorized collection access.
- Multiple independent API writes are not an atomic transaction. Use one
  `changes/apply` batch for changes that must commit together.
- App Keys do not identify the end user. App services enforce per-user rules
  on reads, writes, exports and relational queries.
- Server cookies/header helpers belong only in server handlers,
  `createServerFn` bodies or middleware. Keep Keys out of SSR/client imports.
- Use relational query plans and server pagination, not all-record downloads
  and unbounded in-memory joins. Physical table/schema names are not App APIs.

## Authentication (SSO)

The platform gateway injects the user identity headers. The app does not manage
passwords or a user-account table.

Supported gateway header formats:

```text
# Format 1: JSON
user: {"userID":"u123","userName":"mercy","email":"m@x.com","role":"operator"}

# Format 2: separate headers
X-App-User-ID: u123
X-App-User-Name: mercy
X-App-User-Email: m@x.com
X-App-User-Role: operator

# Format 3: minimum set
X-App-User-ID: u123
```

If `name` is missing, the app falls back to the user id. If `email` is
missing, it stores an empty string.

Active role header precedence:

1. `X-Tier0-Runtime: preview` + `X-Tier0-Preview-Role`
2. `X-Tier0-Active-Role`
3. `X-Tier0-Preview-Role`
4. `X-App-User-Role`
5. `user.role`

Role header values may be plain ASCII, percent-encoded UTF-8, or raw UTF-8
bytes read as latin-1; the parser normalizes them before matching
`PERMISSION_MATRIX`.

Flow:

1. Gateway injects headers into the request
2. `src/start.ts` blocks cross-origin mutating requests and bypasses auth only for `/login`, `/api/health`, `/api/manifest`, and TanStack runtime/build assets
3. Explicit Tier0 runtime roles are authoritative; deployed permissions use the complete role union and unknown trusted roles contribute zero permissions
4. A valid legacy role may continue; an unknown legacy role returns `403`
5. Preview identity without a selected view-as role enters with zero roles and zero permissions; no App session is created
6. Gateway identity without an applicable role context returns `403`
7. Missing Gateway identity returns `401`
8. `/login` only reports platform-auth failure; it does not mint a Cookie or render a role picker

Roles are app-owned. Define the role-to-action mapping in
`src/lib/permissions.ts` as `PERMISSION_MATRIX`. The platform reads
`GET /api/manifest` to build role-assignment UI.

See [docs/platform-integration.md](docs/platform-integration.md) for the full
platform model.

## Scripts

```bash
npm run dev          # preview-compatible Vite dev server -> http://localhost:5173
npm run dev:local    # local Vite dev; port can drift if occupied
npm run dev:force    # rebuild the Vite dependency cache before starting
npm run typecheck    # TypeScript noEmit
npm run build        # Vite 8/Rolldown build -> dist/{client,server}
npm run build:check  # build + typecheck + lint
npm run start        # node server.mjs
npm run lint         # eslint
```

The package still contains legacy DB scripts and SQL-oriented build checks.
They are tracked migration work, not API App instructions; do not disable them
to report a false passing runtime. Docs-only changes use link/example checks,
`git diff --check` and the strict scaffold version check instead of an App build.

## Build Output

`npm run build` writes to `dist/`:

- `dist/client/`: browser static assets
- `dist/server/server.js`: SSR + server-routes fetch handler

`server.mjs` wraps that handler with `node:http`, listens on `PORT` (default
`3000`), and serves `dist/client/` as static assets. For container deployment,
see `artifact.toml`.

## Scaffold Version (Maintainers)

`package.json.tier0Scaffold` is the scaffold's version marker:

```json
{ "tier0Scaffold": { "version": 14, "ref": "e4f1c2a" } }
```

`version` is a positive integer that the platform compares by strict equality
with the App's marker on import (missing or different → the Builder offers to
align the App). `ref` is the short sha of the scaffold commit the version was
stamped on; it is informational and lets the align Skill locate the source.
`src/lib/scaffold-version-contracts.test.mjs` (locked) validates the field's
format when it is present, and `scripts/scaffold-version.mjs` warns in
`postbuild`; neither fails an App build that lost the field. Presence is
required only in this repository's CI, through
`node scripts/scaffold-version.mjs --strict`.

**When to bump.** Every PR that changes what generated Apps inherit — the
rules in `AGENTS.md` / `README.md`, `src/lib/**`, `src/services/bootstrap.ts`,
`scripts/**`, `artifact.toml`, `vite.config.ts`, `server.mjs`, `package.json`
dependencies or scripts, `.env.example` — bumps the version by one. Do not
judge the size of the change. Pure wording, placeholder covers, or internal
test adjustments do not bump. The `Scaffold version check` workflow fails a PR
that touches those paths without a bump.

**How to bump.** Commit the content first, then stamp on a clean tree as its
own commit so `ref` names the content commit:

```bash
git commit -am "feat(...): ..."          # the content commit
node scripts/scaffold-version.mjs --bump  # version + 1, ref = short sha of HEAD
git commit -am "chore(scaffold): stamp v<version>"
```

`--bump` exits 1 when anything other than `package.json` is uncommitted.
`node scripts/scaffold-version.mjs` validates the field (warn-only);
`--strict` makes problems fatal and is what CI runs.

**Never squash-merge** scaffold PRs: `ref` would point at a commit that does
not exist on `main`. After a merge that changed the version, the
`Scaffold version tag` workflow tags the merge commit `scaffold/v<version>`,
so a version can be traced back to its commit from the tag.

## Notes for Agents

The full rules live in [AGENTS.md](AGENTS.md). For new App work:

1. **Business lifecycle and data contract**: Zod + supported JSON Schema.
2. **Identity and grants**: roles, API capabilities, provisioning and App Key.
3. **Services**: API queries, business invariants, atomic batches and retries.
4. **Server routes**: auth, input validation, constrained business commands.
5. **Frontend**: workflow-appropriate layout and complete operation feedback.
6. **Verification**: real persistence, permission isolation, concurrency,
   relational results, samples, build and route/browser checks.

On an existing project, respond directly to the requested change instead of
restarting the full build order.
