---
name: tier0-sdk
version: 0.1.1
description: "Tier0 SDK — TypeScript/JavaScript 统一 SDK。涵盖 OpenAPI REST API 封装（支持 React/Vue3）和 MQ（MQTT over WebSocket）消息队列封装。triggers: Tier0, SDK, OpenAPI, REST, API, MQ, MQTT, WebSocket, React, Vue3, TypeScript"
metadata:
  requires:
    npm: ["@tier0/sdk"]
  hermes:
    tags: [sdk, openapi, rest, api, mq, mqtt, websocket, react, vue3]
---

# tier0-sdk — Tier0 平台 TypeScript SDK

## 概述

`@tier0/sdk` 是 Tier0 Cloud 平台的官方 TypeScript/JavaScript SDK，包含两个子模块：

| 模块 | 能力 | 适用场景 |
|------|------|----------|
| **openapi** | REST API 封装，含类型定义、React Hooks、Vue3 Composables | 前端/Node.js 调用 Tier0 后端 API |
| **mq** | MQTT over WebSocket 封装，支持自动重连、断连重订阅 | 实时数据订阅、设备指令下发 |

## 安装

```bash
npm install @tier0/sdk
```

npm 包页面：https://www.npmjs.com/package/@tier0/sdk

## 平台注入环境变量

SDK 内置 Tier0 平台鉴权，并从平台/runtime 环境读取连接信息。应用部署时平台自动注入这些变量；脚手架、生成 app、`.env.example`、数据库和业务 UI 都不要手写或保存这些值。

| 环境变量 | 说明 | 适用模块 |
|----------|------|----------|
| `TIER0_API_HOST` | 平台自动注入的 OpenAPI 服务地址 | openapi |
| `TIER0_API_KEY` | 平台自动注入的 API 鉴权密钥 | openapi + mq |
| `TIER0_MQTT_HOST` | 平台自动注入的 MQTT Broker 地址 | mq |
| `TIER0_MQTT_PORT` | 平台自动注入的 MQTT WebSocket 端口（默认 8084） | mq |

> 如果平台明确要求浏览器侧 SDK 读取 Vite env，由平台/runtime 注入对应 `VITE_TIER0_*`。生成 app 不要把它们加入 `.env.example` 或用户可编辑字段。

## 生成应用规则

- 不生成 Tier0 SDK 配置页面、集成设置页、API Key 表单、Token 表单、OpenAPI Host 表单、MQTT Host 表单或 Workspace 绑定页面。
- 不把密钥、host、token、credential 作为业务实体、数据库表、用户设置、`.env.example` 占位或可编辑表单字段。
- 只有当用户明确要求“凭据管理/平台连接管理/SDK 配置控制台”时，才创建面向管理员的凭据管理 UI。
- 普通业务应用直接调用 SDK，鉴权失败时显示业务错误或诊断信息，不引导用户在应用内粘贴密钥。

## TanStack Start SSR 兼容与加载边界

本脚手架在 `vite.config.ts` 固化 SDK SSR 打包策略：

```typescript
ssr: {
  external: ["pg", "@tier0/sdk", "mqtt"],
}
```

- 保留 `pg`、`@tier0/sdk`、`mqtt` external。当前 `@tier0/sdk@0.1.1` 发布的是 CommonJS 输出，必须由 Node 按 CJS 外部加载，不能放进 Vite/Rolldown SSR bundle 里当 ESM 执行。
- 保留 `package.json` 的 `postinstall` 和 `scripts/patch-tier0-sdk.mjs`。Node 22 会因为 SDK CJS 文件里的 `import.meta` 把文件误判为 ESM；该脚本在 managed install 后给 SDK 包补 `type: "commonjs"` 并移除 CJS runtime 中的 `import.meta`。
- 不要在页面、route loader、服务模块顶层直接 import `@tier0/sdk/openapi`、`@tier0/sdk/mq`，或任何会在 SSR 初始化阶段立即加载 SDK 的 wrapper。
- 默认使用 `@/lib/tier0` 中的 lazy loaders，例如 `getTier0UnsApi()`、`loadTier0OpenApi()`、`loadTier0Mq()`。这些 helper 在服务端通过 `createRequire` 加载 SDK；只在实际用户动作、server route handler、mutation handler、后台 job 或“分发/发布/写入”路径里 `await`。
- 如果预览或实际调用报 `ReferenceError: exports is not defined in ES module scope` 并且堆栈指向 `@tier0/sdk/openapi` 或 `@tier0/sdk/mq`，先确认 postinstall patch 已执行，再确认 SDK 没有被加入 `ssr.noExternal`，并检查是否有顶层 SDK import；把该 import 移到 lazy loader 调用点。
- 不要为规避 SSR 兼容问题而手写 MQTT client、fetch wrapper、重连逻辑或 UNS/Flow endpoint 名称。
- 如果未来新增类似 CJS 风格依赖，优先 externalize；若依赖只用于可选动作，也要保持 lazy loading，避免拖入 SSR 初始页面路径。

## 子技能路由

| 意图 | 加载文件 | 说明 |
|------|---------|------|
| 使用 OpenAPI REST API | `$tier0-sdk-openapi` | 基础客户端、类型安全调用、React/Vue3 集成 |
| 使用 MQ 消息队列 | `$tier0-sdk-mq` | 订阅/发布、自动重连、通配符、事件监听 |
| 升级 SDK 版本 | 本文档「版本与升级」章节 | npm update、版本差异对照 |

## 版本与升级

### 当前版本

```bash
npm list @tier0/sdk
```

### 升级命令

```bash
# 查看最新版本
npm view @tier0/sdk versions --json

# 升级到最新版
npm install @tier0/sdk@latest

# 升级到指定版本
npm install @tier0/sdk@0.2.0
```

### 版本差异

| 版本 | 变更内容 |
|------|----------|
| `0.1.1` | OpenAPI 18 个端点、MQ 订阅发布、React/Vue3 Hooks、环境变量自动读取 |
| `0.1.0` | 初始版本 |

### 升级后检查

升级后建议执行以下检查：

```bash
# 1. 确认版本
npm list @tier0/sdk

# 2. 检查 TypeScript 类型（如有类型报错，参考下方「Breaking Changes」）
npx tsc --noEmit

# 3. 运行测试
npm test
```

### Breaking Changes 策略

- **minor 版本（0.x.0）**：可能包含 API 调整，升级前请查看 CHANGELOG
- **patch 版本（0.0.x）**：仅修复 bug，可安全升级
- 所有破坏性变更会在 CHANGELOG 中标注迁移路径

## 快速示例

### OpenAPI — 读取 UNS 数据

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

// 平台/runtime 已自动注入 TIER0_API_HOST 和 TIER0_API_KEY
const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsread({
  topics: ['Plant/Line1/Metric/Temperature'],
});
console.log(result);
```

### MQ — 订阅实时数据

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

// 平台/runtime 已自动注入 TIER0_MQTT_HOST 和 TIER0_API_KEY
client.subscribe('Plant/Line1/Metric/Temperature', (topic, payload) => {
  console.log(topic, JSON.parse(payload));
});
```
