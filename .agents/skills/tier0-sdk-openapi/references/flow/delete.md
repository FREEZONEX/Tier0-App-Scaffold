---
name: tier0-sdk-openapi-delete
version: 0.1.0
description: "POST /openapi/v1/flow/delete — FlowDeleteReq"
---

# delete — `POST /openapi/v1/flow/delete`

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowdelete(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `ids` | array |  **required** |

## 响应类型

`components["schemas"]["FlowEmptyResp"]`

## 使用示例

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowdelete({
  // 根据实际业务填写参数
});
console.log(result);
```
