# 预览可用、发布被业务配置拦截：脱敏证据摘录

检查日期：2026-11-11；环境：dev。只读检查，未修改权限、配置或业务数据。

## 现场观察

| 检查 | 结果 |
|---|---|
| Builder 库存页 | 3 条记录，300 kg |
| 发布应用 | 已识别用户及仓储主管角色；提示“试运行仓数据范围尚未确认” |
| 登录接口 | HTTP 200 |
| GET /api/wms?view=workspace | HTTP 200，`{"status":"scope_unconfirmed"}` |

未附原始截图、会话或工作区标识。以下为实际源码的最小摘录；目录名称用 `<已确认业务目录>` 代替，省略不相关内容。

## 当前导出源码：artifact.toml

```toml
[services.production.run.env]
NODE_ENV = "production"
HOST = "0.0.0.0"

[services.preview.env]
# 其他开发服务器变量省略
WMS_DIRECTORY_PATH = '["<已确认业务目录>"]'
WMS_TEST_SCOPE_CONFIRMED = "true"
```

## src/services/wms.ts:45–49,167–170

```ts
function isScopeConfigured(): boolean {
 if (process.env.WMS_TEST_SCOPE_CONFIRMED !== 'true') return false;
 try {
  return validWmsDirectoryPath(JSON.parse(process.env.WMS_DIRECTORY_PATH ?? 'null'));
 } catch { return false; }
}
// workspace 方法
assertWmsAccess(actor,'wms_view');
if (!isScopeConfigured()) return {status:'scope_unconfirmed'};
return {status:'ready',snapshot:await createWmsService(data).snapshot(actor)};
```

## tests/helpers/wms-test-env.mjs:2–4

```js
process.env.WMS_DIRECTORY_PATH = JSON.stringify(["<测试目录>"]);
process.env.WMS_TEST_SCOPE_CONFIRMED = "true";
globalThis.fetch = async () => { throw new Error("WMS service tests must not access a real network"); };
```

package.json 的 test:wms 在测试前载入该 helper。它可以验证服务逻辑，不能证明发布环境具备所需配置或能够实际查询数据。

## 证据边界

原始导入包、首次生成记录、线上 worker/build-deploy SHA 未取得。当前应用包不是原始导入包；不能用本次分析确定开关首次引入者或认定用户违反平台契约。

脚手架 AGENTS.md 明确共享数据；应用专属 specs/spec.md 和 README 另设测试仓确认要求。Builder 可见历史回复明确仅补充预览配置。
