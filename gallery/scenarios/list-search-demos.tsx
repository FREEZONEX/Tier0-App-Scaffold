import { useState } from 'react';
import { DataGrid } from '@/components/kit/ui/data-grid';
import { StatusTag } from '@/components/kit/ui/tag';
import { EmptyState } from '@/components/ui/empty-state';
import { KeywordSearch } from '@/components/kit/meta/keyword-search';
import { AdvancedFilter } from '@/components/kit/meta/advanced-filter';
import { filterListRows, type KeywordField } from '@/lib/component-kit/list-search';
import type { SearchValues } from '@/lib/component-kit/query-model';
import type { FieldDef } from '@/lib/component-kit/types';

/** Gallery fixture: production queues (编码 / 名称 / 规格 / 状态 / 计划日期). */
type Queue = { code: string; name: string; spec: string; status: 'run' | 'wait' | 'done'; due: string };
const queues: Queue[] = [
  { code: 'Q-ASM-01', name: '总装一线队列', spec: 'M8 螺栓 · 扭矩 25 N·m', status: 'run', due: '2026-11-04' },
  { code: 'Q-ASM-02', name: '总装二线队列', spec: 'M6 螺栓 · 扭矩 12 N·m', status: 'wait', due: '2026-11-12' },
  { code: 'Q-QC-01', name: '来料质检队列', spec: 'AQL 1.0 · 抽样 50', status: 'run', due: '2026-11-08' },
  { code: 'Q-PKG-01', name: '包装队列', spec: '纸箱 600×400', status: 'done', due: '2026-10-30' },
  { code: 'Q-CAL-01', name: '量具校准队列', spec: '扭矩扳手 · M1 级', status: 'wait', due: '2026-11-20' },
];
const statusOptions = [
  { value: 'run', label: '执行中' },
  { value: 'wait', label: '待处理' },
  { value: 'done', label: '已完成' },
];
const statusTone = { run: 'processing', wait: 'default', done: 'success' } as const;

/** 关键词搜索 scope for this list: 编码、名称、规格. */
const keywordFields: KeywordField<Queue>[] = [
  { key: 'code', label: '编码' },
  { key: 'name', label: '名称' },
  { key: 'spec', label: '规格' },
];
/** 高级筛选 conditions: one control per field. */
const conditions: FieldDef[] = [
  { code: 'code', name: '编码', type: 'TEXT', widget: {} },
  { code: 'name', name: '名称', type: 'TEXT', widget: {} },
  { code: 'status', name: '状态', type: 'SINGLE_SELECT', widget: {}, options: statusOptions },
  { code: 'due', name: '计划日期', type: 'DATETIME', widget: {} },
];

function QueueTable({ rows }: { rows: Queue[] }) {
  if (!rows.length) return <EmptyState title="没有匹配的队列" description="调整关键词或筛选条件后重试" />;
  return (
    <DataGrid
      rows={rows}
      rowKey={(row) => row.code}
      columns={[
        { key: 'code', title: '编码', width: 110 },
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
        { key: 'due', title: '计划日期', width: 110 },
      ]}
    />
  );
}

/** 关键词搜索（多字段模糊搜索）: one box over 编码、名称、规格. */
export function KeywordSearchDemo() {
  const [keyword, setKeyword] = useState('');
  const rows = filterListRows(queues, { keyword, keywordFields });
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <KeywordSearch value={keyword} onChange={setKeyword} fields={keywordFields} label="关键词搜索队列" className="w-full sm:w-80" />
      <p role="status" className="caption tabular-nums">
        {keyword.trim() ? `找到 ${rows.length} / ${queues.length} 个队列 · 编码、名称或规格任一包含「${keyword.trim()}」` : `共 ${queues.length} 个队列 · 试试输入 asm、质检 或 扭矩`}
      </p>
      <QueueTable rows={rows} />
    </div>
  );
}

/** 高级筛选（多条件组合筛选）: 编码 / 名称 / 状态 / 计划日期, filled ones AND-ed. */
export function AdvancedFilterDemo() {
  const [values, setValues] = useState<SearchValues>({});
  const rows = filterListRows(queues, { conditions, values });
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <AdvancedFilter conditions={conditions} value={values} onChange={setValues} />
      <p role="status" className="caption tabular-nums">
        找到 {rows.length} / {queues.length} 个队列 · 已填写的条件需同时满足
      </p>
      <QueueTable rows={rows} />
    </div>
  );
}
