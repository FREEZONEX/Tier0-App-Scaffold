---
name: tier0-sdk-openapi-browse
version: 0.1.0
description: "POST /openapi/v1/uns/browse — BrowseReq"
---

# browse — `POST /openapi/v1/uns/browse`

## SDK Call

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsbrowse(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `include_leaf_value` | boolean(boolean) |  |
| `include_metadata` | boolean(boolean) |  |
| `max_depth` | integer(int64) |  |
| `path` | string |  |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsbrowse({
  // Fill in values that match the actual use case
});
console.log(result);
```
