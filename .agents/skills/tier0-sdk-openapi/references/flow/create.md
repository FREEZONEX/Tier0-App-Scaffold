---
name: tier0-sdk-openapi-create
version: 0.1.0
description: "POST /openapi/v1/flow/create — FlowCreateReq"
---

# create — `POST /openapi/v1/flow/create`

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowcreate(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `description` | string |  |
| `flowName` | string |  **required** |
| `flowType` | string |  **required** |
| `template` | string |  |

## 响应类型

`components["schemas"]["FlowCreateResp"]`

## 使用示例

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowcreate({
  // 根据实际业务填写参数
});
console.log(result);
```
