---
name: uns-swe-ui-generation
description: Generate or modify frontend UI for UNS-SWE apps in this scaffold using TailwindCSS, Tier0 design tokens, app-local React components, TanStack Start routing, Sonner toasts, Recharts, TanStack Table, dnd-kit, and lucide-react. Use when building dashboards, CRUD pages, forms, tables, charts, dialogs, drawers, responsive shells, empty states, or interaction-heavy manufacturing app screens. This skill replaces shadcn-style component-library guidance; do not use shadcn CLI, components.json, @/components/ui, or @/components/mes.
---

# UNS-SWE UI Generation

## Purpose

Build production-quality app UI without a bundled component library. Treat the current product requirements and `DESIGN.md` as the source of truth, then compose small React components with Tailwind utilities and the Tier0 tokens in `src/styles/globals.css`.

## Ground Rules

- Do not run `npx shadcn`, add `components.json`, or import from `@/components/ui` or `@/components/mes`.
- Keep components app-specific. Put reusable pieces under `src/components/<domain>/`; keep one-off pieces next to the route that owns them.
- Use `cn()` from `@/lib/utils` for conditional classes.
- Use `apiUrl()` from `@/lib/utils` for all browser fetches to app APIs.
- Use `toast()`, `toast.success()`, and `toast.error()` from `sonner` for mutation feedback. The root already mounts `@/components/toaster`.
- Use `@/components/client-only` around Recharts, dnd-kit, motion layout features, and browser-only render paths.
- Use lucide-react icons for recognizable actions and status. Keep icons at 16-20px unless the surrounding layout requires otherwise.

## Workflow

1. Read `DESIGN.md`, the target route/component, available layout routes (`_app`, `station`, `review`), and relevant helpers before editing UI.
2. Classify each workflow into a layout intent using the rules below. Do this automatically from the requirements; do not ask the user to choose a layout.
3. Identify the primary workflow: create, review, execute, approve, analyze, or recover.
4. Choose a page pattern that fits the workflow: dense table, split view, board, timeline, chart panel, metric strip, drawer, modal, scan flow, or decision queue.
5. Ensure `/` is owned by the selected app experience: workspace apps may replace `_app.index.tsx`; station, review, monitor, kiosk, or other custom apps must replace `_app.index.tsx` with a redirect to the correct entry route or move the entry to `/` without the sidebar.
6. Implement real states: loading, empty with create action, success, validation errors, API errors, and disabled/pending controls.
7. Make the page responsive at 375px, 768px, and desktop widths. Avoid hidden critical actions on mobile.
8. Replace all default scaffold branding and placeholder titles with domain-specific app copy. Do not leave generic visible titles such as "Application", "Home", "Ready", "Workspace Home", or "Industrial application scaffold" in the finished app unless explicitly requested.
9. Check for placeholder copy, disconnected buttons, unused imports, text overlap, and zero-height chart containers.
10. Run available lint/build checks, or explain why they could not run.

## Layout Selection

Choose route groups by workflow intent, not by personal preference or visual style. Layouts are interaction contracts, not page templates. Prefer the built-in layouts below, but create a new layout intent when none fits the workflow.

### Station Layout — `src/routes/station.*`

Use for high-frequency, task-first shop-floor or warehouse execution. Prefer this when the requirements mention operators, warehouse workers, line workers, stations, PDA/tablet/kiosk, scanning, tapping, receiving, picking, putaway, issuing material, staging, loading, production reporting, start/stop/pause, point inspection, or simple confirmation.

Station UI should minimize navigation, fields, and tables. Emphasize current task, scan/manual entry, clear feedback, exception handling, and one or two large primary actions. Use larger operational type, 44-48px touch targets, wide tap areas, and low visual noise so the operator can act quickly in a factory or warehouse setting.

### Review Layout — `src/routes/review.*`

Use for queue + evidence + decision workflows. Prefer this when the requirements mention quality review, exception review, nonconformance disposition, holds, deviations, supervisor approval, batch release, reject/rework decisions, or audit-style adjudication.

Review UI should expose the queue, the evidence needed to decide, decision actions, reason capture, and handoff status. It should not default to a generic admin dashboard. Use readable evidence panels, sticky or repeated decision actions where helpful, and clear state labels paired with icons.

### Workspace Layout — `src/routes/_app.*`

Use for multi-module, supervisory, planning, analytics, configuration, master data, and administrative workflows. This layout inherits the sidebar Shell and is appropriate when users need persistent navigation across several modules or datasets. Keep it compact enough for repeated use, but avoid cramped text, harsh borders, or black-white slabs.

Only add entries to `defaultModules` in `src/components/Shell.tsx` for workspace pages. Do not add station or review task pages to the sidebar unless the product explicitly needs cross-module navigation to those flows.

### Custom Layouts

Create a new layout route when the app needs a distinct interaction model that is not workspace, station, or review. Examples: wallboard/andon monitoring, guided wizard, public read-only portal, canvas/editor, kiosk queue, or multi-person dispatch.

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
- Review/approval/exception disposition language wins over dashboards: choose Review.
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

- Primary destructive/business actions should be visually distinct and close to the affected area.
- Prefer icon-only buttons for toolbar actions when the icon is familiar; add accessible `aria-label`.
- Use compact text buttons for row-level actions and clear text buttons for irreversible commands.
- Disable submit buttons while pending and keep the label stable.

### Forms

- Use labels, validation messages, and semantic grouping for every input.
- Validate before sending, then surface server validation errors with `toast.error()` and inline messages where useful.
- Keep form controls at stable heights, usually 40px. Use 44-48px controls for station, kiosk, PDA, and scan/tap flows. Use `min-w-0`, `truncate`, and explicit grid columns to avoid overflow.
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
- Always provide a title, close control, cancel path, pending state, and keyboard-safe focus order.
- Keep destructive confirmation copy specific: name the record and consequence.

## Visual Rules

- Use the 4px grid. Common gaps are `gap-2`, `gap-3`, and `gap-4`; common padding is `p-3`, `p-4`, or `p-5`.
- Match density to the user's situation: workspace can be compact, station should be touch-friendly, review should favor readable evidence and decision clarity.
- Cards and panels use borders first, shadows only for overlays.
- Default radius stays small: `rounded-sm` or `rounded-md`.
- Use raised white panels on soft neutral canvas. Avoid pure black on pure white as the dominant reading surface.
- Tier0 signal green is for active, selected, progress, and optimistic states. Do not use it as a page background.
- Use semantic status tokens and pair color with icon/text. Do not rely on color alone.
- Avoid decorative gradients, blobs, glass effects, oversized hero sections, harsh high-contrast palettes, and marketing-style composition for MES workspaces.

## TanStack Start Notes

- This is not Next.js. Use `@tanstack/react-router` `Link`, `useNavigate`, `Route.useParams()`, and `Route.useSearch()`.
- Pages SSR by default. Guard browser-only code with `useEffect` or `ClientOnly`.
- Do not import `next/*`, do not use App Router conventions, and do not add `"use client"` as a boundary mechanism.
