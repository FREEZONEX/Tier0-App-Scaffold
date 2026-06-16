---
name: tier0-sdk-openapi-flow-deploy
version: 0.2.0
description: "POST /openapi/v1/flow/deploy — 部署 Node-RED 画布（全量替换，不可撤销）"
---

# deploy — `POST /openapi/v1/flow/deploy`

> ⚠️ **高风险操作**：deploy 会**全量替换** Node-RED 画布配置，覆盖所有节点，**不可撤销**。**必须先调用 flowdata 备份当前画布**。

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowdeploy(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | integer | **是** | Flow 的 DB 主键 |
| `flowsJson` | string | **是** | Node-RED 节点数组的 **JSON 字符串**（不含 tab 节点）。必须包含原有的 `mqtt-broker` config 节点（保留其 `id`） |

## 响应结构

```typescript
{
  code: number;
  msg: string;
  data: {
    flowId: string;  // Node-RED 内部 flow id（tab id）
  };
}
```

## 使用示例

### 标准部署流程（备份 → 修改 → 部署）

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
// Step 1: 备份当前画布（必须）
const { data: { flows } } = await flowApi.openapiv1flowflowdata({ id: 42 });

// Step 2: 找到系统生成的 mqtt-broker 节点（必须原样保留，不可替换）
const mqttBrokerNode = flows.find((n: any) => n.type === 'mqtt-broker');

// Step 3: 构造新的画布（保留 mqtt-broker 节点）
const newFlows = [
  mqttBrokerNode,   // ⚠️ 必须保留，包含系统凭据
  {
    id: 'new-node-1',
    type: 'function',
    z: 'tab-id',
    name: '格式转换',
    func: 'msg.topic = "Plant/Line1/Metric/Temperature";\nmsg.payload = JSON.stringify({ temperature: msg.payload.temp });\nreturn msg;',
    outputs: 1,
    x: 400, y: 120,
    wires: [['mqtt-out-1']],
  },
  // ... 其他节点
];

// Step 4: 部署（向用户确认后执行）
const result = await flowApi.openapiv1flowdeploy({
  id: 42,
  flowsJson: JSON.stringify(newFlows),
});

console.log('部署成功, Node-RED flow id:', result.data.flowId);
```

> **关键约束**：
> - `flowsJson` 是 JSON **字符串**，不是对象，需要 `JSON.stringify()`
> - 必须保留原有 `mqtt-broker` config 节点（相同 `id`），否则 MQTT 连接失败
> - deploy 前务必备份，且向用户展示将要变更的内容后再执行
