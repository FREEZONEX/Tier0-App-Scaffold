"use client";

/**
 * 字段配置 (145_field_config.png): count N/N, 搜索字段, groups 左固定 / 不固定 /
 * 右固定, drag handle reorder, 固定到左 / 固定到右, 显隐 eye. Every change is
 * reported immediately (the list page saves it as a user preference).
 *
 * `ColumnConfigList` is shared with the view editor's 字段配置 tab.
 */
import { ArrowLeftToLine, ArrowRightToLine, Eye, EyeOff, GripVertical, LayoutList, Search } from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";
import { IconButton, TextButton } from "@/components/kit/ui/buttons";
import { Empty } from "@/components/kit/ui/feedback";
import { resolveFieldIconKind } from "@/components/kit/ui/field-icons";
import { FieldTypeIcon } from "@/components/kit/ui/field-type-icon";
import { Input } from "@/components/kit/ui/input";
import { Popover } from "@/components/kit/ui/popover";
import { normalizeColumnStates, type ColumnState, type FixedSide } from "@/lib/component-kit/list-columns";
import { cn } from "@/lib/utils";

type GroupKey = "left" | "none" | "right";

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "left", label: "左固定" },
  { key: "none", label: "不固定" },
  { key: "right", label: "右固定" },
];

function groupOf(fixed: FixedSide): GroupKey {
  return fixed === "left" || fixed === "right" ? fixed : "none";
}

export interface ColumnConfigListProps {
  states: readonly ColumnState[];
  onChange: (states: ColumnState[]) => void;
  /** Show 左固定 / 不固定 / 右固定 group captions (default true). */
  grouped?: boolean;
  /** Show the pin buttons (default true). */
  pinnable?: boolean;
  primaryField?: string;
  /** Scroll area max height. */
  maxHeight?: number | string;
  searchPlaceholder?: string;
  className?: string;
}

export function ColumnConfigList({
  states,
  onChange,
  grouped = true,
  pinnable = true,
  primaryField,
  maxHeight = 360,
  searchPlaceholder = "搜索字段",
  className,
}: ColumnConfigListProps) {
  const [keyword, setKeyword] = useState("");
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ code: string; after: boolean } | null>(null);
  const searching = keyword.trim() !== "";
  const visibleCount = states.filter((state) => !state.hidden).length;

  const filtered = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return needle ? states.filter((state) => state.name.toLowerCase().includes(needle)) : states;
  }, [keyword, states]);

  const update = (code: string, patch: Partial<ColumnState>) => {
    onChange(normalizeColumnStates(states.map((state) => (state.code === code ? { ...state, ...patch } : state))));
  };

  const toggleHidden = (state: ColumnState) => {
    if (!state.hidden && visibleCount <= 1) return;
    update(state.code, { hidden: !state.hidden });
  };

  const handleDrop = (targetCode: string, after: boolean) => {
    if (!dragging || dragging === targetCode) return;
    const moving = states.find((state) => state.code === dragging);
    const target = states.find((state) => state.code === targetCode);
    if (!moving || !target) return;
    const rest = states.filter((state) => state.code !== dragging);
    const targetIndex = rest.findIndex((state) => state.code === targetCode);
    const inserted = { ...moving, fixed: grouped ? target.fixed : moving.fixed };
    rest.splice(after ? targetIndex + 1 : targetIndex, 0, inserted);
    onChange(normalizeColumnStates(rest));
  };

  const renderRow = (state: ColumnState) => {
    const indicator = dropTarget?.code === state.code ? (dropTarget.after ? "after" : "before") : null;
    return (
      <li
        key={state.code}
        draggable={!searching}
        onDragStart={(event: DragEvent<HTMLLIElement>) => {
          setDragging(state.code);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", state.code);
        }}
        onDragOver={(event: DragEvent<HTMLLIElement>) => {
          if (!dragging) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const after = event.clientY > rect.top + rect.height / 2;
          setDropTarget((current) => (current?.code === state.code && current.after === after ? current : { code: state.code, after }));
        }}
        onDrop={(event: DragEvent<HTMLLIElement>) => {
          event.preventDefault();
          if (dropTarget) handleDrop(dropTarget.code, dropTarget.after);
          setDragging(null);
          setDropTarget(null);
        }}
        onDragEnd={() => {
          setDragging(null);
          setDropTarget(null);
        }}
        className={cn(
          "group relative flex h-8 min-w-0 items-center gap-1.5 rounded-md pr-1 pl-1 text-sm transition-colors hover:bg-fill-hover",
          dragging === state.code && "opacity-40",
          indicator === "before" && "before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded before:bg-brand",
          indicator === "after" && "after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded after:bg-brand",
        )}
      >
        <GripVertical
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 text-text-placeholder", searching ? "opacity-30" : "cursor-grab")}
        />
        <FieldTypeIcon kind={resolveFieldIconKind(state.field, primaryField)} />
        <span className={cn("min-w-0 flex-1 truncate", state.hidden && "text-text-tertiary")} title={state.name}>
          {state.name}
        </span>
        {pinnable ? (
          <>
            <IconButton
              size="sm"
              label={state.fixed === "left" ? "取消固定" : "固定到左"}
              active={state.fixed === "left"}
              icon={<ArrowLeftToLine />}
              onClick={() => update(state.code, { fixed: state.fixed === "left" ? null : "left" })}
            />
            <IconButton
              size="sm"
              label={state.fixed === "right" ? "取消固定" : "固定到右"}
              active={state.fixed === "right"}
              icon={<ArrowRightToLine />}
              onClick={() => update(state.code, { fixed: state.fixed === "right" ? null : "right" })}
            />
          </>
        ) : null}
        <IconButton
          size="sm"
          label={state.hidden ? "显示" : "隐藏"}
          icon={state.hidden ? <EyeOff /> : <Eye />}
          className={state.hidden ? "text-text-placeholder" : "text-brand"}
          disabled={!state.hidden && visibleCount <= 1}
          onClick={() => toggleHidden(state)}
        />
      </li>
    );
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Input
        aria-label="搜索字段"
        allowClear
        prefix={<Search />}
        placeholder={searchPlaceholder}
        value={keyword}
        onChange={(next) => setKeyword(next)}
      />
      <div className="-mr-1 overflow-y-auto pr-1" style={{ maxHeight }}>
        {filtered.length === 0 ? (
          <Empty size="sm" description="没有匹配的字段" />
        ) : grouped ? (
          GROUPS.map((group) => {
            const items = filtered.filter((state) => groupOf(state.fixed) === group.key);
            if (items.length === 0) return null;
            return (
              <div key={group.key} className="mb-1">
                <div className="px-1 pt-1 pb-0.5 text-xs text-text-tertiary">{group.label}</div>
                <ul
                  className="grid gap-0.5"
                  onDragOver={(event) => {
                    if (dragging) event.preventDefault();
                  }}
                >
                  {items.map(renderRow)}
                </ul>
              </div>
            );
          })
        ) : (
          <ul className="grid gap-0.5">{filtered.map(renderRow)}</ul>
        )}
      </div>
    </div>
  );
}

export interface FieldConfigPopoverProps {
  states: readonly ColumnState[];
  onChange: (states: ColumnState[]) => void;
  primaryField?: string;
  label?: string;
  disabled?: boolean;
}

/** Toolbar「字段配置」 text button + popover. */
export function FieldConfigPopover({ states, onChange, primaryField, label = "字段配置", disabled = false }: FieldConfigPopoverProps) {
  const visible = states.filter((state) => !state.hidden).length;
  return (
    <Popover
      placement="bottom-start"
      aria-label={label}
      disabled={disabled}
      className="w-[min(340px,calc(100vw-24px))] p-3"
      content={
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            <span className="text-xs tabular-nums text-text-tertiary">
              {visible}/{states.length}
            </span>
          </div>
          <ColumnConfigList states={states} onChange={onChange} primaryField={primaryField} />
        </div>
      }
    >
      <TextButton icon={<LayoutList />} disabled={disabled}>
        {label}
      </TextButton>
    </Popover>
  );
}
