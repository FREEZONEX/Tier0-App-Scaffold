---
version: alpha
name: Tier0-design-system
description: "A compact enterprise product design system for Tier0: precise workspace layouts, neutral white and off-white surfaces, near-black primary actions, and FX Green (#b2ed1d) as a distinctive highlight for active, selected, progress, and optimistic product states. The system borrows IBM's disciplined density without becoming a Carbon clone. Interfaces should feel technical, operational, and product-focused, with clear hierarchy from typography, borders, spacing, and stable layout rhythm rather than decoration."

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
  canvas-offwhite: "#fcfcfc"
  surface-1: "#f9f9f9"
  surface-2: "#f3f3f3"
  surface-3: "#ebebeb"
  hairline: "#ebebeb"
  hairline-subtle: "#f3f3f3"
  semantic-success: "#16a34a"
  semantic-success-soft: "#dcfce7"
  semantic-error: "#dc2626"
  semantic-error-soft: "#fee2e2"
  semantic-warning: "#d97706"
  semantic-warning-soft: "#fef3c7"
  semantic-info: "#2563eb"
  semantic-info-soft: "#dbeafe"

typography:
  display:
    fontFamily: Inter
    fontSize: 38px
    fontWeight: 700
    lineHeight: 46px
    letterSpacing: 0
  heading-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: 600
    lineHeight: 36px
    letterSpacing: 0
  heading-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: 600
    lineHeight: 32px
    letterSpacing: 0
  heading-sm:
    fontFamily: IBM Plex Sans
    fontSize: 20px
    fontWeight: 500
    lineHeight: 28px
    letterSpacing: 0
  body:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0
  label:
    fontFamily: IBM Plex Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    letterSpacing: 0
  caption:
    fontFamily: IBM Plex Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0
  mono:
    fontFamily: Geist Mono
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
    rounded: "{rounded.sm}"
    minHeight: 36px
    padding: 0 14px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    minHeight: 36px
    padding: 0 14px
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-secondary}"
    borderColor: "{colors.hairline}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    minHeight: 36px
    padding: 0 14px
  button-outline:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    minHeight: 36px
    padding: 0 14px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.ink-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    minHeight: 36px
    padding: 0 10px
  input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    focusColor: "{colors.highlight}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    minHeight: 36px
    padding: 0 12px
  dialog:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 32px
  panel:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.sm}"
    padding: 16px
  table:
    backgroundColor: "{colors.canvas}"
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

Tier0 should feel precise, technical, and product-focused. It can borrow IBM's disciplined enterprise structure, but the visual language must remain Tier0's own:

- Neutral workspace surfaces: white, off-white, light grey, and near-black.
- Near-black primary actions for core product decisions.
- FX Green for emphasis, selected states, progress, active states, and optimistic product moments.
- Compact enterprise density for tables, side panels, headers, dialogs, filters, and forms.
- Clear hierarchy through typography, border, background layering, and layout rhythm.

Do not use IBM Blue as the default primary color. Do not turn the product into a Carbon clone.

## Source Of Truth

Use project tokens and shared components before introducing local styling.

- Global theme entry: `packages/theme/src/index.scss`
- Primitive color tokens: `packages/theme/src/variables.scss`
- Semantic theme tokens: `packages/theme/src/themes.scss`
- Tailwind mappings and typography utilities: `packages/theme/src/tailwind.css`
- Ant Design token bridge: `packages/theme/src/token.ts`
- Ant Design CSS overrides: `packages/theme/src/override-antd.scss`
- Shared UI components: `packages/ui/components`
- App-level style entry: `apps/saas-dashboard/styles/index.scss`

Prefer semantic variables such as `--tier0-bg-color`, `--tier0-text-color`, `--tier0-highlight`, and Tailwind aliases such as `bg-bg`, `text-text`, `border-border`, `bg-highlight-bg-accent`, `text-highlight-text`, `bg-button-primary`, and `bg-button-highlight`.

## Color Rules

Use the YAML color roles instead of arbitrary hex values. FX Green should call attention to active product state, AI/building progress, selection, or success-adjacent emphasis. It should not flood every card, section, icon, or page background.

Use semantic status tokens for status UI:

- Success: `--tier0-success-color`, `--tier0-success-tertiary`
- Error: `--tier0-error-color`, `--tier0-error-tertiary`
- Warning: `--tier0-warning-color`, `--tier0-warning-tertiary`
- Info/updating: `--tier0-blue-color`, `--tier0-blue-tertiary`

## Typography

The default product UI font is IBM Plex Sans via `--font-app-sans`. Use Inter via `--font-display-sans` for larger headings and Geist Mono via `--font-geist-mono` for code, IDs, compact technical metadata, and token previews.

Use existing utilities from `packages/theme/src/tailwind.css`:

- Page display: `typo-h1`
- Section heading: `typo-h2`
- Subsection heading: `typo-h3`
- Panel heading: `typo-h4`
- Body: `text-sm` or `text-base`
- Caption: `.caption` or `text-xs`
- Mono/code: `font-mono`

For new component-local typography, keep letter spacing neutral.

## Layout

Most Tier0 pages are product workspaces, not marketing pages. Structure pages as:

- Header region: title, description, back affordance, primary action, secondary actions.
- Control region: search, filters, tabs, view toggles.
- Content region: table, grid, canvas, editor, or split panel.
- State region: empty, loading, and error states that preserve layout stability.

Use the 4px grid. Common gaps are 8px and 12px. Common panel padding is 12px, 16px, or 20px. Dialog padding is 32px. Page shells should use full-height flex layouts with `min-h-0` and explicit overflow regions.

## Surfaces, Borders, Radius, Elevation

Borders are the primary separation tool. Use `border-border`, `border-border-secondary`, `var(--tier0-border)`, or `var(--tier0-border-secondary)`.

Use the local radius language:

- Default component radius: 4px via `--tier0-radius` and Ant Design `borderRadius: 4`.
- shadcn `rounded-md` is acceptable for shared UI controls.
- Use larger radii only when nearby components already establish that shape.
- Tags are 4px by default, not pills unless the component already uses a pill shape.

Keep elevation restrained. Normal panels should be flat. Dialogs, dropdowns, popovers, and tooltips may use shadows to separate overlays.

## Components

Use `@tier0/ui` before building component-local primitives.

Buttons:

- `default`: FX Green highlighted action.
- `primary`: near-black primary action.
- `outline`: secondary bordered action.
- `secondary`: neutral filled action.
- `ghost`: icon or low-emphasis toolbar action.
- `destructive`: destructive action.
- `link`: text link action.

Use one primary or highlighted action per local decision area. Use `lucide-react` icons at 16-20px. Keep labels short and internationalized.

Forms:

- Ant Design inputs default to 36px height.
- Input backgrounds use `--tier0-bg-color`.
- Borders use `--tier0-border`.
- Focus uses FX Green via `--tier0-highlight` and `--tier0-highlight-20`.
- Extract `initialValues`, rules, field groups, option lists, and labels into semantic variables for dialog forms.

Dialogs:

- Use `CnDialog` where possible.
- Default padding is 32px.
- Header gap is 16px; content gap is 32px.
- Title is `text-2xl/8 font-semibold`.
- Footer buttons align right on desktop.
- Use `overflowScroll` for large forms or long content.

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

- Use `AntTag` or established tag components.
- Default theme is grey background, grey border, black text.
- Use `fx-green` for Tier0 highlight states, not generic success.

## Motion

Use motion for state clarity, not decoration. Standard transitions should cover color, opacity, background, border, and shadow. Keep normal UI transitions at 150-250ms. Use 500-600ms only for major panel transitions where layout remains stable.

Avoid decorative background blobs, excessive gradients, and animated ornaments unrelated to product state. Gradients may be used sparingly for AI/thinking status, as in `thinking-title-active`.

## Internationalization

All user-facing product copy must use `next-intl`.

Internationalize buttons, dialog copy, form labels, placeholders, validation, table headers, empty states, tooltips, toasts, and status labels. Update the relevant app message files:

- `apps/saas-dashboard/messages/zh-cn.json`
- `apps/saas-dashboard/messages/en.json`
- `apps/platform-admin/messages/zh-cn.json`
- `apps/platform-admin/messages/en.json`

Only logs and temporary debug output may remain hardcoded.

## Implementation Rules

- Reuse shared components from `@tier0/ui` before creating component-local primitives.
- Use `@tier0/utils` `cn` for conditional class composition.
- Prefer semantic theme tokens over hardcoded hex values.
- If hardcoded colors are unavoidable for a one-off visual asset, document why in a short code comment.
- Match existing page density and component rhythm before introducing new spacing.
- Keep text truncation explicit with `min-w-0`, `truncate`, `line-clamp-*`, and tooltip fallbacks.
- Preserve app shell stability with `h-full`, `min-h-0`, explicit overflow containers, and stable grid/flex dimensions.
- Add i18n keys in both Chinese and English message files for visible copy.

## Avoid

- IBM Blue as the Tier0 primary color.
- A new design system inside a feature folder.
- Duplicate button, dialog, table, tag, input, pagination, or select behavior.
- Heavy shadows for normal panels.
- FX Green as a general page background.
- Hardcoded Chinese or English product UI text.
- Inline complex form configuration in JSX.
- Broad decorative gradients, purple-blue themes, beige/brown palettes, or dark slate-heavy palettes.

## Quick Build Checklist

- Uses existing shared components where practical.
- Uses `--tier0-*` tokens or Tailwind aliases instead of arbitrary colors.
- Fits the compact enterprise layout rhythm.
- Has stable loading, empty, error, and long-content states.
- Uses `next-intl` for all visible copy.
- Dialog forms have extracted initial values, rules, and field metadata.
- Tables and lists handle truncation and overflow.
- Focus, hover, selected, disabled, and destructive states are visible.
