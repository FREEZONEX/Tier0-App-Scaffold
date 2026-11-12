"use client";

import { DataTable, TableCellText, TableStatusCell } from "@/components/data";
import { StatusBadge } from "@/components/ui";
import { formatKg, isStepDone, stepWindow } from "@/lib/mes-domain";
import type { BatchDetail } from "@/lib/mes-types";

export function BatchStepsTable({ steps }: { steps: BatchDetail["steps"] }) {
  return (
    <DataTable className="min-w-[600px] [&_td]:whitespace-nowrap">
      <thead>
        <tr>
          <th className="w-14">步骤</th>
          <th>物料</th>
          <th className="text-right">计划量</th>
          <th className="text-right">允许范围</th>
          <th className="text-right">已投</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step) => {
          const window = stepWindow(step);
          const done = isStepDone(step);
          return (
            <tr key={step.seq}>
              <td className="tabular-nums">{step.seq}</td>
              <td>
                <TableCellText>{step.materialName}</TableCellText>
                <span className="caption font-mono">{step.materialCode}</span>
              </td>
              <td className="text-right tabular-nums">{formatKg(step.plannedKg)}</td>
              <td className="text-right tabular-nums text-muted-foreground">
                {window.minKg} – {window.maxKg} kg
              </td>
              <td className="text-right tabular-nums">{formatKg(step.fedKg)}</td>
              <TableStatusCell>
                <StatusBadge tone={done ? "running" : step.fedKg > 0 ? "paused" : "idle"}>
                  {done ? "已达标" : step.fedKg > 0 ? "投料中" : "未投"}
                </StatusBadge>
              </TableStatusCell>
            </tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}
