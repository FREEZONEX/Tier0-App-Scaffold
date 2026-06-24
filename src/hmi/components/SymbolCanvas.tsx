"use client";

import { useEffect, useRef } from "react";
import { createCanvasStage } from "@/hmi/engine/canvas-stage";
import { fit } from "@/hmi/engine/viewport";
import type { Palette } from "@/hmi/engine/theme";
import type { Swatch } from "./legend-entries";

/** 通用图元色卡：用与画布同一套 painter 单次静态绘制给定图元（图例 / 组件预览共用）。 */
export function SymbolCanvas({ swatch, theme, className }: { swatch: Swatch; theme: Palette; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const stage = createCanvasStage(canvas, () => stage.draw(swatch.primitives, fit(swatch.box, stage.size(), 4), 0));
    stage.draw(swatch.primitives, fit(swatch.box, stage.size(), 4), 0);
    return () => stage.destroy();
  }, [swatch, theme]);
  return (
    <canvas
      ref={ref}
      className={className ?? "size-9 shrink-0 rounded-sm border border-border"}
      style={{ backgroundColor: theme.canvas }}
      aria-hidden
    />
  );
}
