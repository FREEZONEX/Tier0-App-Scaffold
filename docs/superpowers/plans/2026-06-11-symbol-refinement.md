# 图元造型精致化 实现计划（Plan 2/2）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**TL;DR（给评审者）**：27 个图元保持扁平灰阶风格，重画比例和细节（罐有封头支腿、泵有蜗壳、电机有散热筋……），分 5 批交付，每批改完用组件预览页截图给用户对比验收。引擎先加两个能力：曲线图元（画封头/蜗壳用）和缩放感知（缩小时自动隐细节）。

**Goal:** 实现 spec（`docs/superpowers/specs/2026-06-11-device-action-buttons-and-symbol-refinement-design.md`）第 2 部分 §3.1–§3.4。

**Architecture:** 先扩引擎（`path` 图元 + `SymbolContext.scale` LOD），再按品类分 5 批重画 symbol 的 `build`/`bounds`。状态层（深浅填充/装饰）与既有测试断言保持兼容。

**Tech Stack:** Canvas 2D 图元 IR、node:test。绘制代码属创意工作——**本计划锁规格与验收标准，具体几何代码由执行者现场创作**（预写在计划里无法验证视觉效果，以截图验收为准）。

**全批共用绘制规范（每个图元必须遵守）**：
1. 外轮廓 `strokeWidth: 2`、`theme.stroke`；细节层 `strokeWidth: 1~1.25`、`theme.textMuted`（低对比，缩小自然弱化）
2. 细节层一律包裹 `if (showDetail(scale))`（LOD）；基础形体 + 状态层任何缩放都画
3. 状态视觉逻辑不变：激活=fillDeep / 静止=fillLight / 液位=liquid clip / 装饰层不动——**绝不让细节抢异常色**
4. 不用渐变/阴影/高光/固有色（扁平灰阶）
5. `bounds` 随新造型精确更新（连线贴边、命中、背板都依赖它）；锚点 `node.x/y` 保持视觉居中；`labelAndInline` 的 `belowY` 同步新底边
6. 既有测试中「状态→填充」断言必须继续成立；特征断言按新造型更新

---

### Task 0a: 引擎——`path` 曲线图元

**Files:**
- Modify: `src/hmi/engine/primitives.ts`
- Modify: `src/hmi/engine/painter.ts`
- Create: `src/hmi/engine/painter-path.test.ts`

- [ ] **Step 1: 写失败测试**（painter-path.test.ts，用 mock ctx 记录调用——参照仓库 painter 现有测试若有，否则用以下独立 mock）：

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { paint } from "./painter";
import type { Primitive } from "./primitives";

function mockCtx() {
  const calls: string[] = [];
  const rec = (name: string) => (...args: unknown[]) => { calls.push(`${name}(${args.map((a) => (typeof a === "number" ? Math.round(a * 100) / 100 : a)).join(",")})`); };
  return {
    calls,
    beginPath: rec("beginPath"), moveTo: rec("moveTo"), lineTo: rec("lineTo"),
    bezierCurveTo: rec("bezierCurveTo"), quadraticCurveTo: rec("quadraticCurveTo"),
    arc: rec("arc"), closePath: rec("closePath"), fill: rec("fill"), stroke: rec("stroke"),
    rect: rec("rect"), roundRect: rec("roundRect"), clip: rec("clip"), fillText: rec("fillText"),
    save: rec("save"), restore: rec("restore"), translate: rec("translate"), rotate: rec("rotate"),
    setLineDash: rec("setLineDash"),
    set globalAlpha(_v: number) {}, set strokeStyle(_v: string) {}, set fillStyle(_v: string) {},
    set lineWidth(_v: number) {}, set lineCap(_v: string) {}, set font(_v: string) {}, set textAlign(_v: string) {},
    set lineDashOffset(_v: number) {},
  } as unknown as CanvasRenderingContext2D & { calls: string[] };
}

describe("painter path 图元", () => {
  it("按指令序列绘制 M/L/Q/C/A 并 fill+stroke", () => {
    const ctx = mockCtx();
    const p: Primitive = {
      kind: "path",
      d: [
        { c: "M", x: 0, y: 0 },
        { c: "L", x: 10, y: 0 },
        { c: "Q", x1: 15, y1: 5, x: 10, y: 10 },
        { c: "C", x1: 5, y1: 12, x2: 2, y2: 12, x: 0, y: 10 },
        { c: "A", cx: 0, cy: 5, r: 5, a0: Math.PI / 2, a1: -Math.PI / 2 },
      ],
      close: true,
      style: { fill: "#eee", stroke: "#555", strokeWidth: 2 },
    };
    paint(ctx, [p], 0);
    const s = (ctx as unknown as { calls: string[] }).calls.join(";");
    assert.ok(s.includes("moveTo(0,0)"));
    assert.ok(s.includes("quadraticCurveTo(15,5,10,10)"));
    assert.ok(s.includes("bezierCurveTo(5,12,2,12,0,10)"));
    assert.ok(s.includes("arc("));
    assert.ok(s.includes("closePath"));
    assert.ok(s.includes("fill(") || s.includes("fill()"));
    assert.ok(s.includes("stroke"));
  });
});
```

- [ ] **Step 2: 跑确认失败**——`node --import tsx --test src/hmi/engine/painter-path.test.ts`（类型错误即失败）
- [ ] **Step 3: primitives.ts 加类型**（追加到 `Primitive` union 与文件顶部）：

```ts
/** path 指令：M/L 直线、Q/C 贝塞尔、A 圆弧（canvas arc 语义）。 */
export type PathCmd =
  | { readonly c: "M"; readonly x: number; readonly y: number }
  | { readonly c: "L"; readonly x: number; readonly y: number }
  | { readonly c: "Q"; readonly x1: number; readonly y1: number; readonly x: number; readonly y: number }
  | { readonly c: "C"; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly x: number; readonly y: number }
  | { readonly c: "A"; readonly cx: number; readonly cy: number; readonly r: number; readonly a0: number; readonly a1: number; readonly ccw?: boolean };
```

union 追加：

```ts
  /** 曲线路径（封头椭圆弧/蜗壳螺线等）：按指令序列描线，close 后可填充。 */
  | { readonly kind: "path"; readonly d: readonly PathCmd[]; readonly close?: boolean; readonly style: Style }
```

- [ ] **Step 4: painter.ts 加 case**（在 `case "polygon"` 之前插入）：

```ts
      case "path": {
        ctx.beginPath();
        for (const cmd of p.d) {
          if (cmd.c === "M") ctx.moveTo(cmd.x, cmd.y);
          else if (cmd.c === "L") ctx.lineTo(cmd.x, cmd.y);
          else if (cmd.c === "Q") ctx.quadraticCurveTo(cmd.x1, cmd.y1, cmd.x, cmd.y);
          else if (cmd.c === "C") ctx.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, cmd.x, cmd.y);
          else ctx.arc(cmd.cx, cmd.cy, cmd.r, cmd.a0, cmd.a1, cmd.ccw ?? false);
        }
        if (p.close) ctx.closePath();
        if (applyFill(ctx, p.style)) ctx.fill();
        if (applyStroke(ctx, p.style)) ctx.stroke();
        break;
      }
```

  同时检查 `scene-render.ts applyStale`：path 走默认分支（有 style），无需改动。
- [ ] **Step 5: 跑测试通过 + Commit**——`git add src/hmi/engine/ && git commit -m "feat(hmi): 引擎支持 path 曲线图元"`

### Task 0b: 引擎——SymbolContext.scale 与 LOD

**Files:**
- Modify: `src/hmi/symbols/registry.ts`
- Create: `src/hmi/symbols/lod.ts`、`src/hmi/symbols/lod.test.ts`
- Modify: `src/hmi/symbols/scene-render.ts`、`src/hmi/components/HmiCanvas.tsx`

- [ ] **Step 1: lod.test.ts**（失败测试）：

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { showDetail, DETAIL_MIN_SCALE } from "./lod";

describe("LOD", () => {
  it("scale ≥ 0.7 显示细节；更小隐藏；未传视为 1（组件预览/测试场景）", () => {
    assert.equal(showDetail(1), true);
    assert.equal(showDetail(DETAIL_MIN_SCALE), true);
    assert.equal(showDetail(0.5), false);
    assert.equal(showDetail(undefined), true);
  });
});
```

- [ ] **Step 2: 跑确认失败**，**Step 3: 写 lod.ts**：

```ts
/** 细节层 LOD 阈值：viewport 缩放低于此值时图元只画基础形体（千级节点缩小后保持干净 P&ID）。 */
export const DETAIL_MIN_SCALE = 0.7;

/** 是否绘制细节层。scale 未传（组件预览页/单测）视为 1:1。 */
export function showDetail(scale: number | undefined): boolean {
  return (scale ?? 1) >= DETAIL_MIN_SCALE;
}
```

- [ ] **Step 4: 串联**——`registry.ts` 的 `SymbolContext` 增 `readonly scale?: number;`；`scene-render.ts` 的 `renderScene` 增可选参数 `scale?: number`，`def.build({ node, state, theme })` 改为 `def.build({ node, state, theme, scale })`；`HmiCanvas.tsx` 调 `renderScene` 处传入当前 viewport 缩放（viewport 模块既有 scale 值，按文件内现名取用），并确认缩放变化已触发重绘（pan/zoom 本就重绘，无需新增）
- [ ] **Step 5: 验证 + Commit**——`npm test` 全绿（既有 build 调用不受可选参数影响）；`git add -A src/hmi && git commit -m "feat(hmi): SymbolContext.scale 与 LOD 阈值"`

---

### Task 1–5: 五批图元重画（规格驱动，流程同构）

> **每批统一流程**（以下五个任务各自执行一遍）：
> - [ ] Step 1: 按「特征规格」重画该批每个图元的 `build`（现场创作几何代码，遵守全批绘制规范；细节层包 `showDetail(ctx.scale)`），同步校准 `bounds` 与 `labelAndInline` 的 `belowY`
> - [ ] Step 2: 更新该批每个图元的 `*.test.ts`——保留既有「状态→填充」断言（如运行=fillDeep）；按新造型更新/新增特征断言（如「封头为 path 图元」「支腿 ≥2 条线」「细节层在 scale=0.5 时不输出」——后者断言 `build({...ctx, scale: 0.5})` 的图元数少于 `scale: 1`）
> - [ ] Step 3: `npm test` 全绿 + `npx tsc --noEmit` + eslint 改动文件
> - [ ] Step 4: 浏览器验收——`npm run dev:preview` 开 `/components` 组件预览页，截「改前 vs 改后」对比图给用户确认（**用户确认通过才算完成**；有意见按反馈修改后重新截图）
> - [ ] Step 5: Commit——`git commit -am "feat(hmi): 图元精致化第 N 批——<品类>"`

### Task 1: 容器批（tank / vessel / column / drum / silo / cyclone）

**特征规格**：
- `tank` 储罐：壳体宽高比≈0.8、拱顶（path 椭圆弧封头替代锥顶直线）、顶部中心接管短管、底部 2 支腿（细节层）、壁面 1-2 道焊缝横细线（细节层）、液位 clip 区域随新轮廓
- `vessel` 反应釜：上下椭圆封头（path）、内侧夹套第二轮廓线（细节层）、顶部搅拌口短管、底部 2 支腿；`agitator` prop 造型保留
- `column` 精馏塔：细长比 h/w ≥ 3.5、上下椭圆封头、塔盘横细线 5 道（细节层）、底部裙座（梯形）、侧面进料/回流 2 短管（细节层）
- `drum` 卧式罐：水平胶囊（两端半圆 arc 封头）、底部 2 鞍座（细节层）、顶部接管、液位 clip
- `silo` 料仓：圆柱 + 60° 锥斗、锥底卸料短管、3 支腿画 2（细节层）、顶部小除尘口（细节层）
- `cyclone` 旋风分离器：短圆柱 + 长锥（锥长≈2×柱高）、切向入口矩形（左上）、顶部升气管（中心上伸）、锥底卸料口

### Task 2: 旋转设备批（pump / motor / fan / compressor / agitator）

**特征规格**：
- `pump` 离心泵：蜗壳螺线轮廓（path Q/A 半径渐扩，替代正圆）、切向出口保留并与蜗壳相切、底座垫块（细节层）、中心轴端小圆（细节层）；`circular` 标志改 false 时必须同步 hit/背板行为验证（蜗壳近圆可保留 circular=true + bounds 仍方形，二选一在实现时定并在测试断言）
- `motor` 电机：机身圆角矩形 + 端盖竖线、顶部接线盒小方块、散热筋 4 道横细线（细节层）、右侧轴伸短粗线
- `fan` 风机：蜗壳曲线（path）+ 切向出风口矩形、进风侧圆 + 3 叶叶轮示意（细节层）
- `compressor` 压缩机：楔形机壳保留、进出口管嘴上下错位、底座（细节层）
- `agitator` 搅拌器：电机箱 + 减速箱两级矩形、轴线、双层桨叶（上直叶/下斜叶，细节层第二层）

### Task 3: 执行器批（valve / controlvalve / checkvalve / safetyvalve / damper / switch）

**特征规格**：
- `valve` 阀门：蝶形双三角保留、加竖直阀杆 + 顶部手轮（横线帽，细节层）
- `controlvalve` 调节阀：膜头改半圆拱（path arc）+ 膜片横线、阀杆、侧挂定位器小方块（细节层）
- `checkvalve` 止回阀：阀体双三角 + 铰链摆瓣（斜短线 + 铰点小圆，细节层）、流向箭头保留
- `safetyvalve` 安全阀：现有弹簧/箭头保留、加杠杆柄斜线（细节层）、阀体比例微调
- `damper` 风门：风道矩形 + 叶片保留、外挂执行机构小盒 + 连杆（细节层）
- `switch` 电气开关：刀闸造型——固定触点小圆×2 + 可动刀片线，闭合平直/断开抬角加大，端子引线（细节层）

### Task 4: 换热静设备批（exchanger / condenser / cooler / heater / filter / mixer）

**特征规格**：
- `exchanger` 管壳换热器：壳体 + 两端管箱（椭圆弧封头 path）+ 管板竖线×2、内部折流板 3 道交错竖细线（细节层）、上下 4 管嘴
- `condenser` 冷凝器：立式壳体椭圆封头、顶部汽入口大管嘴、底部液出小管嘴、内部管束 3-4 竖细线（细节层）
- `cooler` 空冷器：顶置风机圆 + 叶片示意、管束水平细线层（细节层）、支架腿
- `heater` 加热器：现有锯齿盘管保留、外壳圆角矩形 + 2 支腿（细节层）、进出口管嘴加法兰短竖线（细节层）
- `filter` 过滤器：立式壳体 + 内部滤芯竖纹 3 道（细节层）、上进下出管嘴、快开顶盖横线
- `mixer` 静态混合器：管段 + 交叉元件保留、管段两端法兰对竖线（细节层）

### Task 5: 仪表批（meter / dialgauge / bargauge / instrument）

**特征规格**：
- `meter` 流量计：表体圆 + 两侧法兰对（双竖短线，细节层）、表面读数窗小矩形
- `dialgauge` 表盘仪表：刻度弧（path A 弧 + 刻度短线 5 道，细节层）、指针根部小圆、底部表座
- `bargauge` 条形仪表：边框 + 右侧刻度短线 4 道（细节层）、填充逻辑不变
- `instrument` ISA 气泡：**标准符号不改造型**（ISA-5.1 规范形），仅统一线宽（外圈 2、内线 1.25）与字号

---

### Task 6: 收尾——设计文档与全量回归

**Files:**
- Modify: `docs/hmi-design-spec.md`

- [ ] **Step 1: 设计文档**——§7.1 标注「✅ 已落地（2026-06）」并补一行实施摘要（三层结构 + path + LOD 0.7）；§7.5 排期勾掉 P1 图元拟真
- [ ] **Step 2: 全量回归**——`npx tsc --noEmit` + `npm test` + `npm run e2e` 三绿；dev:preview 整图截图（25 设备默认画布）做最终视觉验收
- [ ] **Step 3: Commit**——`git add docs/ && git commit -m "docs: 设计文档标注图元精致化落地"`

---

## 自审记录

- spec 覆盖：§3.1 标准→全批绘制规范；§3.2 引擎→Task 0a/0b；§3.4 分批→Task 1-5（spec §3.4 表的 27 个图元全数出现在批次规格里）；§3.3 告警条→在 Plan 1 Task 11 实施（本计划不重复）✓
- 绘图代码现场创作的边界已显式声明（规格+验收锁定质量，预写几何代码无意义）——这是有意决策，不是占位符
- 类型一致性：`PathCmd`/`path` kind/`showDetail`/`DETAIL_MIN_SCALE`/`SymbolContext.scale` 全计划统一 ✓
- 依赖顺序：Task 0a/0b 必须先于 Task 1-5；Plan 1 与 Plan 2 互不依赖，可并行（scene-render 在两计划都有改动，若并行需先合 Plan 1 的 Task 6 再做 Plan 2 Task 0b，或顺序执行规避冲突——**推荐顺序执行：先 Plan 1 后 Plan 2**）
