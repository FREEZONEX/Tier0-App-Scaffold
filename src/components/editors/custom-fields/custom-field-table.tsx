"use client";

/**
 * 自定义配置 › 字段列表 (06 §2, 900_cc_workorder.png): 「⊕ 添加字段」+ 字段数量 N/80 +
 * 输入字段名（前端过滤）; table without pagination — 拖拽柄 + 序号 (drag rows to reorder,
 * saved at once), 字段名称, 字段类型 (colored tag), 是否必填, 提示说明, 创建时间, 创建人,
 * 更新时间, 更新人, 操作 (编辑 / 删除).
 */
import { CirclePlus, GripVertical, Info, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextButton } from "@/components/kit/ui/buttons";
import { DataGrid, type DataGridColumn } from "@/components/kit/ui/data-grid";
import { FieldTypeIcon } from "@/components/kit/ui/field-type-icon";
import { Input } from "@/components/kit/ui/input";
import { Tag } from "@/components/kit/ui/tag";
import { Tooltip } from "@/components/kit/ui/tooltip";
import { formatDateTime } from "@/lib/component-kit/format";
import type { CustomFieldRecord } from "@/lib/component-kit/types";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_COLOR, FIELD_TYPE_LABEL } from "@/components/editors/custom-fields/field-type-meta";

export interface CustomFieldTableProps {
  objectLabel: string;
  fields: CustomFieldRecord[];
  limit: number;
  canManage: boolean;
  onCreate: () => void;
  onEdit: (field: CustomFieldRecord) => void;
  onDelete: (field: CustomFieldRecord) => void;
  /** Persist the new order; resolve when saved, reject to roll back. */
  onReorder: (fieldCodes: string[]) => Promise<void>;
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function CustomFieldTable({ objectLabel, fields, limit, canManage, onCreate, onEdit, onDelete, onReorder }: CustomFieldTableProps) {
  const [keyword, setKeyword] = useState("");
  const [order, setOrder] = useState<string[]>(() => fields.map((field) => field.fieldCode));
  const [dragCode, setDragCode] = useState<string | null>(null);
  const [dropCode, setDropCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ordered = useMemo(() => {
    const byCode = new Map(fields.map((field) => [field.fieldCode, field]));
    const list = order.map((code) => byCode.get(code)).filter((field): field is CustomFieldRecord => Boolean(field));
    for (const field of fields) if (!order.includes(field.fieldCode)) list.push(field);
    return list;
  }, [fields, order]);

  const text = keyword.trim().toLowerCase();
  const rows = text ? ordered.filter((field) => field.name.toLowerCase().includes(text)) : ordered;
  const canDrag = canManage && !text && !saving;
  const full = fields.length >= limit;

  const drop = async (targetCode: string) => {
    if (!dragCode || dragCode === targetCode) return;
    const codes = ordered.map((field) => field.fieldCode);
    const from = codes.indexOf(dragCode);
    const to = codes.indexOf(targetCode);
    if (from < 0 || to < 0) return;
    const previous = codes;
    const next = move(codes, from, to);
    setOrder(next);
    setSaving(true);
    try {
      await onReorder(next);
    } catch {
      setOrder(previous);
    } finally {
      setSaving(false);
    }
  };

  const columns: DataGridColumn<CustomFieldRecord>[] = [
    {
      key: "name",
      title: "字段名称",
      headerIcon: <FieldTypeIcon kind="TEXT" />,
      width: 160,
      render: (field) => field.name,
    },
    {
      key: "type",
      title: "字段类型",
      headerIcon: <FieldTypeIcon kind="TEXT" />,
      width: 104,
      ellipsis: false,
      render: (field) => <Tag color={FIELD_TYPE_COLOR[field.type] ?? "#050b14"}>{FIELD_TYPE_LABEL[field.type] ?? field.type}</Tag>,
    },
    {
      key: "required",
      title: "是否必填",
      headerIcon: <FieldTypeIcon kind="SINGLE_SELECT" />,
      width: 100,
      ellipsis: false,
      render: (field) => <Tag>{field.widget?.required ? "必填" : "非必填"}</Tag>,
    },
    {
      key: "tooltip",
      title: "提示说明",
      headerIcon: <FieldTypeIcon kind="MULTILINE" />,
      width: 140,
      render: (field) => field.widget?.tooltip || "-",
    },
    {
      key: "createdAt",
      title: "创建时间",
      headerIcon: <FieldTypeIcon kind="DATETIME" />,
      width: 150,
      render: (field) => formatDateTime(field.createdAt, "DATETIME_MINUTE") || "-",
    },
    {
      key: "createdByName",
      title: "创建人",
      headerIcon: <FieldTypeIcon kind="PERSON" />,
      width: 96,
      render: (field) => field.createdByName || "-",
    },
    {
      key: "updatedAt",
      title: "更新时间",
      headerIcon: <FieldTypeIcon kind="DATETIME" />,
      width: 150,
      render: (field) => formatDateTime(field.updatedAt, "DATETIME_MINUTE") || "-",
    },
    {
      key: "updatedByName",
      title: "更新人",
      headerIcon: <FieldTypeIcon kind="PERSON" />,
      width: 96,
      render: (field) => field.updatedByName || "-",
    },
  ];
  if (canManage) {
    columns.push({
      key: "__actions",
      title: "操作",
      width: 104,
      fixed: "right",
      ellipsis: false,
      render: (field) => (
        <span className="inline-flex items-center gap-3">
          <TextButton onClick={() => onEdit(field)}>编辑</TextButton>
          <TextButton tone="danger" onClick={() => onDelete(field)}>
            删除
          </TextButton>
        </span>
      ),
    });
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        {canManage ? (
          full ? (
            <Tooltip title={`字段数量已达上限（${limit}个）`}>
              <span className="inline-flex">
                <Button variant="primary" icon={<CirclePlus />} disabled>
                  添加字段
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button variant="primary" icon={<CirclePlus />} onClick={onCreate}>
              添加字段
            </Button>
          )
        ) : null}
        <span className="text-sm text-text-tertiary tabular-nums">
          字段数量：{fields.length}/{limit}
        </span>
        {canManage && fields.length > 1 ? (
          <Tooltip title={`拖动字段列表可更新字段在${objectLabel}中的展示顺序（表单、列表、查询、导入导出按此顺序排列）`}>
            <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
              <Info className="size-3.5" aria-hidden="true" />
              {saving ? "正在保存顺序…" : text ? "清空搜索后可拖动排序" : "拖动行调整顺序"}
            </span>
          </Tooltip>
        ) : null}
        <Input
          aria-label="输入字段名"
          className="w-full sm:ml-auto sm:w-56"
          prefix={<Search className="size-3.5 text-text-placeholder" />}
          placeholder="输入字段名"
          allowClear
          value={keyword}
          onChange={setKeyword}
        />
      </div>
      <DataGrid<CustomFieldRecord>
        aria-label={`${objectLabel}自定义字段`}
        columns={columns}
        rows={rows}
        rowKey={(field) => field.fieldCode}
        rowHeight="HIGH"
        indexWidth={canManage ? 72 : 60}
        maxHeight="max(360px, calc(100dvh - 240px))"
        empty={text ? "没有匹配的字段" : undefined}
        renderIndex={(_field, index) => (
          <span className="inline-flex items-center gap-2">
            {canManage ? (
              <GripVertical className={cn("size-4 text-text-placeholder", canDrag ? "cursor-grab" : "opacity-40")} aria-hidden="true" />
            ) : null}
            <span className="tabular-nums">{index + 1}</span>
          </span>
        )}
        rowProps={
          canDrag
            ? (field) => ({
                draggable: true,
                onDragStart: (event) => {
                  setDragCode(field.fieldCode);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", field.fieldCode);
                },
                onDragOver: (event) => {
                  if (!dragCode) return;
                  event.preventDefault();
                  if (dropCode !== field.fieldCode) setDropCode(field.fieldCode);
                },
                onDrop: (event) => {
                  event.preventDefault();
                  void drop(field.fieldCode);
                  setDragCode(null);
                  setDropCode(null);
                },
                onDragEnd: () => {
                  setDragCode(null);
                  setDropCode(null);
                },
                className: cn(
                  dragCode === field.fieldCode && "opacity-40",
                  dropCode === field.fieldCode && dragCode !== null && dragCode !== field.fieldCode && "[&>td]:border-t-2 [&>td]:border-t-brand",
                ),
              })
            : undefined
        }
      />
    </div>
  );
}
