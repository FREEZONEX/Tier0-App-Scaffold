"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Search } from "lucide-react";
import { useT } from "@/hmi/i18n/context";
import { nodeTopics } from "@/hmi/data/node-topics";
import { RANGE_PRESETS, TREND_AGG_FN } from "@/hmi/data/uns-history";
import { useTrendSeries, useTableRows, type TrendRef } from "./useUnsHistory";
import { HistoryTrendChart } from "./HistoryTrendChart";
import { HistoryTable } from "./HistoryTable";
import type { MimicNode } from "@/hmi/schema/schema";

type Tab = "trend" | "table";
interface Range {
  startMs: number;
  endMs: number;
}
/** 趋势可选的「数据值」：图元一个映射字段（label=元件字段名/数据点名，查询走 topic+path）。 */
interface FieldOption {
  key: string;
  topic: string;
  path: string;
  label: string;
}

const DEFAULT_PRESET = "6h";
/** 模块级取「现在」：在事件/初始化里捕获，避免组件体内直呼 Date.now（渲染纯度）。 */
const nowMs = (): number => Date.now();
const pad = (n: number): string => String(n).padStart(2, "0");
const msToLocalInput = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const localInputToMs = (s: string): number | null => {
  const ms = new Date(s).getTime();
  return Number.isFinite(ms) ? ms : null;
};
const fmtTs = (ms: number): string =>
  new Date(ms).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const chip = (active: boolean): string =>
  `max-w-[200px] truncate rounded-full border px-2 py-0.5 text-[11px] ${
    active ? "border-focus-accent bg-focus-accent/10 text-foreground" : "border-border text-muted-foreground hover:bg-surface-inset"
  }`;

/**
 * 图元历史数据模态：照搬 ActionsDialog 范式（遮罩 + 居中卡片 + Esc/点遮罩关闭）。
 * 交互（用户决策）：选择即查——时间预设 / 趋势数据值 / 表格 topic 点击直接查询；
 * 仅自定义起止时间是草稿，点「查询」才生效。聚合固定平均（无选项）。
 * 顶部一行：预设 + 起止时间 + 查询。趋势页选数据值（多选叠加）、表格页选 topic（单选）。
 */
export function HistoryDialog({ node, onClose }: { node: MimicNode; onClose: () => void }) {
  const t = useT();
  const topics = useMemo(() => nodeTopics(node), [node]);
  // 趋势可选数据值 = 各 topic 的映射字段展开（label 为元件字段名/数据点名）
  const fieldOptions = useMemo<FieldOption[]>(
    () => topics.flatMap((tp) => tp.fields.map((f) => ({ key: `${tp.topic}|${f.path}`, topic: tp.topic, path: f.path, label: f.label }))),
    [topics],
  );
  const optionByKey = useMemo(() => new Map(fieldOptions.map((o) => [o.key, o])), [fieldOptions]);

  // 选择即查：数据值 / 表格 topic / 生效范围都是即时查询输入
  const [trendKeys, setTrendKeys] = useState<string[]>(() => (fieldOptions[0] ? [fieldOptions[0].key] : []));
  const [tableTopic, setTableTopic] = useState<string>(topics[0]?.topic ?? "");
  const [range, setRange] = useState<Range>(() => {
    const now = nowMs();
    const ms = RANGE_PRESETS.find((p) => p.value === DEFAULT_PRESET)?.ms ?? RANGE_PRESETS[0].ms;
    return { startMs: now - ms, endMs: now };
  });
  const [presetKey, setPresetKey] = useState<string>(DEFAULT_PRESET);
  // 自定义起止时间是草稿：点「查询」才提交到 range
  const [draftRange, setDraftRange] = useState<Range | null>(null);
  const [tab, setTab] = useState<Tab>("trend");
  const [tablePage, setTablePage] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const effStart = range.startMs;
  const effEnd = range.endMs;
  // 选中的数据值按 topic 分组成查询引用（一个 topic 一组字段）
  const refs = useMemo<TrendRef[]>(() => {
    const byTopic = new Map<string, { path: string; label: string }[]>();
    for (const key of trendKeys) {
      const o = optionByKey.get(key);
      if (!o) continue;
      if (!byTopic.has(o.topic)) byTopic.set(o.topic, []);
      byTopic.get(o.topic)!.push({ path: o.path, label: o.label });
    }
    return [...byTopic.entries()].map(([topic, fields]) => ({ topic, fields }));
  }, [trendKeys, optionByKey]);

  const trend = useTrendSeries(tab === "trend" ? refs : [], effStart, effEnd, TREND_AGG_FN);
  const table = useTableRows(tab === "table" ? tableTopic : "", effStart, effEnd, tablePage);

  const applyPreset = (key: string, ms: number) => {
    const now = nowMs();
    setPresetKey(key);
    setRange({ startMs: now - ms, endMs: now }); // 选择即查
    setDraftRange(null);
    setTablePage(1);
  };
  // 自定义时间：先进草稿，点「查询」才生效
  const draft = draftRange ?? range;
  const editDraft = (next: Range) => {
    setPresetKey("custom");
    setDraftRange(next);
  };
  const runQuery = () => {
    if (draftRange && draftRange.startMs < draftRange.endMs) {
      setRange(draftRange);
      setDraftRange(null);
      setTablePage(1);
    }
  };
  const toggleTrend = (key: string) => {
    setTrendKeys((prev) => (prev.includes(key) ? (prev.length > 1 ? prev.filter((x) => x !== key) : prev) : [...prev, key]));
  };
  const pickTableTopic = (topic: string) => {
    setTableTopic(topic);
    setTablePage(1);
  };
  // 起 ≥ 止的非法草稿禁用查询（否则点了静默失败，用户无从分辨）
  const dirty = draftRange !== null && draftRange.startMs < draftRange.endMs;
  const active = tab === "trend" ? trend : table;
  const noTopics = topics.length === 0;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30" onClick={onClose} data-testid="history-dialog-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("历史数据")}
        className="flex max-h-[85vh] w-[720px] max-w-[94vw] flex-col rounded-md border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="history-dialog"
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground" title={node.label ?? node.id}>
            {t("历史数据")} · {node.label ?? node.id}
          </span>
          <button type="button" onClick={onClose} aria-label={t("关闭")} className="text-muted-foreground hover:text-foreground" data-testid="history-dialog-close">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
          {noTopics ? (
            <p className="py-8 text-center text-xs text-muted-foreground">{t("该图元未绑定任何 topic")}</p>
          ) : (
            <>
              {/* 时间：预设（点击即查）+ 自定义起止（草稿，点查询生效）——同一行 */}
              <div className="flex flex-wrap items-center gap-1.5">
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => applyPreset(p.value, p.ms)}
                    className={`rounded-sm border px-2 py-0.5 text-[11px] ${
                      presetKey === p.value ? "border-focus-accent bg-focus-accent/10 text-foreground" : "border-border text-muted-foreground hover:bg-surface-inset"
                    }`}
                  >
                    {t(p.label)}
                  </button>
                ))}
                <input
                  type="datetime-local"
                  value={msToLocalInput(draft.startMs)}
                  onChange={(e) => {
                    const ms = localInputToMs(e.target.value);
                    if (ms !== null) editDraft({ startMs: ms, endMs: draft.endMs });
                  }}
                  className="rounded-sm border border-border bg-surface-inset px-1.5 py-0.5 text-[11px] text-foreground"
                  aria-label={t("起始时间")}
                />
                <span className="text-[11px] text-muted-foreground">→</span>
                <input
                  type="datetime-local"
                  value={msToLocalInput(draft.endMs)}
                  onChange={(e) => {
                    const ms = localInputToMs(e.target.value);
                    if (ms !== null) editDraft({ startMs: draft.startMs, endMs: ms });
                  }}
                  className="rounded-sm border border-border bg-surface-inset px-1.5 py-0.5 text-[11px] text-foreground"
                  aria-label={t("结束时间")}
                />
                <button
                  type="button"
                  onClick={runQuery}
                  disabled={!dirty}
                  data-testid="history-query"
                  className={`ml-auto flex items-center gap-1 rounded-sm border px-2.5 py-0.5 text-[11px] font-medium disabled:opacity-50 ${
                    dirty ? "border-focus-accent bg-focus-accent/10 text-foreground" : "border-border text-muted-foreground"
                  }`}
                >
                  <Search className="size-3" />
                  {t("查询")}
                </button>
              </div>

              {/* Tab */}
              <div className="flex items-center gap-1 border-b border-border">
                {(["trend", "table"] as Tab[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={`-mb-px border-b-2 px-3 py-1.5 text-xs ${tab === k ? "border-focus-accent font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    data-testid={`history-tab-${k}`}
                  >
                    {k === "trend" ? t("趋势图") : t("表格")}
                  </button>
                ))}
                <span className="ml-auto text-[10px] text-muted-foreground">{active.loading ? t("加载中…") : null}</span>
              </div>

              {!active.loading && !active.available ? (
                <p className="rounded-sm border border-border bg-surface-inset px-3 py-2 text-xs text-muted-foreground" data-testid="history-unavailable">
                  {t("未配置 UNS 历史数据源")}
                </p>
              ) : null}

              {/* 趋势页：选数据值（点击即查，多选叠加）+ 图（聚合固定平均） */}
              {tab === "trend" ? (
                <div className="min-h-0 flex-1 overflow-auto">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5" data-testid="history-field-select">
                    <span className="text-[11px] text-muted-foreground">{t("数据值（可多选叠加）")}</span>
                    {fieldOptions.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground">{t("该图元无映射字段，无法绘制趋势")}</span>
                    ) : (
                      fieldOptions.map((o) => (
                        <button key={o.key} type="button" onClick={() => toggleTrend(o.key)} title={`${o.topic}${o.path ? `.${o.path}` : ""}`} className={chip(trendKeys.includes(o.key))}>
                          {o.label}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{t("间隔 {iv} · 约 {n} 点", { iv: trend.interval, n: trend.approxPoints })}</span>
                  </div>
                  {trend.note?.kind === "truncated" ? (
                    <p className="mb-2 text-[11px] text-state-paused-fg">{t("字段/系列过多，仅展示前 {n} 个（共 {total}）", { n: trend.note.shown, total: trend.note.total })}</p>
                  ) : null}
                  <HistoryTrendChart series={trend.series} formatTime={fmtTs} emptyLabel={t("暂无历史数据")} />
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  {/* 表格页：单选 topic（点击即查）——chips 直接显示 topic 路径 */}
                  <div className="flex flex-wrap items-center gap-1.5" data-testid="history-table-topic">
                    <span className="text-[11px] text-muted-foreground">{t("查看 topic")}</span>
                    {topics.map((tp) => (
                      <button key={tp.topic} type="button" onClick={() => pickTableTopic(tp.topic)} title={tp.topic} className={chip(tableTopic === tp.topic)}>
                        {tp.topic}
                      </button>
                    ))}
                  </div>
                  <HistoryTable
                    rows={table.rows}
                    columns={table.columns}
                    page={tablePage}
                    pageCount={table.pageCount}
                    loading={table.loading}
                    onPageChange={setTablePage}
                    formatTime={fmtTs}
                    emptyLabel={t("暂无历史数据")}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
