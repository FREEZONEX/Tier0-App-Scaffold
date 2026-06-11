---
name: tier0-sdk-flow-nodes
version: 0.1.0
description: "SDK flow nodes call - query the Node-RED node types available in the current workspace"
---

# flow nodes - available node lookup

Before constructing `flowsJson`, query the actual node types available for the current workspace and target Flow type.

> The `"type"` field on each node in `flowsJson` must exactly match one of the strings returned by `/flow/nodes`. If it does not, Node-RED will reject the flow definition.

## API

```
POST /openapi/v1/flow/nodes
```

## Request Parameters

| Field | Type | Required | Notes |
|------|------|------|------|
| `flowType` | string | yes | `SourceFlow` or `EventFlow`; the backend also accepts `source` / `event` |

## SDK Call Example

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();

// Query available nodes for SourceFlow
const sourceNodes = await flowApi.openapiv1flownodes({
  flowType: 'SourceFlow',
});
console.log(sourceNodes);

// Query available nodes for EventFlow
const eventNodes = await flowApi.openapiv1flownodes({
  flowType: 'EventFlow',
});
console.log(eventNodes);
```

## Response Shape

```json
{
  "code": 200,
  "msg": "ok",
  "data": {
    "nodes": [
      {
        "id": "node-red",
        "name": "Node-RED nodes",
        "types": ["inject", "debug", "function"],
        "enabled": true,
        "module": "node-red",
        "version": "x.y.z"
      }
    ]
  }
}
```

## Usage Rules

1. Only use strings from `data.nodes[].types[]` as `flowsJson` node `type` values.
2. Do not use node sets where `enabled=false` for new canvases.
3. The same logical node may differ between `SourceFlow` and `EventFlow`, so query them separately.
4. The live API response takes precedence over any static reference table.
