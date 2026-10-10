"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckboxIndicator } from "@/components/kit/ui/checkbox";
import { Empty } from "@/components/kit/ui/feedback";
import { useControllableState } from "@/components/kit/ui/floating";
import { Input } from "@/components/kit/ui/input";
import { HighlightText } from "@/components/kit/ui/text";
import type { TreeNode } from "@/components/kit/ui/types";

export interface TreeListProps<T = unknown> {
  nodes: TreeNode<T>[];
  selectedKey?: string | null;
  onSelect?: (key: string, node: TreeNode<T>) => void;
  expandedKeys?: string[];
  defaultExpandedKeys?: string[];
  /** Expand every node initially (ignored when expandedKeys is controlled). */
  defaultExpandAll?: boolean;
  onExpand?: (keys: string[]) => void;
  /** Built-in search box. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** External keyword (e.g. a search box elsewhere); overrides the built-in box. */
  keyword?: string;
  /** Independent checkboxes per node (no parent/child cascade). */
  checkable?: boolean;
  checkedKeys?: string[];
  onCheck?: (keys: string[]) => void;
  emptyText?: ReactNode;
  /** Max height of the scroll area (px or CSS length). */
  height?: number | string;
  renderTitle?: (node: TreeNode<T>, state: { keyword: string; selected: boolean }) => ReactNode;
  className?: string;
  "aria-label"?: string;
}

interface FlatRow<T> {
  node: TreeNode<T>;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

function nodeText<T>(node: TreeNode<T>): string {
  if (node.searchText) return node.searchText;
  return typeof node.title === "string" || typeof node.title === "number" ? String(node.title) : node.key;
}

function collectKeys<T>(nodes: TreeNode<T>[], keys: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children?.length) {
      keys.push(node.key);
      collectKeys(node.children, keys);
    }
  }
  return keys;
}

/** Keep nodes matching the keyword plus their ancestors. */
function filterTree<T>(nodes: TreeNode<T>[], keyword: string): TreeNode<T>[] {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return nodes;
  return nodes.flatMap((node) => {
    const children = node.children ? filterTree(node.children, keyword) : [];
    if (nodeText(node).toLowerCase().includes(needle)) return [node];
    return children.length ? [{ ...node, children }] : [];
  });
}

export function TreeList<T = unknown>({
  nodes,
  selectedKey,
  onSelect,
  expandedKeys,
  defaultExpandedKeys,
  defaultExpandAll = false,
  onExpand,
  searchable = false,
  searchPlaceholder = "搜索",
  keyword: externalKeyword,
  checkable = false,
  checkedKeys,
  onCheck,
  emptyText = "暂无数据",
  height,
  renderTitle,
  className,
  "aria-label": ariaLabel,
}: TreeListProps<T>) {
  const [innerKeyword, setInnerKeyword] = useState("");
  const keyword = externalKeyword ?? innerKeyword;
  const [expanded, setExpanded] = useControllableState<string[]>(
    expandedKeys,
    defaultExpandedKeys ?? (defaultExpandAll ? collectKeys(nodes) : []),
    onExpand,
  );
  const [checked, setChecked] = useControllableState<string[]>(checkedKeys, [], onCheck);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searching = keyword.trim() !== "";

  const rows = useMemo(() => {
    const filtered = filterTree(nodes, keyword);
    const expandedSet = new Set(expanded);
    const result: FlatRow<T>[] = [];
    function walk(items: TreeNode<T>[], depth: number) {
      for (const node of items) {
        const hasChildren = Boolean(node.children?.length);
        const isExpanded = hasChildren && (searching || expandedSet.has(node.key));
        result.push({ node, depth, hasChildren, expanded: isExpanded });
        if (isExpanded && node.children) walk(node.children, depth + 1);
      }
    }
    walk(filtered, 0);
    return result;
  }, [nodes, keyword, expanded, searching]);

  function toggleExpand(key: string) {
    setExpanded(expanded.includes(key) ? expanded.filter((item) => item !== key) : [...expanded, key]);
  }

  function activate(row: FlatRow<T>) {
    if (row.node.disabled) return;
    if (row.node.selectable === false) {
      if (row.hasChildren) toggleExpand(row.node.key);
      return;
    }
    if (checkable) {
      setChecked(
        checked.includes(row.node.key) ? checked.filter((key) => key !== row.node.key) : [...checked, row.node.key],
      );
    }
    onSelect?.(row.node.key, row.node);
  }

  function focusRow(index: number) {
    const row = rows[index];
    if (!row) return;
    setFocusKey(row.node.key);
    listRef.current?.querySelector<HTMLElement>(`[data-tree-key="${CSS.escape(row.node.key)}"]`)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, index: number) {
    const row = rows[index];
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusRow(Math.min(rows.length - 1, index + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        focusRow(Math.max(0, index - 1));
        break;
      case "ArrowRight":
        if (row.hasChildren && !row.expanded) toggleExpand(row.node.key);
        else focusRow(index + 1);
        break;
      case "ArrowLeft":
        if (row.hasChildren && row.expanded && !searching) toggleExpand(row.node.key);
        else {
          for (let parent = index - 1; parent >= 0; parent -= 1) {
            if (rows[parent].depth < row.depth) {
              focusRow(parent);
              break;
            }
          }
        }
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        activate(row);
        break;
      default:
        break;
    }
  }

  const tabStop = focusKey ?? selectedKey ?? rows[0]?.node.key;

  return (
    <div className={cn("flex min-h-0 min-w-0 flex-col", className)}>
      {searchable && externalKeyword === undefined ? (
        <Input
          size="md"
          allowClear
          prefix={<Search />}
          placeholder={searchPlaceholder}
          value={innerKeyword}
          onChange={(next) => setInnerKeyword(next)}
          className="mb-2 shrink-0"
        />
      ) : null}
      <div
        ref={listRef}
        role="tree"
        aria-label={ariaLabel}
        aria-multiselectable={checkable || undefined}
        className="min-h-0 flex-1 overflow-y-auto"
        style={height !== undefined ? { maxHeight: height } : undefined}
      >
        {rows.length === 0 ? (
          <Empty size="sm" description={searching ? "无匹配结果" : emptyText} />
        ) : (
          rows.map((row, index) => {
            const { node } = row;
            const selected = selectedKey === node.key;
            const isChecked = checked.includes(node.key);
            return (
              <div
                key={node.key}
                role="treeitem"
                data-tree-key={node.key}
                aria-level={row.depth + 1}
                aria-expanded={row.hasChildren ? row.expanded : undefined}
                aria-selected={checkable ? isChecked : selected}
                aria-disabled={node.disabled || undefined}
                tabIndex={node.key === tabStop ? 0 : -1}
                className={cn(
                  "group flex min-h-8 cursor-pointer select-none items-center gap-1 rounded-sm pr-2 text-sm leading-[22px] outline-none transition-colors duration-100 focus-visible:shadow-[inset_0_0_0_1px_var(--tier0-primary)]",
                  selected && !checkable ? "bg-brand-soft text-foreground" : "text-foreground hover:bg-fill-hover",
                  node.disabled && "cursor-not-allowed text-text-placeholder hover:bg-transparent",
                )}
                style={{ paddingLeft: row.depth * 18 + 4 }}
                onClick={() => {
                  setFocusKey(node.key);
                  activate(row);
                }}
                onKeyDown={(event) => handleKeyDown(event, index)}
              >
                {row.hasChildren ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={row.expanded ? "收起" : "展开"}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-text-tertiary hover:bg-fill-active hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!searching) toggleExpand(node.key);
                    }}
                  >
                    <ChevronRight className={cn("size-3.5 transition-transform duration-150", row.expanded && "rotate-90")} />
                  </button>
                ) : (
                  <span className="size-5 shrink-0" aria-hidden="true" />
                )}
                {checkable ? <CheckboxIndicator checked={isChecked} disabled={node.disabled} className="mr-1" /> : null}
                {node.icon ? (
                  <span className="flex shrink-0 items-center text-text-tertiary [&>svg]:size-4">{node.icon}</span>
                ) : null}
                <span className="min-w-0 flex-1 truncate">
                  {renderTitle ? (
                    renderTitle(node, { keyword, selected })
                  ) : typeof node.title === "string" ? (
                    <HighlightText text={node.title} keyword={keyword} />
                  ) : (
                    node.title
                  )}
                </span>
                {node.count !== undefined ? (
                  <span className="shrink-0 text-xs tabular-nums text-text-tertiary">{node.count}</span>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
