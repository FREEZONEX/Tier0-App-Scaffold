---
name: tier0-sdk-openapi-create
version: 0.1.0
description: "POST /openapi/v1/flow/create — FlowCreateReq"
---

# create — `POST /openapi/v1/flow/create`

## SDK Call

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowcreate(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `description` | string |  |
| `flowName` | string |  **required** |
| `flowType` | string |  **required** |
| `template` | string |  |

## Response Type

`components["schemas"]["FlowCreateResp"]`

## Example

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowcreate({
  // Fill in values that match the actual use case
});
console.log(result);
```
