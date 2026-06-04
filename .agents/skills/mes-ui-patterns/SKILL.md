---
name: mes-ui-patterns
description: Generate app-local MES visualization and workspace UI snippets for this TanStack Start scaffold, including KPI cards, summary strips, state badges, OEE/progress gauges, Gantt scheduling boards, process flows, timelines, heatmaps, fleet grids, kanban boards, shift bars, target bars, Pareto/SPC charts, and compact MES toolbars. Use when users ask for MES components, manufacturing dashboards, shop-floor visuals, scheduling/Gantt UI, OEE, SPC, status indicators, or to adapt an old components/mes library without copying it wholesale.
---

# MES UI Patterns

Use this skill to build MES-specific UI without keeping a bundled
`src/components/mes` component library in the scaffold.

The goal is to extract reusable patterns into app-local snippets. Create only
the components needed by the current app, usually under `src/components/<domain>/`
or next to the owning route.

## Rules

- Do not copy an entire `src/components/mes` directory into the app.
- Do not import from `@/components/mes` unless the current app intentionally
  owns a small local domain folder with that name.
- Do not import from `@/components/ui` unless those app-local primitives were
  intentionally created in the current app.
- Prefer Tailwind, `cn()` from `@/lib/utils`, lucide-react, Recharts inside
  `ClientOnly`, TanStack Table, dnd-kit, and `@/lib/motion`.
- Keep snippets compact, typed, and domain-adapted.
- Pair color with text or icons for industrial status readability.

## Read First

- `DESIGN.md`
- `.agents/skills/uns-swe-ui-generation/SKILL.md`
- current target route/component
- `src/styles/globals.css`
- current domain schema/service shape, if data-driven

## Pattern Catalog

Read `references/pattern-catalog.md` when selecting patterns. It maps common
old `components/mes` ideas to scaffold-native snippets.

## Demo Script

Use the script to print starter snippets:

```bash
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py list
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py metric-card
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py summary-strip
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py spc-chart
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py pareto-chart
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py timeline
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py process-flow
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py kanban-board
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py fleet-grid
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py gantt-board
```

`list` now prints the grouped module inventory with one-line summaries. The
script outputs templates. Adapt names, props, actions, copy, colors, and data
fields to the current app before committing.

## Module Inventory

### Foundation

- `toolbar`: workspace filter/action row
- `metric-card`: compact KPI tile
- `summary-strip`: dense page-top KPI summary for 4-8 operational counts
- `state-badge`: status pill
- `chart-panel`: fixed-height `ClientOnly` chart wrapper

### Execution Flow

- `process-flow`: manufacturing stage progression
- `step-indicator`: short local task-step indicator
- `target-bar`: actual-versus-target bar

### Scheduling

- `shift-bar`: shift coverage and handover windows
- `gantt-board`: resource-by-time schedule board

### Quality Analysis

- `spc-chart`: control chart with CL/UCL/LCL
- `pareto-chart`: ranked cause bars plus cumulative line

### History & Review

- `timeline`: audit, genealogy, approval, and action history
- `kanban-board`: queue-by-status board
- `leaderboard`: ranked loss/defect/downtime list

### Fleet & Monitoring

- `heatmap-grid`: intensity matrix
- `fleet-grid`: dense equipment/workstation status grid
- `oee-gauge`: OEE summary gauge
- `alarm-banner`: high-priority alert strip

## Choose Between Similar Patterns

- `timeline` vs `gantt-board` vs `shift-bar`:
  `timeline` is chronological history, `gantt-board` is scheduled work on
  resources, `shift-bar` is occupancy or shift coverage across one time band.
- `process-flow` vs `step-indicator`:
  `process-flow` is for manufacturing stages with richer state, while
  `step-indicator` is for short local progress inside one task or dialog.
- `heatmap-grid` vs `fleet-grid` vs `leaderboard`:
  `heatmap-grid` is matrix comparison, `fleet-grid` is per-asset status, and
  `leaderboard` is ordered ranking.
- `spc-chart` vs `pareto-chart`:
  `spc-chart` is for stability and control limits; `pareto-chart` is for ranked
  causes and cumulative share.

## Recommended Pattern Choices

- KPI dashboard: `summary-strip` for dense page-top totals, `metric-card` for individual emphasis, `state-badge`, `chart-panel`, optional `oee-gauge`.
- Scheduling: `gantt-board` for the full scheduling page composition (summary strip/KPI row, legend, resource load, full-width CSS timeline board, task actions) and `shift-bar` for shift coverage, handover windows, or machine occupation bands.
- History / audit / traceability: `timeline` for chronological event streams, approval history, genealogy hops, operator actions, and exception logs. Prefer it over a generic stacked card list when order and handoff matter.
- Shop-floor execution: `state-badge`, `process-flow`, `step-indicator`, `target-bar`, large station buttons.
- Quality: `spc-chart`, `pareto-chart`, `timeline`, evidence panels.
- Equipment/fleet: `fleet-grid`, `heatmap-grid`, `alarm-banner`, `oee-gauge`.
- Queue/review: `kanban-board`, `timeline`, `leaderboard` only when ranking is meaningful.

## Implementation Notes

- Recharts must be wrapped in `ClientOnly` with an explicit-height parent.
- dnd-kit and motion layout features can also require `ClientOnly`.
- CSS/SVG gauges avoid Recharts and are often SSR-safe if they do not touch
  browser-only APIs during render.
- CSS Gantt boards are usually better than a heavy scheduler dependency for
  first-pass MES apps. Use token-backed utilities for row sizing, resource
  columns, and internal scroll. Avoid arbitrary pixel widths such as
  `min-w-[1100px]` or `grid-cols-[220px_minmax(...)]`; they often make the
  page or parent container overflow.
- Gantt boards must include a readable timeline header, not just positioned
  bars. Use separate date and time rows, visible grid lines, and a readable
  minimum tick width so labels do not crowd together. Long timelines should
  scroll inside `wide-operational-scroll`.
- A scheduling/Gantt page should feel like an operational planning board, not
  a small chart card. Include page-level context, compact top KPIs, a legend,
  resource load, empty rows, task time labels, and real task actions such as
  delay, lock, release, or reschedule when the requirements call for them.
- Gantt boards and other horizontally long operational views must occupy the
  full parent width and must not be placed in the same row as filters, KPI
  cards, detail panels, forms, or side summaries. Put controls above the board
  or below it. Use `wide-operational-board` on the outer board wrapper so it
  spans all grid columns and takes a full flex row. The outer wrapper must not
  scroll horizontally; put `wide-operational-scroll` on an internal viewport and
  use `gantt-board-grid` / `gantt-scroll-content` so the long timeline scrolls
  inside the board instead of making the parent container or page scroll.
- Use the Gantt-specific token classes from `globals.css` for Gantt colors:
  `bg-gantt-planned-bg`, `bg-gantt-running-bg`, `bg-gantt-risk-bg`,
  `bg-gantt-done-bg`, `bg-gantt-locked-bg`, and matching `border-*` / `text-*`.
  These preserve the support Gantt visual language without copying hardcoded
  `blue-*`, `amber-*`, `emerald-*`, or `violet-*` classes into snippets.
- KPI/summary tiles inside Gantt and dashboards should avoid plain white cards
  when they sit on a white panel. Use semantic tone variety across adjacent KPI
  tiles: highlight for totals, blue/info for active work, green/running for
  healthy progress, amber/risk for warnings, and red/error for blockers. Do not
  render a whole KPI row as one neutral color unless the metrics are purely
  informational.
