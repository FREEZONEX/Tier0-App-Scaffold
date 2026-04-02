# 平台集成与部署

## 环境变量

没有模式开关。变量不设就是本地行为，设了就启用对应能力。

### 必填

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串，数据库名 = project ID |

### 可选

| 变量 | 说明 |
|------|------|
| `DIRECT_DATABASE_URL` | 直连地址（绕过连接池），`drizzle-kit push` 和 `seed.ts` 优先使用 |

### 平台注入（不设则不生效，本地开发不需要）

| 变量 | 不设时的行为 | 设了之后 |
|------|------------|--------|
| `DB_SCHEMA` | 使用 `public` schema | 所有查询在指定 schema 下执行 |
| `APP_ID` | 默认 `"monoapp"` | `/api/manifest` 返回对应 appId |
| `NEXT_PUBLIC_BASE_PATH` | 无 URL 前缀 | `apiUrl()` 和 `basePath` 加前缀 |
| `NEXT_PUBLIC_GATEWAY_URL` | SSO 按钮隐藏，只有本地登录 | SSO 按钮显示，可跳转网关登录 |
| `NEXT_PUBLIC_GATEWAY_LOGIN_PATH` | — | 网关登录页路径（默认 `/login`） |
| `GATEWAY_CHECK_TOKEN_URL` | — | SSO 回调时服务端验证 token |

`DB_SCHEMA` 和 `APP_ID` 设为同一个值（session ID）。


---

## 本地开发模式

```env
DATABASE_URL="postgresql://appbuilder:appbuilder@localhost:5432/proj-abc123"
```

其余全部注释掉。不设 `DB_SCHEMA` 则使用 `public` schema。

- `NEXT_PUBLIC_GATEWAY_URL` 未设 → `isSSOEnabled()` 返回 false → SSO 按钮不渲染
- 登录页只显示快速登录卡片 + 用户名密码表单
- 用户来源：`users.ts` 静态数组
- 认证：`proxy.ts` 检查 `mes-session` cookie，没有则重定向 `/login`

```
浏览器 → localhost:3000 → proxy.ts（无 cookie）→ 重定向 /login
  → 点击用户卡片 → POST /api/auth/login → 写 cookie → 跳转 /
  → 后续请求：proxy.ts 见 cookie → 放行
```

## 生产模式（网关代理）

```env
DATABASE_URL="postgresql://user:pass@db-host:5432/proj-abc123"
DB_SCHEMA="session-xyz789"
APP_ID="session-xyz789"
NEXT_PUBLIC_GATEWAY_URL="https://gateway.example.com"
GATEWAY_CHECK_TOKEN_URL="http://gateway-internal:8795/api/bff/auth/check-token"
```

认证流程：网关认证后注入 `user` header，`proxy.ts` 自动建立本地 session。

```
浏览器 → 网关（认证 + 查 app_role_assignment）→ 注入 user header → monoapp
  → proxy.ts：无 cookie 但有 user header
  → 解析 header 中的 appRole → 写 mes-session cookie → 放行
  → 后续请求：proxy.ts 见 cookie → 直接放行
```

登录页的 SSO 按钮是备选入口（用户直接访问 app 的 /login 时），主要流量走网关注入。

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
DB_SCHEMA="session-xyz789"
APP_ID="session-xyz789"
NEXT_PUBLIC_BASE_PATH="/session-xyz789"
NEXT_PUBLIC_GATEWAY_URL="https://gateway.example.com"
GATEWAY_CHECK_TOKEN_URL="http://gateway-internal:8795/api/bff/auth/check-token"
```

**配置网关路由：**

```yaml
- Location: "/session-xyz789/:suffix"
  ProxyPass: "http://monoapp:3000/{{.suffix}}"
  SetParam:
    needAuth: true
    appId: "session-xyz789"
```

以上全部由平台完成，app 代码不感知。

### App 容器启动

平台完成上述准备后，启动 app：

```bash
npm install
npx drizzle-kit push    # 在 DB_SCHEMA 下建表
npx tsx src/db/seed.ts  # 在 DB_SCHEMA 下插入种子数据（首次）
npm run build
npm start
```

---

## 环境变量与代码的对应关系


| 变量                               | 读取位置                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                   | `db/index.ts`、`drizzle.config.ts`、`db/seed.ts`                                         |
| `DIRECT_DATABASE_URL`            | `drizzle.config.ts`、`db/seed.ts`（优先于 DATABASE_URL）                                     |
| `DB_SCHEMA`                      | `db/index.ts`（search_path）、`drizzle.config.ts`（schemaFilter）、`db/seed.ts`（search_path） |
| `APP_ID`                         | `api/manifest/route.ts`                                                                |
| `NEXT_PUBLIC_BASE_PATH`          | `next.config.ts`（basePath）、`lib/utils.ts`（apiUrl）                                      |
| `NEXT_PUBLIC_GATEWAY_URL`        | `lib/sso.ts`（isSSOEnabled、getLoginURL）                                                 |
| `NEXT_PUBLIC_GATEWAY_LOGIN_PATH` | `lib/sso.ts`（getLoginURL）                                                              |
| `GATEWAY_CHECK_TOKEN_URL`        | `lib/sso.ts`（checkToken，服务端）                                                           |


---

## 角色分配

角色由 app 定义，平台负责分配。

1. 平台调 `GET /api/manifest` → 获取 app 当前角色列表（来自 `PERMISSION_MATRIX`）
2. 管理员在平台后台给用户分配角色 → 存入 `app_role_assignment` 表
3. 网关认证时查表 → 将 `appRole` 注入 `user` header
4. `proxy.ts` 读取 `appRole` → 写入 `mes-session` cookie
5. `auth.ts` 读 cookie → `requireAuth()` 正常工作

---

## 场景速查


| 场景            | DATABASE_URL | DB_SCHEMA | APP_ID | SSO 变量 | BASE_PATH |
| ------------- | ------------ | --------- | ------ | ------ | --------- |
| 本地开发          | ✅            | —         | —      | —      | —         |
| 平台预览（session） | ✅            | ✅         | ✅      | —      | 视情况       |
| 生产（网关代理）      | ✅            | ✅         | ✅      | ✅      | 视情况       |


`—` = 不设，使用默认值。