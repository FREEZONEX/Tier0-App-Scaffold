---
name: tier0-sdk-openapi-history
version: 0.1.0
description: "POST /openapi/v1/uns/history — HistoryReq"
---

# history — `POST /openapi/v1/uns/history`

## SDK Call

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unshistory(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `aggregation` | any |  |
| `end_time` | string |  **required** |
| `page` | integer(int64) |  |
| `size` | integer(int64) |  |
| `start_time` | string |  **required** |
| `topics` | array |  **required** |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unshistory({
  // Fill in values that match the actual use case
});
console.log(result);
```
