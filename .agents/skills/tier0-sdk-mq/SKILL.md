---
name: tier0-sdk-mq
version: 0.1.0
description: "Tier0 SDK MQ 模块 — MQTT over WebSocket 消息队列封装。支持懒连接、自动重连、断连重订阅、QoS 1、通配符 #/+. triggers: Tier0, SDK, MQ, MQTT, WebSocket, 消息队列, 订阅, 发布"
metadata:
  requires:
    npm: ["@tier0/sdk"]
  hermes:
    tags: [sdk, mq, mqtt, websocket, subscribe, publish]
---

# tier0-sdk-mq — 消息队列（MQTT over WebSocket）

## 何时使用本 Skill

### 应该使用

- 需要实时订阅 Tier0 UNS 数据点（温度、状态、告警等）
- 需要向设备或系统下发指令（写数据点、触发动作）
- 需要接收 Flow（Node-RED）发布的事件消息
- 前端项目需要 WebSocket 实时推送

### 不应该使用

- 查询历史数据或当前快照 → 走 `$tier0-sdk-openapi`（REST API 更适合查询场景）
- 管理 Flow/UNS 节点元数据 → 走 `$tier0-sdk-openapi`
- 非 MQTT 协议通信 → MQ 模块仅支持 MQTT over WebSocket

## 不可违反规则

1. **Host 和认证从环境变量读取** — 代码中不直接传 `host` / `password`，除非覆盖
2. **订阅 QoS 固定为 1** — 内部自动使用 `qos: 1`，publish 默认 `qos: 0`（可覆盖）
3. **handler 接收 (topic, payload) 字符串** — payload 已由 Buffer 转为 string，JSON 需自行 `JSON.parse`
4. **通配符只支持 # 和 +** — `#` 匹配多层，`+` 匹配单层，不支持其他通配符
5. **断连后自动重订阅** — 依赖 mqtt.js 自动重连 + SDK 在 connect 回调中恢复订阅，无需手动处理
6. **不要生成连接配置 UI** — MQTT host、port、API key、token、workspace 绑定由 SDK/platform/runtime 处理，不作为应用设置页面或用户表单
7. **保留 SSR external policy + lazy loading** — `vite.config.ts` 必须保留 `ssr.external: ["pg", "@tier0/sdk", "mqtt"]`；不要把 SDK 或 `mqtt` 放进 `ssr.noExternal`。同时不要在页面、loader、服务模块顶层直接 import `@tier0/sdk/mq`。默认从 `@/lib/tier0` 引入 `loadTier0Mq()`，只在实际订阅、发布、命令下发等 action 内部 `await` SDK。不要用 fallback MQTT client 或手写重连逻辑绕过 SDK。

## 子技能路由

| 意图 | 加载文件 | 说明 |
|------|---------|------|
| 快速开始 | `references/quickstart.md` | runtime/env 约定、订阅、发布、事件监听 |

## 环境变量

| 变量 | 用途 | 说明 |
|------|------|------|
| `TIER0_MQTT_HOST` | 平台自动注入 | MQTT Broker 地址 |
| `TIER0_MQTT_PORT` | 平台自动注入 | MQTT WebSocket 端口（默认 8084） |
| `TIER0_API_KEY` | 平台自动注入 | 认证密钥（作为 MQTT password） |

## 核心概念

| 概念 | 说明 |
|------|------|
| **Topic** | MQTT 主题路径，如 `Plant/Line1/Metric/Temperature` |
| **Handler** | 回调函数 `(topic: string, payload: string) => void`，payload 为字符串 |
| **QoS** | 服务质量：订阅固定 QoS 1，发布默认 QoS 0 |
| **通配符 #** | 匹配多层，如 `home/room/#` 匹配 `home/room/temp`、`home/room/living/light` |
| **通配符 +** | 匹配单层，如 `home/+/temp` 匹配 `home/bedroom/temp` 但不匹配 `home/bedroom/living/temp` |

## 快速示例

### 订阅实时数据（极简）

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

// 无需先调用 connect()，订阅时自动连接
client.subscribe('Plant/Line1/Metric/Temperature', (topic, payload) => {
  const data = JSON.parse(payload);
  console.log(topic, data);
});
```

### 发布指令

```typescript
import { loadTier0Mq } from '@/lib/tier0';

const { Tier0MQClient } = await loadTier0Mq();
const client = new Tier0MQClient();

await client.publish('Device/PLC1/Cmd', {
  action: 'start',
  param: { speed: 100 },
});
```

### 事件监听

```typescript
const client = new Tier0MQClient();

client.on('connect', () => console.log('已连接'));
client.on('disconnect', () => console.log('已断开'));
client.on('error', (err) => console.error('错误:', err));
```
