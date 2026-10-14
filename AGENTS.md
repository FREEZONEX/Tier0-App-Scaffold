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
- When fixtures are requested, create coherent records through the API in the
  designated test environment. Do not seed production or replace real operations.
- Avoid placeholder modules and copy such as “Coming soon”, “Demo mode”, or
  “can be added later”.
- Dangerous or irreversible operations show impact, ask for confirmation, and
  leave an audit trail when the domain requires one.

## Managed Preview Workflow

When working in managed Builder preview, dependencies are installed by
`preview_start`. Do not run
`npm install` manually or start a dev server yourself; both race the managed
preview environment.

1. Use `preview_start` after a meaningful implementation slice.
2. On failure, inspect `preview_logs`, fix the cause, then use `preview_restart`.
3. When a local preview URL is returned, run
   `npm run smoke:routes -- <local-url>`; it automatically checks every sidebar
   target. Add changed key routes that are intentionally outside the sidebar.
4. Tell the user the preview is ready; never paste the container-local URL.

After adding a dependency, restart the managed preview. Outside that environment,
use the local commands in README; do not assume Builder tools are available.

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

Read [App API development](docs/app-api-development.md) for data modeling,
provisioning, queries, atomic batches, concurrency, idempotency and acceptance.

- Routes authenticate and parse inputs, then call services through `withErrors`.
- Services enforce business rules and per-user data access and construct API
  queries/change batches. Keep HTTP objects out of services.
- The server-only App Data client owns transport. No App SQL connection,
  Drizzle model or browser-held data Key. Management provisioning is separate
  from runtime data access; page loads do not create metadata or seed records.
- Several HTTP writes are not one transaction. Use platform atomic batches and
  revisions/conditions; do not replace errors with mock or local persistence.

SQL bootstrap and build assumptions still need the
[maintainer migration](docs/scaffold-api-migration.md). Do not weaken locked gates
or fabricate database configuration to conceal that work.

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

Define `PERMISSION_MATRIX`, `ROLE_METADATA` and `roles.json` together; no role
is reserved or granted by default. `requireAuth(...roles)` accepts **role names**,
not action names. Authenticate first, then use `can(user.roles, action)` for
action checks on the server as well as UI. Apply ownership rules in services.
See [role registration](docs/role-registration.md) for format and handoff.

Show role identity in the Shell, not explanatory page-body paragraphs.
Preserve `src/start.ts`, Gateway/auth helpers and `src/routes/api/auth/**`.

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

Use `@/lib/tier0` lazy loaders inside server actions for supported SDK operations;
do not initialize platform I/O on SSR imports. App Data v2 uses its own
server-only client, not a substitute SDK Key. The current SDK, notification,
MQTT and configuration contracts live in
[platform integration](docs/platform-integration.md).

Keep credentials out of browser bundles, business records and user settings.
Use the platform File Storage API for uploads/generated files, not local paths.

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

On first generation and rebrand, follow [DESIGN.md](DESIGN.md#app-icons) for
icon appearance and [asset registration](docs/platform-integration.md#agent-registered-visual-assets)
for dimensions, durable root/public copies and registration. Update App Info
and runtime branding together; do not leave the scaffold placeholder.

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

Environment names and injection boundaries are maintained only in
[platform integration](docs/platform-integration.md). Missing data API
configuration must fail clearly, never fall back to a database or mock.

## Scaffold Version

Preserve `package.json.tier0Scaffold`. Generated Apps must not manually change
or remove it; alignment tooling updates it after actual alignment. Scaffold
maintainers follow the [version procedure](README.md#scaffold-version-maintainers).

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
