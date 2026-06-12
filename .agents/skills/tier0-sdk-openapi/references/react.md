---
name: tier0-sdk-openapi-react
version: 0.1.0
description: "OpenAPI React hooks guide - @tanstack/react-query integration"
---

# React Hooks Guide

> In this TanStack Start scaffold, do not default to `@tier0/sdk/openapi/react`.
> `@tier0/sdk@0.1.3` supports browser-facing ESM exports, but generated apps
> should still prefer app-local server routes that load the SDK through
> `@/lib/tier0`, then call those routes from app-local React hooks. Use the
> native SDK React hooks only when the app explicitly needs direct browser SDK
> access and the runtime exposes the required browser-side env safely.

## Prerequisites

```bash
npm install @tanstack/react-query
```

Wrap the app root with `QueryClientProvider`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <YourApp />
    </QueryClientProvider>
  );
}
```

## Using Hooks

```tsx
import { useOpenapiv1unsread } from '@tier0/sdk/openapi/react';

function TemperatureDisplay() {
  const mutation = useOpenapiv1unsread();

  const handleRead = async () => {
    const result = await mutation.mutateAsync({
      topics: ['Plant/Line1/Metric/Temperature'],
    });
    console.log(result);
  };

  return (
    <div>
      <button onClick={handleRead} disabled={mutation.isPending}>
        {mutation.isPending ? 'Reading...' : 'Read temperature'}
      </button>
      {mutation.isError && <p>Error: {mutation.error.message}</p>}
      {mutation.data && <pre>{JSON.stringify(mutation.data, null, 2)}</pre>}
    </div>
  );
}
```

## Available Hooks

```typescript
import {
  useGwreload,
  useOpenapiv1info,
  useOpenapiv1flowcreate,
  useOpenapiv1flowdelete,
  useOpenapiv1flowdeploy,
  useOpenapiv1flowflowdata,
  useOpenapiv1flowget,
  useOpenapiv1flowlist,
  useOpenapiv1flowupdate,
  useOpenapiv1unsbrowse,
  useOpenapiv1unscreate,
  useOpenapiv1unsdelete,
  useOpenapiv1unshistory,
  useOpenapiv1unsread,
  useOpenapiv1unsrestore,
  useOpenapiv1unssearch,
  useOpenapiv1unsupdate,
  useOpenapiv1unswrite,
} from '@tier0/sdk/openapi/react';
```

Each hook returns a `UseMutationResult`, including:

- `mutate(body)`
- `mutateAsync(body)`
- `data`
- `isPending`
- `isError` / `error`
- `isSuccess`
