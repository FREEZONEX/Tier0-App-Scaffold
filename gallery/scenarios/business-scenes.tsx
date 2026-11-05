"use client";
import { useLocalData } from "./local-data";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Factory,
  Gauge,
  Mail,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { RiskBanner } from "@/components/ui/risk-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { WorkbenchLayout } from "@/components/ui/workbench-layout";
import { StatusFilter } from "@/components/ui/toolbar-controls";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { AsyncView } from "@/components/data/async-view";
import { Input } from "@/components/kit/ui/input";
import { Select } from "@/components/kit/ui/select";
import { DataGrid } from "@/components/kit/ui/data-grid";
import { Segmented } from "@/components/kit/ui/segmented";
import { Tag } from "@/components/kit/ui/tag";
import { ProgressBar } from "@/components/kit/ui/feedback";
import { Avatar } from "@/components/kit/ui/avatar";
import { FormDialog } from "@/components/overlays/form-dialog";
import { ConfirmDialog } from "@/components/overlays/confirm-dialog";
import { FieldGroup } from "@/components/forms/form-layout";
import { DualAxisChart } from "@/components/charts/board-charts";
import { STAGGER_ITEM } from "@/lib/interaction";
import { cn } from "@/lib/utils";
import type { RequestResult } from "@/lib/hooks";

const OPS_TREND = [
  { key: "1", label: "周一", bar: 80, line: 2.1 },
  { key: "2", label: "周二", bar: 120, line: 1.4 },
  { key: "3", label: "周三", bar: 98, line: 2.8 },
  { key: "4", label: "周四", bar: 140, line: 1.9 },
  { key: "5", label: "周五", bar: 160, line: 1.2 },
] as const;

/* Gallery fixtures only: clock/id helpers are called from event handlers. */
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const clock = (at: number) =>
  new Date(at).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });

/* ------------------------------------------------------------------------ *
 * 成员与权限目录 — Atlas directory on ReUI frames.
 * ------------------------------------------------------------------------ */

type MemberStatus = "active" | "disabled" | "invited";
type Member = {
  id: string;
  name: string;
  email: string;
  dept: string;
  roles: string[];
  status: MemberStatus;
};

const ROLES = [
  { key: "管理员", scope: ["查看", "编辑", "审批", "授权"] },
  { key: "计划员", scope: ["查看", "编辑", "导入导出"] },
  { key: "执行员", scope: ["查看", "报工"] },
];
const memberSeed: Member[] = [
  {
    id: "m1",
    name: "张明",
    email: "zhangming@example.com",
    dept: "制造中心",
    roles: ["管理员"],
    status: "active",
  },
  {
    id: "m2",
    name: "李晨",
    email: "lichen@example.com",
    dept: "装配车间",
    roles: ["计划员"],
    status: "active",
  },
  {
    id: "m3",
    name: "王珊",
    email: "wangshan@example.com",
    dept: "质检车间",
    roles: ["计划员", "执行员"],
    status: "active",
  },
  {
    id: "m4",
    name: "赵磊",
    email: "zhaolei@example.com",
    dept: "包装车间",
    roles: ["执行员"],
    status: "disabled",
  },
  {
    id: "m5",
    name: "周婷",
    email: "zhouting@example.com",
    dept: "装配车间",
    roles: ["执行员"],
    status: "invited",
  },
];
const memberStatusLabel: Record<MemberStatus, string> = {
  active: "启用",
  disabled: "已停用",
  invited: "待接受",
};
const memberTone = {
  active: "running",
  disabled: "idle",
  invited: "info",
} as const;

export function SceneAdminDirectory() {
  const [members, setMembers] = useLocalData("gallery-members-v1", memberSeed);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [inviting, setInviting] = useState(false);
  const [invite, setInvite] = useState({ email: "", role: "执行员" });
  const [inviteError, setInviteError] = useState("");
  const [toggling, setToggling] = useState<Member | null>(null);
  const [log, setLog] = useState<TimelineItem[]>([
    {
      id: "l1",
      title: "张明 将 赵磊 停用",
      meta: "昨天 17:20",
      tone: "paused",
    },
    {
      id: "l2",
      title: "已邀请 周婷（执行员）",
      meta: "昨天 09:02",
      tone: "info",
    },
  ]);

  const count = (s: MemberStatus) =>
    members.filter((m) => m.status === s).length;
  const visible = members.filter(
    (m) =>
      (filter === "all" || m.status === filter) &&
      `${m.name} ${m.email} ${m.dept}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const record = (title: string, tone: TimelineItem["tone"]) =>
    setLog((items) =>
      [{ id: uid(), title, meta: clock(now()), tone }, ...items].slice(0, 6),
    );

  function sendInvite() {
    const email = invite.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setInviteError("请输入有效的邮箱地址");
    if (members.some((m) => m.email === email))
      return setInviteError("该邮箱已在成员目录中");
    const name = email.split("@")[0];
    setMembers((list) => [
      {
        id: uid(),
        name,
        email,
        dept: "未分配",
        roles: [invite.role],
        status: "invited",
      },
      ...list,
    ]);
    record(`已邀请 ${name}（${invite.role}）`, "info");
    toast.success(`已为 ${email} 创建邀请记录`);
    setInviting(false);
    setInvite({ email: "", role: "执行员" });
  }
  function confirmToggle() {
    if (!toggling) return;
    const next: MemberStatus =
      toggling.status === "disabled" ? "active" : "disabled";
    setMembers((list) =>
      list.map((m) => (m.id === toggling.id ? { ...m, status: next } : m)),
    );
    record(
      `${toggling.name} 已${next === "active" ? "重新启用" : "停用"}`,
      next === "active" ? "running" : "paused",
    );
    toast.success(
      `${toggling.name} 已${next === "active" ? "重新启用" : "停用"}`,
    );
    setToggling(null);
  }

  return (
    <WorkbenchLayout
      metricsVariant="strip"
      header={
        <PageHeader
          title="成员与权限"
          actions={
            <Button
              icon={<Plus size={16} />}
              onClick={() => {
                setInviteError("");
                setInviting(true);
              }}
            >
              邀请成员
            </Button>
          }
        />
      }
      metrics={
        <>
          <StatCard
            label="成员总数"
            value={members.length}
            unit="人"
            icon={<Users />}
          />
          <StatCard
            label="启用"
            value={count("active")}
            unit="人"
            icon={<UserCheck />}
            tone="running"
          />
          <StatCard
            label="待接受邀请"
            value={count("invited")}
            unit="人"
            icon={<Mail />}
            tone="info"
          />
          <StatCard
            label="已停用"
            value={count("disabled")}
            unit="人"
            icon={<UserMinus />}
          />
        </>
      }
      aside={
        <>
          <Card
            title={
              <>
                <ShieldCheck />
                角色与权限
              </>
            }
          >
            <ul className="space-y-3">
              {ROLES.map((role) => (
                <li key={role.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-medium">
                    {role.key}
                    <span className="caption tabular-nums">
                      {
                        members.filter(
                          (m) =>
                            m.roles.includes(role.key) &&
                            m.status !== "disabled",
                        ).length
                      }{" "}
                      人
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.scope.map((s) => (
                      <Tag key={s}>{s}</Tag>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card
            title={
              <>
                <Activity />
                变更记录
              </>
            }
          >
            <Timeline items={log} />
          </Card>
        </>
      }
    >
      <Card
        flush
        title={
          <>
            <Users />
            成员
          </>
        }
        actions={
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusFilter
              value={filter}
              onChange={setFilter}
              items={[
                { key: "all", label: "全部", count: members.length },
                { key: "active", label: "启用", count: count("active") },
                { key: "invited", label: "待接受", count: count("invited") },
                { key: "disabled", label: "已停用", count: count("disabled") },
              ]}
            />
            <Input
              aria-label="搜索成员"
              value={query}
              onChange={setQuery}
              prefix={<Search size={14} />}
              placeholder="姓名、邮箱、部门"
              allowClear
              wrapperClassName="w-full max-w-xs sm:w-56"
            />
          </div>
        }
      >
        {visible.length ? (
          <DataGrid
            rows={visible}
            rowKey={(m) => m.id}
            columns={[
              {
                key: "name",
                title: "成员",
                width: 240,
                render: (m) => (
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={m.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {m.name}
                      </span>
                      <span className="caption block truncate">{m.email}</span>
                    </span>
                  </span>
                ),
              },
              { key: "dept", title: "部门", width: 110 },
              {
                key: "roles",
                title: "角色",
                width: 170,
                render: (m) => (
                  <span className="flex flex-wrap gap-1">
                    {m.roles.map((r) => (
                      <Tag key={r}>{r}</Tag>
                    ))}
                  </span>
                ),
              },
              {
                key: "status",
                title: "状态",
                width: 100,
                render: (m) => (
                  <StatusBadge tone={memberTone[m.status]}>
                    {memberStatusLabel[m.status]}
                  </StatusBadge>
                ),
              },
              {
                key: "actions",
                title: "操作",
                width: 110,
                ellipsis: false,
                render: (m) =>
                  m.status === "invited" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        record(`重新发送邀请给 ${m.name}`, "info");
                        toast.success(`已为 ${m.email} 记录重发请求`);
                      }}
                    >
                      重发邀请
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setToggling(m)}
                    >
                      {m.status === "disabled" ? "重新启用" : "停用"}
                    </Button>
                  ),
              },
            ]}
          />
        ) : (
          <EmptyState
            title="没有匹配的成员"
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                清除筛选
              </Button>
            }
          />
        )}
      </Card>

      <FormDialog
        open={inviting}
        onOpenChange={setInviting}
        title="邀请成员"
        description="成员接受邀请后，以平台身份进入本应用，权限取所分配角色的并集。"
        submitLabel="发送邀请"
        onSubmit={(e) => {
          e.preventDefault();
          sendInvite();
        }}
      >
        <div className="flex flex-col gap-5">
          <FieldGroup label="邮箱" htmlFor="invite-email" required>
            <Input
              id="invite-email"
              value={invite.email}
              onChange={(email) => {
                setInvite({ ...invite, email });
                setInviteError("");
              }}
              placeholder="name@example.com"
              status={inviteError ? "error" : undefined}
              aria-invalid={!!inviteError}
              required
            />
            {inviteError && (
              <p role="alert" className="text-sm text-destructive">
                {inviteError}
              </p>
            )}
          </FieldGroup>
          <FieldGroup label="角色">
            <Select
              aria-label="角色"
              value={invite.role}
              onChange={(role) => setInvite({ ...invite, role: String(role) })}
              options={ROLES.map((r) => ({ value: r.key, label: r.key }))}
            />
          </FieldGroup>
        </div>
      </FormDialog>
      <ConfirmDialog
        open={!!toggling}
        onOpenChange={(v) => {
          if (!v) setToggling(null);
        }}
        title={toggling?.status === "disabled" ? "重新启用成员" : "停用成员"}
        description={
          toggling?.status === "disabled"
            ? `${toggling?.name ?? ""} 将恢复原有角色权限，可再次进入本应用。`
            : `${toggling?.name ?? ""} 将无法进入本应用，已提交的记录保留。可随时重新启用。`
        }
        confirmLabel={toggling?.status === "disabled" ? "重新启用" : "停用"}
        destructive={toggling?.status !== "disabled"}
        onConfirm={confirmToggle}
      />
    </WorkbenchLayout>
  );
}

/* ------------------------------------------------------------------------ *
 * 产线健康看板 — Strata monitor with live readings.
 * ------------------------------------------------------------------------ */

type LineState = "running" | "paused" | "error";
type Line = {
  id: string;
  name: string;
  state: LineState;
  oee: number;
  output: number;
  target: number;
};
type Alarm = {
  id: string;
  line: string;
  text: string;
  level: "error" | "paused";
  at: number;
};

const lineSeed: Line[] = [
  {
    id: "L1",
    name: "装配线 A",
    state: "running",
    oee: 86.4,
    output: 412,
    target: 480,
  },
  {
    id: "L2",
    name: "装配线 B",
    state: "running",
    oee: 81.2,
    output: 388,
    target: 480,
  },
  {
    id: "L3",
    name: "焊接线",
    state: "error",
    oee: 52.7,
    output: 164,
    target: 360,
  },
  {
    id: "L4",
    name: "喷涂线",
    state: "running",
    oee: 78.9,
    output: 291,
    target: 360,
  },
  {
    id: "L5",
    name: "包装线 A",
    state: "paused",
    oee: 64.1,
    output: 520,
    target: 720,
  },
  {
    id: "L6",
    name: "包装线 B",
    state: "running",
    oee: 88.3,
    output: 610,
    target: 720,
  },
];
const lineLabel: Record<LineState, string> = {
  running: "运行",
  paused: "换型",
  error: "停机",
};

export function SceneOpsMonitor() {
  const [subscribed,setSubscribed]=useLocalData("gallery-alert-subscription-v1",false);
  const [lines, setLines] = useLocalData("gallery-lines-v1", lineSeed);
  const [alarms, setAlarms] = useState<Alarm[]>(() => [
    {
      id: "a1",
      line: "焊接线",
      text: "焊枪温度超限，已自动停机",
      level: "error",
      at: now() - 6 * 60e3,
    },
    {
      id: "a2",
      line: "包装线 A",
      text: "换型超时 12 分钟",
      level: "paused",
      at: now() - 21 * 60e3,
    },
  ]);
  const [acked, setAcked] = useState<TimelineItem[]>([]);

  // Simulated live feed: readings drift every 3s so KPIs roll (AnimatedNumber).
  useEffect(() => {
    const timer = window.setInterval(() => {
      setLines((list) =>
        list.map((l) =>
          l.state !== "running"
            ? l
            : {
                ...l,
                output: Math.min(
                  l.target,
                  l.output + Math.round(Math.random() * 4),
                ),
                oee: Math.max(
                  60,
                  Math.min(
                    95,
                    +(l.oee + (Math.random() - 0.45) * 0.8).toFixed(1),
                  ),
                ),
              },
        ),
      );
    }, 3000);
    return () => window.clearInterval(timer);
  }, [setLines]);

  const running = lines.filter((l) => l.state === "running");
  const avgOee = +(lines.reduce((s, l) => s + l.oee, 0) / lines.length).toFixed(
    1,
  );
  const output = lines.reduce((s, l) => s + l.output, 0);
  const critical = alarms.find((a) => a.level === "error");

  function acknowledge(a: Alarm) {
    setAlarms((list) => list.filter((x) => x.id !== a.id));
    setAcked((list) => [
      {
        id: a.id,
        title: `已确认：${a.line} ${a.text}`,
        meta: `${clock(now())} · 值班长`,
        tone: "running" as const,
      },
      ...list,
    ]);
    toast.success(`已确认「${a.line}」告警，转入处理记录`);
  }
  function restart(l: Line) {
    setLines((list) =>
      list.map((x) => (x.id === l.id ? { ...x, state: "running" } : x)),
    );
    setAlarms((list) => list.filter((a) => a.line !== l.name));
    toast.success(`${l.name} 已恢复运行`);
  }

  return (
    <WorkbenchLayout
      metricsVariant="strip"
      header={
        <PageHeader
          title="产线健康看板"
          actions={
            <Button
              variant="outline"
              icon={<BellRing size={16} />}
              aria-pressed={subscribed}
              onClick={() => {
                setSubscribed(!subscribed);
                toast.success(
                  subscribed ? "已取消本地告警订阅" : "已启用本地告警订阅",
                );
              }}
            >
              {subscribed ? "取消订阅" : "订阅告警"}
            </Button>
          }
        />
      }
      metrics={
        <>
          <StatCard
            label="平均 OEE"
            value={avgOee}
            unit="%"
            icon={<Gauge />}
            tone="running"
          />
          <StatCard
            label="今日产出"
            value={output}
            unit="件"
            icon={<Factory />}
          />
          <StatCard
            label="运行线体"
            value={`${running.length}/${lines.length}`}
            icon={<CheckCircle2 />}
            tone="running"
          />
          <StatCard
            label="未确认告警"
            value={alarms.length}
            unit="条"
            icon={<AlertTriangle />}
            tone={alarms.length ? "error" : "default"}
          />
        </>
      }
      aside={
        <>
          <Card
            title={
              <>
                <AlertTriangle />
                未确认告警
              </>
            }
            flush
          >
            {alarms.length ? (
              <ul className="divide-y divide-border">
                {alarms.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <StatusBadge tone={a.level} pulse className="mt-0.5">
                      {a.level === "error" ? "停机" : "预警"}
                    </StatusBadge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{a.line}</p>
                      <p className="caption">
                        {a.text} · {clock(a.at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledge(a)}
                    >
                      确认
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="caption px-4 py-6 text-center">告警均已确认</p>
            )}
          </Card>
          <Card
            title={
              <>
                <Activity />
                处理记录
              </>
            }
          >
            {acked.length ? (
              <Timeline items={acked} />
            ) : (
              <p className="caption">确认的告警会出现在这里</p>
            )}
          </Card>
        </>
      }
    >
      <div className="space-y-4">
        {critical && (
          <RiskBanner
            severity="error"
            action={
              <Button
                size="sm"
                variant="secondary"
                className="border border-border bg-card text-foreground shadow-xs"
                onClick={() => acknowledge(critical)}
              >
                确认告警
              </Button>
            }
          >
            {critical.line}：{critical.text}
          </RiskBanner>
        )}
        <Card
          title={
            <>
              <Activity />
              产量与不良率
            </>
          }
          actions={<span className="caption">近 5 日 · 双轴</span>}
        >
          <div className="h-[280px]">
            <DualAxisChart
              surface="card"
              title="产量与不良率"
              points={OPS_TREND}
              bar={{
                name: "产量",
                unit: "件",
                color: "#b2ed1d",
                format: String,
                integer: true,
              }}
              line={{
                name: "不良率",
                unit: "%",
                color: "#1d4ed8",
                format: (v) => `${v}`,
                tickSuffix: "%",
              }}
            />
          </div>
        </Card>
        <Card
          title={
            <>
              <Factory />
              线体状态
            </>
          }
          actions={<span className="caption">每 3 秒刷新</span>}
        >
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {lines.map((l, i) => (
              <article
                key={l.id}
                style={{ "--i": i } as CSSProperties}
                className={cn(
                  "space-y-3 rounded-[4px] bg-[#fafafa] p-3 transition-[background-color,box-shadow] duration-[var(--motion-fast)] hover:bg-fill-hover",
                  l.state === "error" &&
                    "bg-[color:var(--state-error-bg)] hover:bg-[color:var(--state-error-bg)]",
                  STAGGER_ITEM,
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{l.name}</span>
                  <code className="caption">{l.id}</code>
                  <StatusBadge
                    tone={l.state}
                    pulse={l.state !== "paused"}
                    className="ml-auto"
                  >
                    {lineLabel[l.state]}
                  </StatusBadge>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="caption">OEE</p>
                    <p className="text-xl font-semibold tabular-nums">
                      <AnimatedNumber
                        value={l.oee}
                        format={{ maximumFractionDigits: 1 }}
                      />
                      <span className="ml-0.5 text-sm font-normal text-muted-foreground">
                        %
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="caption">产出 / 目标</p>
                    <p className="text-sm tabular-nums">
                      <AnimatedNumber value={l.output} /> / {l.target}
                    </p>
                  </div>
                </div>
                <ProgressBar
                  percent={Math.round((l.output / l.target) * 100)}
                  size="sm"
                  showInfo={false}
                  status={l.state === "error" ? "exception" : "normal"}
                />
                {l.state !== "running" && (
                  <Button
                    size="sm"
                    variant="outline"
                    block
                    onClick={() => restart(l)}
                  >
                    {l.state === "error"
                      ? "故障已排除，恢复运行"
                      : "换型完成，恢复运行"}
                  </Button>
                )}
              </article>
            ))}
          </div>
        </Card>
      </div>
    </WorkbenchLayout>
  );
}

/* ------------------------------------------------------------------------ *
 * 加载 / 空态 / 错误 / 数据 — one AsyncView, four states.
 * ------------------------------------------------------------------------ */

type DemoState = "loading" | "empty" | "error" | "data";
const demoRows = [
  {
    id: "r1",
    code: "MAT-1001",
    name: "精密铝合金支架",
    qty: 1240,
    status: "在库",
  },
  {
    id: "r2",
    code: "MAT-1002",
    name: "M6 不锈钢螺栓",
    qty: 18200,
    status: "在库",
  },
  {
    id: "r3",
    code: "MAT-1003",
    name: "密封圈 Φ32",
    qty: 86,
    status: "低于安全库存",
  },
];

export function SceneEmptyContrast() {
  const [state, setState] = useState<DemoState>("loading");
  const result = useMemo<RequestResult<typeof demoRows>>(
    () => ({
      data: state === "data" ? demoRows : state === "empty" ? [] : null,
      error: state === "error" ? new Error("库存服务暂时不可用（503）") : null,
      isLoading: state === "loading",
      refresh: () => {
        setState("loading");
        toast("正在重新加载…");
        window.setTimeout(() => setState("data"), 1200);
      },
    }),
    [state],
  );

  return (
    <WorkbenchLayout
      header={<PageHeader title="数据状态" />}
      aside={
        <Card title="何时出现">
          <dl className="space-y-3 text-sm">
            {[
              ["加载中", "首次请求在途；表格形骨架，避免数据到达时跳动"],
              ["空数据", "请求成功但没有记录；给出下一步动作"],
              ["加载失败", "请求失败且没有旧数据；显示原因与重新加载"],
              ["有数据", "正常渲染；后台刷新不清空已显示的数据"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-medium">{k}</dt>
                <dd className="caption">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      }
    >
      <Card
        title="物料库存"
        actions={
          <Segmented
            aria-label="切换数据状态"
            value={state}
            onChange={(v) => setState(v as DemoState)}
            options={[
              { value: "loading", label: "加载中" },
              { value: "empty", label: "空数据" },
              { value: "error", label: "失败" },
              { value: "data", label: "有数据" },
            ]}
          />
        }
        flush
      >
        <div className="p-3">
          <AsyncView
            result={result}
            empty={
              <EmptyState
                title="还没有物料档案"
                description="创建第一条记录后，库存与预警会出现在这里。"
                action={
                  <Button
                    icon={<Plus size={16} />}
                    onClick={() => setState("data")}
                  >
                    新建物料
                  </Button>
                }
              />
            }
          >
            {(rows) => (
              <DataGrid
                rows={rows}
                rowKey={(r) => r.id}
                columns={[
                  { key: "code", title: "编码", width: 120 },
                  { key: "name", title: "名称", width: 200 },
                  {
                    key: "qty",
                    title: "库存",
                    width: 100,
                    render: (r) => r.qty.toLocaleString(),
                  },
                  {
                    key: "status",
                    title: "状态",
                    width: 140,
                    render: (r) => <StatusBadge status={r.status} />,
                  },
                ]}
              />
            )}
          </AsyncView>
        </div>
      </Card>
    </WorkbenchLayout>
  );
}
