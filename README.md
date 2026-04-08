# MonoApp Scaffold

Next.js 16 + Drizzle ORM + TailwindCSS 4 脚手架，用于在 Tier0 平台上构建车间 MES 应用。

## 技术栈

| 层 | 技术 |
|---|------|
| 框架 | Next.js 16 (App Router, React 19) |
| ORM | Drizzle ORM + pg |
| 校验 | Zod (通过 drizzle-zod 自动派生) |
| 样式 | TailwindCSS 4 + IBM Plex Mono |
| UI | shadcn (Base UI 底层，非 Radix) |
| 图表 | Recharts 3 |
| 表格 | TanStack React Table 8 |
| 拖拽 | dnd-kit |
| 图标 | Lucide React |
| 通知 | Sonner |

## 快速开始

### 1) PostgreSQL（本机）

仓库根目录的 `docker-compose.yml` 与默认 `.env` 对齐（用户 `appbuilder`、库 `proj-abc123`、端口 `5432`）。

```bash
npm install
npm run db:up          # 启动 Postgres（需已安装 Docker）
npm run db:push        # 建表
npm run db:seed        # 种子数据
```

一键（起库 + push + seed）：

```bash
npm run db:setup
```

若无 Docker，请自行安装 PostgreSQL 16+，并保证 `DATABASE_URL` 指向该实例。

### 2) 开发服务器

```bash
npm run dev
```

### 3) 本地模拟网关注入 `user` header（mercy）

应用期望网关注入 `user` JSON。本机可用反向代理脚本代替浏览器扩展：

**单终端（推荐）** — Next 在 **3101**，代理在 **3000**，浏览器只打开 **http://localhost:3000**：

```bash
npm run dev:with-gateway
```

**双终端** — Next 默认 **3000**，代理 **3001**：

```bash
npm run dev
npm run dev:gateway   # 另开终端，浏览器打开 http://localhost:3001
```

自定义用户 JSON：

```bash
set GATEWAY_USER_JSON={"userID":"x","userName":"mercy","email":"m@x.com"}
npm run dev:gateway
```

（macOS/Linux 可用 `export GATEWAY_USER_JSON='...'`。）

### 常用数据库脚本

```bash
npm run db:down        # 停止 Postgres 容器
npm run db:logs        # 查看 Postgres 日志
```

## 环境变量

没有模式开关。只填 `DATABASE_URL` 就是本地开发，平台注入其余变量即启用对应能力。

| 变量 | 必填 | 不设时 | 设了之后 |
|------|:---:|--------|--------|
| `DATABASE_URL` | ✅ | — | 连接数据库 |
| `DB_SCHEMA` | | 用 `public` schema | 查询在指定 schema 下执行 |
| `APP_ID` | | 默认 `"monoapp"` | manifest 返回对应 appId |
| `NEXT_PUBLIC_BASE_PATH` | | 无 URL 前缀 | apiUrl() 加前缀 |
| `NEXT_PUBLIC_GATEWAY_URL` | | SSO 按钮隐藏 | SSO 按钮显示 |
| `GATEWAY_CHECK_TOKEN_URL` | | — | SSO 回调验证 token |

详见 [docs/platform-integration.md](docs/platform-integration.md)。

## 项目结构

```
src/
  app/
    layout.tsx              ← 根布局 + Toaster
    globals.css             ← TailwindCSS 4 主题
    (app)/                  ← 带 Shell 导航的页面
    (auth)/login/           ← 无 Shell 的登录页
    api/                    ← Route Handlers
      auth/callback         ← SSO 回调（脚手架预制）
      auth/logout           ← 登出（脚手架预制）
      manifest/             ← 角色清单（脚手架预制）
  components/
    Shell.tsx               ← 左侧导航栏
    ui/                     ← 29 个 shadcn 组件
    mes/                    ← 15 个可选 MES 组件
  db/
    index.ts                ← Drizzle 客户端（勿改）
    schema.ts               ← 表定义 + Zod schemas + 类型
    seed.ts                 ← 种子脚本
  lib/
    auth.ts                 ← Cookie 鉴权（勿改）
    sso.ts                  ← SSO 适配层（勿改）
    hooks.ts                ← usePolling() hook（勿改）
    users.ts                ← 用户注册表
    permissions.ts          ← RBAC 权限矩阵
    utils.ts                ← cn(), apiUrl()
  proxy.ts                  ← Next.js 16 auth proxy（勿改）
```

## 数据流

```
页面 ("use client")  →  fetch(apiUrl("/api/..."))  →  Route Handler  →  Drizzle  →  PostgreSQL
```

- 所有页面是 `"use client"` 组件，通过 `apiUrl()` 调用 API
- Route Handler 用 `requireAuth()` 鉴权，Zod `.parse()` 校验
- `db` 只在 Route Handler 中 import，不在页面组件中使用

## 认证

- **本地模式**：`users.ts` 静态用户 + `mes-session` cookie
- **生产模式**：网关注入 `user` header → `proxy.ts` 自动建立 session
- SSO 登录按钮根据 `NEXT_PUBLIC_GATEWAY_URL` 是否设置自动显示/隐藏
- 角色由 app 定义（`permissions.ts`），平台通过 `/api/manifest` 获取角色列表并分配

## 脚本

```bash
npm run dev                 # 开发服务器
npm run dev:with-gateway    # Next(3101) + 注入 user 头的代理(3000)
npm run dev:gateway         # 仅代理 → 需另开终端 next dev
npm run build               # 生产构建
npm run start               # 启动生产服务器
npm run db:up               # Docker 启动 Postgres
npm run db:down             # Docker 停止 Postgres
npm run db:setup            # db:up + db:push + db:seed
npm run db:push             # 推送 schema 到数据库
npm run db:seed             # 填充种子数据
npm run db:studio           # Drizzle Studio
```

## 给 Agent 的说明

构建指令在 `AGENTS.md` 中。Agent 按 5 步顺序构建：Schema → Auth Config + Seed → API Routes → Frontend → Build。已有项目则直接响应用户需求。
