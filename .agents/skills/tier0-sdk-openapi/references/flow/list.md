---
name: tier0-sdk-openapi-list
version: 0.1.0
description: "POST /openapi/v1/flow/list — FlowListReq"
---

# list — `POST /openapi/v1/flow/list`

## SDK Call

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowlist(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `flowType` | string |  |
| `keyword` | string |  |

## Response Type

`components["schemas"]["FlowListResp"]`

## Example

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowlist({
  // Fill in values that match the actual use case
});
console.log(result);
```
