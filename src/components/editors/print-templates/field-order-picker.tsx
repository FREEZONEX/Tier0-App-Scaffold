"use client";

/**
 * 打印模板字段选择：left「可选字段」(搜索 + 全选 + 勾选), right「已选字段」in print order —
 * drag to reorder, rename the printed label, remove.
 */
import { Search, X } from "lucide-react";
import { useState, type DragEvent } from "react";
import { IconButton } from "@/components/kit/ui/buttons";
import { Checkbox } from "@/components/kit/ui/checkbox";
import { Input } from "@/components/kit/ui/input";
import type { PrintTemplateField } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { DragHandle, dragInsertionClass } from "@/components/kit/ui/drag-handle";

export interface FieldOrderPickerProps {
  /** Fields the template may print. */
  candidates: PrintTemplateField[];
  value: PrintTemplateField[];
  onChange: (fields: PrintTemplateField[]) => void;
  disabled?: boolean;
  error?: boolean;
  label: string;
}

export function FieldOrderPicker({ candidates, value, onChange, disabled = false, error = false, label }: FieldOrderPickerProps) {
  const [keyword, setKeyword] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; after: boolean } | null>(null);
  const text = keyword.trim().toLowerCase();
  const shown = candidates.filter((field) => !text || field.name.toLowerCase().includes(text));
  const selected = new Set(value.map((field) => field.code));
  const allChecked = shown.length > 0 && shown.every((field) => selected.has(field.code));
  const someChecked = shown.some((field) => selected.has(field.code));

  const toggle = (field: PrintTemplateField, checked: boolean) => {
    onChange(checked ? [...value, { code: field.code, name: field.name }] : value.filter((item) => item.code !== field.code));
  };

  const toggleAll = (checked: boolean) => {
    if (checked) onChange([...value, ...shown.filter((field) => !selected.has(field.code)).map((field) => ({ code: field.code, name: field.name }))]);
    else onChange(value.filter((item) => !shown.some((field) => field.code === item.code)));
  };

  const move = (from: number, to: number) => {
    if (from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const applyDrop = (targetIndex: number, after: boolean) => {
    if (dragIndex === null) return;
    let to = after ? targetIndex + 1 : targetIndex;
    if (dragIndex < to) to -= 1;
    move(dragIndex, to);
  };

  return (
    <div className={cn("grid min-w-0 gap-3 rounded-[4px] border p-3 md:grid-cols-2", error ? "border-danger/60" : "border-border-secondary")}>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-xs font-medium text-text-secondary">可选字段（{candidates.length}）</span>
        <Input prefix={<Search />} allowClear placeholder="搜索字段" value={keyword} onChange={setKeyword} disabled={disabled} aria-label={`搜索${label}`} />
        <Checkbox checked={allChecked} indeterminate={!allChecked && someChecked} disabled={disabled || shown.length === 0} onChange={toggleAll}>
          全选
        </Checkbox>
        <ul className="flex max-h-60 min-w-0 flex-col gap-1 overflow-y-auto pr-1" aria-label={`${label}可选字段`}>
          {shown.map((field) => (
            <li key={field.code} className="min-w-0">
              <Checkbox checked={selected.has(field.code)} disabled={disabled} onChange={(checked) => toggle(field, checked)}>
                <span className="truncate">{field.name}</span>
              </Checkbox>
            </li>
          ))}
          {shown.length === 0 ? <li className="py-4 text-center text-sm text-text-tertiary">无匹配字段</li> : null}
        </ul>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <span className="text-xs font-medium text-text-secondary">已选字段（{value.length}，按顺序打印，可修改打印名称）</span>
        <ul className="flex max-h-[19rem] min-w-0 flex-col gap-1.5 overflow-y-auto pr-1" aria-label={`${label}已选字段`}>
          {value.map((field, index) => {
            const indicator =
              dropTarget?.index === index && dragIndex !== null && dragIndex !== index
                ? dropTarget.after
                  ? "after"
                  : "before"
                : null;
            return (
              <li
                key={field.code}
                draggable={!disabled}
                onDragStart={(event) => {
                  if ((event.target as HTMLElement).closest("input")) {
                    event.preventDefault();
                    return;
                  }
                  setDragIndex(index);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", field.code);
                }}
                onDragOver={(event: DragEvent<HTMLLIElement>) => {
                  if (dragIndex === null) return;
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  const after = event.clientY > rect.top + rect.height / 2;
                  setDropTarget((current) =>
                    current?.index === index && current.after === after ? current : { index, after },
                  );
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dropTarget) applyDrop(dropTarget.index, dropTarget.after);
                  setDragIndex(null);
                  setDropTarget(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDropTarget(null);
                }}
                className={cn(
                  "relative flex min-w-0 items-center gap-2 rounded-[4px] border border-dashed border-border-secondary bg-card px-2 py-1",
                  dragIndex === index && "opacity-40",
                  indicator && dragInsertionClass(indicator),
                )}
              >
                <DragHandle disabled={disabled} />
                <span className="w-5 shrink-0 text-xs text-text-tertiary tabular-nums">{index + 1}</span>
                <Input
                  size="sm"
                  variant="borderless"
                  aria-label={`第${index + 1}个字段打印名称`}
                  className="min-w-0 flex-1"
                  maxLength={50}
                  disabled={disabled}
                  value={field.name}
                  placeholder={candidates.find((item) => item.code === field.code)?.name ?? field.code}
                  onChange={(name) => onChange(value.map((item) => (item.code === field.code ? { ...item, name } : item)))}
                />
                {!disabled ? <IconButton size="sm" label="移除字段" icon={<X />} onClick={() => onChange(value.filter((item) => item.code !== field.code))} /> : null}
              </li>
            );
          })}
          {value.length === 0 ? <li className="rounded-[4px] border border-dashed border-border-secondary py-6 text-center text-sm text-text-tertiary">请在左侧勾选要打印的字段</li> : null}
        </ul>
      </div>
    </div>
  );
}
