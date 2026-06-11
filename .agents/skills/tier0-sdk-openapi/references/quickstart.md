---
name: tier0-sdk-openapi-quickstart
version: 0.1.0
description: "OpenAPI quick start: runtime config contract, configureClient guidance, and base API calls"
---

# OpenAPI Quick Start

## Runtime Configuration Contract

The SDK reads auth and connection values from the platform/runtime environment.
Generated apps should not hardcode these values into the scaffold,
`.env.example`, the database, or user-facing settings.

When generating an app:

- Do not create API key, token, OpenAPI host, workspace-binding, or generic
  connection settings pages.
- Do not persist SDK credentials in the application database.
- Do not add SDK auth variables to `.env.example` or user settings.
- Do not ask ordinary users to paste keys into business UIs.
- Only build credential-management UI when the user explicitly asks for it.

| Variable | Purpose | Notes |
|---|---|---|
| `TIER0_API_HOST` | Platform-injected | OpenAPI service host |
| `TIER0_API_KEY` | Platform-injected | API auth credential |

Normal business apps do not need `configureClient()` for auth. Use the SDK API
through the runtime-injected values. Reserve `configureClient()` for
off-platform test scripts or an explicitly requested admin credential console.

In this TanStack Start scaffold, SDK loading must stay lazy. Do not top-level
import `@tier0/sdk/openapi` in pages, loaders, or services. Load it through
`@/lib/tier0` and await it only inside concrete actions.

## Basic Calls

### Read UNS data points

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsread({
  topics: ['Plant/Line1/Metric/Temperature'],
});
```

### Browse a namespace

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const nodes = await unsApi.openapiv1unsbrowse({
  path: 'Plant/Line1',
  include_metadata: true,
});
```

### Write data

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
await unsApi.openapiv1unswrite({
  writes: [
    {
      topic: 'Plant/Line1/Metric/Temperature',
      value: { temperature: 27.5, unit: 'C' },
    },
  ],
});
```

### List flows

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const flows = await flowApi.openapiv1flowlist({
  flowType: 'source',
});
```

## Type Usage

```typescript
import type { components } from '@tier0/sdk/openapi';

type BrowseReq = components['schemas']['BrowseReq'];
type FlowInfo = components['schemas']['FlowInfo'];
```

## Error Handling

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

try {
  const unsApi = await getTier0UnsApi();
  const result = await unsApi.openapiv1unsread({ topics: ['invalid'] });
} catch (error) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```
