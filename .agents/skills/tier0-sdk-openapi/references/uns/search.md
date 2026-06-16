---
name: tier0-sdk-openapi-search
version: 0.3.0
description: "POST /openapi/v1/uns/search — 按关键词搜索 UNS 节点"
---

# search — `POST /openapi/v1/uns/search`

按关键词检索节点名称。**已知名称片段时用 search；探索树形结构用 browse**。

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unssearch(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | string | 否 | 关键词（模糊匹配节点名称/路径），留空则返回所有节点 |
| `path_prefix` | string | 否 | 限制搜索范围到指定路径前缀，如 `"Plant/Line1"` |
| `topicType` | string | 否 | 按数据类型过滤：`Metric` / `Action` / `State`（仅叶子节点） |
| `page` | integer | 否 | 页码，默认 1 |
| `size` | integer | 否 | 每页条数，默认 20 |

## 响应结构

> ⚠️ search 响应使用 `data.objects[]`，**不是** `data.results[]` 也不是 `data.list[]`。

```typescript
{
  code: number;
  msg: string;
  data: {
    total: number;  // 总匹配数
    page: number;
    size: number;
    objects: Array<{
      id: number;           // 节点 ID（数字型）
      name: string;         // 节点短名称（最后一段）
      path: string;         // 完整路径，如 "Plant/Line1/Metric/Temperature"
      topicType: string;    // "Metric" | "Action" | "State" | ""
      type: 'PATH' | 'TOPIC';  // PATH = 目录节点，TOPIC = 数据点（叶子）
    }>;
  };
}
```

## 使用示例

### 按名称搜索

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unssearch({
  keyword: 'mixing',
});

console.log('共找到', result.data.total, '个节点');
for (const obj of result.data.objects) {
  console.log(obj.path, obj.topicType, obj.type);
  // "Choco_Factory/Production/State/mixing_tank_01"  "State"  "TOPIC"
}
```

### 在指定路径下搜索 State 节点

```typescript
const result = await unsApi.openapiv1unssearch({
  keyword: 'tank',
  path_prefix: 'Choco_Factory/Production',
  topicType: 'State',
});

for (const obj of result.data.objects) {
  console.log(obj.path);
}
```

### 分页获取所有节点

```typescript
let page = 1;
const size = 50;
let allObjects: typeof result.data.objects = [];

while (true) {
  const result = await unsApi.openapiv1unssearch({ page, size });
  allObjects.push(...result.data.objects);
  if (allObjects.length >= result.data.total) break;
  page++;
}
```
