"use client";

import {
  DataTable,
  TableCellText,
  TableNumericCell,
  TableNumericHeader,
  TableStatusCell,
} from "@/components/data";
import { StatusBadge } from "@/components/ui";
import { formatKg, isStepDone, stepWindow } from "@/lib/mes-domain";
import type { BatchDetail } from "@/lib/mes-types";

export function BatchStepsTable({
  steps,
  bare = false,
}: {
  steps: BatchDetail["steps"];
  /** Drop the outer frame when the table sits inside a Card. */
  bare?: boolean;
}) {
  return (
    <DataTable bare={bare} className="min-w-[640px]">
      <thead>
        <tr>
          <th className="table-col-fit">步骤</th>
          <th>物料</th>
          <TableNumericHeader className="w-28">计划量</TableNumericHeader>
          <TableNumericHeader className="w-44">允许范围</TableNumericHeader>
          <TableNumericHeader className="w-28">已投</TableNumericHeader>
          <th className="table-col-fit">状态</th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step) => {
          const window = stepWindow(step);
          const done = isStepDone(step);
          return (
            <tr key={step.seq}>
              <td className="table-col-fit tabular-nums text-muted-foreground">{step.seq}</td>
              <td>
                <TableCellText secondary={step.materialCode}>{step.materialName}</TableCellText>
              </td>
              <TableNumericCell>{formatKg(step.plannedKg)}</TableNumericCell>
              <TableNumericCell className="text-muted-foreground">
                {window.minKg} – {window.maxKg} kg
              </TableNumericCell>
              <TableNumericCell>{formatKg(step.fedKg)}</TableNumericCell>
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
