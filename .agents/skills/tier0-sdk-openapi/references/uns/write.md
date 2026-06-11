---
name: tier0-sdk-openapi-write
version: 0.1.0
description: "POST /openapi/v1/uns/write — WriteReq"
---

# write — `POST /openapi/v1/uns/write`

## SDK Call

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unswrite(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `qos` | integer(int64) |  |
| `retain` | boolean(boolean) |  |
| `writes` | array |  **required** |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unswrite({
  // Fill in values that match the actual use case
});
console.log(result);
```
