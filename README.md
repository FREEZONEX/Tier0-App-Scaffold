# MonoApp Scaffold

基于 **TanStack Start 1.x** + Drizzle ORM + TailwindCSS 4 的脚手架，用于在 Tier0 平台上构建车间 MES 应用。设计目标是给 Agent 一个高完成度起点：组件库、认证、数据库连接、平台部署、构建产物全部预置完毕，开发者（或 Agent）只关心业务实体、权限矩阵、页面交互即可。

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | TanStack Start 1.x（Vite 8 + TanStack Router，React 19 SSR） |
| ORM | Drizzle ORM + node-postgres |
| 校验 | Zod（通过 `drizzle-zod` 自动派生 schema/类型） |
| 样式 | TailwindCSS 4（Vite 插件，无 PostCSS）+ 系统 Sans（UI）+ IBM Plex Mono（数字/数据） |
| UI | shadcn 组件（**Base UI 底层，非 Radix**）+ 20 个 MES 业务组件 + 6 个项目级 UI 拓展 |
| 图表 | Recharts 3（必须包在 `<ResponsiveContainer>` 里） |
| 表格 | TanStack React Table 8 |
| 拖拽 | dnd-kit |
| 图标 | Lucide React |
| 通知 | Sonner（`Toaster` 已挂在 `__root.tsx`） |
| 动画 | motion（从 `@/lib/motion` 导入，**不直接 `motion/react`**） |

## 快速开始

```bash
npm install
# 配置 .env 中的 DATABASE_URL
npx drizzle-kit push      # 建表
npx tsx src/db/seed.ts    # 种子数据（可选）
npm run dev               # → http://localhost:3000
```

> ⚠️ Agent 在 Executor Pod 内运行时**不要手动 `npm install`** —— 平台会自动管理，手动安装会和共享 volume 冲突。详见 AGENTS.md。

## 环境变量

无模式开关：变量不设就是本地行为，设了即启用对应能力。

| 变量 | 必填 | 不设时 | 设了之后 |
|------|:---:|--------|--------|
| `DATABASE_URL` | ✅ | — | 连接数据库 |
| `SESSION_SECRET` | 生产 ✅ | 本地随机生成（重启即失效）| HMAC 签名 session cookie；生产必须 ≥32 字符 |
| `DIRECT_DATABASE_URL` | | — | 绕过连接池直连，`drizzle-kit push` / `seed.ts` 优先使用 |
| `DB_SCHEMA` | | 使用 `public` schema | 所有查询在指定 schema 下执行 |
| `APP_ID` | | 默认 `"monoapp"` | `/api/manifest` 返回对应 appId |
| `VITE_BASE_PATH` | | 无 URL 前缀 | Vite `base` / router `basepath` / `apiUrl()` 加前缀 |
| `NEXT_PUBLIC_BASE_PATH` | | （兼容旧名） | `apiUrl()` 在 `VITE_BASE_PATH` 缺失时回落读取 |

部署相关详见 [docs/platform-integration.md](docs/platform-integration.md)。

## 项目结构

```
src/
  start.ts                    ← TanStack Start 全局请求中间件（SSO 网关，勿改）
  router.tsx                  ← Router factory，导出 getRouter()（勿改）
  routeTree.gen.ts            ← @tanstack/router-plugin 自动生成（已 gitignore，勿手改）
  styles/globals.css          ← TailwindCSS 4 + 主题 token + 动画 keyframes（勿改）
  routes/                     ← 接口层（HTTP）：文件即路由，文件名控制 URL + 嵌套
    __root.tsx                ← <html> 文档壳，挂 Toaster（勿改）
    _app.tsx                  ← 带 Shell 的 layout route（loading/error fallback 在此）
    _app.index.tsx            ← Dashboard 页 / 占位，待替换
    login.tsx                 ← 角色选择页（无 Shell）
    api/                      ← Server Routes — **薄壳**，业务逻辑下沉到 services/
      health.ts               ← 健康检查
      manifest.ts             ← 角色清单（勿改）
      auth/{select-role,me,logout}.ts   ← Cookie 鉴权三连（勿改）
  services/                   ← 领域层：业务逻辑、状态机、多步事务（每个实体一个文件，由 Agent 创建）
  components/
    Shell.tsx                 ← 左侧导航栏，更新 defaultModules 数组
    login-role-selector.tsx   ← 登录页的客户端按钮组（勿改）
    ui/                       ← shadcn 组件（Base UI 底层）+ 项目级 UI 拓展（page-header / detail-drawer / 等）
    mes/                      ← 20 个 MES 业务组件（OEEGauge / GanttChart / KanbanBoard / 等）
  db/{index,schema,seed}.ts   ← 数据层：Drizzle client / 表定义 / 种子脚本
  lib/                        ← 横切关注点（非领域逻辑）
    auth.ts                   ← getCurrentUser() / requireAuth()（勿改）
    gateway.ts                ← 网关 header 解析（勿改）
    route-handlers.ts         ← withErrors() 路由错误映射 wrapper（勿改）
    users.ts                  ← AppUser 类型（勿改）
    permissions.ts            ← 权限矩阵 — 在这里定义角色和动作
    hooks.ts                  ← usePolling()（勿改）
    motion.ts                 ← motion/react re-export（勿改）
    utils.ts                  ← cn(), apiUrl()
server.mjs                    ← 生产 Node HTTP 入口（勿改）
vite.config.ts                ← TanStack Start + Tailwind v4 + tsconfig paths
```

## 路由文件命名

TanStack Router 文件即路由：

| 文件 | URL | 说明 |
|------|-----|------|
| `routes/__root.tsx` | — | 包住所有页面 |
| `routes/_app.tsx` | — | 无 URL 段的"路径透明" layout |
| `routes/_app.index.tsx` | `/` | `_app` 的首页 |
| `routes/_app.work-orders.tsx` | `/work-orders` | 在 `_app` layout 下 |
| `routes/_app.work-orders.$id.tsx` | `/work-orders/:id` | 动态参数 |
| `routes/login.tsx` | `/login` | **不**在 `_app` 下，无 Shell |
| `routes/api/work-orders.ts` | `/api/work-orders` | Server Route |
| `routes/api/work-orders/$id.ts` | `/api/work-orders/:id` | 嵌套 Server Route |

- `_` 前缀 = 路径透明（不贡献 URL）
- `.` 分隔 = URL 嵌套
- `$` 前缀 = 动态参数

### 动态参数读取

```tsx
// src/routes/_app.work-orders.$id.tsx
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_app/work-orders/$id")({
  validateSearch: z.object({ tab: z.enum(["details", "history"]).optional() }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();    // 同步、类型安全
  const { tab } = Route.useSearch();   // 同步，来自 validateSearch
  return <div>Order {id}, tab: {tab ?? "details"}</div>;
}
```

API 路由对应：`src/routes/api/work-orders/$id.ts`，handler 用第一参 `({ params })` 拿 `params.id`。

## 加一个新页面（带 Shell）

```tsx
// src/routes/_app.work-orders.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/work-orders")({
  component: WorkOrdersPage,
});

function WorkOrdersPage() {
  return <div className="p-6">Orders</div>;
}
```

之后在 `Shell.tsx` 的 `defaultModules` 里加一项指向 `/work-orders` 即可。

## 加一个 API 端点（两步走：先服务，后路由）

**第一步：写服务**（`src/services/work-orders.ts`）—— 业务逻辑、状态机、事务，全部在这里。`db` 客户端**只能**在 `services/` 和 `db/seed.ts` 出现（ESLint 在边界外会报错）。

**第二步：写路由**（`src/routes/api/work-orders.ts`）—— HTTP 薄壳：`requireAuth()` → `schema.parse()` → 调 service → `Response.json(...)`，整段包在 `withErrors(...)` 里。失败抛 `HttpError` 或让 Zod 自然冒泡。

完整带状态机的实现示例（含 `db.transaction` 多步事务、`HttpError` 抛出方式、Zod 校验）见 [AGENTS.md §Build Order — Step 3](AGENTS.md#step-3-services--server-routes)。

页面里调用：`fetch(apiUrl("/api/work-orders"))`。**永远**走 `apiUrl()`，否则部署到带 base path 的环境会断。

## 三层架构

```
浏览器
  │
  │  fetch(apiUrl("/api/..."))
  ▼
src/routes/api/**.ts          ← 接口层：requireAuth → Zod.parse → 调 service → Response.json
  │                               每个 handler 包在 withErrors 里，统一映射 {status,message} / Zod issues
  ▼
src/services/**.ts            ← 领域层：业务逻辑、状态机、多步事务（db.transaction 在这里）
  │                               Throw {status,message} 给上层；纯 TS，无 HTTP 概念
  ▼
src/db/{index,schema}.ts      ← 数据层：Drizzle client + 表定义
  ▼
PostgreSQL
```

**硬性规则**：
- `db` 只能从 `src/services/**` 和 `src/db/seed.ts` import，**不要**进 routes / lib / 客户端组件
- `Request` / `Response` / `Headers` 只在 routes / `src/start.ts` / `src/lib/{auth,gateway,route-handlers}.ts` 出现——**不要**进 services
- 多步写（≥2 个 db 操作）必须在 `db.transaction(async tx => ...)` 里执行
- 服务端 cookie/header 工具（`getCookie`, `getRequest`...）只在 Server Route handler、`createServerFn` body、或 `src/start.ts` 里用

## 认证（SSO）

平台网关在转发请求时注入用户身份 header；本 app 不管理密码或用户表。

**网关 header 三种格式（任选其一）：**

```
# 格式 1: JSON
user: {"userID":"u123","userName":"mercy","email":"m@x.com"}

# 格式 2: 独立 header
X-App-User-ID: u123
X-App-User-Name: mercy
X-App-User-Email: m@x.com

# 格式 3: 最小集
X-App-User-ID: u123
```

**流程：**

1. 网关注入 header → `src/start.ts` 全局中间件
2. 有 `mes-session` cookie → 直接放行
3. 有 header 但没 cookie → 302 到 `/login?from=...`
4. 用户选角色 → `POST /api/auth/select-role` → 写 cookie（httpOnly, 7 天）
5. 后续请求服务端 `requireAuth("admin")` 校验

**角色由 app 自治**：在 `src/lib/permissions.ts` 的 `PERMISSION_MATRIX` 定义角色→允许动作的映射；平台通过 `GET /api/manifest` 拿到角色列表来做权限分配 UI。

完整设计参见 [docs/platform-integration.md](docs/platform-integration.md)。

## 脚本

```bash
npm run dev          # vite dev → http://localhost:3000
npm run build        # vite build → dist/{client,server}
npm run start        # node server.mjs（包装 fetch handler 的 Node 入口）
npm run lint         # eslint
npm run db:push      # 推送 schema
npm run db:seed      # 填充种子数据
npm run db:studio    # Drizzle Studio
```

## 部署产物

`npm run build` 输出到 `dist/`：

- `dist/client/` —— 浏览器静态资源（JS/CSS/字体）
- `dist/server/server.js` —— SSR + Server Routes 的 fetch-style handler

`server.mjs` 用 `node:http` 包住这个 handler，监听 `PORT`（默认 3000），同时把 `dist/client/` 当静态目录服务。容器化部署见 `artifact.toml`。

## 给 Agent 的说明

完整构建指令在 [AGENTS.md](AGENTS.md)。Agent 按 5 步顺序构建：

1. **Schema**（`src/db/schema.ts` + `drizzle-kit push`）
2. **Auth Config + Seed**（`permissions.ts` + `seed.ts`）
3. **Server Routes / API**（`src/routes/api/**`）
4. **Frontend**（页面 + Shell modules）
5. **Build**（`npm run build`）

已有项目则直接响应用户的修改请求，不要重启 Build Order。
