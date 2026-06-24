"use client";

import { useState, useCallback } from "react";

/** 历史栈上限：超出丢最旧（限内存；画布编辑场景 50 步足够）。 */
const MAX_PAST = 50;

type Updater<T> = T | ((prev: T) => T);
const resolve = <T,>(u: Updater<T>, prev: T): T => (typeof u === "function" ? (u as (p: T) => T)(prev) : u);

interface HistoryState<T> {
  readonly past: readonly T[];
  readonly present: T;
  readonly future: readonly T[];
}

const cap = <T,>(past: readonly T[], present: T): T[] => {
  const next = [...past, present];
  return next.length > MAX_PAST ? next.slice(next.length - MAX_PAST) : next;
};

/**
 * 撤销/重做历史。present 为当前值；commit 入栈、replace 不入栈（拖拽实时帧用）、
 * begin 把当前压栈但不改 present（拖拽起点 → 整段拖拽合并为一步可撤销）。
 */
export function useHistory<T>(initial: T) {
  const [s, setS] = useState<HistoryState<T>>({ past: [], present: initial, future: [] });

  const commit = useCallback((u: Updater<T>) => {
    setS((st) => {
      const next = resolve(u, st.present);
      if (next === st.present) return st;
      return { past: cap(st.past, st.present), present: next, future: [] };
    });
  }, []);

  const replace = useCallback((u: Updater<T>) => {
    setS((st) => ({ ...st, present: resolve(u, st.present) }));
  }, []);

  const begin = useCallback(() => {
    setS((st) => ({ past: cap(st.past, st.present), present: st.present, future: [] }));
  }, []);

  /** 取消进行中的拖拽：把 begin 压入的快照弹回 present（不留 redo 残留）。 */
  const cancel = useCallback(() => {
    setS((st) => {
      if (st.past.length === 0) return st;
      return { past: st.past.slice(0, -1), present: st.past[st.past.length - 1], future: st.future };
    });
  }, []);

  const undo = useCallback(() => {
    setS((st) => {
      if (st.past.length === 0) return st;
      const prev = st.past[st.past.length - 1];
      return { past: st.past.slice(0, -1), present: prev, future: [st.present, ...st.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setS((st) => {
      if (st.future.length === 0) return st;
      const next = st.future[0];
      return { past: [...st.past, st.present], present: next, future: st.future.slice(1) };
    });
  }, []);

  const reset = useCallback((next: T) => setS({ past: [], present: next, future: [] }), []);

  return {
    present: s.present,
    commit,
    replace,
    begin,
    cancel,
    undo,
    redo,
    reset,
    canUndo: s.past.length > 0,
    canRedo: s.future.length > 0,
  };
}
