"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * 样式化 hover/focus 提示（替代原生 title 的难看灰框），用于「信息说明」类场景。
 * 与卡片同一视觉语言：card 背景 + border + shadow + 小字。
 * 触发器 hover 或键盘 focus 都会显示（a11y）；提示框 pointer-events-none 不挡交互。
 * 左对齐锚定（避免在窄检视面板里左溢出），side 控制朝上/朝下展开。
 * 注意：截断文本「悬停看全文」仍用原生 title（数量多、是无障碍兜底），本组件只服务说明类提示。
 */
export function Tooltip({
  content,
  children,
  side = "top",
  align = "left",
  className = "",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  /** 水平锚定：left 向右展开，right 向左展开（贴面板右缘时用 right 防溢出）。 */
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const vpos = side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5";
  const hpos = align === "right" ? "right-0" : "left-0";

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={`pointer-events-none absolute z-50 w-max max-w-[220px] whitespace-normal rounded-md border border-border bg-card px-2 py-1.5 text-[10px] leading-relaxed text-foreground shadow-lg ${vpos} ${hpos}`}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
