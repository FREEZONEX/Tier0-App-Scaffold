# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Manufacturing MES App Builder

You are a manufacturing technology expert building a **production-grade** shop-floor MES by modifying the Next.js + Drizzle scaffold in this directory. The scaffold includes IBM Plex Mono, TailwindCSS 4, Drizzle ORM, and Zod. Do NOT re-initialize the project.

## Preview Workflow (MCP)

Dependencies are installed automatically the first time you call `preview_start`. **DO NOT run `npm install` manually** — it will race with the managed install and corrupt `node_modules` on the shared volume.

When you've completed a meaningful code change and want to show the user:
1. Call the `preview_start` MCP tool (waits for install + dev server + port ready)
2. If it returns `state: "failed"`, call `preview_logs` to see the error
3. Fix the issue, then call `preview_restart`
4. Tell the user "preview is ready" — the public preview URL is delivered to the UI automatically through a separate channel. **You do NOT need to include a URL in your message.** The `url` field returned by the tool (e.g. `http://127.0.0.1:3000`) is a container-internal loopback address for self-check only; never paste it to the user.

After installing a new npm dependency (e.g. `npm install uuid`), call `preview_restart` to reload the dev server.

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
    layout.tsx              ← Root layout: fonts, globals.css, Toaster (DO NOT remove)
    globals.css             ← TailwindCSS 4 + theme tokens + CSS variables (DO NOT replace)
    not-found.tsx           ← Global 404 page
    (app)/                  ← Route group: pages WITH Shell navigation
      layout.tsx            ← Shell wrapper — server component, imports Shell (DO NOT remove)
      page.tsx              ← Dashboard placeholder (replace content, keep "use client")
      loading.tsx           ← Suspense boundary spinner (DO NOT remove)
      error.tsx             ← Error boundary — must be "use client" (DO NOT remove)
    (auth)/                 ← Route group: pages WITHOUT Shell (login, etc.)
      login/
        page.tsx            ← Role selection — server component (reads gateway header via await headers())
        role-selector.tsx   ← Role selection UI — client component (handles POST + redirect)
    api/
      health/route.ts      ← Health check example
      auth/
        select-role/route.ts ← Role selection endpoint (DO NOT modify)
        me/route.ts          ← Current user info endpoint (DO NOT modify)
        logout/route.ts      ← Logout handler (DO NOT modify)
      manifest/route.ts    ← Role manifest for platform (DO NOT modify)
  components/
    Shell.tsx               ← Left sidebar nav rail — client component (update defaultModules array)
    ui/                     ← 29 shadcn components + BorderBeam — ALL use @base-ui/react, NOT Radix
    mes/                    ← 28 optional MES domain components (see §Optional MES Components)
  db/
    index.ts                ← Drizzle client with connection pooling + DB_SCHEMA support (DO NOT modify)
    schema.ts               ← Define enums, tables, Zod schemas, types here (see examples in file comments)
    seed.ts                 ← Seed script — uses relative imports only, NOT @/ aliases (DO NOT change imports/pool)
  lib/
    utils.ts                ← cn() for classNames, apiUrl() for base-path-aware fetch URLs
    hooks.ts                ← usePolling<T>(url, interval) for real-time dashboard data (DO NOT modify)
    motion.ts               ← Re-exports motion/react with "use client" — always import from here
    users.ts                ← AppUser type definition (DO NOT modify)
    permissions.ts          ← Permission matrix skeleton — define your actions, roles, PERMISSION_MATRIX here
    auth.ts                 ← getCurrentUser() & requireAuth() — server-only, uses await cookies() (DO NOT modify)
    gateway.ts              ← Gateway header parser — 3 formats: JSON user, X-App-User-*, minimal (DO NOT modify)
  proxy.ts                  ← Auth middleware: gateway header → role selection → session cookie (DO NOT modify)
drizzle.config.ts           ← Drizzle Kit config, supports DB_SCHEMA + DIRECT_DATABASE_URL (DO NOT modify)
docs/
  platform-integration.md  ← Deployment docs: env vars, auth flow, platform resource model
skills/
  next-best-practices/     ← Reference: async patterns, hydration errors, error handling, route handlers
  shadcn/                   ← Reference: shadcn/Base UI component rules, composition, styling
```

## Server / Client Boundary

```
Server Components (no "use client"):
  src/app/layout.tsx, src/app/(app)/layout.tsx, src/app/(auth)/login/page.tsx, src/app/not-found.tsx

Client Components ("use client"):
  ALL pages under (app)/, src/components/Shell.tsx, src/components/mes/*, src/lib/motion.ts

Server-Only (Route Handlers):
  src/app/api/** — Drizzle DB access, cookies()
```

`(app)/layout.tsx` is a server component that renders `<Shell>` (client). All pages under `(app)/` must be `"use client"`.

## Authentication Model

Authentication is handled by the platform gateway. The app does NOT manage passwords or user accounts.

**Flow:**
1. Platform gateway authenticates the user → injects `user` header (JSON) or `X-App-User-*` headers
2. `proxy.ts` detects the gateway header → redirects unauthenticated users to `/login`
3. `/login` reads available roles from `PERMISSION_MATRIX` → user picks one
4. `POST /api/auth/select-role` writes `mes-session` cookie (httpOnly, 7-day expiry) with identity + chosen role
5. `requireAuth("admin")` in API route handlers checks cookie role, throws `{ status, message }` on failure

**What you (the Agent) need to do:**
- Define roles and permissions in `permissions.ts` (`PERMISSION_MATRIX`)
- Use `requireAuth("admin")` / `requireAuth("operator")` in API routes to enforce access
- Use `can(role, action)` for fine-grained permission checks in UI or routes

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
- `shadcn` components in `src/components/ui/` — 29 Base UI primitives (**NOT Radix** — ignore `@radix-ui/*` in package.json, those are unused)
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — Drag-and-drop
- `@tanstack/react-table` — Headless data table with sorting, filtering, pagination
- `sonner` — Toast notifications via `toast()` / `toast.error()` / `toast.success()`
- `date-fns` — Date manipulation and formatting
- `motion` — Import from `@/lib/motion` (NOT `motion/react`). Exports: `motion`, `AnimatePresence`, `useSpring`, `useTransform`, `useMotionValue`, `MotionConfig`

## Optional MES Components (`src/components/mes/`)

All `"use client"`. Import: `import { OEEGauge, DataTable, MetricCard } from "@/components/mes"`

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `MetricCard` | KPI card with animated value, trend, accent bar, footer slot | `label`, `value`, `unit?`, `trend?`, `icon?`, `footer?` (ReactNode) |
| `AnimatedNumber` | Spring-interpolated number display | `value`, `format?`, `className?` |
| `MiniSparkline` | Tiny inline SVG area chart (~40px) | `data` (number[]), `color?`, `height?` |
| `SummaryStrip` | Compact horizontal KPI bar | `items` ({label, value, color?, unit?}[]) |
| `OEEGauge` | Three-ring donut (A/P/Q) — pure SVG | `availability`, `performance`, `quality` (0-100), `size?` |
| `ProgressRing` | Circular progress with spring animation | `value` (0-100), `label?`, `size?` |
| `TargetBar` | Actual vs target comparison bar | `label`, `actual`, `target`, `unit?`, `invertColor?` |
| `SPCChart` | SPC chart with UCL/LCL/CL (Recharts) | `data`, `ucl`, `lcl`, `cl`, `label?` |
| `ParetoChart` | Bar + cumulative % line (Recharts) | `data` ({label, count}[]), `height?`, `label?` |
| `HeatmapGrid` | 2D color-intensity grid (OKLch) | `rows`, `cols`, `data` (number[][]), `colorScale?` |
| `GanttChart` | CSS Gantt, optional drag-to-reschedule | `tasks` (GanttTask[]), `dayStart?`, `dayEnd?`, `onTaskMove?`, `snapMinutes?` |
| `KanbanBoard` | Drag-and-drop multi-column board (@dnd-kit) | `columns` (KanbanColumn[]), `onMove`, `renderCard` |
| `TimelineView` | Vertical timeline with staggered animation | `items` (TimelineItem[]) |
| `ProcessFlow` | Horizontal pipeline with animated connectors | `stages` ({id, label, status, count?, icon?}[]) |
| `StepIndicator` | Horizontal step tracker | `steps` ({label, description?, status}[]), `size?` |
| `CountdownTimer` | Countdown/count-up with flip digits | `targetTime` (Date), `mode?`, `label?`, `warningThreshold?`, `compact?` |
| `ShiftBar` | Shift schedule bar with time marker | `shifts` ({label, start, end, color}[]), `currentHour?` |
| `DataTable` | Table: sorting, search, pagination (@tanstack/react-table) | `columns` (ColumnDef[]), `data`, `searchPlaceholder?`, `pageSize?` |
| `FleetGrid` | Dense machine status tile grid | `items` ({id, label, status, metric?, sparkline?}[]), `columns?`, `onItemClick?` |
| `Leaderboard` | Ranked list with visual bars | `items` ({label, value, meta?}[]), `title?`, `unit?` |
| `StateBadge` | Color-coded status with optional ping animation | `state`, `label?`, `colorMap?` |
| `PageHeader` | Title + breadcrumbs + action slot | `title`, `description?`, `breadcrumbs?`, `badge?`, `actions?` |
| `TabbedCard` | Card with tab navigation + crossfade | `tabs` ({id, label, icon?, content}[]), `defaultTab?` |
| `DetailDrawer` | Right-sliding panel (wraps Sheet) | `open`, `onOpenChange`, `title?`, `footer?`, `children` |
| `FormSection` | Form region with column grid | `title`, `description?`, `columns?` (1/2/3), `children` |
| `EmptyState` | Empty placeholder with icon + action | `title`, `description?`, `icon?`, `action?`, `compact?` |
| `AlarmBanner` | Alert strip with animation + critical glow | `severity`, `message`, `onDismiss?` |
| `Toaster` | Already mounted in root layout | Just call `toast()`, `toast.success()`, `toast.error()` |

## shadcn / Base UI — Critical Differences from Radix

UI components use `@base-ui/react`, NOT `@radix-ui/react-*`. Three differences:

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

## Hydration Pitfalls

```tsx
// 1. Date/Time — WRONG: mismatch between server/client timezones
<span>{new Date().toLocaleString()}</span>
// CORRECT: render in "use client" with useEffect
const [time, setTime] = useState(""); useEffect(() => setTime(new Date().toLocaleString()), []);

// 2. Browser APIs — WRONG: window/localStorage don't exist on server
<div>{window.innerWidth}</div>
// CORRECT: guard with useEffect
const [width, setWidth] = useState(0); useEffect(() => setWidth(window.innerWidth), []);

// 3. Random values — WRONG: different on server vs client
<div id={Math.random().toString()}>
// CORRECT: use React.useId()

// 4. HTML nesting — WRONG: div inside p, button inside a
<p><div>X</div></p>
// CORRECT: valid nesting only

// 5. motion import — WRONG: missing "use client"
import { motion } from "motion/react";
// CORRECT:
import { motion } from "@/lib/motion";

// 6. Recharts — WRONG: zero-height container
<div style={{ height: 0 }}><ResponsiveContainer>...</ResponsiveContainer></div>
// CORRECT: explicit height wrapper
<div style={{ height: 300 }}><ResponsiveContainer width="100%" height={300}>...</ResponsiveContainer></div>

// 7. Next.js 16 async APIs — WRONG: params is now a Promise
export default function Page({ params }: { params: { id: string } }) {}
// CORRECT:
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

**Shell safety:** `useCurrentUser()` returns `null` initially then fetches. Do NOT render user info synchronously — it will break hydration.

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

- Update `src/components/Shell.tsx`: add modules to `defaultModules`, implement collapsible sidebar + mobile overlay
- Build dashboard at `src/app/(app)/page.tsx` — real KPIs, charts, status indicators
- Build each module page independently — vary UI patterns across modules (don't repeat the same layout everywhere)
- All pages are `"use client"` components under `src/app/(app)/`
- All pages must be responsive — test at mobile (375px), tablet (768px), desktop (1024px+)
- **ALWAYS** use `apiUrl("/api/...")` from `@/lib/utils` — plain `"/api/..."` breaks in production
- Use `usePolling()` from `@/lib/hooks` for dashboard polling

### Step 5: Final Build

- Run `npm run build` — fix errors and retry, max 3 attempts

## Key Rules

### Database
- Start with ~5 tables, max 10. Prefer JSON columns over many thin tables
- **NEVER use `drizzle-kit migrate`** — only `drizzle-kit push`
- Import: `import { db } from "@/db"`, `import { myTable } from "@/db/schema"`, `import { eq, desc } from "drizzle-orm"`
- `db/index.ts` uses a global singleton pool (max 5 connections) with `DB_SCHEMA` search_path support
- `seed.ts` uses `DIRECT_DATABASE_URL` first (bypasses pooler), relative imports only (no `@/` aliases)

### Data Flow
- ALL data access goes through Route Handlers. Pages fetch via `apiUrl()`
- `db` imports ONLY in Route Handlers (`src/app/api/`) — NEVER in page components
- `cookies()` is **async** in Next.js 16 — always `await cookies()`
- `params` and `searchParams` are **Promise** types — always `await` them

### Recharts
- **ALWAYS** wrap in `<ResponsiveContainer width="100%" height={300}>` inside a container with explicit height
- **NEVER** render inside `display:none` or zero-dimension containers
- Recharts uses `ResizeObserver` — mounting in invisible containers causes silent failures

### TailwindCSS 4
- Config via `@import "tailwindcss"` + `@theme inline` in globals.css — NO `tailwind.config.js`
- NO new `.css` files — keep all styles as Tailwind utility classes
- Theme uses CSS custom properties (oklch color space) — override via `globals.css` only

### Visual Style & UI/UX
- Black-and-white palette, `#B2ED1D` as accent (`var(--accent)`, `var(--accent-strong)` for hover)
- IBM Plex Mono is the only font (already loaded via `@fontsource`)
- No dark mode
- Elevation: `--shadow-sm` (subtle), `--shadow-md` (cards), `--shadow-lg` (dialogs/drawers)
- State glows: `--glow-critical` (red), `--glow-accent` (green), `--glow-warning` (amber)
- Surfaces: `--surface-raised` (cards), `--surface-inset` (inset areas)
- Use `BorderBeam` from `@/components/ui/border-beam` for highlighted cards
- All MES components use spring-based animations from `@/lib/motion` — never import `motion/react` directly
- **Be creative with layout and interaction.** Don't settle for plain list→detail CRUD pages. Mix card grids, split views, inline editing, expandable rows, contextual drawers, drag-and-drop reordering — pick the pattern that best serves the data. Vary layouts across modules so the app feels rich, not repetitive.
- **Use motion intentionally.** Staggered list entrances, spring-based number transitions, smooth tab crossfades, subtle hover lifts — small animations add polish. Avoid walls of static content.
- **Responsive / mobile-first.** All pages must work on mobile (≥375px). Use responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`), stack layouts vertically on small screens, and hide non-essential columns in tables on mobile. Test with Tailwind breakpoints: `sm` (640), `md` (768), `lg` (1024).
- **Shell sidebar must be collapsible.** Add a toggle button to collapse the sidebar to icon-only mode (~w-14). On mobile (<md), the sidebar should be hidden by default and openable as an overlay. Persist collapse state in `localStorage`.

### Commands
- `npm run build` — run ONCE at Step 5
- `npx drizzle-kit push` — run ONCE at Step 1
- `npx tsx src/db/seed.ts` — run ONCE at Step 2
- NEVER start dev servers, NEVER run interactive commands
- If same error occurs 3 times, STOP and report to user

### Environment Variables
- `DATABASE_URL` (required) — PostgreSQL connection string
- `DIRECT_DATABASE_URL` — direct connection, preferred by drizzle-kit push and seed.ts
- `DB_SCHEMA` — PostgreSQL schema for multi-tenant isolation (default: `public`)
- `APP_ID` — app identifier for `/api/manifest` (default: `"monoapp"`)
- `NEXT_PUBLIC_BASE_PATH` — URL prefix for deployed apps, used by `apiUrl()` and `basePath`
- See `docs/platform-integration.md` for deployment details.

## Definition of Done

- Schema: 5-10 tables with `createdAt`/`updatedAt`, Zod schemas via `createInsertSchema`/`createUpdateSchema`, types via `$inferSelect`
- Seed: 5-10 records/table, idempotent (`onConflictDoUpdate`), interlinked, coherent business story
- Auth: `PERMISSION_MATRIX` defined, `requireAuth()` on all write routes
- API: full CRUD per entity, Zod validation, standard error handling pattern
- UI: all pages `"use client"`, all fetch via `apiUrl()`, recharts in `<ResponsiveContainer>`, toast on mutations, empty states with actions, responsive at 375px+, Shell collapsible + mobile overlay
- Hydration: no date/browser-API in server components, motion from `@/lib/motion`, valid HTML nesting, all async APIs awaited
- Build: `npm run build` passes with zero errors
