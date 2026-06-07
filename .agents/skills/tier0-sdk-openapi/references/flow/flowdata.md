---
name: tier0-sdk-openapi-flowdata
version: 0.1.0
description: "POST /openapi/v1/flow/flowdata — FlowGetReq"
---

# flowdata — `POST /openapi/v1/flow/flowdata`

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowflowdata(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer(int64) |  **required** |

## 响应类型

`components["schemas"]["FlowDataResp"]`

## 使用示例

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowflowdata({
  // 根据实际业务填写参数
});
console.log(result);
```
