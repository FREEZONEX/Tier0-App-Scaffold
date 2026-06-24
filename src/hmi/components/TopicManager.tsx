"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { UnsTopicInput } from "./UnsTopicInput";

/**
 * 设备订阅 topic 管理：添加一个 topic 即订阅它，订阅后其报文字段才可在下方各字段「来源」里下拉选。
 * 输入框边打边搜 UNS 命名空间（防抖），下拉里点真实 topic 直接添加；无 Tier0 env 时退化为纯手填。
 * 删除 topic 会一并清除引用它的字段绑定（见 removeNodeTopic）。
 */
export function TopicManager({
  topics,
  onAdd,
  onRemove,
}: {
  topics: readonly string[];
  onAdd: (topic: string) => void;
  onRemove: (topic: string) => void;
}) {
  const tt = useT();
  const [draft, setDraft] = useState("");

  const add = (value?: string) => {
    const t = (value ?? draft).trim();
    if (t && !topics.includes(t)) onAdd(t);
    setDraft("");
  };

  return (
    <div className="mb-2 rounded-sm border border-border p-2" data-testid="topic-manager">
      <div className="mb-1 flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{tt("订阅 Topic")}</span>
        <span className="flex-1" />
        <span className="text-[10px] text-muted-foreground">{tt("{n} 个", { n: topics.length })}</span>
      </div>
      <UnsTopicInput
        value={draft}
        onChange={setDraft}
        onSelect={(t) => add(t)}
        onEnter={() => add()}
        placeholder={tt("输入或搜索 UNS topic，回车添加")}
        testId="topic-add-input"
      />
      {topics.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-1" data-testid="topic-list">
          {topics.map((t) => (
            <li key={t} className="flex max-w-full items-center gap-1 rounded-sm border border-border bg-surface-inset px-1.5 py-0.5">
              <code className="min-w-0 flex-1 truncate text-[10px] text-foreground" title={t}>{t}</code>
              <button
                type="button"
                onClick={() => onRemove(t)}
                aria-label={tt("移除 topic {topic}", { topic: t })}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X className="size-2.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-[10px] text-muted-foreground">{tt("先添加该设备的 topic，再到各字段下拉选其报文字段。")}</p>
      )}
    </div>
  );
}
