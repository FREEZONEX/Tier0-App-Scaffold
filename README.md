# MonoApp Scaffold

基于 **TanStack Start 1.x** + Drizzle ORM + TailwindCSS 4 的脚手架，用于在 Tier0 平台上构建车间 MES 应用。设计目标是给 Agent 一个轻量但完整的起点：认证、数据库连接、平台部署、构建产物和基础 layout contract 预置完毕，业务页面和组件按具体 app 现场生成，避免模板组件库限制生成结果。

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | TanStack Start 1.x（Vite 8/Rolldown + TanStack Router，React 19 SSR） |
| ORM | Drizzle ORM + node-postgres |
| 校验 | Zod（通过 `drizzle-zod` 自动派生 schema/类型） |
| 样式 | TailwindCSS 4（Vite 插件，无 PostCSS）+ Tier0 token（柔和中性界面、slate 主操作、signal green 状态高亮、按场景调节密度） |
| UI | 轻量 layout contract + TailwindCSS utility + Tier0 token；不预置业务组件库 |
| 图表 | Recharts 3（必须包在 `<ResponsiveContainer>` 里） |
| 表格 | TanStack React Table 8 |
| 拖拽 | dnd-kit |
| Tier0 平台 SDK | `@tier0/sdk`（OpenAPI REST + MQTT over WebSocket） |
| 图标 | Lucide React |
| 通知 | Sonner（`Toaster` 已挂在 `__root.tsx`） |
| 动画 | motion（从 `@/lib/motion` 导入，**不直接 `motion/react`**） |

## 快速开始

```bash
npm install
# 配置 .env 中的 DATABASE_URL
npx drizzle-kit push      # 可选：本地预同步 schema；运行时 service 会自引导
npx tsx src/db/seed.ts    # 可选：显式批量 seed / reset fixture
npm run dev               # → http://localhost:5173
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

Tier0 SDK 鉴权和连接变量由平台在应用部署时自动注入，不写入 `.env.example`，也不在脚手架或生成 app 中手动配置。生成应用不应提供 UI 让用户配置 SDK 鉴权、API Key、Token、OpenAPI Host、MQTT Host 或 Workspace 绑定；这些值由 SDK、平台网关或 runtime 环境接管。

### 平台自动注入给 SDK

| 变量 | 用途 |
|------|------|
| `TIER0_API_HOST` | OpenAPI 服务地址，供 `@tier0/sdk/openapi` 使用 |
| `TIER0_API_KEY` | API 鉴权，同时供 OpenAPI 和 MQTT 使用 |
| `TIER0_MQTT_HOST` | MQTT WebSocket Broker 地址 |
| `TIER0_MQTT_PORT` | MQTT WebSocket 端口，默认 `8084` |

如果平台明确要求浏览器侧 SDK 读取 Vite env，平台 runtime 负责注入对应的 `VITE_TIER0_*`。生成 app 不要把这些变量做成用户可编辑字段。

## Tier0 SDK SSR 兼容

`@tier0/sdk@0.1.1` 当前发布的是 CommonJS 输出；在 TanStack Start + Vite SSR 下不能放进 ESM bundle 执行。脚手架默认在 `vite.config.ts` 固化：

```ts
ssr: {
  external: ["pg", "@tier0/sdk", "mqtt"],
}
```

SDK 调用通过 `src/lib/tier0.ts` 的 lazy helper 在服务端用 `createRequire` 加载。`package.json` 的 `postinstall` 会运行 `scripts/patch-tier0-sdk.mjs`，在 managed install 后修正 SDK 的 Node 22 CJS 运行时兼容问题。生成应用时不要顶层 import SDK 子模块，不要把 SDK 加回 `ssr.noExternal`，也不要用 fallback MQTT client 或手写 fetch wrapper 绕过 SDK。

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
    _app.tsx                  ← Workspace layout：带 Shell，适合管理/计划/分析/配置
    _app.index.tsx            ← 可替换的 "/" workspace starter；非 workspace app 必须替换或 redirect
    station.tsx               ← Station layout：无侧边栏，适合 /station/* 扫码/工位/单任务操作
    review.tsx                ← Review layout：无侧边栏，适合 /review/* 异常/质检/审批复核
    login.tsx                 ← 角色选择页（无 Shell）
    api/                      ← Server Routes — **薄壳**，业务逻辑下沉到 services/
      health.ts               ← 健康检查
      manifest.ts             ← 角色清单（勿改）
      auth/{select-role,me,logout}.ts   ← Cookie 鉴权三连（勿改）
  services/                   ← 领域层：业务逻辑、状态机、多步事务（每个实体一个文件，由 Agent 创建）
  components/
    Shell.tsx                 ← 左侧导航栏，更新 defaultModules 数组
    layouts/                  ← StationLayout / ReviewLayout 等最小布局契约
    login-role-selector.tsx   ← 登录页的客户端按钮组（勿改）
    toaster.tsx               ← Sonner Toaster 挂载点
    client-only.tsx           ← SSR 不兼容库的 hydration 边界
    <domain>/                 ← 具体 app 需要的组件由 Agent 按业务生成
  db/{index,schema,seed}.ts   ← 数据层：Drizzle client / 表定义 / 种子脚本
  lib/                        ← 横切关注点（非领域逻辑）
    auth.ts                   ← getCurrentUser() / requireAuth()（勿改）
    gateway.ts                ← 网关 header 解析（勿改）
    route-handlers.ts         ← withErrors() 路由错误映射 wrapper（勿改）
    users.ts                  ← AppUser 类型（勿改）
    permissions.ts            ← 权限矩阵 — 在这里定义角色和动作
    hooks.ts                  ← usePolling()（勿改）
    motion.ts                 ← motion/react re-export（勿改）
    tier0.ts                  ← @tier0/sdk 服务端 lazy loader（OpenAPI + MQ）
    utils.ts                  ← cn(), apiUrl()
server.mjs                    ← 生产 Node HTTP 入口（勿改）
vite.config.ts                ← TanStack Start + Tailwind v4 + Vite 8 tsconfig paths + Tier0 SDK SSR external
```

## 路由文件命名

TanStack Router 文件即路由：

| 文件 | URL | 说明 |
|------|-----|------|
| `routes/__root.tsx` | — | 包住所有页面 |
| `routes/_app.tsx` | — | Workspace layout：管理/计划/分析/配置 |
| `routes/station.tsx` | `/station` | Station layout：扫码/工位/单任务执行 |
| `routes/review.tsx` | `/review` | Review layout：异常/质检/审批复核 |
| `routes/_app.index.tsx` | `/` | 默认 workspace starter；非 workspace app 必须替换或 redirect |
| `routes/_app.work-orders.tsx` | `/work-orders` | 在 `_app` layout 下 |
| `routes/station.receiving.tsx` | `/station/receiving` | 在 station layout 下 |
| `routes/review.exceptions.tsx` | `/review/exceptions` | 在 review layout 下 |
| `routes/_app.work-orders.$id.tsx` | `/work-orders/:id` | 动态参数 |
| `routes/login.tsx` | `/login` | **不**在 `_app` 下，无 Shell |
| `routes/api/work-orders.ts` | `/api/work-orders` | Server Route |
| `routes/api/work-orders/$id.ts` | `/api/work-orders/:id` | 嵌套 Server Route |

- `_` 前缀 = 路径透明（不贡献 URL）
- `.` 分隔 = URL 嵌套
- `$` 前缀 = 动态参数
- 生成页面前先按场景自动选择 layout：执行/扫码选 `station`，复核/审批选 `review`，管理/分析选 `_app`
- 如果内置 layout 都不匹配，Agent 可以创建新的前缀 layout，例如 `monitor.tsx`、`wizard.tsx`、`portal.tsx`、`editor.tsx`

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

## 加一个新页面（自动选择 layout）

Workspace 页面才放进 `_app` 并更新 `Shell.tsx` 的 `defaultModules`。如果 app 不是 workspace 类型，要把 `/` 从默认 `_app.index.tsx` 改成目标体验的入口或 redirect：

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

Station 页面放进 `station`，不进入侧边栏：

```tsx
// src/routes/station.receiving.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/station/receiving")({
  component: ReceivingPage,
});
```

如果需要完全不同的交互模型，可以新增自定义 layout，例如 `src/routes/monitor.tsx` + `src/components/layouts/MonitorLayout.tsx`。自定义 layout 应保持最小壳层，不预置业务卡片/图表/表单。不要创建没有子页面的空 pathless layout，否则会和 `/` 首页冲突。

Monitor、station、review、kiosk 等单一体验 app 不应保留默认 sidebar 首页；`/` 必须直接进入对应体验。

## 加一个 API 端点（两步走：先服务，后路由）

**第一步：写服务**（`src/services/work-orders.ts`）—— 业务逻辑、状态机、事务，全部在这里。`db` 客户端**只能**在 `services/` 和 `db/seed.ts` 出现（ESLint 在边界外会报错）。每个已实现模块还要在 service 顶部定义运行时 `bootstrapModule(...)`：`create table if not exists`、`create index if not exists`、空表时写入少量 baseline 数据。这样 preview 和新租户 schema 即使没执行过 `drizzle push/seed`，首次查询也能自引导。公共 bootstrap helper 会先创建同模块所有 schema/table/index，再统一执行 seed；不要在 service 里手写 create/seed 顺序控制。

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
- 模块 service 的每个入口函数先 `await` 本模块的 runtime bootstrap；bootstrap 负责建 schema/table/index，并且只在空表时 seed baseline 数据。公共 helper 是两阶段执行：先建完同模块所有表和索引，再执行 seed，所以 seed 可以插入同模块内其他已声明表
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
npm run dev          # preview-compatible vite dev → http://localhost:5173
npm run dev:local    # local vite dev，端口被占用时可漂移
npm run dev:force    # 强制重建 Vite 依赖缓存后启动
npm run typecheck    # TypeScript noEmit
npm run build        # Vite 8/Rolldown build → dist/{client,server}
npm run build:check  # build + typecheck + lint
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

完整构建指令在 [AGENTS.md](AGENTS.md)。Agent 按 6 步顺序构建：

1. **Schema**（`src/db/schema.ts`，Drizzle types source of truth）
2. **Auth Config**（`permissions.ts`）
3. **Services + Runtime Bootstrap**（`src/services/**` 自建表、自 seed baseline）
4. **Server Routes / API**（`src/routes/api/**`）
5. **Frontend**（自动选择 `_app` / `station` / `review`，必要时创建自定义 layout；workspace 才更新 Shell modules）
6. **Build**（`npm run build`）

已有项目则直接响应用户的修改请求，不要重启 Build Order。
