# HP-HMI 组件与交互设计方案

> 评审版 · 2026-06-10 · 配合演示环境 `npm run dev:preview` (http://localhost:5173)
>
> 本文是组件清单 + 交互设计的单一来源，含已落地能力与下一阶段设计提案（§7）。
> 视觉 token 与密度规范见 `DESIGN.md`；schema 字段语义见 `docs/hmi-schema.md`。

---

## 1. 产品定位与设计原则

**一句话**：schema 驱动的 P&ID 过程监控 + 组态编辑一体化工具——一份 JSON 描述工艺图（设备/管线/联锁），Canvas 2D 渲染，MQTT 实时数据驱动设备状态，所见即所存。

四条不动摇的原则：

| 原则 | 含义 | 落点 |
|------|------|------|
| **状态例外化** (status-by-exception, ISA-101) | 正常态低饱和灰阶，颜色只给例外：故障红、预警黄、失联虚化、未配置虚线 | `state-language.ts` 装饰优先级；图例 |
| **标准化映射，不标准化设备** | 每个工厂 MQTT 报文不可知，不硬编码设备假设；靠绑定层 `map/test/scale/alarms` 对着真实报文配置 | 绑定编辑器；UNS type-ahead |
| **编辑即存** | 所有编辑动作防抖自动落库（800ms），无需手动保存；undo/redo 全量覆盖 | `useHistory` + 自动保存 effect |
| **角色定边界** | 网关注入身份，权限矩阵定行为：能编辑的看到完整工具，只读的看到干净监控画面 | `PERMISSION_MATRIX` + 编辑/预览双模式 |

---

## 2. 架构一页图

```
┌─ 数据流（单向）────────────────────────────────────────────┐
│  schema(JSON) ──parseMimic──▶ Mimic ──buildScene──▶ Scene  │
│                                  │                    │     │
│  edit.ts 不可变变换 ◀──── useHistory(undo/redo)       │     │
│                                                       ▼     │
│  MQTT/UNS ──▶ tag-store ──resolveNodeState──▶ NodeState     │
│                                  │                    │     │
│                                  ▼                    ▼     │
│              registry.build(node,state) ──▶ primitives      │
│                                  │                          │
│                                  ▼                          │
│              painter ──▶ Canvas 2D（React 之外，rAF+脏标记）│
└─────────────────────────────────────────────────────────────┘
```

关键决策：**画布渲染在 React 之外**（rAF 渲染循环 + 脏标记），React 只管 chrome（面板/工具条）；两者经 `useSyncExternalStore`（数据）和 props ref（渲染参数）解耦。好处：千级节点不触发 React 重渲染；代价：画布内交互（命中/拖拽/画线）需要自管状态机。

---

## 3. 模式与角色（本轮新增）

### 3.1 身份链路

```
网关注入 Header（user JSON / X-App-User-*，含 role）
  → start.ts 中间件校验 → 签名 session cookie
  → 路由 beforeLoad 取 user → can(role, "edit_mimic") → HmiPage canEdit
```

- 角色合法性以 `PERMISSION_MATRIX` 为准；网关没给 role 时回落 `/login` 选择页。
- 本地开发：`dev:preview` 注入 `PREVIEW_USER_ROLE=admin`；要看 operator 视角改环境变量即可。

### 3.2 双模式行为矩阵

| 能力 | 编辑模式 | 预览模式 |
|------|---------|---------|
| 谁可用 | `edit_mimic` 权限（admin） | 所有人；operator **固定**此模式（无切换钮） |
| 顶栏 | 编辑/预览切换、上传 schema、改图名 | 仅模式切换（admin）、连接/主题/语言 |
| 元件库 / 工具条 / 多选条 | ✓ | ✗（全部隐藏） |
| 画布 | pan/select/line 三工具，拖拽/框选/删除/undo | 强制 pan：缩放平移 + 点选查看 |
| 检视面板 | 全功能（绑定/发布/删除/改名） | **只读**：实时数据 + 趋势 + 状态徽标 |
| 报警条 / 图例 | ✓ | ✓（监控本职） |
| 快捷键 | Del 删除、Ctrl+Z/Y | 仅导航类（方向键/Esc） |

设计要点：**预览 ≈ runtime 语义**（参照 FUXA editor/view 分离，但我们做同页切换，admin 随时核对操作工视角）。安全边界在权限矩阵不在 UI——隐藏只是体验，后端 server fn 仍按 session 校验。

---

## 4. 组件清单

### 4.1 页面框架层

| 组件 | 职责 | 关键交互 |
|------|------|---------|
| `HmiPage` | 全应用唯一页面；状态中枢（history/选中/模式/数据源/主题） | 组合下列所有组件；自动保存；快捷键 |
| `Topbar` | 图名、模式切换、上传 schema、MQTT 连接、语言、主题 | 编辑/预览 segmented；连接状态徽标可断开/重连 |
| `MimicTitle` | 图纸名内联改名 | 铅笔进入编辑，回车/失焦提交（仅编辑模式） |
| `StateLegend` | 状态图例（运行/停止/故障/失联/未配置） | 可展开收起，向不懂状态语言的人解释画布 |

### 4.2 画布系统层

| 组件/模块 | 职责 | 关键交互 |
|------|------|---------|
| `HmiCanvas` | Canvas 宿主：DPR/视口/命中/指针状态机 | 见 §5.1 工具交互 |
| `engine/*` | painter（图元绘制）、viewport（pan/zoom/fit）、render-loop（rAF+脏标记）、hit-test | — |
| `symbols/*` | 每图元一文件的符号库 + `capabilities.ts` 状态契约 | 契约同时驱动绑定 UI、元件库、图例 |
| `Palette` | 左侧元件库（按 capabilities 分类） | 拖放到画布任意点 / 点选放画布中心 |
| `EditToolbar` | 底部居中工具条 | 平移/选择/**画线** 三工具 + undo/redo/删除/保存 |
| `SelectionBar` | ≥2 选中时顶部浮条 | 批量删除/清空选择 |

### 4.3 检视与配置层（右侧 Inspector 栈）

| 组件 | 职责 | 关键交互 |
|------|------|---------|
| `Inspector` | 设备详情：实时数据→趋势→绑定→发布→删除；**readOnly 变体**只留前两节 | 标题即改名输入框 |
| `BindingEditor` | 字段契约列表（来自 capabilities），每字段配来源+映射 | 绑定状态绿点；来源两行布局 |
| `FieldSource` | topic 下拉（已订阅）→ 字段下拉（实时报文 ∪ UNS schema 字段） | 报文未到可手输兜底 |
| `StateValueMap` | 布尔字段：对着状态图标填 test/testOff 判定条件 | 两态独立配置，不自动取补 |
| `BindingMapEditor` | 数值字段：量程 scale + 四级阈值 alarms | ⓘ Tooltip 解释 HIHI/HI/LO/LOLO |
| `TopicManager` | 设备订阅 topic 管理 | UNS type-ahead，回车/点选即加 |
| `WatchManager` | 额外数据点（纯显示） | — |
| `ActionsDialog` | 设备操作配置弹窗（右侧浮动，编辑模式）：动作列表=按钮文字+消息组+确认，试发送/排序/渐进披露 | Inspector「操作」入口或画布点按钮直达；改动即时落库、画布按钮实时预览 |
| `ActionsEditor` | 动作列表编辑器（弹窗内核） | 空状态引导、「图上直达 / 收进 ⋯ 菜单」徽标随排序 |

### 4.4 基础组件层

| 组件 | 规范 |
|------|------|
| `SelectMenu` | 样式化下拉（替代原生 select）：选项面板内换行显全文；选中=深色加粗+灰底 |
| `Tooltip` | 说明类 hover（card/border/shadow）；截断文本的全文展示仍用原生 `title`（无障碍兜底） |
| `UnsTopicInput` | UNS type-ahead：防抖 150ms，下拉项显 path+字段 schema，选中顺带缓存字段供绑定用 |
| 聚焦/选中色 | 统一 `--focus-accent` 沉稳青（亮 #2f8f83/暗 #3aa597，与画布选中同语言）；**绿色只留品牌/运行态/成功反馈** |

---

## 5. 关键交互流

### 5.1 画布工具（编辑模式）

```
平移 pan（默认）   拖任何地方=平移；点击=选中。防误挪的「只看」工具。
选择 select       拖节点=移动（选中集整组动，合并为一步历史）；拖空白=框选；Shift+拖恒框选。
                  ├ 拉线内置（无独立画线模式）：悬停图元自动显示四向连接点，
                  │  按住连接点拖出（光标变十字）→ 正交虚线橡皮筋 → 松手落目标图元成线
                  ├ 端口优先于节点拖拽（按身体=移动，按连接点=拉线）；松空白/Esc 取消
                  └ 生成 auto 边：渲染时按两端图元实时位置重算正交轨迹 ——
                     移动图元线自动跟随；线几何走中心制，端头藏图元背板下，
                     可见端永远贴紧图元轮廓（圆形/内缩轮廓零缝隙）
通用              滚轮缩放（光标锚定）、空格+拖临时平移、双击 fit、右下角 +/−/fit
```

### 5.2 绑定配置流（把未知设备接上数据）

```
选中设备 → TopicManager 加 topic（UNS 搜索或手填）
→ 字段「来源」选 topic + 报文字段（报文未到用 UNS schema 字段顶上）
→ 布尔：对着状态图填判定（=1 运行 / =0 停止…）；数值：量程 + 阈值
→ 画布即时反映；全程自动落库
```

### 5.3 设备动作按钮（2026-06-11 形态演进：取代发布面板与独立控制图元）

动作 = **设备属性**（`node.actions`，上限 8）：每条 = 按钮文字 + 消息组 `{items:[{topic,template}]}` + 可选发送前确认。设备下方自动渲染胶囊按钮行（顶部归属小箭头指向设备）。

```
配置（admin 编辑模式）：Inspector「操作」入口 / 画布点按钮 → ActionsDialog 弹窗
  ├ 空状态「＋ 给这台设备加一个操作按钮」；新增预填（label=启动、payload={}）
  ├ 必填项就近（按钮文字 + 第一条消息），多条消息/确认收进「更多设置」
  ├ 行操作：▶ 试发送（不弹确认，当场验证）/ 上移下移 / 删除
  └ 排序即优先级：≤3 全部直达；≥4 前 2 个直达、其余收进 ⋯ 溢出菜单
运行（operator / 预览）：点按钮 → 可选确认弹窗 → 逐条 publish + 乐观回显
  → 按钮原位变绿「✓」1.5s；点 ⋯ 浮出菜单选执行；点设备本体=查看详情
```

旧 `publishPresets` 字段保留解析兼容（无 UI 入口）；`node.control` 旧数据解析时剥离。

### 5.4 报警链路

```
binding.alarms 越限 → ResolvedSignal.level(warn/alarm) → NodeState.fault/alarm
→ 画布红环+徽标（慢闪）→ 点击设备检视看具体值（告警感知全在图元自身，无底部告警条）
四级阈值：HIHI/LOLO=严重(红)、HI/LO=预警(黄)，面板 ⓘ Tooltip 内置解释
```

---

## 6. 视觉语言速查

- **设备状态**（画布）：运行=深填充 / 停止=浅填充 / 故障=红环+! / 失联=虚化+? / 未配置=虚线+待接线 / 联锁=挂锁角标
- **聚焦/选中**（chrome）：`--focus-accent` 青；画布选中环同源 `--hmi-selection`
- **硬规则**：任何截断文本必带 `title` 全文；收缩优先 `min-w-0` 而非拉伸 `flex-1`
- 主题：亮/暗双套 token（`[data-hmi-theme]` 作用域），画布经 `readPalette` 读 CSS 变量，不 fork

---

## 7. 下一阶段设计提案（待评审拍板）

> 背景输入：FUXA（开源 SCADA, 19k★）交互模式调研。它是 SVG/HTML 组件叠加架构，
> 我们是 Canvas 统一绘制——**借鉴其配置模型，不抄实现路径**。

### 7.1 图元拟真度强化 — ✅ 已落地（2026-06）

现状：图元为示意级几何形体。目标：贴近真实设备外观，操作工零培训识别。

> **2026-06 落地摘要**：三层绘制结构已实现——引擎新增 `path` 曲线图元（封头椭圆弧/蜗壳螺线，`engine/primitives.ts` + `painter.ts`）与 LOD（`symbols/lod.ts` `showDetail(scale)`，阈值 `DETAIL_MIN_SCALE=0.7`，`SymbolContext.scale` 由 `renderScene` 透传）。27 个图元（tank 标杆 + 容器/旋转/执行器/换热静/仪表 5 批共 26 个）全部按品类规格重画 `build`/`bounds`，细节层一律裹 `showDetail`、状态→填充语义不变。规格与流程见 `docs/superpowers/plans/2026-06-11-symbol-refinement.md`。

- **三层绘制结构**：基础形体（轮廓/体积感）→ 细节层（法兰、支腿、电机风扇罩、视镜等静态特征）→ 状态层（现有 state-language 装饰不变）。细节层仅在 `scale > 阈值` 时绘制（LOD），保证缩小后仍是干净 P&ID。
- **props 驱动变体**：沿用现有机制（`vessel.agitator`、`exchanger.orientation`），扩充如 `pump.kind: centrifugal|dosing|screw`、`valve.actuator: manual|pneumatic|motor`。变体进 capabilities，元件库分组展示。
- 风险控制：拟真不破坏状态例外化——细节一律低饱和，颜色仍只属于例外状态。

### 7.2 图表元件进画布

把「数据可视化」做成一类 symbol，与设备图元同等公民（拖放/绑定/缩放）：

| 元件 | 形态 | 数据 |
|------|------|------|
| `trend` | 迷你趋势图（滑动时间窗） | 1-3 条绑定，内存环形缓冲（先不做历史库） |
| `gauge` | 径向仪表（量程+阈值色带） | 单数值绑定，复用 alarms 配色 |
| `bar` | 水平/垂直条 | 单数值绑定 |
| `value` | 大数字卡（单位+趋势箭头） | 单数值绑定 |

- **借鉴 FUXA**：「图表 = 命名的多绑定线集合」——trend 的多条线在 Inspector 里按行配置（每行 = 来源 + 颜色），结构对齐现有 watches。
- 实现要点：Canvas 内增量绘制，数据到达只标脏图表所在区域；capabilities 加 `category: "chart"`，绑定 UI 零新概念。

### 7.3 画布上的操作口子（控制元件）⭐ 交互变化最大 — ✅ 已落地（P0）

> **2026-06-11 形态演进**：独立控制图元（pushbutton/toggle/setpoint）→ **设备附属动作按钮**（`node.actions`，停靠设备下方、溢出收 ⋯ 菜单、弹窗配置），并移除 PublishPanel 与底部告警条。最终形态见 §5.3；决策过程见 `docs/superpowers/specs/2026-06-11-device-action-buttons-and-symbol-refinement-design.md`。以下为当时的 P0 提案原文（历史记录）。

把 MQTT 发布从检视面板搬到画布：设备旁直接放**按钮/开关/设定值**控制元件。

- **新 symbol 类**（元件库新增「操作」品类）：`pushbutton`（点按发一组消息，`lit` 指示灯回显）、`toggle`（两态各配一组、各自独立不取补，`state` 绑实时数据回显；原方案名 `switch` 与电气开关 type 冲突，落地更名）、`setpoint`（点击弹窗输入数值，`{{value}}` 模板占位写入，min/max/step/unit 约束；画布拖动滑块留后续迭代）。
- **配置（编辑模式）**：选中控制元件 → Inspector「操作」分节——动作 = 消息组 `{items:[{topic,template}]}`（结构同发布模板消息），组级「发送前弹窗确认」复选（确认按元件粒度决定，不做全局开关）。schema 落 `node.control { press / on / off / write }`（zod 校验，`edit.ts setNodeControl` 不可变变换）。
- **运行（预览模式）**：点击 = 执行动作（可选确认弹窗 → `DataSource.publish` 逐条下发 + tag-store 乐观回显 + 顶部「已发送 N 条」toast），**不改变选中**；编辑模式点击 = 选中配置（FUXA editor/runtime 同款语义）。配了动作即视为「已配置」（不再吃未配置虚线装饰）。operator 权限细分（`view_only` vs `operate`、权限挂动作上）仍排 P2。
- **信息架构**（FUXA 最值得吸收的一点）：**「数据→外观」（现有绑定）与「操作→写值」（新增动作）在 Inspector 严格分节**，不混在一起。
- 运行语义纯逻辑收口在 `data/control.ts`（`resolveControlClick`/`renderWritePayload`/`validateWriteValue`），单测全覆盖；交互链路由 E2E「控制元件」用例覆盖。

### 7.4 不采纳的 FUXA 模式（避免跑偏）

- ✗ 模态对话框式元件配置——右侧常驻 Inspector 上下文更好
- ✗ editor/view 双路由硬分离——同页模式切换对 admin 核对视角更顺
- ✗ 开放脚本动作——只做枚举动作，可校验可审计

### 7.5 建议排期

1. ~~**P0 控制元件 + 预览模式操作语义**（§7.3）~~ ✅ 已落地：pushbutton/toggle/setpoint 三类 + 确认弹窗 + 乐观回显闭环
2. ~~**P1 图元拟真**（§7.1）~~ ✅ 已落地：27 图元三层结构重画（path 封头/蜗壳 + LOD 0.7 细节层 + 状态→填充不变）
3. **P1 图表元件**（§7.2）：trend + gauge 先行
4. P2：操作审计日志、动作级权限（operate vs view_only）、历史趋势存储选型

---

## 8. 质量与验证现状

- 单测 529 个全过（`node:test`，符号/场景/数据/schema/设备动作全覆盖；含图元 path/LOD 与 27 图元造型断言）；E2E 6 用例全过（含设备动作按钮 弹窗配置→预览执行→删除恢复链路）
- 浏览器实测：画线全流程、双模式切换、operator 只读视角、多消息模板增删改发、设备动作按钮（直发/确认弹窗/溢出菜单）
- i18n：zh/en 全量同步（zh-as-key）；无障碍：键盘导航/aria/读屏播报保留
