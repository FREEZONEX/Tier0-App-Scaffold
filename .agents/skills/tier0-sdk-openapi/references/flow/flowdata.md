---
name: tier0-sdk-openapi-flow-flowdata
version: 0.2.0
description: "POST /openapi/v1/flow/flowdata — 获取 Flow 的 Node-RED 画布 JSON"
---

# flowdata — `POST /openapi/v1/flow/flowdata`

获取 Flow 当前的 Node-RED 画布 JSON（flowsJson）。**deploy 前必须先调用此接口备份**。

> ⚠️ **Node-RED 不导出 credentials**：返回的 JSON 中 `mqtt-broker` 节点的 `credentials` 字段为空/缺失，但 Node-RED 内部仍存有凭据（以节点 `id` 为 key）。deploy 时必须保留原有 `mqtt-broker` 节点的 `id`，否则连接会失败。

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowflowdata(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | integer | **是** | Flow 的 DB 主键 |

## 响应结构

```typescript
{
  code: number;
  msg: string;
  data: {
    rev: string;                    // Node-RED editor revision（deploy 时可用于并发检测）
    flows: Record<string, unknown>[]; // Node-RED 节点数组（不含 tab 节点）
  };
}
```

## 使用示例

### 备份当前画布

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowflowdata({ id: 42 });

const backup = result.data.flows;
// 修改前保存备份，deploy 前必须执行此步骤

// 找到系统生成的 mqtt-broker 节点（保留其 id，不可替换）
const mqttBroker = backup.find(
  (node: any) => node.type === 'mqtt-broker' && node.name === 'emqx'
);
console.log('MQTT broker node id:', mqttBroker?.id);
```

### 修改画布并部署

```typescript
// 1. 备份
const { data: { flows, rev } } = await flowApi.openapiv1flowflowdata({ id: 42 });

// 2. 修改（保留原有 mqtt-broker 节点）
const updatedFlows = [
  ...flows,
  // 添加新节点...
];

// 3. 部署
await flowApi.openapiv1flowdeploy({
  id: 42,
  flowsJson: JSON.stringify(updatedFlows),
});
```
