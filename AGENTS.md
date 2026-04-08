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
    ui/                     ← 29 shadcn components (Base UI primitives, NOT Radix)
    mes/                    ← Toaster only; build your own domain components as needed
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

## proxy.ts — the Middleware

`src/proxy.ts` is the Next.js 16 middleware file. It is NOT imported by anything — Next.js discovers it by convention (similar to how `middleware.ts` worked in earlier versions, but in Next.js 16 the convention is `proxy.ts` and the exported function is named `proxy`).

**What it does:**
- Has session cookie → pass through (authenticated)
- Has gateway user header but no cookie → redirect to `/login` (needs role selection)
- Neither → 401 (not a platform user)
- Public paths (`/login`, `/api/auth/*`, `/api/health`, `/api/manifest`, `/_next/*`) are always allowed through

**Local development implications:**
When running locally, there is no platform gateway. Direct requests to `localhost:3000` will have no gateway header and no session cookie, triggering a 401 on all non-public routes. To develop locally, you need a reverse proxy that injects the `X-App-User-ID` header before forwarding to Next.js.

> **⚠ WARNING: If you build a gateway proxy for local development, it MUST support WebSocket upgrade (`server.on("upgrade", ...)`).**
> Next.js 16 + Turbopack uses WebSocket for HMR (Hot Module Replacement). A plain HTTP proxy that does not forward WebSocket upgrades will cause React hydration to **silently fail** — the page HTML will render, but all client-side JavaScript (useEffect, event handlers, state) will be completely dead. There are NO console errors when this happens. If you see a page that renders but has no interactivity, check WebSocket connectivity first.

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

## shadcn / Base UI — CRITICAL Differences from Radix

> **⚠ READ THIS BEFORE WRITING ANY COMPONENT CODE.**
> These components use `@base-ui/react`, NOT `@radix-ui/react-*`.
> If you write `asChild`, it WILL fail at build time. Every Trigger, every Dialog, every DropdownMenu — use `render` prop.
> Re-check this section EVERY TIME you create a new page with dialog/trigger/select components.

Three things are different:

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
// CORRECT — use render prop on ALL trigger-like components
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

**Remember**: this applies to DialogTrigger, AlertDialogTrigger, DropdownMenuTrigger, PopoverTrigger (except Popover which supports asChild), TooltipTrigger, SheetTrigger, CollapsibleTrigger — ALL of them use `render`, not `asChild`.

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
