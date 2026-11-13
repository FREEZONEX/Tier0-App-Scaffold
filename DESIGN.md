---
version: alpha
name: Tier0-design-system
description: "A readable enterprise product design system for Tier0: calm operational surfaces, near-black primary actions, muted-gray fills for selected navigation, signal green only for progress fills and highlight CTAs, and density chosen by layout (workspace / station / review / monitor). Management workspaces are product-focused; station, review, and monitor keep purpose-built density and chrome."

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

shadow:
  sm: "var(--shadow-sm)"

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
# PageHeader, StatusFilterChips, RiskBanner, EmptyState, StatCard) and
# src/components/forms/FileUpload — compose
# those instead of re-deriving styles from this file. Usage rules:
# - identifiers (doc/lot/location codes) render in font-mono
# - highlight lime is a fill / ring color only; text accents use brand (≥4.5:1)
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
  workspace-container: "full available width"  # Forms/prose may opt into local width limits
  workspace-page-inset: "page-shell: 16px x / 20px y narrow, 24px sm, 24px x / 32px y lg"
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
- Primary actions: near-black (`Button` `primary`). Navigation selection:
  `bg-muted text-foreground` with no border or shadow. Progress fills and
  deliberate CTAs: signal green (`Button` `highlight` / highlight soft fills).
  Text and icon accents on the canvas: `--tier0-brand` / `text-brand` (≥4.5:1);
  never use `--tier0-highlight`, `--tier0-highlight-text`, or
  `--tier0-highlight-deep` for body or label text on white. Urgency: semantic
  status colors. Being the most important action alone does not require a green
  button.
- Station: larger touch targets. Review: evidence-first. Monitor: fixed,
  distance-readable composition.
- Hierarchy comes from typography, borders, restrained surface changes, and
  stable spacing rather than decoration.

Use semantic tokens and Tailwind aliases instead of local color systems.
Enabled controls remain visibly editable on white surfaces. Normal panels use
hairline borders and a subtle `shadow-sm`; overlays may use stronger, restrained
elevation. IDs, lot/document/location
codes, and tabular technical values suit `font-mono` / `tabular-nums`.

## App Icons

App identity icons use a softly dimensional app-store style. Apply these rules
to the app icon asset; navigation and action icons remain simple UI glyphs.

- Shape: use a rounded-square tile with generous, consistent corner radii.
  Center one recognizable business symbol with balanced padding and visual weight.
- Color: choose one vivid dominant hue, such as orange, blue, or violet. Use
  a restrained light-to-dark gradient within that hue, with a white or pale
  tinted foreground. The app identity hue may differ from the UI's semantic colors.
- Depth: give the symbol gentle tonal shading, a fine edge highlight, and a
  short soft shadow. A few overlapping shapes can suggest cards, boards, or
  messages. Keep the result crisp and shallow, without photorealistic texture,
  exaggerated extrusion, heavy gloss, or a glass panel behind every symbol.
- Meaning: simplify a concrete domain object, such as a helmet, contact card,
  task board, or chat bubble. A familiar object may fill the tile, such as a
  white notepad with a colored header, while retaining the same rounded silhouette.
- Legibility: check the exported icon at 32px and 64px. Preserve the main
  silhouette and foreground/background contrast; remove tiny lettering, dense
  linework, decorative badges, and details that disappear when reduced.

Use the asset dimensions, root/public copy, and registration workflow in
`AGENTS.md` → App Identity and Product Copy.

## Composition

Choose layout and density from the workflow. Keep the persistent page body
focused on current state, primary work, and useful decisions; secondary detail
can live behind an explicit control or focused tab.

Page title rows contain the title, optional breadcrumb/status, and actions—not
an explanation of the page or embedded cards, filters, charts, forms, or data
boards. Wide content owns its scroll region, long values wrap or truncate
intentionally, and interactive pages remain usable at 375px.

Use `page-shell` on the root of every ordinary workspace page. `Shell` fills
all available width beside the sidebar, with no global maximum or centered
container. Production lists, ledgers, quality review, planning and operational
boards use that width by default. `page-shell` owns the responsive page inset:
16px horizontally on narrow screens and 24px on desktop; do not repeat outer
page padding. Station, review, and monitor layouts keep their purpose-built spacing.

Limit width locally when the content needs it: a simple form can use
`w-full min-w-0 max-w-3xl`, and a long-text block `w-full min-w-0 max-w-prose`.
These are opt-in examples, not limits on every form: multi-column forms and
editable line-item tables may need the full width. Keep the page header and
operational tables outside these local wrappers; use `mx-auto` only when that
specific content benefits from centering. Keep search controls and status/action
columns bounded; let business content columns use the remaining space. Wide
tables and boards retain their own horizontal scroll region.

List pages place tabs, filters, toolbars, tables, and pagination directly on
the page canvas. Do not add an outer decorative card around `MetaListPage`;
use its page inset and internal spacing. Cards remain available for distinct
content groups in other compositions.

The shipped component families are a discoverable toolkit, not a mandatory
screen recipe:

- `ui/`: buttons, status, cards, headers, filters, risk, empty and KPI states.
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

Motion clarifies state. On application surfaces, avoid animated ornaments, broad decorative gradients,
background blobs, glass effects, and heavy shadows. Import shared motion through
`@/lib/motion`.

## Review

Check semantic-token use, control affordance, status readability, density,
responsive overflow, text fitting, page-header discipline, and consistency with
the chosen app chrome. Prefer improving primitives or base fallbacks over adding
new global prescriptions for individual layouts.

Toolbar controls read best at a deliberate width. A search field stretched to
fill every pixel of a wide toolbar looks unresolved and drags its placeholder far
from the results it filters; give it a ceiling — `max-w-xs` is a good default —
and let the empty space carry the layout. The build catches known unbounded
control-growth patterns; it does not verify rendered mobile usability. See the
static-check and viewport-review boundaries in [docs/ui-rules.md](docs/ui-rules.md#responsive-layout).

## 通用组件扩充

组件类型与主题独立管理。新增组件沿用本文件及 `src/styles/globals.css` 的主题；启用状态输入框使用白底，浅灰填充保留给禁用状态，不用灰底表示普通可操作控件。参见 [通用组件接入](docs/component-kit.md)。

## 本地组件体验评审补充（2026-11-03）

- 标题、大号指标及关键内容文字使用中性色；颜色仅用于状态标签、必要的小字及图标。
- 门户和预览画布使用白色或中性灰，禁用灰绿色底色与灰绿色正文。
- 卡片选中状态不得增加描边或边框强调；键盘 focus-visible 指示仍保留。
- 删除重复标题、解释设计实现、无行动价值的说明文字。
- 保持现有组件职责和接口，以参考库的对应组件逐项匹配，避免新增平行组件体系。
- 完整改造后按 ui-skills 走查排版、间距、布局、点击目标、反馈、字号、信息层级及弹层尺寸；发现问题后修复并复查。

## UI acceptance criteria

Operator-facing principles, device baselines (phone, station touch console, desktop,
wall screen) and the delivery checklist live in [docs/operator-ux.md](docs/operator-ux.md).

- Body text, labels and enabled placeholders must have at least 4.5:1 contrast against their actual background in both themes. Test the composited color, including opacity. Enabled placeholders use `--tier0-text-placeholder` (`#6b6b6b` light / `#8b8b96` dark).
- Links, text buttons, selected radios and upload accents use readable `--tier0-brand` (`#467000` light / `#73b200` dark). Do not use `#73b200` for text on light surfaces (2.6:1). Text-button hover adds underline only — no color shift.
- Keyboard focus splits by control kind: buttons, tabs, chips, icon buttons and pagination use a light gray fill (`bg-muted`); text fields, selects, date pickers and checkboxes use `--ring` (`#B2ED1D`, both themes): border at 40% opacity and a 2px outer ring at 60%. Selected tabs use a 2px foreground underline.
- On phones and touch screens (`max-width: 639px`, `pointer: coarse`) text steps up one size, inputs reach 16px and every control reaches a 44px touch target.
- Sidebar selection uses `bg-muted text-foreground` in light mode and the one-step deeper `--tier0-sidebar-selected` (`#2a2b30`) in dark mode, with no border or shadow. Keyboard focus on rail items uses the same muted fill, not a brand outline.
- Same-row form controls and buttons use matching size tokens: sm 32px, md 36px, lg 40px.
- Sorting supports selecting, changing direction, deleting and reordering using both pointer and keyboard. At 375px, field labels must retain a readable width.
- Empty role sets show `未分配角色`, never a false `Loading` label.
