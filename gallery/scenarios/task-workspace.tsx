import { useState, type CSSProperties } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Columns3,
  History,
  List,
  ListTodo,
  Loader,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { WorkbenchLayout } from '@/components/ui/workbench-layout';
import { StatusFilter, ViewToggle } from '@/components/ui/toolbar-controls';
import { Input } from '@/components/kit/ui/input';
import { DatePicker } from '@/components/kit/ui/date-picker';
import { Select } from '@/components/kit/ui/select';
import { StatusTag } from '@/components/kit/ui/tag';
import { DataGrid } from '@/components/kit/ui/data-grid';
import { ProgressBar } from '@/components/kit/ui/feedback';
import { Avatar } from '@/components/kit/ui/avatar';
import { IconButton } from '@/components/kit/ui/buttons';
import { Drawer } from '@/components/overlays/drawer';
import { ConfirmDialog } from '@/components/overlays/confirm-dialog';
import { FieldGroup } from '@/components/forms/form-layout';
import { KeywordSearch } from '@/components/kit/meta/keyword-search';
import { ActiveConditionTags, AdvancedFilter } from '@/components/kit/meta/advanced-filter';
import { DetailTable } from '@/components/kit/meta/detail-table';
import { filterListRows, type KeywordField } from '@/lib/component-kit/list-search';
import { countActiveConditions, type SearchValues } from '@/lib/component-kit/query-model';
import { formatNumber, shanghaiToday } from '@/lib/component-kit/format';
import type { FormValues } from '@/lib/component-kit/form-model';
import type { FieldDef } from '@/lib/component-kit/types';
import { STAGGER_ITEM } from '@/lib/interaction';
import { cn } from '@/lib/utils';

type Status = 'todo' | 'running' | 'done' | 'closed';
/** 领料明细: one material line of a task (the task works as a 业务单据). */
type Line = { id: string; code: string; name: string; spec: string; qty: number | null; price: number | null; amount: number };
type Task = { id: string; name: string; owner: string; status: Status; priority: string; due: string; lines: Line[] };
type Activity = { id: string; text: string; at: number };

const stages: { value: Status; label: string }[] = [
  { value: 'todo', label: '待处理' },
  { value: 'running', label: '执行中' },
  { value: 'done', label: '已完成' },
  { value: 'closed', label: '已关闭' },
];
const stageLabel = (s: Status) => stages.find((x) => x.value === s)?.label ?? s;
const stageIcon: Record<Status, typeof Loader> = {
  todo: CircleDashed,
  running: Loader,
  done: CheckCircle2,
  closed: X,
};
const stageTone = { todo: 'default', running: 'processing', done: 'success', closed: 'default' } as const;
const priorityDot: Record<string, string> = {
  高: 'bg-[color:var(--tier0-error-color)]',
  中: 'bg-[color:var(--tier0-warning-color)]',
  低: 'bg-muted-foreground/50',
};

const OWNERS = ['张明', '王珊', '李晨'];
const PRIORITIES = ['高', '中', '低'];

const toNumber = (value: unknown) => {
  const n = typeof value === 'number' ? value : value === '' || value == null ? NaN : Number(value);
  return Number.isFinite(n) ? n : null;
};
/** 金额 = 数量 × 单价, kept to cents so the 合计 never shows float noise. */
const lineAmount = (row: FormValues) => Math.round((toNumber(row.qty) ?? 0) * (toNumber(row.price) ?? 0) * 100) / 100;
const line = (id: string, code: string, name: string, spec: string, qty: number, price: number): Line => ({
  id, code, name, spec, qty, price, amount: lineAmount({ qty, price }),
});
const totalOf = (lines: readonly FormValues[], code: 'qty' | 'amount') =>
  Math.round(lines.reduce((sum, row) => sum + (toNumber(row[code]) ?? 0), 0) * 100) / 100;
const money = (value: number) => `¥${formatNumber(value, { decimalPlaces: 2, fixed: true, thousandSeparator: true })}`;

const seed: Task[] = [
  {
    id: 'TASK-1001', name: '装配线 A 安全联锁复核', owner: '张明', status: 'running', priority: '高', due: '2026-11-06',
    lines: [line('l-1001-1', 'MAT-2101', '安全光栅', 'SG-40 / 40mm', 2, 1280), line('l-1001-2', 'MAT-2207', '急停按钮', 'Φ22 红色', 4, 36.5)],
  },
  {
    id: 'TASK-1002', name: '来料批次质量抽检', owner: '王珊', status: 'todo', priority: '高', due: '2026-11-08',
    lines: [line('l-1002-1', 'MAT-3302', '抽样袋', '200×300mm', 50, 0.8)],
  },
  { id: 'TASK-1003', name: '更新设备点检记录', owner: '李晨', status: 'done', priority: '中', due: '2026-11-02', lines: [] },
  {
    id: 'TASK-1004', name: '校准扭矩传感器', owner: '张明', status: 'todo', priority: '中', due: '2026-11-15',
    lines: [line('l-1004-1', 'MAT-4105', '标准砝码', 'M1 级 5kg', 1, 420), line('l-1004-2', 'MAT-4110', '扭矩扳手', 'M8 · 5–25 N·m', 2, 268)],
  },
  { id: 'TASK-1005', name: '复核工位操作标准', owner: '李晨', status: 'running', priority: '低', due: '2026-11-21', lines: [] },
];

/** 关键词搜索 scope: one box, matched against all of these (any field may match). */
const keywordFields: KeywordField<Task>[] = [
  { key: 'id', label: '编号' },
  { key: 'name', label: '名称' },
  { key: 'owner', label: '负责人' },
  { key: 'lines', label: '物料规格', value: (t) => t.lines.map((l) => `${l.code} ${l.name} ${l.spec}`) },
];
/** 高级筛选 conditions: one control per field, filled ones combine with AND. */
const filterConditions: FieldDef[] = [
  { code: 'id', name: '编号', type: 'TEXT', widget: {} },
  { code: 'name', name: '任务名称', type: 'TEXT', widget: {} },
  { code: 'owner', name: '负责人', type: 'SINGLE_SELECT', widget: {}, options: OWNERS.map((v) => ({ value: v, label: v })) },
  { code: 'priority', name: '优先级', type: 'SINGLE_SELECT', widget: {}, options: PRIORITIES.map((v) => ({ value: v, label: v })) },
  { code: 'due', name: '计划日期', type: 'DATETIME', widget: {} },
];
/** 领料明细 columns (可编辑明细表). 金额 is derived from 数量 × 单价. */
const lineItems: FieldDef[] = [
  { code: 'code', name: '物料编码', type: 'TEXT', widget: { required: true }, width: 112 },
  { code: 'name', name: '物料名称', type: 'TEXT', widget: { required: true }, width: 120 },
  { code: 'spec', name: '规格', type: 'TEXT', widget: {}, width: 128 },
  { code: 'qty', name: '数量', type: 'NUMBER', widget: { minValue: 0, decimalPlaces: 2 }, width: 88 },
  { code: 'price', name: '单价', type: 'NUMBER', widget: { minValue: 0, decimalPlaces: 2 }, width: 96 },
  { code: 'amount', name: '金额', type: 'NUMBER', widget: { readonly: true, decimalPlaces: 2, thousandSeparator: true }, width: 112 },
];
/** Fit the whole 明细 (incl. 金额 and its 合计) in the drawer on desktop; narrower screens scroll. */
const lineColumnWidths = Object.fromEntries(lineItems.map((f) => [f.code, f.width ?? 120]));
/** DetailTable rows → stored lines: keep a stable id, drop the editor's __key. */
function toLines(rows: readonly FormValues[]): Line[] {
  return rows.map((row) => ({
    id: String(row.id ?? row.__key ?? crypto.randomUUID()),
    code: String(row.code ?? '').trim(),
    name: String(row.name ?? '').trim(),
    spec: String(row.spec ?? '').trim(),
    qty: toNumber(row.qty),
    price: toNumber(row.price),
    amount: lineAmount(row),
  }));
}
const seedActivity: Activity[] = [
  { id: 'a1', text: '李晨 完成「更新设备点检记录」', at: Date.now() - 18 * 60e3 },
  { id: 'a2', text: '张明 开始「装配线 A 安全联锁复核」', at: Date.now() - 52 * 60e3 },
];

const storageKey = 'tier0-gallery-tasks-v3';
function load(): { tasks: Task[]; activity: Activity[] } {
  try {
    const x = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (x && Array.isArray(x.tasks) && Array.isArray(x.activity)) return x;
  } catch {
    /* fall back to seed */
  }
  return { tasks: seed, activity: seedActivity };
}

/** Clock + id helpers: called from event handlers only. */
const now = () => Date.now();
const newTaskId = () => `TASK-${now().toString().slice(-6)}`;

function ago(at: number) {
  const m = Math.max(0, Math.round((Date.now() - at) / 60e3));
  return m < 1 ? '刚刚' : m < 60 ? `${m} 分钟前` : `${Math.round(m / 60)} 小时前`;
}

/** Tempo's board/list/sheet workflow on WorkbenchLayout, built from Tier0 primitives only. Local gallery fixture. */
export function TaskWorkspace() {
  const [state, setState] = useState(load);
  const { tasks, activity } = state;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string>('active');
  const [view, setView] = useState<string | number>('board');
  const [selected, setSelected] = useState<string[]>([]);
  const [draft, setDraft] = useState<Task | null>(null);
  const [draftLines, setDraftLines] = useState<FormValues[]>([]);
  const [lineError, setLineError] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [applied, setApplied] = useState<SearchValues>({});
  const [closing, setClosing] = useState<Task[] | null>(null);
  const [error, setError] = useState('');

  function persist(nextTasks: Task[], log: string) {
    const next = {
      tasks: nextTasks,
      activity: [{ id: crypto.randomUUID(), text: log, at: now() }, ...activity].slice(0, 8),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setState(next);
      return true;
    } catch (e) {
      console.error(e);
      toast.error('无法保存，请检查浏览器存储空间');
      return false;
    }
  }

  function edit(t: Task) {
    setError('');
    setLineError('');
    setDraft({ ...t });
    setDraftLines(t.lines.map((l) => ({ ...l })));
  }
  function save() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setError('请输入任务名称');
    if (name.length > 80) return setError('任务名称不能超过 80 个字');
    const lines = toLines(draftLines);
    const incomplete = lines.findIndex((l) => !l.code || !l.name);
    if (incomplete >= 0) return setLineError(`第 ${incomplete + 1} 行明细请填写物料编码和物料名称`);
    setLineError('');
    const task = { ...draft, name, lines, id: draft.id || newTaskId() };
    const ok = persist(
      draft.id ? tasks.map((t) => (t.id === task.id ? task : t)) : [task, ...tasks],
      `${task.owner} ${draft.id ? '更新' : '创建'}「${task.name}」`,
    );
    if (ok) {
      setDraft(null);
      toast.success(draft.id ? '任务已更新' : '任务已创建');
    }
  }
  function advance(t: Task) {
    const next: Status = t.status === 'todo' ? 'running' : t.status === 'running' ? 'done' : 'todo';
    const verb = next === 'running' ? '开始' : next === 'done' ? '完成' : '重新打开';
    if (persist(tasks.map((x) => (x.id === t.id ? { ...x, status: next } : x)), `${t.owner} ${verb}「${t.name}」`))
      toast.success(`已${verb}「${t.name}」`);
  }
  function confirmClose() {
    if (!closing) return;
    const ids = new Set(closing.map((t) => t.id));
    const label = closing.length === 1 ? `「${closing[0].name}」` : `${closing.length} 项任务`;
    if (persist(tasks.map((t) => (ids.has(t.id) ? { ...t, status: 'closed' } : t)), `关闭${label}`)) {
      setClosing(null);
      setSelected([]);
      toast.success(`已关闭${label}`);
    }
  }

  const count = (s: Status) => tasks.filter((t) => t.status === s).length;
  const live = tasks.filter((t) => t.status !== 'closed');
  const donePct = live.length ? Math.round((count('done') / live.length) * 100) : 0;
  const inStatus = tasks.filter((t) => (status === 'active' ? t.status !== 'closed' : t.status === status));
  // 关键词搜索 AND 高级筛选: a task must match the keyword and every filled condition.
  const filtered = filterListRows(inStatus, { keyword: query, keywordFields, conditions: filterConditions, values: applied });
  const activeConditions = countActiveConditions(filterConditions, applied);
  const searching = Boolean(query.trim()) || activeConditions > 0;
  const draftQty = totalOf(draftLines, 'qty');
  const draftAmount = totalOf(draftLines, 'amount');
  const attention = tasks.filter((t) => t.priority === '高' && (t.status === 'todo' || t.status === 'running'));
  const selectedTasks = tasks.filter((t) => selected.includes(t.id) && t.status !== 'closed');

  function actions(t: Task) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {t.status !== 'closed' && (
          <Button size="sm" variant="outline" onClick={() => advance(t)}>
            {t.status === 'todo' ? '开始' : t.status === 'running' ? '完成' : '重新打开'}
            <ArrowRight size={12} />
          </Button>
        )}
        {t.status === 'closed' && (
          <Button size="sm" variant="outline" onClick={() => advance(t)}>
            重新打开
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => edit(t)}>
          编辑
        </Button>
        {t.status !== 'closed' && (
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setClosing([t])}>
            关闭
          </Button>
        )}
      </div>
    );
  }

  const board = (
    <div className="grid items-start gap-3 md:grid-cols-3">
      {stages
        .filter((s) => (status === 'active' ? s.value !== 'closed' : s.value === status))
        .map((s) => {
          const items = filtered.filter((t) => t.status === s.value);
          const Icon = stageIcon[s.value];
          return (
            <section key={s.value} className="min-w-0 rounded-[4px] bg-fill-hover p-2">
              <header className="flex items-center gap-2 px-1.5 pb-2 pt-1 text-[13px] font-medium">
                <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                {s.label}
                <span className="ml-auto rounded-full bg-background px-1.5 text-xs tabular-nums text-muted-foreground ring-1 ring-border">
                  {items.length}
                </span>
              </header>
              <div className="flex flex-col gap-2">
                {items.map((t, i) => (
                  <article
                    key={t.id}
                    style={{ '--i': i } as CSSProperties}
                    className={cn(
                      'group flex flex-col gap-2.5 rounded-[4px] bg-card p-3 shadow-[0_1px_2px_rgb(16_24_40/0.06)]',
                      'transition-[box-shadow,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease)]',
                      'hover:-translate-y-px hover:shadow-card',
                      STAGGER_ITEM,
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('size-1.5 rounded-full', priorityDot[t.priority])} aria-hidden />
                      <code className="caption">{t.id}</code>
                      <span className="caption ml-auto">{t.priority}优先级</span>
                    </div>
                    <button
                      type="button"
                      className="text-left text-sm font-medium leading-5 text-foreground underline-offset-4 hover:underline"
                      onClick={() => edit(t)}
                    >
                      {t.name}
                    </button>
                    <p className="caption tabular-nums">
                      计划 {t.due || '未排期'}
                      {t.lines.length ? ` · 领料 ${t.lines.length} 项 · ${money(totalOf(t.lines, 'amount'))}` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <Avatar name={t.owner} size="sm" />
                        <span className="truncate">{t.owner}</span>
                      </span>
                      <span className="ml-auto flex items-center gap-0.5">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => advance(t)}>
                          {t.status === 'todo' ? '开始' : t.status === 'running' ? '完成' : '重新打开'}
                          <ArrowRight size={12} />
                        </Button>
                        <IconButton
                          size="sm"
                          icon={<X />}
                          label="关闭任务"
                          className="sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          onClick={() => setClosing([t])}
                        />
                      </span>
                    </div>
                  </article>
                ))}
                {!items.length && (
                  <p className="caption py-6 text-center">暂无任务</p>
                )}
              </div>
            </section>
          );
        })}
    </div>
  );

  const list = (
    <DataGrid
      rows={filtered}
      rowKey={(t) => t.id}
      selection={{ mode: 'multiple', selectedKeys: selected, onChange: (keys) => setSelected(keys.map(String)) }}
      columns={[
        { key: 'id', title: '编号', width: 120 },
        {
          key: 'name',
          title: '任务',
          width: 260,
          render: (t) => (
            <span className="flex items-center gap-2">
              <span className={cn('size-1.5 shrink-0 rounded-full', priorityDot[t.priority])} aria-hidden />
              {t.name}
            </span>
          ),
        },
        {
          key: 'owner',
          title: '负责人',
          width: 110,
          render: (t) => (
            <span className="flex items-center gap-1.5">
              <Avatar name={t.owner} size="sm" />
              {t.owner}
            </span>
          ),
        },
        { key: 'priority', title: '优先级', width: 80 },
        { key: 'due', title: '计划日期', width: 120, render: (t) => <span className="tabular-nums">{t.due || '—'}</span> },
        {
          key: 'amount',
          title: '领料金额',
          width: 120,
          align: 'right',
          render: (t) => <span className="tabular-nums">{t.lines.length ? money(totalOf(t.lines, 'amount')) : '—'}</span>,
        },
        { key: 'status', title: '状态', width: 100, render: (t) => <StatusTag tone={stageTone[t.status]} dot>{stageLabel(t.status)}</StatusTag> },
        { key: 'actions', title: '操作', width: 240, ellipsis: false, render: actions },
      ]}
    />
  );

  return (
    <WorkbenchLayout
      metricsVariant="strip"
      header={
        <PageHeader
          title="任务工作台"
          actions={
            <Button icon={<Plus size={16} />} onClick={() => edit({ id: '', name: '', owner: '张明', status: 'todo', priority: '中', due: shanghaiToday(), lines: [] })}>
              新建任务
            </Button>
          }
        />
      }
      metrics={
        <>
          <StatCard label="进行中任务" value={live.length} unit="项" icon={<ListTodo />} />
          <StatCard label="待处理" value={count('todo')} unit="项" icon={<CircleDashed />} tone="info" />
          <StatCard label="执行中" value={count('running')} unit="项" icon={<Loader />} tone="running" />
          <StatCard
            label="完成率"
            value={donePct}
            unit="%"
            icon={<CheckCircle2 />}
            tone="running"
            footer={<ProgressBar percent={donePct} size="sm" showInfo={false} className="w-24" />}
          />
        </>
      }
      aside={
        <>
          <Card
            title={
              <span className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-[color:var(--tier0-warning-color)]" />
                需要关注
              </span>
            }
            flush
          >
            {attention.length ? (
              <ul className="divide-y divide-border">
                {attention.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.name}</p>
                      <p className="caption">
                        高优先级 · {stageLabel(t.status)} · {t.owner}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => advance(t)}>
                      {t.status === 'todo' ? '开始' : '完成'}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="caption px-4 py-6 text-center">高优先级任务均已处理</p>
            )}
          </Card>
          <Card
            title={
              <span className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                最近动态
              </span>
            }
          >
            <ol className="relative space-y-4 before:absolute before:inset-y-1 before:left-[5px] before:w-px before:bg-border">
              {activity.map((a, i) => (
                <li key={a.id} style={{ '--i': i } as CSSProperties} className={cn('relative pl-5', STAGGER_ITEM)}>
                  <span className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-card bg-muted-foreground/40" aria-hidden />
                  <p className="text-sm leading-5">{a.text}</p>
                  <p className="caption">{ago(a.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </>
      }
    >
      <Card
        flush
        title={<><ListTodo />任务</>}
        actions={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusFilter
              label="任务状态"
              value={status}
              onChange={(v) => {
                setStatus(v);
                setSelected([]);
              }}
              items={[
                { key: 'active', label: '进行中', count: live.length },
                ...stages.map((s) => ({ key: s.value as string, label: s.label, count: count(s.value) })),
              ]}
            />
            <KeywordSearch
              label="关键词搜索任务"
              value={query}
              onChange={setQuery}
              fields={keywordFields}
              className="w-full sm:w-72"
            />
            <Button
              variant={filterOpen ? 'secondary' : 'outline'}
              icon={<SlidersHorizontal size={14} />}
              aria-expanded={filterOpen}
              aria-controls="task-advanced-filter"
              onClick={() => setFilterOpen((open) => !open)}
            >
              高级筛选
              {activeConditions > 0 && <span className="tabular-nums text-muted-foreground">{activeConditions}</span>}
            </Button>
            <ViewToggle
              label="任务视图"
              value={String(view)}
              onChange={(v) => {
                setView(v);
                setSelected([]);
              }}
              items={[
                { value: 'board', label: '看板', icon: <Columns3 /> },
                { value: 'list', label: '列表', icon: <List /> },
              ]}
            />
          </div>
        }
      >
        {filterOpen ? (
          <div id="task-advanced-filter" className="border-b border-border px-4 py-3">
            <AdvancedFilter conditions={filterConditions} value={applied} onChange={setApplied} />
          </div>
        ) : activeConditions > 0 ? (
          <div className="border-b border-border px-4 py-2">
            <ActiveConditionTags conditions={filterConditions} value={applied} onChange={setApplied} />
          </div>
        ) : null}
        {searching && (
          <p role="status" className="caption px-4 pt-3 tabular-nums">
            找到 {filtered.length} 项任务
            {query.trim() && activeConditions > 0 ? '（同时满足关键词与筛选条件）' : ''}
          </p>
        )}
        {view === 'list' && selectedTasks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 px-4 py-2 text-sm animate-[tier0-rise_200ms_var(--motion-spring)]">
            <span className="font-medium tabular-nums">已选 {selectedTasks.length} 项</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => setClosing(selectedTasks)}>
              批量关闭
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              取消选择
            </Button>
          </div>
        )}
        <div className={cn(view === 'board' && 'p-3')}>
          {!filtered.length ? (
            <EmptyState
              title={searching ? '没有匹配的任务' : '这里还没有任务'}
              description={searching ? '调整关键词或筛选条件后重试' : undefined}
              action={
                searching || status !== 'active' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery('');
                      setApplied({});
                      setStatus('active');
                    }}
                  >
                    清除筛选
                  </Button>
                ) : undefined
              }
            />
          ) : view === 'list' ? (
            list
          ) : (
            board
          )}
        </div>
      </Card>

      <Drawer
        open={!!draft}
        onOpenChange={(v) => {
          if (!v) setDraft(null);
        }}
        title={draft?.id ? '编辑任务' : '新建任务'}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setDraft(null)}>
              取消
            </Button>
            <Button type="submit" form="task-form">
              保存任务
            </Button>
          </>
        }
      >
        {draft && (
          <form
            id="task-form"
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <FieldGroup label="任务名称" htmlFor="task-name" required>
              <Input
                id="task-name"
                value={draft.name}
                onChange={(name) => setDraft({ ...draft, name })}
                required
                status={error ? 'error' : undefined}
                aria-invalid={!!error}
                aria-describedby={error ? 'task-error' : undefined}
              />
              {error && (
                <p id="task-error" role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </FieldGroup>
            <FieldGroup label="负责人">
              <Select
                aria-label="负责人"
                value={draft.owner}
                onChange={(owner) => setDraft({ ...draft, owner: String(owner) })}
                options={['张明', '王珊', '李晨'].map((v) => ({ value: v, label: v }))}
              />
            </FieldGroup>
            <FieldGroup label="优先级">
              <Select
                aria-label="优先级"
                value={draft.priority}
                onChange={(priority) => setDraft({ ...draft, priority: String(priority) })}
                options={['高', '中', '低'].map((v) => ({ value: v, label: v }))}
              />
            </FieldGroup>
            <FieldGroup label="状态">
              <Select
                aria-label="状态"
                value={draft.status}
                onChange={(s) => setDraft({ ...draft, status: s as Status })}
                options={stages}
              />
            </FieldGroup>
            <FieldGroup label="计划日期" htmlFor="task-due">
              <DatePicker
                id="task-due"
                aria-label="计划日期"
                precision="DATE"
                valueFormat="date"
                value={draft.due || null}
                onChange={(due) => setDraft({ ...draft, due: due ?? '' })}
              />
            </FieldGroup>
            <section className="flex min-w-0 flex-col gap-2" aria-labelledby="task-lines-title">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 id="task-lines-title" className="text-sm font-medium">
                  领料明细
                </h3>
                <p role="status" aria-live="polite" className="caption tabular-nums">
                  共 {draftLines.length} 行 · 数量合计 {formatNumber(draftQty, { decimalPlaces: 2 })} · 金额合计 {money(draftAmount)}
                </p>
              </div>
              <DetailTable
                aria-label="领料明细"
                items={lineItems}
                rows={draftLines}
                onChange={(rows) => {
                  setDraftLines(rows);
                  setLineError('');
                }}
                onRowChange={(row) => ({ ...row, amount: lineAmount(row) })}
                createRow={() => ({ code: '', name: '', spec: '', qty: 1, price: null, amount: 0 })}
                addLabel="增加明细"
                summaryFields={['qty', 'amount']}
                columnWidths={lineColumnWidths}
                fillableFields={[]}
                columnSettings={false}
                maxHeight={320}
              />
              {lineError && (
                <p role="alert" className="text-sm text-destructive">
                  {lineError}
                </p>
              )}
            </section>
          </form>
        )}
      </Drawer>
      <ConfirmDialog
        open={!!closing}
        onOpenChange={(v) => {
          if (!v) setClosing(null);
        }}
        title={closing && closing.length > 1 ? `关闭 ${closing.length} 项任务` : '关闭任务'}
        description={
          closing && closing.length > 1
            ? `选中的 ${closing.length} 项任务将移出活动看板，可在「已关闭」中重新打开。`
            : `关闭「${closing?.[0]?.name ?? ''}」后将移出活动看板，可在「已关闭」中重新打开。`
        }
        confirmLabel="关闭任务"
        destructive
        onConfirm={confirmClose}
      />
    </WorkbenchLayout>
  );
}
