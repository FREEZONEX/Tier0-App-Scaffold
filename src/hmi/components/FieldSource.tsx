"use client";

import { flattenPaths } from "@/hmi/data/flatten";
import { unsTopicFields } from "@/hmi/data/uns-topic-fields";
import { useT } from "@/hmi/i18n/context";
import { SelectMenu } from "./SelectMenu";

const INPUT_CLS =
  "min-w-0 rounded-sm border border-input bg-background px-1.5 py-0.5 font-mono text-[10px] text-foreground disabled:opacity-50";

/**
 * 字段数据来源选择：先选 topic（来自已订阅列表），再选该 topic 报文/UNS schema 里的字段。
 * topic 已选但报文未到且无 UNS schema → 字段退化为手输输入，保证仍可配置。
 * 换 topic 自动清空字段，避免跨 topic 残留路径。下拉用样式化 SelectMenu（与全局视觉一致）。
 */
export function FieldSource({
  topics,
  topic,
  path,
  getPayload,
  onChange,
}: {
  topics: readonly string[];
  topic: string;
  path: string;
  getPayload: (topic: string) => unknown;
  onChange: (topic: string, path: string) => void;
}) {
  const tt = useT();
  const payload = topic ? getPayload(topic) : undefined;
  const livePaths = payload !== undefined ? flattenPaths(payload).map((p) => p.path) : [];
  // 实时报文优先；报文未到则退而用从 UNS 选 topic 时记下的字段 schema（仍可立即配字段）。
  const paths = livePaths.length > 0 ? livePaths : (topic ? [...unsTopicFields(topic)] : []);
  const hasPayload = paths.length > 0;
  // 回显：当前 path 不在字段里也要在下拉中可见（手输过 / 字段暂缺）。
  const fieldPaths = hasPayload && path && !paths.includes(path) ? [path, ...paths] : paths;

  const topicOptions = [{ value: "", label: tt("— 选 topic —") }, ...topics.map((t) => ({ value: t, label: t }))];
  const fieldOptions = [{ value: "", label: tt("— 选字段 —") }, ...fieldPaths.map((p) => ({ value: p, label: p || tt("(整条)") }))];

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <SelectMenu
        value={topic}
        options={topicOptions}
        onChange={(v) => onChange(v, "")}
        placeholder={tt("— 选 topic —")}
        title={topic || undefined}
        testId="src-topic"
        className="w-full"
      />
      {hasPayload ? (
        <SelectMenu
          value={path}
          options={fieldOptions}
          onChange={(v) => onChange(topic, v)}
          disabled={!topic}
          placeholder={tt("— 选字段 —")}
          title={path || undefined}
          testId="src-field"
          className="w-full"
        />
      ) : (
        <input
          value={path}
          onChange={(e) => onChange(topic, e.target.value)}
          disabled={!topic}
          placeholder={topic ? tt("等报文 / 手输字段") : tt("先选 topic")}
          className={`w-full ${INPUT_CLS}`}
          aria-label={tt("字段（手输）")}
          data-testid="src-field-manual"
        />
      )}
    </div>
  );
}
