---
name: hmi-data-binding
description: Wire live MQTT data into HMI mimic devices via the binding layer — topics, bindings (map/test/testOff/invert/scale/alarms), fault derivation, stale/quality handling, mock vs real broker source selection, and UNS topic browsing. Use when connecting a generated process picture to factory data, when a device shows 未配置/stale/unknown unexpectedly, when translating a boolean fault bit or odd vendor payload values, or when configuring alarm-threshold mechanics (lo/hi/hihi/lolo) on a device field. For the historical-trend and operator-visibility side of monitoring use $hmi-monitoring-alarms; for producing the schema topology itself use $hmi-mimic-generation.
---

# HMI 数据绑定（MQTT → 设备状态）

## 核心立场：标准化映射，不标准化设备

每个工厂的 MQTT payload 都不一样且不可知（`run:1`、`state:"RUNNING"`、`st:2`……）。**不要硬编码任何设备假设**——一切通过绑定层翻译。配置必须对着真实嗅探到的 payload 做，不要凭字段名猜。

翻译逻辑唯一真相源：`src/hmi/data/resolve-signal.ts`（改绑定行为前先读它）。

## 绑定结构

```jsonc
"bindings": {
  "<语义key>": {                      // key 必须在该 type 的 capabilities.ts 契约内，否则非阻断告警
    "topic": "factory/p201/data",     // 同时把 topic 加进节点 "topics": [...]（决定 stale 判定）
    "path": "run",                    // payload 取值路径，支持 a.b 点路径
    "test":    { "op": "eq", "value": "1" },      // 可选：真值判定（op: eq/ne/gt/lt/ge/le；eq/ne 支持逗号多值）
    "testOff": { "op": "eq", "value": "0" },      // 可选：假值判定
    "map":     { "2": true, "3": false },          // 可选：显式值域映射（与 test/testOff 互斥选路：只要配了 test 或 testOff，map 分支整个不执行；两套机制选其一，别混用）
    "invert":  true,                               // 可选：布尔取反（map/test 之后）
    "scale":   { "min": 0, "max": 5000 },          // 可选：量程 → **仅决定填充比例/仪表角度（视觉）**，显示仍是真实工程值
    "alarms":  { "lo": 10, "hi": 85, "hihi": 92 }, // 可选：阈值（lo/lolo/hi/hihi），判**原始值**，闭区间 >=/<=（恰好等于即触发）
    "unit":    "L"                                 // 可选：显示单位（用户填，**不内置推断**——温度无从判断 ℃/℉）；仅显示用，不影响填充/判阈
  }
}
```

⚠️ `test.value`/`testOff.value` 的 zod 类型是 **string**——写数字 `1` 会被解析拒绝。写 `"1"` 即可匹配数字 payload：`evalTest` 对 eq/ne 用 `String(raw)` 比较、对 gt/lt/ge/le 双方转数值。

## resolve-signal 精确语义（实现行为，非约定）

处理链：原始值 → test/testOff 或 map → invert → 数值时：alarms 判**原始值**、scale 仅算视觉填充比例（0–100，不改显示值）。

**显示真实值（不再百分比）**：罐体/仪表显示的是**真实工程值**（如 `600`、`82.5`），不再归一成 `60%`。`scale` 的 min/max 只把值映射成填充高度/仪表角度；要带单位就配 `unit`（用户填，系统不猜 ℃/℉）。液位/容积场景：配 `scale` 量程让液面按比例涨落，配 `unit`（如 `L`/`m³`/`mm`）让数字带单位。

| 情形 | 结果 |
|------|------|
| topic 无数据 / null | `quality="stale"`，节点有 `topics` 但全取不到 → 整体失联虚化 |
| 只配 `test`，命中 | true；**不命中 → false（取补）** |
| 只配 `testOff`，命中 | false；不命中 → true（取补） |
| `test`+`testOff` 都配，都不命中 | `quality="unknown"`（**不静默猜**——异常码显式可见） |
| 配了 `map`，原始值不在表内 | `quality="unknown"`，原样回显 |
| 数值越限 | hi/lo → `level="warn"`（黄）；hihi/lolo → `level="alarm"`（红，并入 fault） |
| 非有限数/对象/空串进数值链 | 内联显示 `--`，不崩 |

成对状态（开/关）各自独立配置，别假设互补锁死——只配一边才触发取补逻辑。

## fault 的正确表达

`fault` **不是 binding key**，是派生态：任何数值绑定越 `alarms` hihi/lolo 限 → 节点 `fault=true`（红环慢闪 + `!` 角标）。

- 首选：把真实工艺量绑到契约内数值 key（`dp`/`temp`/`level`…）配 `alarms`——种子图先例全是这种（如 F-301 `dp {hi:60,hihi:80}`）
- 设备只给裸故障位（`flt:0/1`）且契约内没有合适数值 key 时：把它绑成数值字段配 `alarms:{hihi:1}`（flt=1 → alarm → fault）。可行，但 key 在契约外会出「绑定了未知字段」非阻断告警——属预期，交付说明里写一句即可；同时用 `inline` 显式控制内联字段，避免 flt 原值占据展示位
- 若状态枚举含故障值（如 RUN/STOP/FAULT），`running` 只能映射布尔：① 不把 FAULT 放入 `testOff` → quality=unknown（橙问号）；② 要红圈则另开 `watch` 绑同 `path`，`map={"FAULT":1}` + `alarms:{hihi:1}`

## 识别与接线工作流（识别源按优先级）

> 🔁 **自动触发，无需用户再次指示**：上游 `$hmi-mimic-generation` 落完拓扑（或用户给了含位号/数值的图）后，应**直接进入本流程**——UNS 可用时先**主动读树**（`browseUnsFn`/`searchUnsFn`/`readUnsFn`，在 `src/hmi/data/uns-api.ts`）再绑，别停下来等用户说「去配 topic」、也别让用户手填。仅当 UNS 不可用（`available:false` / env 缺 `TIER0_API_HOST`+`API_KEY`），或用户明确「先不绑数据」时才停。

### 决策树（每台设备、每个要绑的字段，逐一判定）

> ⚠️ 写给所有模型——包括能力较弱的：**严格按 A→B→C→D 顺序，不跳步、不自由发挥、不靠"感觉"编 topic**。

- **A. 在 UNS 树里按位号搜到了这台设备？** `searchUnsFn({ keyword: "FIC019A" })`，搜不到就去掉字母前后缀只搜数字 `searchUnsFn({ keyword: "019" })`。
  - 搜到 → 用该节点的 `path` 当 topic、`fields[].name` 当 binding `path`、`fields[].type` 定布尔/数值。✅ 这台完成。
  - 没搜到 → 进 B。
- **B. 再换 2~3 种搜法**：去前缀/后缀、只用数字段、用产线名或文档里的父路径当 `pathPrefix`；或 `browseUnsFn({ path: "<父路径>", maxDepth: 3 })` 按层级看真实命名规律，照规律回搜。
  - 搜到 → 同 A 绑定。✅
  - 仍搜不到 → 进 C。
- **C. UNS 整个没配 / 降级**（任一 `*UnsFn` 返回 `available:false`）→ 走 **watch 嗅探兜底**（见下 §3），先观察值域。
- **D. UNS 有、但这台设备确实匹配不到任何真实 topic：**
  - ❌ **禁止**：编一个"看起来像"的占位 topic（如 `Process/110853/FIC_019A.PV`）写进 `bindings`。占位 topic 在 broker 上**不存在 → 永远 stale/无数据**；若该环境对不存在的 topic 回落同一个标称值，画面会**满屏同值**，看着像"所有元件绑了同一个 topic"。
  - ✅ **正确**：这台设备 **`bindings` 该字段留空**（不写）→ 渲染为「未配置」虚化（诚实、预期的状态，不是 bug），并把它加入**交付说明的「待补 topic 清单」**，请客户提供真实 topic。
  - 一句话：**宁可显式「未配置」，绝不假绑到不存在的 topic。**

**1. UNS 树是首选识别源**（平台 UNS env 已配时）。绑定要的三样信息树里都有：

- **topic**：按设备位号 `searchUnsFn`（关键词+pathPrefix 分页）或 `browseUnsFn`（按层级浏览，maxDepth≤10）定位设备节点，`UnsTopic.path` 即 topic
- **字段（binding 的 `path`）**：树节点自带 `fields: {name, type, unit}[]` 字段 schema——`path` 直接用 `fields[].name`，`type` 决定布尔/数值处理；树里的 `unit` 可填进 binding 的 `unit`（显示用），数值想要正确填充比例就配 `scale` 量程（如液位 0–5000 mm）
- **当前值**：`readUnsFn` 批量读 topic 当前值（≤200 条；数据源连接时也会自动拉首帧进 tag-store，静态/低频指标因此能显示）——用真实样例值定 test/testOff/map 的值域

三个 server fn 在 `src/hmi/data/uns-api.ts`；组态期程序化查询照抄该文件的 `unsApi`+`configureClient` 调法（需 `TIER0_API_HOST`/`API_KEY` 就位），或起 dev:preview 用 UNS 树浏览器/type-ahead 人肉查。Inspector 的 path 下拉：**实时报文到了按报文字段，报文未到回退 `uns-topic-fields.ts` 缓存的 UNS 字段 schema**——选过 UNS topic 后字段就自动可选，别让用户手敲。

**2. 客户提供的映射文档**：用于与 UNS 树交叉核对、补 UNS 里没有的语义（值含义、报警限）；与树冲突时以树为准并向客户求证。

**3. watch 嗅探兜底**（UNS 未配/降级 `available:false` 时）：把字段挂节点 `watches`（结构 `[{ "label": "必填", "topic": "...", "path": "...", "alarms": {...可选} }]`，见 schema.ts `watchSchema`）先观察值域再绑。watch 可选配 `alarms`（与 binding 同款，判原始值）：越限参与节点告警圈（warn 黄/alarm 红+fault），检视面板里该值变色——契约外的工艺量要告警就走这条路。payload 自带的质量位（如 `q:"good"`）任何情况下都只能走 watch 展示——引擎的 quality 是内部派生的，不消费外部质量字段。⚠️ watch 配 `alarms` 时 `path` 不可留空——空 `path` 取整条 payload 对象，数值转换得 NaN，alarms 永远不触发。

**4.** 按识别到的值域写 test/testOff/map（枚举值用 `eq` 逗号多值）；数值配 `scale` 量程（驱动填充比例/仪表角度）+ 可选 `unit`（显示单位，按客户/UNS schema 填，别自己猜 ℃/℉）
**5.** 用异常值反向验证：喂越限值、异常码、断流，确认 warn/alarm/unknown/stale 各态符合预期，再交付。干跑直调仓库真函数（临时脚本放 /tmp，勿进仓库）：

   ```ts
   import { resolveSignal } from "./src/hmi/data/resolve-signal.ts";  // 在仓库根目录执行
   const b = { topic: "t", path: "run", test: { op: "eq", value: "1" }, testOff: { op: "eq", value: "0" } };
   for (const raw of [1, 0, 7, null]) console.log(raw, resolveSignal(b as never, raw));
   // 期望：1→true/good，0→false/good，7→unknown（双边都不命中），null→stale
   ```

**6. 回读验真值（真 broker 绑定后必做的交付闸——这步专治「满屏同值/全是死值」）**：把图里所有 `binding.topic` 收集起来，用 UNS read 批量回读，确认**真有数据**且**不是清一色同值**：

   ```ts
   // 仓库根执行；需 TIER0_API_HOST / TIER0_API_KEY（或 VITE_ 前缀）就位
   import { unsApi, configureClient } from "@tier0/sdk/openapi";
   configureClient({ getApiHost: () => process.env.TIER0_API_HOST, getApiKey: () => process.env.TIER0_API_KEY });
   const topics = ["<把图里每个 binding.topic 都列进来，去重>"];
   const r = await unsApi.openapiv1unsread({ topics, include_leaf_value: true });
   console.log(JSON.stringify(r, null, 2));
   ```

   逐条判定（弱模型也照此裁决）：
   - **有 topic 没返回值** → 它多半是占位/拼错 → 删掉该 binding 改「未配置」+ 进待补清单（决策树 D）。
   - **所有设备值清一色同一个数**（如全 55.2）→ 二选一查因：① 多个 binding 绑了**同一** `topic`+`path`（查重改对）；② 该环境对这些点位喂的本就是同一标称值（demo/pre 环境常见）→ 交付说明写明「需用真厂数据复验」，**别当已完成**。
   - **值各异且合理** → 通过。

## 数据源与环境

选源逻辑在 `src/hmi/data/source-factory.ts`，**由 env 决定，无 UI 切换**：

| env | 行为 |
|-----|------|
| 不设 `VITE_TIER0_MQTT_HOST` | mock 兜底源：给当前图内所有 topic 喂确定性仿真数据（本地/E2E/演示） |
| 设 `VITE_TIER0_MQTT_HOST`(+`_PORT`/`VITE_TIER0_API_KEY`) | `@tier0/sdk` 连真实 MQTT over WebSocket |
| `VITE_TIER0_API_HOST`+`API_KEY` | UNS 命名空间浏览可用（server fn 代理，key 不进浏览器）；未配则选择器降级为手填 |

schema 里的 `broker` 字段已废弃，不参与连接。完整部署变量见 `docs/platform-integration.md`。

## 坑速查

| 坑 | 真相 |
|----|------|
| UNS 匹配不上就编占位 topic 绑上 | 占位 topic 无数据 → 永远 stale/满屏同值；宁留「未配置」+ 交付列待补清单（决策树 D），绝不假绑 |
| 绑完没回读就交付 | 真 broker 必跑 §6 回读：查「无值 / 全同值」，否则画面看着配好实则全死值 |
| 凭字段名猜语义直接绑 | 识别走 UNS 树（topic+字段 schema+当前值），树没有才嗅探 |
| UNS 可用却让用户手填 topic/path | 树浏览/type-ahead 选 topic，path 用字段下拉（实时报文优先，UNS schema 兜底） |
| 绑了 binding 忘了加节点 `topics` | stale 判定看 `topics`，漏加则失联判定失真 |
| 用 map 兜所有值 | map 外值=unknown 是特性（配错显式可见），别为消告警把异常码也映进去 |
| 液位/容积 | 显示真实值（不再 %）；配 `scale` 量程让液面按比例涨落，可选 `unit`（L/m³/mm）带单位 |
| 双边 test 后再 `invert` 解决反逻辑 | `invert` 在 map/test 之后才生效且只翻布尔；反逻辑优先直接交换 test/testOff 条件 |
| E2E/单测连真 broker | 不设 env 就是 mock，确定性数据可断言 |
