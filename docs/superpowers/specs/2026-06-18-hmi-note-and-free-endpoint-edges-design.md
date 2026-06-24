# HMI 文字标注（note）+ 管线自由端点 设计

> 状态：已批准（2026-06-18）。范围 = 只建能力；原图具体文字等用户给参考图后再逐条还原。

## TL;DR（只看这段就够）

做两件事：

1. **加「文字标注」图元 `note`** —— 把原图上的重要**静态文字**（介质名、工段名、设计参数、备注等）忠实搬进流程图。铁律：**实时值用 `readout`（绑数据），静态文字用 `note`（不绑）**。照图还原前先分清这两类，绝不把静态文字当实时数据乱绑假值。

2. **管线能连「任意点」** —— 现在实线/虚线都只能元件连元件（节点→节点）。升级后连线**任一端可以是「节点」或「画布上任意自由点」**。于是能还原如图细节：FIC 气泡引一根虚线**落在阀左侧进口管**上（不是阀中心），表示它测进口流量。底层仍复用现有连线机制（流向动画、虚线 lead、选中删除、持久化全套）；用户侧 = 调色板新增「实线管道 / 虚线引线」两卡片 + 选中连线拖两端手柄（可锚到节点跟随，也可钉死任意点）。

「进口流速不是出口流速」拆两层：**画在哪**（虚线落进口管 = 几何层，靠自由端点）+ **显什么值**（FIC 绑进口流量计 topic = 数值层，现已支持）。skill 必须把这两层讲清。

---

## 背景与动机

参考图（SUPCON 乙二醇精馏塔 DCS 画面）上，控制阀是控制单元——它控制某段管道的流量。气泡仪表（如 FIC-022A）旁有**两根虚线**：一根到阀执行机构、一根到管段上的测量点（流量元件），并显示实时流速。还原要细到「测的是阀**左侧进口**管、不是右侧出口管」。

当前系统两处缺口：

- **静态文字无家可归**：只有 `readout`（自由摆放但**只显实时值、必带绑定**），没有纯静态文字图元。原图上大量纯文字标注无法忠实还原。
- **连线只能节点→节点**：`edgeSchema` 的 `from`/`to` 是必填节点 id，几何每帧按两端节点重算。`lead:true` 引线也只连到设备**中心**（见 demo `e-37: FIC-022A→FV-022A`）。无法把第二根虚线落到「进口管上的一个点」。

## Part 1 — `note` 静态文字图元

### 行为
- 新 symbol `note`：纯静态文字，**无任何数据绑定**、无运行态。
- 文字内容 = `node.label`（复用 Inspector 现有 label 字段编辑，零新增 UI）。label 空时编辑态显占位「文字」以便选中。
- `overlay: true`：盖在所有设备/装饰之上（与 `readout` 同款标注层），自身即背景、无需不透明背板；文字带 `halo`（画布色描边）保证压在管线/设备上仍清晰。
- `circular: false`。
- bounds 按字长估算（参照 `readout`/`instrument` box 的 `CHAR_W` 估宽），中心在 `node.x/y`，供命中/选中/框选。
- v1 单行、单一字号、居中。`props.size` / `props.align` / 多行留作后续（YAGNI）。

### 配套
- `capabilities.ts`：加 `note` 条目。新增类目「标注」。无 `states`、无 `props` 绑定 —— 驱动绑定 UI 自动显示「无需绑定」、调色板出卡片、图例不收录。
- `default-registry.ts`：注册 `note`。
- `i18n/dict.ts`：补「标注」类目名、卡片 label「文字标注 Note」、desc 等所有新可见串（zh-as-key）。
- `note.test.ts`：build 产出含 `node.label` 的 text 图元；bounds 随字长变化；label 空 → 占位串；overlay 标志正确。

### 判别铁律（写进 skill）
还原原图文字前，先判每处文字属于哪类：

| 原图文字 | 图元 | 是否绑定 |
|---|---|---|
| 实时数值（流量/温度/压力/液位读数、阀位%…） | `readout`（或带值的 `instrument` box） | 绑 topic/path |
| 静态文字（介质名、工段名「至 XX 工段」、设计参数、设备别名、备注） | `note` | 不绑 |

判错的代价：把静态文字绑成实时值 → 显示「--」或乱跳；把实时值做成 note → 死值不刷新。**还原 = 位置/朝向/类型 + 图上重要文字**，但**实时值 vs 文字信息必须先分清，不能乱还原**。

## Part 2 — edge 自由端点

### schema（`schema.ts` `edgeSchema`）
- `from` / `to` 由必填改 **optional**（节点 id）。
- 新增 `fromPoint?: [number, number]` / `toPoint?: [number, number]`（世界坐标自由点）。
- `superRefine`：每端「节点 id **XOR** 自由点」恰选一；两者都给或都不给 → 字段级报错（fail-fast，不静默）。
- `points`（`.min(2)`）保留为悬空兜底快照，语义不变。

### render（`scene-render.ts` `autoPointsOf`）
- 每端解析为锚 `resolveEnd(nodeId?, point?)`：
  - 节点 → 现有 `connectBox(node, def)`（端口/中心，含贴紧背板逻辑）。
  - 自由点 → **零尺寸盒** `{x:px, y:py, w:0, h:0, cx:px, cy:py}`，其中心即该点。
  - 都解析不到（悬空）→ 返回 undefined，回落 `edge.points`。
- 复用现有几何**零改写**：`sideRoute` / `centerRoute` / lead 分支对零尺寸盒天然成立（取中心即点）。
- lead 落自由点：直接终于该点（管段测量抽头，无设备本体 → 无需背板遮口）。`fromSide`/`toSide` 仅对节点端生效，自由端忽略。

### edit.ts
- `addEdge` 加自由点变体（或参数放宽为「端 = 节点 id 或自由点」），`auto:true` 语义不变。
- `removeNodes` 级联 `!ids.has(e.from) && !ids.has(e.to)`：`ids.has(undefined)=false` → 自由线不误删、node→point 删节点连带删，**天然正确**，无需改。
- **group-move（本期纳入，按用户要求「边也能框选」）**：
  - 选择模型纳入 edge id（单击选中已有；框选 marquee 命中规则：边的自由端点落在框内，或线段与框相交 → 选中该边）。
  - 平移一组选择时，翻译 **选中边的自由端点**（`fromPoint`/`toPoint`）与 `points[]` 各 +（dx,dy）；节点锚端仍随节点自动重算跟随。
  - 复用现有拖拽 coalesce（`begin`+`replace`）合一步撤销。

### 交互（`HmiCanvas.tsx`）
1. **拖画延伸**：从节点端口拖出，松手落**空白** → 创建 node→自由点边（落在光标世界点）。落到节点上 = 现行 `commitConnect` 锚两端行为。拖画预览已支持画到光标自由点（现有零尺寸盒预览），仅 commit 需放行无目标节点的情形。
2. **调色板卡片**「实线管道 / 虚线引线（lead）」：拖入画布 → 默认自由点线段（如水平一段），随后可拖两端手柄定位。
3. **选中边显两端手柄**：拖手柄移动该自由端点；松手贴近某节点端口 → 锚该端（`fromPoint`→清空、`from`→该节点 id，自此跟随设备移动）；从节点拖离 → 解锚回自由点。
4. **选中边 实线⇄虚线 toggle**：翻转 `lead`（细虚线信号线 ⇄ 粗实线工艺管）。

### 进口 vs 出口（两层，skill 必讲）
- **几何层**：虚线落在进口管段（自由端点钉在阀左侧管线上），而非阀中心/右侧出口。
- **数值层**：FIC 的 `value` 绑**进口流量计**的 topic/path —— 纯绑定问题，**现已支持**，只需在 skill 点明「选对 topic」。

## skill 更新

- `hmi-mimic-generation`（照图还原段）：
  - (a) 文字判别铁律（实时值→readout / 静态文字→note）。
  - (b) 自由端点管线用法 +「进口/出口 = 几何层 vs 数值层」两层拆解。
  - (c) 阀 = 控制单元：控制虚线落在**被控管段**（通常进口侧），并标实时流速。
- `hmi-symbol-authoring`：`note` 登记三件套（capability / i18n / test）规范，强调「无绑定标注类」图元写法。
- `hmi-visual-selfcheck`：自检清单 +「原图重要文字是否还原 / 还原成 note 还是 readout 是否判对 / 引线是否落在正确管段」。

## v1 范围与非目标（YAGNI）

**纳入**：note 图元；edge 自由端点（schema/render/edit/交互）；边可框选 + 整体平移；skill 更新。

**不做（后续）**：note 多行 / 字号 / 对齐控件；边自由端「锚设备 + 偏移到非中心点」并跟随；自由点沿网格吸附。

## 测试与验证

- **单测**（`node:test`，co-located `*.test.ts`）：
  - `note.test.ts`：build / bounds / 占位 / overlay。
  - `schema` 解析：每端 node XOR point 的 refine（合法四组合 + 非法两组合）。
  - `scene-render`：node→point、point→point、point→node 三态几何；lead 落自由点；悬空回落 points。
  - `edit`：addEdge 自由点变体；removeNodes 自由线不误删 / node→point 删节点连带删；group-move 翻译自由端点。
- **E2E**（`e2e/hmi.spec.ts`）：拖画落空白成自由端；选中边拖手柄移动/锚定；调色板拖入线卡片；框选含边整体平移。
- **类型/规范**：`tsc --noEmit` + `eslint` 改动文件。
- **视觉自检**：`dev:preview` + chrome-devtools 截图亲验——note 文字清晰不糊、FIC 双虚线落进口管、自由线随框选平移、锚端随设备跟随。查 render 内部用临时 `console.log` 取真值，别靠像素猜。
