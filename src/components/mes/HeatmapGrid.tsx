"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * HeatmapGrid — 2D color-intensity grid for visualizing metrics across two dimensions
 * (e.g., machines × hours, stations × days, defect types × shifts).
 *
 * Usage:
 *   <HeatmapGrid
 *     rows={["Line-1", "Line-2", "Line-3"]}
 *     cols={["Mon", "Tue", "Wed", "Thu", "Fri"]}
 *     data={[[12, 8, 15, 3, 9], [5, 14, 2, 11, 7], [9, 6, 13, 4, 10]]}
 *     label="Defect Count"
 *   />
 */

interface HeatmapGridProps {
  /** Row labels (Y-axis) */
  rows: string[];
  /** Column labels (X-axis) */
  cols: string[];
  /** 2D array [row][col] of numeric values */
  data: number[][];
  /** Metric label for tooltips */
  label?: string;
  /** Color scale. Default: grayscale from white to near-black. */
  colorScale?: { low: string; high: string };
  className?: string;
}

function interpolateColor(low: string, high: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  };
  const [lr, lg, lb] = parse(low);
  const [hr, hg, hb] = parse(high);
  const r = Math.round(lr + (hr - lr) * t);
  const g = Math.round(lg + (hg - lg) * t);
  const b = Math.round(lb + (hb - lb) * t);
  return `rgb(${r},${g},${b})`;
}

export function HeatmapGrid({
  rows,
  cols,
  data,
  label = "Value",
  colorScale = { low: "#f4f4f5", high: "#18181b" },
  className,
}: HeatmapGridProps) {
  const flat = data.flat();
  const min = Math.min(...flat);
  const max = Math.max(...flat);
  const range = max - min || 1;

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${cols.length}, minmax(32px, 1fr))` }}>
        {/* Header row */}
        <div />
        {cols.map((col) => (
          <div key={col} className="px-1 pb-1.5 text-center text-[10px] text-muted-foreground truncate">
            {col}
          </div>
        ))}

        {/* Data rows */}
        {rows.map((row, ri) => (
          <>
            <div key={`label-${ri}`} className="flex items-center pr-2 text-[10px] text-muted-foreground whitespace-nowrap">
              {row}
            </div>
            {cols.map((col, ci) => {
              const val = data[ri]?.[ci] ?? 0;
              const t = (val - min) / range;
              const bg = interpolateColor(colorScale.low, colorScale.high, t);
              const textColor = t > 0.55 ? "#fff" : "#18181b";
              return (
                <Tooltip key={`${ri}-${ci}`}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex h-8 min-w-[32px] items-center justify-center rounded-sm text-[10px] tabular-nums font-medium transition-transform hover:scale-110 cursor-default"
                      style={{ backgroundColor: bg, color: textColor }}
                    >
                      {val}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="text-xs">{row} / {col}: {label} = {val}</span>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </>
        ))}
      </div>

      {/* Scale legend */}
      <div className="mt-2 flex items-center gap-2 text-[9px] text-muted-foreground">
        <span>{min}</span>
        <div
          className="h-2 w-20 rounded-sm"
          style={{ background: `linear-gradient(to right, ${colorScale.low}, ${colorScale.high})` }}
        />
        <span>{max}</span>
      </div>
    </div>
  );
}
