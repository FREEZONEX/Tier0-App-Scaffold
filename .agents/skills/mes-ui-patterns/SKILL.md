---
name: mes-ui-patterns
description: Generate app-local MES visualization and workspace UI snippets for this TanStack Start scaffold, including KPI cards, state badges, OEE/progress gauges, Gantt scheduling boards, process flows, timelines, heatmaps, fleet grids, kanban boards, shift bars, target bars, Pareto/SPC charts, and compact MES toolbars. Use when users ask for MES components, manufacturing dashboards, shop-floor visuals, scheduling/Gantt UI, OEE, SPC, status indicators, or to adapt an old components/mes library without copying it wholesale.
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
python3 .agents/skills/mes-ui-patterns/scripts/demo_mes_snippets.py gantt-board
```

The script outputs templates. Adapt names, props, actions, copy, colors, and
data fields to the current app before committing.

## Recommended Pattern Choices

- KPI dashboard: `metric-card`, `state-badge`, `chart-panel`, optional `oee-gauge`.
- Scheduling: `gantt-board` for CSS timeline scheduling; add drag/resize only if the user needs interactive dispatch.
- Shop-floor execution: `state-badge`, `process-flow`, `step-indicator`, `target-bar`, large station buttons.
- Quality: `spc-chart`, `pareto-chart`, `timeline`, evidence panels.
- Equipment/fleet: `fleet-grid`, `heatmap`, `alarm-banner`, `oee-gauge`.
- Queue/review: `kanban-board`, `timeline`, `leaderboard` only when ranking is meaningful.

## Implementation Notes

- Recharts must be wrapped in `ClientOnly` with an explicit-height parent.
- dnd-kit and motion layout features can also require `ClientOnly`.
- CSS/SVG gauges avoid Recharts and are often SSR-safe if they do not touch
  browser-only APIs during render.
- CSS Gantt boards are usually better than a heavy scheduler dependency for
  first-pass MES apps. Use explicit row height, resource column width, and
  percentage-based bars.
- Use `rounded-sm`, `border-border`, `bg-card`, `bg-surface-inset`, and status
  tokens from `globals.css` for consistency.
