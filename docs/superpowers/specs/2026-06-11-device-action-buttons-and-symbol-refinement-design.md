# 设备动作按钮 + 图元造型精致化 · 设计 spec

> 2026-06-11 · 已与用户对齐两节设计后成文。
> 取代 B-P0 独立控制图元形态（`68c92b8`）；图元部分落实设计文档 §7.1 路线。

## TL;DR（一页看懂）

这次做三件事：

1. **操作按钮长在设备上**：给设备配"动作"（发什么 MQTT 消息），设备下方自动出现小胶囊按钮（如 [▸ 启动] [■ 停止]）。动作多了自动收进 `⋯` 菜单，画面不乱。operator 看图点按钮就能操作；admin 在右侧面板配置，配置时画布实时预览。之前做的三个独立控制图元和详情里的 MQTT 发布面板都删掉，统一成这一套。
2. **图元画得更像真设备**：风格不变（扁平灰阶、颜色只给异常），把 27 个图元的比例和细节重画（罐有封头和支腿、泵有蜗壳、电机有散热筋……），分 5 批交付，罐体打头，每批给前后对比截图验收。
3. **底部告警条去掉**：告警只看画布上图元自己的状态（红环/角标/虚化），不再在屏幕底部为每个设备摆一排 chip。

## 0. 背景与目标

两个用户诉求，一次设计：

1. **操作上图，一目了然**：MQTT 操作要直接出现在画布设备旁（不是藏在详情面板里），但"每个设备摆一个独立按钮图元"会乱。B-P0 做的 pushbutton/toggle/setpoint 三个独立图元形态废弃，只保留"按钮"这一个交互概念，并重新设计其形态。
2. **图元要"像"**：保持 HP-HMI（ISA-101 扁平、灰阶、状态例外化）风格不变，把 2D 图元的造型比例与特征细节做精致——"像"靠造型，不靠彩色质感渲染。

## 1. 设计原则：复杂度守恒，挪到界面里

配置环境（绑定、动作、模板）有固有复杂度，砍不掉，但要从"用户脑子里"挪到"界面设计里"。本设计及后续配置类迭代统一遵循：

1. **所见即所得**——配置动作时画布按钮实时预览
2. **渐进披露**——默认只露必填项（按钮文字、消息内容），多条消息/确认/排序收进"更多"
3. **默认值兜底**——新增动作预填可用值，先能跑再细调
4. **零术语文案**——说"点这个按钮时，向哪个主题发什么内容"，不说"消息组/payload 模板"
5. **空状态引导**——无动作时显示"＋ 给这台设备加一个操作按钮"，不是空列表
6. **试一发**——每条动作旁有"试发送"，admin 配完当场验证，不用切预览模式（补位 PublishPanel 移除后的调试能力）

## 2. 第 1 部分：设备动作按钮

### 2.1 概念

按钮是**设备的属性**，不是独立图元。给设备配"动作"，每个动作渲染为停靠在设备下方的胶囊按钮：自动吸附、随设备移动、配了才显示。

```
      ┌──────┐
      │ 泵图元  │
      └──────┘
      P-101 进料泵A          ← 位号标签
       1480 rpm              ← 内联值
   [▸ 启动] [■ 停止] [⋯]     ← 动作按钮行（胶囊，横排居中）
```

### 2.2 数据模型

```ts
// schema.ts
const actionSchema = z.object({
  label: z.string().min(1),                        // 按钮文字（渲染层超长截断 + title 全文）
  items: z.array(publishMessageSchema).min(1),     // 消息组：执行时逐条发布
  confirm: z.boolean().optional(),                 // 发送前确认弹窗
});
// node 上：
actions: z.array(actionSchema).max(8).optional()
```

- `edit.ts` 增 `setNodeActions(mimic, nodeId, actions)`（整列表不可变替换；增删改排序都由 UI 组装新列表后一次提交）
- **移除**：`node.control` 字段、`controlSchema`/`controlActionSchema`/`controlWriteSchema`、pushbutton/toggle/setpoint 三个 symbol 与 capabilities「操作」品类、元件库「操作」分组、`ControlEditor` 的 toggle/setpoint 分支（组件重写为动作列表编辑器）
- `publishPresets` 字段**保留 zod 解析**（旧数据不报错）但 UI 无入口、不自动迁移为 actions（避免旧手动模板突然变成图上按钮）
- DB 已确认无 control 遗留实例；zod 对未知 key 默认剥离，带 `control` 的旧 JSON 解析安全

### 2.3 停靠渲染与溢出

- 位置：设备 `bounds` 底边 → 标签行（若有，16px）→ 内联行（若有，14px）→ 4px 间距 → 按钮行
- 胶囊：高 18px、圆角 9、文字 10px；宽度按字符估算（中文 ~10px/字 + 16px padding），超 6 字截断加 `…`
- **顺序即优先级**：动作 ≤3 个时全部直达（无 `⋯`）；≥4 个时前 2 个直达、其余收进 `⋯`（溢出只剩 1 个不值得占一个 `⋯` 位）——画面恒定最多 3 个胶囊，不随动作数量膨胀
- `⋯` 菜单是 **React 浮层**（非 Canvas 绘制）：锚定按钮屏幕坐标，列出剩余动作，点选执行；Esc/点外部/画布平移缩放时关闭
- 视觉：扁平胶囊（fillLight 底 + stroke 边 + text 字），hover 边框转 focus-accent + 手型光标；按下微缩；发送成功后该按钮原位变 running 绿显「✓ 已发送」1.5s（反馈就近，替代顶部 toast）

### 2.4 交互与权限

| 模式 | 点按钮 | 点设备本体 | 配置 |
|------|--------|-----------|------|
| 预览（operator 固定 / admin 可切） | 执行：可选确认弹窗（复用 ControlDialog confirm 模式）→ 逐条 publish + tag-store 乐观回显 + 按钮原位反馈 | 查看详情（只读 Inspector） | 不可见 |
| 编辑（仅 admin） | 选中设备 + Inspector 定位到「操作」分节（不执行） | 选中配置 | Inspector「操作」分节 |

- 命中优先级：动作按钮 > 设备本体（渲染层输出独立 `actionHitBoxes`）
- 权限沿用现有 `canEdit` 体系（网关 role → PERMISSION_MATRIX）；publish 为客户端 MQTT 数据面直发，与 PublishPanel 现状一致

### 2.5 Inspector「操作」分节（替代 PublishPanel）

- 动作列表：每行 = 按钮文字 + 消息（第一条默认展开：topic 输入（UNS type-ahead）+ payload）+ 行操作（试发送 ▶ / 上移 / 下移 / 删除）。试发送**不走确认弹窗**（admin 调试场景，直发 + 行内反馈）
- "更多"展开：追加多条消息、确认弹窗勾选
- 空状态：大按钮「＋ 给这台设备加一个操作按钮」，新增预填 label「启动」、payload `{}`
- 前 2 行标注「图上直达」，第 3 行起标注「收进 ⋯ 菜单」——排序后果可见
- **PublishPanel 组件从 Inspector 移除**（连同其模板 UI）；试发送补位调试场景

### 2.6 引擎改动

- `symbols/action-buttons.ts`（新）：纯函数 `layoutActionButtons(node, bounds, actions, hasLabel, hasInline)` → 按钮矩形 + 截断文字 + 溢出分配；`buildActionButtons(...)` → Primitive[]
- `scene-render.ts`：`RenderResult` 增 `actionHitBoxes: { nodeId, action: number | "overflow", x, y, w, h }[]`；渲染按钮需要按钮视觉态（pressed / sent），由调用方注入 `getActionFeedback?(nodeId, index)`
- `HmiCanvas`：pointer 命中判定优先 actionHitBoxes；新增回调 `onActionClick(nodeId, index)`、`onActionOverflow(nodeId, screenX, screenY)`（预览模式）；编辑模式命中按钮 → `onSelect(nodeId)`
- `HmiPage`：执行链路复用 B-P0 的 publish + 乐观回显 + ControlDialog（仅 confirm 模式，setpoint 模式删除）；新增溢出菜单浮层与按钮反馈 state

## 3. 第 2 部分：图元造型精致化

### 3.1 标准（27 个图元逐一重画）

1. **比例校准**：按真实设备形态重定比例（储罐高径比、泵蜗壳形态、塔细长比）——现图元"几何块感"的根源是比例失真
2. **特征细节层**：罐=椭圆封头曲线+支腿/裙座+顶部接管；泵=蜗壳螺线+底座；电机=散热筋；阀=手轮/气动执行机构；塔=塔盘线；换热器=管板。细节 1px 细线 + textMuted 低对比灰，外轮廓 2px——缩小时细节自然弱化
3. **状态层不动**：运行深填充 / 故障红环 / 失联虚化原样保留，细节层不抢异常色
4. **统一视觉重量**：尺寸协调、锚点居中、bounds 精确（连线贴边与命中依赖它）

**明确不做**：渐变、阴影、高光、3D 透视、彩色固有色。

### 3.2 引擎扩展

- `primitives.ts` 增 `path` 图元（moveTo/lineTo/bezierCurveTo/arc 指令序列 + Style），painter 对应绘制——封头曲线、蜗壳螺线的前提
- `SymbolContext` 增可选 `scale`（renderScene 由 HmiCanvas 传入 viewport scale）：`scale < 0.7` 时图元只画基础形体（LOD），千级节点缩小后保持干净 P&ID 与绘制性能

### 3.3 告警呈现简化：移除底部告警条（用户评审新增）

- **移除 `AlarmStrip`**（底部逐设备报警/失联 chip 条）：组件、`collectAlarms` 装配调用、相关 i18n 与 e2e 断言一并清理
- 告警感知完全交给画布图元自身的状态语言（红环慢闪 + ! 角标 / 失联虚化 + ? 角标），这正是 status-by-exception 的本意——异常在图上自己跳出来
- 原 chip 的"点击定位设备"能力随之移除；如后续需要全局告警导航，另行设计（不在本次范围）

### 3.4 分批交付（每批：造型 + 单测更新 + 组件预览页截图对比验收）

| 批 | 图元 |
|----|------|
| 1 | tank / vessel / column / drum / silo / cyclone（罐体打头） |
| 2 | pump / motor / fan / compressor / agitator |
| 3 | valve / controlvalve / checkvalve / safetyvalve / damper / switch |
| 4 | exchanger / condenser / cooler / heater / filter / mixer |
| 5 | meter / dialgauge / bargauge / instrument |

## 4. 测试与验收

- **单测**：actions schema 解析（上限/空 items 拒绝）；`setNodeActions` 不可变；`layoutActionButtons` 布局纯函数（2+溢出分配、估宽截断、标签/内联占位）；执行解析纯函数；path painter；各图元造型测试随批更新
- **E2E**：重写 B-P0 控制元件用例 → 设备动作按钮链路（选设备 → 加动作 → 画布出按钮 → 预览点击 → 反馈 → 删除清理）；溢出菜单开合；移除用例 1 中 `alarm-strip` 可见性断言
- **浏览器验收**：双模式按钮交互截图；每批图元改完 `/components` 预览页前后对比图
- 全程 `tsc` + `node:test` 全量 + eslint 改动文件

## 5. 风险与备注

- 按钮文字估宽不精确 → 截断 + title 兜底，不追求像素级
- 溢出菜单浮层与画布事件并存 → 菜单打开时点外部即关，画布 pan/zoom 触发关闭
- `data/control.ts` 的 `renderWritePayload`/`validateWriteValue`（setpoint 专用）随 setpoint 删除；`parsePayload` 保留复用
- i18n：所有新文案 zh-as-key 进词典（含「试发送」「图上直达」「✓ 已发送」等）
- 旧 e2e「控制元件」用例必须同步重写，否则必红
