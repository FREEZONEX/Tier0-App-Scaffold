---
version: alpha
name: Tier0-design-system
description: "A readable enterprise product design system for Tier0: calm operational surfaces, neutral gray primary actions, softened signal green for active/selected/progress states, and layout density chosen by workflow context. Interfaces should feel technical, usable under real factory conditions, and product-focused, with hierarchy from typography, spacing, borders, and stable layout rhythm rather than harsh contrast or decoration."

colors:
  primary: "var(--tier0-primary)"
  primary-hover: "var(--tier0-primary-hover)"
  on-primary: "var(--tier0-on-primary)"
  highlight: "var(--tier0-highlight)"
  highlight-foreground: "var(--tier0-highlight-foreground)"
  highlight-text: "var(--tier0-highlight-text)"
  highlight-deep: "var(--tier0-highlight-deep)"
  highlight-bg-primary: "var(--tier0-highlight-bg-primary)"
  highlight-bg-accent: "var(--tier0-highlight-bg-accent)"
  ink: "var(--tier0-text-color)"
  ink-secondary: "var(--tier0-text-secondary)"
  ink-tertiary: "var(--tier0-text-tertiary)"
  ink-placeholder: "var(--tier0-text-placeholder)"
  canvas: "var(--tier0-bg-color)"
  canvas-raised: "var(--card)"
  canvas-offwhite: "var(--tier0-bg-secondary)"
  surface-1: "var(--tier0-bg-tertiary)"
  surface-2: "var(--tier0-bg-accent)"
  surface-3: "var(--tier0-surface-muted)"
  hairline: "var(--tier0-border)"
  hairline-subtle: "var(--tier0-border-secondary)"
  semantic-success: "var(--tier0-success-color)"
  semantic-success-soft: "var(--tier0-success-tertiary)"
  semantic-error: "var(--tier0-error-color)"
  semantic-error-soft: "var(--tier0-error-tertiary)"
  semantic-warning: "var(--tier0-warning-color)"
  semantic-warning-soft: "var(--tier0-warning-tertiary)"
  semantic-info: "var(--tier0-blue-color)"
  semantic-info-soft: "var(--tier0-blue-tertiary)"

typography:
  display:
    fontFamily: "var(--font-display-sans)"
    fontSize: "var(--tier0-text-display-size)"
    fontWeight: "var(--tier0-text-display-weight)"
    lineHeight: "var(--tier0-text-display-line)"
    letterSpacing: 0
  heading-lg:
    fontFamily: "var(--font-display-sans)"
    fontSize: "var(--tier0-text-heading-lg-size)"
    fontWeight: "var(--tier0-text-heading-lg-weight)"
    lineHeight: "var(--tier0-text-heading-lg-line)"
    letterSpacing: 0
  heading-md:
    fontFamily: "var(--font-display-sans)"
    fontSize: "var(--tier0-text-heading-md-size)"
    fontWeight: "var(--tier0-text-heading-md-weight)"
    lineHeight: "var(--tier0-text-heading-md-line)"
    letterSpacing: 0
  heading-sm:
    fontFamily: "var(--font-app-sans)"
    fontSize: "var(--tier0-text-heading-sm-size)"
    fontWeight: "var(--tier0-text-heading-sm-weight)"
    lineHeight: "var(--tier0-text-heading-sm-line)"
    letterSpacing: 0
  body:
    fontFamily: "var(--font-app-sans)"
    fontSize: "var(--tier0-text-body-size)"
    fontWeight: "var(--tier0-text-body-weight)"
    lineHeight: "var(--tier0-text-body-line)"
    letterSpacing: 0
  body-lg:
    fontFamily: "var(--font-app-sans)"
    fontSize: "var(--tier0-text-body-lg-size)"
    fontWeight: "var(--tier0-text-body-lg-weight)"
    lineHeight: "var(--tier0-text-body-lg-line)"
    letterSpacing: 0
  label:
    fontFamily: "var(--font-app-sans)"
    fontSize: "var(--tier0-text-label-size)"
    fontWeight: "var(--tier0-text-label-weight)"
    lineHeight: "var(--tier0-text-label-line)"
    letterSpacing: 0
  caption:
    fontFamily: "var(--font-app-sans)"
    fontSize: "var(--tier0-text-caption-size)"
    fontWeight: "var(--tier0-text-caption-weight)"
    lineHeight: "var(--tier0-text-caption-line)"
    letterSpacing: 0
  mono:
    fontFamily: "var(--font-geist-mono)"
    fontSize: "var(--tier0-text-mono-size)"
    fontWeight: "var(--tier0-text-mono-weight)"
    lineHeight: "var(--tier0-text-mono-line)"
    letterSpacing: 0

rounded:
  none: 0
  xs: "var(--tier0-radius-xs)"
  sm: "var(--tier0-radius-sm)"
  md: "var(--tier0-radius-md)"
  lg: "var(--tier0-radius-lg)"
  xl: "var(--tier0-radius-xl)"
  pill: "var(--tier0-radius-pill)"
  full: "var(--tier0-radius-pill)"

spacing:
  xxs: "var(--tier0-space-xxs)"
  xs: "var(--tier0-space-xs)"
  sm: "var(--tier0-space-sm)"
  md: "var(--tier0-space-md)"
  lg: "var(--tier0-space-lg)"
  xl: "var(--tier0-space-xl)"
  xxl: "var(--tier0-space-xxl)"
  section: "var(--tier0-space-section)"

components:
  button-highlight:
    backgroundColor: "{colors.highlight-bg-primary}"
    textColor: "{colors.highlight-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: "var(--tier0-control-height-md)"
    padding: "0 var(--tier0-space-md)"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: "var(--tier0-control-height-md)"
    padding: "0 var(--tier0-space-md)"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink-secondary}"
    borderColor: "{colors.hairline}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: "var(--tier0-control-height-md)"
    padding: "0 var(--tier0-space-md)"
  button-outline:
    backgroundColor: "{colors.canvas-raised}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: "var(--tier0-control-height-md)"
    padding: "0 var(--tier0-space-md)"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    minHeight: "var(--tier0-control-height-md)"
    padding: "0 var(--tier0-space-sm)"
  input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    focusColor: "{colors.highlight}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    minHeight: "var(--tier0-control-height-md)"
    padding: "0 var(--tier0-space-sm)"
  dialog:
    backgroundColor: "{colors.canvas-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  panel:
    backgroundColor: "{colors.canvas-raised}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
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
  fast: "var(--tier0-motion-fast)"
  normal: "var(--tier0-motion-base)"
  slow: "var(--tier0-motion-slow)"
---

# Tier0 Frontend Design Guidelines

`DESIGN.md` is the visual source for Tier0. It defines the look, token intent,
and product feel. Generation behavior lives in the UI skills:

- Layout and route chrome: `$app-layout-patterns`
- General frontend UI generation: `$uns-swe-ui-generation`
- MES visual patterns, KPI cards, Gantt, and dashboards: `$mes-ui-patterns`
- Product copy and locale consistency: `$app-i18n-copy`

Color, spacing, radius, typography, motion, and Tailwind mappings are executable
tokens in `src/styles/globals.css`. The YAML block above mirrors those tokens for
quick reading; do not fork values locally in routes or components.

## Design Direction

Tier0 should feel precise, technical, and product-focused while staying readable
for long shifts, tablets, shared terminals, and shop-floor lighting. It can
borrow disciplined enterprise structure, but the visual language must remain
Tier0's own.

- Neutral workspace surfaces: soft canvas, raised white panels, light grey insets.
- Near-black primary actions for core product decisions.
- Tier0 signal green for emphasis, selected states, progress, active states, and optimistic product moments.
- Density chosen by workflow: compact for workspace, larger for station execution, evidence-first for review.
- Hierarchy from typography, borders, background layering, and stable layout rhythm.

Do not use IBM Blue as the default primary color. Do not turn the product into a Carbon clone.

## Source Of Truth

- Theme entry, color tokens, typography tokens, and Tailwind mappings: `src/styles/globals.css`
- Runtime class helpers: `src/lib/utils.ts`
- Overlay primitives: `src/components/overlays`
- App-specific generated components: `src/components/<domain>/`
- Layout shell decisions: `$app-layout-patterns`
- Component behavior and recipes: `$uns-swe-ui-generation`
- MES visual snippets: `$mes-ui-patterns`
- Locale/copy consistency: `$app-i18n-copy`

Use semantic variables such as `--tier0-bg-color`, `--tier0-text-color`,
`--tier0-highlight`, and Tailwind aliases such as `bg-bg`, `text-text`,
`border-border`, `bg-highlight-bg-accent`, `text-highlight-text`,
`bg-button-primary`, and `bg-button-highlight`.

## Color Rules

Use the YAML color roles and `globals.css` tokens instead of arbitrary hex
values. Tier0 signal green should call attention to active product state,
build/progress, selection, or success-adjacent emphasis. It should not flood
cards, sections, icons, or page backgrounds.

Avoid pure black on pure white as the dominant reading surface. Use raised white
cards on soft canvas, neutral gray text for hierarchy, and borders for
separation. High urgency belongs in semantic status tokens, not in the global
palette.

Use semantic status tokens for status UI:

- Success: `--tier0-success-color`, `--tier0-success-tertiary`
- Error: `--tier0-error-color`, `--tier0-error-tertiary`
- Warning: `--tier0-warning-color`, `--tier0-warning-tertiary`
- Info/updating: `--tier0-blue-color`, `--tier0-blue-tertiary`

## Typography

The default product UI font is `--font-app-sans`, chosen for platform-native
readability and reliable rendering. Use `--font-display-sans` for larger
headings, and `--font-geist-mono` for code, IDs, compact technical metadata,
and token previews.

Use existing utilities from `src/styles/globals.css`:

- Page display: `typo-h1`
- Section heading: `typo-h2`
- Subsection heading: `typo-h3`
- Panel heading: `typo-h4`
- Body: `text-sm` or `text-base`
- Caption: `.caption` or `text-xs`
- Mono/code: `font-mono`

Keep letter spacing neutral. Do not scale type directly with viewport width
outside the monitor utilities.

## Surfaces, Borders, Radius, Elevation

Borders and subtle surface changes are the primary separation tools. Use
`border-border`, `border-border-secondary`, `var(--tier0-border)`, or
`var(--tier0-border-secondary)`.

Default surfaces are white or near-white raised panels on a soft canvas.
Inputs, selects, textareas, and combobox-like controls should use white enabled
backgrounds (`bg-background` or `bg-card`) with `border-input`; disabled or
read-only controls may use `bg-surface-inset`.

Use the compact radius scale from `globals.css`. Prefer `rounded-sm` for
buttons, inputs, badges, panels, and table rows; use `rounded-md` only for
larger shells or existing local rhythm.

Keep elevation restrained. Normal panels should be flat. Dialogs, dropdowns,
popovers, and tooltips may use shadows to separate overlays.

## Density And Composition

Use the Tier0 spacing scale from `globals.css`. Workspace surfaces should be
compact and scannable; station surfaces should be touch-friendly; review
surfaces should favor readable evidence; monitor surfaces should use the
`monitor-*` utilities and fit a fixed board.

Prefer compact page composition. The always-visible page body should expose
entry points, current operational state, primary actions, and necessary
visualizations. Detailed forms, secondary attributes, audit trails,
configuration, and rarely used actions should open from an explicit control or
live behind focused tabs. For concrete layout selection and route groups, use
`$app-layout-patterns`.

Big-number KPI cards are denser than general panels: keep label and value close,
avoid tall empty cards, and prefer compact summary strips when showing many
counts. For reusable MES snippets, use `$mes-ui-patterns`.

## Component Principles

Build component-local primitives for the app being generated. Keep them close to
the route or domain that owns them until repetition justifies sharing under
`src/components/<domain>/`. Do not create a second design system inside a
feature folder.

Buttons, forms, dialogs, drawers, empty states, tables, charts, and responsive
behavior are specified in `$uns-swe-ui-generation`. Keep only these visual
defaults here:

- Use one primary or highlighted action per local decision area.
- Use lucide-react icons at normal Tailwind icon sizes such as `size-4` or `size-5`.
- Use `FormDialog` or `Drawer` for workspace CRUD create/edit forms by default.
- Keep row actions quiet: icon buttons, dropdown menus, or compact text actions.
- Pair color with icon or text for industrial status readability.
- Preserve truncation with `min-w-0`, `truncate`, and tooltip fallbacks.

## Product Copy

Visible app copy should describe the user's work, data, action, state, or
consequence. Do not render design-system commentary as product UI. For locale
selection, mixed-language cleanup, dialog button text, accessibility labels, and
runtime i18n decisions, use `$app-i18n-copy`.

## Motion

Use motion for state clarity, not decoration. Standard transitions should cover
color, opacity, background, border, and shadow. Use the Tier0 motion tokens from
`globals.css`.

Avoid decorative background blobs, excessive gradients, and animated ornaments
unrelated to product state. Gradients may be used sparingly for AI/thinking
status, as in `thinking-title-active`.

## Avoid

- Hardcoded hex values or local token forks.
- Arbitrary pixel-based Tailwind values for layout, such as hardcoded timeline
  widths, fixed resource columns, or tiny one-off text sizes.
- IBM Blue as the Tier0 primary color.
- Heavy shadows for normal panels.
- Tier0 signal green as a general page background.
- Duplicate button, dialog, table, tag, input, pagination, or select behavior.
- Mixed-language product UI text in one finished app surface.
- Inline full create/edit forms for workspace CRUD pages.
- Broad decorative gradients, purple-blue themes, beige/brown palettes, or cold/warm gray-heavy palettes.

## Quick Visual Checklist

- Uses `--tier0-*` tokens or Tailwind aliases instead of arbitrary colors.
- Uses white enabled input backgrounds and visible focus/disabled states.
- Fits the compact enterprise layout rhythm.
- Keeps KPI cards dense and avoids tall empty metric panels.
- Handles truncation and long content without overlap.
- Keeps design-system commentary and token explanations out of visible UI.
- Uses the appropriate UI skill for layout, component behavior, MES patterns, and copy.
