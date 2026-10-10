"use client";

import {
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  LayerPathContext,
  placementOriginClass,
  useLayerPath,
  type Placement,
} from "@/components/kit/ui/floating";

export interface FloatingLayerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "style" | "children"> {
  open: boolean;
  /** Stable id (useId) of this layer; nested layers inherit the path. */
  layerId: string;
  floatingRef: RefObject<HTMLDivElement | null>;
  style: CSSProperties;
  placement: Placement;
  /** Pop-in animation on open. */
  animate?: boolean;
  children: ReactNode;
}

/**
 * FloatingLayer — portal container for dropdowns, popovers and pickers. It
 * records the nesting path (data-lingo-layer-path) so outside-click detection
 * treats nested layers as inside their parents.
 */
export function FloatingLayer({
  open,
  layerId,
  floatingRef,
  style,
  placement,
  animate = true,
  className,
  children,
  onClick,
  onMouseDown,
  ...rest
}: FloatingLayerProps) {
  const parentPath = useLayerPath();
  const path = useMemo(() => [...parentPath, layerId], [parentPath, layerId]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <LayerPathContext.Provider value={path}>
      <div
        {...rest}
        // Portaled panels are still React children of their trigger: keep
        // clicks inside the panel from reaching ancestors such as table rows.
        onClick={(event) => {
          onClick?.(event);
          event.stopPropagation();
        }}
        onMouseDown={(event) => {
          onMouseDown?.(event);
          event.stopPropagation();
        }}
        ref={floatingRef}
        data-lingo-layer-path={path.join(" ")}
        style={style}
        className={cn(
          animate && "animate-lingo-pop",
          placementOriginClass(placement),
          className,
        )}
      >
        {children}
      </div>
    </LayerPathContext.Provider>,
    document.body,
  );
}
