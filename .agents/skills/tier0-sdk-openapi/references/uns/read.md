---
name: tier0-sdk-openapi-read
version: 0.2.0
description: "POST /openapi/v1/uns/read — 读取 UNS topic 当前值（VQT 结构）"
---

# read — `POST /openapi/v1/uns/read`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsread(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `topics` | string[] | **是** | topic 路径列表，支持通配符：`+` 匹配单层，`#` 匹配剩余所有层 |
| `include_metadata` | boolean | 否 | 同时返回 topicType、fields（字段定义）、description 等元数据。**首次读取未知 topic 时强烈建议开启** |
| `include_leaf_value` | boolean | 否 | 配合通配符使用，展开时同时返回叶子节点的当前值 |

## 响应结构

批量接口，HTTP 200 **不代表每项成功**，必须检查 `data.success` 和 `data.results[i].success`：

```typescript
{
  code: number;
  msg: string;
  data: {
    success: boolean;
    results: Array<{
      success: boolean;
      topic: string;
      result?: {
        // VQT 结构
        value: Record<string, unknown> | null;  // 业务数据对象，Bad/GoodNoData 时为 null
        quality: 'Good' | 'Uncertain' | 'Bad' | 'GoodNoData';
        timeStamp: number;  // 数据采集时间，毫秒
      };
      metadata?: {           // 仅 include_metadata: true 时返回
        topicType: 'METRIC' | 'ACTION' | 'STATE';
        description: string;
        fields: Array<{ name: string; type: string; unit?: string }>;
      };
      error?: { code: number; message: string };
    }>;
  };
}
```

### quality 含义

| quality | 含义 | value 状态 |
|---------|------|-----------|
| `Good` | 值有效且新鲜 | 非 null |
| `Uncertain` | 可信度存疑 | 非 null |
| `Bad` | 数据源断开/不可信 | `null` 或保留 last-known |
| `GoodNoData` | topic 已建模但未收到任何数据 | `null` |

## 使用示例

### 读取单个 topic

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsread({
  topics: ['Plant/Line1/Metric/Temperature'],
});

const item = result.data.results[0];
if (item.success && item.result?.quality === 'Good') {
  const temp = item.result.value as { temperature: number; unit: string };
  console.log(temp.temperature); // 27.5
}
```

### 首次读取 — 同时查字段定义

```typescript
const result = await unsApi.openapiv1unsread({
  topics: ['Plant/Line1/Metric/Temperature'],
  include_metadata: true,
});

const item = result.data.results[0];
if (item.success) {
  console.log(item.metadata?.fields);
  // [{ name: 'temperature', type: 'float', unit: '°C' }, ...]
  console.log(item.result?.value);
  // { temperature: 27.5, unit: 'C' }
}
```

### 通配符批量读取

```typescript
const result = await unsApi.openapiv1unsread({
  topics: ['Plant/+/Metric/Temperature'],  // 所有产线温度
});

for (const item of result.data.results) {
  if (!item.success) continue;
  if (item.result?.quality !== 'Good') continue;
  console.log(item.topic, item.result.value);
}
```

### 处理 null value（数据源断开）

```typescript
const item = result.data.results[0];
if (item.success) {
  if (item.result?.quality === 'Bad' || item.result?.quality === 'GoodNoData') {
    // 数据不可用，value 为 null
    console.warn('数据不可用:', item.result.quality);
  } else {
    // Good / Uncertain，value 有效
    console.log(item.result?.value);
  }
}
```
