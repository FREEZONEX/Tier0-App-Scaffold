/** Field type → header icon mapping (列表表头类型小图标). */
import {
  CalendarDays,
  Flag,
  Hash,
  Image,
  LetterText,
  Link,
  Link2,
  ListChecks,
  MessageSquareText,
  Paperclip,
  SquareArrowOutUpRight,
  Tag,
  User,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import type { FieldDef, FieldType } from "@/lib/component-kit/types";

export type FieldIconKind = FieldType | "CODE" | "PERSON" | "MULTILINE";

export const FIELD_ICONS: Record<FieldIconKind, LucideIcon> = {
  CODE: Hash,
  TEXT: LetterText,
  MULTILINE: MessageSquareText,
  NUMBER: Tag,
  DATETIME: CalendarDays,
  SINGLE_SELECT: Flag,
  MULTI_SELECT: ListChecks,
  RELATION_OBJECT: Link,
  RELATION_ATTRIBUTE: Link2,
  RELATION_REFERENCE: Waypoints,
  PERSON: User,
  IMAGE: Image,
  ATTACHMENT: Paperclip,
  HYPERLINK: SquareArrowOutUpRight,
};

export const FIELD_ICON_LABELS: Record<FieldIconKind, string> = {
  CODE: "编号",
  TEXT: "文本",
  MULTILINE: "多行文本",
  NUMBER: "数字",
  DATETIME: "日期",
  SINGLE_SELECT: "单选",
  MULTI_SELECT: "多选",
  RELATION_OBJECT: "关联",
  RELATION_ATTRIBUTE: "关联属性",
  RELATION_REFERENCE: "关联引用",
  PERSON: "人员",
  IMAGE: "图片",
  ATTACHMENT: "附件",
  HYPERLINK: "超链接",
};

const PERSON_OBJECTS = new Set(["person", "staff", "user"]);

/** Pick the icon kind for a field (primary code field → CODE, person relations → PERSON…). */
export function resolveFieldIconKind(
  field: Pick<FieldDef, "code" | "type" | "widget" | "reference">,
  primaryField?: string,
): FieldIconKind {
  if (primaryField && field.code === primaryField) return "CODE";
  const renderType = field.widget?.fieldType;
  if (renderType === "HYPERLINK") return field.type === "TEXT" ? "CODE" : "HYPERLINK";
  if (field.type === "RELATION_OBJECT" && field.reference && PERSON_OBJECTS.has(field.reference.objectCode)) {
    return "PERSON";
  }
  if (field.type === "TEXT" && field.widget?.multiline) return "MULTILINE";
  return field.type;
}
