---
name: hmi-monitoring-alarms
description: Use when a customer wants historical trend playback ("回看最近几小时趋势"), alarm thresholds ("超 90% 报警"/"温度超 80 告警"), or operator alarm visibility ("一眼看出哪台在报警") on HMI devices. Covers the often-missed prerequisite that historical trends need the Tier0 UNS history API + platform archiving + TIER0_API_HOST/KEY env (mock has NO history), where alarm thresholds are authored (binding.alarms vs watch.alarms), and how breaches surface to operators (global AlarmStrip summary bar + per-node ring/badge + Inspector value color). For the full alarm/binding rules see $hmi-data-binding.
---

# HMI 监控 / 历史趋势 / 告警

客户的「能看历史趋势 + 超限要告警 + 操作员看得出哪台报警」这类诉求，配置散在三处。本 skill 把它串成单一答案，深规则下沉到 `$hmi-data-binding`（告警/绑定机制）与 `$hmi-app-delivery`（环境）。

## 历史趋势：先满足数据源前提（最易漏）

图元详情的「查看历史数据」走 `historyUnsFn`（`src/hmi/data/uns-api.ts`）→ Tier0 SDK `unsApi.openapiv1unshistory`（`POST /openapi/v1/uns/history`）。**前提**：

1. **Tier0 UNS 平台**提供该历史接口，且平台**已开启该 topic 的历史归档**（MQTT 数据落时序库）——这是平台侧能力，不是本应用能造的。
2. 环境变量 **`TIER0_API_HOST` + `TIER0_API_KEY`** 已配（部署走 `process.env`，dev 走 `VITE_TIER0_API_HOST`/`VITE_TIER0_API_KEY`）。
3. 设备配了 `bindings` 或 `watches`——趋势可选「数据值」来自这些**映射字段**（`node-topics.ts` 收集 binding/watch 的 path），没映射字段则趋势页显示「该图元无映射字段」。

**任一不满足**：历史对话框**静默降级**显示「未配置 UNS 历史数据源」，不报错不崩。**⚠️ mock 模式（无 `VITE_TIER0_MQTT_HOST`）只喂实时仿真、不产历史**——本地/无平台时历史趋势必然空，别误判为 bug。趋势聚合固定平均、间隔自动（点数 ≤1000）、表格全量分页（每页 10），这些都是自动的，无需配置。

交付提醒：要历史趋势就把「需 UNS 历史接口 + 归档 + API 凭证」写进交付前提；客户没有 Tier0 历史能力时，明说历史功能不可用（实时+告警仍正常）。

## 告警阈值：配在哪

| 字段在设备契约内？ | 配法 |
|---|---|
| 是（如 `vessel`/`tank` 的 `level`） | binding 加 `alarms`：`"level": { …, "alarms": { "hi": 90 } }` |
| 否（如温度——`vessel`/`tank` 契约**无 temp**，查 `capabilities.ts` 确认） | 挂 `watches` 并配 `alarms`：`{ "label":"温度", "topic":"…", "path":"temp", "alarms": { "hi": 80 } }` |

阈值判**原始值**；`path` 不可留空（空→取整条 payload→NaN→永不触发）。`hi`/`lo` → **warn**（琥珀稳定环）；`hihi`/`lolo` → **alarm**（红环闪 + `!` 角标 + 计入 fault）。完整算子/坑见 `$hmi-data-binding`。

## 操作员怎么一眼看出告警源

越限后**自动**生效，无需额外配置（三层，从全场到单值）：
- **全局告警汇总栏 AlarmStrip**（顶栏右上常驻）：status-by-exception——常态一颗低调绿「无报警」胶囊；有越限变红/琥珀计数胶囊「N 报警 · M 预警」（含 alarm 级时闪）。点开列全表，**点某条 → 选中并把画布居中那台设备**（`canvasRef.centerOn`），操作员不必满图扫。数据源：`activeAlarms(scene.nodes, getState)` 纯函数（`src/hmi/scene/active-alarms.ts`）跨 scene 聚合各节点 `levels`（绑定字段越限）+ `watchLevels`（watch 数据点越限），alarm 排 warn 前再按设备名/量名稳定排序。
- **画布**：该节点琥珀环（warn）/ 红环闪+`!`（alarm）。汇总栏管「全场哪几台」，节点环管「就是这台」。
- **检视面板**：打开设备详情，实时数据区**越限的那个值变色加粗**（alarm 红 / warn 黄）——`NodeState.levels`（绑定字段）+ `watchLevels`（数据点）驱动，落到「哪个量」越限。

## 坑速查

| 坑 | 真相 |
|----|------|
| 「配了 bindings 就有历史趋势」 | 错。历史要 UNS history 接口 + 平台归档 + `TIER0_API_HOST/KEY`；mock 无历史 |
| 历史对话框空就当 bug | 未配数据源时静默显示「未配置 UNS 历史数据源」，先查上面 3 前提 |
| 把 temp 直接塞进 vessel 的 bindings | vessel/tank 契约只有 level（查 capabilities.ts）；契约外工艺量走 watch+alarms |
| watch 配 alarms 但 path 留空 | 取整条 payload→NaN→阈值永不触发，path 必填具体字段 |
| 越限了汇总栏却没列 | AlarmStrip 只聚合配了 `alarms` 的 `levels`/`watchLevels`；没配阈值的字段不进栏（与环/角标同源）。stale 节点 levels 空→不产告警 |
