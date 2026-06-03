# MES UI Pattern Catalog

This catalog replaces a copied `components/mes` library with small app-local
patterns. Use the named snippets from `scripts/demo_mes_snippets.py` as starting
points, then adapt them to the current domain.

## Pattern Map

| Old component idea | Scaffold-native pattern |
|---|---|
| `MetricCard` | App-local KPI tile with label, mono value, optional icon/trend/footer |
| `AnimatedNumber` | Optional motion spring number; use only when animation clarifies live data |
| `MiniSparkline` | Inline SVG sparkline, no chart dependency |
| `StateBadge` | Icon + label + semantic status token; color is redundant, not sole signal |
| `OEEGauge` / `ProgressRing` | Pure SVG ring gauge using status/chart tokens |
| `TargetBar` | Horizontal actual-vs-target bar with explicit numbers |
| `SPCChart` | Recharts line chart inside `ClientOnly`, explicit height, UCL/LCL/CL labels |
| `ParetoChart` | Recharts bar + cumulative line inside `ClientOnly` |
| `GanttChart` | CSS grid/timeline board with resource rows and percentage bars |
| `KanbanBoard` | dnd-kit board for state queues; keep cards domain-specific |
| `TimelineView` | Vertical event list with timestamp, actor, status icon |
| `ProcessFlow` / `StepIndicator` | Horizontal process tracker using flex/grid and connectors |
| `ShiftBar` | Time band with current marker and shift segments |
| `HeatmapGrid` | CSS grid of intensity cells with text/tooltips |
| `FleetGrid` | Dense equipment tiles with icon, state badge, and small metrics |
| `Leaderboard` | Ranked list with proportional bars; use only for meaningful ranking |
| `AlarmBanner` | High-priority alert strip with severity, action, and dismiss/persist behavior |

## Module Families

### Foundation

| Module | Use for |
|---|---|
| `toolbar` | Workspace filter rows, scoped actions, bulk actions |
| `metric-card` | KPI counts, rates, totals, trend snapshots |
| `summary-strip` | Dense page-top summaries with 4-8 operational counts |
| `state-badge` | Inline status display in cards, tables, panels, headers |
| `chart-panel` | Recharts wrapper with fixed height and `ClientOnly` |

### Execution Flow

| Module | Use for |
|---|---|
| `process-flow` | Route/stage progression across manufacturing steps |
| `step-indicator` | Short local subflow, wizard step, or execution phase |
| `target-bar` | Actual-versus-target progress with explicit numbers |

### Scheduling

| Module | Use for |
|---|---|
| `shift-bar` | Shift coverage, occupancy band, handover window |
| `gantt-board` | Resource-by-time dispatch and production schedule |

### Quality Analysis

| Module | Use for |
|---|---|
| `spc-chart` | Control limits, process stability, measurement variation |
| `pareto-chart` | Ranked defects, downtime, or loss causes with cumulative share |

### History & Review

| Module | Use for |
|---|---|
| `timeline` | Audit, genealogy, approvals, operator actions, exceptions |
| `kanban-board` | Queue by status, review disposition, work handoff |
| `leaderboard` | Ranked losses, defect codes, line comparison |

### Fleet & Monitoring

| Module | Use for |
|---|---|
| `heatmap-grid` | Intensity matrix across shifts/resources/lines |
| `fleet-grid` | Dense equipment or workstation status tiles |
| `oee-gauge` | OEE summary at line or machine level |
| `alarm-banner` | Critical alert that must be seen before deeper content |

## Visual Defaults

- Panel: `rounded-sm border border-border bg-card p-4`
- Inset area: `rounded-sm border border-border bg-surface-inset`
- Toolbar: `rounded-sm border border-border bg-card px-3 py-3`
- Status badge: icon + label, `rounded-sm border`, no color-only meaning
- Metric card: compact KPI tile, `rounded-sm border border-border bg-card px-3 py-2.5`, usually 72-88px tall
- Summary strip: use for dense page-top totals before a table or board; prefer it over a row of tall cards when there are 4-8 small counts
- KPI value: mono, tabular numbers, `text-2xl` to `text-3xl`, `leading-none`
- KPI layout: label/icon on the first row, value/unit/trend on the second row. Avoid large blank areas, stacked helper text, or `p-5`/`p-6` KPI cards in workspace dashboards.
- Gantt row: 32-40px high, fixed resource column, timeline bars 20-24px high
- Gantt board layout: always full parent width and alone on its row; never
  share a row with KPI cards, detail panels, filters, forms, or side summaries.
  Use `wide-operational-board` on the outer wrapper and `wide-operational-scroll`
  on an internal viewport. The outer board and parent containers must not
  become the horizontal scroll surface.
- Chart panel: explicit height (`h-64`, `h-72`, or container-driven)

## Snippet Selection

Use:

- `toolbar` for workspace filter/action rows.
- `metric-card` for compact KPI grids.
- `summary-strip` for compact page-top count summaries.
- `spc-chart` for process stability, control limits, and point-by-point variation.
- `pareto-chart` for ranked defect, downtime, or loss causes plus cumulative share.
- `timeline` for audit trail, event history, traceability chain, approval record, and change log views where chronology matters.
- `process-flow` for route/stage progression across manufacturing steps.
- `step-indicator` for compact wizard-like subflows or short execution phases.
- `state-badge` for status pills.
- `target-bar` for actual-versus-target progress with explicit numbers.
- `shift-bar` for shift coverage, occupancy bands, or time-window summaries.
- `heatmap-grid` for shift/resource/line intensity maps.
- `fleet-grid` for dense equipment or workstation status tiles.
- `kanban-board` for queue-by-status or disposition-by-column workflows.
- `alarm-banner` for high-priority operational alerts that must be seen before scrolling.
- `leaderboard` for ranked losses, downtime reasons, defect codes, or line comparisons.
- `oee-gauge` for machine/line performance summaries.
- `gantt-board` for scheduling.
- `chart-panel` for Recharts wrappers.

Generate with:

```bash
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py list
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py toolbar
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py summary-strip
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py spc-chart
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py pareto-chart
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py timeline
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py process-flow
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py kanban-board
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py fleet-grid
```

## Choice Rules

- Use `timeline` when order over time is the point; use `kanban-board` when
  column/status grouping is the point.
- Use `shift-bar` for one continuous time band; use `gantt-board` for many
  resources each with positioned work bars.
- Use `summary-strip` when the page needs quick counts above a board/table; use
  `metric-card` when each KPI needs its own trend, icon, footer, or emphasis.
- Use `process-flow` for primary manufacturing stages; use `step-indicator` for
  shorter local progress.
- Use `fleet-grid` when each asset needs its own compact tile; use
  `heatmap-grid` when the matrix pattern matters more than per-asset detail.
- Use `leaderboard` only when rank order matters more than exact chart shape.
- Use `spc-chart` for stability against limits; use `pareto-chart` for ranked
  causes and cumulative share.

## Adaptation Checklist

- Rename generic entities to domain names.
- Keep SPC limits explicit in the data contract; do not hide UCL/LCL/CL in page-local magic numbers unless the app is intentionally static.
- Use `pareto-chart` only when the bars are meaningfully ranked from high to low.
- Use timeline entries for actions, state changes, approvals, and exceptions; keep the event time, actor, and state visible in the first screen without requiring row expansion.
- Use `process-flow` for primary manufacturing stages and `step-indicator` for smaller local task progress inside a page or dialog.
- Use `target-bar` when the comparison is one-dimensional and operational, instead of spending a chart on it.
- Use `shift-bar` when the question is "who/what occupies this time band", not "what sequence runs on a resource row".
- Use `heatmap-grid` only when a matrix matters more than per-cell drill-in.
- Keep `fleet-grid` tiles compact; surface only the identifiers, state, and 2-4 metrics needed for action.
- Use `kanban-board` for status movement or decision queues; if drag is not needed, keep the same column/card shape and remove DnD behavior.
- Keep `alarm-banner` short, specific, and tied to an action or escalation path.
- Use `leaderboard` only when rank order matters more than precise chart reading.
- Replace placeholder actions with real API calls or route navigation.
- For Gantt pages, generate the full planning-board composition: compact top
  KPIs, legend, resource/load column, horizontal internal scroll, visible time
  labels, empty resource states, and real task operations.
- Keep browser-only chart/DnD subtrees inside `ClientOnly`.
- Add loading, empty, error, and pending states.
- Use `apiUrl()` for fetches.
- Use `toast.success()` and `toast.error()` for mutations.
- Verify mobile widths and text truncation.
