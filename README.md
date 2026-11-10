# MonoApp Scaffold

A scaffold built on **TanStack Start 1.x** + Tier0 UNS collections + TailwindCSS 4
for building shop-floor MES applications on the Tier0 platform. The goal is to
give agents a light but complete starting point: authentication, App data
access, platform deployment, build outputs, and layout contracts are
pre-wired, while business pages and app-local components are generated for the
target application instead of being constrained by a fixed template library.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | TanStack Start 1.x (Vite 8/Rolldown + TanStack Router, React 19 SSR) |
| Data | Tier0 UNS v2 collections through `@tier0/sdk-v2/data`, wired in `src/lib/data` (Mongo-driver-style API) |
| Validation | Zod 4 (collection declarations, API input schemas, inferred types) |
| Styling | TailwindCSS 4 (Vite plugin, no PostCSS) + Tier0 design tokens |
| UI | Lightweight layout contracts + Tailwind utilities + Tier0 tokens; no prebuilt business component library |
| Charts | Recharts 3 (must be wrapped in `<ResponsiveContainer>`) |
| Tables | TanStack React Table 8 |
| Drag and drop | dnd-kit |
| Tier0 Platform SDK | `@tier0/sdk-v2` (OpenAPI REST via `createClient()` + server-side MQTT via `Tier0MQClient`) |
| Icons | Lucide React |
| Toasts | Sonner (`Toaster` is mounted in `__root.tsx`) |
| Motion | `motion` imported from `@/lib/motion`, never directly from `motion/react` |

## Quick Start

```bash
npm install
export TIER0_API_HOST=<gateway host> TIER0_API_KEY=<personal or external App key>   # local development only
npm run dev               # -> http://localhost:5173
```

Collections declared in `src/data/collections.ts` are created (and seeded) by
the App itself on first data access; there is no migration or seed command.

> When the agent runs inside the Executor Pod, do **not** run `npm install`
> manually. The platform manages installs automatically, and manual installs
> can conflict with the shared volume. See [AGENTS.md](AGENTS.md).

## Environment Variables

There is no explicit mode switch. If a variable is missing, the scaffold falls
back to local defaults. If the variable is set, the corresponding capability is
enabled.

| Variable | Required | When unset | When set |
|---|:---:|---|---|
| `APP_ID` | | `local-app` (local-development placeholder only) | Platform-injected agent-platform App UUID (36 chars); echoed by `/api/manifest` and used wherever the app identifies itself to the platform (e.g. notification `sender.id`). Not an app name or business identity |
| `VITE_BASE_PATH` | | No URL prefix | Applied to Vite `base`, router `basepath`, and `apiUrl()` |
| `NEXT_PUBLIC_BASE_PATH` | | Legacy fallback only | Used by `apiUrl()` when `VITE_BASE_PATH` is absent |

Tier0 SDK auth and connection variables are injected by the platform at deploy
time. Do not write them into `.env.example`, and do not expose UI in the
scaffold or generated apps for users to configure SDK auth, API keys, tokens,
OpenAPI hosts, MQTT hosts, or workspace bindings. Those values belong to the
SDK, the platform gateway, or the runtime environment.

### Variables Injected for the SDK

In Preview and deployments the platform puts the App's key into the App's
process environment as `TIER0_API_KEY`, and the SDK uses it by itself (Preview
runs with the App's preview key, deployments with the deployed one). It is a
secret: App code never reads, logs or returns it. Besides the App id (`APP_ID`
above, read through `resolveAppId()`), the platform sets these variables:

| Variable | Purpose |
|---|---|
| `TIER0_API_HOST` | Platform API gateway root (a bare host name means `https://`) |
| `TIER0_API_KEY` | The App's key (secret, runtime process only, never at build) |
| `TIER0_MQTT_HOST`, `TIER0_MQTT_PORT` | MQTT broker entry for `Tier0MQClient` on the App's server |
| `TIER0_WORKSPACE_ID` | Workspace of the App |
| `TIER0_RUNTIME` | `deployed` or `preview` |

Call the platform through the SDK, not with a hand-written `fetch` / `curl` to
`TIER0_API_HOST`. Every App has the same fixed platform capabilities
(members, notifications, files, Stream requests and messages), bounded by the
workspace plan and configured nowhere. Beyond the collections it creates, the
App reads only external collections that a workspace Owner/Admin granted it in
the App settings. MQTT topics are limited to the App's own namespace
`apps/<App id>/<preview|deployed>/…`; build them with `appTopic()` from
`@tier0/sdk-v2/mq`.

For local development set `TIER0_API_HOST` and `TIER0_API_KEY` yourself, using a
personal key or an external App's key. In Preview and deployments the platform
sets them. Do not set `TIER0_RUNTIME` locally (only the platform sets it; it
also selects the member scope and the front door behavior), so `appTopic()`
throws outside Preview and deployments.

If the platform explicitly requires browser-side Vite env access, the runtime
is responsible for injecting `VITE_TIER0_*`. Generated apps should not turn
those values into user-editable settings.

## Tier0 SDK SSR Compatibility

`@tier0/sdk-v2` ships as a dual ESM/CJS package. This scaffold still keeps
SDK access behind server-side lazy loaders so preview startup and normal SSR do
not execute optional platform I/O during page initialization. The SSR policy is
pinned in `vite.config.ts`:

```ts
ssr: {
  external: ["@tier0/sdk-v2", "mqtt"],
}
```

SDK calls are loaded on the server through the lazy helpers in
`src/lib/tier0.ts`: `loadTier0Sdk()` returns the root module, whose
`createClient()` exposes `tier0.system`, `members`, `notifications`, `files`
and the other domains (in Preview and deployments only `system.info()`,
`members.listWorkspace()`, notifications, files and data work; see
`docs/platform-integration.md`); `loadTier0OpenApi()`, `loadTier0Files()` and
`loadTier0Mq()` load the subpath modules. Every platform call is the App's own
and carries no visitor; MQTT runs on the server only. Generated apps should not top-level import SDK submodules,
should not move the SDK into `ssr.noExternal`, and should not bypass the SDK
with fallback MQTT clients or hand-written fetch wrappers.

App records use the data client from `@tier0/sdk-v2/data` instead:
`src/lib/data` builds the App's instance from `src/data/collections.ts`, and
services import `data` from `@/lib/data`. Nothing else may call UNS directly.

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
      uns/
        subscribe.ts          <- Record change stream (SSE) behind useRecordChanges() (do not modify)
  services/                   <- Domain layer: business rules, state machines, data access through lib/data
  components/
    Shell.tsx                 <- Left navigation shell; update defaultModules here
    layouts/                  <- StationLayout, ReviewLayout, MonitorLayout, and similar shell contracts
    toaster.tsx               <- Sonner mount point
    client-only.tsx           <- Hydration boundary for SSR-incompatible libraries
    <domain>/                 <- App-local components generated per business need
  data/
    collections.ts            <- Collection declarations (Zod schema, indexes, seed): the data source of truth
    seed-utils.ts             <- seedDate() / seedTimestamp() / requireSeedRef() for seed documents
  lib/                        <- Cross-cutting utilities, not domain logic
    auth.ts                   <- getCurrentUser() / requireAuth() (do not modify)
    visitor.ts                <- Reads the X-Tier0-Visitor header (do not modify)
    change-visibility.ts      <- Which record changes a user's browser hears about (adapt to the App's roles)
    preview-bridge.ts         <- Preview host bridge for surfacing auth/page/preview-role errors
    route-handlers.ts         <- withErrors() response/error wrapper (do not modify)
    users.ts                  <- AppUser type (do not modify)
    permissions.ts            <- Permission matrix definition
    hooks.ts                  <- Polling and request hooks
    record-changes.ts         <- useRecordChanges(): live record changes from /api/uns/subscribe
    motion.ts                 <- motion/react re-export
    tier0.ts                  <- Server-side lazy loaders for @tier0/sdk-v2
    data/                     <- App data layer over Tier0 UNS collections (locked; services only)
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

**Step 1: Declare the data** in `src/data/collections.ts` with
`defineCollection(...)` (directoryPath, schema, indexes, seed) and list it in `collections`.
Choose each path from the actual business scope as described in `docs/app-data.md`;
reuse known ISA-95 directories for industrial data. An App/module directory such
as MES may follow the known factory/line scope; do not default to a root App container.
The App ensures every declared collection on first access; there is no
migration step. ensure only creates and widens: it never narrows storage and
never rewrites stored descriptions. Narrowing a schema and editing the
descriptions of existing fields go through `schema:replace` via the tier0 MCP.

**Step 2: Write the service** in `src/services/work-orders.ts`. This is where
business logic, state machines, and data access belong:

```ts
import { data } from "@/lib/data";
import { workOrders } from "@/data/collections";
import { HttpError } from "@/lib/route-handlers";

const orders = data.collection(workOrders);

export async function releaseWorkOrder(id: string) {
  const released = await orders.findOneAndUpdate(
    { _id: id, status: "DRAFT" },
    { $set: { status: "RELEASED" } },
  );
  if (!released) throw new HttpError(409, "Only draft work orders can be released");
  return released;
}
```

`@/lib/data` may only be imported from `services/`.

**Step 3: Write the route** in `src/routes/api/work-orders.ts`. Keep it thin:
`requireAuth()` -> `schema.parse()` -> service call -> `Response.json(...)`,
wrapped in `withErrors(...)`. Throw `HttpError` for client-facing failures or
let Zod issues bubble naturally.

Modeling, consistency patterns (`expectedRevision`, `data.transact`), schema
evolution and the tier0 MCP collection operations are in
[docs/app-data.md](docs/app-data.md).

In pages, load with `requestJson<T>("/api/work-orders", { signal })` (it applies
`apiUrl()`). Do not hardcode `/api/...` without `apiUrl()` or deployments with a
base path will break. A non-2xx response is written to `console.error` with the
server `cause` and then thrown, so the Builder preview console can show why a
load failed; never catch and drop it.

## Three-Layer Architecture

```text
Browser
  |
  |  requestJson("/api/...")   (apiUrl() + console.error on failure)
  v
src/routes/api/**.ts          <- Interface layer: requireAuth -> Zod.parse -> service -> Response.json
  |                               Wrapped by withErrors for {status,message} / Zod issue mapping
  v
src/services/**.ts            <- Domain layer: business logic, state machines, consistency rules
  |                               Pure TypeScript, no HTTP concepts
  v
src/lib/data (+ src/data/collections.ts)
  |                           <- Data layer: @tier0/sdk-v2/data client, ensure + seed on first access
  v
Tier0 OpenAPI v2 UNS          <- /uns/app/collections/ensure, /uns/collections/:id/records:*
```

Hard rules:

- `@/lib/data` may only be imported from `src/services/**`
- `Request`, `Response`, and `Headers` belong only in routes, `src/start.ts`,
  `src/lib/{auth,visitor,route-handlers}.ts` and the change stream
  (`src/lib/data/changes.ts`)
- Writes that must succeed together live in one document or one
  `data.transact([...])` (≤200 steps); `updateMany` / `deleteMany` are not
  atomic, like Mongo; never one data call per loop iteration
- Never call UNS paths directly and never run `schema:replace` / `archive` /
  `restore` from App code (they are worker operations through the tier0 MCP)
- Server cookie/header helpers such as `getCookie` or `getRequest` belong only
  in server route handlers, `createServerFn` bodies, or `src/start.ts`

## Authentication (SSO)

The platform front door sets the visitor in `X-Tier0-Visitor` on every
request (after stripping any `X-Tier0-*` the client sent), and `src/start.ts`
reads it. The app does not manage passwords or a user-account table and reads
no other identity header. Roles are the header's `app_roles`; permissions are
their union. The App uses them to apply its own data rules: platform calls are
the App's own and the platform does not narrow its data by user. Details:
[docs/platform-integration.md](docs/platform-integration.md#authentication-model).

For local development set `PREVIEW_USER_ID` (and optionally `PREVIEW_USER_ROLE`)
before `npm run dev`: the development front door in `vite.config.ts` sets the
visitor header.

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
npm test             # component-kit and data-layer unit tests
npm run data:schema  # print the normalized ensure payload of src/data/collections.ts
```

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
"tier0Scaffold": { "version": 14, "ref": "e4f1c2a" }
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
rules in `AGENTS.md` / `README.md`, `src/lib/**`, `src/data/seed-utils.ts`,
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

The full build instructions live in [AGENTS.md](AGENTS.md). For greenfield
work, agents follow this order:

1. **Collections** (`src/data/collections.ts`)
2. **Auth Config** (`permissions.ts`)
3. **Services** (`src/services/**`, data access through `@/lib/data`)
4. **Server Routes / API** (`src/routes/api/**`)
5. **Frontend** (choose `_app`, `station`, `review`, or a custom layout as needed)
6. **Build** (`npm run build`)

On an existing project, respond directly to the requested change instead of
restarting the full build order.
