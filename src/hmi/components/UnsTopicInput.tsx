"use client";

import { useState } from "react";
import { Loader2, FolderTree } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { useUnsTopicSearch } from "@/hmi/data/use-uns-search";
import { rememberUnsTopicFields } from "@/hmi/data/uns-topic-fields";
import { UnsTopicBrowser } from "./UnsTopicBrowser";
import type { UnsTopic } from "@/hmi/data/uns-api";

/**
 * 边输入边搜 UNS 的 topic 输入框：受控输入 + 防抖搜索下拉，下拉项点选回调 onSelect。
 * 下拉项展示真实 topic path + 字段 schema。无 Tier0 env → 不弹下拉，照常手填。
 * 选过的值会暂时收起下拉（value 再变才重新弹），避免选中后又立刻弹出。
 */
export function UnsTopicInput({
  value,
  onChange,
  onSelect,
  onEnter,
  placeholder,
  testId,
  suggestTestId = "uns-suggest",
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (topic: string) => void;
  onEnter?: () => void;
  placeholder?: string;
  testId?: string;
  suggestTestId?: string;
}) {
  const t = useT();
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const suggestEnabled = focused && value.trim().length >= 1 && value !== dismissed;
  const { items, loading, available } = useUnsTopicSearch(value, suggestEnabled);
  // 浏览树打开时让位（互斥）；搜索建议优先于树
  const showSuggest = !browsing && suggestEnabled && available && (loading || items.length > 0);

  const pick = (it: UnsTopic) => {
    if (it.fields?.length) rememberUnsTopicFields(it.path, it.fields); // 记下字段供绑定下拉用
    onSelect(it.path);
    setDismissed(it.path);
  };

  return (
    <div className="relative min-w-0 flex-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
        placeholder={placeholder}
        className="w-full rounded-sm border border-input bg-background px-1.5 py-0.5 pr-12 font-mono text-[10px] text-foreground"
        data-testid={testId}
        autoComplete="off"
      />
      {loading && suggestEnabled ? (
        <Loader2 className="pointer-events-none absolute right-7 top-1/2 size-3 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : null}
      <button
        type="button"
        onClick={() => setBrowsing((b) => !b)}
        aria-label={t("浏览 UNS 命名空间")}
        title={t("浏览 UNS 命名空间")}
        aria-pressed={browsing}
        className={`absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5 ${browsing ? "text-highlight-text" : "text-muted-foreground hover:text-foreground"}`}
        data-testid={testId ? `${testId}-browse` : "uns-browse"}
      >
        <FolderTree className="size-3" />
      </button>
      {browsing ? (
        <UnsTopicBrowser
          onPick={(p) => { onSelect(p); setBrowsing(false); setDismissed(p); }}
          onClose={() => setBrowsing(false)}
        />
      ) : null}
      {showSuggest ? (
        <ul
          className="absolute left-0 right-0 top-full z-20 mt-0.5 max-h-44 overflow-y-auto overflow-x-hidden rounded-sm border border-border bg-card shadow-md"
          data-testid={suggestTestId}
          onMouseDown={(e) => e.preventDefault()}
        >
          {items.length === 0 && loading ? (
            <li className="px-1.5 py-1 text-[10px] text-muted-foreground">{t("搜索中…")}</li>
          ) : null}
          {items.map((it) => (
            <li key={it.path}>
              <button
                type="button"
                onClick={() => pick(it)}
                title={it.fields?.length ? `${it.path}\n${it.fields.map((f) => `${f.name}:${f.type}`).join(", ")}` : it.path}
                className="block w-full max-w-full px-1.5 py-1 text-left hover:bg-surface-inset"
                data-testid={`uns-suggest-${it.path}`}
              >
                <span className="block truncate font-mono text-[10px] text-foreground">{it.path}</span>
                {it.fields?.length ? (
                  <span className="block truncate text-[10px] text-muted-foreground">{it.fields.map((f) => `${f.name}:${f.type}`).join(", ")}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
