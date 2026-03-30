# MonoApp Template

Production-grade MES (Manufacturing Execution System) scaffold built on **Next.js 16**, **Prisma 7**, and **TailwindCSS 4**. Designed for shop-floor applications with an industrial monospace aesthetic (IBM Plex Mono), cookie-based RBAC, and a rich library of pre-built MES visualization components.

## Prerequisites

- Node.js >= 20
- PostgreSQL database (local or remote)

## Environment Configuration

**You must configure `.env` before running the project.**

Copy or edit the `.env` file in the project root:

```bash
DATABASE_URL="postgresql://username:password@host:port/database"
```

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Used by Prisma and the `pg` pool adapter. |
| `DIRECT_DATABASE_URL` | No | Fallback connection string (e.g., for direct connections bypassing a pooler). |

The database connection is pre-configured in `src/lib/prisma.ts` using `@prisma/adapter-pg` — do not modify that file.

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Push schema to database and generate Prisma client
npx prisma db push --accept-data-loss && npx prisma generate

# 3. (Optional) Seed the database
npx prisma db seed

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
├── .env                        ← Database connection (MUST configure)
├── prisma/
│   ├── schema.prisma           ← Data models (add yours here, max 10)
│   └── seed.ts                 ← Seed script
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Root layout with Shell nav rail
│   │   ├── page.tsx            ← Dashboard
│   │   ├── login/page.tsx      ← Login page
│   │   ├── globals.css         ← Tailwind 4 theme (OKLCH palette)
│   │   ├── loading.tsx         ← Suspense fallback
│   │   ├── error.tsx           ← Error boundary
│   │   └── api/                ← API routes
│   ├── components/
│   │   ├── Shell.tsx           ← Left nav rail (update defaultModules)
│   │   ├── ui/                 ← 20 shadcn/Base UI components
│   │   └── mes/                ← 15 MES-specific components
│   ├── lib/
│   │   ├── prisma.ts           ← DB client (DO NOT modify)
│   │   ├── auth.ts             ← Cookie auth helpers (DO NOT modify)
│   │   ├── users.ts            ← User registry
│   │   ├── permissions.ts      ← RBAC permission matrix
│   │   └── utils.ts            ← cn(), apiUrl()
│   └── generated/prisma/       ← Auto-generated (DO NOT edit)
├── skills/                     ← Claude Code agent skills
├── AGENTS.md                   ← AI agent build instructions
└── monoapp-agents.md           ← Agent coordination spec
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Database | PostgreSQL via Prisma 7 + `@prisma/adapter-pg` |
| Styling | TailwindCSS 4 (no config file — `@theme inline` in globals.css) |
| UI Primitives | Base UI (`@base-ui/react`) + Radix UI |
| Component Variants | `class-variance-authority` (CVA) |
| Charts | Recharts 3 |
| Tables | TanStack React Table 8 |
| Drag & Drop | dnd-kit |
| Icons | Lucide React |
| Toasts | Sonner |
| Font | IBM Plex Mono (`@fontsource/ibm-plex-mono`) |

## UI Components (`src/components/ui/`)

20 pre-installed, styled components:

| Component | Description |
|-----------|-------------|
| Button | 6 variants (default, outline, secondary, ghost, destructive, link), 8 sizes |
| Card | Container with Header, Title, Description, Action, Content, Footer |
| Table | Responsive data table with row hover/selection states |
| Badge | Pill-shaped status labels, 6 variants |
| Dialog | Modal with backdrop blur, animations |
| Sheet | Side-sliding panel (top/right/bottom/left) |
| Tabs | Default (contained) and line (underline) variants |
| Select | Dropdown with search, scroll arrows, portal positioning |
| Input | Text input with focus ring, error states |
| Textarea | Auto-growing text area |
| Label | Form label with disabled state |
| Tooltip | Dark tooltip with arrow and delay |
| Skeleton | Pulse-animated loading placeholder |
| Avatar | Circular avatar with badge, group layout |
| DropdownMenu | Context menu with checkbox/radio items, submenus |
| Separator | Horizontal/vertical divider |
| ScrollArea | Custom-styled scrollbars |
| Progress | Horizontal progress bar with custom color |
| Switch | Toggle switch with checked/unchecked states |
| Popover | Click-triggered floating panel |

## MES Components (`src/components/mes/`)

15 manufacturing-specific visualization components:

| Component | Description |
|-----------|-------------|
| **StateBadge** | Color-coded status pill with dot indicator. Built-in palette for running, idle, down, paused, completed, failed, etc. |
| **OEEGauge** | Three-ring concentric donut chart showing Availability / Performance / Quality with calculated OEE center label. |
| **SPCChart** | Statistical Process Control line chart with UCL, LCL, center line, and out-of-control point highlighting. |
| **GanttChart** | CSS-based horizontal Gantt for production scheduling. Groups tasks by resource, color-codes by status. |
| **KanbanBoard** | Multi-column drag-and-drop board using dnd-kit. Custom card rendering via `renderCard` prop. |
| **DataTable** | TanStack-powered table with column sorting, global text search, and pagination controls. |
| **TimelineView** | Vertical audit log / event timeline with variant-colored dots and optional icons. |
| **MetricCard** | KPI card with large value, unit, trend arrow (up/down with color), and optional icon. Supports `invertTrend` for metrics where down is good. |
| **MiniSparkline** | Tiny inline area chart (Recharts) for embedding trend lines in cards or table cells. |
| **AlarmBanner** | Alert strip with severity levels (critical/warning/info), source tag, timestamp, and dismiss button. |
| **ShiftBar** | Horizontal bar showing shift segments with color coding and a real-time current-hour marker. |
| **ProgressRing** | Lightweight SVG circular progress indicator. Simpler than OEEGauge for single metrics like yield or utilization. |
| **HeatmapGrid** | 2D color-intensity grid with tooltips. Useful for machines-by-hours, defects-by-station, etc. |
| **CountdownTimer** | Live countdown or elapsed timer with warning/expired states. Compact inline or stacked display modes. |
| **Toaster** | Global toast container (Sonner). Add to root layout once. |

Import any component:
```tsx
import { MetricCard, OEEGauge, DataTable, AlarmBanner } from "@/components/mes";
```

## Design System

- **Palette**: Black-and-white with `#B2ED1D` lime accent. OKLCH-based neutrals.
- **Font**: IBM Plex Mono — monospace throughout for industrial aesthetic.
- **Borders**: Thin (`ring-1`), restrained shadows, no gradients.
- **No dark mode**: Light theme only.

CSS variables are defined in `src/app/globals.css` under `:root` and `@theme inline`. Use `var(--accent)` for brand color.

## Authentication

Cookie-based RBAC system:

1. Define users in `src/lib/users.ts`
2. Define roles and permissions in `src/lib/permissions.ts`
3. Login sets a `"mes-session"` cookie with `{ userId, role }`
4. Backend: `requireAuth(...roles)` guards write routes
5. Frontend: `can(role, action)` to conditionally disable UI elements

## Database

- Edit models in `prisma/schema.prisma` (recommended: 5-10 models max)
- Every model should include `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
- **Never use `prisma migrate`** — only `npx prisma db push`
- Import: `import { prisma } from "@/lib/prisma"`

## Scripts

```bash
npm run dev       # Start dev server (HMR)
npm run build     # Production build
npm run start     # Start production server
npm run lint      # ESLint
```

## License

Private — internal use only.
