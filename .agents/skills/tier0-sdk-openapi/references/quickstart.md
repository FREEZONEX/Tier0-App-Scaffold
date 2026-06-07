---
name: tier0-sdk-openapi-quickstart
version: 0.1.0
description: "OpenAPI 模块快速开始：runtime 配置约定、configureClient、基础 API 调用"
---

# OpenAPI 快速开始

## 运行时配置约定

SDK 内置 Tier0 鉴权，并从平台/runtime 环境读取连接信息。应用部署时平台自动注入下面变量；生成 app 不要在脚手架、`.env.example`、数据库或业务 UI 中手写这些值。

生成应用时：

- 不创建 API Key、Token、OpenAPI Host、Workspace 绑定或连接设置页面。
- 不把 SDK 凭据保存到应用数据库。
- 不把 SDK 鉴权变量加入 `.env.example` 或用户设置。
- 不要求普通用户在业务 UI 中粘贴密钥。
- 只有用户明确要求凭据管理控制台时，才生成相关 UI。

| 变量 | 用途 | 说明 |
|------|------|------|
| `TIER0_API_HOST` | 平台自动注入 | OpenAPI 服务地址（gwsvr） |
| `TIER0_API_KEY` | 平台自动注入 | API 认证密钥 |

普通业务应用不需要调用 `configureClient()` 配置鉴权；直接使用 SDK API，让平台/runtime 注入鉴权与连接信息。`configureClient()` 只用于平台外测试脚本或用户明确要求的管理员凭据控制台。

在 TanStack Start 模板中，SDK 运行时值必须 lazy load：不要在页面、loader、服务模块顶层直接 import `@tier0/sdk/openapi`。从 `@/lib/tier0` 引入 loader，并在实际 action 内部 `await`。

## 基础调用

### 读取 UNS 数据点

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsread({
  topics: ['Plant/Line1/Metric/Temperature'],
});
// result: components["schemas"]["NamespaceNode"][]
```

### 浏览命名空间

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const nodes = await unsApi.openapiv1unsbrowse({
  path: 'Plant/Line1',
  include_metadata: true,
});
```

### 写入数据

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
await unsApi.openapiv1unswrite({
  writes: [
    {
      topic: 'Plant/Line1/Metric/Temperature',
      value: { temperature: 27.5, unit: 'C' },
    },
  ],
});
```

### 列出 Flow

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const flows = await flowApi.openapiv1flowlist({
  flowType: 'source',
});
```

## 类型使用

所有类型从 `types.ts` 导出：

```typescript
import type { components } from '@tier0/sdk/openapi';

type BrowseReq = components['schemas']['BrowseReq'];
type FlowInfo = components['schemas']['FlowInfo'];
```

## 错误处理

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

try {
  const unsApi = await getTier0UnsApi();
  const result = await unsApi.openapiv1unsread({ topics: ['invalid'] });
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message); // "HTTP 404: ..."
  }
}
```
