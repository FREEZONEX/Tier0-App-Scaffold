# MonoApp Template

Production-grade MES (Manufacturing Execution System) scaffold built on **Next.js 16**, **Prisma 7**, and **TailwindCSS 4**. Designed for shop-floor applications with an industrial monospace aesthetic (IBM Plex Mono), cookie-based RBAC, and a rich library of pre-built MES visualization components.

生产级 MES（制造执行系统）脚手架，基于 **Next.js 16**、**Prisma 7** 和 **TailwindCSS 4** 构建。面向车间应用，采用工业风等宽字体（IBM Plex Mono）、基于 Cookie 的 RBAC 鉴权，并内置丰富的 MES 可视化组件库。

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
| `DATABASE_URL` | Yes / 是 | PostgreSQL connection string, used by Prisma and the `pg` pool adapter. / PostgreSQL 连接字符串，供 Prisma 和 `pg` 连接池使用。 |
| `DIRECT_DATABASE_URL` | No / 否 | Fallback connection string (e.g., bypassing a pooler). / 备用连接字符串（如绕过连接池直连）。 |

The database connection is pre-configured in `src/lib/prisma.ts` using `@prisma/adapter-pg` — **do not modify that file**.
数据库连接已在 `src/lib/prisma.ts` 中通过 `@prisma/adapter-pg` 预配置 — **请勿修改该文件**。

---

## Getting Started / 快速开始

```bash
# 1. Install dependencies / 安装依赖
npm install

# 2. Push schema to database and generate Prisma client / 推送 schema 并生成 Prisma 客户端
npx prisma db push --accept-data-loss && npx prisma generate

# 3. (Optional) Seed the database / （可选）填充种子数据
npx prisma db seed

# 4. Start development server / 启动开发服务器
npm run dev
```

Open / 打开 [http://localhost:3000](http://localhost:3000)

---

## Project Structure / 项目结构

```
├── .env                        ← Database connection (MUST configure) / 数据库连接（必须配置）
├── prisma/
│   ├── schema.prisma           ← Data models / 数据模型
│   └── seed.ts                 ← Seed script / 种子脚本
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Root layout with Shell nav rail / 根布局（含左侧导航栏）
│   │   ├── page.tsx            ← Dashboard / 仪表盘
│   │   ├── login/page.tsx      ← Login page / 登录页
│   │   ├── globals.css         ← Tailwind 4 theme (OKLCH palette) / 主题样式
│   │   ├── loading.tsx         ← Suspense fallback / 加载骨架
│   │   ├── error.tsx           ← Error boundary / 错误边界
│   │   └── api/                ← API routes (backend) / API 路由（后端）
│   ├── components/
│   │   ├── Shell.tsx           ← Left nav rail / 左侧导航栏
│   │   ├── ui/                 ← 20 shadcn/Base UI components / 20 个通用 UI 组件
│   │   └── mes/                ← 15 MES-specific components / 15 个 MES 专用组件
│   ├── lib/
│   │   ├── prisma.ts           ← DB client (DO NOT modify) / 数据库客户端（勿改）
│   │   ├── auth.ts             ← Cookie auth helpers (DO NOT modify) / Cookie 鉴权（勿改）
│   │   ├── users.ts            ← User registry / 用户注册表
│   │   ├── permissions.ts      ← RBAC permission matrix / RBAC 权限矩阵
│   │   └── utils.ts            ← cn(), apiUrl()
│   └── generated/prisma/       ← Auto-generated (DO NOT edit) / 自动生成（勿改）
├── skills/                     ← Claude Code agent skills / Claude Code 代理技能
├── AGENTS.md                   ← AI agent build instructions / AI 代理构建指令
└── monoapp-agents.md           ← Agent coordination spec / 代理协调规范
```

---

## Architecture Overview / 架构概览

### Backend / 后端

| What / 内容 | Where / 位置 | How / 实现方式 |
|---|---|---|
| API Routes / API 路由 | `src/app/api/[resource]/route.ts` | Next.js App Router route handlers. Export `GET`, `POST`, `PATCH`, `DELETE` functions. Each resource gets its own directory. / Next.js App Router 路由处理器，导出 `GET`/`POST`/`PATCH`/`DELETE` 函数，每个资源一个目录。 |
| Server Helpers / 服务端工具 | `src/lib/server-helpers.ts` (create yourself) | Shared logic: state machine validation (`isValidTransition`), parent aggregate recalculation, input sanitization. / 共享逻辑：状态机校验、父级聚合重算、输入清洗。 |
| Data Access / 数据访问 | `src/lib/prisma.ts` | Singleton Prisma client with `@prisma/adapter-pg` pool. Import as `import { prisma } from "@/lib/prisma"`. **Do not modify.** / 单例 Prisma 客户端，使用 `pg` 连接池适配器。**勿改。** |

### Database / 数据库

| What / 内容 | Where / 位置 | How / 实现方式 |
|---|---|---|
| Schema / 模型定义 | `prisma/schema.prisma` | Define models here (recommended 5–10). Every model must include `createdAt` and `updatedAt`. / 在此定义模型（建议 5–10 个），每个模型必须包含 `createdAt` 和 `updatedAt`。 |
| Seed Data / 种子数据 | `prisma/seed.ts` | Populate with `upsert` for idempotency. Run via `npx prisma db seed`. / 使用 `upsert` 保证幂等，通过 `npx prisma db seed` 执行。 |
| Connection / 连接 | `.env` → `src/lib/prisma.ts` | `DATABASE_URL` env var → `pg.Pool` → `PrismaPg` adapter → `PrismaClient`. / 环境变量 → pg 连接池 → Prisma 适配器 → 客户端。 |
| Migrations / 迁移 | — | **Never use `prisma migrate`**, only `npx prisma db push`. / **禁止使用 `prisma migrate`**，仅用 `npx prisma db push`。 |

### Frontend / 前端

| What / 内容 | Where / 位置 | How / 实现方式 |
|---|---|---|
| Pages / 页面 | `src/app/[module]/page.tsx` | Next.js App Router pages. Server Components by default; add `"use client"` for interactivity. / Next.js App Router 页面，默认服务端组件，需要交互时加 `"use client"`。 |
| Layout / 布局 | `src/app/layout.tsx` + `Shell.tsx` | Root layout wraps all pages in a left nav rail. Update `defaultModules` in `Shell.tsx` to add nav items. / 根布局用左侧导航栏包裹所有页面，在 `Shell.tsx` 的 `defaultModules` 中添加导航项。 |
| UI Components / 通用组件 | `src/components/ui/` | 20 pre-built components (Button, Card, Dialog, Tabs, etc.). Based on Base UI + Radix primitives, styled with Tailwind. / 20 个预制组件，基于 Base UI + Radix 原语，Tailwind 样式。 |
| MES Components / MES 组件 | `src/components/mes/` | 15 manufacturing-specific components (OEEGauge, GanttChart, DataTable, etc.). Import from `@/components/mes`. / 15 个制造业专用组件，从 `@/components/mes` 导入。 |
| Data Fetching / 数据获取 | — | **Server Components**: use `prisma` directly. **Client Components**: use `apiUrl("/api/...")` from `@/lib/utils` (plain `/api/` breaks in production). / 服务端组件直接用 prisma，客户端组件必须用 `apiUrl()` 请求 API。 |
| Styling / 样式 | `src/app/globals.css` | TailwindCSS 4 with `@theme inline`. OKLCH color palette, `#B2ED1D` accent. IBM Plex Mono font. No dark mode. / TailwindCSS 4 行内主题，OKLCH 色板，`#B2ED1D` 强调色，等宽字体，无暗黑模式。 |

### Authentication & Authorization / 鉴权与授权

| What / 内容 | Where / 位置 | How / 实现方式 |
|---|---|---|
| User Registry / 用户注册表 | `src/lib/users.ts` | Define users with id, username, password, displayName, role, and domain fields. Recommend 5+ users covering all roles. / 定义用户信息（id、用户名、密码、显示名、角色等），建议覆盖所有角色的 5+ 用户。 |
| Permission Matrix / 权限矩阵 | `src/lib/permissions.ts` | Define `Action` type, `PERMISSION_MATRIX` (role → actions mapping), and `can(role, action)` function. / 定义 Action 类型、角色-操作映射表和 `can(role, action)` 函数。 |
| Auth Helpers / 鉴权工具 | `src/lib/auth.ts` **(DO NOT modify / 勿改)** | `getCurrentUser()` reads the `"mes-session"` cookie; `requireAuth(...roles)` guards API routes — returns 401/403 on failure. / `getCurrentUser()` 读取 cookie，`requireAuth()` 守护 API 路由，失败返回 401/403。 |
| Login Page / 登录页 | `src/app/login/page.tsx` | Build login form + Quick Login cards (clickable user cards for fast switching). Sets `"mes-session"` cookie as JSON `{ userId, role }`, redirects to `/`. / 实现登录表单 + 快速登录卡片，设置 cookie 后跳转首页。 |
| Backend Guard / 后端守卫 | API route handlers | Call `requireAuth()` on all write operations (`POST`, `PATCH`, `DELETE`). / 所有写操作调用 `requireAuth()`。 |
| Frontend Guard / 前端守卫 | Page components | Use `can(role, action)` to **disable** (not hide) buttons, with `Tooltip` explaining the required role. / 用 `can()` **禁用**（非隐藏）按钮，Tooltip 提示所需权限。 |

---

## Tech Stack / 技术栈

| Layer / 层 | Technology / 技术 |
|-------|-----------|
| Framework / 框架 | Next.js 16 (App Router, React 19) |
| Database / 数据库 | PostgreSQL via Prisma 7 + `@prisma/adapter-pg` |
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
| **StateBadge** | Color-coded status pill with dot indicator. Built-in palette for running, idle, down, etc. / 带圆点指示器的彩色状态胶囊，内置常见 MES 状态色板。 |
| **OEEGauge** | Three-ring donut: Availability / Performance / Quality, with OEE center label. / 三环同心圆：可用率/性能/质量，中心显示 OEE 值。 |
| **SPCChart** | SPC line chart with UCL, LCL, center line, out-of-control highlighting. / SPC 控制图，带上下控制限、中心线和异常点高亮。 |
| **GanttChart** | CSS-based horizontal Gantt, grouped by resource, color-coded by status. / CSS 实现的甘特图，按资源分组、按状态着色。 |
| **KanbanBoard** | Multi-column drag-and-drop board (dnd-kit), custom card rendering. / 多列拖拽看板，支持自定义卡片渲染。 |
| **DataTable** | TanStack-powered table with sorting, search, pagination. / 基于 TanStack 的表格，支持排序、搜索、分页。 |
| **TimelineView** | Vertical audit log / event timeline with colored dots. / 纵向事件时间线，带彩色圆点和图标。 |
| **MetricCard** | KPI card with value, unit, trend arrow, optional icon. Supports `invertTrend`. / KPI 卡片，带数值、单位、趋势箭头，支持反向趋势。 |
| **MiniSparkline** | Tiny inline area chart for cards/tables. / 迷你面积趋势图，可嵌入卡片或表格。 |
| **AlarmBanner** | Alert strip: critical/warning/info, with source tag, timestamp, dismiss. / 报警条：三级严重度，带来源标签、时间戳和关闭按钮。 |
| **ShiftBar** | Horizontal shift schedule bar with real-time hour marker. / 班次时间轴，带实时时刻红线标记。 |
| **ProgressRing** | SVG circular progress, lighter than OEEGauge for single metrics. / SVG 环形进度，比 OEEGauge 更轻量，适合单一指标。 |
| **HeatmapGrid** | 2D color-intensity grid with tooltips (machines × hours, etc.). / 二维热力图，带 Tooltip（如设备×小时）。 |
| **CountdownTimer** | Live countdown/elapsed timer with warning/expired states. Compact or stacked. / 实时倒计时/已用时间，支持紧凑和堆叠两种模式。 |
| **Toaster** | Global toast container (Sonner). Add to root layout once. / 全局 Toast 容器，根布局中添加一次即可。 |

```tsx
import { MetricCard, OEEGauge, DataTable, AlarmBanner } from "@/components/mes";
```

---

## Scripts / 脚本

```bash
npm run dev       # Start dev server (HMR) / 启动开发服务器
npm run build     # Production build / 生产构建
npm run start     # Start production server / 启动生产服务器
npm run lint      # ESLint
```

