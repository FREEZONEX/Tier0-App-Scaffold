---
name: tier0-sdk-openapi-create
version: 0.1.0
description: "POST /openapi/v1/uns/create - NodeCreateReq"
---

# create - `POST /openapi/v1/uns/create`

## SDK Call

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unscreate(body);
```

## Verify These Points Before the First Call

1. The `openapiv1unscreate(...)` body is not a `path`-style payload and not a
   single topic object. It must match `NodeCreateReq`:

```typescript
type NodeCreateReq = {
  namespace: NamespaceNode[];
};
```

2. Trust the SDK type for the actual `NamespaceNode` shape:

```typescript
type NamespaceNode = {
  name: string;
  type: string;
  alias?: string;
  children?: NamespaceNode[];
  description?: string;
  displayName?: string;
  extendProperties?: Record<string, string>;
  fields?: SchemaField[];
  topicType?: string;
};
```

3. The SDK constrains structure but does not enumerate allowed `type` /
   `topicType` values. If the user or current code does not already define
   those terms, inspect existing nodes with `browse` or `search` first and
   reuse the same vocabulary. Do not guess a payload shape and wait for the
   API to reject it.
4. If the node tree needs an app or project namespace, do not use the template
   default `scaffold`. Resolve the actual app identity from the spec, current
   branding, `APP_ID`, or `/api/manifest` `appId` first.

## Request Parameters

| Field | Type | Notes |
|------|------|------|
| `namespace` | `NamespaceNode[]` | **required**. Represents the node tree to create, not a single path string. |

## Response Type

`{ code: number, msg: string }`

## Example

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();

const result = await unsApi.openapiv1unscreate({
  namespace: [
    {
      name: appNamespaceName,
      type: existingRootType,
      children: [
        {
          name: 'line_1',
          type: existingFolderType,
          children: [
            {
              name: 'temperature',
              type: existingTopicNodeType,
              topicType: existingNumericTopicType,
              displayName: 'Temperature',
              description: 'Line 1 temperature point',
            },
          ],
        },
      ],
    },
  ],
});
console.log(result);
```

## Do Not Call It Like This

These payloads should not be your first attempt:

```typescript
await unsApi.openapiv1unscreate({
  path: '/plant/line_1/temperature',
  type: 'float',
});

await unsApi.openapiv1unscreate({
  topic: 'plant/line_1/temperature',
  valueType: 'number',
});
```
