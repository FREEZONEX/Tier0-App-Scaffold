# 图元显示真实工程值（去百分比 + 量程仅驱动视觉）— 设计

> 日期：2026-06-12 ｜ 状态：已实现（tsc/577 单测/7 E2E 全绿，dev:preview 实测罐体显示真实值）｜ 决策已与用户锁定

## TL;DR（大白话）

罐体/仪表现在显示的是 `60%` 这种**百分比**——因为绑定的 `scale:{min,max}` 把原始值**归一化成 0–100** 后既用于填充高度、又用于显示。

改成：图元显示**真实工程值**（如 `600`、`82.5`），**不强加单位**（温度无从判断 ℃/℉），绑定新增一个**可选 `unit` 字段由用户填**（填了才显示）。`min/max` 量程**只用来算视觉填充比例 / 仪表角度**，不再决定显示的数字。所有字段（含阀门开度 opening）一律显示真实值，不再有 %。

## 锁定决策

| # | 决策 | 结论 |
|---|------|------|
| 1 | 显示值 | **真实工程值**，不归一化为 % |
| 2 | 单位 | **不内置/不自动推断**（℃ vs ℉ 不可知）；绑定新增**可选 `unit`**，用户填，填了才显示 |
| 3 | 百分比量（opening 等） | **一律改真实值**，不保留 % 模式 |
| 4 | 量程 min/max | 仅用于**视觉填充比例 / 仪表角度**（不参与显示数值） |
| 5 | alarms 判阈 | 改判**原始值**（用户按工程量配阈值，更直觉） |

## 改动

- **`schema.ts`** — `bindingSchema` 加 `unit: z.string().optional()`。
- **`data/resolve-signal.ts`** — `ResolvedSignal` 加 `fraction?: number`（0–100，来自 scale）；`value` 改为保留**原始数值**（不再 `scaleValue`）；`alarms` 判阈改用原始 `n`。
- **`scene/scene.ts`** — `NodeState` 加 `fractions: Record<string, number>`（视觉比例）与 `units: Record<string, string>`（来自 `binding.unit`）；`resolveNodeState` 填充之。
- **`shared/coerce.ts`（或新 `symbols/fill.ts`）** — 助手 `fillPct(state, field)` = `state.fractions[field] ?? clampPct(state.values[field])`（无量程时按原值钳 0–100 兜底，保证旧测试/无配置仍工作）。
- **图元（9 个用 clampPct 的）** — `tank/drum/silo/vessel/column/cyclone/bargauge/dialgauge/controlvalve`：填充/角度改用 `fillPct`；其中 `tank/drum/silo/vessel` 的大号 `${pct}%` 文字改为 `formatInlineValue(field, value, unit)` 显示真实值+（可选）单位。
- **`symbols/inline.ts`** — `formatInlineValue(key, value, unit?)` 去掉内置 `UNIT` 表（不再 level→% / temp→℃）；有 `unit` 才追加；`inlineLine(node, state)` 传 `state.units[key]`。
- **`components/BindingEditor.tsx`** — 量程旁加「单位」文本输入（写 `binding.unit`）。
- **skill `$uns-swe-…`/data-binding** — 配置引导：填**工程量程 min/max + 单位**（容积/液位等），说明量程只驱动视觉、显示走真实值。

## 兼容与测试

- `fillPct` 兜底（无 fraction → clampPct(原值)）使无量程配置、组件预览页、既有 symbol 单测（直接喂 0–100 值）继续工作。
- 需更新：`resolve-signal.test.ts`（scale → 原始值+fraction、alarms 判原始）、`tank/drum/silo/vessel` 文字断言（%→真实值）、`inline` 单位用例。
- 验证：`tsc` + `npm test` + `eslint`；`dev:preview` 看罐体显示真实值、量程驱动填充。
