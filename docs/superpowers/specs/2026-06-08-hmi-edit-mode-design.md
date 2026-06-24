# HMI 编辑模式：调色板放置 / 删除 / 图例补全

日期：2026-06-08
状态：设计已确认（待实现）

## 目标

把监控页（HmiPage）升级为可切换的轻量编辑器：
1. 从调色板拖图元到画布上**新建**节点（也支持点选快捷新建）。
2. 选中节点**删除**。
3. 用「监控 / 编辑」模式开关隔离只读与编辑操作。
4. 补全状态图例缺失的视觉态。

非目标（本期不做）：对齐/吸附网格、复制粘贴、撤销重做、连线编辑、联锁编辑。

## 模式与边界

HmiPage 持有 `mode: "monitor" | "edit"`，默认 `monitor`；Topbar 放分段开关。`editable = mode === "edit"` 作为唯一闸门下传。

| 操作 | 监控态 | 编辑态 |
|---|---|---|
| 点选 → 检视面板 | ✓ 只读（位号 + 实时值 + 状态） | ✓ 含数据绑定配置 |
| 空白左键拖 | 平移画布 | 框选多选 |
| 平移 | 左键拖空白 | 空格 / 中键拖 |
| 拖节点移动（含整组） | ✗ | ✓ |
| 调色板 / 增删 | 隐藏 / 禁用 | ✓ |

## 组件与数据流

### Topbar
新增 `mode` + `onModeChange` props，渲染「监控 / 编辑」分段开关。

### Palette.tsx（新）
- 仅编辑态渲染，画布**左上**折叠面板（图例在左下，错开）。
- 数据源 `ALL_CAPABILITIES`，按 `SymbolCategory`（设备/执行器/容器/换热/仪表）分组。
- 每项 = `buildSwatch(默认态)` 渲染的真实 mini 图标 + 中文名，`draggable`。
- `onDragStart`：`dataTransfer.setData("application/x-hmi-symbol", type)`。
- `onClick`：点选快捷新建。视口中心的世界坐标在 HmiCanvas 内部，故 HmiCanvas 用 `useImperativeHandle` 暴露 `placeAtCenter(type)`；HmiPage 持 `canvasRef`，Palette 点击 → `canvasRef.current?.placeAtCenter(type)`，内部用当前 `vp` 算中心世界坐标后走同一 `onAddNode` 路径。

### HmiCanvas
新增 `editable: boolean`，分流指针/拖放行为：
- `editable=false`（监控）：空白拖 = 平移；节点 = 仅 click 选中（不移动）；无框选；无拖放目标。
- `editable=true`（编辑）：节点拖 = 移动；空白拖 = 框选；空格/中键 = 平移；启用拖放。
- `onDragOver`（编辑态）`preventDefault`；`onDrop` 读 `application/x-hmi-symbol` → 落点屏幕坐标经 `toWorld` 转世界坐标 → `onAddNode(type, x, y)`。
- 改为 `forwardRef` + `useImperativeHandle` 暴露 `placeAtCenter(type)`（供调色板点选快捷新建，见下）。

### Inspector
新增 `editable`：监控态隐藏「数据绑定」整块（TopicManager / 字段绑定 / 位号改名 / WatchManager），只保留位号 + 实时值 + 状态读数。

### edit.ts（不可变）
- `addNode(mimic, type, x, y): { mimic: Mimic; id: string }` —— 生成唯一 id `${type}-${n}`（n 取该 type 现有最大序号+1），默认 `{ rotation:0, label:id, topics:[], bindings:{}, inline:[] }`，追加节点；返回新 mimic 与新 id（供自动选中）。
- `removeNodes(mimic, ids: readonly string[]): Mimic` —— 删除集合内节点；连带删除 `from`/`to` 命中集合的连线；联锁引用不在此清理（交给现有 `validateMimicAssets` 非阻断提示）。空集合/全不存在 → 原样返回。

### HmiPage 接线
- `onAddNode(type,x,y)` / `onPlace(type)` → `addNode` → `setSchema` + `setSelectedIds([newId])`（自动选中新节点）。
- 编辑态 `Del/Backspace`（画布有焦点且有选中）→ `removeNodes(selectedIds)` + `setSelectedIds([])`。
- 监控/编辑切换时不清空选择；切到监控不影响已选中的只读检视。
- 持久化沿用现有「保存」（写 `default.json`），无需改动。

### 图例（legend-entries.ts）
- 新增条目「预警」：`type:"pump", state: S({ alarm:"warn" })`，描述"高/低报阈值（琥珀环·不闪）"。
- 「失联」描述改为"数据中断或映射未命中（虚线褪色 + ?）"，覆盖 `quality:"unknown"` 共用视觉。

## 错误处理 / 边界
- `onDrop` 读不到合法图元 type → 忽略（不建空节点）。
- `addNode` 的 type 必须在 registry 内（调色板只列已注册项，天然成立）；若越界 id 冲突，序号探测保证唯一。
- 删除后若检视面板指向已删节点：`selectedNode` 由 `byId` 查不到 → 面板自然关闭。
- 监控态下所有编辑入口（拖动/框选/拖放/Del/绑定配置）均短路，杜绝误操作。

## 测试
- 单元：`addNode`（默认值、id 唯一、自增序号、不可变、返回 id）、`removeNodes`（删节点+连带删连线、空集合原样返回、不可变）。
- 单元：图例条目数与新增「预警」断言。
- 回归：现有 366+ 单测、5 E2E、`tsc`/`eslint` 全绿。
- 手测：dev:preview 切编辑态→拖图元落点新建→改绑定→删除→切监控态确认只读。

## 影响文件
- 改：`HmiPage.tsx`、`HmiCanvas.tsx`、`Topbar.tsx`、`Inspector.tsx`、`edit.ts`、`legend-entries.ts`
- 新：`Palette.tsx`
- 测：`edit.test.ts`（扩展）、`legend-entries.test.ts`（如有/新增）
