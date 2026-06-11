---
name: tier0-sdk-openapi-reload
version: 0.1.0
description: "GET /gw/reload - no request body"
---

# reload - `GET /gw/reload`

## SDK Call

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.gwreload();
```

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| — | — | No request body is required for this endpoint. |

## Response Type

`components["schemas"]["Response"]`

## Example

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.gwreload();
console.log(result);
```
