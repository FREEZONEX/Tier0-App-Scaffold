---
name: tier0-sdk-openapi-create
version: 0.3.0
description: "POST /openapi/v1/uns/create — 创建 UNS 命名空间节点"
---

# create — `POST /openapi/v1/uns/create`

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unscreate(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `namespace` | NamespaceNode[] | **是** | 节点树数组，通过 `children` 嵌套构建层级 |

### NamespaceNode 结构

> ⚠️ `name` 是**单段名称**，不含 `/`。多层路径通过 `children` 嵌套表达，不要把完整路径放进 `name`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | **是** | 单段节点名，不含 `/`，如 `"Production"`、`"mixing_tank_01"` |
| `type` | string | **是（不可省略）** | 节点类型：`"path"`（目录）/ `"topic"`（数据点），**大小写不敏感**（`PATH`/`path` 均可） |
| `topicType` | string | topic 必填 | `"metric"` / `"action"` / `"state"`（小写） |
| `displayName` | string | 否 | 显示名称 |
| `description` | string | 否 | 描述，action/state 节点强烈建议写示例 payload |
| `fields` | FieldDef[] | 否 | 字段定义（METRIC 节点推荐填写） |
| `children` | NamespaceNode[] | 否 | 子节点，用于一次性建多层结构 |

### FieldDef 结构

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 字段名，不能是 `_timestamp`（系统保留） |
| `type` | string | `"int"` / `"float"` / `"string"` / `"bool"` |
| `unit` | string | 单位（可选），如 `"°C"`、`"bar"` |

> **路径约定（强制）**：数据点路径的倒数第二段必须是类型目录：
> - `Plant/Line1/Metric/Temperature` ✓（topicType: metric）
> - `Plant/WMS/Action/StockOut` ✓（topicType: action）
> - `Plant/MES/State/OrderStatus` ✓（topicType: state）
> - `Plant/Line1/Temperature` ✗（缺少类型目录）

## 响应结构

批量接口，HTTP 200 **不代表所有节点创建成功**，需检查 `data.success` 和 `data.results[i].success`：

```typescript
{
  code: number;
  msg: string;
  data: {
    success: boolean;
    results: Array<{
      success: boolean;
      topic: string;       // 已创建节点的完整路径
      error?: { code: number; message: string };
    }>;
  };
}
```

## 使用示例

### 创建单个 Metric 数据点

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unscreate({
  namespace: [
    {
      name: 'Plant',
      type: 'path',
      children: [
        {
          name: 'Line1',
          type: 'path',
          children: [
            {
              name: 'Metric',
              type: 'path',
              children: [
                {
                  name: 'Temperature',
                  type: 'topic',
                  topicType: 'metric',
                  displayName: '产线1温度',
                  fields: [
                    { name: 'temperature', type: 'float', unit: '°C' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

if (!result.data.success) {
  for (const item of result.data.results) {
    if (!item.success) {
      console.error(`创建失败 ${item.topic}: ${item.error?.message}`);
    }
  }
}
```

### 一次性建完整产线树（含多种 topicType）

```typescript
const result = await unsApi.openapiv1unscreate({
  namespace: [
    {
      name: 'Choco_Factory',
      type: 'path',
      children: [
        {
          name: 'Production',
          type: 'path',
          children: [
            {
              name: 'Metric',
              type: 'path',
              children: [
                {
                  name: 'OvenTemp',
                  type: 'topic',
                  topicType: 'metric',
                  fields: [{ name: 'temperature', type: 'float', unit: '°C' }],
                },
              ],
            },
            {
              name: 'Action',
              type: 'path',
              children: [
                {
                  name: 'StartBatch',
                  type: 'topic',
                  topicType: 'action',
                  description: '启动批次指令。示例: {"batch_id":"B-001","recipe":"dark_choco","qty":500}',
                },
              ],
            },
            {
              name: 'State',
              type: 'path',
              children: [
                {
                  name: 'BatchStatus',
                  type: 'topic',
                  topicType: 'state',
                  description: '批次状态回报。示例: {"batch_id":"B-001","status":"running","progress":42}',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});
```
