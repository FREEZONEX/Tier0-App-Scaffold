---
name: tier0-sdk-openapi-vue
version: 0.1.0
description: "OpenAPI Vue3 composables guide"
---

# Vue3 Composables Guide

> This TanStack Start scaffold is not a Vue project and should not default to
> `@tier0/sdk/openapi/vue`. `@tier0/sdk@0.1.3` supports ESM exports, but this
> page should be used only when the user explicitly asks for a Vue
> implementation and the runtime safely exposes the required browser-side env.

## Prerequisites

```bash
npm install vue
```

## Using Composables

```vue
<script setup lang="ts">
import { useOpenapiv1unsread } from '@tier0/sdk/openapi/vue';

const { data, loading, error, execute } = useOpenapiv1unsread();

const handleRead = async () => {
  await execute({
    topics: ['Plant/Line1/Metric/Temperature'],
  });
};
</script>

<template>
  <div>
    <button @click="handleRead" :disabled="loading">
      {{ loading ? 'Reading...' : 'Read temperature' }}
    </button>
    <p v-if="error">Error: {{ error.message }}</p>
    <pre v-if="data">{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>
```

## Available Composables

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
} from '@tier0/sdk/openapi/vue';
```

Each composable returns:

- `data`
- `loading`
- `error`
- `execute(body)`
