---
name: tier0-sdk-openapi-flow-create
version: 0.2.0
description: "POST /openapi/v1/flow/create — 创建 Flow（系统自动生成 MQTT 凭据）"
---

# create — `POST /openapi/v1/flow/create`

创建一个新的 Flow（Node-RED 容器）。**系统会自动生成专属 MQTT 账号密码，并注入到初始 Node-RED 画布配置中**。

## SDK 调用

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowcreate(body);
```

## 请求参数

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `flowName` | string | **是** | Flow 名称，同类型下唯一 |
| `flowType` | string | **是** | `source`（数据采集，连接工业协议）/ `event`（事件处理，订阅 MQTT 消息） |
| `description` | string | 否 | 描述 |
| `template` | string | 否 | 模板来源标识 |

## 响应结构

```typescript
{
  code: number;
  msg: string;
  data: {
    id: number;  // 新创建 Flow 的 DB 主键，后续操作使用此 id
  };
}
```

## 使用示例

### 创建 SourceFlow

```typescript
import { getTier0FlowApi } from '@/lib/tier0';

const flowApi = await getTier0FlowApi();
const result = await flowApi.openapiv1flowcreate({
  flowName: 'modbus-line1',
  flowType: 'source',
  description: 'Modbus TCP 采集产线1数据',
});

const flowId = result.data.id;
console.log('创建成功，Flow id:', flowId);

// 创建后可用 flowdata 获取初始画布（含系统生成的 MQTT broker 节点）
```

### 创建 EventFlow

```typescript
const result = await flowApi.openapiv1flowcreate({
  flowName: 'alert-handler',
  flowType: 'event',
  description: '温度超阈值告警处理',
});
```

> **创建后的典型流程**：create → flowdata（获取初始画布，含 MQTT broker 节点） → 修改画布 → deploy
