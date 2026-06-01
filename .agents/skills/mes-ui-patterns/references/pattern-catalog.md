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

## Visual Defaults

- Panel: `rounded-sm border border-border bg-card p-4`
- Inset area: `rounded-sm border border-border bg-surface-inset`
- Toolbar: `rounded-sm border border-border bg-card px-3 py-3`
- Status badge: icon + label, `rounded-sm border`, no color-only meaning
- KPI value: mono, tabular numbers, `text-2xl` to `text-3xl`
- Gantt row: 32-40px high, fixed resource column, timeline bars 20-24px high
- Chart panel: explicit height (`h-64`, `h-72`, or container-driven)

## Snippet Selection

Use:

- `toolbar` for workspace filter/action rows.
- `metric-card` for compact KPI grids.
- `state-badge` for status pills.
- `oee-gauge` for machine/line performance summaries.
- `gantt-board` for scheduling.
- `chart-panel` for Recharts wrappers.

Generate with:

```bash
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py list
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py toolbar
```

## Adaptation Checklist

- Rename generic entities to domain names.
- Replace placeholder actions with real API calls or route navigation.
- Keep browser-only chart/DnD subtrees inside `ClientOnly`.
- Add loading, empty, error, and pending states.
- Use `apiUrl()` for fetches.
- Use `toast.success()` and `toast.error()` for mutations.
- Verify mobile widths and text truncation.
