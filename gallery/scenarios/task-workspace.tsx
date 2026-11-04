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
  Search,
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
import { Select } from '@/components/kit/ui/select';
import { StatusTag } from '@/components/kit/ui/tag';
import { DataGrid } from '@/components/kit/ui/data-grid';
import { ProgressBar } from '@/components/kit/ui/feedback';
import { Avatar } from '@/components/kit/ui/avatar';
import { IconButton } from '@/components/kit/ui/buttons';
import { Drawer } from '@/components/overlays/drawer';
import { ConfirmDialog } from '@/components/overlays/confirm-dialog';
import { FieldGroup } from '@/components/forms/form-layout';
import { STAGGER_ITEM } from '@/lib/interaction';
import { cn } from '@/lib/utils';

type Status = 'todo' | 'running' | 'done' | 'closed';
type Task = { id: string; name: string; owner: string; status: Status; priority: string };
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

const seed: Task[] = [
  { id: 'TASK-1001', name: '装配线 A 安全联锁复核', owner: '张明', status: 'running', priority: '高' },
  { id: 'TASK-1002', name: '来料批次质量抽检', owner: '王珊', status: 'todo', priority: '高' },
  { id: 'TASK-1003', name: '更新设备点检记录', owner: '李晨', status: 'done', priority: '中' },
  { id: 'TASK-1004', name: '校准扭矩传感器', owner: '张明', status: 'todo', priority: '中' },
  { id: 'TASK-1005', name: '复核工位操作标准', owner: '李晨', status: 'running', priority: '低' },
];
const seedActivity: Activity[] = [
  { id: 'a1', text: '李晨 完成「更新设备点检记录」', at: Date.now() - 18 * 60e3 },
  { id: 'a2', text: '张明 开始「装配线 A 安全联锁复核」', at: Date.now() - 52 * 60e3 },
];

const storageKey = 'tier0-gallery-tasks-v2';
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
    setDraft({ ...t });
  }
  function save() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return setError('请输入任务名称');
    if (name.length > 80) return setError('任务名称不能超过 80 个字');
    const task = { ...draft, name, id: draft.id || newTaskId() };
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
  const filtered = tasks.filter(
    (t) =>
      (status === 'active' ? t.status !== 'closed' : t.status === status) &&
      `${t.name} ${t.id} ${t.owner}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
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
            <Button icon={<Plus size={16} />} onClick={() => edit({ id: '', name: '', owner: '张明', status: 'todo', priority: '中' })}>
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
            <Input
              aria-label="搜索任务"
              value={query}
              onChange={setQuery}
              prefix={<Search size={14} />}
              placeholder="搜索名称、编号、负责人"
              allowClear
              wrapperClassName="w-full max-w-xs sm:w-56"
            />
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
              title={query ? '没有匹配的任务' : '这里还没有任务'}
              action={
                query || status !== 'active' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery('');
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
