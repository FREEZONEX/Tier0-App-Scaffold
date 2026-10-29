# Tier0 Industrial App Scaffold

This repository is a TanStack Start 1.x application scaffold (Vite 8,
TanStack Router, React 19, Zod, TailwindCSS 4, and Tier0 UNS collections as
the only data store). It is not Next.js:
do not use `next/*`, App Router conventions, `next/headers`, or Next metadata.
Do not re-initialize the project.

Build a usable industrial application, not a demo. Prefer a small number of
complete workflows over a wide read-only shell.

This file holds the rules that always apply. Task references live in `docs/`;
read the named file **before** that kind of work:

| Before you… | Read |
|---|---|
| declare/change collections, write services that touch records, add live updates, evolve a schema | `docs/app-data.md` |
| build or rework routes, pages, forms, dialogs, data loading, responsive layouts | `docs/ui-rules.md`, `docs/component-kit.md` |
| register or change roles | `docs/role-registration.md` |
| use the Tier0 SDK, notifications, MQTT, files, env vars, scaffold version | `docs/platform-integration.md` |

## Delivery Floor: Complete the Legal Lifecycle

Infer each business object's lifecycle from the domain. Do not mechanically add
CRUD to every collection: a valid termination, correction, or operational
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
  populated records across relevant lifecycle states (declared once as
  collection `seed`, see App Data).
- Avoid placeholder modules and copy such as “Coming soon”, “Demo mode”, or
  “can be added later”.
- Dangerous or irreversible operations show impact, ask for confirmation, and
  leave an audit trail when the domain requires one.

## Managed Preview Workflow

The platform runs the preview (install + dev server) and shows its status in
the Builder. Do not run `npm install` manually or start a dev server yourself;
both race the managed preview. Your only preview tool is `preview_restart`: it
reruns install + dev and returns as soon as the restart is triggered, with no
URL and no logs. Code edits hot-reload in the running preview.

Facts inside the sandbox:

- Status: `/dev/shm/.tier0/preview/state.json` — `state` goes
  `installing` → `starting` → `ready` or `failed` (`error` says why); `port` is
  the dev-server port on `127.0.0.1` (default 5173).
- Log: `/dev/shm/.tier0/preview/preview.log` (previous run in `preview.log.1`);
  a ready server logs `[tier0-preview] ready on port <PORT>`.

1. After adding a dependency, or when the preview failed or is not running,
   call `preview_restart`.
2. Wait for a final state:
   ```sh
   S=/dev/shm/.tier0/preview/state.json
   for i in $(seq 150); do grep -Eq '"state": *"(ready|failed)"' "$S" && break; sleep 2; done; cat "$S"
   ```
3. On `failed`, read `tail -n 100 /dev/shm/.tier0/preview/preview.log`, fix the
   cause, then `preview_restart` again.
4. When `ready`, run the route smoke against the sandbox port:
   ```sh
   npm run smoke:routes -- "http://127.0.0.1:$(node -p 'require("/dev/shm/.tier0/preview/state.json").port || 5173')"
   ```
   It checks `/` and every sidebar target and exits non-zero on failure.
   Append changed key routes that are intentionally outside the sidebar as
   extra arguments (`... /station/receiving`).
5. Tell the user the preview is ready in the Builder; never paste the
   container-local URL.

If the same error recurs three times, stop patching and report the blocker.

## Sources of Truth

- `specs/spec.md`: durable product intent when present. Update only affected
  business fields, roles, rules, workflows, or terminology; skip it for visual
  polish and build repairs.
- `DESIGN.md` and `src/styles/globals.css`: visual tokens and product feel.
- Component types/JSDoc under `src/components/**`: point-of-use composition
  guidance.
- `docs/*.md`: the task references listed above.

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
    station.tsx / review.tsx / monitor.tsx   task-first / evidence / passive-board layouts
    login.tsx                  hidden platform-auth error bridge
    api/**                     thin HTTP wrappers
    api/uns/subscribe.ts       record change stream for useRecordChanges (do not modify)
  services/**                  domain logic, state machines, data access
  data/collections.ts          collection declarations + seed (source of truth)
  data/seed-utils.ts           seed date/reference helpers
  components/{ui,forms,overlays,data,actions,layouts,kit}   shipped primitives
  lib/                         auth, permissions, routing and runtime helpers
  lib/data/                    App instance of the @tier0/sdk-v2/data client (locked)
  lib/record-changes.ts        useRecordChanges(): live record changes in the browser
server.mjs                     production entry (do not modify)
artifact.toml                  platform build/run contract
```

Do not modify generated `src/routeTree.gen.ts`. Preserve `src/start.ts`,
`src/router.tsx`, `src/lib/data/**`, Gateway/auth helpers, the health,
manifest, auth and `api/uns/subscribe` routes, the root document structure,
production entry, and existing Vite SSR policy unless the user explicitly asks
for platform/runtime work.

## Architecture and Domain Rules

Use three layers:

1. `src/routes/api/**`: authenticate, parse with Zod, call a service, return a
   response through `withErrors`.
2. `src/services/**`: business invariants, lifecycle transitions, data
   access through `@/lib/data`, and audit side effects.
3. `src/data/collections.ts`: collection declarations (Zod schemas, indexes,
   seed) and the types derived from them.

Hard invariants:

- Import `@/lib/data` (and values from `@tier0/sdk-v2/data`) only from
  `src/services/**`; the data client is server-only and must not reach the
  browser bundle. ESLint and the locked `src/lib/data-contracts.test.mjs` flag
  accidental violations (static guard rails, not a security boundary). Any
  file may import declarations from `@/data/collections` and from
  `@tier0/sdk-v2/data/define`, and types from `@tier0/sdk-v2/data`.
- Keep `Request`, `Response`, and `Headers` out of services. Services return
  typed values and throw `HttpError` for caller-facing failures.
- Define lifecycle transitions once in the owning service. Reject illegal
  transitions with a conflict/error instead of silently rewriting state.
- Never fetch Tier0 UNS paths yourself and never put `TIER0_API_KEY` in the
  browser; the data layer is the only UNS client.

## App Data

Business data lives in Tier0 UNS collections owned by this App. There is no
SQL database, ORM, connection string, migration or `db:push` step. Preview and
the deployed App use the **same** collections and the same records. The full
API, limits, examples, error codes and tier0 MCP operations are in
`docs/app-data.md`; read it before data work. Rules that always hold:

- Declare every collection (Zod storage schema, indexes, `seed`) in
  `src/data/collections.ts` and list it in `collections`. Storage schemas use
  the supported Zod subset only; `npm run build` fails with the replacement
  for anything else. Never declare `_id` / `_meta`.
- Seed: fixed `_id`s, coherent across lifecycle states, written **once** when a
  collection is created; editing `seed` never reseeds. Never insert baseline
  data from services.
- Model documents, not tables: embed what changes with the record, reference
  shared entities by ID plus a display snapshot, one collection per business
  object kind.
- Read efficiently: one `data.queryBatch` per screen, `get(ids)` for records by
  ID (`missing` = 404, never "forbidden"), a `limit` on every list read, one
  `countBy` / `aggregate` for statistics, capped counts shown as "10000+".
  Never call the data layer once per loop iteration or `map` item.
- Consistency: put the expected state in the filter for transitions
  (`findOneAndUpdate`, `null` → 409); send `_meta.revision` as
  `expectedRevision` for edits; use one `data.transact` for cross-document
  invariants. Never rerun a partially committed `updateMany` / `deleteMany`;
  continue from `resumeAfter`.
- Do not pass idempotency keys or wrap data calls in retry loops; let
  `DataError` reach `withErrors` and branch on `code` / `reason`, never on
  message text.
- Do not ensure collections manually, touch data at import time, or add a
  request context of your own; detached work runs inside `runAsApp(...)`.
- Live updates: pages subscribe with `useRecordChanges([alias...], reload)`
  (aliases, not declarations); an event only means "reload through the App's
  API". Do not poll App records and never subscribe from services.
- Schema changes only widen automatically. Never `deleteMany` or recreate a
  collection to "reset" a schema. `schema:replace`, `archive` and `restore`
  are worker operations through the tier0 MCP, never runtime code.

An imported or older App's own SQL database is App-owned persistence: rewrite
its callers to collections and remove the driver, ORM and connection settings
instead of connecting to the old database or asking for its configuration.
`npm run build` fails while `src/` or `server.mjs` still reads `DATABASE_URL*`,
`DIRECT_DATABASE_URL`, `DB_SCHEMA`, `PG*` or `POSTGRES_*` from the environment,
or `package.json` still depends on a database driver or ORM. Only a database the user explicitly keeps as an
external system of record is declared in `package.json`
`tier0ExternalDatabases` (`package`, optional `env`, `reason`).

## Routing and Server Boundaries

TanStack Router uses file names as route structure: `_app.work-orders.index.tsx`
→ `/work-orders`, `routes/station.receiving.tsx` → `/station/receiving`,
`routes/api/work-orders.ts` → `/api/work-orders`.

Choose one coherent app chrome. Use `_app` for management/planning/admin work;
`station` for task-first execution; `review` for evidence/decisions; `monitor`
for passive boards. A custom prefixed layout is acceptable when none fits.
Do not add an empty pathless layout that conflicts with `/`.

**A resource with a detail page must use one of exactly two shapes.** The `.`
separator nests routes, so a detail page under a parent that renders no
`<Outlet />` never renders, although it type-checks, lints and builds.

- **Nested**: parent `_app.work-orders.tsx` renders `<Outlet />` only, the list
  lives in a sibling `.index.tsx`, the detail in `.$param.tsx`. A parent may
  also render its own content *plus* `<Outlet />` when a master-detail layout
  is intended.
- **Non-nested**: append `_` to the parent segment (`_app.reports_.$id.tsx`) so
  the detail page renders standalone and the list route stays a plain page.

`npm run build` fails on any other shape (locked
`src/lib/route-nesting-contracts.test.mjs`). `Route.useParams()` and
`Route.useSearch()` are synchronous; define `validateSearch` when reading query
strings.

TanStack Start does not use React Server Components. Components and route files
enter the client bundle; server-only APIs belong inside API handlers,
middleware, or `createServerFn().handler(...)`. Never import or call
`@tanstack/react-start/server` APIs from client render code or effects.
Inspect `Headers` with `.get()` or `Object.fromEntries(headers.entries())`,
not `JSON.stringify(headers)`.

## Gateway Authentication and Roles

The platform Gateway owns login and injects identity. The App does not manage
passwords, users, cookies, local sessions, login/register APIs, or logout.

- Deployed roles come from the complete comma-separated
  `X-Tier0-Business-Roles` set. Effective permissions are the union of all
  assigned roles.
- `X-Tier0-Active-Role` / `user.primaryRole` is display metadata only; never
  choose one “highest” role for authorization.
- Preview uses the comma-separated `X-Tier0-Preview-Role` role set selected by
  the developer (permission union); a preview request without a selected role
  enters with zero roles and zero permissions.
- Unknown trusted roles contribute zero permissions; explicit empty deployed
  roles remain zero-access. Forgeable unknown legacy roles fail closed.

The scaffold ships with no roles (`PERMISSION_MATRIX`, `ROLE_METADATA` and
`roles.json` start empty; no role name is reserved, define `admin` only if the
business needs it). Default the first version to no more than three roles with
materially different permission scopes; never one role per page, action, or job
title. This is generation guidance, not a build limit: define more roles when
the business needs distinct permission scopes. Register roles in one pass:

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

Use `DESIGN.md`, existing tokens and the shipped primitives
(`src/components/{ui,forms,overlays,data,actions}`, kit in
`src/components/kit`); details and rationale are in `docs/ui-rules.md` and
`docs/component-kit.md`.

- List-type pages default to `MetaListPage` (`@/components/kit/meta/meta-list-page`)
  with an application-scoped provider and real data adapter; extend its hooks
  instead of rebuilding the list shell. Render list content directly on the page
  canvas; do not wrap it in a decorative `Card` / `PageCard`. Keep the single
  `page-shell` inset. Use another composition only when the
  user asks or the workflow does not fit, and record why.
- Wrap every ordinary `_app` workspace page in
  `<div className="page-shell ...">`; no second outer `px-*` / `py-*` layer.
  Station, review and monitor layouts own their spacing.
- Required fields use `FieldGroup required` / `FieldLabel required` (one red
  asterisk, right of the title); keep forms controlled and stable.
- Never call browser-native `alert()`, `confirm()` or `prompt()` (also via
  `window` / `globalThis` / `self`). Use `toast()`, `Dialog`, `ConfirmDialog`
  (named object and consequence, `destructive`, `pending`) and `FormDialog`.
- Load local APIs with `requestJson()` (applies `apiUrl()`) through
  `useRequest()` / `usePolling()` with stable keys and `AsyncView`. Refresh App
  records with `useRecordChanges`, not routine Refresh buttons or polling.
- A failed request must reach `console.error`; never catch and drop a
  `requestJson()` error. Route `errorComponent`s render `RouteErrorBoundary`
  and nothing else.
- Do not add a page-introduction subtitle that explains navigation or repeats
  the title. Shell `defaultModules` starts empty; declare real routes through
  `defineNavigationModules`, one unique href per clickable leaf.
- Interactive pages remain usable at 375px without page-level overflow; wide
  tables own their horizontal scroll region and search/filter controls have a
  bounded width. Check affected pages at a real 375px viewport when browser
  tooling is available, and report when it could not be run.
- Use `ClientOnly` for Recharts, dnd-kit, motion layout and browser-only
  render paths. Keep `.tsx` modules component-only; use TailwindCSS 4 through
  `src/styles/globals.css`, no `tailwind.config.js` or second design system.
- Never import `gallery/fixtures.ts` into an app; enabled inputs use white
  surfaces, gray fill only for disabled controls.

## Tier0 SDK and Platform

Use the installed `@tier0/sdk-v2` (`0.6.1`, pinned exactly in `package.json`;
never change that dependency) for user/platform info, members, notifications,
files, MQTT/MQ/WebSocket or capabilities. Load it lazily inside the
server action through `@/lib/tier0` (`loadTier0Sdk()`, `loadTier0Mq()`); never
top-level import or invoke it on SSR startup paths, and keep `vite.config.ts`
`ssr.external: ["@tier0/sdk-v2", "mqtt"]`. App records use `@/lib/data`, not
`tier0.uns`. App-scoped member pickers use
`tier0.members.listApp({ appId: resolveAppId() })`. Notification channels,
MQTT and credential handling: `docs/platform-integration.md`.

- The platform injects SDK hosts, keys and connection details
  (`TIER0_API_HOST`, `TIER0_API_KEY`, `APP_ID`, `VITE_BASE_PATH`). Do not add
  them to `.env.example`, collections or user-facing settings unless the user
  asks for an operator-managed credential console. Apps have no database
  connection variables.
- Do not use the sandbox file system for application-generated or uploaded
  data; use the platform File Storage API.

## App Identity and Product Copy

Set `APP_NAME` and `APP_LOCALE` once in `src/lib/app-chrome.ts`; update used
layout shells and platform App Info in the same closeout. Product UI uses one
explicit locale unless bilingual output is requested.

`APP_ID` is a platform-owned runtime identifier: the agent-platform App UUID,
injected into Preview and deployed runs. Never hard-code, rename, or surface
it as the app's name or business identity; read it at runtime with
`resolveAppId()` from `@/lib/app-id` (e.g. notification `sender.id`). Without
injection it resolves to `local-app` — a local-development placeholder only.

On first generation and every rebrand, complete all steps before reporting App
Identity finished; registered images keep a stable source copy at the project
root, never a temporary or workspace-external file:

1. Create a domain-specific icon following `DESIGN.md` → App Icons, exported
   as root `icon.png` (512×512, ≤2 MB). Coded artwork is allowed: SVG,
   Canvas, Node, HTML/browser rendering, or another deterministic drawing path
   may produce the PNG. Do not leave the scaffold placeholder unchanged.
2. Copy that exact file byte-for-byte to `public/app-icon.png` (also 512×512,
   ≤2 MB) and set `APP_ICON = "/app-icon.png"` in `src/lib/app-chrome.ts`.
   Never generate the two copies independently.
3. Sync with `update_app_info({ icon_path: "icon.png" })`, including
   name/description when changed. If either copy failed, do not register the
   icon or report App Identity complete.
4. A designed cover is saved as root `cover.png` (PNG, ≤8 MB) before
   `update_app_info({ cover_path: "cover.png" })`. When icon and cover both
   change, persist both files before one `update_app_info` call.

Page titles name the work. Visible copy describes business data, state, action,
or consequence—not design-system commentary or implementation notes. Remove
scaffold/default branding from the finished app.

## App Stream requests and messages

Use the bundled `@tier0/sdk/cloud` for `client.streams.requests` and
`client.streams.messages`. Keep `@tier0/sdk-v2` at its current exact pin for data
and platform operations. Do not generate controls APIs, v2 request-execution
aliases, interpreter selectors or a second control credential. Keep the
`tier0-stream/v3` machine script contract; it does not select a runtime.

Browser Stream calls require the platform's trusted runtime provider; application
code does not install or impersonate it. Preview without that provider fails
closed. Node Apps automatically read `TIER0_API_HOST`, `TIER0_API_KEY` and `APP_ID`.
The injected App/internal Key must hold persisted unified Stream scopes, and
current App policy plus entry/topic grants must allow the operation. Existing
Keys missing those scopes require an explicit authorized migration/reissue; the
SDK never expands them. Do not synthesize identity, install a fake provider or
restore a second Control credential.

## Build, Gates, and Deployment

Run `npm run build` for completion. Its postbuild verifies the client/SSR
bundle, gate integrity, TypeScript, ESLint, contracts, runtime safety, and
first-load behavior. UI advisories are review prompts rather than failures.

Generation guidance (role count, page copy, lifecycle/caller heuristics,
component choices, visual recipes and static layout heuristics) is non-blocking.
Review findings against the requested workflow; do not add fake actions,
confirmation copy or marker comments just to silence an advisory. Equivalent
implementations and intentional read-only pages are valid. A malformed or
missing scaffold version marker also warns in App builds. Authentication,
permission registration, data contracts, server boundaries, route correctness
and actual runtime failures remain hard checks. Scaffold CI separately runs
`SCAFFOLD_GUIDANCE_STRICT=1` to test the template's own defaults.
Do not bypass completion with `vite build` alone.

- `src/lib/template-state.test.mjs` describes the blank template and is the only
  contract test generated apps may adapt.
- Every other test under `src/lib/`, the data-layer wiring `src/lib/data/**`,
  gate/verify/audit scripts and `scripts/gate-integrity.json` are locked. Do
  not edit, weaken, or delete them. Use documented opt-outs such as
  `EXTERNAL_CALLER` / `READ_ONLY_SURFACE`, or report a genuine conflict.
- `artifact.toml` `args` are literal POSIX argv (shell semantics need an
  explicit `["sh", "-c", "..."]`). Leave build/run args unchanged unless the
  task is deployment work.
- `package.json.tier0Scaffold` records the scaffold version; never edit or
  remove it by hand (only the align-platform-app Skill updates it).

## Completion Check

- The requested core workflows satisfy their legal lifecycle rather than
  blanket CRUD or read-only listing.
- Every exposed action is reachable, permissioned, validated, persisted, and
  reports success/error; dangerous actions confirm impact.
- Service boundaries, state transitions, consistency patterns (conditional
  updates, `expectedRevision`, `data.transact`) and audit effects hold; every
  collection is declared, listed and seeded in `src/data/collections.ts`.
- Role matrix, metadata, `roles.json`, navigation, UI actions, and API guards
  agree; multiple roles grant the permission union.
- Loading, error/retry, empty, and populated states are visible and usable.
- App identity, locale, platform metadata, navigation, responsive behavior,
  and visible copy form one coherent product.
- `npm run build` and route smoke pass before completion is reported.
