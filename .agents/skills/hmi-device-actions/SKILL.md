---
name: hmi-device-actions
description: Configure operator controls on HMI devices — action buttons that publish MQTT commands (start/stop pumps, open/close valves, multi-message sequences) and named publish presets for the Inspector publish panel. Use when the customer wants clickable device operations, command downlink, confirmation dialogs before send, or when a button publishes the wrong command or no command at all. For a correctly-wired button whose click doesn't visibly change the device (command≠state topic, mock-only publish — usually expected behavior), use $hmi-runtime-troubleshooting. For reading data INTO devices use $hmi-data-binding.
---

# HMI 设备操作（下行控制：动作按钮 + 发布模板）

## 两个机制，别混

| 机制 | schema 字段 | 出现在哪 | 用途 |
|------|------------|---------|------|
| **动作按钮** | `node.actions` | 画布上设备下方的胶囊按钮排（带归属容器框；早前的指向箭头已按用户反馈移除） | 操作员日常控制（启停/开关阀） |
| **发布模板** | `node.publishPresets` | Inspector 发布面板的命名模板 | 组态/调试期试发送、多 topic 消息组 |

两者共用消息结构 `{ "topic": "...", "template": "<JSON 字符串>" }`（`template` 经 `parsePayload` JSON.parse，解析失败按原样字符串发——所以发纯文本也行，但 JSON 必须转义成合法字符串）。

`docs/hmi-schema.md` 只提及这两个字段存在、不给结构——结构真相源是 `src/hmi/schema/schema.ts`（`deviceActionSchema`（导出）与 `PublishPreset` 类型（`publishPresetSchema` 为内部实现））。

## actions 结构与行为（实现行为，非约定）

```jsonc
"actions": [                                  // 上限 MAX_NODE_ACTIONS=8，超出 zod 拒
  { "label": "启动",                           // 按钮文字（>6 字符截断省略）
    "items": [ { "topic": "factory/p201/cmd", "template": "{\"cmd\":\"start\"}" } ],  // ≥1 条，点击逐条发布
    "confirm": true }                          // 可选：发送前确认弹窗
]
```

- **排布规则**（`action-buttons.ts`）：列表顺序即优先级；≤3 个全部直达，≥4 个前 2 个直达、其余收进 `⋯` 溢出菜单
- **编辑/预览两态点击都执行**（含确认流），不是预览态专属；配置入口在 Inspector「配置操作…」
- **多消息动作**：`items` 放多条即一键顺序发布（如「开阀+启泵」两条消息）——联动序列就这么表达，不需要别的机制
- 执行链（`HmiPage.tsx` `executeAction`→`sendItems`）：`confirm` 先弹窗 → 逐条 `parsePayload(template)` → `source.publish(topic, payload)` → 按钮闪「已发送」反馈 1.5s
- `confirm` 勾选框默认折叠在编辑弹窗「更多设置（多条消息 / 发送确认）」里，需展开才能配置；新建草稿默认 `confirm=false`
- **命令 topic 也从 UNS 树选**：`ActionsEditor` 已接 UNS type-ahead+树浏览，选定 topic 后还会按 UNS 字段 schema 自动回填示例 payload（按类型给默认值）。但示例≠真实命令**格式**（报文样式/字段含义），仍须向客户确认，禁止拿上行 payload 猜

## 乐观回显已移除

**乐观回显已移除**：`sendItems` 只管发布、不写 tag-store（见 `src/hmi/data/publish.ts` 头注）。图元外观只反映 broker 回推的真实数据；命令 topic 与状态 topic 分离时，点按钮后要等真实反馈到达图元才变，这是正确行为。mock 模式 `publish` 仅 `console.log`、无回推，图元不变色属预期。

## 无 broker 本地验证

- mock 源的 `publish` 只 `console.log("[mock publish]", topic, payload)`（`mock-source.ts`），不真发——浏览器控制台核对 topic/payload 即可
- 校验：actions 进 `parseMimic`（zod 会查 label 非空/items≥1/≤8 条）；`validateMimicAssets` 不查 actions 内容，topic 拼错只能靠试发送核对

## 坑速查

| 坑 | 真相 |
|----|------|
| `template` 写成 JSON 对象 | 必须是**字符串**（内嵌 JSON 转义），zod 类型是 string |
| `template` 不是合法 JSON | 不报错，按原始字符串发送——输入框下方有「不是合法 JSON，将按原文发送」提示，注意核对 |
| 按钮点了没反应就改代码 | 先看 console `[mock publish]`/确认弹窗——命令-状态 topic 分离时外观不即时变是预期 |
| 联动序列另起机制 | 一个 action 的 `items` 多条消息就是顺序联动 |
| 操作权限单独控制 | 当前无独立「操作权」：编辑/预览两态都能点按钮；只读用户(无 `edit_mimic`)也能操作。要禁操作需产品层决策，别擅自实现 |
| publishPresets 旧形态 | `{name?, topic, template}` 单条旧格式会被自动归一成 `{name, items}`，新写一律用新形态 |
