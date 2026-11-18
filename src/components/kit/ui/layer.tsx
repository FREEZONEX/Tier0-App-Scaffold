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
import { EXIT_POP_FAST } from "@/lib/interaction";
import { EXIT_MS, usePresence } from "@/lib/presence";
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
 * records the nesting path (data-tier0-layer-path) so outside-click detection
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
  const presence = usePresence(open, EXIT_MS.fast);

  if (!presence.mounted || typeof document === "undefined") return null;

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
        data-tier0-layer-path={path.join(" ")}
        data-state={presence.state}
        aria-hidden={open ? undefined : true}
        style={style}
        className={cn(
          animate && "animate-tier0-pop",
          placementOriginClass(placement),
          className,
          animate && EXIT_POP_FAST,
        )}
      >
        {children}
      </div>
    </LayerPathContext.Provider>,
    document.body,
  );
}
