"use client";

import { X, Trash2, LineChart } from "lucide-react";
import { BindingEditor } from "./BindingEditor";
import { Sparkline } from "./Sparkline";
import { RadialGauge } from "./RadialGauge";
import { useSeries } from "./useSeries";
import { useT } from "@/hmi/i18n/context";
import { resolveBinding } from "@/hmi/data/binding";
import type { MimicNode, Binding, WatchPoint } from "@/hmi/schema/schema";
import type { NodeState } from "@/hmi/scene/scene";
import type { Capability } from "@/hmi/symbols/capabilities";
import type { Registry } from "@/hmi/symbols/registry";
import type { Palette } from "@/hmi/engine/theme";

const PERCENT_FIELDS = new Set(["level", "value", "opening"]);

/** 实时值文字颜色：告警红 / 预警黄（加粗），正常默认色——用户一眼定位告警源。 */
const levelCls = (level?: "warn" | "alarm"): string =>
  level === "alarm"
    ? "text-destructive font-semibold"
    : level === "warn"
      ? "text-state-paused-fg font-semibold"
      : "text-foreground";

export function Inspector({
  node,
  state,
  capability,
  registry,
  palette,
  getPayload,
  onClose,
  onSetBinding,
  onSetLabel,
  onSetRotation,
  onSetSize,
  onAddTopic,
  onRemoveTopic,
  onAddWatch,
  onRemoveWatch,
  onUpdateWatch,
  onSetProp,
  onDelete,
  onConfigureActions,
  onViewHistory,
  readOnly = false,
}: {
  node: MimicNode;
  state: NodeState;
  capability?: Capability;
  registry: Registry;
  palette: Palette;
  getPayload: (topic: string) => unknown;
  onClose: () => void;
  onSetBinding: (field: string, binding: Binding) => void;
  onSetLabel: (label: string) => void;
  /** 设置旋转角（度，绕节点中心）。 */
  onSetRotation: (deg: number) => void;
  /** 设置等比缩放倍率（1=原始）。 */
  onSetSize: (size: number) => void;
  onAddTopic: (topic: string) => void;
  onRemoveTopic: (topic: string) => void;
  onAddWatch: (watch: WatchPoint) => void;
  onRemoveWatch: (index: number) => void;
  /** 更新第 index 个额外数据点（配/清告警阈值）。 */
  onUpdateWatch: (index: number, patch: Partial<WatchPoint>) => void;
  /** 设置/清除节点单个静态 prop（value 为 undefined/空串则删除该键）。 */
  onSetProp?: (key: string, value: string | undefined) => void;
  /** 删除本元件。 */
  onDelete: () => void;
  /** 打开操作配置弹窗（「操作」分节只是入口，配置本体在弹窗）。 */
  onConfigureActions: () => void;
  /** 打开历史数据查看器（趋势图/表格，走 UNS 历史接口）。只读态也可用（纯查询）。 */
  onViewHistory: () => void;
  /** 只读预览（operator 角色 / 预览模式）：仅实时数据与趋势，隐藏绑定编辑、发布、删除、改名。 */
  readOnly?: boolean;
}) {
  const t = useT();
  const entries = Object.entries(state.values);
  const watches = node.watches ?? [];
  // 主数值字段：优先 inline 中的数字字段，否则第一个数字值
  const numericField =
    node.inline.find((k) => typeof state.values[k] === "number") ??
    Object.keys(state.values).find((k) => typeof state.values[k] === "number");
  const numericValue = numericField ? (state.values[numericField] as number) : undefined;
  const isPercent = numericField !== undefined && PERCENT_FIELDS.has(numericField) && typeof numericValue === "number";
  const series = useSeries(numericValue, `${node.id}:${numericField ?? "-"}`);
  return (
    <aside
      className="absolute inset-y-0 right-0 z-20 flex h-full w-[88vw] max-w-sm flex-col border-l border-border bg-card shadow-xl md:static md:z-auto md:w-80 md:max-w-none md:shadow-none"
      aria-label={t("设备检视")}
      data-testid="inspector"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {readOnly ? (
          <span
            title={node.label ?? node.id}
            className="min-w-0 flex-1 truncate px-1 py-0.5 text-sm font-semibold text-foreground"
            data-testid="inspector-title"
          >
            {node.label ?? node.id}
          </span>
        ) : (
          <input
            defaultValue={node.label ?? ""}
            placeholder={node.id}
            onBlur={(e) => onSetLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            className="min-w-0 flex-1 truncate rounded-sm bg-transparent px-1 py-0.5 text-sm font-semibold text-foreground hover:bg-surface-inset focus:bg-surface-inset focus:outline-none focus:ring-1 focus:ring-focus-accent"
            aria-label={t("设备名称（可编辑）")}
            title={t("编辑元件名称（回车/失焦保存）")}
            data-testid="inspector-title"
          />
        )}
        {state.fault ? (
          <span className="shrink-0 rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">{t("报警")}</span>
        ) : state.stale ? (
          <span className="shrink-0 rounded-sm border border-border bg-surface-inset px-1.5 py-0.5 text-[10px] text-muted-foreground">{t("失联")}</span>
        ) : null}
        {capability ? <code className="shrink-0 text-[10px] text-muted-foreground">{capability.type}</code> : null}
        <button type="button" onClick={onClose} aria-label={t("关闭")} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("实时数据")}</p>
        {entries.length === 0 && watches.length === 0 ? (
          <p className="mb-4 text-xs text-muted-foreground">{t("暂无绑定数据")}</p>
        ) : (
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            {entries.map(([key, value]) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className={`text-right font-mono ${levelCls(state.levels?.[key])}`} data-testid={`rt-value-${key}`}>
                  {value === undefined ? "--" : String(value)}
                </dd>
              </div>
            ))}
            {watches.map((w, i) => {
              const v = resolveBinding(getPayload, { topic: w.topic, path: w.path });
              return (
                <div key={`watch-${i}`} className="contents">
                  <dt title={w.label} className="truncate text-muted-foreground">{w.label}</dt>
                  <dd className={`text-right font-mono ${levelCls(state.watchLevels?.[i])}`}>
                    {v === undefined || v === null ? "--" : String(v)}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        {numericField ? (
          <div className="mb-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("趋势 · {field}", { field: numericField })}
            </p>
            <div className="flex items-center gap-3">
              {isPercent ? <RadialGauge value={numericValue as number} size={72} label={numericField} /> : null}
              <div className="min-w-0 flex-1">
                <Sparkline values={series} />
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onViewHistory}
          data-testid="inspector-view-history"
          className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-sm border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-surface-inset hover:text-foreground"
        >
          <LineChart className="size-3.5" />
          {t("查看历史数据")}
        </button>

        {!readOnly ? (
          <>
            {/* 操作（写值动作）与数据绑定（数据→外观）严格分节；这里只是入口，配置本体在弹窗 */}
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("操作")}</p>
            <div className="mb-4">
              {(node.actions?.length ?? 0) > 0 ? (
                <div className="mb-1.5 flex flex-wrap gap-1" data-testid="actions-summary">
                  {node.actions!.map((a, i) => (
                    <span
                      key={i}
                      title={a.items.map((m) => m.topic).join("\n")}
                      className="rounded-full border border-border bg-surface-inset px-2 py-0.5 text-[10px] text-foreground"
                    >
                      {a.label}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mb-1.5 text-xs text-muted-foreground">{t("尚未配置操作按钮")}</p>
              )}
              <button
                type="button"
                onClick={onConfigureActions}
                data-testid="actions-configure"
                className="flex w-full items-center justify-center gap-1 rounded-sm border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-surface-inset hover:text-foreground"
              >
                {t("配置操作…")}
              </button>
            </div>
          </>
        ) : null}

        {!readOnly && capability ? (
          <>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("数据绑定")}</p>
            <BindingEditor
              node={node}
              capability={capability}
              registry={registry}
              palette={palette}
              getPayload={getPayload}
              onSetBinding={onSetBinding}
              onAddTopic={onAddTopic}
              onRemoveTopic={onRemoveTopic}
              onAddWatch={onAddWatch}
              onRemoveWatch={onRemoveWatch}
              onUpdateWatch={onUpdateWatch}
            />
          </>
        ) : null}

        {!readOnly && capability?.props?.length && onSetProp ? (
          <div className="mb-4" data-testid="props-section">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("样式 / 配置")}</p>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-2 text-xs">
              {/* 位号 (tag) */}
              {capability.props.some((p) => p.key === "tag") ? (
                <>
                  <span className="text-muted-foreground">{t("位号")}</span>
                  <input
                    type="text"
                    defaultValue={typeof node.props?.tag === "string" ? node.props.tag : ""}
                    placeholder="FT / LT / PT…"
                    onBlur={(e) => onSetProp("tag", e.target.value || undefined)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    aria-label={t("位号")}
                    data-testid="prop-tag"
                    className="w-full rounded-sm border border-border bg-transparent px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-focus-accent"
                  />
                </>
              ) : null}
              {/* 样式 (display): 方框 ⇄ 圆气泡 */}
              {capability.props.some((p) => p.key === "display") ? (
                <>
                  <span className="text-muted-foreground">{t("样式")}</span>
                  <div className="flex gap-1" role="group" aria-label={t("样式")}>
                    <button
                      type="button"
                      data-testid="prop-display-box"
                      onClick={() => onSetProp("display", "box")}
                      className={`flex-1 rounded-sm border px-2 py-0.5 text-xs ${node.props?.display !== "bubble" ? "border-focus-accent bg-focus-accent/10 text-foreground font-medium" : "border-border text-muted-foreground hover:bg-surface-inset hover:text-foreground"}`}
                    >
                      {t("方框")}
                    </button>
                    <button
                      type="button"
                      data-testid="prop-display-bubble"
                      onClick={() => onSetProp("display", "bubble")}
                      className={`flex-1 rounded-sm border px-2 py-0.5 text-xs ${node.props?.display === "bubble" ? "border-focus-accent bg-focus-accent/10 text-foreground font-medium" : "border-border text-muted-foreground hover:bg-surface-inset hover:text-foreground"}`}
                    >
                      {t("圆气泡")}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        ) : null}

        {!readOnly ? (
          <div className="mb-4" data-testid="transform-section">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("变换")}</p>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-2 text-xs">
              <span className="text-muted-foreground">{t("大小")}</span>
              <input
                type="range"
                min={0.25}
                max={5}
                step={0.05}
                value={node.sizeX ?? 1}
                onChange={(e) => onSetSize(Number(e.target.value))}
                aria-label={t("大小")}
                data-testid="transform-size"
                className="w-full accent-focus-accent"
              />
              <button
                type="button"
                onClick={() => onSetSize(1)}
                title={t("重置大小")}
                aria-label={t("重置大小")}
                className="tabular-nums rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-surface-inset hover:text-foreground"
              >
                {Math.round((node.sizeX ?? 1) * 100)}%
              </button>

              <span className="text-muted-foreground">{t("旋转")}</span>
              <input
                type="number"
                step={15}
                value={node.rotation}
                onChange={(e) => onSetRotation(Number(e.target.value))}
                aria-label={t("旋转")}
                data-testid="transform-rotation"
                className="w-full rounded-sm border border-border bg-transparent px-1.5 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-focus-accent"
              />
              <button
                type="button"
                onClick={() => onSetRotation(node.rotation + 90)}
                title={t("旋转 90°")}
                aria-label={t("旋转 90°")}
                className="rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-surface-inset hover:text-foreground"
              >
                +90°
              </button>
            </div>
          </div>
        ) : null}

        {!readOnly ? (
          <>
            <button
              type="button"
              onClick={onDelete}
              className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-sm border border-destructive/40 px-2 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              data-testid="inspector-delete"
            >
              <Trash2 className="size-3.5" />
              {t("删除元件")}
            </button>
          </>
        ) : null}
      </div>
    </aside>
  );
}
