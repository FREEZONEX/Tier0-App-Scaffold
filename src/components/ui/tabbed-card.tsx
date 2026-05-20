"use client";

import { cn } from "@/lib/utils";
import { type ReactNode, useState } from "react";
import { AnimatePresence, motion } from "@/lib/motion";

/**
 * TabbedCard — card with built-in tab navigation for multi-view content.
 * Eliminates the "every card shows one thing" pattern.
 *
 * Usage:
 *   <TabbedCard
 *     tabs={[
 *       { id: "overview", label: "Overview", content: <OverviewPanel /> },
 *       { id: "details", label: "Details", content: <DetailsPanel /> },
 *       { id: "history", label: "History", content: <HistoryPanel /> },
 *     ]}
 *   />
 */

interface Tab {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: ReactNode;
}

interface TabbedCardProps {
  tabs: Tab[];
  /** Initial active tab id. Defaults to first tab. */
  defaultTab?: string;
  /** Size variant */
  size?: "sm" | "default";
  className?: string;
}

export function TabbedCard({
  tabs,
  defaultTab,
  size = "default",
  className,
}: TabbedCardProps) {
  const [activeId, setActiveId] = useState(defaultTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (!tabs.length) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]",
        className
      )}
    >
      {/* Tab bar */}
      <div className="flex border-b border-[var(--border)] bg-[var(--surface-inset)]">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 text-xs font-medium transition-colors",
                size === "sm" ? "py-2" : "py-2.5",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="tabbed-card-underline"
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--accent)]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className={cn("relative", size === "sm" ? "p-3" : "p-4")}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
