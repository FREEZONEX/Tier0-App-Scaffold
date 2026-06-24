"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * 样式化下拉（替代原生 <select>，与搜索建议下拉同一视觉语言）。
 * 触发钮显示当前值（truncate + title 看全文），点开样式化列表选择。
 * 用 onMouseDown preventDefault 让点选项不触发 blur，blur 关闭实现点外面收起。
 */
export function SelectMenu({
  value,
  options,
  onChange,
  placeholder,
  disabled,
  title,
  testId,
  className = "",
}: {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  title?: string;
  testId?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const display = current?.label ?? placeholder ?? "";

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        title={title ?? (value || undefined)}
        data-testid={testId}
        className="flex w-full items-center gap-1 rounded-sm border border-input bg-background px-1.5 py-0.5 text-left font-mono text-[10px] text-foreground disabled:opacity-50"
      >
        <span className={`min-w-0 flex-1 truncate ${current ? "" : "text-muted-foreground"}`}>{display}</span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </button>
      {open && !disabled ? (
        <ul
          // 选项在触发器宽度内换行显示全文（长 topic 折成多行，不用逐个 hover）；不向外加宽——检视面板 overflow 会裁掉超出部分
          className="absolute left-0 right-0 top-full z-30 mt-0.5 max-h-60 overflow-y-auto overflow-x-hidden rounded-sm border border-border bg-card shadow-md"
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                title={o.label}
                className={`block w-full whitespace-normal break-all px-1.5 py-1 text-left font-mono text-[10px] leading-snug text-foreground hover:bg-surface-inset ${o.value === value ? "bg-surface-inset font-semibold" : ""}`}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
