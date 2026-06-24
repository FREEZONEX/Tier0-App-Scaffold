---
name: hmi-interlock-authoring
description: Use when writing or editing HMI safety interlock rules in a mimic schema — "高压联锁", "low-low trips the pump", "lock the feed valve when level high", cross-device safety conditions, chained interlocks (A locks B locks C), or any interlocks[] entry. Covers the interlockRule schema shape (when/combine/then/onStale, ops, effect kinds), config-time validation (cycle + ref checks), and the critical truth that this version has NO runtime evaluator — rules are an audited config record, not a live safety actuator.
---

# HMI 联锁规则编写

把客户的安全联锁要求（「压力高就关进料阀」「低低液位跳泵」）写成 `mimic.interlocks[]`。真相源：`src/hmi/schema/schema.ts` 的 `interlockRuleSchema`。

## ⚠️ 头号事实：本版本没有运行时求值器

`interlocks` 规则**不会在运行时真的触发动作**。`src/hmi/interlock/` 只有两件组态期静态检查：
- `engine.ts` `detectInterlockCycles` —— 链式规则（`chainOn`）环检测
- `refs.ts` `validateInterlockRefs` —— 引用的 node id 是否存在

`buildScene`/`resolveNodeState`/`renderScene` **完全不读 interlocks**——条件越限不会自动关阀、效果角标不会动态出现。它是：**schema 级安全记录 + 组态期可校验 + 供审计/后续开发**，不是 PLC/SIS 级执行。

**交付红线**：照样把安全要求写进 `interlocks`（向前兼容、可校验），但**绝不向客户承诺运行时联锁动作**——真正的安全动作在 PLC/SIS/DCS 硬联锁层。交付说明里如实标注「已记录于 schema，本版本无运行时执行」。

## 字段速查

`interlockRule`：
| 字段 | 含义 |
|------|------|
| `id` | 唯一标识（必填，如 `IL-R101-PT-HI`） |
| `label?` | 人读名（「R-101 压力高联锁关进料阀」） |
| `when` | 单个条件对象，或条件数组（多条件） |
| `combine` | 多条件组合：`all`(默认) / `any` |
| `then` | 效果目标数组（至少 1 个） |
| `onStale` | 条件源失联时：`lock`(默认，故障安全) / `release` |

`when` 条件（`interlockCond`）：
| 字段 | 含义 |
|------|------|
| `node` | 读值来源节点 id |
| `field` | 读哪个值：特殊值 `fault`/`stale`/`running` 读标志位；其余读 `NodeState.values[field]`（即 binding key，如 `value`/`level`）。⚠️ 该字段必须是 source 节点**已配的 binding key**，否则 `values[field]` 为 `undefined`，数值比较恒不成立——写联锁前先确认条件源节点已绑该字段 |
| `op` | `>` `<` `>=` `<=` `==` `!=` `truthy` `falsy` `fault` `stale` |
| `value?` | 比较值；`truthy/falsy/fault/stale` 与 `chainOn` 时不需要 |
| `chainOn` | true=改读 source 节点「当前是否已被联锁」（A→B→C 链） |

`then` 效果（`interlockTarget`）：`{ node, kind }`，`kind` ∈ `lock`(通用闭锁角标) / `trip`(跳车) / `inhibit`(禁启) / `forceClose` / `forceOpen`。语义选最贴切的：「禁止开进料阀」用 `forceClose`（强制关）比泛 `lock` 准。

## Worked example

需求：「R-101 压力（PT-101 的 value）> 90 → 锁定进料阀 FV-101（禁开）」：
```json
{
  "id": "IL-R101-PT-HI",
  "label": "R-101 压力高联锁关进料阀",
  "when": { "node": "PT-101", "field": "value", "op": ">", "value": 90 },
  "then": [{ "node": "FV-101", "kind": "forceClose" }],
  "onStale": "lock"
}
```
多条件（任一满足即跳泵）：
```json
{
  "id": "IL-P201-TRIP",
  "when": [
    { "node": "LT-201", "field": "level", "op": "<=", "value": 5 },
    { "node": "P-201", "field": "fault", "op": "fault" }
  ],
  "combine": "any",
  "then": [{ "node": "P-201", "kind": "trip" }]
}
```

## 校验

写完过 `parseMimic`（zod，含 op 需 value 的 superRefine）+ `validateMimicAssets`（环检测 + 引用存在性，均非阻断告警，逐条裁决）。命令见 `$hmi-mimic-generation` 第 6 步。

## 坑速查

| 坑 | 真相 |
|----|------|
| 写了联锁就以为越限会自动关阀 | 无运行时求值器，规则不执行；安全动作在 PLC/SIS |
| `field` 填 payload 原始字段名 | `field` 读的是 `NodeState.values[key]`（binding key）/标志位，不是 MQTT 原始字段 |
| `op:">"` 不填 value | 比较类算子必须给 value，否则 parse 报错（truthy/falsy/fault/stale 才免） |
| 用 `lock` 表达「强制关阀」 | `forceClose`/`forceOpen` 语义更准；`lock` 是通用闭锁 |
| chainOn 链忘了会成环 | `detectInterlockCycles` 组态期会报，按提示拆环 |
| 向客户承诺联锁会动作 | 红线：本版本只记录+校验，明确告知执行在硬联锁层 |
