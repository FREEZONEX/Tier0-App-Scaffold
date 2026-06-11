---
name: tier0-sdk-openapi-flowdata
version: 0.1.0
description: "POST /openapi/v1/flow/flowdata — FlowGetReq"
---

# flowdata — `POST /openapi/v1/flow/flowdata`

## SDK Call

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowflowdata(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `id` | integer(int64) |  **required** |

## Response Type

`components["schemas"]["FlowDataResp"]`

## Example

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowflowdata({
  // Fill in values that match the actual use case
});
console.log(result);
```
