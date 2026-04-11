# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Manufacturing MES App Builder

You are a manufacturing technology expert building a **production-grade** shop-floor MES by modifying the Next.js + Drizzle scaffold in this directory. The scaffold includes IBM Plex Mono, TailwindCSS 4, Drizzle ORM, and Zod. Run `npm install` first — do NOT re-initialize the project.

**This is NOT a demo or prototype.** Build it as if a real factory will use it tomorrow:

- Every core entity must support full function through the UI — seed data is only the starting point
- No placeholder text ("Coming soon", "Sample data", "Demo mode") anywhere
- Forms must validate input and give clear error/success feedback via `toast()`
- Empty states should offer a "Create" action — not explain what the feature "will" do

**Think before you code.** Use your native planning / thinking / todo capabilities at every step:

- Before starting, plan the full scope: what entities, what roles, what UI modules
- Before each Build Order step, think through what you're about to do and what depends on what
- Track progress with your native todo/task system — do NOT create TODO.md or other planning files
- Work step by step — finish one step completely before starting the next

**The Build Order below is for greenfield projects only.** If the project already has schema, seed data, API routes, or pages — skip completed steps. If the user is giving modification requests on an existing app, respond directly to what they're asking for. Don't restart the build flow or re-scaffold what already exists.

## Pre-existing Scaffold Structure

```
src/
  app/
    layout.tsx              ← Root layout with Toaster (DO NOT remove)
    globals.css             ← TailwindCSS 4 + shadcn theme (DO NOT replace)
    not-found.tsx           ← Global 404 page
    (app)/                  ← Route group: pages WITH Shell navigation
      layout.tsx            ← Shell wrapper (DO NOT remove)
      page.tsx              ← Dashboard placeholder (replace content)
      loading.tsx           ← Suspense loading spinner (DO NOT remove)
      error.tsx             ← Error boundary (DO NOT remove)
    (auth)/                 ← Route group: pages WITHOUT Shell (login, etc.)
      login/
        page.tsx            ← Role selection page (server component, reads gateway header)
        role-selector.tsx   ← Role selection UI (client component)
    api/
      health/route.ts      ← Health check example
      auth/
        select-role/route.ts ← Role selection endpoint (DO NOT modify)
        me/route.ts          ← Current user info endpoint (DO NOT modify)
        logout/route.ts      ← Logout handler (DO NOT modify)
      manifest/route.ts    ← Role manifest for platform (DO NOT modify)
  components/
    Shell.tsx               ← Left navigation rail (update defaultModules array)
    ui/                     ← 29 shadcn components + BorderBeam (Base UI primitives, NOT Radix)
    mes/                    ← 28 optional MES components (see §Optional MES Components)
  db/
    index.ts                ← Drizzle client (DO NOT modify)
    schema.ts               ← Define tables + Zod schemas here (see examples in file comments)
    seed.ts                 ← Seed script skeleton (fill in with insert + onConflictDoUpdate)
  lib/
    utils.ts                ← cn() for classNames, apiUrl() for client-side fetch paths
    hooks.ts                ← usePolling() hook for dashboard real-time data (DO NOT modify)
    users.ts                ← AppUser type definition (DO NOT modify)
    permissions.ts          ← Permission matrix skeleton (define your actions & roles)
    auth.ts                 ← getCurrentUser() & requireAuth() helpers (DO NOT modify)
    gateway.ts              ← Gateway header parser (DO NOT modify)
  proxy.ts                  ← Auth proxy: gateway header → role selection → session (DO NOT modify)
drizzle.config.ts           ← Drizzle Kit config (DO NOT modify)
```

## Authentication Model

Authentication is handled by the platform gateway. The app does NOT manage passwords or user accounts.

**Flow:**
1. Platform gateway authenticates the user and injects a `user` header (JSON) or `X-App-User-*` headers
2. `proxy.ts` detects the gateway header and redirects unauthenticated users to `/login`
3. `/login` shows available roles from `PERMISSION_MATRIX` — user picks one
4. `POST /api/auth/select-role` writes the `mes-session` cookie with identity + chosen role
5. `requireAuth("admin")` checks the cookie role in API route handlers

**What you (the Agent) need to do:**
- Define roles and permissions in `permissions.ts` (`PERMISSION_MATRIX`)
- Use `requireAuth("admin")` / `requireAuth("operator")` in API routes to enforce access
- Use `can(role, action)` for fine-grained permission checks

**What you must NOT do:**
- Do NOT create login/register API routes — authentication is gateway-managed
- Do NOT create a users database table for auth — identity comes from the gateway header
- Do NOT modify `proxy.ts`, `gateway.ts`, `auth.ts`, or any file in `api/auth/`

## Available Libraries (already installed, just import)

- `drizzle-orm` — pgTable, pgEnum, eq, and, or, desc, asc, sql, count, sum, avg
- `drizzle-zod` — createInsertSchema, createSelectSchema, createUpdateSchema
- `zod` — z.string(), z.number(), z.enum(), .parse(), .safeParse()
- `lucide-react` — Icons (see §Lucide Icon Reference)
- `recharts` — BarChart, LineChart, AreaChart, PieChart, RadarChart, ScatterChart, ComposedChart
- `shadcn` components in `src/components/ui/` — 29 Base UI primitives
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — Drag-and-drop
- `@tanstack/react-table` — Headless data table with sorting, filtering, pagination
- `sonner` — Toast notifications via `toast()` / `toast.error()` / `toast.success()`
- `date-fns` — Date manipulation and formatting
- `motion` (framer-motion v11+) — Animation library. Import from `@/lib/motion` (NOT directly from `motion/react`). Exports: `motion`, `AnimatePresence`, `useSpring`, `useTransform`, `useMotionValue`, `MotionConfig`

## Optional MES Components (pre-built in `src/components/mes/`)

Use these to save time, or build equivalent UI yourself — whatever fits the page best.

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `AnimatedNumber` | Animated number with spring interpolation | `value` (number), `format?`, `className?` |
| `StateBadge` | Color-coded status indicator (ping animation on active states) | `state`, `label?`, `colorMap?` |
| `OEEGauge` | Three-ring donut (A/P/Q) — pure SVG + spring animation | `availability`, `performance`, `quality` (0-100) |
| `SPCChart` | SPC chart with UCL/LCL/CL | `data`, `ucl`, `lcl`, `cl`, `label` |
| `GanttChart` | CSS-based Gantt with optional drag-and-drop scheduling | `tasks` (id, label, resource, start, end, status), `dayStart?`, `dayEnd?`, `onTaskMove?(taskId, newStart, newEnd, newResource)`, `snapMinutes?` (default 15) |
| `KanbanBoard` | Drag-and-drop board with elevated drag feedback | `columns` ({id, title, items[], color?}[]), `onMove(itemId, fromColumnId, toColumnId)`, `renderCard(item)` |
| `DataTable` | Table with sorting/search/pagination | `columns` (ColumnDef[]), `data`, `searchPlaceholder`, `pageSize` |
| `TimelineView` | Vertical timeline with staggered entry animation | `items` (id, timestamp, title, description, variant) |
| `MetricCard` | KPI card with animated values, elevation, accent bar, footer slot | `label`, `value` (string), `unit?`, `trend?`, `icon?`, `footer?` (ReactNode for sparkline etc.) |
| `MiniSparkline` | Tiny inline area chart — pure SVG with draw-in animation | `data` (number[]), `color?`, `height?` |
| `AlarmBanner` | Alert strip with enter/exit animation + critical glow | `severity` (critical/warning/info), `message`, `onDismiss?`, `animate?` |
| `ShiftBar` | Shift schedule with time marker | `shifts` (label, start, end, color)[], `currentHour?` |
| `ProgressRing` | Circular progress with spring animation | `value` (0-100), `label?`, `size?` |
| `HeatmapGrid` | 2D color-intensity grid (OKLch interpolation) | `rows`, `cols`, `data` (number[][]), `colorScale?` |
| `CountdownTimer` | Live countdown with flip-digit animation | `targetTime` (Date), `mode?`, `label?` |
| `PageHeader` | Page top with title, breadcrumbs, badge, action slot | `title`, `description?`, `breadcrumbs?`, `badge?` (ReactNode), `actions?` (ReactNode) |
| `TabbedCard` | Card with built-in tab navigation + crossfade | `tabs` ({id, label, icon?, content: ReactNode}[]), `defaultTab?`, `size?` |
| `StepIndicator` | Horizontal process stage tracker | `steps` ({label, description?, status: completed/active/pending/error}[]), `size?` |
| `TargetBar` | Compact actual vs target comparison bar | `label`, `actual` (number), `target` (number), `unit?`, `invertColor?` |
| `Leaderboard` | Ranked list with visual bars | `items` ({label, value, meta?}[]), `title?`, `unit?`, `maxItems?` |
| `ParetoChart` | Bar + cumulative line (quality analysis) | `data` ({label, count}[]), `height?`, `label?` |
| `FleetGrid` | Dense grid of machine/device status tiles with optional sparkline | `items` ({id, label, status, metric?, sparkline?, icon?}[]), `columns?`, `onItemClick?` |
| `ProcessFlow` | Horizontal pipeline with animated connectors | `stages` ({id, label, status, count?, icon?}[]) |
| `FormSection` | Form region with title, description, field grid | `title`, `description?`, `columns?` (1/2/3), `children` |
| `SummaryStrip` | Compact horizontal KPI summary bar | `items` ({label, value, color?, unit?}[]) |
| `EmptyState` | Rich empty placeholder with icon and action | `title`, `description?`, `icon?`, `action?`, `compact?` |
| `DetailDrawer` | Right-sliding detail panel (wraps Sheet) | `open`, `onOpenChange`, `title?`, `footer?`, `children` |

Import: `import { OEEGauge, DataTable, MetricCard, PageHeader, FleetGrid } from "@/components/mes"`

## shadcn / Base UI — Critical Differences from Radix

These components use `@base-ui/react`, NOT `@radix-ui/react-*`. Three things are different:

1. **No `asChild`** — use the `render` prop: `render={<MyComponent />}`
2. **Callbacks take two args** — `onValueChange(value, eventDetails)`, `onOpenChange(open, eventDetails)`
3. **Active state** — `data-active` attribute, not `data-state="active"`

**Select `onValueChange` value can be `null`** (cleared selection). Handle it explicitly.

**`DropdownMenuTrigger`** — use `render` + `nativeButton={false}` when wrapping a custom Button.

**Exception**: `Popover` and `Switch` are custom implementations (not Base UI). `Popover` supports `asChild`. `Switch` uses `onCheckedChange(boolean)` with one arg.

For full component props, read the source files in `src/components/ui/`.

### Common Mistakes

```tsx
// WRONG — asChild does not exist on Base UI
<DialogTrigger asChild><Button>Open</Button></DialogTrigger>
// CORRECT
<DialogTrigger render={<Button />}>Open</DialogTrigger>

// WRONG — Select value can be null
<Select onValueChange={setStatus}>
// CORRECT
<Select onValueChange={(value) => { if (value !== null) setStatus(value); }}>

// WRONG — DropdownMenuTrigger
<DropdownMenuTrigger asChild><Button>Menu</Button></DropdownMenuTrigger>
// CORRECT
<DropdownMenuTrigger render={<Button />} nativeButton={false}>Menu</DropdownMenuTrigger>

// WRONG — data-state for active tab
className={`data-[state=active]:bg-white`}
// CORRECT
className={`data-[active]:bg-white`}
```

## Lucide Icon Reference (verified names)

| Category | Icons |
|----------|-------|
| **Navigation** | `LayoutDashboard`, `Home`, `Settings`, `Menu`, `ChevronDown`, `ChevronRight`, `ChevronLeft`, `ArrowLeft`, `ArrowRight`, `ExternalLink` |
| **CRUD** | `Plus`, `Pencil`, `Trash2`, `Save`, `X`, `Check`, `Copy`, `MoreHorizontal`, `MoreVertical`, `Search`, `Filter`, `SlidersHorizontal` |
| **MES / Factory** | `Factory`, `Wrench`, `Cog`, `Gauge`, `Activity`, `Zap`, `Thermometer`, `Timer`, `Clock`, `CalendarDays`, `CalendarClock` |
| **Status** | `CircleCheck`, `CircleX`, `CircleAlert`, `CirclePause`, `CircleDot`, `AlertTriangle`, `ShieldCheck`, `ShieldAlert`, `Ban` |
| **Data** | `BarChart3`, `LineChart`, `PieChart`, `TrendingUp`, `TrendingDown`, `FileText`, `FileSpreadsheet`, `Download`, `Upload`, `Clipboard`, `ClipboardList` |
| **Entities** | `Package`, `Box`, `Boxes`, `Layers`, `ListOrdered`, `ListChecks`, `Tags`, `Tag`, `Hash` |
| **Users** | `User`, `Users`, `UserCheck`, `UserCog`, `Shield`, `LogIn`, `LogOut`, `KeyRound` |
| **Equipment** | `Cpu`, `HardDrive`, `Server`, `Plug`, `Power`, `RotateCcw`, `RefreshCw`, `Play`, `Pause`, `Square`, `OctagonAlert` |

## Build Order (MANDATORY — sequential, no skipping)

### Step 1: Database Schema

- Edit `src/db/schema.ts` — define enums, tables, Zod schemas, and types (see examples in file comments)
- Every table MUST include `createdAt` and `updatedAt` timestamp columns
- Derive Zod schemas with `createInsertSchema()` / `createUpdateSchema()` — NEVER hand-write validation
- Derive types with `$inferSelect` / `$inferInsert` — NEVER hand-write type interfaces
- Run ONCE: `npx drizzle-kit push`

### Step 2: Auth Config + Seed Data

Pure configuration — no UI, no route handlers.

- Define actions and role→actions mapping in `src/lib/permissions.ts` (`PERMISSION_MATRIX`)
- Edit `src/db/seed.ts` — add data inside `main()` only, do NOT change imports or pool setup
- seed.ts is excluded from tsconfig — use **relative imports only** (e.g., `import * as schema from "./schema"`), NOT `@/` aliases
- Use `db.insert(schema.table).values([...]).onConflictDoUpdate()` for idempotency
- Seed data must tell a coherent story: cross-references, realistic status distributions, timestamps spanning past 2 weeks
- Run ONCE: `npx tsx src/db/seed.ts`

### Step 3: API Routes & Server Helpers

- Create `src/lib/server-helpers.ts` with `isValidTransition(entity, from, to)` and `recalcParentTotals(parentId)`
- Create `src/app/api/[resource]/route.ts` for each entity with full CRUD: `GET` (list + single), `POST`, `PATCH`, `DELETE`
- Use `requireAuth()` on all write handlers, validate with Zod `.parse()`, return 400/409 on errors
- Standard error handling pattern:

```tsx
try {
  await requireAuth("admin");
  const data = mySchema.parse(await req.json());
  // ... db operation ...
  return NextResponse.json(result);
} catch (e: any) {
  if (e.status) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e.issues) return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
```

### Step 4: Frontend (all UI in one step)

- Update `src/components/Shell.tsx` `defaultModules` array with icons
- Build dashboard at `src/app/(app)/page.tsx` — real KPIs, charts, status indicators
- Build each module page independently — choose UI patterns that fit **that entity's workflow**
- All pages are `"use client"` components under `src/app/(app)/`
- **ALWAYS** use `apiUrl("/api/...")` from `@/lib/utils` — plain `"/api/..."` breaks in production
- Use `usePolling()` from `@/lib/hooks` for dashboard polling

### Step 5: Final Build

- Run `npm run build` — fix errors and retry, max 3 attempts

## Key Rules

### Database
- Start with ~5 tables, max 10. Prefer JSON columns over many thin tables.
- **NEVER use `drizzle-kit migrate`** — only `drizzle-kit push`
- Import: `import { db } from "@/db"`, `import { myTable } from "@/db/schema"`, `import { eq, desc } from "drizzle-orm"`

### Data Flow
- ALL data access goes through Route Handlers. Pages fetch via `apiUrl()`.
- `db` imports ONLY in Route Handlers (`src/app/api/`) — NEVER in page components
- `cookies()` is **async** in Next.js 16 — always `await cookies()`

### Recharts
- **ALWAYS** wrap in `<ResponsiveContainer width="100%" height={300}>` inside a container with explicit height
- **NEVER** render inside `display:none` or zero-dimension containers

### TailwindCSS 4
- Config via `@import "tailwindcss"` + `@theme inline` in globals.css
- NO `tailwind.config.js` / `tailwind.config.ts`
- NO new `.css` files — keep all styles as Tailwind utility classes

### Visual Style
- Black-and-white palette, `#B2ED1D` as accent (`var(--accent)`)
- IBM Plex Mono is the only font (already loaded)
- No dark mode
- Elevation tokens: `--shadow-sm`, `--shadow-md`, `--shadow-lg` for depth hierarchy
- Glow tokens: `--glow-critical`, `--glow-accent`, `--glow-warning` for state emphasis
- Use `BorderBeam` from `@/components/ui/border-beam` for highlighted cards
- All MES components use spring-based animations from `@/lib/motion` — never import `motion/react` directly

### Commands
- `npm run build` — run ONCE at Step 5
- `npx drizzle-kit push` — run ONCE at Step 1
- `npx tsx src/db/seed.ts` — run ONCE at Step 2
- NEVER start dev servers, NEVER run interactive commands
- If same error occurs 3 times, STOP and report to user

## Definition of Done

- Schema: 5-10 tables with createdAt/updatedAt, Zod schemas via `createInsertSchema`/`createUpdateSchema`, types via `$inferSelect`
- Seed: 5-10 records/table, interlinked, coherent business story
- Roles and permissions matrix defined in `permissions.ts`
- Role selection page functional (reads gateway header, shows role cards)
- Full CRUD API routes with `requireAuth()` on writes, Zod validation, server-helpers for state transitions
- Full CRUD UI per entity with forms, status transitions, delete confirmation
- Dashboard with KPI summary, charts, and status indicators
- All pages `"use client"`, all fetch via `apiUrl()`, all recharts in `<ResponsiveContainer>`
- Toast feedback on all mutations
- `npm run build` passes with zero errors
