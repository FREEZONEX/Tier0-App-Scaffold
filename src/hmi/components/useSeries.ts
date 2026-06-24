import { useEffect, useRef, useState } from "react";

/**
 * 累积数值序列（最多 max 点，超出丢弃最早）。
 * key 变化（如切换选中设备/字段）时重置序列。
 */
export function useSeries(value: number | undefined, key: string, max = 60): number[] {
  const [series, setSeries] = useState<number[]>([]);
  const keyRef = useRef(key);

  // 把流式数值累积成有界时间序列是 effect 内 setState 的正典用例（按值变化追加历史），
  // 故在此处显式豁免 set-state-in-effect 规则。
  useEffect(() => {
    if (keyRef.current !== key) {
      keyRef.current = key;
      setSeries(value === undefined ? [] : [value]);
      return;
    }
    if (value === undefined) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeries((prev) => {
      const next = [...prev, value];
      return next.length > max ? next.slice(next.length - max) : next;
    });
  }, [value, key, max]);

  return series;
}
