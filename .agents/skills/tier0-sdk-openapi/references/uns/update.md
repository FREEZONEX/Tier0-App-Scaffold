---
name: tier0-sdk-openapi-update
version: 0.1.0
description: "POST /openapi/v1/uns/update — NodeUpdateReq"
---

# update — `POST /openapi/v1/uns/update`

## SDK Call

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsupdate(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `alias` | string |  |
| `description` | string |  |
| `displayName` | string |  |
| `extendProperties` | object |  |
| `fields` | array |  |
| `name` | string |  |
| `path` | string |  **required** |
| `updateMask` | array |  |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unsupdate({
  // Fill in values that match the actual use case
});
console.log(result);
```
