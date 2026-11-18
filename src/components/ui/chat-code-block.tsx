"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ChatCodeBlockProps {
  code: string;
  filename?: string;
  language?: string;
  className?: string;
}

/**
 * ChatCodeBlock — ReUI code-block chrome without Shiki.
 * Filename header + copy. Highlighting stays off until an app opts into it.
 * Docs: https://reui.io/docs/components/base/code-block
 */
export function ChatCodeBlock({
  code,
  filename,
  language,
  className,
}: ChatCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const label = filename ?? language ?? "代码";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("已复制");
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error(error);
      toast.error("复制失败，请重试");
    }
  };

  return (
    <div
      data-slot="chat-code-block"
      className={cn("min-w-0 overflow-hidden rounded-[4px] border border-border bg-muted/60", className)}
    >
      <div className="flex h-8 items-center justify-between gap-2 px-3">
        <p className="truncate font-mono text-xs text-muted-foreground">{label}</p>
        <Button type="button" size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => void copy()}>
          {copied ? "已复制" : "复制"}
        </Button>
      </div>
      <pre className="overflow-x-auto px-3 pb-3 font-mono text-xs leading-5 text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
