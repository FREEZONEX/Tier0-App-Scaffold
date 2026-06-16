---
name: tier0-sdk-flow-nodes
version: 0.1.0
description: "SDK 调用 flow nodes — 查询 Node-RED 可用节点列表"
---

# flow nodes — 可用节点查询

构造 flowsJson 前，优先查询当前 Workspace 对应 Flow 类型的实际可用节点。

> **关键**：flowsJson 中每个节点对象的 `"type"` 字段必须与 `/flow/nodes` 返回的 `types` 完全一致，否则 Node-RED 无法识别。

## API

```
POST /openapi/v1/flow/nodes
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `flowType` | string | 是 | `SourceFlow` 或 `EventFlow`；后端也兼容 `source` / `event` |

## SDK 调用示例

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
// 查询 SourceFlow 可用节点
const sourceNodes = await flowApi.openapiv1flownodes({
  flowType: 'SourceFlow',
});
console.log(sourceNodes);

// 查询 EventFlow 可用节点
const eventNodes = await flowApi.openapiv1flownodes({
  flowType: 'EventFlow',
});
console.log(eventNodes);
```

## 响应结构

```json
{
  "code": 200,
  "msg": "ok",
  "data": {
    "nodes": [
      {
        "id": "node-red",
        "name": "Node-RED nodes",
        "types": ["inject", "debug", "function"],
        "enabled": true,
        "module": "node-red",
        "version": "x.y.z"
      }
    ]
  }
}
```

## 使用规则

1. 只把 `data.nodes[].types[]` 里的字符串当作 flowsJson 的节点 `type` 值。
2. `enabled=false` 的节点集不要用于新画布。
3. 同一个节点类型在 `SourceFlow` 和 `EventFlow` 中可能不同，按目标 Flow 类型分别查询。
4. 查询接口返回的结果优先级高于静态参考表。
