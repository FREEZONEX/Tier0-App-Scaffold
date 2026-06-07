---
name: tier0-sdk-openapi-write
version: 0.1.0
description: "POST /openapi/v1/uns/write — WriteReq"
---

# write — `POST /openapi/v1/uns/write`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unswrite(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `qos` | integer(int64) |  |
| `retain` | boolean(boolean) |  |
| `writes` | array |  **required** |

## 响应类型

`{ code: number, msg: string }`

## 使用示例

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unswrite({
  // 根据实际业务填写参数
});
console.log(result);
```
