# 脚手架源码组件库

入口：`scaffold-library.html`。分类参考 https://ant.design/components/overview-cn/ ，只使用当前脚手架 `src/components` 中存在的组件，不从旧图库的 integrated-catalog.json 生成，也不导入 gallery/library 的 Lingo 副本。

`extract-source-catalog.py` 根据实际组件导入路径核对文件，记录每个条目的导出名称、来源和源码 SHA；目录为 58 个条目、102 个实际导出。基础控件按通用、布局、导航、数据录入、数据展示、反馈分类；元数据表单、明细编辑和查询视图等应用组合单列重型组件。同族导出在详情内切换，不虚构不存在的 Ant Design 组件名。

样例直接使用 gallery/registry.ts 从 src/components 导入的实现，复用脚手架的示例数据适配器。业务接口与权限由实际应用提供。辅助构件及未单独编排的导出记录在 scaffold-catalog.json 的 excluded 中，不作为运行支持栏目重新展示。

构建：`npm run gallery:build`。独立入口输出到 `.output/component-gallery/scaffold-library.html`。
离线构建：`node gallery/build-source-offline.mjs`，产物为 `.output/scaffold-library-offline/index.html` 及相邻资源。

完整构建通过；浏览器抽查元数据表单、数据表格、参照输入及其弹窗。并未对 102 个导出逐一完成行为验收。离线产物做资源和语法检查，工具禁止 file:// 直接打开，未作双击验收。

## 锚点与菜单布局回归

- DropdownMenu 的触发器使用固有宽度，避免在 flex-column 容器中被拉伸后使 bottom-end 定位漂移。键盘打开等待弹层完成定位后再聚焦首项；选择操作后恢复触发器焦点。
- AnchorTabs 的示例将导航置于滚动容器外；内容分区采用自然高度与最小高度，不将表单强行限制到固定高度。组件补充方向键焦点跟随、容器边框偏移修正，以及不可滚动时不误选末项。
- 浏览器回归：桌面 flex-column 与右对齐工具栏菜单、375px 锚点与菜单、方向键、跳过禁用项、Esc、选项回调。375px 示例内容区 scrollWidth/clientWidth 均为 325，备注分区跳转后的顶部偏移为 0。
