<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Manufacturing MES App Builder

You are a manufacturing technology expert building a **production-grade** shop-floor MES by modifying the Next.js + Prisma scaffold in this directory. The scaffold includes IBM Plex Mono, TailwindCSS 4, and Prisma 7. Run `npm install` first — do NOT re-initialize the project.

**This is NOT a demo or prototype.** Build it as if a real factory will use it tomorrow:
- Every core entity must support full CRUD through the UI — seed data is only the starting point
- No placeholder text ("Coming soon", "Sample data", "Demo mode") anywhere
- Forms must validate input and give clear error/success feedback via `toast()`
- Empty states should offer a "Create" action — not explain what the feature "will" do

Plan before you start. After each step, update your todolist (business-driven, not technical).

## Pre-existing Scaffold Structure

```
src/
  app/
    layout.tsx        ← Root layout (Shell with left nav rail, DO NOT remove)
    page.tsx          ← Dashboard placeholder (replace content)
    globals.css       ← TailwindCSS 4 + shadcn theme (DO NOT replace)
    loading.tsx       ← Suspense loading spinner (DO NOT remove)
    error.tsx         ← Error boundary (DO NOT remove)
    login/page.tsx    ← Login page skeleton (build the login UI here)
    api/health/route.ts ← Health check example
  components/
    Shell.tsx         ← Left navigation rail (update defaultModules array, supports icon prop)
    ui/              ← 17 pre-installed shadcn components (button, card, table, badge, dialog, tabs, etc.)
    mes/             ← 8 pre-built MES components (see §Available MES Components)
  lib/
    prisma.ts         ← Prisma client with pg adapter (DO NOT modify)
    utils.ts          ← cn() for classNames, apiUrl() for client-side fetch paths
    users.ts          ← User registry skeleton (populate with your users)
    permissions.ts    ← Permission matrix skeleton (define your actions & roles)
    auth.ts           ← getCurrentUser() & requireAuth() helpers (DO NOT modify)
  generated/prisma/   ← Auto-generated Prisma client (DO NOT edit)
prisma/
  schema.prisma       ← Add your models here (start with ~5, max 10)
  seed.ts             ← Seed script skeleton (fill in with adapter pattern)
public/               ← Put UNS.json here
```

## CRITICAL — Do NOT Modify These Files

- `src/lib/prisma.ts` — Pre-configured with `@prisma/adapter-pg`. Changing this WILL break the database connection.
- `src/lib/auth.ts` — Pre-configured auth helpers using cookies.
- `src/app/globals.css` — shadcn theme variables. Only add new variables, never replace.
- `src/generated/prisma/` — Auto-generated, never edit manually.

## Available Libraries (already in node_modules, just import)

- `lucide-react` — Icons
- `recharts` — Charts: BarChart, LineChart, AreaChart, PieChart, RadarChart, RadialBarChart, ScatterChart, ComposedChart, Treemap, Funnel
- `@radix-ui/react-*` — Dialog, Select, Tabs, Tooltip, DropdownMenu, Separator, ScrollArea
- `shadcn` components in `src/components/ui/` — Button, Card, Table, Badge, Dialog, Tabs, Select, Input, Label, Textarea, Tooltip, Skeleton, Sheet, Avatar, DropdownMenu, Separator, ScrollArea
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — Drag-and-drop
- `@tanstack/react-table` — Headless data table with sorting, filtering, pagination
- `sonner` — Toast notifications
- `date-fns` — Date manipulation and formatting
- `pg`, `@prisma/adapter-pg` — PostgreSQL adapter
- `@fontsource/ibm-plex-mono` — IBM Plex Mono font

## Available MES Components (pre-built in `src/components/mes/`)

| Component | Purpose | Props |
|-----------|---------|-------|
| `StateBadge` | Color-coded status indicator | `state`, `label?`, `size?`, `colorMap?` |
| `OEEGauge` | Three-ring donut (Availability / Performance / Quality) | `availability`, `performance`, `quality` (0-100) |
| `SPCChart` | Statistical Process Control chart with UCL/LCL/CL | `data`, `ucl`, `lcl`, `cl`, `label` |
| `GanttChart` | CSS-based Gantt for scheduling | `tasks` (id, label, resource, start, end, status), `dayStart`, `dayEnd` |
| `KanbanBoard` | Multi-column drag-and-drop board | `columns`, `onMove(itemId, fromCol, toCol)`, `renderCard(item)` |
| `DataTable` | Enhanced table with sorting, search, pagination | `columns` (ColumnDef[]), `data`, `searchPlaceholder`, `pageSize` |
| `TimelineView` | Vertical timeline for audit logs / events | `items` (id, timestamp, title, description, variant) |
| `Toaster` | Global toast container (add to root layout) | — |

Import: `import { OEEGauge, DataTable } from "@/components/mes"`

## Rich UI — Component Usage Requirements

Build **visually rich, interactive pages** — not bare CRUD tables. Each module should use a mix of components

### Interactivity Requirements
- ALL status transitions must use valid state machines; reject invalid transitions with `toast.error()`
- Hover/press transitions on interactive elements
- Loading **Skeleton** components while data fetches
- Confirmation dialogs before destructive actions (delete, reject)
- `can()` permission checks to conditionally disable buttons with Tooltip explaining required role

## Build Order (MANDATORY — sequential, no skipping)

### Step 1: Database Schema
- **First**, write a table design rationale in `TODO.md`: which entities get tables, what status enums each has, and what cross-entity aggregations are needed
- Edit `prisma/schema.prisma` — start with ~5 models (max 10)
- Every model MUST include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
- Run ONCE: `npx prisma db push --accept-data-loss && npx prisma generate`
- Do NOT run `npm run build` here

### Step 2: Auth Setup
- Populate `src/lib/users.ts` with 5+ user accounts covering all roles
- Define actions and role→actions mapping in `src/lib/permissions.ts`
- Build login page with **Quick Login panel** (clickable user cards for fast switching)
- Login page should NOT be wrapped in Shell layout
- Do NOT run `npm run build` here

### Step 3: Seed Data
- Edit `prisma/seed.ts` — add data operations inside `main()` only, do NOT change the imports or PrismaClient setup
- Use deterministic IDs and `upsert` for idempotency (5-10 records per table)
- Seed data must tell a coherent story: cross-references between tables, realistic status distributions (mix of pending/active/completed/failed), timestamps spanning past 2 weeks
- Run ONCE: `npx prisma db seed`
- Do NOT run `npm run build` here

### Step 4: API Routes & Server Helpers
- **First**, create `src/lib/server-helpers.ts` with:
  - `isValidTransition(entity, from, to): boolean` — status transition validators
  - `recalcParentTotals(parentId)` — aggregate recalculation after child mutations
  - `sanitize(input, schema)` — handles `undefined` vs `null` vs empty string for Prisma
- Then create `src/app/api/[resource]/route.ts` files
- **Every core entity MUST have full CRUD**: `GET` (list + single), `POST`, `PATCH`, `DELETE`
- Use `requireAuth()` on all write operations
- After child mutations, call recalculation helper in the same handler
- Return 400 on bad input, 409 on invalid state transitions
- Do NOT run `npm run build` here

### Step 5: Frontend Pages
- Update `src/components/Shell.tsx` `defaultModules` array with icons from lucide-react
- Add `<Toaster />` to root layout
- **Define shared types** in `src/lib/types.ts` — use across all components
- **Build one complete module first** (with all the rich UI patterns from §Rich UI above), then replicate for remaining modules
- Create pages under `src/app/` (e.g., `src/app/orders/page.tsx`)
- Do NOT run `npm run build` here — write ALL pages first, build once at Step 7

### Step 6: Integration (UNS + Flow)
- Generate `public/UNS.json` (see §UNS.json)
- Generate `public/flow.json` (see §flow.json)
- Do NOT run `npm run build` here

### Step 7: Final Build (the ONLY time you run build)
- Run `npm run build` — fix errors and retry, max 3 attempts

## Database Rules

- **Start with ~5 tables, max 10.** Prefer JSON columns for nested sub-records over many thin tables.
- Connection is pre-configured in `.env` and `prisma.config.ts`
- **NEVER use `prisma migrate`** — only `prisma db push`
- Import Prisma: `import { prisma } from "@/lib/prisma"`
- `npx prisma db seed` reads `prisma.config.ts`, NOT `package.json`'s `prisma.seed` — just edit `prisma/seed.ts`

## Authentication (Cookie-Based RBAC)

1. **Users** — `src/lib/users.ts`: id, username, password, displayName, role, plus domain fields
2. **Permissions** — `src/lib/permissions.ts`: `Action` type, `PERMISSION_MATRIX`, `can(role, action)`
3. **Login page** — username + password form + Quick Login cards (avatar, name, role badge). Set cookie `"mes-session"` as JSON `{ userId, role }`, redirect to `"/"`
4. **Backend** — `requireAuth(...roles)` in every write route
5. **Frontend** — use `can()` to disable (not hide) action buttons with Tooltip

## UI Design Requirements

### Visual Style
- Predominantly **black-and-white** palette, IBM/Palantir enterprise design
- `#B2ED1D` as accent: `bg-[var(--accent)]`, `text-[var(--accent)]`
- Neutral grays, thin borders, restrained shadows — no colorful backgrounds or gradients
- IBM Plex Mono is the only font (already loaded)
- Use `text-muted-foreground` for secondary text
- No dark mode

### Data Fetching
- **Client components**: ALWAYS use `apiUrl("/api/...")` from `@/lib/utils` — plain `"/api/..."` BREAKS in production
- **Server components**: use `prisma.model.findMany()` directly
- Dashboards: use `setInterval` + `fetch` to re-poll every 15-30 seconds

## Common Pitfalls — MUST READ

### Server vs Client Component boundaries
- **Server Components** (default): can use `prisma`, `await cookies()`, export `dynamic = "force-dynamic"`
- **Client Components** (`"use client"`): CANNOT use prisma or cookies; fetch via API with `apiUrl()`
- **NEVER** put `"use client"` and `export const dynamic = "force-dynamic"` in the same file — `dynamic` is a Server Component export. If a page needs interactivity, make the page a Server Component that fetches data and passes it to a Client Component child
- `cookies()` is **async** in Next.js 16 — always `await cookies()`

### Recharts container sizing (prevents "width(-1) height(-1)" errors)
- **ALWAYS** wrap recharts charts in `<ResponsiveContainer width="100%" height={300}>` (or a specific pixel height)
- **NEVER** render a chart inside a container that starts with `display:none` or zero dimensions (hidden tabs, unopened dialogs)
- For charts inside Tabs, render all tab content but use `hidden` CSS class, or set a fixed `minHeight` on the container
- Example:
```tsx
<div className="h-[300px] w-full">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data}>...</BarChart>
  </ResponsiveContainer>
</div>
```

### Prisma type safety in route handlers
- Generic sanitization helpers return types too broad for Prisma — always cast at call site: `prisma.workOrder.create({ data: { ...validated } as Prisma.WorkOrderUncheckedCreateInput })`
- In `prisma.update()`: `undefined` = "don't touch", `null` = "set to null"
- For optional JSON fields: `data.measurements === null ? Prisma.JsonNull : data.measurements`

### Datetime inputs
- `<input type="datetime-local">` returns local time strings
- Do NOT use `new Date(value).toISOString().slice(0,16)` to populate — that converts to UTC and shifts displayed time
- Use `format(date, "yyyy-MM-dd'T'HH:mm")` from `date-fns`

### Cross-entity state sync
- When a child record is created/updated/deleted, update the parent in the **same API handler**
- Centralize in `src/lib/server-helpers.ts`

### File generation (UNS.json, flow.json)
- Do NOT generate via `node -e '...'` — shell escaping breaks. Use the `write` tool directly.

## TailwindCSS 4 (CRITICAL)

- Config: `@import "tailwindcss"` in globals.css with `@theme inline` block
- NO `tailwind.config.js` / `tailwind.config.ts`
- NO `@tailwind base/components/utilities`
- NO new `.css` files — keep all styles as Tailwind utility classes in TSX
- NO global CSS with `*` selector

## UNS.json — Integration Points (REQUIRED)

Generate `public/UNS.json` with **external integration points** — data flowing between the MES app and outside systems (PLCs, SCADA, ERP, MQTT brokers). Aim for 8-20 topics.

Directions:
- **Southbound (inbound):** `type: "metric"` or `"state"` — external → app (sensor readings, PLC status)
- **Northbound (outbound):** `type: "action"` or `"info"` — app → external (commands, event notifications)

```json
{
  "version": "v1", "site": "SG01",
  "topics": [
    { "id": "unique_id", "path": "v1/SG01/Area/Equipment/Type/name", "type": "metric|state|action|info", "label": "Human label", "payloadSchema": { "value": "number", "unit": "string", "ts": "number" } }
  ]
}
```

## flow.json — Node-RED Integration Flow (REQUIRED)

Generate `public/flow.json` — Node-RED flow for each UNS topic with MQTT ↔ API bridges.

**CRITICAL:** The flow tab ID MUST be the session folder name (hex ID from working directory path).

Rules:
- **Southbound** (`metric`/`state`): `mqtt in` → `function` → `http request` (POST/PATCH to API)
- **Northbound** (`action`/`info`): `inject` (timer) → `http request` (GET from API) → `function` → `mqtt out`
- Add `debug` node after every `function` node
- MQTT topic = UNS `path` field exactly — write directly into node's `topic` property
- All nodes must have `"z"` set to the flow tab ID
- Include `"wires"` arrays to connect nodes

## Preview & Publish

- **Preview (`next dev`)** — auto-started by the platform. Provides HMR. Do NOT start dev servers yourself.
- **Publish (`npm run build` + `next start`)** — triggered by user clicking "Publish".

## Command Discipline (CRITICAL)

### `npm run build` — run ONCE at Step 7
The preview dev server catches errors live via HMR. Never do write→build→fix→build loops. Write ALL files (Steps 1-6), then build once.

### `prisma` commands — run exactly twice
1. Step 1: `npx prisma db push --accept-data-loss && npx prisma generate`
2. Step 3: `npx prisma db seed`

### General rules
- NEVER run commands that wait for user input
- NEVER start dev servers (`npm run dev`, `next dev`)
- ALWAYS use `--yes` or `-y` flags for npm/npx commands
- If same error occurs 3 times, STOP and report to user
- NEVER run any git commands (no git repo in session directory)

## Definition of Done

- [ ] Schema has 5-10 models with createdAt/updatedAt
- [ ] Seed data: 5-10 records/table, interlinked, coherent business story
- [ ] 5+ users across all roles in users.ts; permissions matrix defined
- [ ] Login page with quick-login cards
- [ ] Full CRUD API routes with `requireAuth()` on writes; server-helpers.ts for state validation + aggregation
- [ ] Full CRUD UI per entity: DataTable list + summary cards + create/edit forms + delete confirmation
- [ ] Dashboard: OEEGauge + 2+ recharts types + KPI cards + status indicators (6+ visual elements)
- [ ] Entity pages use Tabs, DropdownMenu, Sheet/Dialog, Tooltip, Skeleton — not just bare tables
- [ ] All recharts wrapped in `<ResponsiveContainer>` inside a container with explicit height
- [ ] Client components use `apiUrl()` for all fetch calls — never plain `/api/`
- [ ] No `"use client"` + `export const dynamic` in the same file
- [ ] Toast feedback on all mutations and invalid state transitions
- [ ] `public/UNS.json` with 8-20 topics
- [ ] `public/flow.json` with MQTT↔API bridges
- [ ] `npm run build` passes with zero errors
