"use client";

import { cn } from "@/lib/utils";
import { MiniSparkline } from "./MiniSparkline";

/**
 * FleetGrid — dense grid of compact machine/device status tiles.
 * "See the whole floor at a glance." Different visual density from any other component.
 *
 * Usage:
 *   <FleetGrid
 *     items={[
 *       { id: "CNC-01", label: "CNC-01", status: "running", metric: "1,284 pcs" },
 *       { id: "CNC-02", label: "CNC-02", status: "idle" },
 *       { id: "CNC-03", label: "CNC-03", status: "down", metric: "Fault: Spindle" },
 *     ]}
 *     onItemClick={(id) => router.push(`/equipment/${id}`)}
 *   />
 */

interface FleetItem {
  id: string;
  label: string;
  /** Status key — uses the same palette as StateBadge. */
  status: string;
  /** Optional metric or status detail shown below label. */
  metric?: string;
  /** Optional recent data points — renders a tiny sparkline in the tile. */
  sparkline?: number[];
  /** Optional icon component. */
  icon?: React.ComponentType<{ className?: string }>;
}

interface FleetGridProps {
  items: FleetItem[];
  /** Number of columns. Default auto-fit (responsive). */
  columns?: number;
  /** Click handler. When provided, tiles become clickable. */
  onItemClick?: (id: string) => void;
  className?: string;
}

const statusBorder: Record<string, string> = {
  running:     "border-l-[var(--accent)]",
  active:      "border-l-[var(--accent)]",
  completed:   "border-l-emerald-500",
  done:        "border-l-emerald-500",
  passed:      "border-l-emerald-500",
  idle:        "border-l-gray-400",
  pending:     "border-l-gray-400",
  draft:       "border-l-gray-400",
  paused:      "border-l-amber-500",
  maintenance: "border-l-amber-500",
  warning:     "border-l-amber-500",
  down:        "border-l-red-500",
  failed:      "border-l-red-500",
  rejected:    "border-l-red-500",
  blocked:     "border-l-red-500",
};

const statusDot: Record<string, string> = {
  running:     "bg-[var(--accent)]",
  active:      "bg-[var(--accent)]",
  completed:   "bg-emerald-500",
  done:        "bg-emerald-500",
  idle:        "bg-gray-400",
  pending:     "bg-gray-400",
  paused:      "bg-amber-500",
  maintenance: "bg-amber-500",
  down:        "bg-red-500",
  failed:      "bg-red-500",
};

export function FleetGrid({
  items,
  columns,
  onItemClick,
  className,
}: FleetGridProps) {
  const gridStyle = columns
    ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
    : { gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" };

  return (
    <div className={cn("grid gap-2", className)} style={gridStyle}>
      {items.map((item) => {
        const key = item.status.toLowerCase();
        const borderColor = statusBorder[key] ?? "border-l-gray-300";
        const dotColor = statusDot[key] ?? "bg-gray-400";
        const isActive = key === "running" || key === "active";
        const Icon = item.icon;

        return (
          <div
            key={item.id}
            onClick={onItemClick ? () => onItemClick(item.id) : undefined}
            className={cn(
              "rounded-lg border border-[var(--border)] border-l-[3px] bg-white p-3 transition-shadow",
              borderColor,
              isActive && "shadow-glow-accent",
              onItemClick && "cursor-pointer hover:shadow-[var(--shadow-md)]"
            )}
          >
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="truncate text-xs font-semibold">{item.label}</span>
              <span className="relative ml-auto flex h-2 w-2 shrink-0">
                <span className={cn("h-2 w-2 rounded-full", dotColor)} />
                {isActive && (
                  <span
                    className={cn("absolute inset-0 rounded-full", dotColor)}
                    style={{ animation: "ping-dot 1.5s cubic-bezier(0, 0, 0.2, 1) infinite" }}
                  />
                )}
              </span>
            </div>

            {item.metric && (
              <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
                {item.metric}
              </p>
            )}

            {item.sparkline && item.sparkline.length > 1 && (
              <div className="mt-2 -mx-1">
                <MiniSparkline data={item.sparkline} height={24} color={dotColor.replace("bg-", "").includes("accent") ? "var(--accent)" : "#a1a1aa"} />
              </div>
            )}

            <p className={cn("text-[10px] capitalize text-muted-foreground", !item.sparkline && "mt-1")}>
              {item.status}
            </p>
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="col-span-full py-6 text-center text-xs text-muted-foreground">No equipment</div>
      )}
    </div>
  );
}
