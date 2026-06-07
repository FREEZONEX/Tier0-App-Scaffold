---
name: tier0-sdk-openapi
version: 0.1.0
description: "Tier0 SDK OpenAPI 模块 — REST API 类型安全封装。支持基础 HTTP 客户端、React Hooks（@tanstack/react-query）、Vue3 Composables。涵盖 UNS、Flow、System 三大类 18 个端点。triggers: Tier0, SDK, OpenAPI, REST, API, UNS, Flow, React, Vue3"
metadata:
  requires:
    npm: ["@tier0/sdk"]
  hermes:
    tags: [sdk, openapi, rest, api, react, vue3, uns, flow]
---

# tier0-sdk-openapi — REST API 封装

## 何时使用本 Skill

### 应该使用

- 前端或 Node.js 项目需要调用 Tier0 后端 API
- 需要类型安全的 API 调用（TypeScript 类型从 swagger.json 自动生成）
- React 项目希望用 useMutation/useQuery 风格调用 API
- Vue3 项目希望用 Composables 风格调用 API

### 不应该使用

- 需要实时数据订阅 → 走 `$tier0-sdk-mq`（MQ 是推送，OpenAPI 是拉取）
- 需要 MQTT 发布 → 走 `$tier0-sdk-mq`
- 直接操作数据库或底层协议 → 不在 SDK 范围内

## 不可违反规则

1. **SDK 鉴权和连接信息由平台/runtime/SDK 负责** — 不要在生成应用中创建 API Key、Token、OpenAPI Host、Workspace 绑定或连接配置页面
2. **API 返回类型从 swagger.json 生成** — 不要手动构造响应类型，使用 `components["schemas"]["xxx"]` 或从 `types.ts` 导入
3. **不要在本模板客户端直接 import SDK React Hooks** — 当前 SDK 包为 CommonJS 输出，`@tier0/sdk/openapi/react` 不能作为生成应用的默认客户端数据层。用 app-local React hooks 调用本应用 server route，由 server route 通过 `@/lib/tier0` lazy loader 调 SDK。
4. **Vue3 Composables 不适用本模板** — 本模板不是 Vue 项目，不要 import `@tier0/sdk/openapi/vue`，除非用户明确要求改造为 Vue 且 SDK 发布格式已确认兼容。
5. **不要手写鉴权 UI** — 401/403 只作为错误状态或诊断信息展示，除非用户明确要求凭据管理控制台
6. **保留 SSR external policy + lazy loading** — `vite.config.ts` 必须保留 `ssr.external: ["pg", "@tier0/sdk", "mqtt"]`；不要把 SDK 放进 `ssr.noExternal`。同时不要在页面、loader、服务模块顶层直接 import `@tier0/sdk/openapi`。默认从 `@/lib/tier0` 引入 `loadTier0OpenApi()`、`getTier0UnsApi()`、`getTier0FlowApi()`、`getTier0SystemApi()`，只在实际读取、写入、分发、发布等 action 内部 `await` SDK。不要手写 fetch wrapper 绕过 SDK。

## 子技能路由

### 通用指南

| 意图 | 加载文件 | 说明 |
|------|---------|------|
| 客户端基础使用 | `references/quickstart.md` | runtime/env 约定、基础调用、诊断 |
| React Hooks 使用 | `references/react.md` | useMutation 风格、QueryClient 配置 |
| Vue3 Composables 使用 | `references/vue.md` | ref/reactive 风格、响应式数据 |

### System 端点

| 端点 | 加载文件 | 说明 |
|------|---------|------|
| `GET /gw/reload` | `references/reload.md` | 网关重载 |
| `POST /openapi/v1/info` | `references/info.md` | 服务信息 |
| `POST /openapi/v1/auth/whoami` | `references/auth/whoami.md` | API Key 身份/权限诊断 |

### Flow 端点

| 端点 | 加载文件 | 说明 |
|------|---------|------|
| `POST /openapi/v1/flow/create` | `references/flow/create.md` | 创建 Flow |
| `POST /openapi/v1/flow/delete` | `references/flow/delete.md` | 删除 Flow |
| `POST /openapi/v1/flow/deploy` | `references/flow/deploy.md` | 部署 Flow |
| `POST /openapi/v1/flow/flowdata` | `references/flow/flowdata.md` | 获取 Flow 画布数据 |
| `POST /openapi/v1/flow/get` | `references/flow/get.md` | 获取 Flow 详情 |
| `POST /openapi/v1/flow/list` | `references/flow/list.md` | 列出 Flow |
| `POST /openapi/v1/flow/nodes` | `references/flow/nodes.md` | 可用节点查询 |
| `POST /openapi/v1/flow/update` | `references/flow/update.md` | 更新 Flow |

### UNS 端点

| 端点 | 加载文件 | 说明 |
|------|---------|------|
| `POST /openapi/v1/uns/browse` | `references/uns/browse.md` | 浏览命名空间 |
| `POST /openapi/v1/uns/create` | `references/uns/create.md` | 创建节点 |
| `POST /openapi/v1/uns/delete` | `references/uns/delete.md` | 删除节点 |
| `POST /openapi/v1/uns/history` | `references/uns/history.md` | 查询历史 |
| `POST /openapi/v1/uns/read` | `references/uns/read.md` | 读取数据点 |
| `POST /openapi/v1/uns/restore` | `references/uns/restore.md` | 恢复节点 |
| `POST /openapi/v1/uns/search` | `references/uns/search.md` | 搜索节点 |
| `POST /openapi/v1/uns/update` | `references/uns/update.md` | 更新节点 |
| `POST /openapi/v1/uns/write` | `references/uns/write.md` | 写入数据点 |

## API 模块速查

```typescript
import {
  getTier0FlowApi,
  getTier0SystemApi,
  getTier0UnsApi,
} from '@/lib/tier0';

const systemApi = await getTier0SystemApi();
const flowApi = await getTier0FlowApi();
const unsApi = await getTier0UnsApi();
```

| 模块 | 端点 | 说明 |
|------|------|------|
| `systemApi` | `gwreload()` | 网关重载 |
| `systemApi` | `openapiv1authwhoami(body?)` | API Key 身份/权限诊断 |
| `systemApi` | `openapiv1info(body)` | 服务信息 |
| `flowApi` | `openapiv1flowcreate(body)` | 创建 Flow |
| `flowApi` | `openapiv1flowdelete(body)` | 删除 Flow |
| `flowApi` | `openapiv1flowdeploy(body)` | 部署 Flow |
| `flowApi` | `openapiv1flowflowdata(body)` | 获取 Flow 画布数据 |
| `flowApi` | `openapiv1flowget(body)` | 获取 Flow 详情 |
| `flowApi` | `openapiv1flowlist(body)` | 列出 Flow |
| `flowApi` | `openapiv1flownodes(body)` | 可用节点查询 |
| `flowApi` | `openapiv1flowupdate(body)` | 更新 Flow |
| `unsApi` | `openapiv1unsbrowse(body)` | 浏览命名空间 |
| `unsApi` | `openapiv1unscreate(body)` | 创建节点 |
| `unsApi` | `openapiv1unsdelete(body)` | 删除节点 |
| `unsApi` | `openapiv1unshistory(body)` | 查询历史 |
| `unsApi` | `openapiv1unsread(body)` | 读取数据点 |
| `unsApi` | `openapiv1unsrestore(body)` | 恢复节点 |
| `unsApi` | `openapiv1unssearch(body)` | 搜索节点 |
| `unsApi` | `openapiv1unsupdate(body)` | 更新节点 |
| `unsApi` | `openapiv1unswrite(body)` | 写入数据点 |
