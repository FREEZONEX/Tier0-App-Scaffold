---
name: tier0-sdk-openapi-history
version: 0.2.0
description: "POST /openapi/v1/uns/history — 查询 UNS topic 历史数据"
---

# history — `POST /openapi/v1/uns/history`

**⚠️ 时间格式和聚合参数极易出错，务必读完本文档再调用。**

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unshistory(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `topics` | string[] | **是** | topic 路径列表（叶子节点，不支持通配符） |
| `start_time` | string | **是** | 起始时间，**ISO 8601 格式**，如 `"2026-01-01T00:00:00Z"` |
| `end_time` | string | **是** | 结束时间，**ISO 8601 格式**，如 `"2026-01-02T00:00:00Z"` |
| `page` | integer | 否 | 页码，默认 1 |
| `size` | integer | 否 | 每页条数，默认 100 |
| `aggregation` | object | 否 | 聚合配置，不传则返回原始数据点 |

### aggregation 结构

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `function` | string | **是** | 聚合函数：`avg` / `max` / `min` / `sum` / `count` |
| `interval` | string | **是** | 聚合时间窗口：`1m`（分钟）/ `1h`（小时）/ `1d`（天） |
| `field` | string | 否 | 聚合字段名（value 对象内的某个字段，如 `"temperature"`） |

> **时间格式注意**：`start_time`/`end_time` 必须是 ISO 8601 字符串，**不能传毫秒整数**。

## 响应结构

批量接口，HTTP 200 **不代表每项成功**，需检查 `data.success` 和 `data.results[i].success`：

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
        total: number;   // 符合条件的总记录数
        page: number;
        size: number;
        records: Array<{
          value: Record<string, unknown>;  // 业务数据对象
          quality: 'Good' | 'Uncertain' | 'Bad';
          timeStamp: number;              // 数据采集时间，毫秒
        }>;
      };
      error?: { code: number; message: string };
    }>;
  };
}
```

## 使用示例

### 查询最近 1 小时原始数据

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const now = new Date();
const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

const result = await unsApi.openapiv1unshistory({
  topics: ['Plant/Line1/Metric/Temperature'],
  start_time: oneHourAgo.toISOString(),  // "2026-06-15T10:00:00.000Z"
  end_time: now.toISOString(),
  size: 200,
});

const item = result.data.results[0];
if (item.success) {
  for (const record of item.result!.records) {
    const temp = record.value as { temperature: number };
    console.log(new Date(record.timeStamp), temp.temperature);
  }
}
```

### 查询 24 小时按小时聚合均值

```typescript
const result = await unsApi.openapiv1unshistory({
  topics: ['Plant/Line1/Metric/Temperature'],
  start_time: '2026-06-14T00:00:00Z',
  end_time: '2026-06-15T00:00:00Z',
  aggregation: {
    function: 'avg',
    interval: '1h',
    field: 'temperature',  // value 对象内的字段名
  },
});

if (result.data.success) {
  const records = result.data.results[0].result?.records ?? [];
  // 每条 record 代表一个小时的均值
  records.forEach(r => {
    console.log(new Date(r.timeStamp).toISOString(), r.value);
  });
}
```

### 多 topic + 分页

```typescript
const result = await unsApi.openapiv1unshistory({
  topics: ['Plant/Line1/Metric/Temperature', 'Plant/Line1/Metric/Humidity'],
  start_time: '2026-06-01T00:00:00Z',
  end_time: '2026-06-08T00:00:00Z',
  page: 1,
  size: 100,
});

for (const item of result.data.results) {
  if (!item.success) {
    console.error(`${item.topic} 查询失败: ${item.error?.message}`);
    continue;
  }
  console.log(`${item.topic}: ${item.result!.total} 条记录`);
}
```

## 常见错误

| 错误 | 原因 | 解决 |
|------|------|------|
| `start_time` 格式报错 | 传入了毫秒整数（如 `1733382000000`） | 改为 ISO 字符串：`new Date(ts).toISOString()` |
| `aggregation.field` 无数据 | 字段名和 value 对象里的 key 不一致 | 先 `read` 一条确认 value 的字段名 |
| `total` 为 0 | 时间范围内无数据，或 topic 路径错误 | 确认 topic 存在且时间范围正确 |
