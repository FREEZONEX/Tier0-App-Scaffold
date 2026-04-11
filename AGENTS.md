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

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| Runtime | React / React DOM | 19.2.4 |
| Language | TypeScript (strict) | 5.x |
| Database | Drizzle ORM + pg (PostgreSQL) | 0.45.0 / 8.20 |
| Validation | Zod + drizzle-zod | 4.0.0 / 0.8.0 |
| UI Primitives | @base-ui/react (NOT Radix — see §Base UI Differences) | 1.3.0 |
| Styling | TailwindCSS 4 (CSS-first config, no JS config file) | 4.x |
| Charts | Recharts | 3.8.0 |
| Tables | @tanstack/react-table | 8.21.3 |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable | 6.3.1 / 10.0.0 |
| Icons | lucide-react | 0.577.0 |
| Animation | motion (Framer Motion v11+) — import from `@/lib/motion` | 12.38.0 |
| Notifications | sonner | 2.0.7 |
| Dates | date-fns | 4.1.0 |
| Font | IBM Plex Mono (@fontsource) | — |
| Build output | standalone (for Docker deployment) | — |

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

## Architecture Overview

### Rendering Model: Server vs Client Boundary

This scaffold uses a **clear server/client boundary** — understanding it prevents hydration errors.

```
Server Components (no "use client"):
  ├─ src/app/layout.tsx         → Root layout: <html>, <body>, fonts, Toaster
  ├─ src/app/(app)/layout.tsx   → Imports Shell (Shell itself is "use client")
  ├─ src/app/(auth)/login/page.tsx → Reads gateway header via await headers()
  └─ src/app/not-found.tsx      → Static 404

Client Components ("use client"):
  ├─ src/app/(app)/page.tsx     → Dashboard (and ALL pages under (app)/)
  ├─ src/app/(app)/error.tsx    → Error boundary (MUST be client component)
  ├─ src/components/Shell.tsx   → Sidebar navigation, usePathname, useRouter
  ├─ src/components/mes/*       → ALL MES components are client-only
  └─ src/lib/motion.ts          → Re-exports motion/react with "use client"

Server-Only (Route Handlers):
  └─ src/app/api/**             → All API routes, Drizzle DB access, cookies()
```

**Key rule:** `(app)/layout.tsx` is a server component that renders `<Shell>` (a client component). All pages under `(app)/` must be `"use client"` because they are children of the Shell's client subtree.

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client ("use client" pages)                           │
│  ┌──────────┐    fetch(apiUrl("/api/..."))              │
│  │ useEffect │──────────────────────┐                   │
│  │ usePolling│                      │                   │
│  └──────────┘                      ▼                   │
│                           ┌─────────────┐              │
│                           │ Route Handler│              │
│                           │ requireAuth()│              │
│                           │ Zod .parse() │              │
│                           └──────┬──────┘              │
│                                  │                      │
│                           ┌──────▼──────┐              │
│                           │  Drizzle ORM │              │
│                           │  db.select() │              │
│                           │  db.insert() │              │
│                           └──────┬──────┘              │
│                                  │                      │
│                           ┌──────▼──────┐              │
│                           │  PostgreSQL  │              │
│                           │  (DB_SCHEMA) │              │
│                           └─────────────┘              │
└─────────────────────────────────────────────────────────┘
```

- `db` imports ONLY in Route Handlers (`src/app/api/`) — NEVER in page components
- ALL client-side fetches MUST use `apiUrl("/api/...")` — plain `"/api/"` breaks when `NEXT_PUBLIC_BASE_PATH` is set
- Use `usePolling<T>(url, interval)` for dashboard real-time data
- `cookies()` is **async** in Next.js 16 — always `await cookies()`

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
- `shadcn` components in `src/components/ui/` — 29 Base UI primitives
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — Drag-and-drop
- `@tanstack/react-table` — Headless data table with sorting, filtering, pagination
- `sonner` — Toast notifications via `toast()` / `toast.error()` / `toast.success()`
- `date-fns` — Date manipulation and formatting
- `motion` (framer-motion v11+) — Animation library. Import from `@/lib/motion` (NOT directly from `motion/react`). Exports: `motion`, `AnimatePresence`, `useSpring`, `useTransform`, `useMotionValue`, `MotionConfig`

> **Note on package.json:** It lists some `@radix-ui/*` packages as dependencies, but ALL UI components actually import from `@base-ui/react`. The Radix packages are unused leftovers. Do NOT import from `@radix-ui/*` — always use the components from `src/components/ui/`.

## Optional MES Components (pre-built in `src/components/mes/`)

All 28 components are `"use client"` and use spring-based animations from `@/lib/motion`. Use these to save time, or build equivalent UI yourself.

Import: `import { OEEGauge, DataTable, MetricCard, PageHeader, FleetGrid } from "@/components/mes"`

### Dashboard & KPI Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `MetricCard` | KPI card with animated value, trend indicator, accent bar, footer slot for sparklines | `label`, `value` (string), `unit?`, `trend?` ({value, direction}), `icon?` (LucideIcon), `footer?` (ReactNode) |
| `AnimatedNumber` | Spring-interpolated number display — use inside MetricCard or standalone | `value` (number), `format?` ((n: number) => string), `className?` |
| `MiniSparkline` | Tiny inline area chart (pure SVG, ~40px tall) with draw-in animation — great in MetricCard footer | `data` (number[]), `color?`, `height?` |
| `SummaryStrip` | Compact horizontal KPI bar — fits above a table or at page top | `items` ({label, value, color?, unit?}[]) |
| `OEEGauge` | Three-ring donut (Availability/Performance/Quality) with center OEE % — pure SVG, no Recharts | `availability`, `performance`, `quality` (all 0-100), `size?` (px, default 200) |
| `ProgressRing` | Single circular progress with spring animation | `value` (0-100), `label?`, `size?` |
| `TargetBar` | Actual vs target bar with color coding | `label`, `actual`, `target`, `unit?`, `invertColor?` |

### Chart Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `SPCChart` | SPC control chart with UCL/LCL/CL reference lines (Recharts) | `data` ({value, label?}[]), `ucl`, `lcl`, `cl`, `label?` |
| `ParetoChart` | Bar + cumulative % line for quality analysis (Recharts) | `data` ({label, count}[]), `height?`, `label?` |
| `HeatmapGrid` | 2D color-intensity grid with OKLch color interpolation | `rows` (string[]), `cols` (string[]), `data` (number[][]), `colorScale?` |

### Scheduling & Workflow Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `GanttChart` | CSS-based Gantt — read-only or drag-to-reschedule. Drag horizontally to move time, vertically to reassign resource, right-edge to resize duration | `tasks` (GanttTask[]), `dayStart?`, `dayEnd?`, `onTaskMove?(taskId, newStart, newEnd, newResource)`, `snapMinutes?` (default 15) |
| `KanbanBoard` | Multi-column drag-and-drop board (@dnd-kit) with elevated drag feedback | `columns` (KanbanColumn[]), `onMove(itemId, fromColumnId, toColumnId)`, `renderCard(item)` |
| `TimelineView` | Vertical timeline with staggered entry animation | `items` (TimelineItem[]: id, timestamp, title, description, variant) |
| `ProcessFlow` | Horizontal pipeline stages with animated connectors between them | `stages` ({id, label, status, count?, icon?}[]) |
| `StepIndicator` | Horizontal step tracker (completed → active → pending) | `steps` ({label, description?, status}[]), `size?` |
| `CountdownTimer` | Live countdown/count-up with flip-digit animation. ⚠️ Uses Date.now() — see §Hydration | `targetTime` (Date), `mode?` ("remaining"/"elapsed"), `label?`, `warningThreshold?` (seconds), `compact?` |
| `ShiftBar` | Shift schedule bar with current-time marker | `shifts` ({label, start, end, color}[]), `currentHour?` |

### Data Display Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `DataTable` | Full-featured table: sorting, global search, pagination (@tanstack/react-table + shadcn Table) | `columns` (ColumnDef[]), `data`, `searchPlaceholder?`, `pageSize?` (default 10) |
| `FleetGrid` | Dense grid of machine/device status tiles with optional inline sparkline | `items` ({id, label, status, metric?, sparkline?, icon?}[]), `columns?`, `onItemClick?` |
| `Leaderboard` | Ranked list with proportional visual bars | `items` ({label, value, meta?}[]), `title?`, `unit?`, `maxItems?` |
| `StateBadge` | Color-coded status indicator with optional ping animation on active states | `state` (string), `label?`, `colorMap?` (Record<string, string>) |

### Layout & Form Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `PageHeader` | Page title bar with breadcrumbs, description, badge, and action slot | `title`, `description?`, `breadcrumbs?` ({label, href?}[]), `badge?` (ReactNode), `actions?` (ReactNode) |
| `TabbedCard` | Card with built-in tab navigation + crossfade animation | `tabs` ({id, label, icon?, content: ReactNode}[]), `defaultTab?`, `size?` |
| `DetailDrawer` | Right-sliding detail panel — wraps shadcn Sheet | `open`, `onOpenChange`, `title?`, `footer?` (ReactNode), `children` |
| `FormSection` | Form region with title, description, and responsive column grid | `title`, `description?`, `columns?` (1/2/3), `children` |
| `EmptyState` | Placeholder for empty lists/tables with icon and action button | `title`, `description?`, `icon?` (LucideIcon), `action?` (ReactNode), `compact?` |

### Notification Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `AlarmBanner` | Alert strip with enter/exit animation — critical severity adds red glow | `severity` ("critical"/"warning"/"info"), `message`, `onDismiss?`, `animate?` |
| `Toaster` | Toast container (Sonner) — already mounted in root layout, just call `toast()` | Positioned bottom-right. Use `toast()`, `toast.success()`, `toast.error()` |

## Shell Navigation

The `Shell` component (`src/components/Shell.tsx`) provides a persistent left sidebar (w-56) with:

- Module navigation links with active state highlighting (accent color)
- Current user display (name + role badge) fetched from `/api/auth/me`
- "Switch Role" and "Logout" buttons at the bottom

**To add navigation modules**, update the `defaultModules` array:

```tsx
import { Factory, Gauge, Package, ClipboardList, LayoutDashboard } from "lucide-react";

export const defaultModules: NavModule[] = [
  { key: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
  { key: "work-orders", label: "Work Orders", href: "/work-orders", icon: ClipboardList },
  { key: "equipment", label: "Equipment", href: "/equipment", icon: Gauge },
  { key: "inventory", label: "Inventory", href: "/inventory", icon: Package },
];
```

**Active state logic:** exact match for `/`, prefix match for other paths (`pathname.startsWith(mod.href)`).

## shadcn / Base UI — Critical Differences from Radix

All 29 UI components in `src/components/ui/` use `@base-ui/react`, NOT `@radix-ui/react-*`. Three things are different:

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

## Hydration: Common Pitfalls and Prevention

Hydration errors occur when the server-rendered HTML doesn't match the client-rendered output. This scaffold's architecture minimizes risk, but these patterns still cause issues:

### 1. Date/Time Rendering (MOST COMMON)

Server and client may be in different timezones. Dates rendered during SSR will mismatch.

```tsx
// WRONG — server and client produce different strings
<span>{new Date().toLocaleString()}</span>
<span>{format(order.createdAt, "PPpp")}</span>  // if rendered in server component

// CORRECT — render dates only in "use client" components with useEffect
"use client";
const [time, setTime] = useState<string>("");
useEffect(() => setTime(new Date().toLocaleString()), []);
```

Since all pages under `(app)/` are `"use client"`, date rendering in page bodies is safe. The risk is in **server components** like `(auth)/login/page.tsx` or root `layout.tsx`.

### 2. CountdownTimer / Real-time Components

`CountdownTimer` uses `useState(calcDiff)` where `calcDiff` calls `Date.now()`. Since it's `"use client"`, the initial render happens on both server and client with different timestamps.

**Mitigation already in place:** All MES components are `"use client"`, so Next.js SSR renders them as a placeholder boundary. The actual countdown only runs on the client after hydration. However, if you use `CountdownTimer` inside a server component's children, ensure it's wrapped properly.

### 3. Browser-Only APIs

```tsx
// WRONG — window/document/localStorage don't exist on server
<div>{window.innerWidth}</div>
<div>{localStorage.getItem("setting")}</div>

// CORRECT — guard with useEffect or mounted check
const [width, setWidth] = useState(0);
useEffect(() => setWidth(window.innerWidth), []);
```

### 4. Random Values / UUIDs

```tsx
// WRONG — different values on server and client
<div id={Math.random().toString()}>
<div key={crypto.randomUUID()}>

// CORRECT — use React's useId() hook
import { useId } from "react";
const id = useId();
```

### 5. Invalid HTML Nesting

React strictly validates HTML nesting during hydration:

```tsx
// WRONG — div inside p, p inside p, interactive inside interactive
<p><div>Content</div></p>
<button><a href="/link">Click</a></button>

// CORRECT
<div><p>Content</p></div>
<a href="/link"><span>Click</span></a>
```

### 6. Shell Component: Conditional Rendering

`Shell.tsx` uses `useCurrentUser()` which returns `null` initially, then fetches user info. The `{user && (...)}` pattern is safe because the initial server render also sees `null`. **Do NOT** change this to render user info synchronously or from cookies — it will break hydration.

### 7. motion/react Import Path

```tsx
// WRONG — breaks hydration, missing "use client" directive
import { motion } from "motion/react";

// CORRECT — lib/motion.ts has "use client" and re-exports
import { motion } from "@/lib/motion";
```

### 8. Recharts in Hidden Containers

Recharts uses `ResizeObserver` and DOM measurement. Rendering inside `display: none` or zero-dimension containers causes hydration + runtime errors.

```tsx
// WRONG — zero-height container
<div style={{ height: 0 }}><ResponsiveContainer>...</ResponsiveContainer></div>

// CORRECT — explicit height on the wrapper
<div style={{ height: 300 }}><ResponsiveContainer width="100%" height={300}>...</ResponsiveContainer></div>
```

### 9. Next.js 16 Async APIs

In Next.js 16, `params`, `searchParams`, `cookies()`, `headers()` are all **async**. Forgetting `await` causes runtime errors or hydration mismatches.

```tsx
// WRONG
export default function Page({ params }: { params: { id: string } }) {
  return <div>{params.id}</div>;
}

// CORRECT
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>{id}</div>;
}
```

### Hydration Safety Checklist

- [ ] All pages under `(app)/` have `"use client"` at the top
- [ ] `error.tsx` has `"use client"` (required by Next.js)
- [ ] Dates/times only rendered in client components with useEffect
- [ ] No `window`/`document`/`localStorage` access outside useEffect
- [ ] All motion imports from `@/lib/motion`, not `motion/react`
- [ ] Recharts always inside `<ResponsiveContainer>` with explicit height
- [ ] No random/UUID generation in render — use `useId()`
- [ ] `cookies()` and `headers()` always awaited in server code
- [ ] HTML nesting is valid (no `<div>` inside `<p>`, no nested `<button>`)

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

### Visual Style
- Black-and-white palette, `#B2ED1D` as accent (`var(--accent)`, `var(--accent-strong)` for hover)
- IBM Plex Mono is the only font (already loaded via `@fontsource`)
- No dark mode
- Elevation: `--shadow-sm` (subtle), `--shadow-md` (cards), `--shadow-lg` (dialogs/drawers)
- State glows: `--glow-critical` (red), `--glow-accent` (green), `--glow-warning` (amber)
- Surfaces: `--surface-raised` (cards), `--surface-inset` (inset areas)
- Use `BorderBeam` from `@/components/ui/border-beam` for highlighted cards
- All MES components use spring-based animations from `@/lib/motion` — never import `motion/react` directly

### Commands
- `npm run build` — run ONCE at Step 5
- `npx drizzle-kit push` — run ONCE at Step 1
- `npx tsx src/db/seed.ts` — run ONCE at Step 2
- NEVER start dev servers, NEVER run interactive commands
- If same error occurs 3 times, STOP and report to user

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `DIRECT_DATABASE_URL` | No | Direct connection (bypass pooler) — used by drizzle-kit push and seed.ts |
| `DB_SCHEMA` | No | PostgreSQL schema name (default: `public`) — enables multi-tenant isolation |
| `APP_ID` | No | Application identifier (default: `"monoapp"`) — returned by `/api/manifest` |
| `NEXT_PUBLIC_BASE_PATH` | No | URL prefix for deployed apps (e.g., `/session-xyz`) — used by `apiUrl()` and `next.config.ts basePath` |

See `docs/platform-integration.md` for full deployment guide.

## Definition of Done

### Database
- [ ] 5-10 tables with `createdAt`/`updatedAt` timestamps on every table
- [ ] Zod schemas derived via `createInsertSchema()`/`createUpdateSchema()` — never hand-written
- [ ] Types derived via `$inferSelect`/`$inferInsert` — never hand-written
- [ ] `npx drizzle-kit push` executed successfully

### Seed Data
- [ ] 5-10 records per table, interlinked with realistic cross-references
- [ ] Idempotent: `db.insert().values([...]).onConflictDoUpdate()`
- [ ] Coherent business story: status distributions, timestamps spanning past 2 weeks
- [ ] `npx tsx src/db/seed.ts` executed successfully

### Auth & Permissions
- [ ] Roles and actions defined in `PERMISSION_MATRIX` in `permissions.ts`
- [ ] Role selection page functional (gateway header → role cards)
- [ ] `requireAuth()` on all write API routes

### API Routes
- [ ] Full CRUD per entity: `GET` (list + single), `POST`, `PATCH`, `DELETE`
- [ ] Zod `.parse()` on all request bodies
- [ ] Standard error handling: `e.status` (auth), `e.issues` (validation), fallback 500
- [ ] `server-helpers.ts` for state transitions (`isValidTransition`) and parent recalculation

### Frontend
- [ ] All pages under `(app)/` have `"use client"` directive
- [ ] All fetch calls use `apiUrl("/api/...")` — never plain `/api/`
- [ ] Dashboard with real KPIs, charts (in `<ResponsiveContainer>`), status indicators
- [ ] Full CRUD UI per entity: forms, status transitions, delete confirmation
- [ ] Toast feedback (`toast()`, `toast.success()`, `toast.error()`) on all mutations
- [ ] Empty states with "Create" action buttons
- [ ] Shell `defaultModules` updated with icons for all modules

### Hydration Safety
- [ ] No date/time rendering in server components
- [ ] No `window`/`document`/`localStorage` outside `useEffect`
- [ ] Motion imports from `@/lib/motion`, not `motion/react`
- [ ] Valid HTML nesting throughout
- [ ] `cookies()`/`headers()`/`params`/`searchParams` always awaited

### Build
- [ ] `npm run build` passes with zero errors
- [ ] No TypeScript errors, no ESLint errors
