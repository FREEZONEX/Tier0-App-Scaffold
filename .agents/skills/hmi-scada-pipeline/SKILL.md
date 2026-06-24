---
name: hmi-scada-pipeline
description: End-to-end pipeline for generating a customer's complete SCADA from their raw inputs — a P&ID / process diagram image (photo or screenshot), device-to-MQTT mapping information (the platform UNS namespace tree as the primary discovery source, plus customer documents like topic lists, payload samples, Excel/chat-log fragments), and operating requirements. Use as the ENTRY POINT whenever the task is "build the customer's SCADA/HMI from what they gave us"; it sequences and routes to $hmi-mimic-generation, $hmi-data-binding, $hmi-device-actions, $hmi-symbol-authoring and $hmi-app-delivery, and defines stage artifacts, reconciliation gates, and what to do when inputs are incomplete.
---

# HMI SCADA 流水线（客户原料 → 上线画面）

客户给的从来不是规整需求，而是：一张 P&ID 照片/截图、一份五花八门的设备-MQTT 映射资料（Excel/截图/聊天记录）、几句操作要求。本 skill 定义从这堆原料到上线 SCADA 的**阶段顺序、每阶段产物、对账关卡、缺料策略**。深度知识在各专项 skill，本 skill 只管编排——每阶段先读对应专项 skill 再动工。

## 开工盘点（缺什么标什么，不等齐料）

| 原料 | 有 | 缺 |
|------|----|----|
| 工艺图图片 | 走 Stage 1 识图 | 用文字描述/设备清单代替，先列盘点表请用户确认再画 |
| 设备→MQTT 映射 | 走 Stage 2 接线 | **缺文档 ≠ 缺映射**：UNS env 配了就从树里自动发现（首选识别源）；树也没有才走「照样交付」：拓扑 + 全员「未配置」虚化是合法中间产物 |
| 操作/角色/上线要求 | 走 Stage 3/5 | 后补，不阻塞 1–2 |

## Stage 1 识图出拓扑（专项：$hmi-mimic-generation + `docs/ai-image-to-schema.md`）

从图上读三样东西，**只产拓扑不产状态**（图上阀的开闭画法≠当前状态，禁止据此写 bindings）：

1. **设备清单**：逐台识别 → 对照 `capabilities.ts` 选 type；认不出的选最接近的并记入交付说明，**不要为一张图发明新 type**（确属目录无法表达再走 $hmi-symbol-authoring，且先问值不值得）
2. **位号/名称**：优先读图上文字（P-201、FV-201、设备铭牌）；图上没有就按 ISA 惯例造位号（泵 P-、调节阀 FV-、罐 T/TK-、变送器 LT/PT/FT-）并标注「位号系生成」
3. **连接关系**：管线=普通 edge，仪表引线=`lead:true`；交叉但不连通的管线别误连

**坐标换算**：不要照搬图片像素。保持图内**相对布局**（谁在谁左边/上面、主流向），按本库密度重标定——设备水平间距 130–150px、仪表偏移 70–120px（见 $hmi-mimic-generation 布局节）。横平竖直优先，照片透视/手绘歪斜要纠正。

**⛔ 对账关卡（识图错误在这里修最便宜）**：向用户输出「设备盘点表」——位号 | 识别类型 | 图上原貌描述 | 置信度（拿不准的标出来）+ 连线数，**经确认再进 Stage 2**。产物：topology-only schema，过 `parseMimic` + `validateMimicAssets`（命令见 $hmi-mimic-generation 第 6 步）。

## Stage 2 数据接线（专项：$hmi-data-binding）

**识别源优先级：UNS 树 > 客户映射文档 > watch 嗅探。**

1. **先归一成一张表**——`设备位号 | topic | payload 字段 | 语义/值域 | 样例值`，数据来源按优先级：
   - **UNS env 已配**（`TIER0_API_HOST`/`API_KEY`）：按位号逐台 search/browse UNS 树自动发现——topic=`UnsTopic.path`、字段及类型/单位=节点 `fields`、样例值=`readUnsFn` 当前值（调法见 $hmi-data-binding）。客户文档此时用于**交叉核对与补语义**（值含义/报警限），冲突以树为准并求证
   - UNS 未配/不可用：纯靠客户映射资料整理；没有样例 payload 的字段，语义按未知处理
2. **位号匹配**：图上位号和映射表位号常对不上（`P-201` vs `P201` vs `1#原水泵`）。匹配证据按硬度排序：**topic 字符串里的位号片段最硬**（`ws/plant7/r301/proc` ⇒ R-301）> 去连字符/去前导零 > 中文设备名对 label。**把整张对应关系表列给用户确认**——匹配错绑了比不绑危害大
3. 逐设备逐字段写 bindings：布尔按真实值域配 `test`/`testOff`，枚举用 `map`，量纲不是 0–100 的配 `scale`，故障位用 `alarms` 配方，值域不明的字段先挂 `watches` 观察不硬绑（全部规则见 $hmi-data-binding）。**映射字段在该设备契约里没有对应 key 时**（如温度挂在反应釜名下而 `vessel` 只有 level/running）：优先转绑图上相邻的仪表节点（温度→釜顶 TT `value`），其次挂 `watches`——除故障位配方外别硬绑契约外 key
4. 匹配不上/资料缺失的设备**留空**（未配置虚化），列入交付说明的「待接线清单」。❌ **绝不为了凑"已配置"而编占位 topic 假绑**——占位 topic 无数据→永远 stale，真 broker 下甚至满屏同值（详见 $hmi-data-binding 决策树 D）

**⛔ 关卡**：① 校验 + resolve-signal 干跑四态（正常值/越限/异常码/断流）；② **真 broker 接入时必跑 readUnsFn 回读所有绑定 topic 验真值**——查「有 topic 无返回值（占位/拼错）」「全设备同一个数（绑重或环境喂同值）」，命令与判定见 $hmi-data-binding §6。产物：full schema。

## Stage 3 操作下行（按需；专项：$hmi-device-actions）

客户要求里的「能启停」「能开关阀」→ `actions`；需要命令 topic 与 payload 格式——映射资料里通常只有状态上行，**命令格式要单独向客户要**，要不到就先不配并写入待办。

## Stage 4 落库与活体验收

客户 schema 写入 `src/hmi/data/default-mimic.json`（DB 已有旧图要先清 `mimics` 表，见 $hmi-mimic-generation 持久化节）→ `npm run dev:preview` 活体过：渲染无 "?"、绑定设备有数据在动（无 broker 时 mock 自动按 bindings 喂仿真数据，演示够用）、**各设备读数彼此各异且合理（满屏同一个数=绑重/占位/环境喂同值，回 Stage 2 §②关卡查）**、未配置设备虚化合理、连线两端贴齐设备无甩线/断线、按钮可点出确认弹窗、顶栏告警汇总栏（AlarmStrip）计数与现场越限一致。**先用 `$hmi-visual-selfcheck` 自检拿证据**（chrome-devtools 截图 + 点节点 + 读属性，本环境能亲看画布）再交用户做审美签收——别「AI 看不了」就盲发。活体里「该动的不动/不变色」按 `$hmi-runtime-troubleshooting` 分层定位。

## Stage 5 上线（专项：$hmi-app-delivery）

env/角色/base path/部署后五项验证，全按该 skill 走。

## 交付说明模板（每单必附）

- 位号对应关系表（图↔映射表↔schema）
- 识图低置信度项 + 位号系生成项
- 待接线清单（无映射设备）/ 待命令格式清单（无下行）
- 推断的报警阈值（待客户确认）
- 联锁已写入 schema 但**本版本无运行时求值**（安全动作在 PLC/SIS 层）

## 坑速查

| 坑 | 真相 |
|----|------|
| 一口气从图直接出带绑定的完整 schema | 识图和接线必须分阶段+各自对账，错误混在一起没法定位 |
| 图上阀画成关的就绑 open=false | 图示状态≠运行态，状态只来自 MQTT |
| 位号模糊匹配后不给用户看 | 绑错 topic 比不绑危害大，对应表必须过目 |
| UNS 可用却只啃客户 Excel | UNS 树是首选识别源（topic+字段 schema+当前值），文档用来核对补语义 |
| 映射资料不全就停工等客户 | 先查 UNS 树；树也没有→拓扑+未配置虚化是合法交付，先交再补 |
| 凑"已配置"编占位 topic 假绑 | 占位无数据→stale/满屏同值；匹配不上就留未配置+待接线清单（决策树 D） |
| 交付前不做真 broker 回读 | UNS 配了就跑 §6 回读验真值，查无值/全同值，否则看着配好实则死值 |
| 命令格式拿上行 payload 猜 | 下行格式必须单独确认，猜错会误操作设备 |
| 像素坐标直接进 schema | 相对布局保留、绝对间距按库惯例重标定 |
