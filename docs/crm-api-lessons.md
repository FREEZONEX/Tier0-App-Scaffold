# CRM 实践总结与验收用例

本文提炼已实现 CRM 的方法，不把 CRM 代码、角色名、业务字段或本地测试数据变成所有 App 的模板。通用规则见 [App API 开发规范](app-api-development.md)。

## 实际采用的分层

| CRM 实现 | Scaffold 中保留的思想 |
| --- | --- |
| React 页面 → Node HTTP → service → App Data client | 页面 → 同源路由 → 业务服务 → 服务端平台 API 客户端 |
| customers/contacts/leads/opportunities/contracts/payments/invoices/activities | 根据业务拆 Collection，关系使用 Record ID，不建物理业务表 |
| manager/sales/finance + members | 按真实职责定义少量角色；Scaffold 仍用 Gateway、多角色并集和 manifest，不复制本地登录桥接 |
| 合同累计额、回款记录、审计共同提交 | 一个业务命令对应一个原子 API 批次 |
| commands 保存 prepared/committed | 跨进程恢复时需要持久回执，不能只做内存幂等 |
| 客户财务汇总使用 v2 relational | 服务端聚合并施加用户可见范围，避免明细全量下载 |
| Salesforce + PI 历史导入 | 外部业务记录与时序分别入 Record/Sample，再经 API 回读验证 |

CRM 是参考案例，不是所有 App 的固定业务模板。诊断工具的直接读库能力不属于 App 数据访问契约。

## 五类逻辑不同的测试

### 1. 多集合原子成功与失败

**数据形态**：customers 中一个客户 Record，contacts 中一个带 customerId 的联系人，contracts 中一个合同。物理上都由平台 Record 存储承载，按 collectionId 区分。

**App 做什么**：校验业务输入和权限，固定 ID，组装一个 atomic 批次。不要连续发三个“创建”后再手动删除前两条模拟回滚。

**平台做什么**：同一事务校验并执行所有项。后项 Schema/权限/版本错误时，前项写入也不提交。

**断言**：成功后每条均可 API 回读且关系一致；故意让后项失败，前项不存在、已有记录 revision 不变。不能只看 HTTP 返回码。

### 2. 并发回款与乐观锁

**数据形态**：contracts 记录 amountCents、paidCents、status；payments 保存每笔回款 Record；activities 保存操作审计。

**App 做什么**：拒绝未签约合同、负数和超额回款；回款 + 合同累计额 + 审计放一个批次。合同变更携带读取时的 revision，或者构造明确的事务内条件。

**平台做什么**：检查 expectedRevision 或锁内条件，只有通过条件的批次提交；平台维护新 revision。

**断言**：两笔基于相同合同版本且总和超额的并发请求不能都成功。失败批次不能留下孤立回款或审计；冲正应与累计额回退一起提交。重试前重新计算额度，不能只替换版本号。

### 3. 请求重试与进程重启

**数据形态**：业务 Record + commands Record（actorId、requestHash、固定 changes、targetId、state）。commands 是 CRM 选择的模式，不是平台强制表。

**App 做什么**：同一命令固定请求内容与幂等键；准备内容通过 API 持久化，完成标记与业务变更原子提交。恢复 prepared 命令前检查当前权限和业务条件。

**平台做什么**：同键同内容重放成功结果，同键不同内容拒绝；成功回执与业务事务一起提交。网络超时本身不能证明回滚。

**断言**：重复点击、并发重试、提交后响应丢失、App 进程重启都只产生一份业务结果；权限被撤销后不能继续恢复执行。不能靠“进程内第二次返回缓存”作为全部验收。

### 4. 客户关联与财务汇总

**数据形态**：contracts.data.customerId 指客户；payments.data.contractId 指合同。相同客户名称不是同一客户，相同合同金额不是同一合同。

**App 做什么**：发现客户页，再在同一个 records/query 请求中提交客户、合同汇总、回款汇总三个计划；在计划中约束当前用户可见范围，最后按 customerId 合并聚合结果。

**平台做什么**：执行受 Collection 授权和 Schema 约束的 JOIN/聚合；同一批量查询使用一致快照。分别发出的 HTTP 查询不共享快照。

**断言**：等名客户、等额合同、多笔/冲正回款、无子记录、超过一页及并发变更都正确。不要 JOIN 展开后重复 SUM 合同；不要 SUM(DISTINCT 金额)。验证无权限用户既拿不到明细，也拿不到对应聚合金额。

### 5. 历史采样与业务数据共同接入

**数据形态**：外部 CRM 客户/联系人/商机是 Record；PI 信号定义是 Record，每个时间点是对应 Sample。Sample 指向同一 Collection 内的 recordId。

**App / 导入器做什么**：取得用户授权后只读访问来源，保留外部稳定 ID、时间和质量，通过平台 API 写入；同一导入重试固定请求与幂等键。不要凭空建立来源未提供的客户设备关联。

**平台做什么**：校验 sampleSchema、记录归属、授权及原子批次；提供 history/latest API。

**断言**：逐条回读的值、时间、质量与来源一致；最新值正确；重放不重复；失败批次不部分入库。App 的“刷新”只重新读已入库数据；一次历史导入不代表持续采集已开启。

## 如何判断哪些是通用能力

| 通用平台能力 | 留在 App 的业务决策 |
| --- | --- |
| Schema、uniqueKeys、集合授权 | 客户生命周期、销售阶段、谁能看哪一客户 |
| revision、check/read/modify、atomic 批次 | 是否允许签约、还可回款多少、如何冲正 |
| 幂等回执、异步作业状态 | 一次用户意图的边界、恢复时是否仍有业务权限 |
| Record JOIN/聚合、Sample 历史查询 | 什么叫合同总额、哪些状态排除、如何向用户展示 |

普通字符串关联不是自动外键；需要在写入时保证父记录条件的业务，在同批次检查。不要为了“Agent 更容易写”让浏览器直接拿宽权限 Key；也不要把所有业务规则升级成数据库层 DSL。

## 证据与边界

本次编写规范核对了工作区中的 `examples/crm/README.md`、`server/service.ts`、`server/data.ts`、`server/command-journal.ts`、`server/customer-summary.ts`、初始化/导入与事务/汇总测试脚本，以及平台源码客户端和契约。

- 这些文件说明已实现路径和已有测试范围，**本次文档提交没有重新执行 CRM 集成测试**，不报告新的通过次数或性能结论。
- CRM 使用独立 React/Node 本地预览，不等于 TanStack Scaffold 生产部署已经打通；不要复制其相对路径导入、固定端口、登录桥接和工作区 ID。
- 早期全量快照和固定小规模关联测试不是性能基准。财务汇总已改为 v2 聚合；其他列表仍须按实际规模做服务端分页。
