# 组件体验改造记录

范围：所有实际组件与业务组合；保留 Tier0 配色、字体、圆角。仅本地评审，不发布。

## 对照基线

本轮开始前的构建保存在 `.output/review-baseline`；图库构建自动复制到预览产物的 `baseline`。这是本轮开始时的工作区（包含之前未提交的改动），不是 GitHub 原版。删除 .output 会删除本地基线。

## 优先顺序

采用 https://m3rcyzzz.club/ux/ 的 139 项顺序，原始名称清单见 gallery/ux-priority.json。其依据是源码引用、文档指引和门禁提及，不能解释为实际用户行为统计。该清单来自 v18，而当前仓库标记是 v8，需要逐项映射，不能照搬版本差异。

1. Button、Dialog、Input、AsyncView、TextButton、IconButton、Select、FieldLabel、Shell、ConfirmDialog。
2. 数据表格、查询、表单、弹层、导航和选择类组合。
3. 图表、业务看板、各编辑器和低频辅助组件。

每项验收：默认/悬停/焦点/按压/禁用/加载/错误；键盘和焦点恢复；375px、平板、桌面；减少动态效果；长内容、无数据、失败重试；真实回调和受控状态。

## 模板映射（待完成源代码比对）

六个本地压缩包的源码路径清单见 gallery/template-inventory.json。Tempo 对应任务/看板，Atlas 对应目录与安全管理，Lucent 对应 DevOps，Flowly 对应流程协作，Flux 对应 AgentOps，Strata 对应后台业务。模板的具体交互和依赖需要进一步审查后移植，不整包替换脚手架。

## 本轮已实现

- 组件和现有四个业务样例可切换本轮修改前/当前双栏对照。
- 分类内按外部排名排序，门户使用 Tier0 字体与主要主题变量。
- Switch 明确显示加载图标并扩大触控命中区域。
- CollapseSection 修复受控展开后内容可能被持续裁切的问题。
- Segmented 观察选项尺寸变化，修复文字变化导致的指示条错位。

## 尚未完成

完整 139 项映射及逐项改造、六模板交互移植、ReactBits/ReUI 注册表源代码核对、四业务样例操作闭环、全量键盘和响应式验收。现有业务样例含展示性按钮和静态计数，不能作为已完成场景交付。

## 2026-11-03 补充走查

通过 `npx ui-skills get baseline-ui` 读取 baseline-ui 规则（CLI 0.2.4），并应用于本轮改动。没有声明全库通过。

| 发现 | 修复 | 状态 |
|---|---|---|
| 门户预览背景、正文、边线带灰绿色硬编码 | 使用现有中性色语义变量 | 已改源码 |
| StatCard 主数字和 MobileCard 指标使用状态色 | 大数字使用 text-foreground，保留小状态色 | 已改源码 |
| 只读指标卡悬停改变描边和阴影，暗示可点击 | 移除 hover 交互样式 | 已改源码 |
| 门户导出选择使用 tab 语义但未实现对应键盘协议 | 使用按钮组和 aria-pressed，沿用原生键盘操作 | 已改源码 |
| 重复说明、源码实现说明侵占预览区 | 删除冗余文案，保留必要导入路径 | 已改源码 |
| 固定侧栏未考虑安全区 | 添加 safe-area-inset | 已改源码 |

新增素材：reui-repos 是三个嵌套 ZIP，bits-repos 是两个嵌套 ZIP，shadcnuikit 是源码目录。尚未将这些新素材的组件批量迁入。

## 门户展示调整

按用户最新要求，门户只展示最新组件和业务场景。已移除对照按钮、修改前/后标签与基线构建复制流程；历史快照不再由门户提供访问。

## 2026-11-04 本轮实施与验证

- 成员、产线、工作流、预算和本地告警订阅已接入浏览器本地保存。
- 审计日志和成本导出生成真实 CSV 文件；工作流新增使用受控表单和字段错误提示。
- 明确本地邀请记录文案，避免将本地预览操作描述成实际发送邮件。
- 分段指示条改为 transform 过渡；数字反馈限制为 200ms，保留减少动态效果支持。
- Dialog / Drawer 内容区恢复 flex-1，修复弹层布局契约。
- 虚拟表格加载行使用 role=status；数据请求的错误/重试由页面 AsyncView 负责。
- 生成 root icon.png 并逐字节复制到 public/app-icon.png，均 512×512。仅保存本地，没有注册平台或发布。
- npm run build 完整通过（包含类型、ESLint、锁定门禁、认证、运行时和组件测试）；gallery:build 通过。
- 扩大 gallery/tsconfig.json 的覆盖范围至门户与场景文件，独立类型检查通过。

UI Skills 已按 baseline-ui、fixing-accessibility、fixing-motion-performance 审查本轮改动：字段名称、错误关联、确认弹窗、反馈、布局动效、减少动态效果。

## 2026-11-04 营销图配色与动效

对照 Tier0 工厂营销拼贴（青柠 / 天空蓝 / 软灰浮卡）：

- 图表三色改为 `#b2ed1d` / `#7dd3fc` / `#94a3b8`，去掉深蓝与紫色系列。
- DualAxis 浅色面增加线下面填充；Switch 开启态用青柠；Progress 用 chart-lime + transform 动效。
- 卡片 / 门户阴影改为更软的扩散；筛选芯片与 Capsule 高亮用青柠底；Tabs 指示条改为 translateX+scaleX。
- 本地 `gallery:build` + serve 已更新；未发布。
