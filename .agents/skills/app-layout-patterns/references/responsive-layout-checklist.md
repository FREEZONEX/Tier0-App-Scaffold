# Responsive Layout Checklist

Use this before finalizing a new route group, layout shell, or major page.

## Layout Intent

- The layout is chosen by workflow and device, not role.
- `/` lands in the primary app experience.
- Workspace pages use Shell only when persistent navigation is valuable.
- A single app does not mix Shell-sidebar pages with no-sidebar pages. Role
  default routes, sidebar items, and in-app navigation all preserve the chosen
  app chrome.
- Station/review/monitor/custom task apps avoid sidebar navigation consistently
  for the whole app.

## Interactive Pages

Check these widths:

- 360px PDA / handheld scanner
- 375px mobile
- 768px tablet
- 1024px+ desktop

Requirements:

- Critical actions remain visible or reachable.
- Text does not overlap controls, counters, cards, or table cells.
- Long identifiers use `min-w-0`, `truncate`, or controlled wrapping.
- Header actions wrap into sensible rows.
- Tables reduce columns, become cards, or use horizontal overflow intentionally.
- Primary content scrolls inside a `min-h-0 flex-1` region.
- Modals/drawers fit mobile height and have keyboard-safe action buttons.

## PDA / Handheld Scanner

- Treat as Station unless the requirement is clearly read-only lookup.
- Treat as a special device profile, not a generic mobile breakpoint.
- Check 360-480px wide portrait screens before desktop polish.
- Check landscape PDA only after portrait works.
- Use a single-column task flow.
- Use larger operational typography than desktop:
  - labels: `text-base`
  - current scanned value / current task: `text-lg`
  - dominant quantity/status: `text-xl` to `text-2xl`
  - secondary metadata only may use `text-xs`
- Controls for scan/tap/confirm are 44-48px high.
- Scanner input is visible, focusable, and recovers focus after submit/error.
- Manual entry fallback is available for damaged or unreadable labels.
- Sticky bottom actions do not cover keyboard, scanner feedback, or validation.
- Lists are compact cards, not wide tables.
- Each card exposes identifier, state, quantity/location, and next action.
- Avoid two-column forms, sidebar navigation, dense dashboards, and hover-only
  affordances.

## Station / Kiosk

- Controls for scan/tap/confirm are 44-48px high.
- Current task and next action are visually dominant.
- Secondary data is reduced or moved below the primary action.
- Exception path is visible.
- Works with touch and scanner input.

## Review

- Queue, evidence, and decisions remain visible without excessive scrolling.
- Decision actions are sticky or repeated when evidence is long.
- Reason capture is not hidden behind icon-only controls.

## Monitor

Treat as a wallboard/TV device profile, not a desktop monitor. Check the target
display resolution, usually 16:9.

- Page frame uses `h-screen overflow-hidden`.
- Content uses stable grid tracks.
- Panels use `min-h-0 min-w-0 overflow-hidden`.
- No page-level scroll.
- Live tickers/logs constrain overflow inside their panel.
- Text uses monitor utilities or truncation and remains readable from distance:
  `monitor-kpi`, `monitor-title`, `monitor-text`, `monitor-label`, and
  `monitor-fit-text`.
- Use `monitor-grid` and `monitor-panel` for board composition instead of
  desktop dashboard card grids.
- KPI/status numbers are large enough to read at distance.
- Labels are short and semantic; avoid paragraph copy.
- No forms, drawers, row-action tables, hover-only controls, or interactions
  that require a mouse.
- Use semantic color blocks for alerts and line state, paired with readable
  text/icons.

## Common Fixes

- Add `min-h-0` to flex children that should scroll.
- Add `min-w-0` to grid/flex children with text.
- Replace fixed pixel widths with `minmax(0, 1fr)` grid tracks.
- Convert wide toolbar rows to `flex-wrap`.
- Use `overflow-x-auto` only for intentional wide data tables or timelines.
- Keep icon buttons at stable square sizes.
