import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { AsyncView } from "@/components/data";
import { EmptyState, StatusBadge } from "@/components/ui";
import { useRequest } from "@/lib/hooks";
import { useRecordChanges } from "@/lib/record-changes";
import { requestJson } from "@/lib/utils";
import { batchStatusLabel, batchStatusTone, formatDateTime, formatKg } from "@/lib/mes-domain";
import type { StationQueueItem } from "@/lib/mes-types";

export const Route = createFileRoute("/station/feed/")({
  component: FeedQueuePage,
});

function FeedQueuePage() {
  const queue = useRequest("mes:station-queue", (signal) =>
    requestJson<StationQueueItem[]>("/api/station-queue", { signal }),
  );
  useRecordChanges(["mes_batches"], () => queue.refresh());

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6">
      <h1 className="text-lg font-semibold">待投料批次</h1>
      <AsyncView
        result={queue}
        isEmpty={(items) => items.length === 0}
        empty={<EmptyState title="没有待投料的批次" description="计划员下达批次后会出现在这里。" />}
      >
        {(items) => (
          <ul className="space-y-3">
            {items.map((item) => {
              const pct = item.progressTotal ? Math.round((item.progressDone / item.progressTotal) * 100) : 0;
              return (
                <li key={item.id}>
                  <Link
                    to="/station/feed/$batchId"
                    params={{ batchId: item.id }}
                    className="flex min-h-20 items-center gap-4 rounded-[4px] border border-border bg-card p-4 shadow-sm transition-colors hover:border-highlight"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-base font-semibold">{item.code}</span>
                        <StatusBadge tone={batchStatusTone(item.status)}>{batchStatusLabel(item.status)}</StatusBadge>
                        <span className="text-sm text-muted-foreground">{item.reactor}</span>
                      </div>
                      <p className="truncate text-sm">
                        {item.productName} · {formatKg(item.targetOutputKg)} · 计划 {formatDateTime(item.plannedStartAt)}
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-highlight" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {item.progressDone}/{item.progressTotal} 步
                        </span>
                      </div>
                      {item.currentStep ? <p className="caption">下一步：{item.currentStep}</p> : null}
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </AsyncView>
    </div>
  );
}
