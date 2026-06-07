---
name: tier0-sdk-mq-quickstart
version: 0.1.0
description: "MQ 模块快速开始：runtime 配置约定、订阅、发布、取消订阅、事件监听"
---

# MQ 快速开始

## 运行时配置约定

SDK 内置 Tier0 鉴权，并从平台/runtime 环境读取 MQTT 连接信息。应用部署时平台自动注入下面变量；生成 app 不要在脚手架、`.env.example`、数据库或业务 UI 中手写这些值。

生成应用时：

- 不创建 MQTT Host、Port、API Key、Token、Workspace 绑定或连接设置页面。
- 不把 SDK 凭据保存到应用数据库。
- 不把 SDK 鉴权变量加入 `.env.example` 或用户设置。
- 不要求普通用户在业务 UI 中粘贴密钥。
- 只有用户明确要求凭据管理控制台时，才生成相关 UI。

| 变量 | 用途 | 说明 |
|------|------|------|
| `TIER0_MQTT_HOST` | 平台自动注入 | MQTT Broker 地址 |
| `TIER0_MQTT_PORT` | 平台自动注入 | MQTT WebSocket 端口（默认 8084） |
| `TIER0_API_KEY` | 平台自动注入 | 认证密钥（作为 MQTT password） |

普通业务应用直接实例化 `new Tier0MQClient()`，让 SDK/platform/runtime 提供鉴权与连接信息。不要把连接参数包成用户可编辑的前端配置页；显式传参只用于平台外测试脚本或用户明确要求的管理员凭据控制台。

在 TanStack Start 模板中，MQ SDK 运行时值必须 lazy load：不要在页面、loader、服务模块顶层直接 import `@tier0/sdk/mq`。从 `@/lib/tier0` 引入 `loadTier0Mq()`，并在实际订阅或发布 action 内部 `await`。

## 订阅

### 基础订阅

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

client.subscribe('Plant/Line1/Metric/Temperature', (topic, payload) => {
  console.log(topic, payload);
});
```

### 通配符订阅

```typescript
// # 匹配多层
client.subscribe('Plant/Line1/#', (topic, payload) => {
  // 匹配 Plant/Line1/Metric/Temperature
  // 匹配 Plant/Line1/State/MachineStatus
});

// + 匹配单层
client.subscribe('Plant/+/Metric/Temperature', (topic, payload) => {
  // 匹配 Plant/Line1/Metric/Temperature
  // 匹配 Plant/Line2/Metric/Temperature
  // 不匹配 Plant/Line1/Living/Metric/Temperature
});
```

### 同一 topic 多 handler

```typescript
const handler1 = (topic: string, payload: string) => {
  console.log('handler1:', payload);
};

const handler2 = (topic: string, payload: string) => {
  console.log('handler2:', JSON.parse(payload));
};

client.subscribe('sensor/temp', handler1);
client.subscribe('sensor/temp', handler2);
// 同一 topic 收到消息时，两个 handler 都会触发
```

## 发布

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

// 发布字符串
await client.publish('Device/Cmd', 'START');

// 发布对象（内部 JSON.stringify）
await client.publish('Device/Cmd', {
  action: 'setSpeed',
  params: { speed: 120 },
});

// 自定义 qos 和 retain
await client.publish('Device/Status', 'online', { qos: 2, retain: true });
```

## 取消订阅

```typescript
// 取消特定 handler
client.unsubscribe('sensor/temp', handler1);

// 取消 topic 下所有 handler
client.unsubscribe('sensor/temp');
```

## 事件监听

```typescript
const client = new Tier0MQClient();

client.on('connect', () => {
  console.log('MQ 已连接');
});

client.on('disconnect', () => {
  console.log('MQ 已断开');
});

client.on('error', (err) => {
  console.error('MQ 错误:', err);
});
```

## 断开连接

```typescript
client.disconnect();
```

## 状态检查

```typescript
console.log(client.isConnected);      // boolean
console.log(client.subscribedTopics); // string[]
```
