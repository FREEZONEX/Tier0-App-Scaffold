---
name: tier0-sdk-openapi-delete
version: 0.1.0
description: "POST /openapi/v1/flow/delete — FlowDeleteReq"
---

# delete — `POST /openapi/v1/flow/delete`

## SDK Call

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowdelete(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `ids` | array |  **required** |

## Response Type

`components["schemas"]["FlowEmptyResp"]`

## Example

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowdelete({
  // Fill in values that match the actual use case
});
console.log(result);
```
