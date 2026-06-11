---
name: tier0-sdk-openapi-update
version: 0.1.0
description: "POST /openapi/v1/flow/update — FlowUpdateReq"
---

# update — `POST /openapi/v1/flow/update`

## SDK Call

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowupdate(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `description` | string |  |
| `flowName` | string |  |
| `id` | integer(int64) |  **required** |
| `isFavorite` | integer(int64) |  |
| `template` | string |  |

## Response Type

`components["schemas"]["FlowEmptyResp"]`

## Example

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowupdate({
  // Fill in values that match the actual use case
});
console.log(result);
```
