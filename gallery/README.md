# 通用组件可视图库

覆盖 40 个基础分类和 16 个通用扩展分类；引用本仓 `src` 的真实组件，不包含 Lingo 业务组件或第二份组件源码。保留原组件样例便于对照。

```sh
npm run gallery:build
python3 -m http.server 4335 --bind 127.0.0.1 --directory .output/component-gallery
```

打开 http://127.0.0.1:4335/。可筛选组件、切换样例与预览宽度。`fixtures.ts` 是仅限图库的内存演示适配器，不拦截全局 fetch，不写真实服务，不保证刷新后保留状态。应用不得导入图库或使用演示权限。

接入边界与用法见 [组件文档](../docs/component-kit.md)。
