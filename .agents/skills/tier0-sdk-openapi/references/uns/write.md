---
name: tier0-sdk-openapi-write
version: 0.2.0
description: "POST /openapi/v1/uns/write — 向 UNS topic 写入数据点（VQT）"
---

# write — `POST /openapi/v1/uns/write`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unswrite(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `writes` | WriteItem[] | **是** | 写入项列表，每项对应一个 topic |
| `qos` | integer | 否 | MQTT QoS（0/1/2），默认 0，作用于本次全部写入 |
| `retain` | boolean | 否 | 是否设置 MQTT retain 标志，默认 false |

### WriteItem 结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `topic` | string | **是** | 目标 topic 完整路径（叶子节点），不支持通配符 |
| `value` | object | **是** | **必须是对象**，字段名须符合该 topic 的 fields 定义。不能是裸数字/字符串 |
| `quality` | string | 否 | 数据质量：`Good` / `Uncertain` / `Bad`，默认由平台按 Broker ack 设置 |
| `timeStamp` | integer | 否 | 数据采集时间，**毫秒**时间戳。不传则服务端用当前时间填充 |

> ⚠️ **禁止在 `value` 中写 `_timestamp`** — `_timestamp` 是系统落库时间字段，如需记录采集时刻请用 `timeStamp`（WriteItem 顶层字段）。

## 响应结构

HTTP 200 + 外层 `code:200` **不代表写入全部成功**，必须检查 `data.success` 和 `data.results[i].success`：

```typescript
{
  code: number;      // HTTP 状态，200 仅表示请求到达
  msg: string;
  data: {
    success: boolean;   // 整体是否全部成功
    results: Array<{
      success: boolean; // 单项是否成功
      topic: string;
      // 成功时无额外字段；失败时有 error
      error?: { code: number; message: string };
    }>;
  };
}
```

## 使用示例

### 写入单个 topic

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unswrite({
  writes: [
    {
      topic: 'Plant/Line1/Metric/Temperature',
      value: { temperature: 27.5, unit: 'C' },
    },
  ],
});

if (!result.data.success) {
  for (const item of result.data.results) {
    if (!item.success) {
      console.error(`写入失败 ${item.topic}: ${item.error?.message}`);
    }
  }
}
```

### 批量写入（含采集时间戳）

```typescript
const result = await unsApi.openapiv1unswrite({
  qos: 1,
  writes: [
    {
      topic: 'Plant/Line1/Metric/Temperature',
      value: { temperature: 27.5, humidity: 58.6 },
      timeStamp: Date.now(),
    },
    {
      topic: 'Plant/Line1/Metric/Pressure',
      value: { pressure: 1.013 },
      timeStamp: Date.now(),
    },
  ],
});
```

### 写入前确认 schema（推荐）

不确定 topic 的字段定义时，先 browse 再写：

```typescript
// 1. 先查 schema
const browse = await unsApi.openapiv1unsbrowse({
  path: 'Plant/Line1/Metric/Temperature',
  include_metadata: true,
});
// browse.data.tree[0].fields 包含字段定义（include_metadata: true 时）

// 2. 按 fields 构造 value 再写入
await unsApi.openapiv1unswrite({
  writes: [{ topic: 'Plant/Line1/Metric/Temperature', value: { temperature: 27.5 } }],
});
```

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `success: false` + schema validation | `value` 字段名不符合 fields 定义，或类型不匹配 | 先 browse `include_metadata` 确认 fields |
| `success: false` + topic not found | topic 路径不存在或拼写错误 | 先 browse/search 确认完整路径 |
| `value` 写成标量被拒 | `value: 27.5` 而非 `value: { temperature: 27.5 }` | value 必须是对象 |
