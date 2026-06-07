---
name: tier0-sdk-openapi-list
version: 0.1.0
description: "POST /openapi/v1/flow/list — FlowListReq"
---

# list — `POST /openapi/v1/flow/list`

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowlist(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `flowType` | string |  |
| `keyword` | string |  |

## 响应类型

`components["schemas"]["FlowListResp"]`

## 使用示例

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowlist({
  // 根据实际业务填写参数
});
console.log(result);
```
