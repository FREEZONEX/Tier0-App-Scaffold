import { cn } from "@/lib/utils";
import { FIELD_ICONS, FIELD_ICON_LABELS, type FieldIconKind } from "@/components/kit/ui/field-icons";

export interface FieldTypeIconProps {
  /** FieldType or CODE / PERSON / MULTILINE (see resolveFieldIconKind). */
  kind: FieldIconKind;
  className?: string;
  /** Adds a tooltip-style title with the type name. */
  showTitle?: boolean;
}

/** FieldTypeIcon — small muted icon before a column header / field name. */
export function FieldTypeIcon({ kind, className, showTitle = false }: FieldTypeIconProps) {
  const Icon = FIELD_ICONS[kind] ?? FIELD_ICONS.TEXT;
  return (
    <Icon
      aria-hidden={showTitle ? undefined : true}
      aria-label={showTitle ? FIELD_ICON_LABELS[kind] : undefined}
      strokeWidth={1.8}
      className={cn("size-3.5 shrink-0 text-text-secondary", className)}
    >
      {showTitle ? <title>{FIELD_ICON_LABELS[kind]}</title> : null}
    </Icon>
  );
}
