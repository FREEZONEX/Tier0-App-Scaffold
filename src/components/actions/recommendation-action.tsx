"use client";

import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/overlays/dialog";
import {
  OverlayActionButton,
  type OverlayAction,
} from "@/components/overlays/overlay-frame";
import { cn } from "@/lib/utils";

export interface ImpactPreviewMeta {
  label: ReactNode;
  value: ReactNode;
}

export interface ImpactPreviewItem {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  before?: ReactNode;
  after?: ReactNode;
  status?: ReactNode;
  meta?: ImpactPreviewMeta[];
}

export interface ImpactPreviewLabels {
  basisTitle?: ReactNode;
  impactTitle?: ReactNode;
  impactDescription?: ReactNode;
  reasonTitle?: ReactNode;
  beforeLabel?: string;
  afterLabel?: string;
}

const DEFAULT_LABELS: Required<ImpactPreviewLabels> = {
  basisTitle: "Recommendation basis",
  impactTitle: "Impact preview",
  impactDescription: "Review affected records before execution.",
  reasonTitle: "Reason",
  beforeLabel: "Before",
  afterLabel: "After",
};

export interface ImpactPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  basis?: ReactNode;
  reason?: ReactNode;
  impacts: ImpactPreviewItem[];
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  labels?: ImpactPreviewLabels;
  pending?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ImpactPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  basis,
  reason,
  impacts,
  children,
  confirmLabel = "Confirm action",
  cancelLabel = "Cancel",
  labels,
  pending = false,
  onConfirm,
}: ImpactPreviewDialogProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="lg"
      footer={
        <>
          <OverlayActionButton
            action={{ label: cancelLabel, variant: "outline", disabled: pending }}
            onDefaultClick={() => onOpenChange(false)}
          />
          <OverlayActionButton
            action={{
              label: confirmLabel,
              variant: "primary",
              loading: pending,
            }}
            onDefaultClick={() => void onConfirm()}
          />
        </>
      }
    >
      <div className="grid min-w-0 gap-4">
        {basis ? (
          <section className="min-w-0 rounded-md border border-border bg-surface-inset p-4">
            <h3 className="text-sm font-semibold leading-6 text-foreground">
              {text.basisTitle}
            </h3>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              {basis}
            </div>
          </section>
        ) : null}

        <section className="min-w-0 rounded-md border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold leading-6 text-foreground">
                {text.impactTitle}
              </h3>
              <span className="shrink-0 rounded-full border border-border bg-surface-inset px-2 py-0.5 text-xs leading-4 tabular-nums text-muted-foreground">
                {impacts.length}
              </span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {text.impactDescription}
            </p>
          </div>
          <div className="grid min-w-0 divide-y divide-border">
            {impacts.map((impact) => (
              <article key={impact.id} className="grid min-w-0 gap-3 p-4">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-medium leading-6 text-foreground">
                      {impact.label}
                    </h4>
                    {impact.description ? (
                      <p className="text-xs leading-5 text-muted-foreground">
                        {impact.description}
                      </p>
                    ) : null}
                  </div>
                  {impact.status ? (
                    <div className="shrink-0 rounded-full border border-border bg-surface-inset px-2.5 py-1 text-xs leading-4 text-muted-foreground">
                      {impact.status}
                    </div>
                  ) : null}
                </div>

                {(impact.before || impact.after) && (
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                    {impact.before ? (
                      <ImpactPreviewValue
                        label={text.beforeLabel}
                        value={impact.before}
                      />
                    ) : null}
                    {impact.after ? (
                      <ImpactPreviewValue
                        label={text.afterLabel}
                        value={impact.after}
                      />
                    ) : null}
                  </div>
                )}

                {impact.meta?.length ? (
                  <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
                    {impact.meta.map((item, index) => (
                      <div key={index} className="min-w-0">
                        <dt className="text-xs leading-5 text-muted-foreground">
                          {item.label}
                        </dt>
                        <dd className="truncate text-sm leading-6 text-foreground">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        {reason ? (
          <section className="min-w-0 rounded-md border border-border bg-card p-4">
            <h3 className="text-sm font-semibold leading-6 text-foreground">
              {text.reasonTitle}
            </h3>
            <div className="mt-1 text-sm leading-6 text-muted-foreground">
              {reason}
            </div>
          </section>
        ) : null}

        {children ? <div className="min-w-0">{children}</div> : null}
      </div>
    </Dialog>
  );
}

function ImpactPreviewValue({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-sm border border-border bg-surface-inset px-3 py-2",
        className,
      )}
    >
      <p className="text-xs leading-5 text-muted-foreground">{label}</p>
      <div className="truncate text-sm leading-6 text-foreground">{value}</div>
    </div>
  );
}

export interface RecommendationActionProps
  extends Omit<ImpactPreviewDialogProps, "open" | "onOpenChange"> {
  label: string;
  buttonVariant?: OverlayAction["variant"];
  disabled?: boolean;
}

export function RecommendationAction({
  label,
  buttonVariant = "primary",
  disabled = false,
  ...dialogProps
}: RecommendationActionProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <OverlayActionButton
        action={{ label, variant: buttonVariant, disabled }}
        onDefaultClick={() => setOpen(true)}
      />
      <ImpactPreviewDialog
        {...dialogProps}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
