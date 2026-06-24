# Tier0 UNS Topic 选择器（C）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 绑定/发布面板的 topic 不再只能手填——从平台 UNS 命名空间 `browse`/`search` 拿真实 topic，选中可看其 schema 字段 + 最新值（`read`），无 Tier0 env 时优雅降级为手填。

**Architecture:** `@tier0/sdk/openapi` 的 `unsApi`（REST，需 API key）经 **TanStack `createServerFn` 服务端封装**（key 不进浏览器），返回归一化 DTO。纯归一化层 `uns-normalize.ts` 单测覆盖；`UnsTopicPicker.tsx` 搜索/列表/详情 UI；接入 `TopicManager`（绑定）+ `PublishPanel`（发布）。

**Tech Stack:** `@tier0/sdk/openapi`（已装 v0.1.2）、TanStack Start `createServerFn`、zod、node:test、React 19、Playwright。

**Spec:** `docs/superpowers/specs/2026-06-09-tier0-sdk-integration-design.md` 的 **C** 节（A、B 已实现并合并 main@cd33224）。

---

## 关键参考（已核对 SDK 真实类型，勿再猜）

`@tier0/sdk/openapi` 导出 `unsApi`、`configureClient`、`getClient`（`node_modules/@tier0/sdk/dist/esm/openapi/`）：

- **`unsApi.openapiv1unsbrowse(BrowseReq)`** → 响应体 `{ data: BrowseResp }`，`BrowseResp = { tree: OpenapiNodeInfo[] }`
  - `BrowseReq = { path?: string; max_depth?: number; include_leaf_value?: boolean; include_metadata?: boolean }`
- **`unsApi.openapiv1unssearch(SearchReq)`** → `{ data: SearchResp }`，`SearchResp = { objects: OpenapiNodeInfo[]; total: number; page: number; size: number }`
  - `SearchReq = { keyword?: string; path_prefix?: string; topicType?: string; page?: number; size?: number; include_leaf_value?: boolean; include_metadata?: boolean }`
- **`unsApi.openapiv1unsread(ReadReq)`** → `{ data: ReadResp }`，`ReadResp = { results: OpenapiReadItem[]; success: boolean }`
  - `ReadReq = { topics: string[]; include_leaf_value?: boolean; include_metadata?: boolean }`
- 节点详情类型：
  - `OpenapiNodeInfo = { id: number; name: string; path: string; type: string; topicType: string; displayName?: string; description?: string; alias?: string; children?: OpenapiNodeInfo[]; fields?: SchemaField[]; payload?: OpenapiVQT }`
  - `OpenapiReadItem = { topic: string; success: boolean; result?: OpenapiVQT; metadata?: OpenapiNodeInfo; error?: {...} }`
  - `OpenapiVQT = { value?: Record<string, never>; quality: string; timeStamp: number }`
  - `SchemaField = { name: string; type: string; unit?: string }`
- 所有 `unsApi.*` 方法 TS 签名是 `Promise<any>`——**响应是 `any`，必须运行时取 `.data` 并防御性归一化**（响应可能已被 HttpClient 解包，故 `resp.data ?? resp`）。

**env / 鉴权**：openapi `HttpClient` 默认从 `TIER0_API_HOST` / `TIER0_API_KEY` 读（`Authorization: Bearer <key>`），缺 host 抛 `apiHost is required`。server fn 跑在 Node 服务端，用 `configureClient` 显式注入 getter，只读无前缀 `TIER0_*`。

**createServerFn 序列化约束**（见 `mimic-store.ts` 的 `MimicDto` 注释）：TanStack 编译期校验 server fn 返回值可序列化，`unknown` / `Record<string, unknown>` 会编译报错。故 `OpenapiVQT.value`（`Record<string, never>`）**必须以 JSON 字符串穿越边界**（`valueJson: string`），客户端再 `JSON.parse`。

**现有 createServerFn 写法**（`src/hmi/data/mimic-store.ts:89`）：
```ts
export const fooFn = createServerFn({ method: "POST" })
  .inputValidator((input: { ... }) => z.object({ ... }).parse(input))
  .handler(async ({ data }): Promise<Dto> => { ... });
```

**接入点**：
- `src/hmi/components/TopicManager.tsx`：`draft`/`add()`/`onAdd` 已在；topic 输入框 + 「添加」按钮（40–60 行）。
- `src/hmi/components/PublishPanel.tsx`：topic `<select>`（55–66 行）+ `MANUAL` 手填分支（68–76 行）；`setTopicSel`/`setManualTopic` 已在。
- `src/hmi/i18n/dict.ts`：zh-as-key 词典，新字符串补 en。

---

## File Structure

- **Create** `src/hmi/data/uns-normalize.ts` — 纯归一化：UNS 响应 → `UnsTopic[]` / `UnsTopicDetail`（含 `pickData` 解包、`flattenNodes`、`browseToTopics`/`searchToTopics`/`readToDetail`）
- **Create** `src/hmi/data/uns-normalize.test.ts`
- **Create** `src/hmi/data/uns-api.ts` — `configureClient` + 3 个 server fn（`browseUnsFn`/`searchUnsFn`/`readTopicFn`）+ `unsConfigured()`
- **Create** `src/hmi/components/UnsTopicPicker.tsx` — 搜索框 + 结果列表 + 选中详情（fields + 最新值）+ 不可用降级
- **Modify** `src/hmi/components/TopicManager.tsx` — 「UNS」按钮切换 picker，选中即 `onAdd`
- **Modify** `src/hmi/components/PublishPanel.tsx` — 「UNS」按钮切换 picker，选中回填手填 topic
- **Modify** `src/hmi/i18n/dict.ts` — 新增字符串 en 翻译
- **Modify** `e2e/hmi.spec.ts` — dev 无 Tier0：picker 显示「不可用，手填」不崩
- **Modify** `docs/platform-integration.md` — UNS 一节（env + server fn + 降级）

---

## Task 1: uns-normalize.ts（纯归一化 + 类型）

**Files:** Create `src/hmi/data/uns-normalize.ts` + `uns-normalize.test.ts`

- [ ] **Step 1: 写失败测试 `uns-normalize.test.ts`**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickData, browseToTopics, searchToTopics, readToDetail } from "./uns-normalize";

const browseResp = {
  data: {
    tree: [
      {
        id: 1, name: "plant", path: "plant", type: "folder", topicType: "",
        children: [
          { id: 2, name: "P-101", path: "plant/P-101", type: "topic", topicType: "json", displayName: "进料泵A",
            fields: [{ name: "rpm", type: "number", unit: "rpm" }],
            payload: { value: { rpm: 90 }, quality: "good", timeStamp: 1700000000 } },
        ],
      },
    ],
  },
};

const searchResp = {
  data: {
    objects: [{ id: 2, name: "P-101", path: "plant/P-101", type: "topic", topicType: "json" }],
    total: 1, page: 1, size: 20,
  },
};

const readResp = {
  data: {
    success: true,
    results: [
      { topic: "plant/P-101", success: true,
        result: { value: { rpm: 90 }, quality: "good", timeStamp: 1700000000 },
        metadata: { id: 2, name: "P-101", path: "plant/P-101", type: "topic", topicType: "json",
          fields: [{ name: "rpm", type: "number", unit: "rpm" }] } },
    ],
  },
};

describe("uns-normalize", () => {
  it("pickData 解包 {data:X} 与裸 X", () => {
    assert.deepEqual(pickData({ data: { a: 1 } }), { a: 1 });
    assert.deepEqual(pickData({ a: 1 }), { a: 1 });
    assert.equal(pickData(null), undefined);
  });

  it("browseToTopics 扁平化树，文件夹标 hasChildren", () => {
    const topics = browseToTopics(browseResp);
    assert.deepEqual(topics.map((t) => t.path), ["plant", "plant/P-101"]);
    assert.equal(topics[0].hasChildren, true);
    assert.equal(topics[1].hasChildren, false);
    assert.equal(topics[1].displayName, "进料泵A");
  });

  it("browseToTopics 容空/缺字段不崩", () => {
    assert.deepEqual(browseToTopics({}), []);
    assert.deepEqual(browseToTopics({ data: { tree: [] } }), []);
  });

  it("searchToTopics 返回 items + total/page/size", () => {
    const r = searchToTopics(searchResp);
    assert.equal(r.total, 1);
    assert.equal(r.items.length, 1);
    assert.equal(r.items[0].path, "plant/P-101");
  });

  it("readToDetail 提取值(JSON 串)+ 质量 + fields", () => {
    const d = readToDetail(readResp, "plant/P-101");
    assert.equal(d.ok, true);
    assert.equal(d.topic, "plant/P-101");
    assert.equal(d.valueJson, JSON.stringify({ rpm: 90 }));
    assert.equal(d.quality, "good");
    assert.deepEqual(d.fields, [{ name: "rpm", type: "number", unit: "rpm" }]);
  });

  it("readToDetail 缺该 topic → ok:false", () => {
    const d = readToDetail(readResp, "missing");
    assert.equal(d.ok, false);
    assert.deepEqual(d.fields, []);
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

Run: `node --import tsx --test src/hmi/data/uns-normalize.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 `uns-normalize.ts`**

```ts
/** UNS 命名空间节点（归一化后，全部可序列化穿 server fn 边界）。 */
export interface UnsTopic {
  path: string;
  name: string;
  displayName?: string;
  type?: string;
  topicType?: string;
  hasChildren: boolean;
}

/** topic schema 字段。 */
export interface UnsSchemaField {
  name: string;
  type: string;
  unit?: string;
}

/** read 出的 topic 详情（value 以 JSON 串穿边界）。 */
export interface UnsTopicDetail {
  topic: string;
  ok: boolean;
  valueJson?: string;
  quality?: string;
  timeStamp?: number;
  fields: UnsSchemaField[];
}

/** OpenapiNodeInfo 的最小结构（只取归一化要用的字段）。 */
interface RawNode {
  name?: string;
  path?: string;
  type?: string;
  topicType?: string;
  displayName?: string;
  children?: RawNode[];
  fields?: UnsSchemaField[];
}

/** unsApi 返回是 any：HttpClient 可能已解包，也可能是 {data:X}。统一取里层。 */
export function pickData(resp: unknown): unknown {
  if (resp && typeof resp === "object" && "data" in resp) return (resp as { data: unknown }).data;
  return resp ?? undefined;
}

/** DFS 扁平化命名空间树（父在前，子随后）。 */
function flattenNodes(nodes: readonly RawNode[]): RawNode[] {
  const out: RawNode[] = [];
  for (const n of nodes) {
    out.push(n);
    if (n.children?.length) out.push(...flattenNodes(n.children));
  }
  return out;
}

const toTopic = (n: RawNode): UnsTopic => ({
  path: n.path ?? "",
  name: n.name ?? n.path ?? "",
  displayName: n.displayName,
  type: n.type,
  topicType: n.topicType,
  hasChildren: !!n.children?.length,
});

/** browse 响应 → 扁平 topic 列表。 */
export function browseToTopics(resp: unknown): UnsTopic[] {
  const data = pickData(resp) as { tree?: RawNode[] } | undefined;
  return flattenNodes(data?.tree ?? []).filter((n) => n.path).map(toTopic);
}

/** search 响应 → { items, total, page, size }。 */
export function searchToTopics(resp: unknown): { items: UnsTopic[]; total: number; page: number; size: number } {
  const data = pickData(resp) as { objects?: RawNode[]; total?: number; page?: number; size?: number } | undefined;
  return {
    items: (data?.objects ?? []).filter((n) => n.path).map(toTopic),
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    size: data?.size ?? 0,
  };
}

interface RawReadItem {
  topic?: string;
  success?: boolean;
  result?: { value?: unknown; quality?: string; timeStamp?: number };
  metadata?: { fields?: UnsSchemaField[] };
}

/** read 响应 → 指定 topic 的详情。值序列化为 JSON 串；缺该 topic 返回 ok:false。 */
export function readToDetail(resp: unknown, topic: string): UnsTopicDetail {
  const data = pickData(resp) as { results?: RawReadItem[] } | undefined;
  const item = (data?.results ?? []).find((r) => r.topic === topic);
  if (!item || item.success === false) return { topic, ok: false, fields: [] };
  return {
    topic,
    ok: true,
    valueJson: item.result?.value === undefined ? undefined : JSON.stringify(item.result.value),
    quality: item.result?.quality,
    timeStamp: item.result?.timeStamp,
    fields: item.metadata?.fields ?? [],
  };
}
```

- [ ] **Step 4: 跑测试，确认通过**

Run: `node --import tsx --test src/hmi/data/uns-normalize.test.ts`
Expected: PASS（6 tests）

- [ ] **Step 5: Commit**

```bash
git add src/hmi/data/uns-normalize.ts src/hmi/data/uns-normalize.test.ts
git commit -m "feat(hmi): uns-normalize 归一化 UNS browse/search/read 响应"
```

---

## Task 2: uns-api.ts（server fn 封装）

**Files:** Create `src/hmi/data/uns-api.ts`

- [ ] **Step 1: 实现 `uns-api.ts`**

```ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { unsApi, configureClient } from "@tier0/sdk/openapi";
import {
  browseToTopics, searchToTopics, readToDetail,
  type UnsTopic, type UnsTopicDetail,
} from "./uns-normalize";

// 给组件层一个统一入口（picker 从这里取类型 + server fn）。
export type { UnsTopic, UnsTopicDetail } from "./uns-normalize";

// server fn 跑在 Node 服务端：process.env 有平台注入的无前缀 TIER0_* 变量。
const env = (k: string): string | undefined =>
  (typeof process !== "undefined" ? process.env[k] : undefined) || undefined;
const apiHost = (): string | undefined => env("TIER0_API_HOST");
const apiKey = (): string | undefined => env("TIER0_API_KEY");

// 显式注入凭证 getter（不依赖 SDK 默认 env 名/前缀假设）。
configureClient({ getApiHost: apiHost, getApiKey: apiKey });

/** 是否配了 UNS（server 侧判断）。无 host → 调用会抛，故提前短路。 */
const configured = (): boolean => !!apiHost();

export const browseUnsFn = createServerFn({ method: "POST" })
  .inputValidator((input: { path?: string; maxDepth?: number }) =>
    z.object({ path: z.string().optional(), maxDepth: z.number().int().positive().max(10).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ available: boolean; topics: UnsTopic[] }> => {
    if (!configured()) return { available: false, topics: [] };
    try {
      const resp = await unsApi.openapiv1unsbrowse({
        path: data.path, max_depth: data.maxDepth ?? 3, include_metadata: true,
      });
      return { available: true, topics: browseToTopics(resp) };
    } catch {
      return { available: false, topics: [] };
    }
  });

export const searchUnsFn = createServerFn({ method: "POST" })
  .inputValidator((input: { keyword: string; pathPrefix?: string; page?: number; size?: number }) =>
    z.object({
      keyword: z.string(), pathPrefix: z.string().optional(),
      page: z.number().int().positive().optional(), size: z.number().int().positive().max(100).optional(),
    }).parse(input),
  )
  .handler(async ({ data }): Promise<{ available: boolean; items: UnsTopic[]; total: number }> => {
    if (!configured()) return { available: false, items: [], total: 0 };
    try {
      const resp = await unsApi.openapiv1unssearch({
        keyword: data.keyword, path_prefix: data.pathPrefix,
        page: data.page ?? 1, size: data.size ?? 30, include_metadata: true,
      });
      const r = searchToTopics(resp);
      return { available: true, items: r.items, total: r.total };
    } catch {
      return { available: false, items: [], total: 0 };
    }
  });

export const readTopicFn = createServerFn({ method: "POST" })
  .inputValidator((input: { topic: string }) => z.object({ topic: z.string().min(1) }).parse(input))
  .handler(async ({ data }): Promise<{ available: boolean; detail?: UnsTopicDetail }> => {
    if (!configured()) return { available: false };
    try {
      const resp = await unsApi.openapiv1unsread({ topics: [data.topic], include_leaf_value: true, include_metadata: true });
      return { available: true, detail: readToDetail(resp, data.topic) };
    } catch {
      return { available: false };
    }
  });
```

- [ ] **Step 2: 校验类型（含 server fn 返回可序列化）**

Run: `npx tsc --noEmit`
Expected: 无错误（若报 `value` 不可序列化，说明哪处漏了 JSON 串化——回查 `UnsTopicDetail`）

- [ ] **Step 3: Commit**

```bash
git add src/hmi/data/uns-api.ts
git commit -m "feat(hmi): uns-api server fn 封装 browse/search/read（env-gated 降级）"
```

---

## Task 3: UnsTopicPicker.tsx

**Files:** Create `src/hmi/components/UnsTopicPicker.tsx`

- [ ] **Step 1: 实现 `UnsTopicPicker.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Search, X, Loader2 } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { searchUnsFn, readTopicFn } from "@/hmi/data/uns-api";
import type { UnsTopic, UnsTopicDetail } from "@/hmi/data/uns-api";

/**
 * 从 UNS 命名空间搜索 topic：输入关键字→服务端 search→列表；点条目→read 出详情(fields+最新值)；「选用」回填。
 * 无 Tier0 env（dev）时服务端返回 available:false → 显示「不可用，手填」，不阻断手填流程。
 */
export function UnsTopicPicker({
  onSelect,
  onClose,
}: {
  onSelect: (topic: string) => void;
  onClose?: () => void;
}) {
  const t = useT();
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<UnsTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [detail, setDetail] = useState<UnsTopicDetail | null>(null);
  const [detailFor, setDetailFor] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    setSearched(true);
    setDetail(null);
    setDetailFor(null);
    try {
      const r = await searchUnsFn({ data: { keyword: keyword.trim() } });
      setUnavailable(!r.available);
      setItems(r.items);
    } catch {
      setUnavailable(true);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (topic: string) => {
    if (detailFor === topic) {
      setDetail(null);
      setDetailFor(null);
      return;
    }
    setDetailFor(topic);
    setDetail(null);
    try {
      const r = await readTopicFn({ data: { topic } });
      setDetail(r.detail ?? { topic, ok: false, fields: [] });
    } catch {
      setDetail({ topic, ok: false, fields: [] });
    }
  };

  return (
    <div className="mt-1 rounded-sm border border-border bg-surface-inset p-2" data-testid="uns-picker">
      <div className="mb-1 flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("从 UNS 选 topic")}</span>
        <span className="flex-1" />
        {onClose ? (
          <button type="button" onClick={onClose} aria-label={t("关闭")} className="text-muted-foreground hover:text-foreground">
            <X className="size-3" />
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void search()}
          placeholder={t("搜索 topic 关键字")}
          className="min-w-0 flex-1 rounded-sm border border-input bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground"
          data-testid="uns-search-input"
        />
        <button
          type="button"
          onClick={() => void search()}
          aria-label={t("搜索")}
          className="flex shrink-0 items-center gap-0.5 rounded-sm border border-input px-1.5 py-0.5 text-[10px] text-foreground hover:bg-background"
          data-testid="uns-search-btn"
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
          {t("搜索")}
        </button>
      </div>

      {unavailable ? (
        <p className="mt-1 text-[10px] text-muted-foreground" data-testid="uns-unavailable">{t("UNS 不可用，请手填 topic")}</p>
      ) : searched && !loading && items.length === 0 ? (
        <p className="mt-1 text-[10px] text-muted-foreground">{t("无匹配 topic")}</p>
      ) : (
        <ul className="mt-1 max-h-40 space-y-0.5 overflow-auto" data-testid="uns-result-list">
          {items.map((it) => (
            <li key={it.path} className="rounded-sm border border-border bg-background">
              <div className="flex items-center gap-1 px-1.5 py-0.5">
                <button
                  type="button"
                  onClick={() => void openDetail(it.path)}
                  className="min-w-0 flex-1 truncate text-left font-mono text-[10px] text-foreground hover:text-highlight-text"
                  title={it.path}
                >
                  {it.path}{it.displayName ? <span className="ml-1 text-muted-foreground">· {it.displayName}</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => onSelect(it.path)}
                  className="shrink-0 rounded-sm border border-input px-1 py-0.5 text-[10px] text-foreground hover:bg-surface-inset"
                  data-testid={`uns-pick-${it.path}`}
                >
                  {t("选用")}
                </button>
              </div>
              {detailFor === it.path ? (
                <div className="border-t border-border px-1.5 py-1" data-testid="uns-detail">
                  {detail === null ? (
                    <p className="text-[10px] text-muted-foreground">{t("读取中…")}</p>
                  ) : !detail.ok ? (
                    <p className="text-[10px] text-muted-foreground">{t("读不到该 topic 详情")}</p>
                  ) : (
                    <div className="space-y-0.5">
                      {detail.fields.length > 0 ? (
                        <p className="text-[10px] text-muted-foreground">
                          {t("字段")}: {detail.fields.map((f) => `${f.name}:${f.type}${f.unit ? `(${f.unit})` : ""}`).join("，")}
                        </p>
                      ) : null}
                      {detail.valueJson ? (
                        <pre className="overflow-auto rounded-sm bg-surface-inset p-1 font-mono text-[10px] text-foreground">{detail.valueJson}</pre>
                      ) : <p className="text-[10px] text-muted-foreground">{t("暂无最新值")}</p>}
                    </div>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 校验**

Run: `npx tsc --noEmit && npx eslint src/hmi/components/UnsTopicPicker.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/hmi/components/UnsTopicPicker.tsx
git commit -m "feat(hmi): UnsTopicPicker 搜索/列表/详情 + 不可用降级"
```

---

## Task 4: 接入 TopicManager（绑定 topic 从 UNS 选）

**Files:** Modify `src/hmi/components/TopicManager.tsx`

- [ ] **Step 1: 加 import + state + UNS 按钮 + 渲染 picker**

`TopicManager.tsx` 顶部 import 追加：
```tsx
import { Plus, X, Network } from "lucide-react";
import { UnsTopicPicker } from "./UnsTopicPicker";
```
（把原 `import { Plus, X } from "lucide-react";` 整行替换为上面第一行。）

在 `const [draft, setDraft] = useState("");`（21 行）下加：
```tsx
  const [pickerOpen, setPickerOpen] = useState(false);
  const addTopic = (topic: string) => {
    const tp = topic.trim();
    if (tp && !topics.includes(tp)) onAdd(tp);
  };
```

把「添加」按钮（49–59 行的 `<button ... data-testid="topic-add-btn">…</button>`）后面、`</div>`（60 行 flex 容器闭合）前，插入 UNS 切换按钮：
```tsx
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label={tt("从 UNS 选 topic")}
          title={tt("从 UNS 命名空间选 topic")}
          className="flex shrink-0 items-center gap-0.5 rounded-sm border border-input px-1.5 py-0.5 text-[10px] text-foreground hover:bg-surface-inset"
          data-testid="topic-uns-btn"
        >
          <Network className="size-3" />
          UNS
        </button>
```

在该 flex 容器 `</div>`（60 行）之后插入 picker：
```tsx
      {pickerOpen ? (
        <UnsTopicPicker
          onSelect={(topic) => { addTopic(topic); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
```

- [ ] **Step 2: 校验**

Run: `npx tsc --noEmit && npx eslint src/hmi/components/TopicManager.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/hmi/components/TopicManager.tsx
git commit -m "feat(hmi): 绑定 topic 支持从 UNS 选"
```

---

## Task 5: 接入 PublishPanel（发布 topic 从 UNS 选）

**Files:** Modify `src/hmi/components/PublishPanel.tsx`

- [ ] **Step 1: import + state + 按钮 + picker**

顶部 import 追加：
```tsx
import { Send, Save, Trash2, Network } from "lucide-react";
import { UnsTopicPicker } from "./UnsTopicPicker";
```
（替换原 `import { Send, Save, Trash2 } from "lucide-react";` 整行。）

在 `const [payload, setPayload] = useState(...)`（31 行）下加：
```tsx
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickUnsTopic = (tp: string) => {
    setTopicSel(MANUAL);
    setManualTopic(tp);
    setPickerOpen(false);
  };
```

把 topic `<select>`（55–66 行）整块用一个带「UNS」按钮的行包起来——将 `<select ...>…</select>` 替换为：
```tsx
      <div className="mb-1.5 flex items-center gap-1">
        <select
          value={topicSel}
          onChange={(e) => onTopicChange(e.target.value)}
          aria-label={t("主题 topic")}
          data-testid="publish-topic"
          className="h-7 min-w-0 flex-1 rounded-sm border border-border bg-background px-2 text-xs text-foreground"
        >
          {topicOptions.map((tp) => (
            <option key={tp} value={tp}>{tp}</option>
          ))}
          <option value={MANUAL}>{t("手填主题")}</option>
        </select>
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label={t("从 UNS 选 topic")}
          title={t("从 UNS 命名空间选 topic")}
          className="flex h-7 shrink-0 items-center gap-0.5 rounded-sm border border-border px-1.5 text-[10px] text-foreground hover:bg-surface-inset"
          data-testid="publish-uns-btn"
        >
          <Network className="size-3" /> UNS
        </button>
      </div>
      {pickerOpen ? (
        <UnsTopicPicker onSelect={pickUnsTopic} onClose={() => setPickerOpen(false)} />
      ) : null}
```
（注意：原 `<select>` 上的 `mb-1.5` 改到外层 `<div>`，`w-full` 改 `min-w-0 flex-1`。）

- [ ] **Step 2: 校验**

Run: `npx tsc --noEmit && npx eslint src/hmi/components/PublishPanel.tsx`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/hmi/components/PublishPanel.tsx
git commit -m "feat(hmi): 发布面板 topic 支持从 UNS 选"
```

---

## Task 6: i18n + 文档

**Files:** Modify `src/hmi/i18n/dict.ts`、`docs/platform-integration.md`

- [ ] **Step 1: dict.ts 补 en 翻译**

`src/hmi/i18n/dict.ts` 的 en 字典对象里追加（键为中文源串，沿用 zh-as-key；定位现有 `"手填主题":` 等条目附近）：
```ts
  "从 UNS 选 topic": "Pick from UNS",
  "从 UNS 命名空间选 topic": "Pick a topic from the UNS namespace",
  "搜索 topic 关键字": "Search topic keyword",
  "搜索": "Search",
  "选用": "Use",
  "UNS 不可用，请手填 topic": "UNS unavailable — enter topic manually",
  "无匹配 topic": "No matching topic",
  "读取中…": "Reading…",
  "读不到该 topic 详情": "Cannot read topic detail",
  "字段": "Fields",
  "暂无最新值": "No latest value",
  "关闭": "Close",
```
（漏翻会静默回退中文、不报错，但仍应补全。）

- [ ] **Step 2: platform-integration.md 在「MQTT 数据源」一节后追加「UNS 命名空间」一节**

```markdown
## UNS 命名空间（topic 选择）

绑定 / 发布面板可从平台 UNS 命名空间选 topic（搜索 + 查看字段 schema 与最新值），走 `@tier0/sdk/openapi` 的 `unsApi`（REST，带 API key）。

- **服务端封装**：调用经 TanStack `createServerFn`（`src/hmi/data/uns-api.ts`）在服务端发起，API key **不进浏览器**。
- **env**：`TIER0_API_HOST` / `TIER0_API_KEY`，由平台注入，server fn 从 Node `process.env` 读取。
- **降级**：未配 env 时 server fn 返回 `available:false`，选择器显示「UNS 不可用，请手填」，不阻断手填 topic。
```

- [ ] **Step 3: Commit**

```bash
git add src/hmi/i18n/dict.ts docs/platform-integration.md
git commit -m "docs: UNS topic 选择 i18n + 平台集成说明"
```

---

## Task 7: E2E 降级 + 全量验证

**Files:** Modify `e2e/hmi.spec.ts`

- [ ] **Step 1: 加降级 E2E（dev 无 Tier0 env）**

`e2e/hmi.spec.ts` 在「MQTT 发布面板」用例后追加：
```ts
  test("UNS 选择器：dev 无 Tier0 → 显示不可用，可关闭", async ({ page }) => {
    await page.goto("/");
    const canvas = page.getByTestId("hmi-canvas");
    await expect(canvas).toBeVisible();
    await expect(page.getByTestId("conn-status")).toContainText("已连接", { timeout: 10_000 });
    const box = await canvas.boundingBox();
    if (!box) throw new Error("no canvas box");
    for (const fx of [0.5, 0.35, 0.65, 0.2, 0.8]) {
      await canvas.click({ position: { x: box.width * fx, y: box.height / 2 } });
      if (await page.getByTestId("inspector").isVisible()) break;
    }
    await expect(page.getByTestId("inspector")).toBeVisible();

    // 发布面板「UNS」按钮 → 选择器出现 → 搜索 → 不可用提示（dev 无 Tier0 env）
    await page.getByTestId("publish-uns-btn").click();
    await expect(page.getByTestId("uns-picker")).toBeVisible();
    await page.getByTestId("uns-search-btn").click();
    await expect(page.getByTestId("uns-unavailable")).toBeVisible({ timeout: 10_000 });
  });
```

- [ ] **Step 2: tsc + lint + 单测**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: tsc 0；lint 仅既有噪音（`.remember/tmp/*`、`Shell.tsx`）；单测全过（多 uns-normalize 6 测）

- [ ] **Step 3: E2E**

Run: `npm run e2e`
Expected: 新增降级用例过；既有 2 个 pre-existing 失败（上传 schema / 状态图例）仍在，非本次引入

- [ ] **Step 4: 浏览器实测（dev 无 Tier0 env）**

`npm run dev:preview`：选设备→发布面板点「UNS」→出选择器→搜索→显示「UNS 不可用，请手填」；绑定 TOPICS 区点「UNS」同样降级。手填 topic 仍正常。截图确认。

- [ ] **Step 5: Commit**

```bash
git add e2e/hmi.spec.ts
git commit -m "test(hmi): UNS 选择器降级 E2E"
```

---

## 收尾验证清单
- [ ] `tsc --noEmit` + `npm test` + `eslint` 干净（server fn 返回均可序列化）
- [ ] dev（无 Tier0）：UNS 按钮→选择器→搜索→「不可用，手填」，不崩、不阻断手填
- [ ] 真实 Tier0 env 联调（需 `TIER0_API_HOST`/`KEY`）：search 出真实 topic、点条目读出 fields+最新值、「选用」回填——**需真实凭证，dev 无法验，部署后手测**
```
