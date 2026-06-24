"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, ChevronDown, FileText, Loader2 } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { browseUnsFn, type UnsTopic } from "@/hmi/data/uns-api";
import { rememberUnsTopicFields } from "@/hmi/data/uns-topic-fields";
import { visibleRows } from "@/hmi/data/uns-tree";

const ROOT = "";

/**
 * UNS 命名空间树形浏览（懒加载）：不知道关键词时逐层展开命名空间挑 topic。
 * 与 UnsTopicInput 的 type-ahead 搜索互补：搜索靠关键词、浏览靠层级。
 * 点文件夹节点（hasChildren）懒加载其子层；点叶子（指标节点）→ onPick 选中。
 * 无 Tier0 env → browse available=false → 降级提示，照常手填。
 */
export function UnsTopicBrowser({ onPick, onClose }: { onPick: (topic: string) => void; onClose: () => void }) {
  const t = useT();
  const [childrenOf, setChildrenOf] = useState<Record<string, UnsTopic[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [available, setAvailable] = useState<boolean | null>(null); // null=首帧未知

  const load = useCallback(async (path: string) => {
    setLoading((s) => new Set(s).add(path));
    try {
      // max_depth 含查询点自身：带 path 需 2 才返回其孩子（=1 只回 P 自己，子层永远为空）
      const r = await browseUnsFn({ data: { path: path || undefined, maxDepth: path ? 2 : 1 } });
      setAvailable(r.available);
      setChildrenOf((m) => ({ ...m, [path]: r.topics }));
    } catch {
      setAvailable(false);
    } finally {
      setLoading((s) => {
        const n = new Set(s);
        n.delete(path);
        return n;
      });
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load(ROOT);
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  const onRow = (node: UnsTopic) => {
    if (!node.hasChildren) {
      // 叶子=指标节点：记字段供绑定下拉用，选中回填
      if (node.fields?.length) rememberUnsTopicFields(node.path, node.fields);
      onPick(node.path);
      return;
    }
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(node.path)) {
        n.delete(node.path);
      } else {
        n.add(node.path);
        if (!childrenOf[node.path]) void load(node.path); // 首次展开懒加载
      }
      return n;
    });
  };

  // 扁平化可见行（按展开态深度优先；visibleRows 自带环防护，绝不无限递归）
  const rows = visibleRows(childrenOf, expanded);

  return (
    <div
      className="absolute left-0 right-0 top-full z-30 mt-0.5 max-h-60 overflow-y-auto rounded-sm border border-border bg-card shadow-md"
      data-testid="uns-browser"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between border-b border-border px-1.5 py-1">
        <span className="text-[10px] font-semibold text-muted-foreground">{t("浏览 UNS 命名空间")}</span>
        <button type="button" onClick={onClose} className="text-[10px] text-muted-foreground hover:text-foreground">
          {t("关闭")}
        </button>
      </div>
      {available === false ? (
        <p className="px-1.5 py-2 text-[10px] text-muted-foreground" data-testid="uns-browser-unavailable">
          {t("UNS 不可用，请手填 topic")}
        </p>
      ) : available === null && loading.has(ROOT) ? (
        <p className="px-1.5 py-2 text-[10px] text-muted-foreground">{t("加载中…")}</p>
      ) : rows.length === 0 ? (
        <p className="px-1.5 py-2 text-[10px] text-muted-foreground">{t("无内容")}</p>
      ) : (
        <ul>
          {rows.map(({ node, depth }) => (
            <li key={node.path}>
              <button
                type="button"
                onClick={() => onRow(node)}
                title={node.path}
                style={{ paddingLeft: 6 + depth * 12 }}
                className="flex w-full items-center gap-1 py-0.5 pr-1.5 text-left hover:bg-surface-inset"
                data-testid={`uns-node-${node.path}`}
              >
                {node.hasChildren ? (
                  loading.has(node.path) ? (
                    <Loader2 className="size-3 shrink-0 animate-spin text-muted-foreground" />
                  ) : expanded.has(node.path) ? (
                    <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  )
                ) : (
                  <FileText className="size-3 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-foreground">{node.name || node.path}</span>
                {!node.hasChildren && node.fields?.length ? (
                  <span className="shrink-0 text-[9px] text-muted-foreground">{t("{n} 字段", { n: node.fields.length })}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
