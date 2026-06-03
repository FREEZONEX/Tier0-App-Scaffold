---
version: alpha
name: Tier0-design-system
description: "A readable enterprise product design system for Tier0: calm operational surfaces, neutral gray primary actions, softened signal green for active/selected/progress states, and layout density chosen by workflow context. Interfaces should feel technical, usable under real factory conditions, and product-focused, with hierarchy from typography, spacing, borders, and stable layout rhythm rather than harsh contrast or decoration."

colors:
  primary: "#050b14"
  primary-hover: "#1c1f1e"
  on-primary: "#ffffff"
  highlight: "#b2ed1d"
  highlight-foreground: "#050b14"
  highlight-text: "#a2db1a"
  highlight-deep: "#73b200"
  highlight-bg-primary: "#cef368"
  highlight-bg-accent: "#e7f9b9"
  ink: "#050b14"
  ink-secondary: "#242424"
  ink-tertiary: "#878787"
  ink-placeholder: "#d9d9d9"
  canvas: "#ffffff"
  canvas-raised: "#ffffff"
  canvas-offwhite: "#fcfcfc"
  surface-1: "#f9f9f9"
  surface-2: "#f3f3f3"
  surface-3: "#e3e3e3"
  hairline: "#dcdcdc"
  hairline-subtle: "#e8e8e8"
  semantic-success: "#166534"
  semantic-success-soft: "#dcfce7"
  semantic-error: "#b91c1c"
  semantic-error-soft: "#fee2e2"
  semantic-warning: "#9a3412"
  semantic-warning-soft: "#ffedd5"
  semantic-info: "#1d4ed8"
  semantic-info-soft: "#dbeafe"

typography:
  display:
    fontFamily: System UI
    fontSize: 34px
    fontWeight: 700
    lineHeight: 42px
    letterSpacing: 0
  heading-lg:
    fontFamily: System UI
    fontSize: 28px
    fontWeight: 600
    lineHeight: 36px
    letterSpacing: 0
  heading-md:
    fontFamily: System UI
    fontSize: 22px
    fontWeight: 600
    lineHeight: 30px
    letterSpacing: 0
  heading-sm:
    fontFamily: System UI
    fontSize: 18px
    fontWeight: 500
    lineHeight: 26px
    letterSpacing: 0
  body:
    fontFamily: System UI
    fontSize: 14px
    fontWeight: 400
    lineHeight: 22px
    letterSpacing: 0
  body-lg:
    fontFamily: System UI
    fontSize: 16px
    fontWeight: 400
    lineHeight: 26px
    letterSpacing: 0
  label:
    fontFamily: System UI
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0
  caption:
    fontFamily: System UI
    fontSize: 12px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0
  mono:
    fontFamily: IBM Plex Mono
    fontSize: 12px
    fontWeight: 400
    lineHeight: 18px
    letterSpacing: 0

rounded:
  none: 0px
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  pill: 9999px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 24px
  xxl: 32px
  section: 48px

components:
  button-highlight:
    backgroundColor: "{colors.highlight-bg-primary}"
    textColor: "{colors.highlight-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: 40px
    padding: 0 16px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: 40px
    padding: 0 16px
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-secondary}"
    borderColor: "{colors.hairline}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: 40px
    padding: 0 16px
  button-outline:
    backgroundColor: "{colors.canvas-raised}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: 40px
    padding: 0 16px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: 40px
    padding: 0 12px
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    focusColor: "{colors.highlight}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    minHeight: 40px
    padding: 0 12px
  dialog:
    backgroundColor: "{colors.canvas-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 32px
  panel:
    backgroundColor: "{colors.canvas-raised}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: 16px
  table:
    backgroundColor: "{colors.canvas-raised}"
    textColor: "{colors.ink}"
    headerTextColor: "{colors.ink-tertiary}"
    borderColor: "{colors.hairline}"
    hoverBackgroundColor: "{colors.surface-1}"
    selectedBackgroundColor: "{colors.surface-2}"
    rounded: "{rounded.sm}"
  tag-neutral:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.sm}"
  tag-highlight:
    backgroundColor: "{colors.highlight-bg-accent}"
    textColor: "{colors.highlight-foreground}"
    borderColor: "{colors.highlight-bg-primary}"
    rounded: "{rounded.sm}"

motion:
  fast: 150ms ease
  normal: 200ms ease
  slow: 500ms ease
---

# Tier0 Frontend Design Guidelines

`DESIGN.md` is the agent-readable design context for Tier0. Use the YAML tokens above for machine-readable defaults, then use the guidance below when building or changing pages, dialogs, forms, tables, dashboards, and shared components.

## Design Direction

Tier0 should feel precise, technical, and product-focused while staying readable for long shifts, tablets, shared terminals, and shop-floor lighting. It can borrow disciplined enterprise structure, but the visual language must remain Tier0's own:

- Neutral workspace surfaces: soft canvas, raised white panels, light grey insets, and readable neutral gray text.
- Neutral gray primary actions for core product decisions.
- Tier0 signal green for emphasis, selected states, progress, active states, and optimistic product moments.
- Density chosen by workflow: compact for management workspaces, larger and calmer for station execution, evidence-first for review.
- Clear hierarchy through typography, border, background layering, and layout rhythm.

Do not use IBM Blue as the default primary color. Do not turn the product into a Carbon clone.

## Source Of Truth

Use project tokens before introducing local styling.

- Theme entry and Tailwind mappings: `src/styles/globals.css`
- Runtime class helpers: `src/lib/utils.ts`
- App shell: `src/components/Shell.tsx`
- App-specific generated components: `src/components/<domain>/`

Prefer semantic variables such as `--tier0-bg-color`, `--tier0-text-color`, `--tier0-highlight`, and Tailwind aliases such as `bg-bg`, `text-text`, `border-border`, `bg-highlight-bg-accent`, `text-highlight-text`, `bg-button-primary`, and `bg-button-highlight`.

## Color Rules

Use the YAML color roles instead of arbitrary hex values. Tier0 signal green should call attention to active product state, build/progress, selection, or success-adjacent emphasis. It should not flood every card, section, icon, or page background.

Avoid pure black on pure white as the dominant reading surface. Use raised white cards on soft canvas, neutral gray text for hierarchy, and borders for separation. High urgency still belongs in semantic status tokens, not in the global palette.

Use semantic status tokens for status UI:

- Success: `--tier0-success-color`, `--tier0-success-tertiary`
- Error: `--tier0-error-color`, `--tier0-error-tertiary`
- Warning: `--tier0-warning-color`, `--tier0-warning-tertiary`
- Info/updating: `--tier0-blue-color`, `--tier0-blue-tertiary`

## Typography

The default product UI font is the system UI stack via `--font-app-sans`, chosen for platform-native readability and reliable rendering. Use the same stack via `--font-display-sans` for larger headings, and IBM Plex Mono via `--font-geist-mono` for code, IDs, compact technical metadata, and token previews.

Use existing utilities from `src/styles/globals.css`:

- Page display: `typo-h1`
- Section heading: `typo-h2`
- Subsection heading: `typo-h3`
- Panel heading: `typo-h4`
- Body: `text-sm` or `text-base`
- Caption: `.caption` or `text-xs`
- Mono/code: `font-mono`

For new component-local typography, keep letter spacing neutral.

## Product Copy

Visible app copy should describe the user's work, data, action, state, or consequence. Do not render design-system commentary as product UI. Copy such as "FX green only for key states", "Tier0 signal green", color-token explanations, layout guidance, component usage notes, and implementation hints belongs in docs or code comments only.

## Layout

Most Tier0 pages are operational product surfaces, not marketing pages. Select the layout intent before designing the page:

- Workspace: persistent navigation for management, planning, analytics, configuration, and multi-module supervision.
- Station: full-screen task execution for scan, tap, confirm, report, and exception capture flows.
- Review: queue, evidence, and decision workflows for quality, approvals, holds, and nonconformance disposition.
- Monitor: passive wallboards, andon boards, TV displays, and fixed large screens for glanceable operational state. Monitor layouts have no sidebar, no drawer navigation, and no page-level vertical scrolling.
- Custom: create a new minimal shell when the interaction model is distinct, such as guided wizards, public portals, editors, dispatch consoles, or kiosk queues.

Workspace, station, review, and interactive custom layouts must keep their primary content region vertically scrollable. Only monitor layouts are fixed, non-scrolling viewport surfaces.

Every authenticated layout must expose a visible logout action in the layout
chrome. Do this once in the shell, not page by page. Workspace uses the sidebar
or footer rail; station, review, monitor, and custom no-sidebar layouts use the
top/status header. Icon-only logout is acceptable only in constrained shells and
must have accessible labeling.

Keep navigation chrome consistent inside one app. A single app must not mix
pages with the workspace Shell sidebar and pages without the sidebar. Sidebar
module navigation must stay inside workspace routes that preserve the Shell.
Do not route a sidebar module, role default route, or in-app navigation target
to station, review, monitor, or another no-sidebar layout inside the same app.
If a workflow genuinely needs a different chrome, convert it into the current
app's chosen layout or split it into a separate app/entry surface.

Prefer compact page composition. If a workflow can be handled by dialogs, drawers, popovers, or tabs, keep it out of the always-visible page body. The page should expose the entry points, current operational state, primary actions, and necessary visualizations; detailed forms, secondary attributes, audit trails, configuration, and rarely used actions should open from an explicit control or live behind a focused tab. Master data, workstation configuration, material, equipment, route, and process-parameter create/edit forms should usually be triggered by a button and opened in a dialog or drawer instead of being permanently flattened on the page.

Structure workspace pages as:

- Header region: title, description, back affordance, primary action, secondary actions.
- Control region: search, filters, tabs, view toggles.
- Content region: table, grid, canvas, editor, or split panel.
- State region: empty, loading, and error states that preserve layout stability.

For station pages, reduce navigation and secondary data. Prioritize the current task, large touch targets, scan/manual entry, confirmation feedback, and an exception path. Use 44-48px minimum controls, `text-base` for operational labels, and only the columns or fields required for the next physical action.

For PDA and handheld scanner pages, treat the device as a special station profile, not a generic mobile breakpoint. Design portrait-first for roughly 360-480 CSS px wide screens. Use larger operational typography than desktop (`text-base` labels, `text-lg` scanned/current-task values, and `text-xl` to `text-2xl` dominant quantities or states), one-column task flow, visible/refocusable scanner input, manual entry fallback, and compact action cards instead of wide tables. Avoid sidebar navigation, multi-column forms, hover-only affordances, and dense dashboards.

For review pages, prioritize the queue, the evidence needed to decide, reason capture, and clear disposition actions. Use split panes, sticky decision controls, readable evidence blocks, and semantic state color. Do not hide the reason or consequence behind icon-only controls.

For monitor pages, treat the viewport as fixed wallboard/TV equipment, not a desktop computer display. Fit the full board to the target resolution, usually 16:9, using stable grid tracks, `min-h-0`, `overflow-hidden`, and predictable text truncation. Use large glanceable numerals, high-contrast status blocks, and compact legends. Do not add workspace navigation, forms, tables that require row scrolling, mobile drawers, or long explanatory copy.

Monitor layout preset:

- Frame: full-viewport authenticated shell with a compact 48px status header and one content board region.
- Chrome: no workspace sidebar, no module nav, no drawer, no persistent action rail.
- Scrolling: fixed monitor surfaces use `overflow-hidden` at the page frame; if live logs or event tickers are needed, constrain motion or overflow inside that specific panel.
- Composition: 16:9-first board grid with stable rows/columns, large status blocks, readable line/equipment labels, and no content that requires pointer interaction. Use `monitor-grid` and `monitor-panel` utilities for bounded, non-scrolling board regions.
- Typography: large numerals for KPIs, short labels, tabular numeric treatment, and truncation for long resource names. Use `monitor-kpi`, `monitor-title`, `monitor-text`, `monitor-label`, and `monitor-fit-text` so text scales down within readable clamp limits instead of collapsing.
- Primary use: passive production status, andon, OEE, downtime, queue, material flow, safety, or quality alert wallboards.

For custom layouts, define only the global interaction frame and slots. Do not hardcode business-specific cards, sample charts, or placeholder workflows into the layout shell.

Use the 4px grid. Common workspace gaps are 8px, 12px, and 16px. Station and review flows can use 16px, 20px, and 24px when the user needs faster scanning or touch input. Monitor boards should use viewport-relative grid areas only when they preserve the intended 16:9 composition and keep all text within bounds. Common panel padding is 16px or 20px; dense tables may use 12px. Big-number KPI cards are not general panels: use compact padding such as 12px horizontal and 10px vertical, keep the label and value close, and avoid tall cards with large empty center space. Dialog padding is 32px. Page shells should use full-height flex layouts with `min-h-0` and explicit overflow regions; use a scrollable main region for every non-monitor layout.

## Surfaces, Borders, Radius, Elevation

Borders and subtle surface changes are the primary separation tools. Use `border-border`, `border-border-secondary`, `var(--tier0-border)`, or `var(--tier0-border-secondary)`.

Use the local radius language:

- Default control radius is compact and precise. Prefer `rounded-sm` for buttons, inputs, badges, panels, and table rows; use `rounded-md` for larger shells or layout containers.
- Tailwind radius tokens are mapped in `src/styles/globals.css` to match the support Gantt scaffold's tight radius scale.
- Use larger radii only when nearby components already establish that shape.
- Tags are 4px by default, not pills unless the component already uses a pill shape.

Keep elevation restrained. Normal panels should be flat. Dialogs, dropdowns, popovers, and tooltips may use shadows to separate overlays.

## Components

Build component-local primitives for the app being generated. Keep them close to the route or domain that owns them until repetition justifies sharing under `src/components/<domain>/`.

Buttons:

- `default`: Tier0 signal green highlighted action.
- `primary`: neutral gray primary action.
- `outline`: secondary bordered action.
- `secondary`: neutral filled action.
- `ghost`: icon or low-emphasis toolbar action.
- `destructive`: destructive action.
- `link`: text link action.

Use one primary or highlighted action per local decision area. Use `lucide-react` icons at 16-20px. Keep labels short and internationalized. Default controls are 40px high; station controls should be 44-48px when used for scan, tap, confirm, or exception actions.
Every native button must declare `type` explicitly. Non-submit actions use `type="button"`. Async actions must show visible pending feedback and block repeat clicks while the request is in flight so the UI never feels unresponsive.

Sidebar:

- Workspace sidebar must be collapsible on desktop and use a simple 150-250ms width/opacity transition.
- Active sidebar items may use Tier0 signal-green background, but text and icons on that background must use dark foreground (`text-accent-foreground` or equivalent), not green text.
- Collapsed sidebar labels should remain available through `aria-label` or `title`.
- Sidebar items must not navigate to routes that remove the sidebar. Keep sidebar destinations inside the workspace Shell layout.

Forms:

- Form controls should default to 40px height unless the surrounding table layout is intentionally denser. Station forms should use 44-48px controls.
- Enabled input backgrounds are white: `--card` / `bg-card` / `bg-background` with `border-input`. Disabled or read-only inputs may use the light inset surface: `--tier0-bg-tertiary` / `bg-surface-inset` (`#f9f9f9`).
- Borders use `--tier0-border`.
- Focus uses Tier0 signal green via `--tier0-highlight` and `--tier0-highlight-20`.
- Extract `initialValues`, rules, field groups, option lists, and labels into semantic variables for dialog forms.
- Inline forms are for primary station execution, filters, quick scan/manual entry, or required review reason capture. CRUD create/edit forms for master data and configuration should normally live in `FormDialog` or `Drawer`.

Dialogs:

- Prefer dialogs for create, edit, confirm, assign, import, export, and short review flows instead of expanding all controls inline on the page.
- Default padding is 32px.
- Header gap is 16px; content gap is 32px.
- Title is `text-2xl/8 font-semibold`.
- Footer buttons align right on desktop.
- Use `overflowScroll` for large forms or long content.

Drawers:

- Prefer drawers for record detail, multi-section edit flows, related activity, audit history, and side-by-side table/detail review.
- Drawers should not be used on monitor pages.
- Keep the footer action area sticky at the bottom through the shared overlay footer when the content scrolls.

Tabs:

- Prefer tabs when one entity or workspace has several related modes, such as overview, schedule, quality, materials, history, and settings.
- Keep the default tab focused on the current task or highest-value visualization.
- Avoid stacking multiple full sections vertically when tabs can separate secondary detail without hiding the main action path.

Tables:

- Keep tables compact and operational.
- Header text is medium weight and neutral/tertiary.
- Row hover uses `--tier0-bg-tertiary`.
- Selected row uses `--tier0-bg-tertiary` or `--tier0-bg-accent`.
- Use ellipsis and tooltips for long names and descriptions.
- Keep row actions quiet: icon buttons, dropdown menus, or compact text actions.

Cards and lists:

- Use cards for repeated resources, metric blocks, and bounded panels.
- Default card surface is white or `bg-card`.
- Use soft category backgrounds sparingly.
- Hover only when the whole card is clickable.

Tags:

- Default theme is grey background, grey border, black text.
- Use Tier0 signal green for highlight states, not generic success.

## Motion

Use motion for state clarity, not decoration. Standard transitions should cover color, opacity, background, border, and shadow. Keep normal UI transitions at 150-250ms. Use 500-600ms only for major panel transitions where layout remains stable.

Avoid decorative background blobs, excessive gradients, and animated ornaments unrelated to product state. Gradients may be used sparingly for AI/thinking status, as in `thinking-title-active`.

## Product Copy

Keep visible copy consistent, domain-specific, and easy to scan. Default to one explicit product locale per app surface and do not mix Chinese and English in finished UI. Use the `app-i18n-copy` skill when normalizing scaffold copy or generated app copy. For a single-locale app, keep short copy close to the owning component or a small local copy module. Only introduce a broader message catalog when the requirements explicitly need runtime multi-language support. Only logs and temporary debug output may remain hardcoded.

## Implementation Rules

- Create component-local primitives that fit the app; share them under `src/components/<domain>/` only when reuse is real.
- Use `cn` from `@/lib/utils` for conditional class composition.
- Prefer semantic theme tokens over hardcoded hex values.
- If hardcoded colors are unavoidable for a one-off visual asset, document why in a short code comment.
- Match existing page density and component rhythm before introducing new spacing.
- Keep text truncation explicit with `min-w-0`, `truncate`, `line-clamp-*`, and tooltip fallbacks.
- Preserve app shell stability with `h-full`, `min-h-0`, explicit overflow containers, and stable grid/flex dimensions.
- Keep all visible copy reachable in the UI and avoid placeholder wording.

## Avoid

- IBM Blue as the Tier0 primary color.
- A new design system inside a feature folder.
- Duplicate button, dialog, table, tag, input, pagination, or select behavior.
- Heavy shadows for normal panels.
- Tier0 signal green as a general page background.
- Mixed Chinese/English product UI text in one finished app surface.
- Inline complex form configuration in JSX.
- Broad decorative gradients, purple-blue themes, beige/brown palettes, or cold/warm gray-heavy palettes.

## Quick Build Checklist

- Uses existing shared components where practical.
- Uses `--tier0-*` tokens or Tailwind aliases instead of arbitrary colors.
- Fits the compact enterprise layout rhythm.
- Has stable loading, empty, error, and long-content states.
- Uses domain-specific visible copy with no scaffold placeholders.
- Keeps design-system commentary, color-token explanations, layout guidance, and implementation notes out of visible product UI.
- Dialog forms have extracted initial values, rules, and field metadata.
- Tables and lists handle truncation and overflow.
- Focus, hover, selected, disabled, and destructive states are visible.
