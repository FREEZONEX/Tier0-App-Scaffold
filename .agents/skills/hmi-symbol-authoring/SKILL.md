---
name: hmi-symbol-authoring
description: Add a new HMI device symbol type to the canvas symbol system, or refine how an existing symbol draws. Use when the customer's equipment has no matching type in src/hmi/symbols/capabilities.ts, when a symbol renders as "?" because its type is missing from the catalog (if the type exists but a "?"/unconfigured badge is data-driven, that's a runtime/binding issue — use $hmi-runtime-troubleshooting), when restyling a symbol's geometry, or when extending a symbol's bindable states. For choosing among existing types use $hmi-mimic-generation; for wiring data use $hmi-data-binding.
---

# HMI 图元创作（新增/精修符号类型）

## 第一问：真的需要新类型吗

先查 `src/hmi/symbols/capabilities.ts` 全目录（27 类，含通用件 `instrument`/`dialgauge`/`bargauge`）。客户设备能用现有 type + 自定义 `label` 表达的，**不要新增类型**——类型扩散会稀释模版。新增的正当理由：形体语义现目录无法表达（如新行业的专有设备），或可绑状态契约不同。

## 文件接触清单（7 处，缺一即半成品）

以一个新类型 `<type>` 为例，参照最近的同类提交（`git log --oneline -- src/hmi/symbols/cyclone.ts`）：

1. **`src/hmi/symbols/<type>.ts`** — `SymbolDef { type, inlineFields, circular?, bounds, build }`
   - `bounds(node)`：以 `node.x/y` 为**视觉中心**的包围盒——只管**命中框 + 标题/内联值落位 + 选中环**（可略大于本体留白）。**连线收口与不透明背板不再依赖 bounds**：`scene-render.ts` 从 `build()` 的实际图元自动算——连接盒=非文字图元包围盒(`bodyBBox`)、背板=**填充形体剪影**(`silhouetteBacking`)。所以造型改了连线/背板会自动跟，但 bounds 仍要同步（否则命中/标题/环错位）
   - ⚠️ **本体主轮廓必须有 `fill`**（不能只描边）：背板剪影只取「有 fill 的 rect/circle/polygon/path」重渲成画布色来精确贴合可见轮廓 → 工艺管/引线收口到圆角封头/碟形端/管嘴间平壳都零间隙。主壳**只描边没 fill** → 剪影漏掉它 → 回落粗包围盒矩形 → 那些位置又露画布色缝（这是连接间隙的根因，iter14 用剪影背板根治）。管嘴/焊缝/连杆用纯 `line`（无 fill）正常，它们与工艺管共线无需进背板
   - `circular: true` → 命中按外接圆近似 + 背板用 `coreRadius` 内切圆（圆形体设备用）
   - ⚠️ **非圆形体但有「局部外凸」（侧管嘴/裙座/支腿——只在某高度凸出、非整条边）→ 给 `coreBox(node)` 返回真实壳体盒**（如精馏塔 = 圆筒+封头，**不含**侧管嘴）。连线收口优先按 `coreBox` 贴壳体壁，而非 `bodyBBox`(含管嘴外延)。否则管线在**非管嘴高度**连接时收口到管嘴区、与壳体壁间露**画布色空隙**（管嘴只在 feedY/refluxY 凸出，侧边中点连接处没管嘴→缝）。`coreBox` 与 `coreRadius` 同理、缺省回落 `bodyBBox`；背板剪影非管嘴处本就贴壳体，故只需修收口盒。实战：塔 `sizeX:2.6` 时 8px 管嘴缩放成 21px、缝明显，加 `coreBox` 根治。
   - `build(ctx)` 返回 `Primitive[]`（含 `path` 曲线图元）；尾部用 `labelAndInline` 画标题+内联值，`belowY` 对准新底边
2. **`src/hmi/symbols/<type>.test.ts>`** — co-located node:test（`describe`/`it`+`assert`），必须覆盖：形体特征、状态→填充两态、内联字段、LOD 两档、bounds
3. **`default-registry.ts`** 注册 + **`default-registry.test.ts`** 的注册全表断言加新 type
4. **`capabilities.ts`** 能力契约（`label`/`category`/`desc`/`states`/`props`）——这一条同时驱动元件库、Inspector 绑定 UI、`/components` 预览（`preview.ts` 自动从首个 boolean 字段派生两态卡片）和 `validateMimicAssets` 校验，漏了=图元存在但不可配。组件层全部动态读 `CAPABILITIES`，**无需改任何组件代码**（图例 `src/hmi/components/legend-entries.ts` 是通用状态写死的，也不用动）
5. **`src/hmi/i18n/dict.ts`** — label/desc 的 zh→en（zh-as-key；漏翻不报错、静默回退中文，靠自查）；状态字段文案先 grep dict.ts 复用既有词条（如「液位 0–100」「搅拌运行」已存在），勿重复添加
6. **两份文档表都要加**（实测易漏第二份）：`docs/hmi-schema.md` 图元 type 全表 + `docs/ai-image-to-schema.md` 类型目录
7. **验证**：`npx tsc --noEmit` + `npm test` + eslint 改动文件；活体 `npm run dev:preview` → 元件库出现新图元、可放置、Inspector 出绑定字段；`/components` 预览页按契约逐状态核对。**渲染/交互先用 `$hmi-visual-selfcheck` 自检拿证据**（chrome-devtools 截图 + 读属性，本环境能亲看画布）再交用户做审美签收——别「AI 看不了」就跳过自检盲发

## 静态文字靠元件自身呈现（无独立标注图元）

画面标注**不需要独立的静态文字图元**。文字信息填进已有元件的属性：

- **`instrument`**：默认渲染 DCS 方框（顶部深色带显完整位号=`node.id`/`props.tag`、下方显实时值、中文名=`node.label`）。Inspector 可编辑 `props.tag`（位号）与 `props.display`（`"box"` 方框 / `"bubble"` ISA 圆气泡）；对应 `setNodeProp` 在 `edit.ts` 里。
- **设备/阀/容器等**：显示 `node.label`（中文名或位号）+ 内联值 + 绑定值——静态名称直接改 label，不另起图元。
- 需要自由摆放的**实时数值**（裸数字读数）→ 用 `readout`（`overlay:true`、绑一个 topic 值）。

如需新增**纯数值覆盖类**图元（类似 `readout`），参照它的结构：`overlay:true`、`states` 只含值字段、`build()` 取 `inlineFields` 渲染值并带 `label` 位号。不存在也不应新增纯静态文字图元（那是元件 label 的职责）。

## 绘制规范（权威：`docs/superpowers/plans/2026-06-11-symbol-refinement.md` 顶部「全批共用绘制规范」）

- 几何不凭空造：从最近亲的既有图元源码取样板拼装（锥体看 `cyclone.ts`、搅拌三件套看 `vessel.ts`、盘管看 `heater.ts`、圆体小件看 `checkvalve.ts`）
- 外轮廓 `strokeWidth:2`+`theme.stroke`；细节层 `strokeWidth:1~1.25`+`theme.textMuted`（缩小自然弱化）
- 细节层一律包 `if (showDetail(scale))`（LOD，阈值 `DETAIL_MIN_SCALE=0.7`；`scale` 未传视为 1:1）；基础形体+状态层任何缩放都画
- 状态视觉：激活=`theme.fillDeep`/`theme.running` / 静止=`theme.fillLight` / 液位=liquid clip。**颜色只取 theme token，不硬编码**（暗色主题靠它）
- **每个显示状态必须「一眼可辨」（核心设计，非可选）**：图元在 `capabilities.ts` 声明了几个状态（开/关、运行/停止、高/低液位…），每个状态就要在画布上**明显不同**——「不同显示状态映射到字段的某个值/区间」是这套图元系统的根本，建新元件**必做**这一步：先问「它有哪些状态？用户要不要区分？」，再让每个状态各有醒目视觉。
  - ① 状态色优先落在**本体主区 / 焦点件**：阀=整个阀体填充翻色、泵=泵壳翻色、止回阀=阀体圆翻色（`open?running:fillLight`）。
  - ② 状态只能落在**局部小件**时（如 vessel「搅拌运行」只有顶置电机箱），要把**整组件点亮 + 加运动指示**，别只换那个小件的深浅——实测「只换 18×14 电机箱深浅」在 36px 预览里几乎看不出、被用户判「没区别」；改成电机箱+轴+叶轮同染 `theme.running` + 两道旋转弧后，绿像素 20→56、一眼可辨。
  - ③ ⚠️ **状态视觉若依赖某 `prop`**（vessel 的 running 只在 `props.agitator` 时才画电机箱）→ 缺该 prop 时这个状态**完全不显示**（画布与预览都是两态一样）：预览/生成务必带上该 prop（`preview.ts` 的 `PREVIEW_PROPS`、生成侧见 $hmi-mimic-generation「绑 running 必配 props.agitator」）。
  - ④ 量化自查：`node --import tsx scripts/audit-state-visual.mts` 打印每个布尔态图元两态 bbox 变化占比（粗筛，<8% 要警觉）；面积法会**低估**搅拌器这类局部指示器，低分的再用 `$hmi-visual-selfcheck` 像素复核（数两态颜色像素差）。
- 扁平灰阶：不用渐变/阴影/高光/固有色——status-by-exception，常态低饱和，颜色留给异常
- **干净几何 > 拟真**：泵壳/风机壳的拟真螺线尝试已被用户两次否决回滚（4d86eaa、8b143ed），简洁正圆+特征件胜过仿真造型
- 尺寸对齐同类：小件（阀类）外接圆 R≈16，设备类 R≈20–24，容器类高 ~100

## 装饰层是中央的，图元别越权

`fault`（红环+`!`）、`stale`（虚化+虚线）、`unconfigured`（待接线虚化）、联锁挂锁全部由 `scene.ts resolveNodeState` + `state-language.ts` + `decoration.ts` 统一派生叠加（优先级：未配置 > 不可信 > 故障 > 高报 > 选中）。`build` 里**不要**自画任何异常态视觉，也不要让细节层颜色抢异常色通道。

## 坑速查

| 坑 | 真相 |
|----|------|
| 只写 symbol 文件+注册 | capabilities 漏了→不可绑不可配；i18n 漏了→EN 下回退中文 |
| 文档表只同步一份 | hmi-schema.md 和 ai-image-to-schema.md 两份都要 |
| 自己画故障红环/失联灰显 | 装饰层中央统一画，图元侧画=双重视觉 |
| 改造型不改 bounds/belowY | 命中错位、标题嵌进形体、选中环偏（连线/背板从 build 图元自动算、不看 bounds） |
| 主壳只描边没 `fill` | 背板剪影漏掉它→回落粗包围盒矩形→圆角封头/管嘴处工艺管露画布色缝；本体主轮廓务必给 `fill` |
| 细节不包 showDetail | 千级节点缩小后糊成一团 |
| tsc/test 过了就交付 | 视觉/交互先 `$hmi-visual-selfcheck` 自检（截图+读属性），再交用户审美签收 |
| 新覆盖数值图元不加 `overlay:true` | 会被管线/节点遮住；数值覆盖类（如 readout）必须 overlay |
| 新 category 只加 capabilities.ts | `Palette.tsx` 的 `CATEGORIES` 同步漏了 → 元件库对应分类不显示 |
| 状态视觉只换个小局部色块 | 两态在缩略图/远景几乎看不出 = 状态映射失败；状态色落本体主区，局部指示器（搅拌器）要整组点亮+运动弧，跑 `scripts/audit-state-visual.mts` 复核 |
| 状态视觉依赖 prop 却没兜底 | vessel `running` 只在 `agitator=true` 才画 → 缺 prop 该状态隐形（两态一样）；预览/生成带上该 prop（`PREVIEW_PROPS` / 绑 running 配 `props.agitator`）|
