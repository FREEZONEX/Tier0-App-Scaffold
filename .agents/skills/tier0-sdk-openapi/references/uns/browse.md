---
name: tier0-sdk-openapi-browse
version: 0.3.0
description: "POST /openapi/v1/uns/browse — 浏览 UNS 命名空间树形结构"
---

# browse — `POST /openapi/v1/uns/browse`

**探索未知路径结构时的首选操作**。不知道完整 topic 路径时，先 browse 再 read/write。

## SDK 调用

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsbrowse(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `path` | string | 否 | 起始路径。留空或不传则从根节点浏览 |
| `include_metadata` | boolean | 否 | 返回节点的 displayName、fields、description 等元数据。**首次了解 topic 结构时建议开启** |
| `include_leaf_value` | boolean | 否 | 同时返回叶子节点（数据点）的当前 VQT 值 |
| `max_depth` | integer | 否 | 最大递归深度，默认 1（只展开下一层） |

## 响应结构

> ⚠️ browse 响应使用 `data.tree[]`，**不是** `data.results[]`。
> ⚠️ `type` 在**响应**中是大写 `'PATH' | 'TOPIC'`；在 create **请求**中是小写 `'path' | 'topic'`，两者不同。

```typescript
{
  code: number;
  msg: string;
  data: {
    tree: Array<TreeNode>;
  };
}

interface TreeNode {
  id: number;           // 节点 ID（数字型）
  name: string;         // 节点短名称（最后一段）
  path: string;         // 完整路径，如 "Plant/Line1/Metric/Temperature"
  topicType: string;    // "Metric" | "Action" | "State" | ""（目录节点为空）
  type: 'PATH' | 'TOPIC';   // PATH = 目录节点，TOPIC = 数据点（叶子）
  children: TreeNode[]; // 子节点（max_depth > 1 或默认展开时返回）

  // 以下字段仅在 include_metadata: true 时返回
  alias?: string;
  displayName?: string;
  description?: string;
  enableHistory?: number;   // 1 = 开启历史, 2 = 关闭
  extendProperties?: Record<string, unknown>;
  fields?: Array<{
    name: string;
    type: 'STRING' | 'FLOAT' | 'INT' | 'BOOLEAN' | 'DATETIME';  // 大写
    unit: string;
  }>;

  // 以下字段仅在 include_leaf_value: true 时返回（仅 file 节点）
  value?: Record<string, unknown>;
  quality?: 'Good' | 'Uncertain' | 'Bad';
  timeStamp?: number;  // UNIX 毫秒
}
```

## 使用示例

### 查看根节点下有哪些路径

```typescript
import { getTier0UnsApi } from '@/lib/tier0';

const unsApi = await getTier0UnsApi();
const result = await unsApi.openapiv1unsbrowse({});

for (const node of result.data.tree) {
  console.log(node.path, node.type);
  // "Choco_Factory"  PATH
  // "Plant"          PATH
}
```

### 查看某路径下的子节点，含字段定义

```typescript
const result = await unsApi.openapiv1unsbrowse({
  path: 'Choco_Factory/Production',
  include_metadata: true,
  max_depth: 2,
});

function walk(nodes: typeof result.data.tree) {
  for (const node of nodes) {
    if (node.type === 'TOPIC') {
      console.log(node.path, node.topicType, node.fields);
      // "Choco_Factory/Production/State/mixing_tank_01"
      //   "State"
      //   [{ name: "status", type: "STRING", unit: "" }, ...]
    }
    if (node.children?.length) walk(node.children);
  }
}
walk(result.data.tree);
```

### 查看叶子节点当前值（browse + leaf value）

```typescript
const result = await unsApi.openapiv1unsbrowse({
  path: 'Choco_Factory/Production/State',
  include_leaf_value: true,
});

for (const node of result.data.tree) {
  if (node.type === 'TOPIC' && node.value) {
    console.log(node.path, node.value, node.quality, node.timeStamp);
  }
}
```
