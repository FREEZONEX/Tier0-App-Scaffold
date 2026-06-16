---
name: tier0-sdk-openapi-flow-list
version: 0.2.0
description: "POST /openapi/v1/flow/list — 列出 Flow"
---

# list — `POST /openapi/v1/flow/list`

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowlist(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `flowType` | string | 否 | 按类型过滤：`source`（数据采集 Flow）/ `event`（事件处理 Flow）。不传则返回全部 |
| `keyword` | string | 否 | 按名称关键词过滤 |

## 响应结构

```typescript
{
  code: number;
  msg: string;
  data: {
    list: Array<{
      id: number;                  // DB 主键，CLI/API 操作均用此 id
      flowId: string;              // Node-RED 内部 flow id（tab id），仅内部使用
      flowName: string;
      flowType: 'source' | 'event';
      flowStatus: 'DRAFT' | 'PENDING' | 'RUNNING';
      description: string;
      isFavorite: number;          // 1 = 已收藏，2 = 未收藏
      currentVersionId: number;
      currentVersionName: string;
      createdTime: number;         // 毫秒时间戳
      updatedTime: number;
    }>;
  };
}
```

> ⚠️ **`id` ≠ `flowId`**：所有后续操作（get/update/delete/deploy）均使用整数 `id`，`flowId` 是 Node-RED 内部字符串，不可用于 API 参数。

## 使用示例

### 列出所有 Flow

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowlist({});

for (const flow of result.data.list) {
  console.log(flow.id, flow.flowName, flow.flowType, flow.flowStatus);
}
```

### 只列出 SourceFlow

```typescript
const result = await flowApi.openapiv1flowlist({
  flowType: 'source',
});
```

### 按名称搜索

```typescript
const result = await flowApi.openapiv1flowlist({
  keyword: 'modbus',
});
const flow = result.data.list[0];
if (flow) {
  console.log(`找到 Flow id=${flow.id}, 状态=${flow.flowStatus}`);
}
```
