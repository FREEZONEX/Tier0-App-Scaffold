---
name: hmi-visual-selfcheck
description: Use when you need to verify an HMI/SCADA canvas change actually rendered and works — symbol shapes/colors/layout, Inspector panel content, dialogs (history/actions), alarm rings, real-time data movement — and you're about to defer to the user with "AI can't see the canvas". This environment CAN drive a browser via chrome-devtools MCP: launch dev:preview, screenshot the Canvas 2D, select nodes with synthetic pointer events, read data-* attributes. Use to self-verify before claiming a UI change works, instead of shipping blind. For pure layout/connection/overlap/collision checks (no live data or interaction needed), prefer the faster offline buildScene→renderScene→PNG path — node-box overlap + edge-collision detection without a browser or DB.
---

# HMI 画布可视自检（chrome-devtools）

**核心纠偏：本环境能亲眼看画布、能驱动交互。** 旧 skill 里「AI 看不了渲染，必须用户过目」已过时——你有 chrome-devtools MCP，可起 dev、截图、点节点、读状态。视觉/交互改动**先自检拿到证据，再交付**；别一句「我看不了」就推给用户。用户过目是最终签收，不是你跳过自检的借口。

但画布是 **Canvas 2D**：图元不是 DOM 元素，`getByTestId`/`click(uid)` 点不中节点——必须用**合成指针事件**按坐标命中。这套手法不显然，是本 skill 的主体。

## 什么时候用

- 改了图元造型/颜色/LOD/布局、Inspector 面板、历史或操作对话框、告警圈/闪烁、实时值显示——交付前自检。
- 你正想写「视觉效果请用户确认」——停，先按本 skill 拿截图与 data 属性证据。
- 排查「点了没反应/面板不出」的交互问题（与 $hmi-runtime-troubleshooting 配合）。

不适用：纯数据层/纯函数逻辑（那些 `node --import tsx --test` 就够，不必起浏览器）。

## 离线渲染自检（布局/连线/重叠/重合——首选，免起浏览器）

**改了 mimic 的布局/连线（节点坐标、edge、`fromSide`/`toSide`、自由点）→ 先用这个，别上来就起 `dev:preview`。** 它直接调 `buildScene`→`renderScene` 拿**真实节点框 + 连线折线 `edgePaths`**，脚本判重叠/重合、`rsvg-convert` 出 PNG 肉眼看：**不连 DB、不污染默认图、秒级、可断言**。浏览器法（下文标准流程）留给离线拿不到的：实时数据流动、交互（选中/拖拽/对话框）、角色差异、告警闪烁。

**① 渲染成 PNG 看布局**（节点框按 type 上色 + 位号 + 连线，lead 画虚线）。核心：

```ts
// node --import tsx render.mts <mimic.json> <out.svg>   (import 用项目文件的绝对路径)
const m = parseMimic(JSON.parse(fs.readFileSync(argv[2],"utf8"))).data;
const sc = buildScene(m), reg = createDefaultRegistry();
// ⚠️ 喂样本数据（任意 path → 数字），让 inline 值真显示出来；用 ()=>undefined 会全空框，
//    就分不清「该位置本就没配 binding/inline（漏配 bug）」还是「只是没数据」。
const sample = () => new Proxy({}, { get: () => 50 });
const st = (id) => resolveNodeState(sc.byId[id], sample);
const res = renderScene(sc, reg, st, ()=>false, PALETTES.light);
// ⚠️ 节点框 = bounds 再按 sizeX/sizeY 围绕中心缩放（与 renderScene connectBox 同法）；
//    漏缩放会把塔等 sizeY 大的画矮，误判布局！
const boxOf = (n) => { const b=reg.get(n.type).bounds(n), sx=n.sizeX??1, sy=n.sizeY??1;
  return { x:n.x-(n.x-b.x)*sx, y:n.y-(n.y-b.y)*sy, w:b.w*sx, h:b.h*sy }; };
// 拼 SVG：res.edgePaths → <polyline>（lead 边查 mimic.edges[id].lead → stroke-dasharray）；
//   每节点 → <rect>/<circle>(boxOf) + <text> 顶部 n.id + <text> 下方画 inline 字段的样本值
//   （取 st(n.id).values[field]，field ∈ n.inline）——这样**能看出每个该显值的位置是否真配了
//   binding+inline**：画出空白 = 漏配（无空元件铁律违例），画出数字 = 配对了。fs.writeFileSync 后 rsvg。
```
`rsvg-convert -w 1650 out.svg -o out.png`（librsvg，比 ImageMagick 稳；macOS `brew install librsvg`）。Read PNG 对照源图。

⚠️ **离线图会骗你——线穿设备它显得无所谓**：离线 SVG 把引线画得很细，「线从设备本体穿过」看着只像「擦了个框角」，于是容易被当「可接受」放行；但**真 Canvas 上管线/引线是粗线，穿过设备 = 一条线把设备劈成两半，极丑**。所以：①脚本报的 `CROSS` **一律当真、挪到 0**，禁止凭离线图判「可接受」；②控制回路/仪表↔阀连线改完，**务必在真 Canvas（下方 chrome-devtools 流程）截图复核**——离线图只用于快速定位，**真 Canvas 才是验收依据**。实战教训：曾凭离线图把 6 处「擦框角」放行，真 Canvas 上是引线直接穿透换热器，被用户多次打回。

**② 脚本判重叠 + 重合**（`OVERLAP` 必须 0；`COLLIDE` 逐条裁决）：

```ts
const boxes = sc.nodes.map(n => ({ id:n.id, b: /* boxOf(n) 再把顶部 label 占位算进：y-=20、宽取 max(w, id.length*8) */ }));
// OVERLAP：两两 AABB 相交 min 边 >4px → 报（含 label 框）
// COLLIDE：把每条 edgePaths 拆水平/垂直段；不同 edge 的同向段、中心坐标差≤3px、投影范围相交>10px → 报
```
- `OVERLAP > 0` **必修**（元件零重叠铁律）——挪节点拉开。
- `COLLIDE` 逐条看：**lead 被 pipe 盖 / 两根 lead 同向 / 两条独立物流叠 → 修**（挪仪表分叉、测量线改自由点竖直插管、枢纽多管加 `fromSide`/`toSide`）；**落在某节点本体框内的共干段（如多管共用塔中线、被塔体盖住）→ 忽略**（过滤掉两端都在同一节点框内的段）。

**③ 线穿无关元件检测**（管线/引线不得压着无关设备过去 = 构图清晰铁律）：对每条 `edgePaths` 的每一段，检查它是否穿过某个**非自己端点**节点的本体框 → 报 `CROSS`。这种「线从设备本体中间穿过」让人看不清谁连谁，挪线或挪元件消除。

```ts
for (const ep of res.edgePaths) for (const seg of segsOf(ep))         // 拆水平/垂直段
  for (const n of sc.nodes)
    if (ep.from !== n.id && ep.to !== n.id && segHitsBox(seg, boxOf(n)))
      console.log("CROSS", ep.id, "穿过", n.id);                       // 端点不算，穿身才报
```
`OVERLAP`（元件叠元件）+ `CROSS`（线穿元件）都要清零——这俩直接决定「图能不能一眼看懂」。

**④ 平行贴近检测（`PARALLEL` = 双线/铁轨观感——用户最在意，比共线重合更隐蔽，原检测会漏）**：两条**同向**段，垂直间距 4–30px、投影重叠 >40px → 报 `PARALLEL`。它不是"共线重合"(`COLLIDE` 抓的 ±3px 正叠)，但视觉上是并排双线、一样难看。两个都要查。
```ts
for 同向段对 (s,t): const gap=|s.c-t.c|; if (4<=gap<=30 && 投影重叠>40 && !两端都在某节点内) report("PARALLEL", s.id, t.id);
```
消除：把两条分到**差≥40px 的不同高度**，或让其中一条**先垂直离开**再转（如侧线采出从塔出来先竖直下行、再去冷却器，而不是与回流同高并行一长段）。实战：回流(y575)与侧线(y560)平行 213px → 把侧线下游设备移到塔的更下方，侧线 dy>dx 即自动先竖直，并行消失。

**⑤ 自由端点零空隙检测（`GAP`）**：每个 `lead` 的自由端点(`fromPoint`/`toPoint`)到**最近管线段**的距离必须 ≈0；>3px = 浮空留缝。脚本算点到所有 pipe 段的最小距离，>3 报警并给出**应贴到的真坐标**(线上最近点)，直接按它改。
```ts
for 每个 lead 自由端点 pt: const {d,c}=最近pipe段距离(pt); if (d>3) report("GAP", pt, "应贴到", c);
```
⚠️ 自由点坐标**别凭估**——估的几乎必有几 px 缝（实测 FIC 测量线估 y575、真管在 y570，差 5px 浮空）；用脚本算真坐标贴上去。

> **判读铁律**：`OVERLAP`/`PARALLEL`/`CROSS`/`GAP` **一律挪到 0**。`COLLIDE` 仅保留 **≤15px 且在某节点边的「多管交于一容器」汇合**（如回流+侧线交于塔右出口点、冷凝液+压力测量交于回流罐——容器本就多接口，万不得已）；其余 `COLLIDE`（尤其长段、空白区）也要清。另：阀/终端**顺序要顺流向**——若 `V` 在阀右、出口又在更右，气体会「左拐到阀又右拐去出口」自叠（倒流重合）；把阀放到流向顺位（V→阀→出口单调同向）。

**④ 照图还原度自查清单（逐维对照源图找差距——render 还原任何工业图都跑一遍）**：

| 维度 | 怎么核 | 不合格 = |
|---|---|---|
| 组件类型对 | 每个源图符号是否选了**最像形状**的 type（卧式换热≠立冷凝≠空冷；调节阀≠手阀≠止回；内联流量计≠引线变送器）| 类型错=画面失真，回 `capabilities.ts` 全表重选 |
| 文字齐 | 源图文字逐条圈过 → 位号/介质名/工段名/塔盘温度都落到 `label`/`terminal`/`watches`/`readout` 了？| 漏文字=还原不完整 |
| 数值显 | 渲染喂样本后，每个该显值的元件**真画出了数字**（非空框）| 空框=漏配 `binding`/`inline` |
| 连线语义对 | 每条 instrument 线落对对象（流量→管段 / 液位→容器 / 控制→阀，不就近乱连）| 连错=工艺逻辑错 |
| 塔等比 | `column` 的 `sizeX == sizeY` | 非等比=变形失真 |
| 零重叠零穿越 | `OVERLAP`/`CROSS` = 0，塔体外 `COLLIDE` 清 | 否则缠成一团看不清 |
| 与原图一致 | 布局区位、设备朝向、拓扑同源图 | 偏离=不像 |

逐维过一遍，差距一目了然——这就是「自己对照原图找差距」的可执行方法，别凭感觉说"差不多"。

> 实战：照图重排后用此法一轮就定位「塔右 6 条管全收口 y=塔心叠成束」「FIC 控制+测量两 lead 同向贴走」「自由点没压在回流管上」——这些截图低倍根本看不出，脚本逐对报得明明白白。改完重跑到 `OVERLAP=0`、塔体外 `COLLIDE` 清干净，再交付/截图。

## 标准流程

```dot
digraph selfcheck {
  rankdir=TB; node [shape=box];
  start [label="起 dev:preview（后台）+ 轮询 5173 就绪"];
  nav [label="chrome-devtools navigate → 等水合（wait_for 顶栏文字）"];
  shot [label="截图看整体 + 读 data 属性验证细节"];
  node [label="要验图元详情？合成指针点中节点（见下）"];
  verify [label="读 data-testid/data-status/computed style 拿硬证据"];
  clean [label="收尾：清测试数据 + 杀 5173 dev server"];
  start->nav->shot->node->verify->clean;
}
```

### 1. 起服务（务必后台 + 就绪轮询）

```bash
(npm run dev:preview > /tmp/hmi-dev.log 2>&1 &); \
for i in $(seq 1 40); do curl -sf http://localhost:5173 >/dev/null 2>&1 && { echo UP; break; }; sleep 1; done
```

要测 **operator 等非 admin 角色**：dev:preview 默认注入 admin，需自起带角色 env 的 vite（先 `pkill -f "vite dev"` 清旧实例，否则端口占用旧 admin 进程，你以为切了角色其实没切——这是真踩过的坑）：

```bash
PREVIEW_USER_ID=dev-op PREVIEW_USER_NAME="Op" PREVIEW_USER_ROLE=operator \
SESSION_SECRET=dev-secret-0123456789abcdef0123456789abcdef \
nohup npx vite dev --host 0.0.0.0 --port 5173 > /tmp/hmi-op.log 2>&1 &
```
浏览器侧若残留旧 session cookie，先 `fetch('/api/auth/logout',{method:'POST'})` + 清 `mes-session` cookie 再 reload，否则网关优先信 cookie，角色不变。验 `fetch('/api/auth/me')` 确认真身。

### 2. 导航 + 等水合（不要截图太早）

`mcp__chrome-devtools__navigate_page` 到 `http://localhost:5173`，然后 `wait_for` 顶栏稳定文字（如 `"MQTT"`）——SSR 页面事件要水合后才绑定，过早点击会丢。`take_screenshot` 看整体。

### 3. 选中 Canvas 2D 节点（关键手法）

画布对 `[data-testid="hmi-canvas"]` 派发指针事件做命中。**用 `evaluate_script` 合成 `pointerdown`→`pointerup`→`click`（同坐标、不要 `pointermove`）**——加了 move 会被当成「拖拽平移」吞掉选择。坐标用画布 rect 的**比例**（fit 布局每次略变，用网格扫描重试）：

```js
() => {
  const c = document.querySelector('[data-testid="hmi-canvas"]');
  const r = c.getBoundingClientRect();
  const fire = (fx, fy) => {
    const x = r.left + r.width * fx, y = r.top + r.height * fy;
    const o = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true };
    c.dispatchEvent(new PointerEvent('pointerdown', o));
    c.dispatchEvent(new PointerEvent('pointerup', o));   // 注意：无 pointermove
    c.dispatchEvent(new MouseEvent('click', o));
  };
  for (const [fx, fy] of [[0.145,0.305],[0.15,0.30],[0.178,0.31],[0.14,0.32]]) {
    fire(fx, fy);
    if (document.querySelector('[data-testid="inspector"]')) break;  // 命中即停
  }
  return { hit: !!document.querySelector('[data-testid="inspector"]'),
           title: document.querySelector('[data-testid="inspector-title"]')?.textContent };
};
```

**React 在事件后下一拍才重渲**：选中后要读 Inspector 内容，得用 `async () => { …click…; await new Promise(r=>setTimeout(r,200)); return …read… }`，同一同步 tick 里查会落空。

### 4. 拿硬证据（别只靠肉眼截图）

截图看布局/造型；**精确事实读属性**（更可靠、可断言）：

| 要验的 | 怎么读 |
|--------|--------|
| 连接/状态点颜色 | `getComputedStyle(dotEl).backgroundColor`（曾因 `bg-success` token 未注册→点透明，截图难辨、computed style 立现） |
| 告警态 | 元素 `data-status` / class 含 `text-destructive`/`text-state-paused-fg` |
| 全局告警计数 | `[data-testid="alarm-strip"]` 读 `data-alarm-count`/`data-warn-count`；点 `alarm-strip-toggle` 展开 `alarm-strip-list` 核对条目，点某条应选中并 `centerOn` 那台设备 |
| 面板/对话框出现 | `!!document.querySelector('[data-testid="history-dialog"]')` |
| 实时值文本 | `[data-testid="rt-value-<field>"]?.textContent` |
| 角色界面差异 | 断言该在的在、该藏的 `toHaveCount(0)`（如 operator 无 `mode-toggle`/编辑工具栏） |

文本/可访问性优先用 `take_snapshot`（a11y 树，带 uid）而非纯截图。

**文字还原与引线落点自检（照图还原时必做）**：

| 自检项 | 怎么核 |
|--------|--------|
| 图上文字是否逐字照搬（无改名/意译/杜撰） | **头号检查**：截图对照源图逐处比对——用户写「设备A」画布就必须是「设备A」，没被改名、意译、补全缩写、润色或杜撰成"更专业"的名字。任何一处文字与源图不符=判错回改；看不清的应已问用户而非瞎填 |
| 原图重要文字是否都还原到元件上 | 截图对照源图逐块核——`instrument` 方框显完整位号+实时值+中文名；设备/阀/容器显 label（中文名或位号）。介质名、工段名（至/来自 XX）、设备别名等静态名称填进 label/props.tag；残留空白区截图放大确认无漏填 |
| 实时数值绑定 vs 静态名称填写 | 点选节点读 Inspector：实时数值（`readout`/`instrument`）→ 有 topic 绑定且值在变；静态位号/名称 → 在 label/props.tag 里、bindings 为空。发现实时数值节点无绑定（数值永远不更新）、或静态名称被乱绑 topic → 判错，回改 |
| 控制/测量引线落在正确管段 | 截图放大确认虚线（`lead:true`）落点是**进口管段**（非出口管、非阀中心）；拖动对应仪表节点确认引线跟随（node→node 边自动跟）、自由端点不随节点移动（node→freePoint 边只 node 端跟）；源图若标进口流量，绑定 topic 也必须是进口测量点，不是出口 |
| 引线末段是否垂直插进设备 | 引线应从**顶/底/侧面垂直插进设备本体**——仪表在上/下方→末段竖直入顶/底，仪表在侧面→末段水平入侧面。若看到引线**沿水平管道蹭进设备**（末段贴着管道走、看着像连到管线上而非设备），表明仪表位置或走线有问题，需回查仪表摆放位置 |
| 控制器仪表是否画了两根线 | 截图 + 选中仪表读 Inspector 中 edges：FIC/LIC/TIC/PIC 等带「C」的控制器必须有 **2 条 lead 边**——一根到它控制的阀、一根到被测点（进口管段）。只有一根 = 还原不完整，补缺失的那根 |
| 测量线是否落在进口侧（非出口） | 截图放大流量控制仪表的测量引线落点：必须在阀的**上游**管段（料流进阀一侧），不能落出口侧/阀中心；若两侧看起来对称，根据料流方向（terminal 朝向/管道走向）判断哪侧是进口 |
| 自由端点是否精确落在管线上（无空隙） | 截图高倍放大引线端点处：端点必须压在管线上（无悬空像素缝隙）。若发现空隙，说明 `toPoint`/`fromPoint` 坐标没压在管线真实折线上；临时在 `scene-render.ts` 打印目标 edge 的 `points` 取真坐标修正（验完删 log） |
| 引线/管线是否有重合 | 用 renderScene 取 edgePaths，脚本逐对检查 lead 段与 pipe 段共线重叠（同 x 竖直/同 y 水平且范围相交）；重合=实线盖虚线/双线假象，需挪仪表到零重合。比截图更可靠 |
| 方框仪表是否无杜撰中文名 | 选中 `props.display:"box"` 仪表，读 Inspector 中 `label` 字段：如果 `label` 不为空且源图方框下方没有写中文名，则 label 是杜撰内容——清空。方框只应显位号+实时值 |

**画布内部事实（DOM 读不到的：连线实际路由折线、`bodyBBox`、收口坐标）——别靠像素猜**：截图判断不了「连接间隙是 *路由* 错还是 *渲染分层/背板* 错」时，临时在 `scene-render.ts` 边循环加 `console.log(edge.id, JSON.stringify(points))`（可 `if (points.some(([x,y])=>在某区域))` 过滤），reload 后 `list_console_messages`（输出量大会落盘，`grep "DBG"|sort -u`）。实战收益：iter12 这样查出 lead 路由其实**正确**(`[[1300,530],[1460,530]]` 端点已到设备中心)→ 缝是「背板分层」问题不是路由问题，省下反复改错地方；iter14 同法定位「双线」是哪两条边并行贴近。**验完务必删掉临时 log**（grep `console.log` 确认无残留）。

### 5. 收尾（必做）

- 改过的演示数据（加的 watch、改的阈值）**改回**——自动落库会污染默认图。
- `lsof -ti tcp:5173 | xargs kill`（清不掉用 `pkill -f "vite dev"` + `kill -9`）。别留孤儿 dev server。

## 边界：什么仍需用户

- **审美判断**（好不好看、密度舒不舒服、配色是否专业）——你能拿到客观渲染证据，但主观品味仍请用户定。
- 你的角色是把「能客观验证的」都验到位（渲染出来了、位置对、数据动、交互通、角色差异对），让用户只做品味签收，而不是替你做功能验收。

## 坑速查

| 坑 | 真相 |
|----|------|
| 「AI 看不了画布，交用户」 | 过时。本环境 chrome-devtools 能截图+驱动，先自检拿证据 |
| `getByTestId("node").click()` 点图元 | Canvas 2D 无 DOM 节点，点不中；必须对 canvas 合成坐标指针事件 |
| 合成事件加了 pointermove | 被当拖拽平移，选不中；只 down→up→click |
| 选中后同步读 Inspector | React 下一拍才渲，要 await 一小段再读 |
| 截图判断颜色细节 | 截图压缩+小元素难辨；读 computed style / data-status |
| 凭截图猜连接缝成因 | 路由 vs 渲染分层 DOM 读不到；临时在 scene-render 加 console.log 取真值再 grep，验完删；猜错会反复修不对地方 |
| 起了 dev 不杀 / 不清测试数据 | 孤儿进程占端口、污染默认图；收尾固定动作 |
| 切角色没清 cookie/旧进程 | 网关信 cookie、旧 vite 占端口；先登出清 cookie + pkill 再起带 env 的 vite，验 /api/auth/me |
| 照图还原不核文字落位 | 静态名称/位号乱绑 topic→运行值异常；实时数值不绑 topic→数据永远不更新；Inspector 和 label/tag 值是判断依据 |
| 截图只看整体不查引线落点 | 虚线仪表引线可能落在出口管/阀中心而非进口管；放大截图确认落点 + 拖节点看跟随行为 |
| 控制器仪表只核到一根线就放行 | FIC/LIC/TIC/PIC 必须两根 lead：控制线到阀 + 测量线到被测点；数边数数确认是 2 条 |
| 测量线落出口侧视为「差不多」 | 进出口是不同物理量；落错侧 = 测量语义错误，不是视觉问题，必须修 |
| 自由端点空隙「肉眼看起来接上了」 | 放大倍数不够就看不出；像素缝 = 坐标没压线，靠截图低倍容易漏掉；可加 console.log 取精确 points 核 |
| 方框仪表有中文 label 不觉得是问题 | 源图方框下方没写中文名的，label 是杜撰内容，清空才是正确还原 |
| 改布局就起 dev:preview 连 DB 自检 | 布局/连线/重叠/重合先用「离线渲染自检」（秒级、不连 DB、不污染）；dev:preview 留给交互/实时数据/角色/告警 |
| 元件重叠靠肉眼扫截图 | 离线脚本两两 AABB 判 `OVERLAP` 比肉眼准；元件零重叠是铁律，必清零 |
