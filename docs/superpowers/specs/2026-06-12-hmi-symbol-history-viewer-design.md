# 图元历史数据查看器 — 设计方案

> 日期：2026-06-12 ｜ 状态：待评审 ｜ 范围：单一 spec，可直接进实现计划

## TL;DR（大白话概览）

在图元检视面板（Inspector）加一个「查看历史数据」按钮，点开一个**模态浮层**，看这个图元绑定的 MQTT topic 的历史数据。浮层里有两个 Tab：

- **趋势图**：选**数据值**（图元映射字段，多选叠加）按时间画折线。走 UNS 历史接口的**聚合查询**（固定平均），间隔自动算——保证一屏数据点 **≤ 1000**。支持 **hover 游标读数**、**框选缩放**、多系列对比。
- **表格**：选 **topic**（单选），全量原始记录按时间倒序分页列出（每页 10 条），列是负载字段动态展开。

顶部一行：时间预设 + 自定义起止 + 查询按钮。**选择即查**（预设/数据值/topic 点击直接查询），仅自定义时间需点「查询」。数据全部走 `@tier0/sdk` 的 `unsApi.openapiv1unshistory` / `openapiv1unsread`，沿用现有 `createServerFn` + `{available,...}` 信封 + 错误吞掉的模式。纯只读，不改 schema、不写库，operator 预览态也能用。

---

## 1. 背景与目标

当前 Inspector 只有**实时**视图：实时数据表 + 内存累积的 Sparkline（`useSeries`，最近 60 点）。没有任何**历史**回看能力。

本方案新增一个只读的历史数据查看器，挂在 Inspector 上，满足：

1. 入口在图元详情（Inspector）里。
2. 看图元绑定的 MQTT topic 的历史数据。
3. 两类视图：**趋势图**（聚合）+ **表格**（全量原始）。
4. 趋势图必须走 UNS 历史接口的**聚合查询**。
5. 使用 `@tier0/sdk` 里 UNS 的历史数据接口。

### 已敲定的设计决策（评审中逐条确认）

| # | 决策点 | 结论（与最终实现一致，含历次用户纠偏） |
|---|--------|------|
| 1 | 容器形态 | **模态浮层**（~720px，双 Tab），照搬 `ActionsDialog` 范式 |
| 2 | 表格内容 | **全量原始采样记录**，**动态列**（时间 + 负载字段并集 + 质量）；**每页 10 条**（`tablePageCount` 兜底 API total 缺失/偏小） |
| 3 | 选择粒度 | **趋势页选「数据值」**（映射字段，chips 显示元件字段名/数据点名，多选叠加）；**表格页选 topic**（chips 显示 topic 路径，单选）——选择器分别下移到各自 Tab 内 |
| 4 | 趋势字段来源 | 只查图元**映射的字段**（bindings/watches 的 `path`，来自 `nodeTopics().fields`，label=元件字段名）；**不查 topic 全表字段**（用户纠偏：图元只关心映射字段，全查是噪声）。无映射字段 → 「无映射字段」空态 |
| 5 | 趋势聚合策略 | interval **自动**：满足「点数 ≤ 1000」的最小整间隔；聚合函数**固定 `avg`，不提供任何选项**（用户纠偏：去掉聚合下拉），也无手动间隔下拉 |
| 6 | 时间范围 | 预设 `1 小时 / 6 小时 / 24 小时 / 7 天`（短文案，与自定义起止、查询按钮**同一行**）+ 自定义；表格与趋势共享一个「有效范围」 |
| 9 | 取数触发 | **选择即查**：时间预设 / 趋势数据值 / 表格 topic 点击直接查询；**仅自定义起止时间**是草稿、点「查询」才生效（无草稿时查询按钮禁用）。框选缩放 / 翻页 / 切 Tab 即时 |
| 7 | 趋势交互 | **hover 游标读数**（竖向游标 + 各系列圆点 + tooltip）+ **框选缩放**（拖拽选 x 区间→回灌共享有效范围重查，interval 自动变细、点数仍 ≤1000；双击复位到当前预设） |
| 8 | 多值对比 | 数据值**多选** → 多系列叠在一张趋势图（图例区分、**共享 y 轴**，可开「按系列归一化」对比不同量纲走势）；**表格 Tab 一次只看一个 topic** |

---

## 2. 接口契约（@tier0/sdk）

### 2.1 历史聚合 / 原始查询 — `unsApi.openapiv1unshistory`

`POST /openapi/v1/uns/history`，入参 `HistoryReq`：

```ts
{
  topics: string[];
  start_time: string;   // ISO 时间串
  end_time: string;
  page?: number;        // int64，原始分页用
  size?: number;        // int64
  aggregation?: { field: string; function: string; interval: string };
}
```

响应 `HistoryResp`：

```ts
{
  results: Array<{
    topic: string;
    success: boolean;
    error?: { code: number; message: string };
    result?: { values: Array<{ timeStamp: number; value?: object; quality: string }> };
  }>;
  page: number; size: number; total: number; success: boolean;
}
```

- **趋势**：带 `aggregation`，一次只能聚合**一个 field**（`HistoryAggregation.field` 是单值）→ 多个数值字段 = 多次查询，前端合并多系列。
- **表格**：**不带** `aggregation`，用 `page/size` 分页，`value` 即整条负载对象。
- `timeStamp` 为毫秒纪元；`value` 可能是标量或对象 → 防御式归一化。

### 2.2 topic schema — `unsApi.openapiv1unsread`

`openapiv1unsread({ topics:[t], include_metadata:true })` → `ReadResp.results[].metadata`（`OpenapiNodeInfo`）`.fields[]`（`SchemaField{ name, type, unit }`）。

靠 `type` 串判数值字段（`number/int/integer/float/double/long/int32/int64/float32/float64/decimal/real` 等，大小写无关）。

> 现有 `uns-normalize.ts` 已有 `pickData(resp)` 处理「HttpClient 可能已解包 / 可能是 `{data:X}`」两种形态，历史归一化复用它。

---

## 3. 架构与数据流

```
Inspector「查看历史数据」按钮 (onViewHistory)
   → HmiPage 持有 historyNode 状态，渲染 <HistoryDialog node=.../>
   → HistoryDialog 顶部一行：时间预设(点击即查) + 自定义起止(草稿) + 查询按钮
        状态：trendKeys[]（趋势数据值多选，即查）、tableTopic（表格单选，即查）、
             range/draftRange、zoom（框选）、tab、tablePage；聚合固定 avg
   → Tab 切换：
        [趋势图] useTrendSeries(refs, effectiveRange, fn)   // refs = committed.topics 的映射字段
           1. refs 来自 nodeTopics().fields（图元映射字段），不查 schema/全表
           2. interval = chooseTrendInterval(rangeMs)        // ≤1000 点
           3. 跨 topic×字段并行 historyUnsFn(aggregation={field,fn,interval})
              组合系列，限幅到 MAX_TREND_SERIES（超出明示）
           4. historyToTrend → 多系列 → <HistoryTrendChart/>
                 · onHover  → 竖向游标 + 各系列圆点 + tooltip（nearestPointIndex）
                 · onBrush(range) → 回灌 effectiveRange 重查；双击 → 复位预设
        [表格]   useTableRows(tableTopic, effectiveRange, page)
           historyUnsFn(无 aggregation, page/size=10)
           → historyToRows(整条负载) + tableColumns(列并集) → <HistoryTable/>
```

单向、与现有 UNS 链路一致；纯查询、无副作用。**框选缩放回灌的是共享的 `effectiveRange`，故趋势与表格联动**（缩放趋势也收窄表格范围）；双击趋势复位到当前时间范围预设。

---

## 4. 文件清单（遵循「多小文件」）

### 数据层（server fn + 纯函数）

**`src/hmi/data/uns-api.ts`（改）** — 追加 `createServerFn`，与 `browseUnsFn` 等同款（`configured()` 短路、`{available,...}` 信封、错误吞掉）：

- `historyUnsFn` — 入参 zod：`{ topics:string[], startTime:string, endTime:string, page?, size?, aggregation?:{field,function,interval} }`；调 `unsApi.openapiv1unshistory`；返回 `{ available, items: SerialHistoryItem[], total }`（value 转 JSON 串穿越 server fn 边界）。
- （趋势字段改用图元映射字段后，**不再需要** topic schema 查询，故无 `topicSchemaFn`。）

**`src/hmi/data/uns-history.ts`（新）** — 纯函数 + 常量，无副作用、可单测：

- `historyToTrend(item, field): { t:number; v:number }[]` — 单 topic 单字段聚合结果 → 点序列。
- `historyToRows(item): HistoryRow[]` — 整条负载行（`{ t:number; quality:string; payload:unknown }`），按时间倒序。
- `tableColumns(rows): string[]` — 负载顶层 key 并集（动态列）。
- `valueAtPath(value, path): unknown` — 按点分路径取值（对象/标量安全）。
- `cellText(value): string` — 单元格渲染：标量原样，对象/数组 → 紧凑 JSON。
- `chooseTrendInterval(rangeMs, maxPoints=1000): { interval:string; approxPoints:number }` — 从 `NICE_INTERVALS` 选满足 `rangeMs/interval ≤ maxPoints` 的最小整间隔。
- `alignSeries(list): { times, columns }` — 多系列按时间并集对齐到同一 x 轴（缺口填 null），hover/绘制共用。
- `serializeHistory` / `parseHistory` — 边界安全形态（value↔JSON 串）互转。
- `seriesLabel(topic, field, multiTopic): string` — 系列图例名：单 topic 用 `field`，多 topic 用 `topic短名·field`。
- `nearestPointIndex(pointCount, xRatio): number` — hover：x 占比 → 最近桶索引。
- `brushToRange(x0, x1, startMs, endMs): { startMs; endMs } | null` — 框选两端占比 → 绝对时间子区间（过窄/反向返回 null）。
- `tablePageCount(total, rowsLen, page, size)` — 表格总页数（每页 10）：total 可信按 total，缺失/偏小按「当前页拿满→至少还有下一页」兜底。
- 常量：`TREND_AGG_FN="avg"`（聚合固定平均）、`RANGE_PRESETS`、`NICE_INTERVALS`、`MAX_TREND_POINTS=1000`、`MAX_TREND_SERIES`（跨 topic×字段系列总上限，如 8）、`TABLE_PAGE_SIZE=10`。

**`src/hmi/data/node-topics.ts`（新）** — `nodeTopics(node): { topic:string; label:string; fields:string[] }[]`，从 `node.topics` + `bindings[*]` + `watches[*]` 收集去重 topic：`label` 取绑定字段名/watch label（否则 topic 本身），`fields` 取**映射字段路径**（binding.path / watch.path，去重，空跳过）——趋势据此只查映射字段。

**测试（node:test，新）**：`uns-history.test.ts`、`node-topics.test.ts` — 覆盖归一化、列并集、间隔策略（含 ≤1000 边界）、对齐、序列化往返、topic 收集去重与映射字段；新纯模块 ≥80%。

### React UI

**`src/hmi/components/useUnsHistory.ts`（新）** — 两个小 hook，统一 `loading/available`，参数变更重取、用序号丢弃过期响应：

- `useTrendSeries(refs:{topic,fields}[], startMs, endMs, fn)` → `{ loading, available, series, interval, approxPoints, note? }`（按映射字段 refs 跨 topic×字段并行聚合、合并系列、限幅到 `MAX_TREND_SERIES`；无映射字段 → `note:noMappedField`）。
- `useTableRows(topic, startMs, endMs, page)` → `{ loading, available, rows, columns, total, pageCount }`（单个活动 topic）。

**`src/hmi/components/HistoryDialog.tsx`（新）** — 模态浮层，照搬 `ActionsDialog`（`fixed inset-0 bg-black/30` 遮罩 + 居中卡片 `~720px` + Esc / 点遮罩关闭 + `role="dialog" aria-modal"`）。**选择即查**：`trendKeys`（趋势数据值多选）、`tableTopic`（表格 topic 单选）、`range`（时间预设点击直接更新）都是即时查询输入；**仅自定义起止时间**走 `draftRange` 草稿、点「查询」提交（无草稿时按钮禁用）。`zoom` 由框选即时覆盖范围。聚合固定 `TREND_AGG_FN="avg"`。还持有 `tab`、`tablePage`。

**`src/hmi/components/HistoryTrendChart.tsx`（新）** — 多系列聚合趋势：复用 `charts/trend.ts` 的 `trendBounds/trendPath` 数学，**新增** 时间 x 轴刻度（按点数稀疏标注）+ y 轴 min/max 标签 + 多系列图例（`seriesLabel`）。交互：本地 hover 态（`nearestPointIndex` → 竖向游标线 + 各系列圆点 + 浮动 tooltip 列出时间与各系列值）；框选拖拽产出 `[x0,x1]` 占比，`onBrush(brushToRange(...))` 上抛、双击触发 `onResetZoom`。比实时 `Sparkline` 重，单独建、不动现有 `TrendChart`。

**`src/hmi/components/HistoryTable.tsx`（新）** — 动态列分页表（时间 / 各负载字段 / 质量），`cellText` 渲染，过宽横向滚动，底部翻页。

### 接线 + i18n

- **`src/hmi/components/Inspector.tsx`（改）** — 加 `onViewHistory: () => void` prop，在「趋势」分节附近放「查看历史数据」按钮（**只读态也显示**——纯查询）。
- **`src/hmi/components/HmiPage.tsx`（改）** — 加 `historyNode` 状态；给 Inspector 传 `onViewHistory={() => setHistoryNode(selectedNode)}`；`historyNode` 非空时渲染 `<HistoryDialog node={historyNode} onClose=.../>`。
- **`src/hmi/i18n/dict.ts`（改）** — 全部新中文串补 en 翻译（zh-as-key；漏翻静默回退中文）。串例：`查看历史数据`、`趋势图`、`表格`、`时间范围`、`最近 {n} 小时`、`最近 7 天`、`自定义`、`聚合`、`间隔 {iv} · 约 {n} 点`、`该 topic 无数值字段，无法绘制趋势`、`未配置 UNS 历史数据源`、`暂无历史数据`、`字段过多，仅展示前 {n} 个` 等。

---

## 5. 趋势聚合策略（≤1000 点）

```
chooseTrendInterval(rangeMs, maxPoints = 1000):
  for iv of NICE_INTERVALS (升序, ms):       // 1s,5s,10s,30s,1m,5m,15m,1h,6h,1d,7d...
    if ceil(rangeMs / iv) <= maxPoints:
      return { interval: fmt(iv), approxPoints: ceil(rangeMs / iv) }
  return 最大间隔                              // 极大范围兜底
```

- interval 完全由范围推出，用户**不手选**；UI 只读显示「间隔 5m · 约 288 点」。
- 聚合函数**固定 `avg`**（用户决策：不提供选项）。
- `interval` 字符串格式以 SDK/网关接受的时长串为准（如 `"5m"`、`"1h"`），实现时按真实接口校准（先用常见时长串，dev:preview 实测调整）。

---

## 6. 趋势交互设计（hover / 框选 / 多 topic）

### 6.1 多 topic 对比
- 顶部 topic 选择器为**多选**（chips/复选列表，来自 `nodeTopics(node)`）；默认勾选首个，避免一次拉太多。
- 每个选中 topic 取其**映射字段**（`nodeTopics().fields`），系列 = `(topic, 映射字段)` 笛卡尔积。
- **共享 y 轴**：`trendBounds` 已对全部系列一起取 min/max。已知权衡——不同量纲（如温度 0–100 vs 压力 0–10）会被压扁；首版接受，后续可加「按系列归一化」开关（列入 YAGNI 备选）。
- **系列限幅**：跨 topic×字段系列总数超 `MAX_TREND_SERIES`（如 8）时只画前 N 条并出 `note`「字段/系列过多，仅展示前 N 个」，**不静默截断**；同时天然约束并行查询数。
- **表格不随多选叠加**：表格语义是「单 topic 全量记录」，多选时顶部出 `activeTableTopic` 子切换器（默认首个选中 topic）。

### 6.2 hover 游标读数
- `HistoryTrendChart` 内部 hover 态：鼠标在绘图区移动 → x 占比 → `nearestPointIndex` → 桶索引。
- 渲染竖向游标线 + 该索引处各系列圆点 + 浮动 tooltip（该桶时间 + 各系列 `seriesLabel: 值`）。
- 各系列共享同一 `interval`/`range`，桶等距对齐，故单一索引可读出所有系列值。

### 6.3 框选缩放
- 在绘图区按下拖拽 → 半透明选区矩形；松手得 `[x0,x1]` 占比 → `brushToRange` 映射到 `effectiveRange` 的子区间 → `onBrush` 上抛 `HistoryDialog`，写回**共享** `effectiveRange`。
- 写回后趋势与表格都按新范围重查；`chooseTrendInterval` 自动取更细 interval（点数仍 ≤1000）。
- **双击**绘图区 → `onResetZoom` → `effectiveRange` 复位到当前时间范围预设。
- 选区过窄/反向 → `brushToRange` 返回 `null`，忽略（防误触）。

---

## 7. 状态与错误处理

- **未配 UNS**（无 host）：server fn 返回 `{available:false}` → 浮层显示「未配置 UNS 历史数据源」空态。
- **查询失败 / 结果空**：友好空态（「暂无历史数据」），**绝不抛**（沿用 uns-api 风格）。
- **趋势无数值字段**：schema 与采样都没数值字段 → 「该 topic 无数值字段，无法绘制趋势」。
- **数值字段过多**：限幅到 `MAX_TREND_SERIES` 并明示「字段过多，仅展示前 N 个」（**不静默截断**）。
- **加载态**：浮层内骨架 / 「加载中」。
- 「现在」取值与时间格式化走客户端 `Date`（React 客户端组件，非 server fn）。

---

## 8. 测试计划

- **单元（node:test，co-located `*.test.ts`）**：`uns-history`（归一化、`isNumericFieldType`、`tableColumns`、`valueAtPath`、`cellText`、`chooseTrendInterval` 含 ≤1000 边界、`rangeToTimes`、`seriesLabel`、`nearestPointIndex`、`brushToRange` 含过窄/反向返回 null）、`node-topics`（去重/标签）。新纯模块 ≥80%。
- **E2E（Playwright，`e2e/hmi.spec.ts`）**：选中图元 → Inspector 点「查看历史数据」→ 浮层出现、双 Tab 可切换、topic 多选、Esc/点遮罩可关；CI 无真实 UNS → 断言优雅「不可用 / 空」态。hover/框选交互逻辑主要靠 `nearestPointIndex`/`brushToRange` 单测兜底。
- React 组件 + Canvas 指针层按本仓约定由 E2E 覆盖，不写组件单测。

### 验证流程（本仓约定）
`tsc --noEmit` + `npm test` + `eslint`（改动文件）；UI 改动用 `dev:preview` 浏览器实测截图（趋势多系列、hover 游标、框选缩放、动态表列、空态、≤1000 点行为）。

---

## 9. 不做（YAGNI）

- 不做历史数据导出 / CSV 下载。
- 不做趋势「按系列归一化」开关（多 topic 共享 y 轴的量纲压扁问题，首版接受，后续按需补）。
- 不做服务端缓存 / 本地持久化（每次开浮层实时查）。
- 不动现有实时 `Sparkline` / `useSeries` / `TrendChart`。

> 已从初版 YAGNI 提升进首版：**hover 游标读数**、**框选缩放**、**跨多 topic 同图对比**（见 §6）。
