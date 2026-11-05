"use client";
import { useLocalData, downloadCsv } from "./local-data";

import { useState, type CSSProperties } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  Coins,
  Download,
  Gauge,
  Play,
  Search,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextButton } from "@/components/kit/ui/buttons";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkbenchLayout } from "@/components/ui/workbench-layout";
import { StatusFilter } from "@/components/ui/toolbar-controls";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { Input } from "@/components/kit/ui/input";
import { NumberInput } from "@/components/kit/ui/number-input";
import { Select } from "@/components/kit/ui/select";
import { DataGrid } from "@/components/kit/ui/data-grid";
import { ProgressBar } from "@/components/kit/ui/feedback";
import { CollapseSection } from "@/components/kit/ui/collapse-section";
import { FormDialog } from "@/components/overlays/form-dialog";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { FieldGroup } from "@/components/forms/form-layout";
import { StackedUsageChart } from "@/components/charts/board-charts";
import { STAGGER_ITEM } from "@/lib/interaction";
import { cn } from "@/lib/utils";

/* Gallery fixtures only: clock/id helpers are called from event handlers. */
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const clock = (at: number) =>
  new Date(at).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

/* ------------------------------------------------------------------------ *
 * 工作流总览 — Flowly hub on ReUI frames.
 * ------------------------------------------------------------------------ */

type FlowState = "running" | "paused" | "error";
type Flow = {
  id: string;
  name: string;
  state: FlowState;
  runs: number;
  success: number;
  owner: string;
  lastError?: string;
};

const flowSeed: Flow[] = [
  {
    id: "wf-1",
    name: "来料检验 → MES 回写",
    state: "running",
    runs: 128,
    success: 99,
    owner: "计划组",
  },
  {
    id: "wf-2",
    name: "异常停机通知",
    state: "paused",
    runs: 42,
    success: 100,
    owner: "运维组",
  },
  {
    id: "wf-3",
    name: "班次产量汇总",
    state: "running",
    runs: 86,
    success: 97,
    owner: "数据组",
  },
  {
    id: "wf-4",
    name: "备件补货审批",
    state: "error",
    runs: 9,
    success: 67,
    owner: "采购组",
    lastError: "ERP 接口凭据过期",
  },
];
const flowLabel: Record<FlowState, string> = {
  running: "运行中",
  paused: "已暂停",
  error: "异常",
};

export function SceneWorkflowHub() {
  const [flows, setFlows] = useLocalData("gallery-flows-v1", flowSeed);
  const [creating,setCreating]=useState(false);
  const [name,setName]=useState("");
  const [nameError,setNameError]=useState("");
  const [filter, setFilter] = useState<string>("all");
  const [pausing, setPausing] = useState<Flow | null>(null);
  const [feed, setFeed] = useState<TimelineItem[]>([
    {
      id: "f1",
      title: "来料检验 → MES 回写 · 成功",
      meta: "09:12 · 耗时 4.2s",
      tone: "running",
    },
    {
      id: "f2",
      title: "备件补货审批 · 失败",
      meta: "09:08 · ERP 接口凭据过期",
      tone: "error",
    },
    {
      id: "f3",
      title: "班次产量汇总 · 成功",
      meta: "08:55 · 耗时 11.8s",
      tone: "running",
    },
  ]);
  const push = (title: string, meta: string, tone: TimelineItem["tone"]) =>
    setFeed((list) =>
      [
        { id: uid(), title, meta: `${clock(now())} · ${meta}`, tone },
        ...list,
      ].slice(0, 6),
    );

  function run(f: Flow) {
    setFlows((list) =>
      list.map((x) =>
        x.id === f.id
          ? { ...x, runs: x.runs + 1, state: "running", lastError: undefined }
          : x,
      ),
    );
    push(`${f.name} · 成功`, "手动触发", "running");
    toast.success(`已运行「${f.name}」`);
  }
  function setState(f: Flow, state: FlowState) {
    setFlows((list) => list.map((x) => (x.id === f.id ? { ...x, state } : x)));
    push(
      `${f.name} · ${state === "paused" ? "已暂停" : "已恢复"}`,
      "调度变更",
      state === "paused" ? "paused" : "info",
    );
    toast.success(
      `「${f.name}」${state === "paused" ? "已暂停，不再按计划触发" : "已恢复调度"}`,
    );
  }

  const visible = flows.filter((f) => filter === "all" || f.state === filter);
  const runs = flows.reduce((s, f) => s + f.runs, 0);
  const issues = flows.filter((f) => f.state === "error");

  return (
    <WorkbenchLayout
      metricsVariant="strip"
      header={
        <PageHeader
          title="工作流总览"
          actions={
            <>
              <Button
                icon={<Workflow size={16} />}
                onClick={() => {setName("");setNameError("");setCreating(true)}}
              >
                新建工作流
              </Button>
            </>
          }
        />
      }
      metrics={
        <>
          <StatCard
            label="工作流"
            value={flows.length}
            unit="个"
            icon={<Workflow />}
          />
          <StatCard
            label="24h 运行"
            value={runs}
            unit="次"
            icon={<Activity />}
            tone="running"
            trend={{ direction: "up", label: "+18", intent: "positive" }}
          />
          <StatCard
            label="运行中"
            value={flows.filter((f) => f.state === "running").length}
            unit="个"
            icon={<Play />}
            tone="running"
          />
          <StatCard
            label="需关注"
            value={issues.length}
            unit="项"
            icon={<AlertTriangle />}
            tone={issues.length ? "error" : "default"}
          />
        </>
      }
      aside={
        <>
          <Card
            title={
              <>
                <AlertTriangle />
                需要处理
              </>
            }
            flush
          >
            {issues.length ? (
              <ul className="divide-y divide-border">
                {issues.map((f) => (
                  <li key={f.id} className="space-y-2 px-4 py-3">
                    <p className="text-sm font-medium">{f.name}</p>
                    <p className="caption">
                      {f.lastError} · 成功率 {f.success}%
                    </p>
                    <Button size="sm" variant="outline" onClick={() => run(f)}>
                      修复后重试
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="caption px-4 py-6 text-center">
                所有工作流运行正常
              </p>
            )}
          </Card>
          <Card
            title={
              <>
                <Activity />
                运行动态
              </>
            }
          >
            <Timeline items={feed} />
          </Card>
        </>
      }
    >
      <Card
        flush
        actions={
          <StatusFilter
            value={filter}
            onChange={setFilter}
            items={[
              { key: "all", label: "全部", count: flows.length },
              {
                key: "running",
                label: "运行中",
                count: flows.filter((f) => f.state === "running").length,
              },
              {
                key: "paused",
                label: "已暂停",
                count: flows.filter((f) => f.state === "paused").length,
              },
              { key: "error", label: "异常", count: issues.length },
            ]}
          />
        }
        title={
          <>
            <Workflow />
            工作流
          </>
        }
      >
        <DataGrid
          rows={visible}
          rowKey={(f) => f.id}
          columns={[
            { key: "name", title: "工作流", width: 230 },
            {
              key: "state",
              title: "状态",
              width: 112,
              render: (f) => (
                <StatusBadge tone={f.state} pulse={f.state === "running"}>
                  {flowLabel[f.state]}
                </StatusBadge>
              ),
            },
            { key: "runs", title: "24h 运行", width: 90 },
            {
              key: "success",
              title: "成功率",
              width: 140,
              render: (f) => (
                <span className="flex items-center gap-2">
                  <ProgressBar
                    percent={f.success}
                    size="sm"
                    showInfo={false}
                    status={f.success < 90 ? "exception" : "success"}
                    className="w-16"
                  />
                  <span className="tabular-nums">{f.success}%</span>
                </span>
              ),
            },
            { key: "owner", title: "负责组", width: 90 },
            {
              key: "actions",
              title: "操作",
              width: 128,
              fixed: "right",
              ellipsis: false,
              render: (f) => (
                // Same row-action style as the task list: text buttons only.
                <span className="flex items-center gap-4 whitespace-nowrap">
                  <TextButton size="sm" onClick={() => run(f)}>
                    运行
                  </TextButton>
                  {f.state === "paused" ? (
                    <TextButton size="sm" onClick={() => setState(f, "running")}>
                      恢复
                    </TextButton>
                  ) : (
                    <TextButton size="sm" tone="warning" onClick={() => setPausing(f)}>
                      暂停
                    </TextButton>
                  )}
                </span>
              ),
            },
          ]}
        />
      </Card>
      <FormDialog open={creating} onOpenChange={setCreating} title="新建工作流" submitLabel="创建" onSubmit={e=>{e.preventDefault();if(!name.trim()){setNameError('请输入工作流名称');return;}setFlows(list=>[{id:uid(),name:name.trim(),owner:'计划组',state:'paused',runs:0,success:0},...list]);setCreating(false);toast.success('工作流已创建，可恢复调度');}}><FieldGroup label="工作流名称" required htmlFor="flow-name"><Input id="flow-name" value={name} onChange={setName} required aria-invalid={!!nameError} aria-describedby={nameError?"flow-name-error":undefined}/>{nameError&&<p id="flow-name-error" role="alert" className="text-sm text-destructive">{nameError}</p>}</FieldGroup></FormDialog>
      <ConfirmDialog
        open={!!pausing}
        onOpenChange={(v) => {
          if (!v) setPausing(null);
        }}
        title="暂停工作流"
        description={`暂停后「${pausing?.name ?? ""}」不再按计划触发，正在执行的一次会跑完。可随时恢复。`}
        confirmLabel="暂停"
        destructive
        onConfirm={() => {
          if (pausing) setState(pausing, "paused");
          setPausing(null);
        }}
      />
    </WorkbenchLayout>
  );
}

/* ------------------------------------------------------------------------ *
 * 审计日志 — Lucent audit trail. READ_ONLY_SURFACE: audit events are
 * immutable; the only action is exporting the filtered set.
 * ------------------------------------------------------------------------ */

type Severity = "info" | "warning" | "critical";
type AuditEvent = {
  id: string;
  day: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  severity: Severity;
  ref: string;
  ip: string;
};

const auditEvents: AuditEvent[] = [
  {
    id: "ev-1",
    day: "今天",
    time: "10:42",
    actor: "张明",
    action: "导出成员列表",
    target: "成员管理",
    severity: "info",
    ref: "AUD-20261103-001",
    ip: "10.2.4.18",
  },
  {
    id: "ev-2",
    day: "今天",
    time: "09:15",
    actor: "系统",
    action: "API 密钥轮换",
    target: "ERP 连接器",
    severity: "warning",
    ref: "AUD-20261103-002",
    ip: "—",
  },
  {
    id: "ev-3",
    day: "今天",
    time: "08:03",
    actor: "王珊",
    action: "批量冻结批次 3 个",
    target: "库存台账",
    severity: "critical",
    ref: "AUD-20261103-003",
    ip: "10.2.4.31",
  },
  {
    id: "ev-4",
    day: "昨天",
    time: "17:20",
    actor: "张明",
    action: "停用成员 赵磊",
    target: "成员管理",
    severity: "warning",
    ref: "AUD-20261102-019",
    ip: "10.2.4.18",
  },
  {
    id: "ev-5",
    day: "昨天",
    time: "14:48",
    actor: "王珊",
    action: "角色权限变更：计划员 +导入导出",
    target: "角色矩阵",
    severity: "info",
    ref: "AUD-20261102-014",
    ip: "10.2.4.31",
  },
];
const sevLabel: Record<Severity, string> = {
  info: "信息",
  warning: "警告",
  critical: "高危",
};
const sevTone = { info: "info", warning: "paused", critical: "error" } as const;

export function SceneAuditTimeline() {
  const [range, setRange] = useState("7d");
  const [type, setType] = useState<string>("all");
  const [query, setQuery] = useState("");
  const filtered = auditEvents.filter(
    (e) =>
      (type === "all" || e.severity === type) &&
      `${e.actor} ${e.action} ${e.target} ${e.ref}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const days = ["今天", "昨天"].filter((d) =>
    filtered.some((e) => e.day === d),
  );

  return (
    <WorkbenchLayout
      metricsVariant="strip"
      header={
        <PageHeader
          title="审计日志"
          actions={
            <Button
              variant="outline"
              icon={<Download size={16} />}
              disabled={!filtered.length}
              onClick={() =>
                downloadCsv("审计日志.csv", filtered)
              }
            >
              导出
            </Button>
          }
        />
      }
      metrics={
        <>
          <StatCard
            label="事件"
            value={auditEvents.length}
            unit="条"
            icon={<CalendarClock />}
          />
          <StatCard
            label="高危"
            value={auditEvents.filter((e) => e.severity === "critical").length}
            unit="条"
            icon={<AlertCircle />}
            tone="error"
          />
          <StatCard
            label="警告"
            value={auditEvents.filter((e) => e.severity === "warning").length}
            unit="条"
            icon={<AlertTriangle />}
            tone="paused"
          />
          <StatCard
            label="操作人"
            value={new Set(auditEvents.map((e) => e.actor)).size}
            unit="人"
            icon={<Activity />}
          />
        </>
      }
      aside={
        <Card title="筛选提示">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="font-medium">高危</dt>
              <dd className="caption">权限变更、强制登出等需复核的操作</dd>
            </div>
            <div>
              <dt className="font-medium">警告</dt>
              <dd className="caption">失败登录、异常导出等偏风险事件</dd>
            </div>
            <div>
              <dt className="font-medium">信息</dt>
              <dd className="caption">常规读写与配置浏览记录</dd>
            </div>
          </dl>
        </Card>
      }
    >
      <Card
        flush
        title={
          <>
            <CalendarClock />
            审计事件
          </>
        }
        actions={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusFilter
              value={type}
              onChange={setType}
              items={[
                { key: "all", label: "全部", count: auditEvents.length },
                ...(["critical", "warning", "info"] as Severity[]).map((s) => ({
                  key: s,
                  label: sevLabel[s],
                  count: auditEvents.filter((e) => e.severity === s).length,
                })),
              ]}
            />
            <>
              <Input
                aria-label="搜索审计记录"
                value={query}
                onChange={setQuery}
                prefix={<Search size={14} />}
                placeholder="操作人、动作、引用号"
                allowClear
                wrapperClassName="w-full max-w-xs sm:w-56"
              />
              <Select
                aria-label="时间范围"
                value={range}
                onChange={(v) => setRange(String(v))}
                options={[
                  { value: "7d", label: "近 7 天" },
                  { value: "30d", label: "近 30 天" },
                  { value: "90d", label: "近 90 天" },
                ]}
                className="w-28"
              />
            </>
          </div>
        }
      >
        {days.length ? (
          days.map((day) => (
            <section key={day}>
              <h3 className="sticky top-0 z-[1] border-b border-border bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
                {day}
              </h3>
              {filtered
                .filter((e) => e.day === day)
                .map((e, i) => (
                  <div
                    key={e.id}
                    style={{ "--i": i } as CSSProperties}
                    className={cn(
                      "border-b border-border last:border-b-0",
                      STAGGER_ITEM,
                    )}
                  >
                    <CollapseSection
                      title={
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <code className="shrink-0 tabular-nums text-xs text-muted-foreground">
                            {e.time}
                          </code>
                          <StatusBadge tone={sevTone[e.severity]}>
                            {sevLabel[e.severity]}
                          </StatusBadge>
                          <span className="min-w-0 font-medium">{e.action}</span>
                          <span className="min-w-0 text-xs text-muted-foreground">
                            {e.actor} · {e.target}
                          </span>
                        </span>
                      }
                      defaultOpen={e.id === "ev-3"}
                      headerClassName="px-4"
                      contentClassName="px-4"
                    >
                      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[4px] border border-border bg-muted px-4 py-3.5 text-sm sm:grid-cols-4">
                        {[
                          ["操作者", e.actor],
                          ["对象", e.target],
                          ["来源 IP", e.ip],
                          ["引用号", <code key="ref">{e.ref}</code>],
                        ].map(([k, v]) => (
                          <div key={String(k)} className="min-w-0">
                            <dt className="text-xs leading-5 text-muted-foreground">
                              {k}
                            </dt>
                            <dd className="mt-1 truncate font-medium leading-5 text-foreground" title={String(v)}>
                              {v}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </CollapseSection>
                  </div>
                ))}
            </section>
          ))
        ) : (
          <EmptyState
            title="该条件下没有审计记录"
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setType("all");
                }}
              >
                清除筛选
              </Button>
            }
          />
        )}
      </Card>
    </WorkbenchLayout>
  );
}

/* ------------------------------------------------------------------------ *
 * 用量与成本 — Flux spend overview with an adjustable budget.
 * ------------------------------------------------------------------------ */

/** Match Tier0 Base billing AI Credits: lime / blue / purple (cat-1/2/3). */
const providers = [
  {
    id: "p1",
    name: "App Builder",
    spend: 1280,
    tokens: 4.1,
    color: "#73b200",
  },
  {
    id: "p2",
    name: "UNS Agent",
    spend: 1065,
    tokens: 3.2,
    color: "#1d4ed8",
  },
  {
    id: "p3",
    name: "Anchor",
    spend: 702,
    tokens: 2.4,
    color: "#7c3aed",
  },
];
const DAY = 3;
const DAYS_IN_MONTH = 30;

const usageSeries = providers.map((p) => ({
  key: p.id,
  name: p.name,
  color: p.color,
}));
const usagePoints = [
  { key: "d1", label: "Oct 12", values: { p1: 18, p2: 9, p3: 6 } },
  { key: "d2", label: "Oct 17", values: { p1: 22, p2: 11, p3: 7 } },
  { key: "d3", label: "Oct 22", values: { p1: 26, p2: 13, p3: 8 } },
  { key: "d4", label: "Oct 27", values: { p1: 29.4, p2: 14.7, p3: 8.9 } },
  { key: "d5", label: "Nov 1", values: { p1: 31, p2: 15, p3: 9 } },
  { key: "d6", label: "Nov 6", values: { p1: 34, p2: 16, p3: 10 } },
  { key: "d7", label: "Nov 11", values: { p1: 36, p2: 17, p3: 11 } },
];

export function SceneAgentSpend() {
  const [budget, setBudget] = useLocalData("gallery-budget-v1", 4900);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<number | null>(4900);
  const [error, setError] = useState("");
  const spend = providers.reduce((s, p) => s + p.spend, 0);
  const used = Math.round((spend / budget) * 100);
  const daily = spend / DAY;
  const exhaustDay = Math.min(DAYS_IN_MONTH, Math.floor(budget / daily));
  const over = exhaustDay < DAYS_IN_MONTH;

  return (
    <WorkbenchLayout
      metricsVariant="strip"
      header={
        <PageHeader
          title="用量与成本"
          actions={
            <Button
              variant="outline"
              onClick={() => {
                setDraft(budget);
                setError("");
                setEditing(true);
              }}
            >
              调整预算
            </Button>
          }
        />
      }
      metrics={
        <>
          <StatCard
            label="本月已用"
            value={spend}
            unit="¥"
            icon={<Coins />}
            trend={{ direction: "up", label: "+12%", intent: "negative" }}
          />
          <StatCard label="月度预算" value={budget} unit="¥" icon={<Gauge />} />
          <StatCard
            label="预算剩余"
            value={Math.max(0, 100 - used)}
            unit="%"
            icon={<AlertCircle />}
            tone={used > 80 ? "error" : used > 60 ? "paused" : "running"}
          />
          <StatCard
            label="Token 用量"
            value={providers.reduce((s, p) => s + p.tokens, 0)}
            unit="M"
            icon={<Activity />}
            tone="info"
          />
        </>
      }
      aside={
        <Card
          title={
            <>
              <CalendarClock />
              预算预测
            </>
          }
        >
          <p
            className={cn(
              "text-sm font-medium",
              over && "text-destructive",
            )}
          >
            {over ? `按当前速度，预计 ${exhaustDay} 日触顶` : "本月预算充足"}
          </p>
          <p className="caption mt-1">
            日均 ¥{Math.round(daily).toLocaleString()} · 已过 {DAY}/
            {DAYS_IN_MONTH} 天
          </p>
          <div
            className="mt-3 grid grid-cols-[repeat(30,minmax(0,1fr))] gap-0.5"
            aria-hidden
          >
            {Array.from({ length: DAYS_IN_MONTH }, (_, d) => (
              <span
                key={d}
                className={cn(
                  "h-6 rounded-[1px]",
                  d < DAY
                    ? "bg-[color:var(--tier0-text-color)]"
                    : d < exhaustDay
                      ? "bg-muted"
                      : "bg-destructive",
                )}
              />
            ))}
          </div>
          <p className="caption mt-2">
            深色为已用天数，红色为预计超出预算的天数。
          </p>
        </Card>
      }
    >
      <div className="space-y-4">
        <Card
          title="用量明细"
          actions={
            <Button
              size="sm"
              variant="outline"
              icon={<Download size={14} />}
              onClick={() => downloadCsv("用量与成本.csv", providers)}
            >
              导出 CSV
            </Button>
          }
        >
          <StackedUsageChart
            title="用量明细"
            points={usagePoints}
            series={usageSeries}
            height={260}
          />
        </Card>
        <Card
          title={
            <>
              <Gauge />
              预算消耗
            </>
          }
          actions={
            <span className="text-sm font-medium tabular-nums">{used}%</span>
          }
        >
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {providers.map((p) => (
              <span
                key={p.id}
                className="h-full transition-[width] duration-500 ease-[var(--motion-spring)]"
                style={{
                  width: `${(p.spend / budget) * 100}%`,
                  background: p.color,
                }}
              />
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
            {providers.map((p) => {
              const share = Math.round((p.spend / spend) * 100);
              return (
                <li key={p.id} className="flex items-center gap-1.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: p.color }}
                  />
                  <span className="text-foreground">{p.name}</span>
                  <span className="tabular-nums">
                    ¥{p.spend.toLocaleString()}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    ({share}%)
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title="按提供商" flush>
          <DataGrid
            rows={providers}
            rowKey={(r) => r.id}
            columns={[
              {
                key: "name",
                title: "提供商",
                width: 180,
                render: (r) => (
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: r.color }}
                    />
                    {r.name}
                  </span>
                ),
              },
              {
                key: "share",
                title: "占比",
                width: 160,
                render: (r) => {
                  const share = Math.round((r.spend / spend) * 100);
                  return (
                    <span className="flex items-center gap-2">
                      <ProgressBar
                        percent={share}
                        size="sm"
                        showInfo={false}
                        className="w-20"
                      />
                      <span className="tabular-nums">{share}%</span>
                    </span>
                  );
                },
              },
              { key: "tokens", title: "Token (M)", width: 100 },
              {
                key: "spend",
                title: "本月 (¥)",
                width: 110,
                render: (r) => r.spend.toLocaleString(),
              },
            ]}
          />
        </Card>
      </div>
      <FormDialog
        open={editing}
        onOpenChange={setEditing}
        title="调整月度预算"
        description={`本月已用 ¥${spend.toLocaleString()}。新预算不能低于已用金额。`}
        submitLabel="保存预算"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft == null || draft < spend)
            return setError(`预算不能低于已用 ¥${spend.toLocaleString()}`);
          setBudget(draft);
          setEditing(false);
          toast.success(`月度预算已调整为 ¥${draft.toLocaleString()}`);
        }}
      >
        <FieldGroup label="月度预算（¥）" htmlFor="budget" required>
          <NumberInput
            id="budget"
            value={draft}
            onChange={(v) => {
              setDraft(v);
              setError("");
            }}
            min={0}
            step={100}
            status={error ? "error" : undefined}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </FieldGroup>
      </FormDialog>
    </WorkbenchLayout>
  );
}
