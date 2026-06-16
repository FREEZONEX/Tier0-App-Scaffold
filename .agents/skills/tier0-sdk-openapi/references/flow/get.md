---
name: tier0-sdk-openapi-flow-get
version: 0.2.0
description: "POST /openapi/v1/flow/get — 获取单个 Flow 详情"
---

# get — `POST /openapi/v1/flow/get`

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowget(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | integer | **是** | Flow 的 DB 主键（整数），从 list 接口获取 |

## 响应结构

```typescript
{
  code: number;
  msg: string;
  data: {
    id: number;
    flowId: string;              // Node-RED 内部 id，仅内部使用
    flowName: string;
    flowType: 'source' | 'event';
    flowStatus: 'DRAFT' | 'PENDING' | 'RUNNING';
    description: string;
    isFavorite: number;          // 1 = 已收藏，2 = 未收藏
    currentVersionId: number;
    currentVersionName: string;
    currentVersionType: string;
    createdTime: number;
    updatedTime: number;
  };
}
```

## 使用示例

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowget({ id: 42 });

const flow = result.data;
console.log(flow.flowName, flow.flowStatus);
// modbus-line1  RUNNING
```
