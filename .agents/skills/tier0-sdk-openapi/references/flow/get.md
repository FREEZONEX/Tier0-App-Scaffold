---
name: tier0-sdk-openapi-get
version: 0.1.0
description: "POST /openapi/v1/flow/get — FlowGetReq"
---

# get — `POST /openapi/v1/flow/get`

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowget(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer(int64) |  **required** |

## 响应类型

`components["schemas"]["FlowInfo"]`

## 使用示例

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowget({
  // 根据实际业务填写参数
});
console.log(result);
```
