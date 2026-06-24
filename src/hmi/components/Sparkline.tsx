"use client";

import { sparklinePath } from "@/hmi/charts/sparkline";

export function Sparkline({
  values,
  width = 248,
  height = 40,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
}) {
  const points = sparklinePath(values, width - 2, height - 2);
  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="block rounded-sm border border-border bg-surface-inset"
      data-testid="sparkline"
    >
      {points ? (
        <polyline
          points={points}
          transform="translate(1,1)"
          fill="none"
          stroke="var(--hmi-selection, #2f8f83)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </svg>
  );
}
