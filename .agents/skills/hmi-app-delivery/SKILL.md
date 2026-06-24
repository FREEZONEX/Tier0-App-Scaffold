---
name: hmi-app-delivery
description: Take a generated HMI/SCADA customer app from "works in dev" to live on the hosting platform — environment variables, database bootstrap, gateway auth and role wiring, base-path deployment, MQTT/UNS credentials, and the post-deploy verification checklist. Use when preparing a go-live, when the deployed app shows a wrong/empty picture, when login loops or 401s appear behind the gateway, or when live MQTT data does not arrive in production. For building the picture itself use $hmi-mimic-generation / $hmi-data-binding; for role matrices use $configurable-rbac-mes.
---

# HMI 应用交付（dev 能跑 → 平台上线）

权威：`docs/platform-integration.md`（env 全表、认证三格式、平台资源模型、启动序列）。本 skill 只给交付编排顺序和文档没写透的坑。

## 交付前置：先过本地验证闸

`npx tsc --noEmit` + `npm test` + `npm run lint` + `npm run e2e` 全绿，且 `npm run dev:preview` 活体过目（schema 渲染、绑定有数据、按钮可点）。任何一项红着就不进入部署。

**但 CI 绿 ≠ 交付就绪**——tsc/test 不查的几类要补审一遍（交付审查实战抓到过）：

- **i18n 完整性**：切英文模式逐屏看，**始终可见的控件**（画布缩放/导航按钮、元件库卡片、校验横幅）最易漏翻——漏翻静默回退中文，所以 tsc/test 全绿照样英文下露中文。`grep` 硬编码中文串 + 核 `dict.ts`。
- **demo/示例数据真实性**：泵等设备「运行态」与「转速/流量」要一致（别灰停却显 91.7rpm）、别每几秒翻转跳灯（稳态工厂快照）。
- **连接缝/重叠/双线**：高倍逐接口自检（$hmi-visual-selfcheck）。
- 这类审查可派**并行子 agent** 分维度独立审（i18n / React 组件 / 图元渲染），比单线程逐个看更快更全。

## 上线序列（每步对 DB 干了什么）

```bash
npm install
npx drizzle-kit push      # 在 DB_SCHEMA 指定的 schema 下建表（mimics 等）
npx tsx src/db/seed.ts    # 种子数据——注意：mimics 表不在这里灌（见下）
npm run build             # vite build → dist/{client,server}
node server.mjs           # 监听 PORT（默认 3000）
```

**默认工艺图不走 seed.ts**：`mimics` 由**运行时 bootstrap** 灌入（`src/services/mimics.ts`，首次 HTTP 请求触发、幂等、**仅空表时**）。默认 seed 的是**空白图**（`src/hmi/data/default-mimic.json`，模板开局空画布；交付时覆盖它写客户 schema）；设 `HMI_SEED_DEMO=1` 改 seed RX-100 示例（`example-mimic.json`，供 E2E/演示）。均内嵌 bundle（import 而非读文件，容器只带 `dist/` 也能 seed）。后果两条：

- 部署完健康检查若在首次请求前查 `mimics` 会看到空表——正常非故障
- **交付客户图的正确姿势**：构建前把客户 schema 写进 `default-mimic.json`；若目标库已被旧图 seed 过，改文件不生效，需清 `mimics` 表再触发首次请求

## 环境变量（场景：平台 session 部署）

```env
DATABASE_URL=postgresql://…/<project-db>     # 必填
SESSION_SECRET=<≥32 字符随机 hex>             # 生产必填；不设则每次重启随机=所有 session 失效
DB_SCHEMA=<session-id>                        # 与 APP_ID 同值（schema-per-session 租户隔离）
APP_ID=<session-id>                           # /api/manifest 返回它
VITE_BASE_PATH=/<session-id>                  # 网关前缀；vite base + router basepath + apiUrl 三处共用
VITE_TIER0_MQTT_HOST=…  VITE_TIER0_MQTT_PORT=8084  VITE_TIER0_API_KEY=…   # 真实 MQTT；不设=回退 mock 仿真
VITE_TIER0_API_HOST=…                         # UNS 浏览（可缺，缺则选择器降级手填）
```

MQTT 三件套（HOST/PORT/API_KEY，浏览器 MQTT-over-WS 用）是**构建期**注入（Vite bundle）——必须在 `npm run build` 前就位，部署后改 MQTT host 要**重新 build**，光重启无效。例外：UNS 的 `VITE_TIER0_API_HOST`/`TIER0_API_HOST` 由 server fn 在**服务端运行时**读取（两个名字都认），改它重启即可。

## 鉴权与角色（Mode A：网关角色优先）

- 网关注入 user header（三格式任一，至少 user ID）；`role` 给了且**精确匹配**（区分大小写）`PERMISSION_MATRIX`（`src/lib/permissions.ts`）→ 自动签发 session cookie，用户全程不见 `/login`；role 缺失/未知 → fail-closed 落 `/login` 自选
- **HMI 专属动作 `edit_mimic`**：有它=可编辑画布/绑定/保存；没它=只读预览（`src/routes/index.tsx` 把 `can(role,"edit_mimic")` 传进 `HmiPage canEdit`）。注意当前**没有独立「操作权」**——只读角色也能点设备动作按钮发命令（见 $hmi-device-actions）
- 交付动作：按客户角色表改 `PERMISSION_MATRIX`（用 $configurable-rbac-mes）。模版自带的 MES 角色（sales/planner/production_supervisor/quality/warehouse…）是脚手架遗留，**按客户需求裁剪**，operator 默认没有 `edit_mimic`——客户工程师角色要编辑就加
- 平台侧对齐：平台 admin 给用户分配的 role 字符串必须与矩阵 key 一字不差；角色列表经 `GET /api/manifest` 暴露给平台

## 部署后验证清单（带 base path 逐项）

1. `curl <prefix>/api/manifest` → appId/roles 正确（证明 APP_ID 和矩阵就位）
2. 浏览器带网关 header 访问 `<prefix>/` → 直接进画面不经 `/login`（证明 Mode A 签发链通）；用未知 role 试一次 → 落 `/login`（证明 fail-closed）
3. 首页默认图加载 + 顶栏改名能保存（证明 server fn RPC 在前缀下可达——这是 base path 最易断的点）
4. 设备有实时数据、不全员 stale（证明 `VITE_TIER0_MQTT_*` 构建期注入成功）；UNS 选择器能搜 topic 或显式降级提示
5. 只读角色看不到编辑工具栏、工程师角色能编辑保存（证明 `edit_mimic` 分配正确）

## 坑速查

| 坑 | 真相 |
|----|------|
| seed.ts 跑完 mimics 还是空 | 设计如此，首次请求才 bootstrap |
| 改了 default-mimic.json 线上图没变 | 目标库非空不 seed，先清 `mimics` 表 |
| 部署后改 MQTT env 重启 | `VITE_*` 是构建期变量，必须重 build |
| role 叫 "Operator" 进不去 | 精确匹配区分大小写，`"Operator"≠"operator"` |
| SESSION_SECRET 偷懒不设 | 生产每次重启全员被登出；且多租户绝不复用同一 secret |
| 保存报错只在带前缀环境出现 | server fn RPC 没吃到 base path——按清单第 3 项定位 |
| 健康检查依赖 mimics 行数 | 首次请求前空表属正常 |
