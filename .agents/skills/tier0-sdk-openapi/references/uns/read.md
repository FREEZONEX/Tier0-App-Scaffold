---
name: tier0-sdk-openapi-read
version: 0.1.0
description: "POST /openapi/v1/uns/read — ReadReq"
---

# read — `POST /openapi/v1/uns/read`

## SDK Call

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsread(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `include_leaf_value` | boolean(boolean) |  |
| `include_metadata` | boolean(boolean) |  |
| `topics` | array |  **required** |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsread({
  // Fill in values that match the actual use case
});
console.log(result);
```
