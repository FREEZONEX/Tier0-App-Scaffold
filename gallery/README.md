# 通用组件可视图库

图库直接引用本仓 `src/components`，用于选择组件和检查交互，不是业务 App。
接入方式见 [组件文档](../docs/component-kit.md)。

## 构建与入口

```sh
npm run gallery:build
python3 -m http.server 4335 --bind 127.0.0.1 --directory .output/component-gallery
```

- `http://127.0.0.1:4335/`：按分类筛选、切换样例与预览宽度。
- `http://127.0.0.1:4335/scaffold-library.html`：按实际导出浏览源码组件。
- 离线打包：`node gallery/build-source-offline.mjs`，输出
  `.output/scaffold-library-offline/index.html` 及相邻资源。

## 来源与边界

`extract-source-catalog.py` 核对真实组件路径并记录导出、来源与源码 SHA。
组件清单以 `scaffold-catalog.json`、`registry.ts` 和当前源码为准，避免在
文档维护容易过期的分类/导出数量。分类按通用 UI 职责组织，同族导出可在详情切换。

`fixtures.ts` 仅是图库内存演示适配器，不写真实服务、不保证刷新后保留状态。
业务 App 不得导入图库 fixtures 或演示权限。图库构建通过不等于 API 接入通过。

## 改动后的检查

检查受影响组件的桌面和窄屏布局、键盘焦点、禁用项、关闭与回调。菜单需覆盖
右对齐/纵向 flex 容器定位；锚点需覆盖实际滚动容器和不可滚动内容。
每次交付报告当次验证结果，不将历史截图尺寸或通过结论当作持续保证。
