# 通用组件接入

本次扩充组件类型，保留脚手架黑白与荧光绿主题。业务页面、制造流程、数据服务和业务角色不在本次范围内。组件按通用职责组织，应用通过配置与适配器承载业务差异。

## 选择组件

| 需求 | 入口与职责 |
| --- | --- |
| 现有基础能力 | 继续使用 `components/ui`、`components/forms`、`components/data`、`components/overlays`；Button、Dialog、Drawer 为原实现的兼容扩充 |
| 输入与展示 | `components/kit/ui`：输入、数字、选择、日期、复选、单选、开关、分段、图标按钮、文字按钮、文本/链接、标签、头像、提示、树、预览、上传等 |
| 表单 | `components/kit/meta/meta-form`：字段元数据驱动，分区、校验、只读、关联回填、明细表；不同业务表单复用此实现 |
| 表格 | `DataGrid` 负责展示；`DetailTable` 负责受控明细编辑、增删、批量修改、合计；`MetaListPage` 组合查询、分页、列配置、排序、视图、导入导出 |
| 列表搜索 | `KeywordSearch`（关键词搜索 · 多字段模糊搜索）与 `AdvancedFilter`（高级筛选 · 多条件组合筛选）是两个独立组件，规则在 `@/lib/component-kit/list-search`，见下文「关键词搜索与高级筛选」 |
| 选择与辅助面板 | 关联选择、人员选择、查询条件、视图编辑、打印、导入导出、移动记录卡片及其配置 |
| 通用编辑器 | `components/editors`：自定义字段、表达式/变量、编码规则、打印模板；对象与属性目录由应用提供 |
| 布局与图表 | `components/kit/shell/page-layout`、`components/ui/responsive-page`、`workbench-layout`、`operational-list`、`components/charts/board-charts` |

可从 `@/components/kit` 导入公开能力；实际页面优先按文件导入。类型在 `@/lib/component-kit/types`。可视图库覆盖 56 个非业务组件分类（含原有能力，并非新增 56 个组件）。

## 必填标记

必填字段只在标题右侧显示一个红色 `*`，输入框下方不显示星号；下方保留帮助或校验错误文案。横向、纵向表单及可编辑明细表使用相同规则。

使用 `FieldGroup required` 或 `FieldLabel required`，标题文本不手写 `*`，不反转标题排列方向。`FieldLabel` 只放标题，不包住输入框。`MetaForm` 使用字段的 `widget.required`，明细表使用列的 `required`。自定义标题可在文本后使用一次 `RequiredMark`。控件自身的 `required` / `aria-required` 和业务校验仍需保留。

```tsx
<FieldGroup label="设备名称" htmlFor="equipment-name" required>
  <input id="equipment-name" required />
</FieldGroup>
```

升级已有应用时，将手写星号和包住输入框的旧标签结构改为上述组件；全局 CSS 不再根据输入框属性自动追加星号。

## 列表类型页面默认使用 MetaListPage

档案、台账、单据、任务及其他以记录查询和列表操作为主的页面，默认以 `@/components/kit/meta/meta-list-page` 的 `MetaListPage` 为基础。先配置对象字段、查询条件和列，再接入业务动作，复用组件已有的查询区、视图、列配置、排序和分页，不重新拼装一套页面壳。列表内容默认直接铺在页面上，页签、查询区、工具栏、表格和分页外不再套装饰性 `Card` / `PageCard`；仅保留 `PageContainer` 的页面留白及列表内部间距。生产业务页面默认铺满侧边栏之外的可用宽度，桌面左右各留 24px，不在列表外添加居中限宽容器。简单表单和长文本可在自身内容块按需限宽；多列表单、明细表及页面标题不随之统一收窄。

- 页面以 `objectCode` 和 `title` 标识业务对象；创建、打开详情、行操作和批量操作分别通过 `onCreate`、`onOpenRecord`、`rowActions`、`batchActions` 接入。差异化展示使用 `cellRenderers`，额外入口使用 `headerExtra` / `toolbarExtra`。
- 操作列优先给每个 `RowAction` 配 `icon`（标签仍作无障碍名称 / tooltip）；`RowActions` 用固定尺寸的图标按钮，并始终预留 ⋯ 槽位，保证各行对齐。没有图标时才退回文字按钮。溢出「⋯」菜单默认 `trigger="click"`（触控与键盘可打开）；不要用纯 hover。
- 在应用范围内配置 `ComponentKitProvider`，将 `meta/config` 与 `meta/query` 等逻辑请求映射到真实服务，并提供 `canObject`。业务接口仍执行服务端权限校验；图库适配器不能用于应用数据。
- 只开启业务需要且已完成接入的视图保存、导入导出、打印等能力。组件存在不代表相应后端接口已经提供。
- `DataGrid` / `DataTable` 用于局部表格展示，`DetailTable` 用于表单中的受控可编辑明细，不作为普通列表页面的默认替代。

用户明确指定其他形态，或图表报表、看板、甘特图、扫码工位、嵌入式明细等交互无法合理适配时，可采用对应组合，并在实现说明中记录具体原因。不要仅为视觉变化重写列表框架；已有页面的小范围修复不自动扩大为整页迁移。

### 列表页操作区规范

列表页顶部的操作按“每一行只承担一种职责”排列，`MetaListPage` 已按此实现；自行组合的列表页（扫码工位、报表等例外形态）也遵循同一顺序。

| 层级 | 左侧 | 右侧（从左到右） |
|---|---|---|
| 1. 页头 | 页面标题（窄屏截断，不居中） | 次要页面入口 `headerExtra`（outline）→ 唯一主按钮「新建…」（`createLabel` + `onCreate`，primary，固定在最右） |
| 2. 工具栏 | 数据范围 `topTabs`（放得下且 ≤5 项时平铺为分段控件，否则为下拉框；均带计数） | 关键词搜索框 →「筛选(n)」→ 快捷筛选 `toolbarFilters` → 数据动作（导入 / 导出 / `toolbarExtra`，outline）→ 表格设置（字段配置 / 排序 / 行高 图标按钮，竖线分隔，固定最右） |
| 3. 筛选面板 | 点明确标注的「筛选(n)」按钮后在工具栏下方显示：其余查询条件，标签在上、控件在下，按容器宽度 1–4 列；不使用无文字的展开/收起箭头 | 末尾「重置」（ghost）+「查询」（primary） |
| 批量栏 | 勾选记录后替换第 2 层右侧 | 「已选 N 项」→ 批量动作（outline，危险动作红色）→「取消选择」 |

- 一个页面只有一个 primary 按钮：页头的创建按钮；筛选面板展开时其「查询」是该区域内唯一的 primary。创建不放进工具栏，查询/重置不和业务按钮混排。
- 关键词搜索框使用第一个文本查询条件，带放大镜图标、不加外置「字段：」标签，占位为「搜索{字段名}」，桌面宽 14–16rem；回车或清空即查询。其余条件全部进入筛选面板，「筛选」按钮角标显示已生效条件数。
- 同一行控件同高（36px，默认 `md` 档）：页签组外框、搜索框、按钮、图标按钮一致；按钮间距 `gap-2`，组与组之间留 `gap-3` 或分隔线。不用灰底胶囊把普通按钮包成一组。
- 数据范围（状态、我负责的…）由 `ListScopeSwitch` 呈现：选项 ≤5 且当前宽度放得下时平铺；选项多于 5 或放不下时整体换成下拉框（选项同样带计数），随宽度变化自动切换。不换行、不出现横向滚动条，也不把一部分折进「更多」。视图项和计数不要以文字形式放进 `toolbarExtra`。
- 次要页面入口（跳转工位、看板等）在 `sm` 以下只显示图标，并保留 `aria-label`；主按钮始终保留文字。
- 窄屏（375px）：页头保持一行；数据范围单独一行（平铺或下拉框占满）；搜索框占满一行；「筛选」、数据动作与表格设置在下一行。页面本身不出现横向滚动，宽表格在自身区域内滚动。
- `toolbarNote` 放与当前列表有关的一句说明，位于工具栏之下、表格之上。
- `MetaListPage` 自带 `PageContainer`（含 `page-shell` 留白），路由页面不要再包一层 `page-shell`。
- 下拉框里的计数紧跟在选项文字后面（灰色小字），不右对齐到行尾；勾选标记仍在最右。

### 表头

- 表头文字为深色（`text-foreground`，字重 500），不使用全大写；`<table>` 的基础样式与 `DataGrid` 一致。
- 默认不放字段类型图标。只有带操作的列才出现图标：可排序列（字段 `sortable: true`）在列名后有浅灰的快捷排序按钮，点击依次为升序 → 降序 → 取消，激活时变深色，并与工具栏「排序」设置同步保存。
- `DataGrid` 的 `headerIcon` 仅在图标本身传达业务信息时使用，颜色为浅灰（`text-text-placeholder`）。

### 手写 DataTable 对齐

- 文本 / 标识列左对齐；主文案 + 编码用 `TableCellText` 的 `secondary`。
- 数量 / 范围列用 `TableNumericHeader` + `TableNumericCell`（右对齐），并给列宽上限（如 `w-28` / `w-44`），避免短数字漂在过宽列中间。
- 状态 / 操作列用 `TableStatusCell` 或 `table-col-fit`，垂直居中，与同行多行单元格对齐。
- 详情页区块标题用 `Card title`（表格可 `flush` + `bare`），不要单独挂一个 `<h2>` 小标题；`PageHeader.eyebrow` 不放业务元数据。

### 返回上一级

- 侧边栏入口之下的每一个页面（详情页、子页面、工位任务页）都在标题左侧提供返回按钮：`PageHeader` / `PageContainer` / `MetaListPage` 传 `back={{ to, label }}`，工位布局 `StationLayout` 同样传 `back`。
- `to` 指向明确的上一级路由，不用 `history.back()`，从链接直接打开或刷新后也能回到正确的上一级；`label` 是上一级名称，读作「返回{label}」。
- 一个页面只有一个返回入口，不在内容区再手写返回链接；工位等多层页面按当前层级切换返回目标。

- 数据范围页签（`topTabs`）与状态胶囊（`CapsuleGroup` / `StatusFilter`）是分段切换样式：浅灰托盘和选中项都不使用描边，选中项以白底、轻阴影和加粗文字区分；计数直接使用统一的次要文字，不再额外套小标签。选中态不使用黑底，避免与「创建」等主按钮混淆；托盘高度与同排按钮一致（md 36px），长名称在选项内换行。
- 表格设置（字段配置 / 排序 / 行高）在工具栏右侧以统一的深绿色文字按钮呈现，不加托盘，不与页签外观相同；三者的图标、字号、间距和反馈保持一致。
- 排序按钮直接显示第一条规则（「排序：计划数量 降序」，更多规则显示「+N」，悬停列出全部）。方向统一写作「升序 / 降序」，不使用只适合文本的「A → Z」。个人未保存排序时，按钮和查询使用当前视图的「默认排序」，按钮标注「（默认）」；清空全部条件即立即恢复视图默认排序，刷新前后一致。需要无排序时去掉视图的默认排序。

## 关键词搜索与高级筛选

两者解决不同问题，不要合并成一个含义模糊的「组合搜索」：

- **关键词搜索（`KeywordSearch`，多字段模糊搜索）**：只有一个输入框；同一关键词不区分大小写、按包含关系同时匹配业务配置的多个字段（如编码、名称、规格，可用 `value` 读取子表等派生文本），任一字段包含即返回。范围是当前列表的字段，不是跨应用或全平台搜索。
- **高级筛选（`AdvancedFilter`，多条件组合筛选）**：每个字段一个独立控件（文本、选择、日期范围等，沿用 `SearchPanel` 的控件选择），点「查询」后已填写的条件同时满足（AND），未填写的条件不参与；已应用条件以标签展示，关闭单个标签只移除该条件，「清空条件」移除全部。组件受控于已应用的值（`value` / `onChange`），输入中的草稿在查询前不影响列表。
- 同一列表同时启用两者时，结果需同时满足关键词与全部已填写条件（AND）：`filterListRows(rows, { keyword, keywordFields, conditions, values })`。服务端分页列表应把关键词与 `buildQueryFilters(conditions, values)` 一并下发，由接口执行相同语义。

业务示例：组件门户「业务场景 → 任务运营台」在任务列表上同时演示两者，任务抽屉内用 `DetailTable` 维护领料明细并展示数量、金额合计。

## 受控表单与明细表

```tsx
import { useRef, useState } from 'react';
import { MetaForm, type MetaFormHandle } from '@/components/kit/meta/meta-form';
import type { SectionDef } from '@/lib/component-kit/types';

const sections: SectionDef[] = [{
  key: 'basic', label: '基本信息', type: 'form', zone: 'FORM_HEADER',
  items: [{code: 'name', name: '名称', type: 'TEXT', widget: {required: true}}],
}];
function RecordForm() {
  const [value, setValue] = useState<Record<string, unknown>>({name: ''});
  const formRef = useRef<MetaFormHandle>(null);
  return <MetaForm sections={sections} value={value} onChange={setValue} formRef={formRef} />;
}
```

提交前调用 `formRef.current?.validate()`；通过后由应用保存。表格区块使用 `type: 'table'`，数据放在 `value[section.key]`。明细行的 `__key` 只用于界面，提交时用 `stripRowKeys()` 去除。业务字段计算、提交事务和后端校验仍由应用负责。

## 数据与权限适配

纯展示/受控组件不需要服务。关联选择、列表、配置、导入导出与打印等组件需要 `ComponentKitProvider`：

```tsx
import { ComponentKitProvider, type ComponentKitAdapter } from '@/components/kit/provider';

// 在应用内实现，显式把组件请求映射到真实服务；不得使用图库 mock。
const adapter: ComponentKitAdapter = {
  request: ({path, method, body, signal}) => appComponentService({path, method, body, signal}),
  canObject: (objectCode, operation) => appPermissions.can(objectCode, operation),
  printableObjects: [{value: 'record', label: '记录'}],
  codeRuleTypes: [{value: 'RECORD', label: '记录编号'}],
  codeRuleProperties: {RECORD: [{key: 'code', label: '记录编码'}]},
};
// <ComponentKitProvider adapter={adapter}>{children}</ComponentKitProvider>
```

`appComponentService` 和 `appPermissions` 是宿主应用实现示意，不是脚手架自带服务。请求中的 `/api/meta/...`、`/api/system/...` 是保留的逻辑契约标识：组件不会自动 fetch，脚手架不因此新增这些后端路由。根据 `types.ts` 与调用组件映射请求/响应并传递取消信号，使用脚手架原有认证请求工具。未配置适配器时数据操作报错；未配置 `canObject` 时对象操作默认不授权。客户端检查仅控制 UI，真实服务必须继续执行角色合并和权限校验。

主要契约：`meta/config` 返回字段/视图配置，`meta/query` 返回分页数据；`meta/views` 与 `meta/prefs` 保存视图；`reference-options`、`org/tree`、`org/persons` 返回选择项；`meta/import-template`、`meta/import`、`meta/export` 处理 Excel；`print-templates`、`print/render` 返回打印配置/页面。完整字段以 TypeScript 类型和调用点为准，宿主只需实现实际使用的能力。

移动卡片的 key、状态字段、详情布局和自定义内容均由应用传入；内置 `progress` 内容接收显式 `progress` 值，业务指标计算由应用负责。上传组件产生前端文件值，应用需对接文件持久化、大小/类型限制及权限。日期格式工具当前沿用 UTC+8 显示约定，多时区应用应先调整格式适配。

## 图标

导航与操作图标统一使用 `lucide-react`（ISC 许可，24px 网格、2px 描边，与脚手架现有图标同一风格），不引入第二套图标库，不使用 emoji 作图标。

- **按名称导入**：`import { Wrench } from "lucide-react"`，只打包用到的图标。禁止 `import { icons } from "lucide-react"` 或按字符串动态取整个图标表：整表约 1700 个图标，会让应用主包增加约 480 kB（gzip 约 125 kB）。
- **侧栏菜单**：每个分组和叶子都配置与业务含义匹配的图标，优先传组件；也可以写 `src/components/nav-icons.ts` 中 `NAV_ICON_LIBRARY` 的名称（`"Wrench"`）。库外的字符串名称会在类型检查时报错，改为直接导入对应组件；运行时读到的未知名称不会报错，开发环境控制台给出提示。未配置或名称不在库中时，Shell 依次按菜单名称关键词匹配（「报修单」→ Wrench、「库存台账」→ Warehouse，见 `NAV_ICON_KEYWORDS`），仍无匹配则显示名称首字的方框标记。侧栏折叠后每项都有可见标识，悬停或键盘聚焦显示菜单名称（锁定项附原因），当前页以浅灰底、加粗文字和深色图标标示。
- **尺寸与颜色**：侧栏一级 16px、二级 14px；按钮与工具栏 14–16px（`[&>svg]:size-3.5` / `size-4`）。图标跟随文字颜色：未选中为 `text-muted-foreground`，选中、悬停为 `text-foreground`；只有状态和危险操作使用语义色。图标与文字同一行垂直居中，间距 8–10px（`gap-2` / `gap-2.5`）。
- **常用操作对照**：新增 `Plus` / `CirclePlus`，编辑 `Pencil`，删除 `Trash2`，搜索 `Search`，筛选 `Funnel`，排序 `ArrowDownUp`，导入 `FileInput`，导出 `FileOutput`，打印 `Printer`，刷新 `RefreshCw`，更多 `EllipsisVertical`，设置 `Settings`。同一含义在整个应用只用同一个图标。
- 新增业务概念需要库外图标时，直接按名称导入组件即可；常用于菜单的再补进 `NAV_ICON_LIBRARY` 和关键词表，并同步 `tests/nav-icons.test.tsx`。

## 样式与验证

启用状态输入框为白底，浅灰填充仅用于禁用状态；沿用根 `globals.css` 的主题变量。交互组件保留 hover、focus、error、disabled 的区分。键盘焦点分流：按钮 / 页签 / 图标按钮 / 分段用浅灰填充（`FOCUS_FILL`），输入框 / 选择器 / 日期 / 复选框用 `#B2ED1D` 40% 描边（`--ring`，`FOCUS_RING`）；不要给按钮套绿色双描边。图标、文字、链接与按钮按各自职责保留。

## 标签、拖拽与浮层一致性

- 生命周期状态统一使用 `StatusTag` / `StatusBadge` 的 22px 高度、4px 圆角、12px 字号和语义色；普通分类或可移除条件使用 `Tag`。同一信息不在不同页面分别手写圆角标签。
- 所有排序和字段编排使用共享 `DragHandle`：16px、灰色六点柄、可拖时 `grab`，拖动项降低透明度；落点统一用 2px 前景色横线，不使用品牌绿或只改变整行底色。
- 短表单、确认、模板选择和少量选项使用 `Dialog` / `FormDialog`，内容高度自适应；多分区配置、长列表和连续编辑流程使用 `Drawer`。不要为短内容预留大面积空白。
- 同一流程只保留一层浮层。后续步骤在当前 Dialog / Drawer 内切换内容和标题；从列表进入编辑时，取消应回到上一步。危险操作可用确认弹窗，但不得同时打开两个 Drawer，也不得在 Dialog 中再打开同类 Dialog。

新增 Excel/二维码依赖按需动态加载。`npm run build` 包含原有构建、认证、运行时检查及新增组件回归测试；`npm run gallery:build` 构建直接引用本仓源码的独立图库。图库的适配器仅使用本地演示数据，不能视为后端接入验证。

视图切换（例如“我负责的”“已取消”）使用 `MetaListPage.topTabs`，每项分别设置 `label`、`count`、`scope` 或 `filters`，由列表统一切换查询并重置分页。不要将视图项或计数作为普通文字放进 `toolbarExtra`。
