# 通用组件接入

本次扩充组件类型，保留脚手架黑白与荧光绿主题。Lingo 的业务页面、制造流程、数据服务和业务角色不在本次范围内。分类由提炼得出，源文件追溯见 [component-kit-source-map.json](component-kit-source-map.json)。

## 选择组件

| 需求 | 入口与职责 |
| --- | --- |
| 现有基础能力 | 继续使用 `components/ui`、`components/forms`、`components/data`、`components/overlays`；Button、Dialog、Drawer 为原实现的兼容扩充 |
| 输入与展示 | `components/kit/ui`：输入、数字、选择、日期、复选、单选、开关、分段、图标按钮、文字按钮、文本/链接、标签、头像、提示、树、预览、上传等 |
| 表单 | `components/kit/meta/meta-form`：字段元数据驱动，分区、校验、只读、关联回填、明细表；不同业务表单复用此实现 |
| 表格 | `DataGrid` 负责展示；`DetailTable` 负责受控明细编辑、增删、批量修改、合计；`MetaListPage` 组合查询、分页、列配置、排序、视图、导入导出 |
| 选择与辅助面板 | 关联选择、人员选择、查询条件、视图编辑、打印、导入导出、移动记录卡片及其配置 |
| 通用编辑器 | `components/editors`：自定义字段、表达式/变量、编码规则、打印模板；对象与属性目录由应用提供 |
| 布局与图表 | `components/kit/shell/page-layout`、`components/ui/responsive-page`、`workbench-layout`、`operational-list`、`components/charts/board-charts` |

可从 `@/components/kit` 导入公开能力；实际页面优先按文件导入。类型在 `@/lib/component-kit/types`。可视图库覆盖 56 个非业务组件分类（含原有能力，并非新增 56 个组件）。

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

移动卡片的 key、状态字段、详情布局和自定义内容均由应用传入；内置 `progress` 内容接收显式 `progress` 值，不计算工单/报工指标。上传组件产生前端文件值，应用需对接文件持久化、大小/类型限制及权限。日期格式工具当前沿用 UTC+8 显示约定，多时区应用应先调整格式适配。

## 样式与验证

启用状态输入框为白底，浅灰填充仅用于禁用状态；沿用根 `globals.css` 的主题变量。交互组件保留 hover、focus、error、disabled 的区分。图标、文字、链接与按钮按各自职责保留。

新增 Excel/二维码依赖按需动态加载。`npm run build` 包含原有构建、认证、运行时检查及新增组件回归测试；`npm run gallery:build` 构建直接引用本仓源码的独立图库。图库的适配器仅使用本地演示数据，不能视为后端接入验证。
