---
name: tier0-sdk-openapi-update
version: 0.1.0
description: "POST /openapi/v1/uns/update — NodeUpdateReq"
---

# update — `POST /openapi/v1/uns/update`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsupdate(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `alias` | string |  |
| `description` | string |  |
| `displayName` | string |  |
| `extendProperties` | object |  |
| `fields` | array |  |
| `name` | string |  |
| `path` | string |  **required** |
| `updateMask` | array |  |

## 响应类型

`{ code: number, msg: string }`

## 使用示例

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsupdate({
  // 根据实际业务填写参数
});
console.log(result);
```
