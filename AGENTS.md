# Tier0 Industrial App Scaffold

This repository is a TanStack Start 1.x application scaffold (Vite 8,
TanStack Router, React 19, Zod, and TailwindCSS 4). It is not Next.js:
do not use `next/*`, App Router conventions, `next/headers`, or Next metadata.
Do not re-initialize the project.

New App business data must use Enterprise OpenAPI v2, not Drizzle or direct
database access. First read [the App API development contract](docs/app-api-development.md).
This branch updates the rules only: SQL dependencies and gates still exist.
Follow [the migration checklist](docs/scaffold-api-migration.md) before claiming
the template is API-ready; do not fabricate a database or weaken locked gates.

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
- `docs/app-api-development.md`: API-only persistence, provisioning, transactions,
  queries and permission boundaries; `docs/crm-api-lessons.md`: CRM-derived cases.
- `docs/scaffold-api-migration.md`: outstanding template/runtime migration work.

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
  services/**                  domain logic, state machines, API change batches
  db/                          legacy SQL files; pending maintainer migration, do not extend
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

Use three App layers, with persistence owned by the platform:

1. `src/routes/api/**`: authenticate, parse with Zod, call a service and return
   through `withErrors`.
2. `src/services/**`: ownership checks, business invariants, lifecycle transitions,
   query plans and atomic change batches. No HTTP request/response objects.
3. A server-only App Data client: authenticated Enterprise OpenAPI v2 calls,
   timeouts and structured errors. The source client and version provenance are
   described in `docs/app-api-development.md`; do not invent an npm package.

Hard invariants:

- All business records, samples, audit entries, imports and persistent command
  receipts go through the API. No `db` imports, SQL, database drivers or local
  file/localStorage persistence for business data in new App code.
- Define Zod inputs and platform-supported JSON Schemas explicitly. Preserve
  IDs as strings and money as safe integer minor units. Do not derive new App
  types from Drizzle tables.
- App data Keys stay server-only. Use App aliases resolved by `apps/context`;
  do not accept arbitrary API URLs, credentials or collection IDs from clients.
- A Key scopes the App, not the browser user. Authenticate and authorize each
  business action and constrain lists, details, exports and aggregates on the
  server. Preserve Gateway roles and CSRF protection.
- Multi-record business writes use one `changes/apply` atomic batch. App code
  constructs the batch; the platform opens and commits/rolls back the database
  transaction. Several independent HTTP calls are not one transaction.
- Carry `expectedRevision` or transaction-time conditions for concurrent changes.
  Re-read and revalidate business rules after conflict; never blindly replace
  a stale revision. Define each lifecycle transition in its owning service.
- Fix IDs, timestamps and payload for each idempotent user intent. Treat a lost
  response as unknown, not rollback; recover from a persistent API receipt when
  cross-process retry is required. External side effects are not DB-atomic.
- Use server pagination and supported relational query plans for aggregation.
  Do not load an arbitrary capped snapshot and silently present it as complete.

### Provisioning and First Load

Before generation, inspect the target API catalog and required capabilities.
An authorized Agent/operator provisions Collections, supported schemas, optional
Topics, App grants and a restricted App data Key through management APIs.
Keep management credentials outside the App runtime. Collection creation and
Key issuance are not ordinary page-load behavior.

At runtime resolve the App context and aliases; fail clearly for missing env,
permissions or unsupported capabilities. Never fall back to SQL, fake records
or a broader legacy endpoint. Demo fixtures require explicit approval and use
the API; do not seed on every service call.

The existing SQL bootstrap/build hooks are migration debt, not instructions to
run `db:push` for API Apps. A scaffold maintainer must replace them with API
boundary checks and real persistence tests before rollout. Generated Apps must
not edit locked checks just to make the new architecture pass.

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

Wrap every ordinary `_app` workspace page in
`<div className="page-shell ...">`. The shared class provides responsive page
padding (compact on phones, wider on desktop) and keeps direct children
shrinkable; keep page-specific vertical rhythm such as `space-y-6` on the same
element. Do not add a second outer `px-*` / `py-*` layer. Station, review, and
monitor layouts own their spacing separately and do not use `page-shell`.

Required fields use `FieldGroup required` or `FieldLabel required` with plain
title text. Show exactly one red asterisk to the right of the title, never
below the control. Do not hand-write stars, reverse label direction, or put
controls inside `FieldLabel`. Keep `required` / `aria-required` and validation
on the control separately; the marker is visual only.

Keep forms controlled and stable: do not key fields from their current value or
declare field components inside a form render. Validate inputs and show
success/error through `toast()`.

Never call the browser-native `alert()`, `confirm()`, or `prompt()` APIs,
including through `window`, `globalThis`, or `self`. They expose the Preview
host, block the page, and cannot follow the app's theme, locale, or mobile
layout. Use the application primitives instead:

- Use `toast()` for success, failure, and other information that does not need
  acknowledgement. Use `Dialog` when acknowledgement is part of the workflow.
- Use `ConfirmDialog` for risky or irreversible actions. Name the affected
  object and consequence, use a concrete action label such as Delete or
  Deactivate, set `destructive` when appropriate, and wire `pending` so a
  submission cannot be repeated. Cancelling before submission must not mutate
  data. `pending` disables footer actions, but does not block Esc, backdrop or
  header-close dismissal. Choose the in-flight close policy for the workflow:
  guard `onOpenChange(false)` while pending if dismissal must wait; if dismissal
  is allowed, retain operation state and report the eventual result. Closing
  does not abort an already-submitted request. Handle async errors in the caller.
- Use `FormDialog` for requested input, with controlled fields, validation, and
  an explicit submit label.

Load local APIs with `requestJson()` (it applies `apiUrl()`); pass the loader
`signal` through. Shared loads use stable primitive request keys with
`useRequest()` / `usePolling()`; do not depend on a newly created loader
function each render. Render request state through `AsyncView` so failures show
an error and retry instead of indefinite loading.

Keep live data current without routine Refresh buttons: `useRequest` revalidates
on visible/reconnect; use `{ refetchInterval: 15000 }` for shared operational
lists. Call `refresh()` after a successful mutation and for error retry. Keep
form drafts separate from fetched data so background updates cannot erase edits;
immutable reads can disable `refetchOnWindowFocus` / `refetchOnReconnect`.

A failed request must reach `console.error`, never only an error state:
`requestJson()` reports a non-2xx response with the server `cause` before it
throws (a 5xx is also sent to the Builder preview as a `network` error, which
shows its blocking error card), and the hooks report any other loader failure. The Builder preview
console only sees `console.error`; a silently caught fetch looks like an empty
page while the real cause stays in the server log. Do not wrap `requestJson()`
in a `catch` that drops the error.

Route `errorComponent`s render `RouteErrorBoundary` and nothing else. It shows
no visible error UI: the Builder preview intercepts the failure through the
preview bridge and shows its own error card with Retry and Agent fix. Do not
add a page-level "failed to load" headline, message, or Retry button.

Do not add a page-introduction subtitle that explains navigation or repeats the title.
Put actionable rules and risk beside the affected record/control. Role
summaries stay out of page content. Shell `defaultModules` starts empty; declare
real workspace routes through `defineNavigationModules`, using one unique href
per clickable leaf. Do not create an Overview module unless the product needs one.

Wide tables own their horizontal scroll region. Interactive pages remain usable
at 375px without page-level overflow; station controls are touch-friendly and
monitor boards fit their intended viewport. `npm run build` checks known source
patterns through the locked `src/lib/responsive-contracts.test.mjs` gate; it
does not measure rendered layout or prove 375px usability. Inspect affected
pages at a real 375px viewport when browser tooling is available, and report
when that check could not be run. The static checks cover these patterns:

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

Use the installed `@tier0/sdk` for its supported platform capabilities such as
notifications, Flow, files, MQTT/MQ/WebSocket and device commands. App Data v2
record/sample access uses the separate server-only client described in
`docs/app-api-development.md`; do not assume the SDK implements that contract.
Call lazy helpers from
`@/lib/tier0` inside the concrete server action; do not top-level import or
invoke SDK submodules on SSR startup paths. Keep `vite.config.ts`
`ssr.external: ["pg", "@tier0/sdk", "mqtt"]`.

The SDK baseline is `^0.5.4` (locked to `0.5.4`). For notifications, omitted
`channels` means Web & Desktop plus Mobile; use `[]` for inbox only, `['web']`
or `['mobile']` for explicit scope. There is no `desktop` channel. When
upgrading an existing app, change calls that relied on omitted channels for
silent delivery to `channels: []`. See `docs/platform-integration.md` for
notification migration, MQTT broker handling, and API-key compatibility diagnostics.
For MQTT authentication failures, check the installed SDK and injected key type
before changing credentials; do not hard-code username/clientId to bypass SDK
identity derivation.

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

1. Create a domain-specific app icon following `DESIGN.md` → App Icons and export the final asset as
   root `icon.png` (512×512, ≤2 MB). This matches the platform import/export
   package name. Coded artwork is allowed: SVG,
   Canvas, Node, HTML/browser rendering, or another deterministic drawing path
   may be used to produce the PNG. Use a rounded-square tile, a vivid tonal
   gradient, and a centered white or lightly tinted business symbol with subtle
   highlights and shallow layered depth. Keep generous padding and a clear
   silhouette at 32px; omit text and fine detail. Do not leave the scaffold
   placeholder unchanged.
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

For documentation-only maintenance, check links, examples, diff whitespace and
the version marker; do not claim runtime migration or App verification.
For App runtime changes, run `npm run build` for completion. Its postbuild
verifies the client/SSR bundle, gate integrity, TypeScript, ESLint, contracts, runtime safety, and
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
The proposed private App Data variables are `TIER0_APP_API_BASE` and
`TIER0_APP_API_KEY`; deployment must explicitly supply them, they are not yet
automatically injected by this scaffold. Preserve `APP_ID`, `VITE_BASE_PATH`
and the separate SDK contract (`NEXT_PUBLIC_BASE_PATH` is legacy only).
Remaining SQL environment assumptions are tracked in the migration checklist.

## Scaffold Version

`package.json.tier0Scaffold` (`{ "version": <positive integer>, "ref":
"<scaffold commit sha>" }`) records which Tier0-App-Scaffold version this app
was generated from. The platform reads it when the app is imported and prompts
alignment when it is missing or differs from the current scaffold; nothing at
runtime depends on it, and `npm run build` only warns when it is missing or
malformed.

- Never edit `tier0Scaffold` by hand, and never remove it. It is not an app
  setting, and changing the number does not align anything.
- The align-platform-app Skill writes the version and ref it was pinned to
  after a successful alignment; that is the only path that updates the field
  inside an app.

## Completion Check

- The requested core workflows satisfy their legal lifecycle rather than
  blanket CRUD or read-only listing.
- Every exposed action is reachable, permissioned, validated, persisted, and
  reports success/error; dangerous actions confirm impact.
- Service boundaries, transactions, state transitions, audit effects, and
  API provisioning, atomicity, revision and retry invariants hold.
- Role matrix, metadata, `roles.json`, navigation, UI actions, and API guards
  agree; multiple roles grant the permission union.
- Loading, error/retry, empty, and populated states are visible and usable.
- App identity, locale, platform metadata, navigation, responsive behavior,
  and visible copy form one coherent product.
- `npm run build` and route smoke pass before completion is reported.

## Generic component kit

Before generating forms, tables or reusable editors, consult
[docs/component-kit.md](docs/component-kit.md) and reuse `src/components/kit`.
Keep business objects, services and roles in the application. Data-backed kit
components require an application-scoped `ComponentKitProvider`; logical resource
paths do not imply backend endpoints exist. Never import `gallery/fixtures.ts`
into an app. Preserve existing auth/permission guards and the scaffold theme;
enabled inputs use white surfaces, with gray fill reserved for disabled controls.
