# AI：连接图 → 拓扑 schema

本文给「把一张设备连接图（P&ID/工艺图照片）映射成本模版 schema」的 AI 用。

## 核心原则：只产拓扑，不产状态

一张图给的是**静态拓扑**——有哪些设备、什么类型、怎么连。它**不包含也不应推断**运行态（开/关、运行/停）。运行态来自现场实时数据（MQTT），是**后续「数据绑定」步骤**的事。

所以 AI 的产出 =

- `nodes`：设备的 **type / id / 位置 / label**
- `edges`：设备间的**连线**（管线/信号线）
- `bindings`：**留空 `{}`**（数据绑定后配，见文末）

> ❌ 不要猜某个阀此刻是开是关、泵在不在转。
> ✅ 认出"这是个阀/泵/罐"，连对线，位置摆合理，就够了。无绑定时图元显示基线（去能量化）态，等后续绑数据点亮。

## 输出结构

```jsonc
{
  "meta": { "name": "<车间/单元名>", "version": 1 },
  "nodes": [
    { "id": "FV-101", "type": "valve", "x": 420, "y": 235, "label": "进料阀" }
    // bindings 省略 = {}（后配）
  ],
  "edges": [
    { "id": "e1", "from": "TK-101", "to": "FV-101", "points": [[132,235],[404,235]] }
  ]
}
```

- **坐标**：世界坐标，原点左上、y 向下；`x/y` 是图元中心。只需相对布局合理，视图会自动 fit 居中。
- **id**：全图唯一，建议用位号（FV-101、P-101）。
- **label**：中文设备名（可选，缺省用 id）。
- **edges.points**：折线，≥2 点；正交布线多给几个拐点；端点落到两端设备附近即可（渲染自动收口）。
- **仪表引线**：仪表（表盘/条形）连到被测设备的线，加 `"lead": true`，渲染为细虚线信号线。
- **rotation**：竖装/转向设备给 `"rotation": 90` 等。

## 图元类型目录

按图中设备外形/功能选 `type`（完整契约见 `src/hmi/symbols/capabilities.ts`）：

| type | 用于 | 后续可绑状态 |
|------|------|------|
| `tank` | 储罐（锥顶平底） | level |
| `vessel` | 反应釜/接收罐（带/不带搅拌，props.agitator） | level, running |
| `pump` | 离心泵 | running, rpm |
| `motor` | 电机 | running, rpm |
| `fan` | 风机 | running, rpm |
| `valve` | 阀门 | open |
| `damper` | 风门 | open |
| `switch` | 电气开关 | closed |
| `meter` | 流量计 | flow |
| `filter` | 过滤器 | dp |
| `exchanger` | 管壳式换热器 | temp |
| `condenser` | 冷凝器 | temp |
| `cooler` | 空冷器 | running, temp |
| `dialgauge` | 表盘仪表（props.face=P/T/ΔP） | value |
| `bargauge` | 条形仪表 | value |
| `column` | 精馏塔/塔器（高塔+塔盘） | level, temp |
| `drum` | 卧式分离罐/缓冲罐 | level |
| `silo` | 料仓/料斗（固体） | level |
| `compressor` | 压缩机 | running, rpm |
| `heater` | 加热器（加热盘管） | running, temp |
| `controlvalve` | 调节阀（带膜头执行器） | opening |
| `checkvalve` | 止回阀（单向） | open |
| `safetyvalve` | 安全阀/泄压阀(PSV) | open |
| `instrument` | ISA 仪表气泡（props.tag=FT/LT…，props.mount=field/panel） | value |
| `cyclone` | 旋风分离器（短圆柱+长锥体） | level |
| `mixer` | 管段静态混合器（纯结构件） | —— |
| `agitator` | 顶置搅拌器（独立图元） | running, rpm |

> 多数设备另支持通用状态 `manual`（手动 M 角标）。
> 故障由数值字段越 hi/hihi 限自动派生（红环 + `!` 角标），无需单独绑定 `fault` 位。
> 拿不准类型时选最接近的；未知 type 会渲染成占位 "?" 并在上传时告警。

## 后续：数据绑定（不在 AI 出图范围）

产出拓扑后，由人工或二次工具给每个设备的状态字段绑 MQTT topic：

```jsonc
{ "id": "FV-101", "type": "valve", "x": 420, "y": 235, "label": "进料阀",
  "topics": ["plant/FV-101"],
  "bindings": { "open": { "topic": "plant/FV-101", "path": "open" } } }
```

绑定 key 必须是该 type 契约内的字段（见上表 / capabilities.ts），否则上传时告警。运行时该 topic 的值驱动设备显示开/关。

完整字段规范见 [hmi-schema.md](hmi-schema.md)。
