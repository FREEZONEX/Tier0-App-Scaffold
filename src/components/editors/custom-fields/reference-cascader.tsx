"use client";

/**
 * 关联引用「引用字段」级联选择 (06 §3; 904_cc_reference_cascader.png, 905_cc_reference_cascader_l3.png):
 * column 1 = relation fields of the object (产品、生产订单明细、创建人、更新人…), each next column
 * the fields of the related object; relations expand further (up to 4 levels). Picking a
 * non-relation field (or a relation at the last level) selects the whole path, shown as
 * 「生产订单明细 / 生产订单 / 客户 / 客户名称」.
 */
import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Popover } from "@/components/kit/ui/popover";
import { controlFrameClass } from "@/components/kit/ui/control-styles";
import type { ReferenceTreeNode } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

export interface ReferenceCascaderProps {
  nodes: ReferenceTreeNode[];
  /** Field codes from the first relation down to the referenced field. */
  value: string[];
  onChange: (path: string[], labels: string[]) => void;
  status?: "error";
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}

/** Labels of a saved path, or null when a level no longer exists. */
function labelsOf(nodes: readonly ReferenceTreeNode[], path: readonly string[]): string[] | null {
  const labels: string[] = [];
  let level: readonly ReferenceTreeNode[] | undefined = nodes;
  for (const code of path) {
    const node: ReferenceTreeNode | undefined = level?.find((item) => item.value === code);
    if (!node) return null;
    labels.push(node.label);
    level = node.children;
  }
  return labels;
}

export function ReferenceCascader({
  nodes,
  value,
  onChange,
  status,
  disabled = false,
  placeholder = "请选择引用字段",
  "aria-label": ariaLabel = "引用字段",
}: ReferenceCascaderProps) {
  const [open, setOpen] = useState(false);
  const [activePath, setActivePath] = useState<string[]>(value.slice(0, -1));
  const selectedLabels = useMemo(() => labelsOf(nodes, value), [nodes, value]);

  const columns = useMemo(() => {
    const result: { level: number; items: ReferenceTreeNode[] }[] = [{ level: 0, items: nodes }];
    let current: readonly ReferenceTreeNode[] = nodes;
    activePath.forEach((code, index) => {
      const node = current.find((item) => item.value === code);
      if (node?.children?.length) {
        result.push({ level: index + 1, items: node.children });
        current = node.children;
      }
    });
    return result;
  }, [activePath, nodes]);

  const display = value.length ? (selectedLabels ? selectedLabels.join(" / ") : `${value.join(" / ")}（引用字段已不存在）`) : "";

  return (
    <Popover
      open={open}
      disabled={disabled}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setActivePath(value.slice(0, -1));
      }}
      placement="bottom-start"
      anchorClassName="w-full"
      aria-label={ariaLabel}
      className="max-w-[calc(100vw-16px)] overflow-x-auto p-1"
      content={({ close }) =>
        nodes.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-text-tertiary">当前对象没有可引用的关联字段</div>
        ) : (
          <div className="flex min-w-0" role="tree" aria-label={ariaLabel}>
            {columns.map((column) => (
              <ul key={column.level} className="max-h-72 w-40 shrink-0 overflow-y-auto border-r border-border-secondary py-1 last:border-r-0">
                {column.items.map((node) => {
                  const hasChildren = Boolean(node.children?.length);
                  const active = activePath[column.level] === node.value;
                  const selected = !hasChildren && value.length === column.level + 1 && value[column.level] === node.value && activePath.slice(0, column.level).every((code, index) => value[index] === code);
                  const pick = () => {
                    const base = activePath.slice(0, column.level);
                    if (hasChildren) {
                      setActivePath([...base, node.value]);
                      return;
                    }
                    const path = [...base, node.value];
                    const labels = labelsOf(nodes, path) ?? path;
                    onChange(path, labels);
                    close();
                  };
                  return (
                    <li key={node.value} role="treeitem" aria-expanded={hasChildren ? active : undefined} aria-selected={selected}>
                      <button
                        type="button"
                        className={cn(
                          "flex h-8 w-full items-center justify-between gap-1 rounded-sm px-3 text-left text-sm transition-colors hover:bg-fill-hover",
                          (active || selected) && "bg-brand-soft font-medium text-brand hover:bg-brand-soft",
                        )}
                        onMouseEnter={() => {
                          if (hasChildren) setActivePath([...activePath.slice(0, column.level), node.value]);
                        }}
                        onClick={pick}
                      >
                        <span className="min-w-0 truncate" title={node.label}>
                          {node.label}
                        </span>
                        {hasChildren ? <ChevronRight className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ))}
          </div>
        )
      }
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="tree"
        aria-expanded={open}
        className={cn(controlFrameClass({ status, disabled, active: open, fixedHeight: true }), "justify-between gap-2 px-[11px] text-left")}
      >
        <span className={cn("min-w-0 truncate", !display && "text-text-placeholder")}>{display || placeholder}</span>
        <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" aria-hidden="true" />
      </button>
    </Popover>
  );
}
