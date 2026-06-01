---
name: uns-swe-ui-generation
description: Generate or modify frontend UI for UNS-SWE apps in this scaffold using TailwindCSS, Tier0 design tokens, compact app-local React components, TanStack Start routing, Sonner toasts, Recharts, TanStack Table, dnd-kit, and lucide-react. Use when building dashboards, CRUD pages, forms, tables, charts, dialogs, drawers, responsive shells, empty states, or interaction-heavy manufacturing app screens. This skill replaces shadcn-style component-library guidance; do not use shadcn CLI or components.json. For layout route selection and shells, use $app-layout-patterns. For MES visualization patterns, use $mes-ui-patterns snippets instead of copying @/components/mes.
---

# UNS-SWE UI Generation

## Purpose

Build production-quality app UI without a bundled component library. Treat the current product requirements and `DESIGN.md` as the source of truth, then compose small React components with Tailwind utilities and the Tier0 tokens in `src/styles/globals.css`.

Default visual bias: compact Tier0 enterprise surfaces, like the refined
Gantt/MES examples. Prefer crisp borders, 4px radius, near-black primary
actions, signal-green highlight actions/states, off-white control fills, and
flat panels over larger rounded cards or heavy shadows. The canonical color
tokens in `src/styles/globals.css` are aligned with the support Gantt scaffold:
near-black `#050b14` primary, white/near-white page surfaces, `#f9f9f9` inset
controls, `#dcdcdc` borders, and Tier0 green `#cef368` / `#e7f9b9` highlights.

## Ground Rules

- Do not run `npx shadcn` or add `components.json`.
- Do not copy a bundled `@/components/mes` library into the scaffold. When MES-specific visualizations are useful, use `$mes-ui-patterns` and create only the app-local snippets needed for the current workflow.
- When choosing or creating a layout shell, use `$app-layout-patterns`. Layout selection is based on workflow and device, not role.
- Small app-local primitives are allowed when repetition is real, for example `src/components/<domain>/button.tsx`, `panel.tsx`, or `status-pill.tsx`. Keep them local to the app/domain instead of recreating a generic component library.
- The support Gantt `components/ui` files are compact app-local wrappers, not a Base UI component system to copy wholesale. If using Base UI-style primitives for selects, menus, popovers, or dialogs in a generated app, style the trigger/content with the same recipes below and remember Base UI conventions: `render` instead of `asChild`, two-argument callbacks, and `data-active` for active states.
- Keep components app-specific. Put reusable pieces under `src/components/<domain>/`; keep one-off pieces next to the route that owns them.
- Use `cn()` from `@/lib/utils` for conditional classes.
- Use `apiUrl()` from `@/lib/utils` for all browser fetches to app APIs.
- Use `toast()`, `toast.success()`, and `toast.error()` from `sonner` for mutation feedback. The root already mounts `@/components/toaster`.
- Use `Dialog`, `FormDialog`, `ConfirmDialog`, and `Drawer` from `@/components/overlays` for common overlay flows.
- Use `@/components/client-only` around Recharts, dnd-kit, motion layout features, and browser-only render paths.
- Use lucide-react icons for recognizable actions and status. Keep icons at 16-20px unless the surrounding layout requires otherwise.

## Workflow

1. Read `DESIGN.md`, the target route/component, available layout routes (`_app`, `station`, `review`, `monitor`), `$app-layout-patterns`, and relevant helpers before editing UI.
2. Classify each workflow into a layout intent using `$app-layout-patterns` and the rules below. Do this automatically from the requirements; do not ask the user to choose a layout.
3. Identify the primary workflow: create, review, execute, approve, analyze, or recover.
4. Choose a page pattern that fits the workflow: dense table, split view, board, timeline, chart panel, metric strip, drawer, modal, scan flow, or decision queue.
5. Ensure `/` is owned by the selected app experience: workspace apps may replace `_app.index.tsx`; station, review, monitor, kiosk, or other custom apps must replace `_app.index.tsx` with a redirect to the correct entry route or move the entry to `/` without the sidebar.
6. Implement real states: loading, empty with create action, success, validation errors, API errors, and disabled/pending controls.
7. Make the page responsive by device profile, not only by desktop/tablet/mobile breakpoints. PDA/handheld scanner pages must work portrait-first at 360-480px with larger operational text and 44-48px controls. Monitor pages must fit their intended wallboard/TV viewport with monitor-specific sizing and no page scroll. General interactive pages still need 375px, 768px, and desktop checks.
8. Replace all default scaffold branding and placeholder titles with domain-specific app copy. Do not leave generic visible titles such as "Application", "Home", "Ready", "Workspace Home", or "Industrial application scaffold" in the finished app unless explicitly requested.
9. Remove visible design-system commentary from product UI. Never render copy such as "FX green only for key states", "Tier0 signal green", color token explanations, layout guidance, component usage notes, or implementation hints on product pages.
10. Check for placeholder copy, disconnected buttons, unused imports, text overlap, and zero-height chart containers.
11. Run available lint/build checks, or explain why they could not run.

## Layout Selection

Choose route groups by workflow intent, not by personal preference or visual style. Layouts are interaction contracts, not page templates. Prefer the built-in layouts below, but create a new layout intent when none fits the workflow.

For reusable layout route snippets and responsive frame checks, use
`$app-layout-patterns`. This section only summarizes the UI impact.

### Station Layout — `src/routes/station.*`

Use for high-frequency, task-first shop-floor or warehouse execution. Prefer this when the requirements mention operators, warehouse workers, line workers, stations, PDA/handheld scanner, tablet, kiosk, scanning, tapping, receiving, picking, putaway, issuing material, staging, loading, production reporting, start/stop/pause, point inspection, or simple confirmation.

Station UI should minimize navigation, fields, and tables. Emphasize current task, scan/manual entry, clear feedback, exception handling, and one or two large primary actions. Use larger operational type, 44-48px touch targets, wide tap areas, and low visual noise so the operator can act quickly in a factory or warehouse setting.

For PDA/handheld scanner flows, design portrait-first around 360-480 CSS px. This is a special industrial device profile, not ordinary mobile. Use a single-column task path, larger operational text (`text-base` labels, `text-lg` current task/scan value, `text-xl` to `text-2xl` dominant quantity/status), 44-48px controls, visible/refocusable scanner input, manual entry fallback, compact action cards instead of tables, and no sidebar or multi-column form.

### Review Layout — `src/routes/review.*`

Use for queue + evidence + decision workflows. Prefer this when the requirements mention quality review, exception review, nonconformance disposition, holds, deviations, supervisor approval, batch release, reject/rework decisions, or audit-style adjudication.

Review UI should expose the queue, the evidence needed to decide, decision actions, reason capture, and handoff status. It should not default to a generic admin dashboard. Use readable evidence panels, sticky or repeated decision actions where helpful, and clear state labels paired with icons.

### Workspace Layout — `src/routes/_app.*`

Use for multi-module, supervisory, planning, analytics, configuration, master data, and administrative workflows. This layout inherits the sidebar Shell and is appropriate when users need persistent navigation across several modules or datasets. Keep it compact enough for repeated use, but avoid cramped text, harsh borders, or black-white slabs.

Only add entries to `defaultModules` in `src/components/Shell.tsx` for workspace pages. Do not add station or review task pages to the sidebar unless the product explicitly needs cross-module navigation to those flows.

Workspace sidebar should remain collapsible on desktop. Use simple 150-250ms width/opacity transitions, keep collapsed labels accessible through `aria-label` or `title`, and use dark foreground text/icons on green active backgrounds.

### Monitor Layout — `src/routes/monitor.*`

Use for passive wallboards, andon displays, live production TVs, or fixed large-screen operational displays. Monitor is a wallboard/TV profile, not a normal desktop monitor. Pages should have no sidebar, no forms, no drawer-driven workflows, and no page-level scroll. Use `monitor-frame`, `monitor-stage`, `monitor-grid`, `monitor-panel`, `monitor-kpi`, `monitor-title`, `monitor-text`, `monitor-label`, and `monitor-fit-text` utilities. Build large status blocks, glanceable KPIs, short labels, and bounded live tickers/logs that remain readable from distance.

### Custom Layouts

Create a new layout route when the app needs a distinct interaction model that is not workspace, station, review, or monitor. Examples: guided wizard, public read-only portal, canvas/editor, kiosk queue, or multi-person dispatch.

Rules for custom layouts:

- Name the route group by intent, such as `monitor`, `wizard`, `portal`, `editor`, or `dispatch`.
- Add a matching shell under `src/components/layouts/<Intent>Layout.tsx`.
- Reuse the authenticated `beforeLoad` pattern from `_app`, `station`, or `review` unless the route is intentionally public.
- Keep the layout shell minimal: global structure, session/status area, and slots for content. Do not bake in business-specific cards, charts, forms, or sample data.
- Do not create an empty pathless layout route without child pages; TanStack will treat it as `/` and conflict with the home route. Use a prefixed layout route when the scaffold ships the layout before child pages exist.
- Document the selection rule briefly in the code comment and update this skill only if the new layout should become a reusable scaffold pattern.
- If the custom layout is the main app experience, replace the default `/` workspace starter with a redirect or matching root entry. Do not leave the sidebar workspace starter reachable as the home page.

### Default Priority

- Scan/tap/confirm or shop-floor execution language wins over tables: choose Station.
- PDA/handheld scanner language strongly chooses Station, unless the app is explicitly read-only lookup or a specialized custom handheld flow.
- Review/approval/exception disposition language wins over dashboards: choose Review.
- Passive wallboard, andon, TV, and fixed large-screen language chooses Monitor. Do not implement it as a desktop dashboard.
- Planning/admin/analytics/configuration/multi-module language chooses Workspace.
- If none of the built-ins fits the interaction model, create a custom layout intent instead of forcing the page into `_app`.
- For non-workspace single-purpose apps, `/` must land in that experience, not in `_app` sidebar.
- If a single app contains multiple workflows, use multiple route groups and link between them intentionally.

## Layout Overflow

- Workspace, station, review, and interactive custom layouts must keep their primary content region vertically scrollable.
- Monitor layouts are the only fixed, non-scrolling viewport surfaces. Constrain overflow inside individual monitor panels only when the content is intentionally bounded, such as a ticker or live event strip.
- In full-height flex shells, pair the scrollable main region with `min-h-0` so overflow becomes scroll instead of clipped content.

## UI Patterns

### Buttons

- Use compact control sizing by default: `h-9 px-3.5 text-sm rounded-sm`.
  Use `h-8 px-3 text-xs` for dense toolbars and `h-10` to `h-12` for station
  touch actions.
- Preferred variants:
  - `primary`: near-black `bg-button-primary` / `var(--tier0-primary)` with white text.
  - `highlight`: signal-green `bg-button-highlight` for the main optimistic action in a local decision area.
  - `secondary`: quiet filled surface, usually `bg-surface-inset`.
  - `outline`: bordered white/background action.
  - `ghost`: transparent toolbar or icon action.
- Primary destructive/business actions should be visually distinct and close to the affected area.
- Prefer icon-only buttons for toolbar actions when the icon is familiar; add accessible `aria-label`.
- Use compact text buttons for row-level actions and clear text buttons for irreversible commands.
- Disable submit buttons while pending and keep the label stable.

### Forms

- Use labels, validation messages, and semantic grouping for every input.
- Prefer button-triggered `FormDialog` or `Drawer` for master data, workstation configuration, material, equipment, route, process-parameter, and other CRUD create/edit forms. Do not permanently flatten all maintenance forms on a page.
- Keep inline forms only for the current station task, filters, quick scan/manual entry, required review reason capture, or genuinely always-visible controls.
- Validate before sending, then surface server validation errors with `toast.error()` and inline messages where useful.
- Use `h-9 rounded-sm border border-input bg-surface-inset px-3 text-sm` for default workspace inputs and selects. `bg-surface-inset` maps to the support Gantt inset control fill `#f9f9f9`. Focus should move the border/ring to Tier0 signal green via `focus:border-highlight` or `focus:ring-highlight/20`.
- Keep form controls at stable heights, usually 36px in dense workspace screens and 40px when readability needs more air. Use 44-48px controls for station, kiosk, PDA, and scan/tap flows. Use `min-w-0`, `truncate`, and explicit grid columns to avoid overflow.
- On create/edit success, update local data or refetch, close transient UI only after the mutation succeeds, and show `toast.success()`.

### Tables And Lists

- Use TanStack React Table for sortable/filterable/paginated operational tables.
- Keep dense tables readable: sticky or persistent headers where useful, compact rows, explicit truncation, and quiet row actions.
- On mobile, reduce columns to the identifiers and state needed for action; move secondary detail into expandable rows or drawers.
- Empty states must provide the next meaningful action, not describe future functionality.

### Charts

- Use Recharts only inside `ClientOnly`.
- Wrap charts in containers with explicit height, then use `<ResponsiveContainer width="100%" height="100%">`.
- Show units, time range, and thresholds directly in labels or legends. Avoid decorative charts with no decision value.

### Overlays

- Dialogs are for short blocking decisions. Drawers are for record detail, edit flows, or related activity.
- Use `FormDialog` for common create/edit forms launched from toolbar, table row, empty state, or station action buttons.
- Use `ConfirmDialog` for irreversible operations and state transitions. Name the affected record and consequence.
- Use `Drawer` for longer record detail, multi-section edit, audit trail, or side-by-side table/detail work.
- Always provide a title, close control, cancel path, pending state, and keyboard-safe focus order.
- Keep destructive confirmation copy specific: name the record and consequence.
- Do not use dialogs/drawers on monitor pages; monitor is a passive wallboard/TV profile.

## Visual Rules

- Use the 4px grid. Common gaps are `gap-2`, `gap-3`, and `gap-4`; common padding is `p-3`, `p-4`, or `p-5`.
- Match density to the user's situation: workspace can be compact, station should be touch-friendly, review should favor readable evidence and decision clarity.
- Cards and panels use borders first, shadows only for overlays. The preferred app panel is `rounded-sm border border-border bg-card p-4`.
- Default radius stays small and precise: prefer `rounded-sm` for controls, badges, panels, and table rows. Use `rounded-md` only for larger shells or existing scaffold layout consistency.
- Use white panels on off-white or soft neutral canvas. Inputs and secondary controls should sit on `bg-surface-inset`; headers and panels usually use `bg-card`.
- Use near-black or neutral-900 only for primary actions and text hierarchy. Do not make large page areas pure black.
- Tier0 signal green is for active, selected, progress, and optimistic states. Do not use it as a page background.
- Use semantic status tokens and pair color with icon/text. Do not rely on color alone.
- Avoid decorative gradients, blobs, glass effects, oversized hero sections, harsh high-contrast palettes, and marketing-style composition for MES workspaces.
- Do not expose design-system annotations as product copy. Labels like "FX green only for key states", "Tier0 signal green", token names, component guidance, or layout rules belong in docs and code comments only.

### Compact Tier0 Recipes

Use these recipes when creating app-local primitives:

```tsx
const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";
const buttonVariants = {
  primary: "border border-[var(--tier0-primary)] bg-button-primary text-primary-foreground hover:bg-[var(--tier0-primary-hover)]",
  highlight: "border border-highlight-bg-primary bg-button-highlight text-accent-foreground hover:bg-highlight-bg-accent",
  secondary: "border border-border bg-surface-inset text-foreground hover:bg-background",
  outline: "border border-border bg-background text-foreground hover:bg-surface-inset",
  ghost: "border border-transparent bg-transparent text-muted-foreground hover:bg-surface-inset hover:text-foreground",
};
const control = "h-9 rounded-sm border border-input bg-surface-inset px-3 text-sm outline-none transition focus:border-highlight";
const panel = "rounded-sm border border-border bg-card p-4";
const badge = "inline-flex items-center rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.03em]";
```

## TanStack Start Notes

- This is not Next.js. Use `@tanstack/react-router` `Link`, `useNavigate`, `Route.useParams()`, and `Route.useSearch()`.
- Pages SSR by default. Guard browser-only code with `useEffect` or `ClientOnly`.
- Do not import `next/*`, do not use App Router conventions, and do not add `"use client"` as a boundary mechanism.
