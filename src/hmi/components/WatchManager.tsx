"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { FieldSource } from "./FieldSource";
import { AlarmLimitsEditor } from "./AlarmLimitsEditor";
import { useT } from "@/hmi/i18n/context";
import type { WatchPoint } from "@/hmi/schema/schema";

/**
 * 单个数据点配置块：与固定字段（FieldConfig）同款外观——
 * 标题行（名称可编辑 + 「数据点」+ 绑定状态点 + 删除）→ 来源（topic/字段下拉）→ 告警阈值。
 * draft 模式（新建未落库）：来源选齐即提交（与字段绑定「topic+字段都齐才落库」一致）。
 */
function WatchConfig({
  watch,
  topics,
  getPayload,
  onPatch,
  onRemove,
  testid,
}: {
  watch: WatchPoint;
  topics: readonly string[];
  getPayload: (topic: string) => unknown;
  /** 已存块=onUpdate 补丁；草稿块=收集草稿（来源齐时由父层提交 onAdd）。 */
  onPatch: (patch: Partial<WatchPoint>) => void;
  onRemove: () => void;
  testid?: string;
}) {
  const t = useT();
  // 来源本地暂存：支持「选了 topic 还没选字段」的中间态（同 FieldConfig）。
  const [topic, setTopic] = useState(watch.topic);
  const [path, setPath] = useState(watch.path);
  const bound = !!watch.topic;

  const onSource = (tp: string, pa: string) => {
    setTopic(tp);
    setPath(pa);
    if (tp) onPatch({ topic: tp, path: pa });
  };

  return (
    <li className="rounded-sm border border-border p-2" data-testid={testid}>
      <div className="mb-1 flex items-center gap-1.5">
        <input
          defaultValue={watch.label}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== watch.label) onPatch({ label: v });
          }}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          aria-label={t("数据点名称")}
          placeholder={t("名称")}
          className="w-28 min-w-0 rounded-sm border border-input bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-focus-accent"
          data-testid="watch-name"
        />
        <span className="text-[10px] text-muted-foreground">{t("数据点")}</span>
        <span className="flex-1" />
        <span className={`size-1.5 rounded-full ${bound ? "bg-state-running-fg" : "bg-muted-foreground/40"}`} title={bound ? t("已绑定") : t("未绑定")} />
        <button type="button" onClick={onRemove} aria-label={t("移除数据点 {label}", { label: watch.label })} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-3" />
        </button>
      </div>

      <div>
        <span className="text-[10px] text-muted-foreground">{t("来源")}</span>
        <div className="mt-0.5">
          <FieldSource topics={topics} topic={topic} path={path} getPayload={getPayload} onChange={onSource} />
        </div>
      </div>

      <div className="mt-1.5">
        <span className="text-[10px] text-muted-foreground">{t("告警")}</span>
        <div className="mt-0.5 space-y-1 rounded-sm bg-surface-inset/50 p-1.5">
          <AlarmLimitsEditor alarms={watch.alarms} onChange={(a) => onPatch({ alarms: a })} testidPrefix="watch-alarm" />
          {!path && watch.alarms && Object.keys(watch.alarms).length > 0 ? (
            // 空 path 取整条 payload 对象 → 数值转换 NaN → 阈值永不触发（演练发现的静默失效坑）
            <p className="text-[10px] text-state-paused-fg" data-testid="watch-alarm-nopath-warn">{t("未选字段（path 为空）时取整条负载，告警阈值不会触发——请在上方来源选定具体字段。")}</p>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * 额外数据点：自定义实时值列表，每条与固定字段同款的配置块；底部「添加数据点」出新块再配置。
 * 可配告警阈值（同 binding，判原始值）：越限参与节点告警圈，面板里该值变红/黄。
 */
export function WatchManager({
  watches,
  topics,
  getPayload,
  onAdd,
  onRemove,
  onUpdate,
}: {
  watches: readonly WatchPoint[];
  topics: readonly string[];
  getPayload: (topic: string) => unknown;
  onAdd: (watch: WatchPoint) => void;
  onRemove: (index: number) => void;
  /** 按 index 打补丁（改名/改来源/配清告警阈值）。 */
  onUpdate: (index: number, patch: Partial<WatchPoint>) => void;
}) {
  const t = useT();
  // 草稿块：点「添加数据点」先出块；来源（topic）选齐才落库（schema 要求 topic 非空）。
  const [draft, setDraft] = useState<WatchPoint | null>(null);

  // 注意：不要在 setState updater 里调 onAdd（副作用）——StrictMode 下 updater 双调会重复添加。
  const patchDraft = (patch: Partial<WatchPoint>) => {
    if (!draft) return;
    const next = { ...draft, ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete (next as Record<string, unknown>)[k];
    if (next.topic) {
      onAdd(next); // 来源齐 → 落库，草稿结束（列表里出现正式块）
      setDraft(null);
    } else {
      setDraft(next);
    }
  };

  return (
    <div className="mt-2" data-testid="watch-manager">
      <div className="mb-1 flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("额外数据点")}</span>
        <span className="flex-1" />
        <span className="text-[10px] text-muted-foreground">{t("{n} 个", { n: watches.length })}</span>
      </div>
      <p className="mb-1 text-[10px] text-muted-foreground">{t("加任意 topic/字段在上方实时数据显示；可配告警阈值，越限圈闪并标红。")}</p>
      {watches.length > 0 || draft ? (
        <ul className="space-y-2" data-testid="watch-list">
          {watches.map((w, i) => (
            <WatchConfig
              key={`${i}-${w.topic}-${w.path}`}
              watch={w}
              topics={topics}
              getPayload={getPayload}
              onPatch={(patch) => onUpdate(i, patch)}
              onRemove={() => onRemove(i)}
              testid={`watch-config-${i}`}
            />
          ))}
          {draft ? (
            <WatchConfig
              watch={draft}
              topics={topics}
              getPayload={getPayload}
              onPatch={patchDraft}
              onRemove={() => setDraft(null)}
              testid="watch-config-draft"
            />
          ) : null}
        </ul>
      ) : null}
      <button
        type="button"
        onClick={() => setDraft({ label: t("数据点 {n}", { n: watches.length + 1 }), topic: "", path: "" })}
        disabled={!!draft}
        className="mt-2 flex w-full items-center justify-center gap-0.5 rounded-sm border border-dashed border-border px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-surface-inset hover:text-foreground disabled:opacity-50"
        data-testid="watch-add-btn"
      >
        <Plus className="size-3" /> {t("添加数据点")}
      </button>
    </div>
  );
}
