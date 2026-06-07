---
name: tier0-sdk-openapi-vue
version: 0.1.0
description: "OpenAPI Vue3 Composables 使用指南"
---

# Vue3 Composables 使用指南

> 当前 TanStack Start 模板不是 Vue 项目，也不要默认直接使用
> `@tier0/sdk/openapi/vue`。`@tier0/sdk@0.1.1` 发布为 CommonJS 输出，
> 直接进入客户端或 SSR bundle 可能触发 `exports is not defined`。
> 只有用户明确要求 Vue 改造且 SDK 浏览器/ESM 发布格式已确认兼容后，
> 才使用本页示例。

## 前置条件

```bash
npm install vue
```

## 使用 Composables

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
      {{ loading ? '读取中...' : '读取温度' }}
    </button>
    <p v-if="error">错误: {{ error.message }}</p>
    <pre v-if="data">{{ JSON.stringify(data, null, 2) }}</pre>
  </div>
</template>
```

## 所有可用的 Composables

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

每个 Composable 返回：
- `data` — 响应数据（`ref`）
- `loading` — 是否加载中（`ref<boolean>`）
- `error` — 错误对象（`ref<Error | null>`）
- `execute(body)` — 触发请求（异步函数）
