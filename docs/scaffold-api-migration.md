# API 模式迁移清单

## 本分支交付范围

当前已完成 API-only 规范，尚未迁移模板运行链路。Drizzle 依赖、SQL 构建门禁、App Data 客户端和部署注入按下表逐项完成后，才能发布 API 模板。规范版本标记不表示运行时迁移完成。

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

## 迁移验收

配置变量及 Key 边界以 [平台接入说明](platform-integration.md) 为准，业务数据与
事务验收以 [App API 规范](app-api-development.md) 为准。不要复制 CRM 的账号、
固定端口、工作区或跨仓库导入路径；导入新环境需重新绑定授权。

现有 SQL App 的数据迁移单独制定计划，不随模板文档更新删除原库。若门禁仍要求
Drizzle，报告缺口，不伪造表或无意义 bootstrap 求绿。
