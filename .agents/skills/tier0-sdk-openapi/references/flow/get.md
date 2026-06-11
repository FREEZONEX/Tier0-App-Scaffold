---
name: tier0-sdk-openapi-get
version: 0.1.0
description: "POST /openapi/v1/flow/get — FlowGetReq"
---

# get — `POST /openapi/v1/flow/get`

## SDK Call

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowget(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `id` | integer(int64) |  **required** |

## Response Type

`components["schemas"]["FlowInfo"]`

## Example

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowget({
  // Fill in values that match the actual use case
});
console.log(result);
```
