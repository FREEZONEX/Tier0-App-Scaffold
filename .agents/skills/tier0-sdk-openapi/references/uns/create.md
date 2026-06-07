---
name: tier0-sdk-openapi-create
version: 0.1.0
description: "POST /openapi/v1/uns/create — NodeCreateReq"
---

# create — `POST /openapi/v1/uns/create`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unscreate(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `namespace` | array |  **required** |

## 响应类型

`{ code: number, msg: string }`

## 使用示例

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unscreate({
  // 根据实际业务填写参数
});
console.log(result);
```
