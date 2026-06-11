---
name: tier0-sdk-openapi-delete
version: 0.1.0
description: "POST /openapi/v1/uns/delete — NodeDeleteReq"
---

# delete — `POST /openapi/v1/uns/delete`

## SDK Call

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsdelete(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `hard_delete` | boolean(boolean) |  |
| `topics` | array |  **required** |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsdelete({
  // Fill in values that match the actual use case
});
console.log(result);
```
