"use client";

/** Configurable record card; applications supply fields, progress and custom content. */
import type { ReactNode } from "react";
import { ProgressBar } from "@/components/kit/ui/feedback";
import { StatusTag } from "@/components/kit/ui/tag";
import { EMPTY_TEXT, findOption, formatFieldValue, formatNumber, numberOptionsOf, optionTone } from "@/lib/component-kit/format";
import type { FieldDef, MobileCardConfig } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { FieldValue } from "@/components/kit/meta/field-value";

export interface MobileCardProps {
  config: Pick<MobileCardConfig, "titleFields" | "indicatorField" | "displayFields" | "components">;
  /** Field definitions of the card object (labels, options, formats). */
  fields: readonly FieldDef[];
  /** The record; omit for the template preview. */
  record?: Record<string, unknown> | null;
  /** Fields shown as status tags above the title (工单状态、工期状态). */
  statusFields?: readonly string[];
  /** Buttons / links at the bottom (报工、审批…). */
  actions?: ReactNode;
  progress?: number;
  renderComponent?: (key: string, record: Record<string, unknown> | null) => ReactNode;
  onClick?: () => void;
  className?: string;
}

export function MobileCard({ config, fields, record, statusFields = [], actions, progress, renderComponent, onClick, className }: MobileCardProps) {
  const byCode = new Map(fields.map((field) => [field.code, field]));
  const preview = !record;
  const titleText = config.titleFields
    .map((code) => {
      const field = byCode.get(code);
      if (!field) return null;
      return preview ? field.name : formatFieldValue(field, record?.[code], { plain: true }) || null;
    })
    .filter(Boolean)
    .join(" · ");
  const indicator = config.indicatorField ? byCode.get(config.indicatorField) : undefined;
  const indicatorValue = indicator
    ? preview
      ? "99"
      : formatNumber(record?.[indicator.code], { ...numberOptionsOf(indicator.widget), suffix: undefined })
    : null;
  const tags = statusFields.map((code) => byCode.get(code)).filter((field): field is FieldDef => Boolean(field));
  const hasHeader = tags.length > 0 || titleText || indicator;

  return (
    <article
      className={cn(
        "min-w-0 rounded-xl border border-[#e8e8e8] bg-card p-3 text-sm shadow-[0_1px_2px_rgb(15_23_42/0.04)]",
        onClick && "cursor-pointer transition-shadow hover:shadow-md",
        className,
      )}
      onClick={onClick}
    >
      {hasHeader ? (
        <header className="flex min-w-0 items-start gap-3 border-b border-border-secondary pb-2.5">
          <div className="min-w-0 flex-1">
            {tags.length ? (
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                {tags.map((field) => {
                  if (preview) {
                    return (
                      <StatusTag key={field.code} tone="default">
                        {field.name}
                      </StatusTag>
                    );
                  }
                  const value = record?.[field.code];
                  const label = findOption(field.options, value)?.label ?? formatFieldValue(field, value);
                  if (label === EMPTY_TEXT) return null;
                  return (
                    <StatusTag key={field.code} tone={optionTone(label)}>
                      {label}
                    </StatusTag>
                  );
                })}
              </div>
            ) : null}
            {titleText ? <h3 className="line-clamp-2 break-all text-[15px] font-semibold leading-6 text-foreground">{titleText}</h3> : null}
          </div>
          {indicator ? (
            <div className="flex shrink-0 flex-col items-end text-right">
              <span className="text-xl font-semibold leading-7 tabular-nums text-brand">{indicatorValue}</span>
              <span className="text-xs text-text-tertiary">{indicator.name}</span>
            </div>
          ) : null}
        </header>
      ) : null}
      <dl className={cn("grid min-w-0 gap-1.5", hasHeader && "pt-2.5")}>
        {config.displayFields.map((code) => {
          const field = byCode.get(code);
          if (!field) return null;
          return (
            <div key={code} className="flex min-w-0 items-start gap-1 leading-6">
              <dt className="shrink-0 text-text-tertiary">{field.name}：</dt>
              <dd className="min-w-0 flex-1 break-all text-foreground">
                {preview ? <span className="text-text-tertiary">xxxx</span> : <FieldValue field={field} value={record?.[code]} rowHeight="LOW" />}
              </dd>
            </div>
          );
        })}
        {config.components.map((component) => (
          <div key={component} className="pt-1">
            {renderComponent ? renderComponent(component, record ?? null) : component === "progress" && (preview || progress !== undefined) ? <ProgressBar percent={preview ? 60 : progress ?? 0} size="sm" /> : null}
          </div>
        ))}
      </dl>
      {actions ? <footer className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border-secondary pt-2.5">{actions}</footer> : null}
    </article>
  );
}
