# 脚手架源码组件库

入口：`scaffold-library.html`。分类参考 https://ant.design/components/overview-cn/ ，只使用当前脚手架 `src/components` 中存在的组件，不从旧图库的 integrated-catalog.json 生成，也不导入 gallery/library 的 Lingo 副本。

`extract-source-catalog.py` 根据实际组件导入路径核对文件，记录每个条目的导出名称、来源和源码 SHA；目录为 58 个条目、102 个实际导出。基础控件按通用、布局、导航、数据录入、数据展示、反馈分类；元数据表单、明细编辑和查询视图等应用组合单列重型组件。同族导出在详情内切换，不虚构不存在的 Ant Design 组件名。

样例直接使用 gallery/registry.ts 从 src/components 导入的实现，复用脚手架的示例数据适配器。业务接口与权限由实际应用提供。辅助构件及未单独编排的导出记录在 scaffold-catalog.json 的 excluded 中，不作为运行支持栏目重新展示。

构建：`npm run gallery:build`。独立入口输出到 `.output/component-gallery/scaffold-library.html`。
离线构建：`node gallery/build-source-offline.mjs`，产物为 `.output/scaffold-library-offline/index.html` 及相邻资源。

完整构建通过；浏览器抽查元数据表单、数据表格、参照输入及其弹窗。并未对 102 个导出逐一完成行为验收。离线产物做资源和语法检查，工具禁止 file:// 直接打开，未作双击验收。
