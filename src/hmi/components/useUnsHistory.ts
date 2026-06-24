"use client";

import { useEffect, useRef, useState } from "react";
import { historyUnsFn } from "@/hmi/data/uns-api";
import {
  parseHistory,
  historyToTrend,
  historyToRows,
  tableColumns,
  chooseTrendInterval,
  seriesLabel,
  tablePageCount,
  MAX_TREND_SERIES,
  TABLE_PAGE_SIZE,
  type HistoryRow,
  type TrendPoint,
} from "@/hmi/data/uns-history";
import type { NodeTopicField } from "@/hmi/data/node-topics";

const iso = (ms: number): string => new Date(ms).toISOString();

/** 趋势查询引用：一个 topic 及其映射字段（path=查询负载字段，label=元件字段名）。 */
export interface TrendRef {
  topic: string;
  fields: readonly NodeTopicField[];
}

/** 趋势单系列：一个 (topic, 映射字段) 的聚合点序列。 */
export interface TrendSeries {
  name: string;
  topic: string;
  field: string;
  points: TrendPoint[];
}

/** 系列限幅 / 无映射字段的说明（结构化，渲染层用 t() 翻译）。 */
export type TrendNote =
  | { kind: "truncated"; shown: number; total: number }
  | { kind: "noMappedField" }
  | null;

export interface TrendState {
  loading: boolean;
  available: boolean;
  series: TrendSeries[];
  interval: string;
  approxPoints: number;
  note: TrendNote;
}

/**
 * 趋势：只查图元映射的字段（refs.fields），跨 topic 合并为多系列——不查 topic 全表字段。
 * 间隔自动选取使点数 ≤ 上限；系列总数超 MAX_TREND_SERIES 时限幅并出 note。
 */
export function useTrendSeries(refs: readonly TrendRef[], startMs: number, endMs: number, fn: string): TrendState {
  const { interval, approxPoints } = chooseTrendInterval(endMs - startMs);
  const [state, setState] = useState<TrendState>({
    loading: false,
    available: true,
    series: [],
    interval,
    approxPoints,
    note: null,
  });
  const seq = useRef(0);

  useEffect(() => {
    // 空 refs（仅出现在非激活 tab）：保持上次（不可见）状态，不在 effect 体同步 setState
    if (refs.length === 0) return;
    const pairs = refs.flatMap((r) => r.fields.map((f) => ({ topic: r.topic, path: f.path, label: f.label })));
    const multiTopic = new Set(refs.map((r) => r.topic)).size > 1;

    // 有 topic 但无映射字段：不查，直接给「无映射字段」说明
    if (pairs.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ loading: false, available: true, series: [], interval, approxPoints, note: { kind: "noMappedField" } });
      return;
    }

    const mySeq = ++seq.current;
    // 取数前置 loading 标志（与外部数据源同步）
    setState((s) => ({ ...s, loading: true, interval, approxPoints }));
    const startTime = iso(startMs);
    const endTime = iso(endMs);

    // 限幅（跨 topic×字段系列总数）
    const total = pairs.length;
    const shown = pairs.slice(0, MAX_TREND_SERIES);
    const note: TrendNote = total > MAX_TREND_SERIES ? { kind: "truncated", shown: shown.length, total } : null;

    (async () => {
      try {
        let available = false;
        const series = await Promise.all(
          shown.map(async ({ topic, path, label }): Promise<TrendSeries> => {
            // 按负载字段 path 聚合查询，但系列名用元件字段 label（用户：趋势显示元件字段，非 MQTT 字段）
            const r = await historyUnsFn({
              data: { topics: [topic], startTime, endTime, aggregation: { field: path, function: fn, interval } },
            });
            if (r.available) available = true;
            const histItem = parseHistory(r.items)[0];
            const points = histItem ? historyToTrend(histItem, path) : [];
            return { name: seriesLabel(topic, label, multiTopic), topic, field: path, points };
          }),
        );
        if (mySeq === seq.current) setState({ loading: false, available, series, interval, approxPoints, note });
      } catch {
        if (mySeq === seq.current) setState({ loading: false, available: false, series: [], interval, approxPoints, note: null });
      }
    })();
  }, [refs, startMs, endMs, fn, interval, approxPoints]);

  return state;
}

export interface TableState {
  loading: boolean;
  available: boolean;
  rows: HistoryRow[];
  columns: string[];
  total: number;
  pageCount: number;
}

/** 表格：单 topic 原始分页记录（不聚合），列动态展开。 */
export function useTableRows(topic: string, startMs: number, endMs: number, page: number): TableState {
  const [state, setState] = useState<TableState>({
    loading: false,
    available: true,
    rows: [],
    columns: [],
    total: 0,
    pageCount: 1,
  });
  const seq = useRef(0);

  useEffect(() => {
    // 无 topic（仅出现在非激活 tab）：保持上次（不可见）状态，不在 effect 体同步 setState
    if (!topic) return;
    const mySeq = ++seq.current;
    // 取数前置 loading 标志：与外部数据源同步的正典用例，显式豁免（同 useSeries）。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true }));
    void historyUnsFn({ data: { topics: [topic], startTime: iso(startMs), endTime: iso(endMs), page, size: TABLE_PAGE_SIZE } })
      .then((r) => {
        if (mySeq !== seq.current) return;
        const item = parseHistory(r.items)[0];
        const rows = item ? historyToRows(item) : [];
        const pageCount = tablePageCount(r.total, rows.length, page);
        setState({ loading: false, available: r.available, rows, columns: tableColumns(rows), total: r.total, pageCount });
      })
      .catch(() => {
        if (mySeq !== seq.current) return;
        setState({ loading: false, available: false, rows: [], columns: [], total: 0, pageCount: 1 });
      });
  }, [topic, startMs, endMs, page]);

  return state;
}
