# HMI Schema 规范

上传一份符合本规范的 JSON 即生成一张工艺流程图。schema 经 Zod 校验（`src/hmi/schema/schema.ts` 是事实来源），解析失败会在顶栏给出字段级错误；解析通过但有「能渲染但可能不符预期」的问题（未知 type、悬空连线、联锁引用缺失、联锁环）会在顶栏给出非阻断**提示**。

> 本文只覆盖核心字段。节点另有 `watches`（观察点）/`actions`（操作按钮）/`publishPresets`（发布模板），连线另有 `lead`（仪表信号线）/`fromSide`/`toSide`（端口方位）等已实装字段——完整结构以 `schema.ts` 的 zod 定义为准。

完整示例：`src/hmi/data/example-mimic.json`（RX-100 间歇反应釜单元，25 节点 / 25 连线 / 6 联锁）。模板默认 seed 的是空白图（`default-mimic.json`，开局空画布）；设 env `HMI_SEED_DEMO=1` 则改 seed 该示例（供 E2E/演示）。内嵌进 bundle，首次请求时 bootstrap 进 Postgres `mimics` 表（仅空表时 seed）。

---

## 顶层结构（Mimic）

```jsonc
{
  "meta":   { "name": "1#车间", "version": 1 },     // name 必填
  "broker": { "url": "ws://broker.local:9001" },    // 可选；live 源用（MQTT over WebSocket）
  "nodes":  [ /* MimicNode[]，≤ 2000 */ ],
  "edges":  [ /* MimicEdge[]，≤ 5000，默认 [] */ ],
  "interlocks": [ /* InterlockRule[]，≤ 2000，默认 [] */ ]
}
```

坐标系：世界坐标，原点左上、y 向下；节点的 `x/y` 是图元**中心**锚点。视图自动 fit 居中，无需关心绝对位置，只需保证相对布局合理。

---

## 节点（MimicNode）

```jsonc
{
  "id": "TK-101",          // 必填，全图唯一（重复会被拒）
  "type": "tank",          // 必填，见下方图元表；未知 type 渲染为占位 "?"
  "x": 110, "y": 235,      // 必填，图元中心
  "rotation": 0,           // 可选，默认 0
  "label": "进料罐",        // 可选，图元下方标题（缺省用 id）
  "topics": ["p/TK-101"],  // 可选，订阅的 MQTT topic；有 topics 但一个值都取不到 → 失联(stale)
  "bindings": {            // 可选，语义字段 → 取值来源
    "level": { "topic": "p/TK-101", "path": "level" }
  },
  "inline": ["level"],     // 可选，图元下方内联显示的字段（覆盖该 type 的默认 inline）
  "props": { }             // 可选，图元专属静态配置（见图元表）
}
```

### binding key 语义约定

`bindings` 的 **key** 决定该值如何影响图元，`{topic, path}` 决定从哪条 payload 的哪个路径取值（`path` 支持 `a.b` 点路径）。

**布尔语义 key**（按真值白名单转 bool：`1 / true / on / yes / open / run / running / active`，大小写无关；数字非 0 为真）：

| key | 含义 | 视觉效果 |
|-----|------|---------|
| `running` | 运行/停止 | 运行→深填充；内联「运行/停止」 |
| `open` | 阀/风门 开/关 | 驱动阀门启闭；内联「开/关」 |
| `closed` | 开关 闭合/断开 | 内联「闭合/断开」 |
| `on` | 通/断 | 内联「通/断」 |
| `manual` | 手动/自动 | 手动→角标 |
| `interlock` | 联锁/解锁 | 挂锁角标（也可由联锁引擎自动注入） |

**数值语义 key**（内联显示时带单位）：

| key | 单位 | key | 单位 |
|-----|------|-----|------|
| `rpm` / `speed` | rpm | `temp` / `temperature` | °C |
| `current` | A | `level` | %（同时驱动储罐/容器液位高度） |
| `pressure` | bar | `opening` | % |
| `flow` | m³/h | `value` | （驱动仪表填充，0–100） |

> 其余 key 按普通数值/字符串原样显示。非有限数 / 对象 / 空串 → `--`。

**派生状态（非 binding key）**：

| 状态 | 含义 | 视觉效果 | 来源 |
|------|------|---------|------|
| `fault` | 故障/正常 | 故障→红环慢闪 + `!` 角标 | 由数值字段 `alarms` 阈值（`hi`/`hihi`/`lo`/`lolo`）越限派生，**不是 binding key**，无需绑定 |

### 图元 type 全表

| type | 默认 inline | props | 说明 |
|------|------------|-------|------|
| `tank` | `level` | — | 储罐（锥顶平底），`level` 驱动液位 |
| `pump` | `rpm` | — | 离心泵（切向出口） |
| `valve` | `open` | — | 阀门，`open` 驱动启闭 |
| `meter` | `flow` | — | 流量计 |
| `motor` | `rpm` | — | 电机（带轴 + 接线箱） |
| `fan` | `rpm` | — | 风机（蜗壳） |
| `filter` | `dp` | — | 过滤器，`dp` 为压差 |
| `damper` | `open` | — | 风门 |
| `switch` | `closed` | — | 开关 |
| `bargauge` | `value` | — | 条形仪表（`value` 0–100 从底部填充） |
| `dialgauge` | `value` | `face`: 字符串（如 `"P"`/`"T"`/`"ΔP"`） | 表盘仪表，`face` 显示面字母 |
| `exchanger` | `temp` | — | 管壳式换热器（TEMA + 4 接管） |
| `vessel` | `level` | `agitator`: boolean | 立式容器；`agitator=true` 顶置搅拌器（反应釜），否则光面接收罐 |
| `condenser` | `temp` | — | 冷凝器（立式） |
| `cooler` | `temp` | — | 空冷器（管束 + 风道） |
| `column` | `temp` | — | 精馏塔/塔器（塔盘内件 + 塔釜液位 `level`） |
| `drum` | `level` | — | 卧式分离罐/缓冲罐 |
| `silo` | `level` | — | 料仓/料斗（固体储料 + 锥斗） |
| `compressor` | `rpm` | — | 压缩机（`running` 驱动） |
| `heater` | `temp` | — | 加热器（加热盘管，`running` 驱动） |
| `controlvalve` | `opening` | — | 调节阀（膜头执行器，`opening` 0–100） |
| `checkvalve` | `open` | — | 止回阀（单向，方向箭头） |
| `safetyvalve` | `open` | — | 安全阀/泄压阀（上出口 + 弹簧） |
| `instrument` | `value` | `tag`: 位号字符串；`mount`: `"field"`/`"panel"` | ISA 仪表气泡 |
| `cyclone` | `level` | — | 旋风分离器（短圆柱 + 长锥体），`level` 料位 |
| `mixer` | — | — | 管段静态混合器（交叉混合元件），纯结构件无可绑状态 |
| `agitator` | `rpm` | — | 顶置搅拌器（电机 + 轴 + 桨叶），`running` 驱动 |

> 完整可绑定状态契约见 `src/hmi/symbols/capabilities.ts` 或预览页 `/components`。

---

## 连线（MimicEdge）

```jsonc
{
  "id": "e1",
  "from": "TK-101",            // 起点节点 id（建议存在；悬空只提示不阻断）
  "to": "P-101",              // 终点节点 id
  "points": [[132,235],[210,235]],   // 世界坐标折线，≥ 2 点；正交布线用多点
  "flowBy": { "topic": "p/P-101", "path": "flow" }  // 可选：该值真值/非零 → 管线流向白色虚线动画
}
```

---

## 联锁规则（InterlockRule）

跨设备安全联动：当**源节点**满足条件时，对**目标节点**施加效果（强制关阀、跳车、禁启…）。

> ⚠️ **当前实现状态**：联锁规则做组态期校验（引用存在性、链式环检测，见 `src/hmi/interlock/`）和图例/角标展示；**运行时求值（效果施加、链式传导、失联三值处理）尚未接入**。规则照规范写入 schema 即可向前兼容，但本版本不会在越限时真正强制目标设备。

```jsonc
{
  "id": "IL-HI-LEVEL",
  "label": "进料罐高液位",          // 可选，报警条/检视显示名
  "when": { "node": "TK-101", "field": "level", "op": ">=", "value": 90 },
  "combine": "all",               // 可选，多条件组合：all（默认）/ any
  "then": [ { "node": "FV-101", "kind": "forceClose" } ],
  "onStale": "lock"               // 可选，源失联时：lock（保守闭锁，默认）/ release（释放）
}
```

`when` 可是单条件对象，或条件数组（配合 `combine`）。

### 条件（Cond）

| 字段 | 说明 |
|------|------|
| `node` | 源节点 id |
| `field` | 读哪个字段：特殊值 `fault`/`stale`/`running` 读标志位，其余读 `values[field]` |
| `op` | 见下表 |
| `value` | 比较类算子必填；`truthy`/`falsy`/`fault`/`stale` 及 `chainOn` 不需要 |
| `chainOn` | 默认 false；为 true 时改读「源节点当前是否已被联锁」→ 构成 A→B→C 链 |

**算子 op：**

| op | 含义 | op | 含义 |
|----|------|----|------|
| `>` `<` `>=` `<=` | 数值比较（需 `value`） | `truthy` / `falsy` | 字段真/假 |
| `==` `!=` | 宽松相等/不等（需 `value`） | `fault` / `stale` | 源节点故障/失联 |

> 数值比较中，操作数或阈值不是有限数（含空串/空白串/对象）→ 视为**不确定**（degraded），按 `onStale` 处置，不会静默判 false。

### 效果（Target.kind）

被作用节点都会点亮挂锁角标；多规则锁同一节点时取**最强**效果。

| kind | 含义 | 优先级 |
|------|------|:---:|
| `trip` | 跳车（最强） | 5 |
| `forceClose` / `forceOpen` | 强制阀位 | 4 |
| `inhibit` | 禁止启动 | 2 |
| `lock` | 闭锁（默认） | 1 |

### 示例（`default.json` 的 6 条）

| 规则 | 触发 | 效果 |
|------|------|------|
| `IL-HI-LEVEL` | TK-101 `level ≥ 90` | FV-101 强制关闭 |
| `IL-REACTOR-HI` | R-101 `level ≥ 95` | FV-101 / FV-102 强制关闭 |
| `IL-REACTOR-FAULT` | R-101 `fault` | DV-301 / PC-101 跳车 |
| `IL-PUMP-STOP` | P-101 `running` 为假 | FV-101 禁启（失联则释放） |
| `IL-FILTER-CLOG` | F-301 `fault` **或** `dp > 80` | P-301 跳车 |
| `IL-CHAIN-DV` | DV-301 已联锁（`chainOn`） | OV-301 禁启 |

---

## 最小可用示例

```json
{
  "meta": { "name": "示例", "version": 1 },
  "nodes": [
    { "id": "TK-1", "type": "tank", "x": 100, "y": 100, "label": "罐",
      "topics": ["d/tk1"], "bindings": { "level": { "topic": "d/tk1", "path": "level" } } },
    { "id": "FV-1", "type": "valve", "x": 240, "y": 100, "label": "阀",
      "topics": ["d/fv1"], "bindings": { "open": { "topic": "d/fv1", "path": "open" } } }
  ],
  "edges": [
    { "id": "e1", "from": "TK-1", "to": "FV-1", "points": [[132, 100], [216, 100]],
      "flowBy": { "topic": "d/fv1", "path": "open" } }
  ],
  "interlocks": [
    { "id": "IL-1", "label": "高液位关阀",
      "when": { "node": "TK-1", "field": "level", "op": ">=", "value": 90 },
      "then": [{ "node": "FV-1", "kind": "forceClose" }] }
  ]
}
```

---

## 部署与主题说明

- **鉴权**：走 gateway-header（生产 `node server.mjs`）。本地预览用 `npm run dev:preview`（注入开发用户头），不要修改 `src/start.ts`。
- **调色**：Canvas 颜色取自 `src/styles/globals.css` 的 `--hmi-*` token，不要 fork；缺失自动回落硬编码调色板。
- **暗色主题**：通过根容器的 `data-hmi-theme="dark"` 在 HMI 页**作用域内**覆盖语义 token。若把顶栏/检视等组件移出该容器，需保证仍有 `data-hmi-theme` 祖先，否则暗色失效。
