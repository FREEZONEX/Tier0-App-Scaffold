"use client";

/**
 * FieldValue — read-only rendering of one field value by type (list cells,
 * reference pickers, view mode, mobile cards):
 * 选项彩色文字 / 状态标签、关联名称、人员、多选、图片缩略图、附件数、超链接、
 * 日期精度、数字千分位; empty values render「-」.
 */
import { Paperclip } from "lucide-react";
import { Popover } from "@/components/kit/ui/popover";
import { ColorDotLabel, StatusTag, Tag } from "@/components/kit/ui/tag";
import { AttachmentUpload, ImageThumbs } from "@/components/kit/ui/upload";
import {
  EMPTY_TEXT,
  fileList,
  findOption,
  formatFieldValue,
  isEmptyValue,
  optionTone,
} from "@/lib/component-kit/format";
import type { FieldDef, RowHeight } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";

export interface FieldValueProps {
  field: Pick<FieldDef, "type" | "widget" | "options" | "code" | "name">;
  value: unknown;
  /** Render single-select values as lifecycle status tags. */
  status?: boolean;
  rowHeight?: RowHeight;
  className?: string;
}

const THUMB_SIZE: Record<RowHeight, number> = { LOW: 26, MID: 36, HIGH: 52 };

export function FieldValue({ field, value, status = false, rowHeight = "MID", className }: FieldValueProps) {
  if (isEmptyValue(value)) return <span className={className}>{EMPTY_TEXT}</span>;
  if (field.type === "RELATION_REFERENCE" && field.widget?.fieldType && field.widget.fieldType !== "RELATION_REFERENCE") {
    // 关联引用 renders like the referenced field.
    return <FieldValue field={{ ...field, type: field.widget.fieldType }} value={value} rowHeight={rowHeight} className={className} />;
  }

  switch (field.type) {
    case "SINGLE_SELECT": {
      const option = findOption(field.options, value);
      const label = option?.label ?? formatFieldValue(field, value);
      if (option?.color) {
        return (
          <ColorDotLabel color={option.color} className={className}>
            {label}
          </ColorDotLabel>
        );
      }
      if (status) {
        return (
          <StatusTag tone={optionTone(label)} className={className}>
            {label}
          </StatusTag>
        );
      }
      return <span className={className}>{label}</span>;
    }
    case "MULTI_SELECT": {
      const values = Array.isArray(value) ? value : [value];
      const colored = values.some((item) => findOption(field.options, item)?.color);
      if (!colored) return <span className={className}>{formatFieldValue(field, value)}</span>;
      return (
        <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-1", className)}>
          {values.map((item) => {
            const option = findOption(field.options, item);
            return (
              <Tag key={String(item)} color={option?.color ?? undefined} size="sm">
                {option?.label ?? String(item)}
              </Tag>
            );
          })}
        </span>
      );
    }
    case "IMAGE":
      return <ImageThumbs value={fileList(value)} size={THUMB_SIZE[rowHeight]} max={rowHeight === "LOW" ? 2 : 3} className={className} />;
    case "ATTACHMENT": {
      const files = fileList(value);
      if (!files.length) return <span className={className}>{EMPTY_TEXT}</span>;
      return (
        <Popover
          trigger="hover"
          placement="bottom-start"
          className="w-72"
          content={<AttachmentUpload value={files} readOnly />}
        >
          <span className={cn("inline-flex cursor-default items-center gap-1 text-brand", className)}>
            <Paperclip className="size-3.5" aria-hidden="true" />
            {files.length} 个附件
          </span>
        </Popover>
      );
    }
    case "HYPERLINK": {
      const href = String(value);
      const safe = /^(https?:)?\/\//i.test(href) || href.startsWith("/") ? href : `https://${href}`;
      return (
        <a
          href={safe}
          target="_blank"
          rel="noreferrer"
          className={cn("text-brand hover:underline", className)}
          onClick={(event) => event.stopPropagation()}
        >
          {href}
        </a>
      );
    }
    default:
      return <span className={className}>{formatFieldValue(field, value)}</span>;
  }
}
