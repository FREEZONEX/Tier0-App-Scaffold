"use client";

/**
 * ListScopeSwitch — 列表的数据范围切换（topTabs）。
 *
 * Few options that fit the available width are laid out as a segmented
 * control; otherwise (too many options, or not enough room) the same options
 * become one Select. It never wraps or scrolls horizontally.
 */
import { useRef, useState } from "react";
import { CapsuleGroup } from "@/components/kit/ui/tabs";
import { useIsoLayoutEffect } from "@/components/kit/ui/floating";
import { Select } from "@/components/kit/ui/select";
import { cn } from "@/lib/utils";

/** More options than this always use the Select. */
export const SCOPE_INLINE_MAX = 5;

export interface ListScopeItem {
  key: string;
  label: string;
  count?: number;
}

const SEGMENTED_CLASS = "w-max flex-nowrap gap-1 p-0.5 [&>button]:min-h-8 [&>button]:whitespace-nowrap [&>button]:py-1";

function CountBadge({ count }: { count?: number }) {
  if (count === undefined) return null;
  return <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{count}</span>;
}

export function ListScopeSwitch({
  items,
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "数据范围",
}: {
  items: readonly ListScopeItem[];
  value: string | undefined;
  onChange: (key: string) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const tooMany = items.length > SCOPE_INLINE_MAX;
  const [fits, setFits] = useState(true);

  useIsoLayoutEffect(() => {
    const wrap = wrapRef.current;
    const measure = measureRef.current;
    if (tooMany || !wrap || !measure) return;
    const update = () => setFits(measure.scrollWidth <= wrap.clientWidth + 0.5);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [tooMany]);

  const segmented = !tooMany && fits;
  const capsuleItems = items.map((item) => ({ key: item.key, label: item.label, count: item.count }));

  return (
    <div ref={wrapRef} className={cn("relative min-w-0", className)}>
      {tooMany ? null : (
        <div ref={measureRef} aria-hidden="true" inert className="pointer-events-none invisible absolute left-0 top-0 w-max">
          <CapsuleGroup<string> className={SEGMENTED_CLASS} items={capsuleItems} value={value} onChange={() => undefined} />
        </div>
      )}
      {segmented ? (
        <CapsuleGroup<string> className={SEGMENTED_CLASS} aria-label={ariaLabel} items={capsuleItems} value={value} onChange={onChange} />
      ) : (
        <Select<string>
          aria-label={ariaLabel}
          className="w-full sm:w-52"
          options={items.map((item) => ({ value: item.key, label: item.label }))}
          value={value ?? null}
          onChange={(next) => {
            if (next !== null) onChange(next);
          }}
          labelRender={(option) => (
            <span className="flex min-w-0 items-center">
              <span className="truncate">{option.label}</span>
              <CountBadge count={items.find((item) => item.key === option.value)?.count} />
            </span>
          )}
          optionRender={(option) => (
            <span className="flex min-w-0 flex-1 items-center">
              <span className="truncate">{option.label}</span>
              <CountBadge count={items.find((item) => item.key === option.value)?.count} />
            </span>
          )}
        />
      )}
    </div>
  );
}
