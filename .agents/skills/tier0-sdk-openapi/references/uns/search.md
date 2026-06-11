---
name: tier0-sdk-openapi-search
version: 0.1.0
description: "POST /openapi/v1/uns/search — SearchReq"
---

# search — `POST /openapi/v1/uns/search`

## SDK Call

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unssearch(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `include_leaf_value` | boolean(boolean) |  |
| `include_metadata` | boolean(boolean) |  |
| `keyword` | string |  |
| `page` | integer(int64) |  |
| `path_prefix` | string |  |
| `size` | integer(int64) |  |
| `topicType` | string |  |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unssearch({
  // Fill in values that match the actual use case
});
console.log(result);
```
