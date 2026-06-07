---
name: tier0-sdk-openapi-reload
version: 0.1.0
description: "GET /gw/reload — 无请求体"
---

# reload — `GET /gw/reload`

## SDK 调用

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.gwreload();
```

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| — | — | 此接口无需请求体 |

## 响应类型

`components["schemas"]["Response"]`

## 使用示例

```typescript
import { getTier0SystemApi } from '@/lib/tier0';

const systemApi = await getTier0SystemApi();

const result = await systemApi.gwreload();
console.log(result);
```
