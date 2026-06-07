# 平台集成与部署

## 环境变量

没有模式开关。变量不设就是本地行为，设了就启用对应能力。

### 必填

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串，数据库名 = project ID |
| `SESSION_SECRET` | HMAC 签名 session cookie 的密钥（≥32 字符）。**生产必填**；本地不设时进程启动随机生成（重启即失效）。生成命令：`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

### 可选

| 变量 | 说明 |
|------|------|
| `DIRECT_DATABASE_URL` | 直连地址（绕过连接池），`drizzle-kit push` 和 `seed.ts` 优先使用 |

### 平台注入（不设则不生效，本地开发不需要）

| 变量 | 不设时的行为 | 设了之后 |
|------|------------|--------|
| `DB_SCHEMA` | 使用 `public` schema | 所有查询在指定 schema 下执行 |
| `APP_ID` | 默认 `"monoapp"` | `/api/manifest` 返回对应 appId |
| `VITE_BASE_PATH` | 无 URL 前缀 | `apiUrl()` 和 Vite `base` 加前缀 |
| `NEXT_PUBLIC_BASE_PATH` | （兼容旧名）同上 | `apiUrl()` 在 `VITE_BASE_PATH` 缺失时回落读取此变量 |
| `TIER0_API_HOST` | — | 平台自动注入 Tier0 OpenAPI 服务地址 |
| `TIER0_API_KEY` | — | 平台自动注入 Tier0 API 鉴权密钥，OpenAPI 和 MQTT 共用 |
| `TIER0_MQTT_HOST` | — | 平台自动注入 Tier0 MQTT WebSocket Broker 地址 |
| `TIER0_MQTT_PORT` | 默认 `8084` | 平台自动注入 Tier0 MQTT WebSocket 端口 |

`DB_SCHEMA` 和 `APP_ID` 设为同一个值（session ID）。
Tier0 SDK 变量由平台部署时注入，不写入脚手架 `.env.example`，也不由生成 app 提供用户配置 UI。

---

## 认证模型

认证由平台网关统一处理。App 不管理密码和用户账号。

### 网关注入的 Header 格式（三选一）

`role` 字段为**可选**——网关如果给了，App 自动用；不给则用户在 `/login` 自选。

**格式 1：JSON `user` header**
```
user: {"userID":"uuid-123","userName":"mercy","email":"mercy@example.com","role":"operator"}
```

**格式 2：独立 header**
```
X-App-User-ID:    uuid-123
X-App-User-Name:  mercy
X-App-User-Email: mercy@example.com
X-App-User-Role:  operator
```

**格式 3：最小集（无 role，落到 `/login` 让用户选）**
```
X-App-User-ID: uuid-123
```

至少需要 user ID。`name` 和 `email` 缺失时以 ID 兜底；`role` 缺失则不自动签发 session。

### 认证流程（Mode A：网关角色优先）

```
浏览器 → 网关（验证平台登录）→ 注入 user + role header → App
  → src/start.ts 全局请求中间件：

      ┌── 有 mes-session cookie ───────────────────→ 放行
      │
      ├── 无 cookie + 网关 role 在 PERMISSION_MATRIX 中
      │      → 自动签发 mes-session cookie（HMAC 签名）
      │      → 302 回原 URL（带 cookie 重新发起请求）→ 放行
      │
      ├── 无 cookie + 网关无可用 role（未给 / 不在矩阵）
      │      → 302 /login?from=… 让用户选
      │      → POST /api/auth/select-role 写 cookie
      │
      └── 无 cookie + 无网关 header
             → 401（非平台用户）
```

第二条分支是 Mode A 的核心：**用户从不见到 `/login` 页面**，只要网关把 role 给了。

### 角色管理

角色定义由 App 决定，分配由平台决定。

1. Agent 在 `permissions.ts` 中定义 `PERMISSION_MATRIX`（角色 → 允许的操作）
2. 平台调 `GET /api/manifest` 拿角色列表，平台 admin UI 给用户分配 role
3. 平台后续转发请求时把 role 一起注入 header
4. App 中间件验证 role 存在于 `PERMISSION_MATRIX` 后自动签发 session

**重要：** 网关注入的 `role` 字符串必须**精确匹配** `PERMISSION_MATRIX` 的 key（区分大小写）。`"Operator"` ≠ `"operator"`。Agent 与平台 admin UI 协调命名。

未知 role 不会自动放行——会落回 `/login`（fail-closed）。Shell 不再有 "Switch Role" 按钮：Mode A 下角色由平台说了算，要换岗去平台改。

---

## 平台资源模型

```
Project (proj-abc123)
  └─ 数据库: proj-abc123
       ├─ schema: session-001  ← app 1
       ├─ schema: session-002  ← app 2
       └─ schema: session-003  ← app 3
```

一个 session = 一个 app。`DB_SCHEMA` 和 `APP_ID` 设为同一个值。

### 平台职责

**创建 project 时：**

```sql
CREATE DATABASE "proj-abc123";
```

**创建 session 时：**

```sql
-- 连接到 project 数据库后
CREATE SCHEMA IF NOT EXISTS "session-xyz789";
```

**注入环境变量：**

```env
DATABASE_URL="postgresql://appbuilder:appbuilder@db-host:5432/proj-abc123"
SESSION_SECRET="<32+ chars random hex; per-app or per-session, never reuse across tenants>"
DB_SCHEMA="session-xyz789"
APP_ID="session-xyz789"
VITE_BASE_PATH="/session-xyz789"
TIER0_API_HOST="<platform-injected>"
TIER0_API_KEY="<platform-injected>"
TIER0_MQTT_HOST="<platform-injected>"
TIER0_MQTT_PORT="8084"
# 兼容旧变量名（可选，apiUrl 仍能读取）
# NEXT_PUBLIC_BASE_PATH="/session-xyz789"
```

**配置网关路由：**

网关需要对匹配的请求注入 user header（JSON 或独立 header 格式均可），然后反向代理到 App。

### App 容器启动

平台完成上述准备后，启动 app：

```bash
npm install
npx drizzle-kit push    # 在 DB_SCHEMA 下建表
npx tsx src/db/seed.ts  # 在 DB_SCHEMA 下插入种子数据（首次）
npm run build           # vite build → 输出到 dist/{client,server}
node server.mjs         # 等价于 `npm start`，监听 PORT（默认 3000）
```

---

## 环境变量与代码的对应关系

| 变量                          | 读取位置                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | `db/index.ts`、`drizzle.config.ts`、`db/seed.ts`                                      |
| `SESSION_SECRET`              | `lib/session.ts`（启动时校验，未设且非生产则警告并随机生成）                                |
| `DIRECT_DATABASE_URL`         | `drizzle.config.ts`、`db/seed.ts`（优先于 DATABASE_URL）                                |
| `DB_SCHEMA`                   | `db/index.ts`（search_path）、`drizzle.config.ts`（schemaFilter）、`db/seed.ts`          |
| `APP_ID`                      | `routes/api/manifest.ts`                                                              |
| `VITE_BASE_PATH`              | `vite.config.ts`（base）、`router.tsx`（basepath）、`lib/utils.ts`（apiUrl 首选项）     |
| `NEXT_PUBLIC_BASE_PATH`       | `lib/utils.ts`（apiUrl 兼容回落）、`vite.config.ts` / `router.tsx` 同样作为兜底           |
| `TIER0_API_HOST`              | 平台部署自动注入；`@tier0/sdk/openapi` 运行时读取                                      |
| `TIER0_API_KEY`               | 平台部署自动注入；`@tier0/sdk/openapi` 和 `@tier0/sdk/mq` 运行时读取                    |
| `TIER0_MQTT_HOST`             | 平台部署自动注入；`@tier0/sdk/mq` 运行时读取                                           |
| `TIER0_MQTT_PORT`             | 平台部署自动注入；`@tier0/sdk/mq` 运行时读取                                           |

---

## 场景速查

| 场景               | DATABASE_URL | SESSION_SECRET | DB_SCHEMA | APP_ID | BASE_PATH |
| ------------------ | ------------ | -------------- | --------- | ------ | --------- |
| 本地开发           | ✅            | —（自动随机）   | —         | —      | —         |
| 平台预览（session） | ✅            | ✅              | ✅         | ✅      | 视情况     |
| 生产（网关代理）    | ✅            | ✅              | ✅         | ✅      | 视情况     |

`—` = 不设，使用默认值。
