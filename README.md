# MonoApp Template

Production-grade MES (Manufacturing Execution System) scaffold built on **Next.js 16**, **Drizzle ORM**, **Zod**, and **TailwindCSS 4**. Designed for shop-floor applications with an industrial monospace aesthetic (IBM Plex Mono), cookie-based RBAC, and a rich library of pre-built MES visualization components.

生产级 MES（制造执行系统）脚手架，基于 **Next.js 16**、**Drizzle ORM**、**Zod** 和 **TailwindCSS 4** 构建。面向车间应用，采用工业风等宽字体（IBM Plex Mono）、基于 Cookie 的 RBAC 鉴权，并内置丰富的 MES 可视化组件库。

---

## Prerequisites / 前置要求

- Node.js >= 20
- PostgreSQL database (local or remote) / PostgreSQL 数据库（本地或远程）

## Environment Configuration / 环境配置

**You MUST configure `.env` before running the project.**
**运行项目前必须先配置 `.env` 文件。**

Edit the `.env` file in the project root / 编辑项目根目录下的 `.env` 文件：

```bash
DATABASE_URL="postgresql://username:password@host:port/database"
```

| Variable / 变量 | Required / 必填 | Description / 说明 |
|----------|----------|-------------|
| `DATABASE_URL` | Yes / 是 | PostgreSQL connection string, used by Drizzle ORM and the `pg` pool. / PostgreSQL 连接字符串，供 Drizzle ORM 和 `pg` 连接池使用。 |
| `DIRECT_DATABASE_URL` | No / 否 | Fallback connection string (e.g., bypassing a pooler). / 备用连接字符串（如绕过连接池直连）。 |

The database connection is pre-configured in `src/db/index.ts` using `pg` Pool + Drizzle — **do not modify that file**.
数据库连接已在 `src/db/index.ts` 中通过 `pg` Pool + Drizzle 预配置 — **请勿修改该文件**。

---

## Getting Started / 快速开始

```bash
# 1. Install dependencies / 安装依赖
npm install

# 2. Push schema to database / 推送 schema 到数据库
npx drizzle-kit push

# 3. (Optional) Seed the database / （可选）填充种子数据
npx tsx src/db/seed.ts

# 4. Start development server / 启动开发服务器
npm run dev
```

Open / 打开 [http://localhost:3000](http://localhost:3000)

---

## Project Structure / 项目结构

```
├── .env                        ← Database connection (MUST configure) / 数据库连接（必须配置）
├── drizzle.config.ts           ← Drizzle Kit config / Drizzle Kit 配置
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Root layout (fonts + body, NO Shell) / 根布局（无导航栏）
│   │   ├── globals.css         ← Tailwind 4 theme (OKLCH palette) / 主题样式
│   │   ├── (app)/              ← Route group with Shell nav / 含导航栏的路由组
│   │   │   ├── layout.tsx      ← Shell wrapper / 导航栏包裹
│   │   │   ├── page.tsx        ← Dashboard / 仪表盘
│   │   │   ├── loading.tsx     ← Suspense fallback / 加载骨架
│   │   │   └── error.tsx       ← Error boundary / 错误边界
│   │   ├── (auth)/             ← Route group without Shell / 无导航栏的路由组
│   │   │   └── login/page.tsx  ← Login page / 登录页
│   │   └── api/                ← API routes (health check, external APIs only) / API 路由
│   ├── components/
│   │   ├── Shell.tsx           ← Left nav rail / 左侧导航栏
│   │   ├── ui/                 ← 20 shadcn/Base UI components / 20 个通用 UI 组件
│   │   └── mes/                ← 15 MES-specific components / 15 个 MES 专用组件
│   ├── db/
│   │   ├── index.ts            ← DB client (DO NOT modify) / 数据库客户端（勿改）
│   │   ├── schema.ts           ← Tables + Zod schemas + types / 表定义 + Zod 校验 + 类型
│   │   └── seed.ts             ← Seed script / 种子脚本
│   ├── lib/
│   │   ├── auth.ts             ← Cookie auth helpers (DO NOT modify) / Cookie 鉴权（勿改）
│   │   ├── users.ts            ← User registry / 用户注册表
│   │   ├── permissions.ts      ← RBAC permission matrix / RBAC 权限矩阵
│   │   └── utils.ts            ← cn(), apiUrl()
├── skills/                     ← Agent skills / 代理技能
└── AGENTS.md                   ← AI agent build instructions / AI 代理构建指令
```

---

## Architecture Overview / 架构概览

### Data Flow / 数据流

| What / 内容 | Where / 位置 | How / 实现方式 |
|---|---|---|
| All data access / 所有数据访问 | API Route Handlers (`api/[resource]/route.ts`) | `GET`/`POST`/`PATCH`/`DELETE` with `requireAuth()` + Zod validation. / REST 路由，含鉴权和 Zod 校验。 |
| Validation / 校验 | `src/db/schema.ts` | Zod schemas derived from Drizzle tables via `createInsertSchema()`. / 从 Drizzle 表定义自动派生 Zod 校验。 |
| Frontend data / 前端数据 | Client Components | `fetch(apiUrl("/api/..."))` for all reads and writes. / 所有读写通过 `apiUrl()` 调 API。 |
| Real-time refresh / 实时刷新 | Client Components | `setInterval` + `fetch(apiUrl("/api/..."))` for dashboard polling. / 定时轮询刷新仪表盘。 |

### Database / 数据库

| What / 内容 | Where / 位置 | How / 实现方式 |
|---|---|---|
| Schema / 模型定义 | `src/db/schema.ts` | TypeScript tables via `pgTable()` + `pgEnum()`. Zod schemas and types co-located. / TypeScript 表定义，Zod 校验和类型同文件派生。 |
| Seed Data / 种子数据 | `src/db/seed.ts` | Populate with `db.insert().onConflictDoUpdate()` for idempotency. Run via `npx tsx src/db/seed.ts`. / 使用冲突更新保证幂等。 |
| Connection / 连接 | `.env` → `src/db/index.ts` | `DATABASE_URL` env var → `pg.Pool` → `drizzle()`. / 环境变量 → pg 连接池 → Drizzle 实例。 |
| Schema sync / 同步 | — | **Never use `drizzle-kit migrate`**, only `npx drizzle-kit push`. / **禁止使用 migrate**，仅用 push。 |

### Type Safety Chain / 类型安全链路

```
src/db/schema.ts (single source of truth / 唯一真相源)
       │
       ├→ pgTable() / pgEnum()         → Drizzle queries
       ├→ $inferSelect / $inferInsert   → TypeScript types (全程自动推导)
       └→ createInsertSchema()          → Zod validation (零手写校验)
```

### Authentication & Authorization / 鉴权与授权

| What / 内容 | Where / 位置 | How / 实现方式 |
|---|---|---|
| User Registry / 用户注册表 | `src/lib/users.ts` | Define users with id, username, password, displayName, role. 5+ users covering all roles. / 定义用户信息，建议覆盖所有角色的 5+ 用户。 |
| Permission Matrix / 权限矩阵 | `src/lib/permissions.ts` | `Action` type, `PERMISSION_MATRIX` (role → actions), `can(role, action)`. / Action 类型、角色-操作映射和 `can()` 函数。 |
| Auth Helpers / 鉴权工具 | `src/lib/auth.ts` **(DO NOT modify / 勿改)** | `getCurrentUser()` reads cookie; `requireAuth(...roles)` guards API Route Handlers. / 读取 cookie 和守护服务端操作。 |
| Login Page / 登录页 | `src/app/(auth)/login/page.tsx` | Login form + Quick Login cards. Sets `"mes-session"` cookie, redirects to `/`. / 登录表单 + 快速登录卡片。 |

---

## Tech Stack / 技术栈

| Layer / 层 | Technology / 技术 |
|-------|-----------|
| Framework / 框架 | Next.js 16 (App Router, React 19) |
| Database ORM / 数据库 ORM | Drizzle ORM + `pg` driver |
| Validation / 校验 | Zod (via `drizzle-zod` auto-derivation) |
| Styling / 样式 | TailwindCSS 4 (`@theme inline` in globals.css) |
| UI Primitives / UI 原语 | Base UI (`@base-ui/react`) + Radix UI |
| Component Variants / 组件变体 | `class-variance-authority` (CVA) |
| Charts / 图表 | Recharts 3 |
| Tables / 表格 | TanStack React Table 8 |
| Drag & Drop / 拖拽 | dnd-kit |
| Icons / 图标 | Lucide React |
| Toasts / 通知 | Sonner |
| Font / 字体 | IBM Plex Mono (`@fontsource/ibm-plex-mono`) |

---

## UI Components / 通用 UI 组件 (`src/components/ui/`)

20 pre-installed components / 20 个预制组件：

| Component / 组件 | Description / 说明 |
|-----------|-------------|
| Button | 6 variants, 8 sizes / 6 种变体、8 种尺寸 |
| Card | Container with Header, Title, Description, Action, Content, Footer / 卡片容器 |
| Table | Responsive data table with hover/selection states / 响应式表格 |
| Badge | Pill-shaped status labels, 6 variants / 胶囊状态标签 |
| Dialog | Modal with backdrop blur, animations / 模态对话框 |
| Sheet | Side-sliding panel (top/right/bottom/left) / 侧滑面板 |
| Tabs | Default (contained) and line (underline) variants / 选项卡 |
| Select | Dropdown with scroll arrows, portal positioning / 下拉选择器 |
| Input | Text input with focus ring, error states / 文本输入框 |
| Textarea | Auto-growing text area / 自增长文本域 |
| Label | Form label with disabled state / 表单标签 |
| Tooltip | Dark tooltip with arrow and delay / 深色提示气泡 |
| Skeleton | Pulse-animated loading placeholder / 脉冲加载占位 |
| Avatar | Circular avatar with badge, group layout / 圆形头像 |
| DropdownMenu | Context menu with checkbox/radio items, submenus / 下拉菜单 |
| Separator | Horizontal/vertical divider / 分隔线 |
| ScrollArea | Custom-styled scrollbars / 自定义滚动条 |
| Progress | Horizontal progress bar with custom color / 水平进度条 |
| Switch | Toggle switch / 开关切换 |
| Popover | Click-triggered floating panel / 点击弹出浮层 |

---

## MES Components / MES 专用组件 (`src/components/mes/`)

15 manufacturing-specific components / 15 个制造业专用组件：

| Component / 组件 | Description / 说明 |
|-----------|-------------|
| **StateBadge** | Color-coded status pill with dot indicator. Built-in palette for running, idle, down, etc. / 带圆点的彩色状态胶囊。 |
| **OEEGauge** | Three-ring donut: Availability / Performance / Quality, with OEE center label. / 三环 OEE 仪表盘。 |
| **SPCChart** | SPC line chart with UCL, LCL, center line, out-of-control highlighting. / SPC 控制图。 |
| **GanttChart** | CSS-based horizontal Gantt, grouped by resource, color-coded by status. / 甘特图。 |
| **KanbanBoard** | Multi-column drag-and-drop board (dnd-kit), custom card rendering. / 拖拽看板。 |
| **DataTable** | TanStack-powered table with sorting, search, pagination. / 数据表格。 |
| **TimelineView** | Vertical audit log / event timeline with colored dots. / 事件时间线。 |
| **MetricCard** | KPI card with value, unit, trend arrow, optional icon. / KPI 卡片。 |
| **MiniSparkline** | Tiny inline area chart for cards/tables. / 迷你趋势图。 |
| **AlarmBanner** | Alert strip: critical/warning/info, with source tag, timestamp, dismiss. / 报警条。 |
| **ShiftBar** | Horizontal shift schedule bar with real-time hour marker. / 班次时间轴。 |
| **ProgressRing** | SVG circular progress for single metrics. / 环形进度。 |
| **HeatmapGrid** | 2D color-intensity grid with tooltips. / 热力图。 |
| **CountdownTimer** | Live countdown/elapsed timer with warning/expired states. / 倒计时器。 |
| **Toaster** | Global toast container (Sonner). Add to root layout once. / 全局 Toast 容器。 |

```tsx
import { MetricCard, OEEGauge, DataTable, AlarmBanner } from "@/components/mes";
```

---

## Scripts / 脚本

```bash
npm run dev        # Start dev server (HMR) / 启动开发服务器
npm run build      # Production build / 生产构建
npm run start      # Start production server / 启动生产服务器
npm run lint       # ESLint
npm run db:push    # Push schema to database / 推送 schema 到数据库
npm run db:seed    # Seed the database / 填充种子数据
npm run db:studio  # Open Drizzle Studio / 打开 Drizzle Studio
```
