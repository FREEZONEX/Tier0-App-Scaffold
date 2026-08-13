---
version: alpha
name: Tier0-design-system
description: "A readable enterprise product design system for Tier0: calm operational surfaces, neutral gray primary actions, softened signal green for active/selected/progress states, and layout density chosen by workflow context. Management workspaces should feel modern, clear, and product-focused; production execution, monitor, and safety-critical surfaces may feel more industrial when the environment calls for it."

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
  canvas: "var(--tier0-canvas)"  # page background (pure white by user decision; depth via card border+shadow)
  canvas-raised: "var(--card)"
  canvas-offwhite: "var(--tier0-bg-secondary)"
  surface-1: "var(--tier0-bg-tertiary)"
  surface-2: "var(--tier0-bg-accent)"
  surface-3: "var(--tier0-surface-muted)"
  hairline: "var(--tier0-border)"
  hairline-subtle: "var(--tier0-border-secondary)"
  input-fill: "var(--tier0-input-bg)"
  input-border: "var(--tier0-input-border)"
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

# The recipes below are implemented as scaffold primitives in
# src/components/ui/ (Button variants, StatusBadge≈tag-status, Card≈panel,
# PageHeader, StatusFilterChips, RiskBanner, EmptyState, StatCard,
# WorkbenchLayout, OperationalList, ResponsivePage, PageToolbar) and
# src/components/forms/FileUpload — compose
# those instead of re-deriving styles from this file. Usage rules:
# - identifiers (doc/lot/location codes) render in font-mono
# - highlight lime is a fill color only; text accents use highlight-deep
# - status = StatusBadge + optional card accent bar; never tint whole cards
# - available where useful: .text-link (inline links), StatCard tone + trend props
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
    backgroundColor: "{colors.input-fill}"
    textColor: "{colors.ink}"
    borderColor: "{colors.input-border}"
    focusColor: "{colors.highlight}"
    # Form controls use a subtle fill + deeper border (not the hairline color)
    # so a field reads as an editable box on white surfaces even unfocused.
    # On focus the fill brightens to the surface color alongside the ring.
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    minHeight: "var(--tier0-control-height-md)"
    padding: "0 var(--tier0-space-sm)"
  file-upload:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    borderColor: "{colors.input-border}"
    borderStyle: dashed
    rounded: "{rounded.md}"
    minHeight: "7rem"
    padding: "{spacing.lg}"
  dialog:
    backgroundColor: "{colors.canvas-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xxl}"
  panel:
    backgroundColor: "{colors.canvas-raised}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    boxShadow: "{shadow.sm}"  # raised surfaces carry subtle elevation on the canvas
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

layout:
  workspace-container: "1440px centered"  # Shell caps content width; wide boards scroll internally
  table-actions-column: "table-col-fit"   # trailing action/badge columns shrink to content

motion:
  fast: "var(--tier0-motion-fast)"
  normal: "var(--tier0-motion-base)"
  slow: "var(--tier0-motion-slow)"
---

# Tier0 Frontend Design Contract

`src/styles/globals.css` is the executable source for color, type, spacing,
radius, motion, Tailwind aliases, and safe base styling. The YAML above is its
compact map. Existing primitives under `src/components/**` expose the same
system at point of use; platform-injected Builder guidance may choose concrete
page compositions. Keep this scaffold Skill-name agnostic.

## Visual Character

Tier0 is precise, calm, technical enterprise software: readable through long
shifts and on shared terminals without becoming a dark control-room theme.

- Workspace: neutral canvas, raised white surfaces, compact information rhythm.
- Primary decisions: near-black; active/selected/progress emphasis: Tier0 signal
  green; urgency: semantic status colors.
- Station: larger touch targets. Review: evidence-first. Monitor: fixed,
  distance-readable composition.
- Hierarchy comes from typography, borders, restrained surface changes, and
  stable spacing rather than decoration.

Use semantic tokens and Tailwind aliases instead of local color systems.
Enabled controls remain visibly editable on white surfaces. Normal panels are
flat; overlay surfaces may use restrained elevation. IDs, lot/document/location
codes, and tabular technical values suit `font-mono` / `tabular-nums`.

## Composition

Choose layout and density from the workflow. Keep the persistent page body
focused on current state, primary work, and useful decisions; secondary detail
can live behind an explicit control or focused tab.

For management workbenches, KPI cards are a compact summary rather than the
page destination. Follow them with the primary queue/table and, when useful, a
narrower risk or decision area; `WorkbenchLayout` provides the responsive 2:1
default. Short actionable records use `OperationalList` so status, consequence,
and next action stay together without a mostly empty card.

Page title rows contain the title, optional breadcrumb/status, and actions—not
an explanation of the page or embedded cards, filters, charts, forms, or data
boards. Wide content owns its scroll region, long values wrap or truncate
intentionally, and interactive pages reflow at 375px and 200% browser zoom.
Use `ResponsivePage` for page spacing and `PageToolbar` for filters/actions;
do not simulate responsiveness with CSS zoom or scaled page roots.

The shipped component families are a discoverable toolkit, not a mandatory
screen recipe:

- `ui/`: buttons, status, cards, headers, filters, risk, empty, KPI, workbench,
  operational-list, responsive-page, and toolbar states.
- `forms/`: field/grid composition, record selection, uploads, line items.
- `overlays/`: dialogs, forms, confirmation, drawers.
- `data/`: asynchronous state and dense-table layout helpers.
- `actions/`: visible basis/impact for recommended, automatic, or bulk changes.

Keep app-specific components local until repetition justifies
`src/components/<domain>/`. Do not create a parallel design system.

## Copy and Motion

Visible copy names work, data, state, action, risk, or consequence. Keep route
explanations, token commentary, and implementation notes out of product UI.
Use one locale per surface unless bilingual output is requested.

Motion clarifies state. Avoid animated ornaments, broad decorative gradients,
background blobs, glass effects, and heavy shadows. Import shared motion through
`@/lib/motion`.

## Review

Check semantic-token use, control affordance, status readability, density,
responsive overflow, text fitting, page-header discipline, and consistency with
the chosen app chrome. Prefer improving primitives or base fallbacks over adding
new global prescriptions for individual layouts.
