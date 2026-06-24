"use client";

import type { ReactNode } from "react";
import { Activity } from "lucide-react";
import { ConnectionControl } from "./ConnectionControl";
import { useI18n } from "@/hmi/i18n/context";
import type { ConnectionStatus } from "@/hmi/data/data-source";
import type { DataSourceKind } from "@/hmi/data/source-factory";

export type HmiMode = "edit" | "preview" | "demo";

/**
 * 顶栏：标题 + 模式切换 + 全局 MQTT 状态（颜色点）。
 * 已按用户要求隐藏：上传 schema、中英文切换（语言由请求 Accept-Language 决定）、主题切换（固定白天）。
 */
export function Topbar({
  title,
  mimicSwitcher,
  status,
  brokerUrl,
  sourceKind = "real",
  mode = "edit",
  onModeChange,
  canSwitchMode = false,
  demoAvailable = false,
}: {
  title: string;
  mimicSwitcher?: ReactNode;
  status: ConnectionStatus;
  brokerUrl: string;
  /** 数据源类别（演示/模拟/真实），驱动状态徽标。 */
  sourceKind?: DataSourceKind;
  /** 编辑/预览/演示模式。预览/演示 = 只读监控（operator 角色固定预览）。 */
  mode?: HmiMode;
  onModeChange?: (m: HmiMode) => void;
  /** 是否显示模式切换（仅有编辑权的角色可切，operator 不可见）。 */
  canSwitchMode?: boolean;
  /** 是否显示「演示」态切换（演示=钉死的只读样板，仅 DB 空时显示；DB 有真实图则隐藏）。 */
  demoAvailable?: boolean;
}) {
  const { t } = useI18n();
  const modeBtn = (active: boolean) =>
    active ? "bg-foreground px-2 py-1 text-xs text-background" : "bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground";
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-card px-3">
      <Activity className="size-4 text-highlight-text" />
      {mimicSwitcher ?? <span title={title} className="truncate text-sm font-semibold text-foreground">{title}</span>}
      <span className="flex-1" />
      {canSwitchMode && onModeChange ? (
        <div className="inline-flex overflow-hidden rounded-sm border border-border" role="group" aria-label={t("模式切换")} data-testid="mode-toggle">
          <button type="button" onClick={() => onModeChange("edit")} aria-pressed={mode === "edit"} className={modeBtn(mode === "edit")}>
            {t("编辑")}
          </button>
          <button type="button" onClick={() => onModeChange("preview")} aria-pressed={mode === "preview"} className={modeBtn(mode === "preview")}>
            {t("预览")}
          </button>
          {demoAvailable ? (
            <button type="button" onClick={() => onModeChange("demo")} aria-pressed={mode === "demo"} className={modeBtn(mode === "demo")} data-testid="mode-demo">
              {t("演示")}
            </button>
          ) : null}
        </div>
      ) : null}
      <ConnectionControl status={status} brokerUrl={brokerUrl} kind={sourceKind} />
    </header>
  );
}
