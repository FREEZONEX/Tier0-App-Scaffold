---
name: tier0-sdk-openapi-search
version: 0.1.0
description: "POST /openapi/v1/uns/search — SearchReq"
---

# search — `POST /openapi/v1/uns/search`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unssearch(body);
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `include_leaf_value` | boolean(boolean) |  |
| `include_metadata` | boolean(boolean) |  |
| `keyword` | string |  |
| `page` | integer(int64) |  |
| `path_prefix` | string |  |
| `size` | integer(int64) |  |
| `topicType` | string |  |

## 响应类型

`{ code: number, msg: string }`

## 使用示例

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unssearch({
  // 根据实际业务填写参数
});
console.log(result);
```
