---
name: tier0-sdk-openapi-deploy
version: 0.1.0
description: "POST /openapi/v1/flow/deploy — FlowDeployReq"
---

# deploy — `POST /openapi/v1/flow/deploy`

## SDK Call

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowdeploy(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `flowsJson` | string |  **required** |
| `id` | integer(int64) |  **required** |

## Response Type

`components["schemas"]["FlowDeployResp"]`

## Example

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

const result = await flowApi.openapiv1flowdeploy({
  // Fill in values that match the actual use case
});
console.log(result);
```
