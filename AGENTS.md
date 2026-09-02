# Tier0 Industrial App Scaffold

This repository is a TanStack Start 1.x application scaffold (Vite 8,
TanStack Router, React 19, Drizzle, Zod, and TailwindCSS 4). It is not Next.js:
do not use `next/*`, App Router conventions, `next/headers`, or Next metadata.
Do not re-initialize the project.

Build a usable industrial application, not a demo. Prefer a small number of
complete workflows over a wide read-only shell.

## Delivery Floor: Complete the Legal Lifecycle

Infer each business object's lifecycle from the domain. Do not mechanically add
CRUD to every database table: a valid termination, correction, or operational
command is often safer than direct update/delete.

| Object kind | Expected first-slice lifecycle |
|---|---|
| Master data and configuration | create, view/search, edit, deactivate/archive; hard-delete only when safe |
| Transaction document | create, view, edit while draft, submit, cancel/void/correct after submission |
| Inventory, balance, ledger, or genealogy | view plus domain commands such as receive, issue, adjust, freeze, release, reverse; no arbitrary row editing |
| Task, approval, alert, or case | create/raise when applicable, assign/process, decide, close/reopen or cancel |
| Audit event or derived result | read-only unless the domain defines an explicit acknowledgement or recalculation action |

Only implement actions that have business meaning, but finish every applicable
path end to end: reachable UI → validation → permission check → service/API
mutation → persisted result → visible success/error feedback. Refreshing the
page must preserve successful changes. A visible capability without that path
is incomplete.

- Management applications are not read-only unless the user asks for a monitor,
  report, or prototype. Intentional read-only workspace pages carry a
  `READ_ONLY_SURFACE: <reason>` comment explaining why.
- Every mutation handler under `src/routes/api/**` has a UI caller using
  `apiUrl()`. External-only handlers carry an `EXTERNAL_CALLER` comment naming
  the caller.
- Seed data starts the experience; it does not replace operations. Use coherent,
  populated records across relevant lifecycle states.
- Avoid placeholder modules and copy such as “Coming soon”, “Demo mode”, or
  “can be added later”.
- Dangerous or irreversible operations show impact, ask for confirmation, and
  leave an audit trail when the domain requires one.

## Managed Preview Workflow

Dependencies are installed automatically by `preview_start`. Do not run
`npm install` manually or start a dev server yourself; both race the managed
preview environment.

1. Use `preview_start` after a meaningful implementation slice.
2. On failure, inspect `preview_logs`, fix the cause, then use `preview_restart`.
3. When a local preview URL is returned, run
   `npm run smoke:routes -- <local-url>`; it automatically checks every sidebar
   target. Add changed key routes that are intentionally outside the sidebar.
4. Tell the user the preview is ready; never paste the container-local URL.

After adding a dependency, restart the managed preview. If the same error
recurs three times, stop patching and report the blocker.

## Sources of Truth

- `specs/spec.md`: durable product intent when present. Update only affected
  business fields, roles, rules, workflows, or terminology; skip it for visual
  polish and build repairs.
- `DESIGN.md` and `src/styles/globals.css`: visual tokens and product feel.
- Component types/JSDoc under `src/components/**`: point-of-use composition
  guidance.
- `docs/platform-integration.md` and `docs/role-registration.md`: platform
  runtime and role contracts.

Platform-injected Builder guidance may own orchestration, UI generation,
responsive review, locale/copy, industrial patterns, and Tier0 SDK workflows.
Keep this scaffold Skill-name agnostic. `.agents/skills/` is an empty platform
placeholder; do not vendor Skills here.

## Scaffold Map

```text
src/
  start.ts                     gateway auth + CSRF middleware (do not modify)
  router.tsx                   router factory (do not modify)
  routes/
    __root.tsx                 root document + Toaster
    _app.tsx                   sidebar workspace layout
    _app.index.tsx             pre-generation Preview placeholder; replace or redirect
    station.tsx                scan/tap/confirm layout
    review.tsx                 evidence/decision layout
    monitor.tsx                passive fixed-board layout
    login.tsx                  hidden platform-auth error bridge
    api/**                     thin HTTP wrappers
  services/**                  domain logic, state machines, transactions
  db/                          Drizzle client, schema, optional bulk seed
  components/
    ui/                        visual primitives
    forms/                     safe form composition
    overlays/                  dialogs, drawers, confirmation
    data/                      async and table helpers
    actions/                   transparent recommendation/impact actions
    layouts/                   route-group shells
  lib/                         auth, permissions, routing and runtime helpers
server.mjs                     production entry (do not modify)
artifact.toml                  platform build/run contract
```

Do not modify generated `src/routeTree.gen.ts`. Preserve `src/start.ts`,
`src/router.tsx`, `src/db/index.ts`, Gateway/auth helpers, health/manifest/auth
routes, the root document structure, production entry, and existing Vite SSR
policy unless the user explicitly asks for platform/runtime work.

## Architecture and Domain Rules

Use three layers:

1. `src/routes/api/**`: authenticate, parse with Zod, call a service, return a
   response through `withErrors`.
2. `src/services/**`: business invariants, lifecycle transitions,
   transactions, and audit side effects.
3. `src/db/**`: schema, inferred types, and database client.

Hard invariants:

- Import `db` only from `src/services/**` and `src/db/seed.ts`; ESLint enforces
  the boundary.
- Keep `Request`, `Response`, and `Headers` out of services. Services return
  typed values and throw `HttpError` for caller-facing failures.
- Put every multi-step write in `db.transaction(async (tx) => ...)`, and use
  `tx` throughout the transaction.
- Define lifecycle transitions once in the owning service. Reject illegal
  transitions with a conflict/error instead of silently rewriting state.
- Use explicit Drizzle queries such as
  `select().from(table).where(...).limit(1)`, not relational
  `db.query.*.findFirst()` / `tx.query.*.findFirst()`.
- Normalize genuine raw-SQL results with `rowsOf()` before array operations.
- Derive validation/types from the Drizzle schema with
  `createInsertSchema`, `createUpdateSchema`, `$inferSelect`, and
  `$inferInsert` rather than duplicating shapes by hand.
- Tables that represent mutable business records include `...timestamps`.

### First-Load Database Safety

Every implemented module service owns and awaits one module-level
`bootstrapModule(...)` promise before querying.

- Bootstrap schema, tables, and indexes before seed callbacks; keep
  foreign-key order explicit.
- Use `create ... if not exists` and idempotent typed Drizzle seed writes.
- Seed dates use `seedDate()` / `seedTimestamp()` from
  `@/services/seed-utils`.
- Parent/child seeds use declared IDs or `requireSeedRef()` /
  `requireSeedValue()`; never pass a missing required foreign key that Drizzle
  can turn into SQL `default`.
- Use raw SQL only for schema/bootstrap setup and read-only helpers, not seed
  inserts/updates/deletes.
- Runtime startup must not depend on a prior `db:push` or execution of
  `src/db/seed.ts`. The latter is for explicit bulk/reset fixtures and uses
  relative imports only.
- Declare every table and enum in `src/db/schema.ts` through
  `appSchema.table(...)` / `appSchema.enum(...)`, never bare `pgTable` /
  `pgEnum` and never in another file. The platform deploys with
  `drizzle-kit push --force` scoped to `DB_SCHEMA`; a declaration outside
  `appSchema` is invisible to it and every table in the schema gets dropped.
- `bootstrapModule(...)` entries pass the declared table object (`table:
  workOrders`), so a runtime table always has a declaration push can see.
- Locally sync with `npm run db:push`; it refuses DROP/TRUNCATE plans unless
  `DB_SYNC_ALLOW_DESTRUCTIVE=1`.

## Routing and Server Boundaries

TanStack Router uses file names as route structure:

| File | URL / purpose |
|---|---|
| `routes/_app.index.tsx` | `/`, sidebar workspace index |
| `routes/_app.settings.tsx` | `/settings`, standalone page with no child routes |
| `routes/_app.work-orders.tsx` | parent of the two rows below; renders `<Outlet />` only |
| `routes/_app.work-orders.index.tsx` | `/work-orders`, the default list |
| `routes/_app.work-orders.$id.tsx` | `/work-orders/:id`, nested detail |
| `routes/_app.reports_.$id.tsx` | `/reports/:id`, detail that opts OUT of nesting |
| `routes/station.receiving.tsx` | `/station/receiving` |
| `routes/review.exceptions.tsx` | `/review/exceptions` |
| `routes/monitor.line-status.tsx` | `/monitor/line-status` |
| `routes/api/work-orders.ts` | `/api/work-orders` |

Choose one coherent app chrome. Use `_app` for management/planning/admin work;
`station` for task-first execution; `review` for evidence/decisions; `monitor`
for passive boards. A custom prefixed layout is acceptable when none fits.
Do not add an empty pathless layout that conflicts with `/`.

**A resource with a detail page must use one of exactly two shapes.** The `.`
separator nests routes, so `_app.work-orders.$id.tsx` is a child of
`_app.work-orders.tsx` and renders through the parent's `<Outlet />`. A parent
that draws its own list markup without an outlet still type-checks, lints and
builds — the detail page simply never renders, and nobody finds out until they
click a row.

- **Nested**: parent renders `<Outlet />` only, the list lives in a sibling
  `.index.tsx`, the detail in `.$param.tsx`. A parent may also render its own
  content *plus* `<Outlet />` when a master-detail layout is intended.
- **Non-nested**: append `_` to the parent segment (`_app.reports_.$id.tsx`) so
  the detail page renders standalone and the list route stays a plain page.

`npm run build` fails on any other shape, naming the offending resource; the
check lives in `src/lib/route-nesting-contracts.test.mjs` and is a locked gate.

`Route.useParams()` and `Route.useSearch()` are synchronous. Define
`validateSearch` when reading query strings.

TanStack Start does not use React Server Components. Components and route files
enter the client bundle; server-only APIs belong inside API handlers,
middleware, or `createServerFn().handler(...)`. Never import or call
`@tanstack/react-start/server` APIs from client render code or effects.
`Headers` is iterable rather than enumerable: inspect it with `.get()` or
`Object.fromEntries(headers.entries())`, not `JSON.stringify(headers)`.

## Gateway Authentication and Roles

The platform Gateway owns login and injects identity. The App does not manage
passwords, users, cookies, local sessions, login/register APIs, or logout.

- Deployed roles come from the complete comma-separated
  `X-Tier0-Business-Roles` set. Effective permissions are the union of all
  assigned roles.
- `X-Tier0-Active-Role` / `user.primaryRole` is display metadata only; never
  choose one “highest” role for authorization.
- Preview uses `X-Tier0-Preview-Role`; a preview request without a selected
  role enters with zero roles and zero permissions.
- Unknown trusted roles contribute zero permissions; explicit empty deployed
  roles remain zero-access. Forgeable unknown legacy roles fail closed.

Register roles in one pass:

The scaffold ships with no roles: `PERMISSION_MATRIX`, `ROLE_METADATA`, and
`roles.json` start empty, and no role name is reserved — define `admin` only
if the business genuinely needs a role by that name. Default the first version
to no more than three roles chosen for materially different permission scopes.
Do not create one role per page, action, or job title.

1. Define actions and `PERMISSION_MATRIX` in `src/lib/permissions.ts`.
2. Mirror every matrix role in `src/lib/role-metadata.ts` and `roles.json` —
   every role, no exceptions. `role_key` values use ASCII snake_case.
3. Guard APIs with `requireAuth(...)` and UI actions with
   `can(user.roles, action)`; both use permission-union semantics.
4. Verify each role's reachable navigation and actions.

Role display belongs to the global `Shell` user block only. Do not add page-body copy explaining what Admin, Operator, Member, or another role can do;
show permission differences through real visibility and access behavior.
Do not modify `src/start.ts`, `src/lib/{gateway,auth}.ts`, or
`src/routes/api/auth/**`.

## UI and Client Runtime

Use `DESIGN.md`, existing tokens, and the shipped primitives as a neutral
toolkit; choose compositions from the workflow rather than treating this list
as a mandatory page recipe.

- `ui`: `Button`, `StatusBadge`, `Card`, `PageHeader`,
  `StatusFilterChips`, `RiskBanner`, `EmptyState`, `StatCard`.
- `forms`: `FieldGroup`, `FormGrid`, `RecordSelect`, `FileUpload`,
  `LineItemSection`.
- `overlays`: `Dialog`, `FormDialog`, `ConfirmDialog`, `Drawer`.
- `data`: `AsyncView`, `DataTable`, `TableViewport`, table cell helpers.
- `actions`: `RecommendationAction` and `ImpactPreviewDialog` for transparent
  automatic/recommended/bulk changes.

Keep forms controlled and stable: do not key fields from their current value or
declare field components inside a form render. Validate inputs and show
success/error through `toast()`.

Fetch local APIs with `apiUrl()`. Shared loads use stable primitive request keys
with `useRequest()` / `usePolling()`; do not depend on a newly created loader
function each render. Render request state through `AsyncView` so failures show
an error and retry instead of indefinite loading.

Do not add a page-introduction subtitle that explains navigation or repeats the title.
Put actionable rules and risk beside the affected record/control. Role
summaries stay out of page content. Shell `defaultModules` starts empty; declare
real workspace routes through `defineNavigationModules`, using one unique href
per clickable leaf. Do not create an Overview module unless the product needs one.

Wide tables own their horizontal scroll region. Interactive pages remain usable
at 375px without page-level overflow; station controls are touch-friendly and
monitor boards fit their intended viewport. `npm run build` enforces the 375px
rule through `src/lib/responsive-contracts.test.mjs`, which is a locked gate:

- A search or filter control declares a **bounded** width. `flex-1` alone lets it
  swallow the whole toolbar on a wide screen and squeeze its siblings on a narrow
  one, so pair it with a ceiling — `w-full max-w-xs`, or `min-w-0 flex-1 max-w-sm`
  when it must share a row. This applies to `input`, `select` and `textarea`;
  `flex-1` on layout containers is unaffected.
- A minimum width above 375px belongs **inside** a horizontal scroll region.
  Copy `TableViewport`: `overflow-x-auto` on the outer element, `min-w-[720px]`
  on the inner one, so the sideways scroll stays local instead of moving the page. Use `ClientOnly` for Recharts,
dnd-kit, motion layout, or browser-only render paths. Recharts also needs a
non-zero container and `ResponsiveContainer`.

Keep `.tsx` component modules component-only for Fast Refresh; put runtime
constants/helpers in sibling `.ts` files. Import motion from `@/lib/motion`.
Use TailwindCSS 4 through `src/styles/globals.css`; do not add
`tailwind.config.js`, PostCSS wiring, or a second design system.

## Tier0 SDK

Use the installed `@tier0/sdk` when requirements involve Tier0 OpenAPI, UNS,
Flow, files, MQTT/MQ/WebSocket, or device commands. Call lazy helpers from
`@/lib/tier0` inside the concrete server action; do not top-level import or
invoke SDK submodules on SSR startup paths. Keep `vite.config.ts`
`ssr.external: ["pg", "@tier0/sdk", "mqtt"]`.

The platform injects SDK hosts, keys, and connection details. Do not add them
to `.env.example`, business tables, or user-facing settings unless the user
explicitly requests an operator-managed credential console. Keep human app
names separate from `APP_ID`/manifest runtime identifiers.

When the app must identify itself to the platform (notification `sender.id`
and similar), use `resolveAppId()` from `@/lib/app-id` — the platform-injected
`APP_ID`, i.e. the agent-platform App UUID — read at runtime. Never hard-code
its value at generation time: an imported copy of the app gets a new UUID and
a hard-coded value keeps pointing at the source app, so the notification's
name, icon and Open button silently break.

Do not use the sandbox file system for application-generated or user-uploaded
data. Use the platform File Storage API instead.

## App Identity and Product Copy

Set `APP_NAME` and `APP_LOCALE` once in `src/lib/app-chrome.ts`; update used
layout shells and platform App Info in the same closeout. Product UI uses one
explicit locale unless bilingual output is requested.

`APP_ID` is a platform-owned runtime identifier: the agent-platform App UUID,
injected into Preview and deployed runs. Never hard-code, rename, or surface
it as the app's name or business identity.
Without injection it resolves to `local-app` (`src/lib/app-id.ts`) — a
local-development placeholder only. The full contract lives in
`docs/platform-integration.md`.

On first generation and every rebrand, complete all four steps below before
reporting App Identity finished. Platform-registered image assets must have a
stable source copy at the project root so Download Source Code and Download
Snapshot retain the same files; never register a temporary or workspace-external
file as the only copy.

1. Create a simple, high-contrast domain mark and export the final asset as
   root `icon.png` (512×512, ≤2 MB). This matches the platform import/export
   package name. Coded artwork is allowed: SVG,
   Canvas, Node, HTML/browser rendering, or another deterministic drawing path
   may be used to produce the PNG. Prefer one bold centered symbol, generous
   padding, one or two solid colors, and no text or fine detail so it remains
   legible around 32px. Do not leave the scaffold placeholder unchanged.
2. Copy that exact file byte-for-byte to `public/app-icon.png` (also 512×512,
   ≤2 MB), then set `APP_ICON = "/app-icon.png"` in `src/lib/app-chrome.ts`.
   The public copy is the runtime asset; root `icon.png` is the durable
   registration/export source. Never generate the two copies independently.
3. Sync the root source with `update_app_info({ icon_path: "icon.png" })`,
   including name/description when changed. If either root persistence or the
   public copy fails, do not register the icon or report App Identity complete.
4. When registering a designed/generated cover with `cover_path`, first save
   the final file as root `cover.png` (PNG, ≤8 MB), matching the platform
   package name, then call `update_app_info({ cover_path: "cover.png" })`.
   This rule applies on first generation and every cover change; do not
   register a temporary path or a second independently generated image. If
   both icon and cover change, persist both root files before one
   `update_app_info` call.

Page titles name the work. Visible copy describes business data, state, action,
or consequence—not design-system commentary or implementation notes. Remove
scaffold/default branding from the finished app.

## Build, Gates, and Deployment

Run `npm run build` for completion. Its postbuild verifies the client/SSR
bundle, gate integrity, TypeScript, ESLint, contracts, runtime safety, and
first-load behavior. UI advisories are review prompts rather than failures.
Do not bypass completion with `vite build` alone.

Contract files have two classes:

- `src/lib/template-state.test.mjs` describes the blank template and is the only
  contract test generated apps may adapt.
- Every other test under `src/lib/`, plus gate/verify/audit scripts and
  `scripts/gate-integrity.json`, is locked. Do not edit, weaken, or delete it.
  Use documented opt-outs such as `EXTERNAL_CALLER` / `READ_ONLY_SURFACE`, or
  report a genuine conflict.

`artifact.toml` `args` are literal POSIX argv. Shell semantics use an explicit
`["sh", "-c", "..."]`; plain commands use token arrays. Leave build/run args
unchanged unless the task is deployment work.

Environment contracts are documented in `docs/platform-integration.md`.
Important names are `DATABASE_URL`, `DIRECT_DATABASE_URL`, `DB_SCHEMA`,
`DB_SYNC_ALLOW_DESTRUCTIVE`, `APP_ID`, and `VITE_BASE_PATH`
(`NEXT_PUBLIC_BASE_PATH` is legacy only).

## Completion Check

- The requested core workflows satisfy their legal lifecycle rather than
  blanket CRUD or read-only listing.
- Every exposed action is reachable, permissioned, validated, persisted, and
  reports success/error; dangerous actions confirm impact.
- Service boundaries, transactions, state transitions, audit effects, and
  first-load bootstrap invariants hold.
- Role matrix, metadata, `roles.json`, navigation, UI actions, and API guards
  agree; multiple roles grant the permission union.
- Loading, error/retry, empty, and populated states are visible and usable.
- App identity, locale, platform metadata, navigation, responsive behavior,
  and visible copy form one coherent product.
- `npm run build` and route smoke pass before completion is reported.
