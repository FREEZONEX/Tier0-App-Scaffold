# API 模式迁移清单

## 本分支交付范围

本分支更新 AGENTS.md、README、平台接入说明及 API/CRM 开发规范。它**没有**删除 Drizzle 依赖、重写模板构建门禁、接入 App Data 客户端或修改平台部署服务。版本标记按 Scaffold 维护规则更新，只表示继承的规则变了，不代表 API 模板已可直接发布。

新 App 的目标架构是 API-only，不能继续扩展 SQL 路径；现有 SQL App 也不能通过更新文档自动迁移。不得删除原库或把旧数据迁移视为本次授权。

## 后续实现按依赖顺序推进

| 阶段 | 要改的现有位置 | 完成条件 |
| --- | --- | --- |
| 1. 数据客户端 | 新增服务端 `tier0-data.server.ts`、版本来源说明、配置验证 | 使用固定 Enterprise App Data 源码，真实 context/read/write 可用；Key 不进入浏览器 |
| 2. 配置初始化 | 新增受信 provision 流程、JSON Schema 与集合别名映射 | 用管理 API 幂等初始化；App 运行 Key 不能扩权或创建元数据 |
| 3. App 服务 | `src/services/**`、业务 Schema、API routes | 不导入 `@/db`；使用 atomic API 和 revision；保留身份/CSRF/角色及错误链路 |
| 4. SQL 模板残留 | `src/db/**`、`drizzle.config.ts`、`src/services/bootstrap.ts`、`db-results.ts`、DB 命令、依赖及 lockfile | 删除已无引用的 SQL 专用路径；不靠提供假 DATABASE_URL 绕过启动 |
| 5. 维护者门禁 | `src/lib/db-contracts.test.mjs`、`db-schema-contracts.test.mjs`、`scripts/runtime-audit.mjs`、`post-build-verify.mjs`、完整性清单及其他命中 SQL 的门禁 | 用服务端 API 边界、无凭据泄漏、无数据库直连和真实持久化测试替代 SQL 假设；不能直接删门禁求绿 |
| 6. 构建与部署 | 部署侧 DB provision/migration 阶段、Secret 注入、导入/导出、Preview/生产配置 | API App 不执行 drizzle push，不获得数据库密码；明确注入专用 App 数据 Key，导入到另一环境重新绑定授权 |
| 7. 验收 | 空环境启动、重新部署、网关角色、分页/事务/时序、浏览器及打包 | 运行时不依赖数据库驱动和 DATABASE_URL；所有业务落库走 API；保留现有 UI/路由/auth 测试 |

表中的位置是待改清单，不是已完成声明。App 生成 Agent 不应擅自修改锁定的模板测试或 `gate-integrity.json`；由 Scaffold 维护者在正式运行链路迁移中一起更新，并提交等价的新保护。

## 容易混淆的边界

- `.env.example`、`artifact.toml` 及 `package.json` 目前仍可能提到数据库；本分支的文档不触发这些操作。不要按旧命令运行 db:push 或清理数据库。
- `TIER0_APP_API_BASE` / `TIER0_APP_API_KEY` 是本规范建议的私有服务端配置，不是已完成的平台自动注入机制。
- `TIER0_API_KEY` 的 SDK 通知/MQTT 契约继续有效，但不是 App 数据授权的替代品；不要为迁移改动其权限或把数据 Key 填进去。
- App 元数据、Launchpad 运行身份、部署包属于不同对象，需显式绑定。导入新工作区不得复用来源环境的 Key 或硬编码 collectionId。
- 若现有构建门禁仍要求 Drizzle，不伪造表、无意义 bootstrap 或本地 mock；报告具体迁移缺口。文档校验不能声称 App 构建或生产部署已通过。

## 本分支的验证方式

只运行 Markdown 本地链接/JSON 示例检查、`git diff --check`、版本脚本的严格检查，核对新规范引用的 API 和字段。未改变运行时代码，因此不启动 App、不连接业务数据库、不跑集成导入。
