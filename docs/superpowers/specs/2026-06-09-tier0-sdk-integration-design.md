# Tier0 SDK 集成 + 发布模板持久化

**日期**：2026-06-09
**状态**：设计已批准，待写实现计划
**取代**：`2026-06-09-mqtt-config-persistence-design.md`（原"全局 broker 配置表"方向作废——broker 由平台 env 注入，不需配置/编辑）

## 背景与目标

应用的 MQTT 连接、消息接收要换成平台官方 [`@tier0/sdk`](https://github.com/FREEZONEX/Tier0-sdk)（v0.1.2，公开可装），并接入 UNS 命名空间查询。SDK 两模块：

- **mq**（`@tier0/sdk/mq`）：`Tier0MQClient` —— `subscribe`/`unsubscribe`/`publish`/`on(connect|disconnect|error)`/`disconnect`，懒连接、自动重连、断连重订阅。**broker 地址/密钥从 env 读**（`TIER0_MQTT_HOST`/`PORT`/`TIER0_API_KEY`），代码不传。
- **openapi**（`@tier0/sdk/openapi`）：`unsApi` REST —— `browse`/`search`/`read`/`write` 等。env：`TIER0_API_HOST`/`KEY`。

本功能含三部分：**A** 发布模板立即落库（独立小改）；**B** MQTT 层换 SDK；**C** UNS 浏览/搜索 topic。

## 设计决策（brainstorm 已定）

- **A 存模板 = 存整图**：`onSavePreset`/`onRemovePreset` 改为 commit + 立即 `saveMimicFn`（连带保存当前图，单图场景直觉）。
- **B 完全换 Tier0**：删 `mqtt-client.ts`（mqtt.js 直连）；新 `tier0-source.ts` 包装 `Tier0MQClient` 实现现有 `DataSource`；`schema.broker` 弃用；去掉顶栏 mock/live 切换。
- **env-gated dev 源**：server fn 读到 `TIER0_MQTT_HOST` → Tier0；无 → 复用现有 mock 喂 default 图静态数据（本地/E2E 不破）。不是 UI 切换，是 env 自动判断。
- **C UNS 选 topic**：绑定/发布面板选 topic 从 `unsApi.browse`/`search` 拿真实命名空间，server fn 封装（不用 React Hooks，免装 `@tanstack/react-query`）。
- **三阶段实现**：A（小、独立）→ B（核心）→ C（增量）。

---

# A：发布模板立即存库

`HmiPage.tsx` 的 `onSavePreset`（331 行，当前只 `history.commit`）改为先算 `next`、commit + 立即写库（同一 `next` 避免 setState 异步取不到最新）：

```tsx
onSavePreset={(topic, template) => {
  const next = setNodePublishPreset(schema, selectedNode.id, topic, template);
  history.commit(() => next);
  void saveMimicFn({ data: { id: initialMimic.id, data: next } });
}}
```
`onRemovePreset` 同理（用 `removeNodePublishPreset`）。无新文件、无 schema 变化。靠 E2E 覆盖（存模板 → 刷新 → 还在）。

---

# B：MQTT 层换 `@tier0/sdk`

## 依赖
`npm install @tier0/sdk`。SDK 内部依赖 `mqtt`（项目已有 `mqtt` 直接依赖——B 完成后 `mqtt-client.ts` 删除，`mqtt` 直接依赖可移除，由 SDK 间接提供）。

## `tier0-source.ts`（包装 Tier0MQClient → DataSource）

新建 `src/hmi/data/tier0-source.ts`，`createTier0Source(topics)` 返回 `DataSource`：

```ts
import { Tier0MQClient } from "@tier0/sdk/mq";
import type { ConnectionStatus, DataMessage, DataSource } from "./data-source";

export function createTier0Source(topics: readonly string[]): DataSource {
  let client: Tier0MQClient | null = null;
  let status: ConnectionStatus = "disconnected";
  const msgCbs = new Set<(m: DataMessage) => void>();
  const statusCbs = new Set<(s: ConnectionStatus, e?: Error) => void>();
  const setStatus = (s: ConnectionStatus, e?: Error) => { status = s; statusCbs.forEach((c) => c(s, e)); };
  const handler = (topic: string, payload: string) => {
    let parsed: unknown; try { parsed = JSON.parse(payload); } catch { parsed = payload; }
    const m: DataMessage = { topic, payload: parsed };
    msgCbs.forEach((c) => c(m));
  };
  return {
    get status() { return status; },
    connect() {
      setStatus("connecting");
      client = new Tier0MQClient();
      client.on("connect", () => setStatus("connected"));
      client.on("disconnect", () => setStatus("disconnected"));
      client.on("error", (e: Error) => setStatus("error", e));
      topics.forEach((t) => client!.subscribe(t, handler)); // 懒连接：subscribe 触发连接
    },
    disconnect() { client?.disconnect(); client = null; setStatus("disconnected"); },
    onMessage(cb) { msgCbs.add(cb); return () => msgCbs.delete(cb); },
    onStatus(cb) { statusCbs.add(cb); return () => statusCbs.delete(cb); },
    publish(topic, payload) { void client?.publish(topic, payload); },
  };
}
```

> 注：SDK 的 `payload` 是字符串，这里复用现有 `decodePayload` 思路（JSON 优先）保持与 mock 一致的 `DataMessage.payload: unknown`。

## 数据源工厂（env-gated）

新建 `src/hmi/data/source-factory.ts`：
```ts
import { createMockSource } from "./mock-source";
import { createTier0Source } from "./tier0-source";
import { mockSpecsFromSchema } from "./mock-spec";
import type { DataSource } from "./data-source";
import type { Mimic } from "@/hmi/schema/schema";

/** 有 Tier0 env 用真实源；否则 dev 兜底（喂当前图静态仿真数据，本地/E2E 不破）。 */
export function createDataSource(schema: Mimic, topics: readonly string[]): DataSource {
  const hasTier0 = !!config.mqttHost;
  return hasTier0 ? createTier0Source(topics) : createMockSource(mockSpecsFromSchema(schema));
}
```

## HmiPage 改造

- **去掉** `sourceMode` state（mock/live）+ 顶栏 mock/live 切换 UI。
- 数据源 effect（91-106）用 `createDataSource(schema, schemaTopics(schema))` 替代原 `sourceMode ? createMqttSource : createMockSource`；effect 依赖去掉 `sourceMode`。
- 删 `createMqttSource`/`createMockSource` 直接 import（改 import `createDataSource`）。
- `Topbar` 去掉 `sourceMode`/`onSourceModeChange` props 及那段 UI；broker 显示改为 server fn 返回的 `config.mqttHost ?? "dev (mock)"`。

## `schema.broker` / mqtt-client 处理
- 删 `src/hmi/data/mqtt-client.ts` + `mqtt-client.test.ts`（mqtt.js 直连不再用）。
- `schema.ts` 的 `broker` zod 字段**保留**（兼容上传旧图），但不再读取驱动连接。
- `mock-source.ts` **保留**（dev 兜底用），但不再有 mock/live UI 入口。

## env
`platform-integration.md` 补 `TIER0_MQTT_HOST`/`PORT`/`TIER0_API_KEY`/`TIER0_API_HOST`。这些值由平台注入，不写入 `.env.example`。

---

# C：UNS 浏览/搜索 topic

## server fn 封装
新建 `src/hmi/data/uns-store.ts`：
```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { unsApi } from "@tier0/sdk/openapi";

/** 浏览/搜索 UNS 命名空间，返回 topic 路径字符串列表。 */
export const browseUnsFn = createServerFn()
  .inputValidator((input: { prefix?: string }) => z.object({ prefix: z.string().optional() }).parse(input))
  .handler(async ({ data }): Promise<string[]> => {
    const res = await unsApi.openapiv1unsbrowse({ /* prefix/path per SDK 入参 */ });
    return extractTopics(res); // 从返回结构提取 topic 路径
  });

export const searchUnsFn = createServerFn()
  .inputValidator((input: { q: string }) => z.object({ q: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<string[]> => {
    const res = await unsApi.openapiv1unssearch({ /* query per SDK 入参 */ });
    return extractTopics(res);
  });
```
> `unsApi` 的精确入参/返回结构在 plan 阶段从 `skills/openapi/references/uns/{browse,search}.md` 确认后填实（含 `extractTopics`）。

## topic 选择器 UI
新建 `src/hmi/components/UnsTopicPicker.tsx`：搜索框 + 结果列表，调 `searchUnsFn`/`browseUnsFn`，选中回填 topic。
- **PublishPanel**：topic 下拉旁加"从 UNS 选"入口 → UnsTopicPicker。
- **BindingEditor**：topic 输入处同样接入（让绑定也能从 UNS 选真实 topic）。
- 无 Tier0 env（dev）时 UNS 调用会失败 → 优雅降级（提示"UNS 不可用，手填"，保留手填）。

---

## 数据流总览
```
连接：HmiPage effect → getTier0ConfigFn() → createDataSource(schema, topics, config)
        ├─ config.mqttHost 非空 → createTier0Source → Tier0MQClient.subscribe(env broker)
        └─ 无 → createMockSource（dev 兜底，喂 default 图仿真）
发布：PublishPanel → onPublish → DataSource.publish → Tier0MQClient.publish（或 mock 回显）
UNS：UnsTopicPicker → searchUnsFn/browseUnsFn → unsApi（env API_HOST/KEY）→ topic 列表
存模板(A)：PublishPanel → onSavePreset → history.commit(next) + saveMimicFn(next)
```

## i18n
新字符串同步 `dict.ts`：`"从 UNS 选"` / `"搜索命名空间"` / `"UNS 不可用，手填"` 等。

## 测试
- **tier0-source 单测**：注入假 `Tier0MQClient`（构造可覆盖；或测试替身），验证 connect→subscribe、on 事件→status、publish 转发、disconnect。
- **source-factory 单测**：有/无 `TIER0_MQTT_HOST` 时返回正确源类型（通过显式 config 参数测试）。
- **uns server fn**：mock `unsApi` 验证 `extractTopics` 转换。
- **E2E**：dev 兜底源保证现有数据相关用例不破；新增「从 UNS 选 topic」流程（dev 下降级提示）。

## 不做（YAGNI）
- UNS write/create/delete/history（只做 browse/search 选 topic + 现有 publish 下发）
- UNS read 初始快照（用户未选；订阅即取）
- React Hooks（`@tier0/sdk/openapi/react`）/ 装 react-query
- broker 配置 UI（env 注入，无需）

## 风险
- **去 mock/live 切换**：HmiPage/Topbar 改动面较大，现有连接/断开/数据 E2E 兜底防回归。
- **server fn env / 测试**：工厂不直接读浏览器 env；`getTier0ConfigFn` 和 UNS server fn 读 Node `process.env.TIER0_*`，需确认部署环境注入无前缀变量。
- **SDK 入参/返回结构未知细节**：`unsApi.browse/search` 的精确签名 plan 阶段从 SDK references 确认，避免猜。
- **dev 兜底 ≠ 真实**：本地无 Tier0 时 UNS 选 topic 不可用（降级手填），发布只 mock 回显——文档讲清。

## 验证清单
- `npx tsc --noEmit` + `npm test` + `eslint` 干净
- `dev:preview`（无 Tier0 env）：dev 兜底有数据、画布正常、发布 mock 回显、存模板刷新保留、UNS 选 topic 优雅降级
- 配 `TIER0_*` 连真 broker 时：真实订阅/发布/UNS 浏览（如有测试环境）
