---
name: tier0-sdk-openapi-info
version: 0.1.0
description: "POST /openapi/v1/info - InfoReq"
---

# info - `POST /openapi/v1/info`

## SDK Call

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.openapiv1info(body);
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| — | — | — |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.openapiv1info({
  // No body fields are currently required.
});
console.log(result);
```
