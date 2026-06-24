# HP-HMI 工业组态监控模板 — 设计文档

- 日期：2026-06-05
- 状态：已批准（宏观），进入实现计划
- 范围：**首个垂直切片**（一刀打穿的最小闭环）。后续 5 个子项目各自再走 spec。

---

## 1. 目标

提供一个可上传到平台的 **HP-HMI 风格工业组态监控模板**：一个应用对应一个车间，把设备映射到画布上，每个设备经 MQTT 接收实时数据并动态展示（如罐体液位随数据涨落）。模板提供成套工业图元、schema 驱动渲染、实时数据接入，以及"查看 + 极简配置"的交互。

成功标准：上传一份 schema → 自动生成工艺图 → mock/真实数据驱动图元动态变化 → 点图元开停靠面板看详情并配置 topic 绑定 → 全程符合 HP-HMI 风格、长时间值守不疲劳。

## 2. 关键决策（已确认）

| 决策 | 选择 | 理由 |
|------|------|------|
| 风格锚点 | HP-HMI / ISA-101（参考图仅借布局，不复刻 OpenBridge） | 最契合"防视觉疲劳" |
| 主题 | 浅灰 / 深灰**双模式**可切换 | 白天车间 vs 暗房值守 |
| 渲染引擎 | **Canvas 2D**（起步；渲染层隔离，极限性能可下沉 WebGL） | 性能余地最大；用户知情选择 |
| 数据通道 | 浏览器**直连 MQTT over WebSocket**（mqtt.js） | 模板自治，最简 |
| 连接模型 | **单条共享连接**（顶栏统一控制），一设备绑**多 topic** | 所有 topic 复用同一连接 |
| 交互 | 查看 + 极简编辑；点图元 → **右侧停靠 Inspector**（非模态、不压暗画布） | HP-HMI 态势感知铁律 |
| 字段映射 | 支持 **JSONPath**（嵌套 JSON payload 取深层字段） | payload 常嵌套 |
| 现有 Drawer | **不复用**于 HMI（它是模态+蒙层+阴影，违背 HP-HMI）；新建 Inspector | 风格冲突 |

## 3. 状态语言规范（图元视觉编码 — 唯一来源）

平时画面干净中性，**异常才"跳"出来**，这是抗疲劳核心。颜色只留给报警。

- **填充深 = 通电/运行/流通；填充浅（描边） = 停止/关闭**
- **故障/报警** = 红环描边 + `!` 角标，**慢闪**（~1.1s 周期，不刺眼）
- **手动模式** = `M` 角标（中性深色）
- **联锁** = 锁角标（琥珀色）
- **失联/无数据** = 虚线描边 + 整体褪色 + `?` 角标
- **流向** = 管线上动画虚线随数据走（有流动画 / 无流静灰）
- 选中 = 青绿(`#2f8f83`)描边环 + 浅环晕，**不压暗其他元件**

色板（浅 / 深，最终以 `globals.css` token 为准，不在代码里写死）：

| 角色 | 浅 | 深 |
|------|------|------|
| 画布底 | `#d4d7da` | `#20242a` |
| 管线/描边 | `#545960` | `#8b929b` |
| 设备浅填充 | `#eef0f2` | `#2f353d` |
| 设备深填充(运行) | `#6b7178` | （对应深色档） |
| 液体/过程 | `#8fa0ad` | `#43525f` |
| 报警 | `#b0473d` | `#db6a5d` |
| 运行绿点 | `#4a9d6f` | （对应档） |
| 联锁琥珀 | `#b58a2e` | （对应档） |

## 4. 分层架构

```
┌─ 页面层 (React/DOM) ── monitor 路由组
│   顶栏(MQTT 连接控制 + 主题切换 + 时钟)  ·  停靠 Inspector(详情 + 绑定配置)
├─ 引擎层 (Canvas 2D)
│   CanvasStage + 渲染循环(rAF + 脏标记 + 动画集) · 视口(pan/zoom/fit)
│   命中检测(逆变换坐标 → 定位图元) · 主题桥(读 --tier0-* → JS 色板, 切换重绘)
├─ 图元层
│   符号注册表: type → { draw(ctx,node,state,theme), hitPath, ports, inlineFields }
│   设备 / 管线 / 仪表，每个图元一个文件
├─ 模型层
│   Schema(JSON + zod 校验) · 场景图(nodes/edges) · 选中态(不可变更新)
├─ 数据层
│   单条 mqtt.js(ws) · TagStore(topic→payload) · 绑定解析(topic + JSONPath → 值)
│   MockSource(同接口仿真兜底) · DataSource 接口(真实 ↔ mock 可切)
```

**与渲染后端的边界**：模型层 / 数据层 / Inspector 完全不依赖 Canvas。图元层的 `draw` 是 canvas 专用，但每个图元的"状态计算"（props → 视觉状态）是纯函数，可单测、可复用到未来其他后端。

## 5. 数据流（单向）

```
MQTT 消息 → TagStore 更新 → 绑定解析出受影响图元 → 标脏 → rAF 只重绘脏区
点击 canvas → 逆变换坐标 → 命中图元 → 选中态(不可变) → Inspector 显示/编辑
Inspector 改绑定 → 写回 Schema(内存, 返回新对象) → 重新订阅 → 标脏重绘
顶栏连接/断开 → 切换 DataSource(真实 mqtt ↔ mock)
主题切换 → 重读 token → 整屏重绘
```

**渲染循环节能**：rAF 仅在「有脏标记」或「存在活动动画（流动/慢闪）」时重绘；全静止时不烧 CPU（满足常驻大屏）。

## 6. Schema 定义

上传即生成图。客户端解析 + zod 校验，校验失败给出明确错误（行/字段），不静默吞。

```jsonc
{
  "meta": { "name": "1#车间反应釜", "version": 1 },
  "broker": { "url": "ws://broker.local:9001" },     // 顶栏可改，不写死
  "nodes": [
    {
      "id": "P-01", "type": "pump", "x": 240, "y": 110, "rotation": 0,
      "label": "P-01 离心泵",
      "topics": ["plant/1/unit-a/P-01/telemetry", "plant/1/unit-a/P-01/pressure"],
      "bindings": {                                    // 图元属性 ← topic + JSONPath
        "running": { "topic": "plant/1/unit-a/P-01/telemetry", "path": "status" },
        "rpm":     { "topic": "plant/1/unit-a/P-01/telemetry", "path": "rpm" },
        "fault":   { "topic": "plant/1/unit-a/P-01/telemetry", "path": "alarm.active" }
      },
      "inline": ["rpm", "running"]                     // 内联显示哪几项
    }
  ],
  "edges": [
    { "id": "e1", "from": "TK-01", "to": "P-01",
      "points": [[110,110],[150,110]],                 // 管线折线（极简编辑：作者给点）
      "flowBy": { "topic": "plant/1/unit-a/FT-01", "path": "flow" } }
  ]
}
```

- Schema 来源（首切片）：内置默认 schema + 运行时**上传**（文件选择，客户端解析校验）。
- Schema 持久化到 Postgres/drizzle = **后续子项目**，不在首切片。

## 7. 模块清单与文件组织

遵循 many-small-files（每文件目标 <400 行，硬上限 800）、不可变更新、显式错误处理、边界 zod 校验。

```
src/hmi/
  engine/
    canvas-stage.ts        # canvas 创建/DPR/resize(ResizeObserver)
    render-loop.ts         # rAF + 脏标记 + 动画集
    viewport.ts            # pan/zoom/fit + 坐标变换
    hit-test.ts            # 逆变换 + isPointInPath 命中
    theme-bridge.ts        # 读 --tier0-* → JS 色板, 主题切换订阅
  symbols/
    registry.ts            # type → 符号定义
    state-language.ts      # 状态→视觉编码（唯一来源, 纯函数）
    pump.ts valve.ts motor.ts fan.ts filter.ts damper.ts tank.ts switch.ts
    pipe.ts                # 直/转角/三通/交叉/方向/端点/连接点
    gauge.ts               # 首批 1 个代表仪表（条形/表盘）
  schema/
    schema.ts              # zod schema + 类型推导
    scene.ts               # schema → 场景图, 不可变操作
  data/
    data-source.ts         # DataSource 接口
    mqtt-client.ts         # 单条 mqtt.js(ws) + 重连
    mock-source.ts         # 仿真数据（正弦/随机游走）
    tag-store.ts           # topic→payload, useSyncExternalStore
    binding.ts             # topic + JSONPath → 值（含错误兜底）
  components/
    Topbar.tsx ConnectionControl.tsx ThemeToggle.tsx
    Inspector.tsx TopicBindingEditor.tsx HmiCanvas.tsx
src/routes/monitor.hmi.tsx # 页面装配（挂 monitor 路由组）
src/styles/globals.css     # 追加 HP-HMI 双模式 token
public/schemas/default.json# 内置示例 schema
```

## 8. 错误处理与输入校验

- **Schema 上传**：zod 校验，失败返回字段级错误并在 UI 提示；绝不渲染半张坏图。
- **MQTT**：连接失败/断开 → 顶栏状态置「断开」，自动指数退避重连；所有绑定图元转「失联」态。
- **绑定解析**：topic 未到 / JSONPath 取不到 / 类型不符 → 该图元「失联/无数据」态，不抛崩溃。
- **未知图元 type**：渲染占位符 + 控制台告警，不整图崩。
- 不用 `console.log` 调试残留；错误走统一日志封装。

## 9. 测试策略（TDD，≥80%）

- **单元**：状态语言映射、binding(JSONPath, 边界)、schema zod 校验、命中检测几何、tag-store 更新、scene 不可变操作、mock-source 序列。
- **集成**：mock 消息 → 图元状态变化；改 topic 绑定 → 重订阅生效；主题切换 → 色板切换。
- **E2E(Playwright)**：上传 schema → 渲染 → mock 驱动动态 → 点图元开 Inspector → 改绑定生效 → 切主题。

## 10. 平台集成注意

- 走 `monitor` 路由组（满屏看板、无滚动），鉴权复用现有 `getCurrentUser` 中间件。
- 资源路径经 `VITE_BASE_PATH` 前缀（沿用 `apiUrl()`），canvas/上传不写死路径。
- 新增依赖：`mqtt`（mqtt.js）。无需 WebGL/Canvas 库。

## 11. 风险与取舍

- **Canvas 代价**（已知情接受）：手写 DPR、命中检测、主题桥、重绘逻辑；以隔离换可维护性。
- **图元造型工作量**：首切片每类只做 1 个代表图元跑通；铺满全库是后续子项目。
- **管线自动布线**：首切片由 schema 显式给折线点；自动路由后置。

## 12. 验收标准（首切片 Done 的定义）

1. 上传/加载 schema → Canvas 渲出工艺图，浅/深主题均正确。
2. mock 数据驱动：罐体液位变化、泵运行/停止/故障态、阀开闭、管线流向动画。
3. 真实 broker（mqtt over ws）可连，顶栏控制连/断，断线转失联态并自动重连。
4. 点图元 → 停靠 Inspector 显实时值 + 多 topic 绑定，编辑回写生效（画布不被遮暗）。
5. 测试覆盖 ≥80%，E2E 主流程绿。
6. 全程符合 HP-HMI 状态语言（§3）。
```
