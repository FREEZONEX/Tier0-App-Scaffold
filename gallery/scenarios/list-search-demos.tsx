import { useState } from 'react';
import { DataGrid } from '@/components/kit/ui/data-grid';
import { StatusTag } from '@/components/kit/ui/tag';
import { EmptyState } from '@/components/ui/empty-state';
import { KeywordSearch } from '@/components/kit/meta/keyword-search';
import { AdvancedFilter } from '@/components/kit/meta/advanced-filter';
import { filterListRows, type KeywordField } from '@/lib/component-kit/list-search';
import type { SearchValues } from '@/lib/component-kit/query-model';
import type { FieldDef } from '@/lib/component-kit/types';

/** Gallery fixture: materials (物料编码 / 名称 / 规格 / 状态 / 入库日期). */
type Material = { code: string; name: string; spec: string; status: 'active' | 'pending' | 'frozen'; date: string };
const materials: Material[] = [
  { code: 'MAT-1001', name: '六角螺栓', spec: 'M8×30 · 8.8 级', status: 'active', date: '2026-10-28' },
  { code: 'MAT-1002', name: '六角螺栓', spec: 'M6×20 · 8.8 级', status: 'pending', date: '2026-11-03' },
  { code: 'MAT-2101', name: '安全光栅', spec: 'SG-40 / 40mm', status: 'active', date: '2026-11-01' },
  { code: 'MAT-3302', name: '抽样袋', spec: '200×300mm', status: 'frozen', date: '2026-10-15' },
  { code: 'MAT-4110', name: '扭矩扳手', spec: 'M8 · 5–25 N·m', status: 'pending', date: '2026-11-05' },
];
const statusOptions = [
  { value: 'active', label: '启用' },
  { value: 'pending', label: '待审核' },
  { value: 'frozen', label: '冻结' },
];
const statusTone = { active: 'success', pending: 'warning', frozen: 'default' } as const;

/** 关键词搜索 scope for this list: 物料编码、名称、规格. */
const keywordFields: KeywordField<Material>[] = [
  { key: 'code', label: '物料编码' },
  { key: 'name', label: '名称' },
  { key: 'spec', label: '规格' },
];
/** 高级筛选 conditions: one control per field. */
const conditions: FieldDef[] = [
  { code: 'code', name: '物料编码', type: 'TEXT', widget: {} },
  { code: 'name', name: '名称', type: 'TEXT', widget: {} },
  { code: 'status', name: '状态', type: 'SINGLE_SELECT', widget: {}, options: statusOptions },
  { code: 'date', name: '入库日期', type: 'DATETIME', widget: {} },
];

function MaterialTable({ rows }: { rows: Material[] }) {
  if (!rows.length) return <EmptyState title="没有匹配的物料" description="调整关键词或筛选条件后重试" />;
  return (
    <DataGrid
      rows={rows}
      rowKey={(row) => row.code}
      columns={[
        { key: 'code', title: '物料编码', width: 110 },
        { key: 'name', title: '名称', width: 140 },
        { key: 'spec', title: '规格', width: 190 },
        {
          key: 'status',
          title: '状态',
          width: 96,
          render: (row) => (
            <StatusTag tone={statusTone[row.status]} dot>
              {statusOptions.find((o) => o.value === row.status)?.label}
            </StatusTag>
          ),
        },
        { key: 'date', title: '入库日期', width: 110 },
      ]}
    />
  );
}

/** 关键词搜索（多字段模糊搜索）: one box over 物料编码、名称、规格. */
export function KeywordSearchDemo() {
  const [keyword, setKeyword] = useState('');
  const rows = filterListRows(materials, { keyword, keywordFields });
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <KeywordSearch value={keyword} onChange={setKeyword} fields={keywordFields} label="关键词搜索物料" className="w-full sm:w-80" />
      <p role="status" className="caption tabular-nums">
        {keyword.trim() ? `找到 ${rows.length} / ${materials.length} 种物料 · 物料编码、名称或规格任一包含「${keyword.trim()}」` : `共 ${materials.length} 种物料 · 试试输入 mat-1、螺栓 或 M8`}
      </p>
      <MaterialTable rows={rows} />
    </div>
  );
}

/** 高级筛选（多条件组合筛选）: 物料编码 / 名称 / 状态 / 入库日期, filled ones AND-ed. */
export function AdvancedFilterDemo() {
  const [values, setValues] = useState<SearchValues>({});
  const rows = filterListRows(materials, { conditions, values });
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <AdvancedFilter conditions={conditions} value={values} onChange={setValues} />
      <p role="status" className="caption tabular-nums">
        找到 {rows.length} / {materials.length} 种物料 · 已填写的条件需同时满足
      </p>
      <MaterialTable rows={rows} />
    </div>
  );
}
