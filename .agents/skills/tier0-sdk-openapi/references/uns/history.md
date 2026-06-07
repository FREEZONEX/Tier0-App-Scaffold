---
name: tier0-sdk-openapi-history
version: 0.1.0
description: "POST /openapi/v1/uns/history — HistoryReq"
---

# history — `POST /openapi/v1/uns/history`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unshistory(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `aggregation` | any |  |
| `end_time` | string |  **required** |
| `page` | integer(int64) |  |
| `size` | integer(int64) |  |
| `start_time` | string |  **required** |
| `topics` | array |  **required** |

## 响应类型

`{ code: number, msg: string }`

## 使用示例

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unshistory({
  // 根据实际业务填写参数
});
console.log(result);
```
