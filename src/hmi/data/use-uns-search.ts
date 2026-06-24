"use client";

import { useEffect, useRef, useState } from "react";
import { searchUnsFn } from "./uns-api";
import type { UnsTopic } from "./uns-api";

export interface UnsSearchState {
  items: UnsTopic[];
  loading: boolean;
  available: boolean;
}

/**
 * 防抖的 UNS topic 搜索（边输入边搜）。enabled=false 时不搜、清空。
 * 用递增 seq 丢弃过期响应，避免快打字时旧结果覆盖新结果。
 * 无 Tier0 env → server fn 返回 available:false（调用方据此隐藏下拉、回退手填）。
 */
export function useUnsTopicSearch(keyword: string, enabled = true, delayMs = 150): UnsSearchState {
  const [items, setItems] = useState<UnsTopic[]>([]);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(true);
  const seq = useRef(0);

  useEffect(() => {
    // 未启用：不搜（陈旧 items 不展示，由调用方 suggestEnabled 兜住），不在 effect 体里同步 setState。
    if (!enabled) return;
    const mySeq = ++seq.current;
    const tid = setTimeout(() => {
      setLoading(true);
      void searchUnsFn({ data: { keyword: keyword.trim(), size: 20 } })
        .then((r) => {
          if (mySeq !== seq.current) return;
          setAvailable(r.available);
          setItems(r.items);
        })
        .catch(() => {
          if (mySeq !== seq.current) return;
          setAvailable(false);
          setItems([]);
        })
        .finally(() => {
          if (mySeq === seq.current) setLoading(false);
        });
    }, delayMs);
    return () => clearTimeout(tid);
  }, [keyword, enabled, delayMs]);

  return { items, loading, available };
}
