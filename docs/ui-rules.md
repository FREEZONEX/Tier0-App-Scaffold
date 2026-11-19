> The visual recipes and source-pattern checks in this document are generation
> guidance. They produce non-blocking build advisories, not proof of a broken
> layout or incomplete workflow. Follow explicit product requirements and verify
> the rendered result. Runtime correctness and safety checks remain blocking.

# UI and Client Runtime Rules

Detailed UI rules behind the summary in `AGENTS.md` → UI and Client Runtime.
Read this before building or reworking routes, pages, forms, dialogs, data loading or
responsive layouts. Component selection and data adapters are in
[component-kit.md](component-kit.md); visual tokens are in `../DESIGN.md`.

## Shipped primitives

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

### Reuse before replacing

When adding or changing a control, first check the shipped component's props
and examples, then compose it with the page's data and actions. Prefer those
components for inputs, buttons, pickers, menus and overlays so both the closed
control and its open content follow the app's theme and interaction patterns.
"Built-in" means the components shipped in this scaffold, not browser-native
widgets such as a visible `<select>`.

For metrics, time-window presets and other option values, use kit `Select`.
For a supplied list of business records with form/change-event semantics, use
`RecordSelect`; for remote record lookup, inspect `ReferenceSelect` /
`ReferencePicker` and the application adapter contract. Use `DropdownMenu` for
actions such as opening or editing a record, not for a field's selected value.
See [selection examples](component-kit.md#选择与操作菜单) for imports and callbacks.

Keep native elements used inside components for semantics, form submission or
event compatibility; `RecordSelect`'s hidden `<select>` is intentional. A
specific workflow or explicit user request may need another implementation.
This preference adds no scanner, lint rule, build check or runtime restriction,
and does not require a bulk rewrite of existing pages. Verify representative
generated controls by opening them and using the keyboard; do not turn style
differences into preview or publishing blockers.

## List pages

List-type pages (master data, ledgers, documents, tasks, and searchable record
collections) default to `MetaListPage` from
`@/components/kit/meta/meta-list-page`. Configure the object metadata and extend
its `onCreate`, `onOpenRecord`, `rowActions`, `batchActions`, `cellRenderers`,
`headerExtra`, and `toolbarExtra` hooks rather than rebuilding the query,
view, column, sorting, and pagination shell. Follow
[component-kit.md](component-kit.md#列表类型页面默认使用-metalistpage)
for the application-scoped provider, real data adapter, and permission contract.
`DataGrid` / `DataTable` are lower-level tables; `DetailTable` is for editable
line items, not the default list-page foundation. Enable only capabilities the
business needs and the application actually implements.

Use a different composition when the user explicitly requests it or a concrete
workflow does not fit a metadata list (for example a chart-first report,
Kanban/Gantt board, scan-first station, or embedded detail table). Record that
reason in implementation notes; do not invent a new list shell for cosmetic
variation. A narrow repair to an existing working page does not by itself
require migrating the whole page.

## Sidebar navigation

Give every generated sidebar group and link an `icon` imported by name from
`lucide-react` (for example, `ClipboardList` for a work queue). Check the
collapsed rail: it keeps the navigation icons, account avatar, and the divider
above the avatar. Link names remain available to assistive technology.

The sidebar follows the Tier0 platform sidebar: a gray rail (`--sidebar`,
240px open / 64px collapsed (`w-60` / `w-16`)), app icon and name with a panel toggle on top,
regular-weight dark items 36px high, hover one gray step darker
(`--sidebar-accent`) and the selected item one more (`bg-muted`, mapped to
`--sidebar-selected` inside the rail). The bottom of the rail always shows the
account avatar and name, with a role line only when role names are present.
Do not show an empty-role or loading placeholder in that line. Do not add a
notification bell until the App has a real notice feed and a clear click destination. Gallery business
scenes (`SceneShell`) must mirror this footer — never ship a scene rail without
the account strip.
A module with `children` is a titled section (small gray label, always
open; a divider in the collapsed rail), not a collapsible folder: group links
by business area (生产 / 质量 / 主数据…) instead of nesting deeper. A link that
opens another surface in a new tab sets `newTab: true` and shows the
external-link mark.

## Page shell, required fields and forms

Wrap every ordinary `_app` workspace page in
`<div className="page-shell ...">`. The shared class provides responsive page
padding (compact on phones, wider on desktop) and keeps direct children
shrinkable; keep page-specific vertical rhythm such as `space-y-6` on the same
element. Do not add a second outer `px-*` / `py-*` layer. Station, review, and
monitor layouts own their spacing separately and do not use `page-shell`.

The workspace fills the available width beside the sidebar. Lists, ledgers,
quality review and planning pages must not inherit a global centered maximum.
Page insets are 16px horizontally on narrow screens and 24px on desktop.
Constrain only content that benefits from a shorter reading or editing width:

```tsx
<div className="page-shell space-y-5">
  <PageHeader title="Settings" />
  <form className="w-full min-w-0 max-w-3xl">{/* form fields */}</form>
  <article className="w-full min-w-0 max-w-prose">{/* long text */}</article>
</div>
```

These local limits are optional; multi-column forms and editable line items
may need full width. Keep page headers and operational tables outside narrow
wrappers. Add `mx-auto` only for a deliberately centered local block. Keep
search controls and status/action columns bounded rather than stretching every
control equally. Verify 375px, 1920px and 2560px viewports, including desktop
sidebar expansion/collapse; wide tables should scroll internally.

Required fields use `FieldGroup required` or `FieldLabel required` with plain
title text. Show exactly one red asterisk to the right of the title, never
below the control. Do not hand-write stars, reverse label direction, or put
controls inside `FieldLabel`. Keep `required` / `aria-required` and validation
on the control separately; the marker is visual only.

Keep forms controlled and stable: do not key fields from their current value or
declare field components inside a form render. Validate inputs and show
success/error through `toast()`.

## No browser-native dialogs

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

## Loading, live data and failures

Load local APIs with `requestJson()` (it applies `apiUrl()`); pass the loader
`signal` through. Shared loads use stable primitive request keys with
`useRequest()` / `usePolling()`; do not depend on a newly created loader
function each render. Render request state through `AsyncView` so failures show
an error and retry instead of indefinite loading. Its failure state is one
compact line inside the area that failed, with Retry and the technical message
behind "Details"; do not hand-roll another load-failure block.

Keep live data current without routine Refresh buttons: `useRequest` revalidates
on visible/reconnect; shared operational lists of App records refresh on
`useRecordChanges` (see `app-data.md` → Live updates). `{ refetchInterval: 15000 }` /
`usePolling` are only for data a subscription cannot cover (platform SDK data,
external systems). Call `refresh()` after a successful mutation and for error retry. Keep
form drafts separate from fetched data so background updates cannot erase edits;
immutable reads can disable `refetchOnWindowFocus` / `refetchOnReconnect`.

A failed request must reach `console.error`, never only an error state:
`requestJson()` reports a non-2xx response with the server `cause` before it
throws, and the hooks report any other loader failure. Handle API failures,
including 5xx responses, in the affected `AsyncView` or form; keep the page
shell and other working areas usable. Do not send an API failure through
`sendPreviewError`: it would replace the entire Builder preview with an error
card. The Builder preview console relays `console.error`, preserving the cause
without blocking the page. Do not wrap `requestJson()` in a `catch` that drops
the error, and do not automatically replay failed business writes.

Route `errorComponent`s render `RouteErrorBoundary` and nothing else. It shows
no visible error UI: the Builder preview intercepts the failure through the
preview bridge and shows its own error card with Retry and Agent fix. Do not
add a page-level "failed to load" headline, message, or Retry button.
`src/router.tsx` sets `RouteErrorBoundary` as the router's
`defaultErrorComponent`, so a route without its own `errorComponent` (the home
page, generated pages under `_app`) never server-renders TanStack's built-in
error box; a route's own `errorComponent` still takes precedence.

## Page copy and navigation

Do not add a page-introduction subtitle that explains navigation or repeats the title.
`PageHeader.eyebrow` is only for a short workspace category (a few characters);
never put recipe codes, SKUs, paths, or other record metadata there — those
belong in the page's info `Card`. Detail sections use `Card title="…"` (tables
may set `flush` + `DataTable bare`), not a bare `<h2>` above the block.
Put actionable rules and risk beside the affected record/control. Role
summaries stay out of page content. Shell `defaultModules` starts empty; declare
real workspace routes through `defineNavigationModules`, using one unique href
per clickable leaf. Do not create an Overview module unless the product needs one.

## Product copy and language

The App shows its UI in the platform's language when the platform embeds it
(Builder preview, Launchpad, template preview), and in `APP_DEFAULT_LOCALE`
everywhere else. The page runtime sends the platform language; the App only
maps it (`resolveAppLocale`: same tag ignoring case, else the same primary
language such as `zh-tw` → `zh-CN`, else the default).

Write each page's copy as one table next to the page and read it while
rendering:

```tsx
import { defineCopy, type CopyMessage } from "@/lib/app-chrome";
import { useCopy, useLocale } from "@/lib/locale";

const copy = defineCopy({
  en: { title: "Work orders", name: "Name", nameMin: "At least {count} characters", create: "Create" },
  "zh-CN": { title: "工单", name: "名称", nameMin: "至少 {count} 个字符", create: "创建" },
});
type CopyKey = keyof (typeof copy)["en"];

function NewOrder() {
  const t = useCopy(copy);
  const locale = useLocale();
  const [name, setName] = useState("");
  const [error, setError] = useState<CopyMessage<CopyKey> | null>(null);
  const submit = () => {
    if (name.trim().length < 2) return setError({ key: "nameMin", params: { count: 2 } });
    // …
  };
  return (
    <FieldGroup
      label={t("name")}
      required
      error={error ? t(error.key, error.params) : undefined}
      helperText={new Date(dueAt).toLocaleDateString(locale)}
    >
      <Input value={name} onChange={(value) => setName(value)} placeholder={t("name")} />
    </FieldGroup>
  );
}
```

- `defineCopy` makes TypeScript report a key missing from any locale. Adding a
  language: add it to `APP_SUPPORTED_LOCALES`, then fill its column in
  `UI_COPY` and in every `defineCopy` table the type check lists.
- Shared primitives (`FormDialog`, `ConfirmDialog`, `AsyncView`, layouts) already
  localize their default labels; pass your own label from `t(...)` when the
  action needs a specific verb.
- A switch re-renders text in place: typed input, focus, scroll position and
  the URL stay. Keep that true: no `key` derived from the locale, no reload,
  no remounting providers, no `router.invalidate()` or navigation, and no
  translated strings in state (store `CopyMessage`). A toast already on screen
  keeps the language it was shown in.
- Do not read the platform language yourself or keep the locale in storage;
  `LocaleProvider` owns it. `getPlatformLanguage()` from
  `@tier0/sdk-v2/page-runtime` stays the platform's raw tag (`zh-cn`) for the
  rare case that needs it.

## Business tables

Hand-written `DataTable` / `<table>` cells keep header and body alignment the
same:

| Column kind | Alignment | Helper |
|---|---|---|
| Text / identity / material | left | `TableCellText` (`secondary` for codes) |
| Quantity / amount / range | right | `TableNumericHeader` + `TableNumericCell` |
| Status / actions / checkbox | left, content-width | `TableStatusCell` / `table-col-fit` |

All body cells use vertical `middle` (including status). Do not mix
`align-top` on badges with middle-aligned numbers in the same row. Give
quantity columns a bounded width (`w-28` / `w-44`) so a wide table does not
stretch a short number into the middle of empty space.

## Responsive layout

Wide tables own their horizontal scroll region. Interactive pages remain usable
at 375px without page-level overflow; station controls are touch-friendly and
monitor boards fit their intended viewport. `npm run build` checks known source
patterns through non-blocking `src/lib/responsive-contracts.test.mjs` advisories; it
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
  on the inner one, so the sideways scroll stays local instead of moving the page.

## Client-only rendering and modules

Use `ClientOnly` for Recharts, dnd-kit, motion layout, or browser-only render
paths. Recharts also needs a
non-zero container and `ResponsiveContainer`.

Keep `.tsx` component modules component-only for Fast Refresh; put runtime
constants/helpers in sibling `.ts` files. Import motion from `@/lib/motion`.
Use TailwindCSS 4 through `src/styles/globals.css`; do not add
`tailwind.config.js`, PostCSS wiring, or a second design system.

## Generic component kit

Before generating forms, tables or reusable editors, consult
[component-kit.md](component-kit.md) and reuse `src/components/kit`.
Keep business objects, services and roles in the application. Data-backed kit
components require an application-scoped `ComponentKitProvider`; logical resource
paths do not imply backend endpoints exist. Never import `gallery/fixtures.ts`
into an app. Preserve existing auth/permission guards and the scaffold theme;
enabled inputs use white surfaces, with gray fill reserved for disabled controls.

## Route files

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
An API-only subtree (parent and dynamic children declare `server` handlers and
no `component`) renders no page and is not required to have an index route.
