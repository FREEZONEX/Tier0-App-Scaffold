---
name: app-layout-patterns
description: Choose, create, or modify app layout shells for this TanStack Start MES scaffold based on workflow context and device environment, including workspace, station, review, monitor, PDA/handheld scanner, kiosk, wizard, dispatch, portal, and editor layouts. Use when adding pages, moving routes between layouts, creating custom layout route groups, deciding whether a page needs Shell navigation, or checking responsive behavior of layout frames. Layout selection is driven by usage scenario and device, not by user role.
---

# App Layout Patterns

Use this skill when choosing or creating layout shells in this scaffold.

Layout is an interaction contract. Choose it by workflow context, physical
device, environment, and navigation needs. Do not choose layout based on role
alone. Roles affect permissions, menu visibility, and default route; they do not
define the page frame.

## Read First

- `src/routes/_app.tsx`
- `src/routes/station.tsx`
- `src/routes/review.tsx`
- `src/routes/monitor.tsx`
- `src/components/Shell.tsx`
- `src/components/layouts/*.tsx`
- `DESIGN.md`
- `.agents/skills/uns-swe-ui-generation/SKILL.md`

If the page includes MES-specific visualizations, also use `$mes-ui-patterns`.
If the layout decision changes default role entry, also use
`$configurable-rbac-mes`.

## Selection Rule

Choose the layout by asking:

1. What is the primary job: navigate/manage, execute, decide, monitor, guide,
   or edit?
2. What device is used: desktop, tablet, PDA/handheld scanner, kiosk,
   wallboard, or large TV?
3. Does the workflow need persistent navigation, or should it remove navigation
   to reduce operator load?
4. Does the surface scroll, or must it fit a fixed viewport?

## Global Layout Invariants

- Every authenticated page must expose a visible logout action through its
  parent layout shell. Put the button in the layout, not in individual pages.
  Workspace uses the Shell sidebar/footer; station, review, monitor, and custom
  layouts use their header/status area. Icon-only is acceptable only when space
  is constrained and the control still has `aria-label`/`title`.
- Keep layout chrome consistent within one app. A single app must not mix pages
  with the workspace Shell sidebar and pages without the sidebar. Choose one
  app-level chrome: Shell sidebar for workspace apps, or a no-sidebar shell for
  station/review/monitor/custom apps.
- Sidebar module links must stay inside `_app.*` workspace routes. Do not add
  `/station`, `/review`, `/monitor`, or no-sidebar custom route targets to
  `defaultModules` in `src/components/Shell.tsx`.
- Workspace sidebar modules may use `badge`, `locked`, and `disabledReason`
  metadata for product state such as beta, upgrade required, unavailable, or
  read-only. Keep those states visible but quiet; locked items should explain
  why through `disabledReason` instead of silently navigating nowhere.
- Workspace sidebar chrome should show only the app name and navigation labels.
  Do not add an app-name subtitle, category heading, category subtitle, or
  generic labels such as "模块" / "Modules" above the navigation list.
- Setup-only workspace pages such as system configuration, role/permission
  setup, integration settings, tenant settings, and audit settings must be
  nested as second-level sidebar items under an appropriate parent. Do not make
  "系统配置", "System Configuration", or "Settings" a first-level sidebar module
  unless the entire app is specifically a configuration console.
- If a workflow genuinely needs a different chrome, split it into a separate
  app/entry surface or implement it inside the current app's chosen chrome. Do
  not put Shell and no-Shell pages in the same app.
- Role default routes must also respect the app-level chrome. Do not make one
  role land in `_app` with a sidebar while another role lands in `/station`,
  `/review`, `/monitor`, or another no-sidebar layout within the same app.

## Layout Matrix

| Layout | Route group | Use when | Device posture | Navigation |
|---|---|---|---|---|
| Workspace | `_app.*` | planning, admin, analytics, master data, multi-module operations | desktop/laptop/tablet | Shell sidebar |
| Station | `station.*` | scan/tap/confirm, production reporting, receiving, picking, point inspection | workstation, tablet, PDA/handheld scanner, kiosk | no sidebar |
| Review | `review.*` | queue + evidence + decision, approval, disposition, quality review | desktop/tablet | no sidebar by default |
| Monitor | `monitor.*` | passive wallboard, andon, live production TV, fixed operational display | wallboard/TV/large screen | no navigation, no page scroll |
| Custom | `<intent>.*` | wizard, dispatch, editor, portal, kiosk queue, canvas, unusual interaction model | depends on intent | minimal shell |

## Built-In Layouts

### Workspace

Use `_app.*` when users need persistent module navigation and repeated data
management. Only workspace pages should update `defaultModules` in
`src/components/Shell.tsx`.

Do not put station, review, monitor, or other no-sidebar task flows in the
sidebar. In a workspace app, convert those workflows into workspace pages or
extract them into a separate app. Do not jump from the sidebar Shell into a
no-sidebar layout.

System configuration, role/permission setup, integration settings, tenant
settings, audit settings, and similar setup-only pages belong under a sidebar
parent as second-level items. They should not occupy first-level navigation in
a normal MES workspace app.

### Station

Use `station.*` for task-first physical execution. Minimize fields, tables, and
navigation. Use 44-48px controls for scan/tap/confirm paths. The user should be
able to complete the next physical action without reading a dashboard.
Station layouts must include a visible logout action in the header/status area.

### PDA / Handheld Scanner

Treat PDA and handheld scanner workflows as Station unless the requirement is
clearly read-only lookup or a specialized custom flow. Design portrait-first for
roughly 360-480 CSS px wide screens.

Rules:

- Use one primary scan/input path and one dominant next action.
- Treat PDA as a special device profile, not a generic mobile breakpoint.
- Assume portrait orientation first; landscape PDA is a secondary check.
- Use larger operational text than desktop: `text-base` for labels,
  `text-lg` for scan values/current task, and `text-xl` to `text-2xl` for the
  most important quantity/status.
- Keep controls 44-48px high and easy to tap with gloves.
- Keep scanner input visible, focusable, and recoverable after submit/error.
- Provide manual entry fallback for damaged labels.
- Avoid sidebars, dense tables, multi-column forms, and dashboard summaries.
- Convert lists to compact cards with ID, state, quantity, and next action.
- Prefer sticky bottom actions only when they do not cover keyboard or scanner
  feedback.

### Review

Use `review.*` for evidence-first decisions. Expose queue state, record
evidence, reason capture, and decision actions. Avoid making this a generic
workspace dashboard.
Review layouts must include a visible logout action in the header/status area.

### Monitor

Use `monitor.*` for fixed, passive displays. Monitor is a wallboard/TV device
profile, not a desktop monitor. Fit the target viewport, avoid page-level
scrolling, use stable grid tracks, and keep text within bounds. Do not add
forms, sidebar navigation, drawers, or dense tables that require interaction.
Monitor layouts must still expose a visible logout action, usually compact in
the status header.

Rules:

- Design for distance reading and glanceability.
- Use `monitor-frame`, `monitor-stage`, `monitor-grid`, `monitor-panel`,
  `monitor-kpi`, `monitor-title`, `monitor-text`, `monitor-label`, and
  `monitor-fit-text` utilities.
- Use large status blocks, large numerals, short labels, and high-signal
  semantic color.
- Use fixed board composition, usually 16:9. Do not optimize it like a desktop
  CRUD page.
- Avoid pointer-only interactions, hover-only controls, text-heavy tables,
  small captions, dialogs, forms, and scroll-dependent content.
- If a ticker or live event list is needed, bound its overflow inside one
  panel instead of scrolling the page.

### Custom

Create a custom prefixed route group when none of the built-ins fits. Examples:
`wizard`, `dispatch`, `portal`, `editor`, `kiosk`, `canvas`.

Rules:

- Add `src/routes/<intent>.tsx`.
- Add `src/components/layouts/<Intent>Layout.tsx`.
- Reuse the authenticated `beforeLoad` pattern unless intentionally public.
- Keep the layout shell minimal: global frame, identity/status area, and
  content slot only.
- Do not create empty pathless layouts; they can conflict with `/`.

## Snippets

Use the demo script to print starter snippets:

```bash
python3 .agents/skills/app-layout-patterns/scripts/demo_layout_snippets.py list
python3 .agents/skills/app-layout-patterns/scripts/demo_layout_snippets.py authenticated-route
python3 .agents/skills/app-layout-patterns/scripts/demo_layout_snippets.py station-layout
python3 .agents/skills/app-layout-patterns/scripts/demo_layout_snippets.py pda-scan-page
python3 .agents/skills/app-layout-patterns/scripts/demo_layout_snippets.py monitor-layout
python3 .agents/skills/app-layout-patterns/scripts/demo_layout_snippets.py monitor-board-page
```

Adapt names, titles, icons, copy, and route prefixes to the current app. Do not
paste snippets blindly.

## Responsive Guidance

Read `references/responsive-layout-checklist.md` before finalizing a new layout
or major page.

Short version:

- Workspace, station, review, and interactive custom layouts need a scrollable
  main region with `min-h-0`.
- Monitor layouts are the exception: fixed viewport, `overflow-hidden`, no page
  scroll.
- PDA/scanner pages are portrait-first special surfaces: validate 360-480px
  width, larger text, scanner focus recovery, and 44-48px controls.
- Validate at 375px, 768px, and desktop for general interactive pages.
- Validate monitor pages at their intended fixed viewport.
- Avoid hiding critical actions on mobile.
- Use stable dimensions for toolbars, headers, boards, counters, and tiles.

## Responsive Skill Decision

Do not add a separate responsive-design skill for normal app generation yet.
Responsive rules are cross-cutting and belong in this layout skill plus
`$uns-swe-ui-generation`. Create a separate responsive verification skill only
if the team repeatedly asks for dedicated viewport audits, screenshot QA, or
browser-based layout regression checks.
