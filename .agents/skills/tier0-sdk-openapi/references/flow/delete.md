---
name: tier0-sdk-openapi-flow-delete
version: 0.2.0
description: "POST /openapi/v1/flow/delete — 删除 Flow（停止 Node-RED 容器）"
---

# delete — `POST /openapi/v1/flow/delete`

> ⚠️ **高风险操作**：删除 Flow 会**停止对应的 Node-RED 容器**，采集/处理立即中断，操作不可撤销。执行前必须向用户确认。

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowdelete(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ids` | integer[] | **是** | 要删除的 Flow DB 主键数组（整数），支持批量。**不是 flowId 字符串** |

## 响应结构

```typescript
{
  code: number;
  msg: string;
  data: { success: boolean };
}
```

## 使用示例

### 删除单个 Flow（需先向用户确认）

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
// ⚠️ 操作前必须确认：删除后 Node-RED 容器停止，数据采集中断
const result = await flowApi.openapiv1flowdelete({
  ids: [42],
});

if (result.data.success) {
  console.log('Flow 已删除，Node-RED 容器已停止');
}
```

### 批量删除

```typescript
await flowApi.openapiv1flowdelete({
  ids: [42, 43, 44],
});
```

> **典型操作顺序**：先 `list` 确认 `id`，向用户展示将被删除的 Flow 名称和状态，确认后再调用 delete。
