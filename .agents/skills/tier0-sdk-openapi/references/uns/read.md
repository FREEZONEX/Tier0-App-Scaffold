---
name: tier0-sdk-openapi-read
version: 0.1.0
description: "POST /openapi/v1/uns/read — ReadReq"
---

# read — `POST /openapi/v1/uns/read`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsread(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `include_leaf_value` | boolean(boolean) |  |
| `include_metadata` | boolean(boolean) |  |
| `topics` | array |  **required** |

## 响应类型

`{ code: number, msg: string }`

## 使用示例

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsread({
  // 根据实际业务填写参数
});
console.log(result);
```
