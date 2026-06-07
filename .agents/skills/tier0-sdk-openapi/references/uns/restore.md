---
name: tier0-sdk-openapi-restore
version: 0.1.0
description: "POST /openapi/v1/uns/restore — NodeRestoreReq"
---

# restore — `POST /openapi/v1/uns/restore`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsrestore(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `path` | string |  **required** |

## 响应类型

`{ code: number, msg: string }`

## 使用示例

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsrestore({
  // 根据实际业务填写参数
});
console.log(result);
```
