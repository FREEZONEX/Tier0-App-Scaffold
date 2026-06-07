---
name: tier0-sdk-openapi-deploy
version: 0.1.0
description: "POST /openapi/v1/flow/deploy — FlowDeployReq"
---

# deploy — `POST /openapi/v1/flow/deploy`

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowdeploy(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `flowsJson` | string |  **required** |
| `id` | integer(int64) |  **required** |

## 响应类型

`components["schemas"]["FlowDeployResp"]`

## 使用示例

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowdeploy({
  // 根据实际业务填写参数
});
console.log(result);
```
