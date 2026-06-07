---
name: tier0-sdk-openapi-update
version: 0.1.0
description: "POST /openapi/v1/flow/update — FlowUpdateReq"
---

# update — `POST /openapi/v1/flow/update`

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowupdate(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `description` | string |  |
| `flowName` | string |  |
| `id` | integer(int64) |  **required** |
| `isFavorite` | integer(int64) |  |
| `template` | string |  |

## 响应类型

`components["schemas"]["FlowEmptyResp"]`

## 使用示例

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowupdate({
  // 根据实际业务填写参数
});
console.log(result);
```
