---
name: tier0-sdk-openapi-delete
version: 0.1.0
description: "POST /openapi/v1/uns/delete — NodeDeleteReq"
---

# delete — `POST /openapi/v1/uns/delete`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsdelete(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `hard_delete` | boolean(boolean) |  |
| `topics` | array |  **required** |

## 响应类型

`{ code: number, msg: string }`

## 使用示例

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsdelete({
  // 根据实际业务填写参数
});
console.log(result);
```
