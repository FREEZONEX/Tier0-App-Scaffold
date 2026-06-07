---
name: tier0-sdk-openapi-info
version: 0.1.0
description: "POST /openapi/v1/info — InfoReq"
---

# info — `POST /openapi/v1/info`

## SDK 调用

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.openapiv1info(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| — | — | — |

## 响应类型

`{ code: number, msg: string }`

## 使用示例

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.openapiv1info({
  // 根据实际业务填写参数
});
console.log(result);
```
