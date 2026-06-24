# MQTT 发布面板设计

**日期**：2026-06-09
**状态**：设计已批准，待写实现计划

## 背景与目标

当前 HMI 是**纯监控**：`DataSource`（mqtt/mock）只订阅读状态（`connect`/`onMessage`/`onStatus`），没有 publish 能力。本功能加一块**手动 MQTT 发布**：选中设备 → 检视面板下方填 topic + JSON payload → 点发送直接 publish。用于给设备下发原始报文（操作/控制/测试）。

## 设计决策（brainstorm 已定）

- **简单手动发布工具**，不是控制绑定/状态映射系统。
- **跟选中设备走**（per 设备）：topic 默认来自该设备的 `topics`。
- **JSON 模板预填**：可为 topic 预存 payload JSON 模板，选 topic 自动填入，改值即发。面板内可「存为模板」。
- **直接下发**：无二次确认、无 RBAC 权限（用户明确要最简）。JSON 校验兜底防发坏报文。

## 架构

单向：数据层加 publish 能力 → `HmiPage` 持有当前 source（ref）→ `Inspector` 内嵌 `PublishPanel` → 调 `DataSource.publish`。

```
DataSource.publish(topic, payload)
   ├── mqtt-client：真发（client.publish）
   └── mock-source：console.log 回显，不真发
        ▲
   HmiPage：sourceRef.current.publish（source 提升到 ref）
        ▲ onPublish / onSavePreset / onRemovePreset
   Inspector → PublishPanel（topic 下拉 + JSON 编辑 + 发送 + 存模板）
```

## 数据层：加 publish

**`data-source.ts`** — `DataSource` 接口加：
```ts
publish(topic: string, payload: unknown): void;
```

**`mqtt-client.ts`**：
- `MqttLike` 加 `publish(topic: string, message: string, opts?: { qos?: 0|1|2; retain?: boolean }): void`
- `createMqttSource` 实现 `publish(topic, payload)`：未连接（`client === null`）则 `setStatus("error", ...)` 并 return；已连接则 `client.publish(topic, JSON.stringify(payload), { qos: 1, retain: false })`。控制命令用 qos 1（至少一次）、不 retain（命令不应被 broker 留存重放）。

**`mock-source.ts`**：
- 实现 `publish(topic, payload)`：`console.log("[mock publish]", topic, payload)`，不真发、不改 tag-store（mock 是只读仿真）。便于开发时确认发了什么。

## Schema：发布预设存设备里

**`schema.ts`** — `nodeSchema` 加：
```ts
publishPresets: z.array(z.object({
  topic: z.string().min(1),
  template: z.string(),          // payload 的 JSON 模板字符串（原样存，发送时 parse）
})).optional(),
```
缺省视为无预设。`template` 存字符串而非对象——保留用户编辑的格式、允许暂存不合法 JSON 作为草稿模板。

**`edit.ts`**（不可变）：
- `setNodePublishPreset(mimic, nodeId, topic, template)`：按 `topic` upsert（存在则替换 template，否则追加）。
- `removeNodePublishPreset(mimic, nodeId, topic)`：按 topic 删。

## UI：`PublishPanel` 组件

**`src/hmi/components/PublishPanel.tsx`**，props：
```ts
interface PublishPanelProps {
  node: MimicNode;
  onPublish: (topic: string, payload: unknown) => void;
  onSavePreset: (topic: string, template: string) => void;
  onRemovePreset: (topic: string) => void;
}
```

行为：
1. **topic 选择**：下拉列出 `node.topics ∪ node.publishPresets.map(p=>p.topic)`（去重），外加「手填」选项 → 显示输入框。
2. **选 topic 时预填**：该 topic 有 preset → 填其 `template` 到编辑框；无 → 填 `"{}"`。
3. **payload 编辑**：`<textarea>` + 实时 `JSON.parse` 校验，非法时下方标红提示、禁用「发送」。
4. **发送**：`onPublish(topic, JSON.parse(payload))`，直接下发。
5. **存为模板**：`onSavePreset(topic, payload)`（存当前编辑框原文，允许存草稿）；已有 preset 显示「删除模板」→ `onRemovePreset(topic)`。

## HmiPage 集成

**source 提升到 ref**：当前 `dataSource` 是 effect（line 88-106）内局部变量，PublishPanel 的发送回调访问不到。改为 `const sourceRef = useRef<DataSource | null>(null)`，effect 内 `sourceRef.current = source`（创建后赋值，销毁时置 null）。不改现有 connect/disconnect 生命周期，只多一个 ref 引用。

**回调**：
- `onPublish = (topic, payload) => sourceRef.current?.publish(topic, payload)`
- `onSavePreset = (topic, template) => history.commit(s => setNodePublishPreset(s, selectedNode.id, topic, template))`
- `onRemovePreset = (topic) => history.commit(s => removeNodePublishPreset(s, selectedNode.id, topic))`

传给 `Inspector`。

## Inspector 集成

`Inspector` 加 props `onPublish` / `onSavePreset` / `onRemovePreset`，在选中节点的检视内容**最下方**渲染 `<PublishPanel node={selectedNode} ... />`（绑定配置之后）。

## i18n

新字符串走 `t()` 并加进 `dict.ts`（zh-as-key）：`"MQTT 发布"` / `"发送"` / `"存为模板"` / `"删除模板"` / `"主题 topic"` / `"消息 payload"` / `"手填主题"` / `"JSON 格式错误"` / `"未连接，无法发送"`。

## 测试

- **数据层单测**：mqtt `publish` 用假 `MqttLike` 验证调了 `client.publish(topic, JSON 串, {qos:1,retain:false})`、未连接时不调；mock `publish` 不抛错。
- **edit 单测**：`setNodePublishPreset` upsert（新增/替换同 topic）、`removeNodePublishPreset` 删除，均返回新对象不变原。
- **JSON 校验逻辑**：合法/非法 payload 的判定（若抽成纯函数）。
- **E2E**：选设备 → 发布块可见 → 选 topic 预填 → 改 JSON → 发送（mock 模式不崩、console 有回显）。

## 不做（YAGNI）

- 控制绑定 / 状态映射 / 读写合一
- 二次确认、RBAC 权限
- 二态按钮 / 数值滑块（就是 JSON 编辑）
- QoS/retain 可配（先固定 qos 1、不 retain）
- 发送历史 / 批量发送

## 风险

- **source 提升到 ref**：动了 HmiPage 数据源持有方式，要保证现有监控（connect/disconnect/重连/mode 切换）不回归——E2E 现有用例兜底。
- **mock 不真发**：mock 模式发送只 console 回显，用户要看真实效果需切 live + 真 broker。面板上可提示当前模式。

## 验证清单

- `tsc --noEmit` + `npm test` + `eslint` 干净
- `dev:preview` 实测：选设备 → 填 topic+JSON → 发送；存模板 → 重选 topic 预填；非法 JSON 禁发送；EN 下新串已翻译
