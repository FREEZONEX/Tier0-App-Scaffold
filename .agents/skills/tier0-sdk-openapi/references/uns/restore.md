---
name: tier0-sdk-openapi-restore
version: 0.1.0
description: "POST /openapi/v1/uns/restore — NodeRestoreReq"
---

# restore — `POST /openapi/v1/uns/restore`

## SDK Call

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsrestore(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `path` | string |  **required** |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsrestore({
  // Fill in values that match the actual use case
});
console.log(result);
```
