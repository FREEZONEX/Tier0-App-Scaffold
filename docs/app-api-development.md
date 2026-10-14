# App 开发规范：以平台 API 为唯一业务存储入口

本规范总结 CRM 实践，适用于后续由 Agent 生成的业务 App。沿用 Scaffold 的 TanStack Start、界面组件、Gateway 身份与角色机制，数据层改为 Enterprise OpenAPI v2。**不再用 Drizzle、数据库驱动或 App 自建 SQL 表保存业务数据。**

模板实现状态见 [迁移清单](scaffold-api-migration.md)。

## 1. 一条调用链，三个职责

```text
Agent / 运维（受限管理凭据）
  → 配置 API：创建 Collection、可选 Topic、App 授权 → 签发 App 数据 Key

用户 → App 页面 → App 服务端 → App 数据客户端 → OpenAPI v2 → 平台数据库
                   身份/业务规则                    授权/Schema/事务/并发

外部系统 → Source + Stream → Collection 的 Record / Sample
                                ↑ App 通过 API 读取
```

| 层 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| App 页面 | 表单、查询条件、业务动作、成功/冲突/未知结果展示 | 保存平台 Key、直接访问数据库、决定最终权限 |
| App 服务端 | 解析可信用户、角色并集、记录可见范围、状态机、金额计算、组装查询/事务 | 开数据库连接、执行 SQL、把浏览器提交的 owner/role 当作身份 |
| 平台 API / 数据库 | App 集合授权、Schema 和唯一性校验、revision、原子批次、回执、查询快照 | 自动理解“签约后不能改金额”或替 App 决定客户归属 |

平台的通用条件事务用于防止并发竞争，不需要建立一套 CRM 专用规则引擎。App 写业务规则，将需要在提交时仍成立的条件带入事务。

## 2. 数据对象如何映射

| 对象 | 定义 | CRM 示例 |
| --- | --- | --- |
| Collection | 数据契约与授权边界；含 recordSchema、可选 sampleSchema、显式 uniqueKeys | customers、contracts、payments |
| Record | Collection 中的一条当前业务记录；身份为 `(collectionId, id)` | 一个客户、一份合同、一条测点定义 |
| Sample | 某条 Record 的一次历史采样，含时间、数据和质量 | 温度测点在某时刻的读数 |
| Topic | Namespace 的展示/寻址入口；可引用集合记录或字段 | 在 Namespace 中展示客户或测点 |
| App 元数据 | App 数据身份、Collection 别名及授权，成员/角色/导航配置 | 别名 customers 对应哪个集合、允许什么操作 |
| Source / Stream | 外部系统的接入配置与采集处理程序 | OAuth CRM 连接、持续采集设备数据 |

底层以 `uns_meta` 保存上述元数据 kind，`uns_record` 保存 Record，`uns_sample` 保存采样。App **只依赖 API 对象**，不依赖物理表名、workspace 前缀或表隔离实现。

- Collection 独立于 Topic；App 不必为每个集合创建 Topic。
- `kind=app` 的 UNS 元数据不是 App 容器、镜像、发布版本或部署清单。Launchpad 的部署对象与 `APP_ID` 属于运行平台；不要假定它自动等于 UNS App 数据身份。后者从数据 Key 对应的 `apps/context` 获得。
- Record 的 `data` 是 JSON 业务字段；`id/revision/createdAt/updatedAt` 是平台属性，不重复放进 data。revision 是平台维护的乐观并发版本，不是业务状态。
- 联系人写 `data.customerId`、回款写 `data.contractId`。引用 ID，不用名称做关联键；普通字符串字段不自动成为外键。
- Sample 显式追加，更新 Record 不会自动留存时序；财务凭证和操作审计通常是 Record，不要都塞成 Sample。
- 金额用安全整数分；长数字标识用字符串。TypeScript 泛型不等于响应运行时校验。

示意数据（不是要求 App 执行 SQL）：

```json
{
  "record": {
    "collectionId": "contracts-collection-id",
    "id": "contract-001",
    "revision": 4,
    "data": {"customerId": "customer-001", "amountCents": 100000, "paidCents": 20000, "status": "signed"}
  },
  "sample": {
    "collectionId": "signals-collection-id",
    "recordId": "temperature-001",
    "time": 1791936000000,
    "data": {"value": 25.6},
    "quality": "good"
  }
}
```

## 3. Agent 的制作顺序

1. **业务闭环**：写明对象、角色、生命周期及命令。例如合同是“草稿 → 签约 → 作废/冲正”，不是任意 CRUD。
2. **发现能力**：读取目标环境的 v2 catalog 与实际契约。确认 App 数据授权、条件事务、复杂查询是否开放；不凭某个分支的文档推断所有环境都支持。
3. **定义数据契约**：用 Zod 定义输入和类型，输出平台支持的 JSON Schema。明确关联 ID、精度、必填项与 uniqueKeys；不要静默丢弃不支持的约束。集合约束不代替业务状态机。
4. **受信初始化**：Agent 用管理凭据经 API 创建 Collection、必要的 Topic 和 App 授权，保存实际返回的 ID；业务代码使用集合别名。初始化幂等，不能每次访问页面都创建元数据或插入假数据。
5. **签发运行 Key**：只授予需要的 record/sample 操作；管理凭据不进入 App。签发 Key 不是幂等请求，响应丢失要核对或撤销，不盲目重试签发。
6. **实现业务服务和路由**：先校验身份、动作与可见范围，再构造平台查询/原子批次。保持 App 同源 API，不做任意请求透传代理。
7. **接 UI**：列表分页、详情、业务动作、数据刷新、冲突恢复。不要复制 CRM 的所有模块，也不要用技术对象列表代替业务工作台。
8. **真实 API 验收**：普通操作、并发、重试、角色隔离、关联汇总和时序读写；刷新后验证落库。通过后再做部署验收。

建议目录（新增文件由具体 App 实现，本规范不会自动生成）：

```text
src/domain/                    Zod schemas、类型、业务命令
src/services/                  状态机、授权、查询和事务编排
src/lib/tier0-data.server.ts    固定版本的服务端 App Data 客户端
src/routes/api/                requireAuth → parse → service → withErrors
scripts/provision.ts           受信初始化，独立于页面请求
specs/spec.md                  业务需求及验收标准
```

保留现有 Gateway、CSRF、角色并集、`apiUrl()`/`requestJson()` 和组件规范。CRM 本地预览使用过单独的登录桥接和 members 集合，**不要因此在 Scaffold 中另建账号、密码、Cookie 或默认管理员**。

后续修改集合 Schema 也通过管理 API：先检查已有数据兼容性，再安排受控 API 回填。改字段名不会自动改写已有 JSON；不要通过删除集合或重建数据解决不兼容。

## 4. 凭据和服务端客户端

| 凭据 | 使用者 | 允许范围 |
| --- | --- | --- |
| 配置/管理 Key | Agent 或运维初始化进程 | 显式授权的元数据、App 授权和 Key 管理 |
| App 数据 Key | App 服务端 | 获授权 Collection 的 record/sample 操作 |
| 用户身份 | Gateway → App | 决定 App 内这个人可以执行什么业务动作 |

App Key 不能创建 Source、Stream、Collection 或扩权；最终授权受 App 当前配置、Key 范围及所属用户平台权限约束。Key 本身不代表当前浏览器用户，不能自动实现“只看自己的客户”。查询、详情、修改、导出和报表都必须在 App 服务端约束可见范围。

采用以下**建议的 App 私有环境变量**，需部署明确注入，不宣称现有平台已自动提供：

| 变量 | 约定 |
| --- | --- |
| `TIER0_APP_API_BASE` | 可信 Enterprise 地址，以 `/openapi/v2` 结尾 |
| `TIER0_APP_API_KEY` | 当前 App 的专用数据 Key，仅服务端可读 |

现有 `TIER0_API_KEY` / `@tier0/sdk` 的通知、文件、MQTT 凭据是另一个契约；不要将 App 数据 Key 当作通用 SDK Key，尤其不要通过 `VITE_*` 传给浏览器。

现有 App Data 客户端是 Enterprise 仓库的 `packages/app-data-client/src/index.ts` 源码，**尚未发布为 npm 包**。固定已验证提交后放到服务端目录，由构建器打包并记录来源。不要编造 npm 包名，也不要从 App 用 `../../../Enterprise/...` 跨仓库导入。客户端应保留超时、禁止凭据重定向、结构化错误和幂等语义。

```ts
// 服务端初始化；不接受浏览器传入地址或 Key。
const data = createAppDataClient({
  apiBase: process.env.TIER0_APP_API_BASE!,
  apiKey: process.env.TIER0_APP_API_KEY!,
});
const customers = await data.collection<Customer>('customers');
// authorizedFilters 由服务端根据可信用户构造。
const page = await customers.list({page: 1, size: 50, filters: authorizedFilters});
```

环境缺失、API 无权限或不兼容时明确报错。不要回退到本地数据库、localStorage、内存假记录或旧的宽权限接口。

## 5. 已核对的 API 入口

以下路径均以 `/openapi/v2/uns/` 为前缀、使用 POST 和 `X-API-Key`。以目标环境 catalog/契约为准；内部 `/api/core/v2` 仅用于有相应 Permission 的管理页面/运维，不是 App 数据 Key 的替代入口。

| 后缀 | 用途 |
| --- | --- |
| `catalog/get` | 查询版本、能力与限制，由具备权限的初始化调用方检查 |
| `apps/context` | 从 App Key 解析可用别名、集合、Schema 与权限；body `{}` |
| `apps/keys/create`、`apps/keys/revoke` | 管理者签发/撤销 App 数据 Key |
| `records/query` | 过滤分页；多查询；显式 relational 关联/投影/聚合 |
| `samples/query` | `mode: latest/history`，按集合、记录、时间查询 |
| `changes/apply` | 原子变更；传 `dryRun: true` 做校验；校验不提交，也不预占后续写入的锁 |
| `jobs/query` | 查询异步批次终态；App 仅能查询该 Key 创建且当前仍有权限的作业 |

写请求关注 `data.status`：`validated` 是通过校验，`accepted` 是入队，`committed` 才是已提交。HTTP 200 不是唯一成功判据；异步请求要跟踪作业至 `succeeded`，不能收到 accepted 就显示保存完成。

## 6. 事务由谁实现

App **编排一次业务命令**，平台**执行真实数据库事务**。不要在 App 开 SQL 事务，也不要对多个独立 HTTP 请求宣称整体原子。

以回款登记为例：App 验证财务权限、合同已签约、金额合法、没有超收；将回款记录、合同累计额、审计记录放进同一个批次，合同带用户/业务读取到的 revision。平台在一个事务中校验权限、版本、Schema 和唯一键，全部成功才提交；任一失败整批回滚。

```ts
// 精简片段：contract/amount/actor 已经过业务授权和 Zod 校验。
// paymentId、auditId、occurredAt、intentKey 在本次命令准备时固定，重试复用。
await data.apply([
  payments.changes.create('payment', {
    contractId: contract.id, amountCents: amount, status: 'posted', occurredAt,
  }, paymentId),
  contracts.changes.replace('contract-total', contract, {
    ...contract.data, paidCents: contract.data.paidCents + amount,
  }),
  activities.changes.create('audit', {
    actorId: actor.id, action: 'payment.posted', paymentId, occurredAt,
  }, auditId),
], {idempotencyKey: intentKey, mode: 'sync'});
```

客户端 `apply` 发送 `atomic: true`。`replace` 携带 expectedRevision：并发两笔回款基于同一合同版本，只能有一个成功；另一笔必须重新读取并重新校验剩余额度。**不能刷新 revision 后盲目重发旧金额决定。**

进一步的通用操作：

- `record.check`：事务内确认记录存在/不存在、版本或字段条件。
- `record.read`：事务内按精确 ID 读取，配合 bindings 使用前置结果。
- `record.modify`：set/unset/increment，带条件或 expectedRevision；需要 record:read 和 record:write。
- `dependsOn` 明确顺序；同一记录的多个变更合成一次写入。先在外部 GET 检查、再单独 POST 不等于事务内检查。
- “客户只能归一个人”“只能从草稿签约”等影响多个入口的条件，应在同批次用版本或 check 保证。复杂业务规则仍放 App 服务中，不翻译为无限扩张的数据库规则 DSL。

平台事务不能回滚外部 HTTP、邮件、支付或设备动作。数据提交与外部动作需独立的任务/重试/补偿设计；测试不能顺手触发真实通知或恢复采集。

## 7. 幂等与不确定结果

1. 一次用户意图生成一个幂等键，固定整个请求内容、ID 和时间。相同内容重试沿用原键；新业务意图才使用新键。
2. `VERSION_CONFLICT`、条件失败和唯一冲突按结构化错误处理。保留 requestId、opId、path、rolledBack 等诊断信息，日志不输出 Key 或敏感数据。
3. 超时/连接断开可能发生在提交之后，展示“结果待确认”；不能当作回滚，再生成新键重复创建。
4. CRM 对跨进程重试采用 API 中的 commands 集合：保存 prepared 批次，执行时把 committed 标记与业务数据一起提交，重启后读取回执；恢复 prepared 命令前再次验证用户权限及业务前提。不得只用内存 Map 做回执。
5. commands 是按需选择的 App 模式，不要求每个 App 都新增它。若使用其他持久方案，也必须通过平台 API，证明响应丢失和进程重启不会重复业务副作用。

## 8. 查询、关联与汇总

普通列表优先服务端过滤、稳定排序和分页。不要照搬 CRM 早期“每集合最多加载 5,000 条后在内存筛选”的小规模方案作为通用规范。`in` 需要按 catalog 上限分批，不能每个客户单独请求造成 N+1，也不能悄悄丢掉下一页。

v2 的 `records/query` 支持 `relational`：inner/left 等值关联、select、where、groupBy、having、orderBy、count/sum/avg/min/max。每个关联集合都需要 record:read，字段必须在 Schema 中声明；结果为投影别名组成的平面行，不是 RecordRow。

```json
{
  "queries": [{
    "queryId": "contractTotals",
    "collectionId": "contracts-collection-id",
    "page": 1,
    "size": 50,
    "relational": {
      "joins": [{"collectionId": "customers-collection-id", "alias": "customer", "type": "inner", "on": [{"left": "base.data.customerId", "right": "customer.id"}]}],
      "select": [{"field": "customer.id", "as": "customerId"}, {"field": "base.data.amountCents", "aggregate": "sum", "as": "totalCents"}],
      "groupBy": ["customer.id"],
      "where": {"field": "base.data.status", "op": "eq", "value": "signed"},
      "orderBy": [{"field": "customerId", "direction": "asc"}]
    }
  }]
}
```

上例仅说明形状，业务服务必须补上当前用户的可见范围。关联不会自行限制“自己的客户”；不能先查全量财务信息再在浏览器隐藏。

客户名称、合同总额、回款总额：先发现当前客户页，再用**同一 records/query 请求中的三个计划**重读客户、聚合合同、聚合回款。平台在同一个 repeatable-read 快照中完成这些计划，App 按 customerId 合并聚合行。发现客户页是另一个请求，不属于该快照；并发归属变化要在最终计划重新检查权限。

不要直接把客户 × 合同 × 回款展开后求合同 SUM，会按回款笔数重复计算；`SUM(DISTINCT 金额)` 也会错误合并等额合同。分别聚合再关联结果。查询快照不锁定随后写入，仍须版本/条件事务。

不提供任意 SQL、数据库表查询或通用 Sample 历史 JOIN；时序用 samples/query。数据量、精度和查询预算以 catalog 为准，超限显式失败，不声称等价于完整 PostgreSQL/ORM。

## 9. 采集、时序与 App

业务 App 不需要先创建 Stream 才能保存数据。人工客户/合同写入直接走数据 API；需要接外部系统时，Agent 用独立管理权限配置 Source/Stream，App Key 只读取获授权的结果。

时序场景先建带 recordSchema/sampleSchema 的集合与测点 Record，再显式追加 Sample，保留来源时间（毫秒）和质量。重试同一导入请求复用幂等键，区分导入完成与持续采集开启。Source 管理的数据遵守平台写入保护，App 不伪造 sourceId 绕过。

CRM 实践中 Salesforce 的客户/联系人/商机/工单进入 Record，PI 测点定义进入 Record、历史值进入 Sample。原始来源没有客户关联就不虚构“客户设备归属”。业务页刷新只查已入库数据，不默认重新抓取外部系统。

## 10. 完成交付的检查表

- 身份、角色并集、单记录归属、列表/导出/聚合范围都经过服务端校验；跨 App 集合被平台拒绝。
- 所有业务保存、审计、导入与命令回执走 API；未引入 Drizzle、SQL、浏览器 Key 或本地业务文件。
- 创建/编辑/合法关闭/冲正等核心路径可用，刷新页面后结果仍在。
- 多集合成功、后项失败全批回滚、revision 冲突、并发金额控制经过真实 API 验证。
- 相同键相同内容回放、不同内容冲突、响应丢失和进程重启恢复可验证。
- 关联测试覆盖一对多、等额合同、无子记录、归属变化和跨页数据；时序测试覆盖历史/最新/时间/质量。
- 临时测试数据仅创建在指定环境，记录确切 ID，通过 API 清理并再次验证；不能清库，也不能让测试变成生产种子。
- 类型、构建、路由 smoke、浏览器交互及部署检查分别报告结果；规范检查不能代替运行验收。

## 事实来源

本规范于 2026-10-14 对照 Enterprise 工作分支代码核对；平台契约基线为 `78b536b6`，复杂查询文档为 catalog 3.3.0 阶段。实际目标环境始终先查 catalog。

- [App 数据 API 开发与权限](https://github.com/FREEZONEX/Tier0-Enterprise-New/blob/78b536b6/doc/uns-v2/app-api-development.md)
- [App Data 客户端源码](https://github.com/FREEZONEX/Tier0-Enterprise-New/blob/78b536b6/packages/app-data-client/src/index.ts)
- [条件事务](https://github.com/FREEZONEX/Tier0-Enterprise-New/blob/78b536b6/doc/uns-v2/conditional-transactions.md)
- [复杂查询](https://github.com/FREEZONEX/Tier0-Enterprise-New/blob/78b536b6/doc/uns-v2/complex-queries.md)
- [CRM 经验与验证范围](crm-api-lessons.md)
