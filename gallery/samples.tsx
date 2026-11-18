import { useState, useRef, type ReactNode } from 'react';
import {
  ChatActionPanel,
  ChatCodeBlock,
  ChatComposer,
  ChatDock,
  ChatHistorySelect,
  ChatLauncher,
  ChatMessage,
  ChatMetricCard,
  ChatMetricRow,
  ChatNewButton,
  ChatPanel,
  ChatPromptChips,
  ChatReasoning,
  ChatRetrieval,
  ChatSpark,
  ChatStatus,
  ChatThread,
  ChatToolGroup,
  StreamText,
  ThinkingLoader,
  type ChatHistoryItem,
  type ChatToolCallItem,
} from '@/components/ui';
import { useSimulatedStream } from '@/lib/text-reveal';
import { createRootRoute, createRoute, createRouter, createMemoryHistory, RouterProvider, useRouterState } from '@tanstack/react-router';
import { ClipboardList, Monitor, Users, Activity, Package, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, PageHeader, StatusBadge, StatusFilterChips, RiskBanner, EmptyState, StatCard, RouteErrorBoundary } from '@/components/ui';
import { FieldGroup, FieldLabel, RequiredMark, FormGrid, LineItemSection, RecordSelect, FileUpload } from '@/components/forms';
import { DataTable, TableViewport, TableCellText, TableStatusCell, AsyncView } from '@/components/data';
import { Dialog, DialogActions } from '@/components/overlays/dialog';
import { FormDialog } from '@/components/overlays/form-dialog';
import { ConfirmDialog } from '@/components/overlays/confirm-dialog';
import { Drawer } from '@/components/overlays/drawer';
import { OverlayPortal, OverlayHeader, OverlayFooter, OverlayActionButton } from '@/components/overlays/overlay-frame';
import { RecommendationAction, ImpactPreviewDialog } from '@/components/actions';
import { Shell } from '@/components/Shell';
import { StationLayout } from '@/components/layouts/StationLayout';
import { ReviewLayout } from '@/components/layouts/ReviewLayout';
import { MonitorLayout } from '@/components/layouts/MonitorLayout';
import { ClientOnly } from '@/components/client-only';
import { ApiRequestError } from '@/lib/utils';
import { Toaster } from '@/components/toaster';
import { TemplatePreviewPlaceholder } from '@/components/TemplatePreviewPlaceholder';
const user={id:'sample',username:'sample',displayName:'示例操作员',primaryRole:'',roles:[]};
const rows=[{id:'WO-001',name:'装配线巡检',status:'待处理'},{id:'WO-002',name:'温度传感器检查',status:'执行中'}];
const impacts=[{id:'1',label:'巡检任务 WO-001',before:'未分派',after:'示例操作员',description:'仅演示，不会修改业务数据'}];
const labels={basisTitle:'建议依据',impactTitle:'影响范围',impactDescription:'确认受影响的示例记录',reasonTitle:'原因',beforeLabel:'变更前',afterLabel:'变更后'};
function Table(){return <DataTable><thead><tr><th>任务编号</th><th>任务</th><th>状态</th></tr></thead><tbody>{rows.map((r,i)=><tr key={r.id}><td className="font-mono">{r.id}</td><td><TableCellText>{r.name}</TableCellText></td><TableStatusCell><StatusBadge tone={i?'running':'paused'}>{r.status}</StatusBadge></TableStatusCell></tr>)}</tbody></DataTable>}
function ShellContent(){return <div className="flex h-[640px] justify-center bg-muted/40 p-6"><Shell sidebarOnly user={user} modules={[{key:'tasks',label:'任务队列',href:'/',icon:ClipboardList},{key:'assets',label:'设备台账',href:'/assets',icon:Monitor},{key:'people',label:'执行员',href:'/people',icon:Users},{key:'repair',label:'报修单',href:'/repair',icon:'Wrench'},{key:'orders',label:'工单',href:'/orders',icon:'ListTodo'},{key:'stock',label:'库存台账',href:'/stock',icon:'' as never},{key:'board',label:'班组看板',href:'/board',icon:'not-a-lucide-icon' as never},{key:'other',label:'其他事项',href:'/other',icon:'' as never},{key:'inspect',label:'巡检记录',href:'/quality/inspect',icon:'ClipboardCheck'},{key:'ncr',label:'不合格品',href:'/quality/ncr',icon:'TriangleAlert'}]}/></div>}
const rootRoute=createRootRoute({component:ShellContent});
const shellRouter=createRouter({routeTree:rootRoute.addChildren([createRoute({getParentRoute:()=>rootRoute,path:'/',component:()=>null}),createRoute({getParentRoute:()=>rootRoute,path:'/assets',component:()=>null}),createRoute({getParentRoute:()=>rootRoute,path:'/people',component:()=>null}),createRoute({getParentRoute:()=>rootRoute,path:'/repair',component:()=>null}),createRoute({getParentRoute:()=>rootRoute,path:'/orders',component:()=>null}),createRoute({getParentRoute:()=>rootRoute,path:'/stock',component:()=>null}),createRoute({getParentRoute:()=>rootRoute,path:'/board',component:()=>null}),createRoute({getParentRoute:()=>rootRoute,path:'/other',component:()=>null}),createRoute({getParentRoute:()=>rootRoute,path:'/quality/inspect',component:()=>null}),createRoute({getParentRoute:()=>rootRoute,path:'/quality/ncr',component:()=>null})]),history:createMemoryHistory({initialEntries:['/']})});
const STREAM_SAMPLE = `**ALM-4412** 表示装配二线工位 A-03 扭矩超限。

- 当前读数 **48.6 N·m**
- 先做传感器复位，失败再报修`;

function StreamTextDemo() {
  const [active, setActive] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const { text, done } = useSimulatedStream(source, active);
  return (
    <div className="w-full max-w-xl space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            setSource(STREAM_SAMPLE);
            setActive(true);
          }}
          disabled={active && !done}
        >
          开始生成
        </Button>
        <Button size="sm" variant="outline" onClick={() => setActive(false)} disabled={!active || done}>
          停止
        </Button>
      </div>
      <div className="rounded-[4px] border border-border bg-card px-3 py-3">
        <StreamText text={text} streaming={active && !done} />
        {!source ? <p className="caption">点「开始生成」查看逐字输出。</p> : null}
      </div>
    </div>
  );
}

function ChatComposerDemo() {
  const [value, setValue] = useState("");
  const [sent, setSent] = useState("");
  return (
    <div className="w-full max-w-xl space-y-3">
      <div className="overflow-hidden rounded-[4px] border border-border bg-card">
        <ChatPromptChips
          items={[{ id: "a", label: "这条告警是什么意思" }, { id: "b", label: "如何复位扭矩传感器" }]}
          onSelect={(id) => setValue(id === "a" ? "这条告警是什么意思" : "如何复位扭矩传感器")}
        />
        <ChatComposer value={value} onChange={setValue} onSubmit={(next) => { setSent(next); setValue(""); }} />
      </div>
      <p className="caption">已发送：{sent || "—"}</p>
    </div>
  );
}

const DEMO_HISTORY: ChatHistoryItem[] = [
  { id: 'hist-check', title: '本班点检缺口', preview: '还缺扭矩仪比对和首件确认', updatedAt: '今天 08:12' },
  { id: 'hist-reset', title: '传感器复位步骤', preview: '空载后长按复位至指示灯变绿', updatedAt: '昨天 16:40' },
];

function useDemoHistory(initialId: string | null = 'hist-check') {
  const [items, setItems] = useState<ChatHistoryItem[]>(DEMO_HISTORY);
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const currentTitle = items.find((item) => item.id === activeId)?.title ?? '新对话';
  return {
    items,
    activeId,
    currentTitle,
    onSelect: setActiveId,
    onDelete: (id: string) => {
      setItems((current) => current.filter((item) => item.id !== id));
      setActiveId((current) => (current === id ? null : current));
    },
  };
}

function DemoHistoryTitle(props: ReturnType<typeof useDemoHistory>) {
  return (
    <ChatHistorySelect
      items={props.items}
      activeId={props.activeId}
      currentTitle={props.currentTitle}
      onSelect={props.onSelect}
      onDelete={props.onDelete}
    />
  );
}

function ChatPanelDemo() {
  const [value, setValue] = useState("");
  const history = useDemoHistory(null);
  return (
    <div className="h-[28rem] w-full max-w-xl">
      <ChatPanel
        title={<DemoHistoryTitle {...history} />}
        showMark={false}
        actions={<ChatNewButton onClick={() => setValue("")} />}
        empty={<p className="text-sm text-muted-foreground">还没有提问</p>}
        prompts={
          <ChatPromptChips
            items={[{ id: "a", label: "这条告警是什么意思" }]}
            onSelect={() => setValue("这条告警是什么意思")}
          />
        }
        composer={<ChatComposer value={value} onChange={setValue} onSubmit={() => setValue("")} />}
      />
    </div>
  );
}

function ChatDockDemo() {
  const [open, setOpen] = useState(true);
  const [value, setValue] = useState("");
  const history = useDemoHistory();
  return (
    <div className="flex h-[28rem] w-full max-w-3xl overflow-hidden rounded-[4px] border border-border bg-workspace">
      <ChatDock
        open={open}
        onOpenChange={setOpen}
        title="对话"
        assistant={
          <ChatPanel
            flush
            showMark={false}
            title={<DemoHistoryTitle {...history} />}
            actions={
              <>
                <ChatNewButton onClick={() => setValue("")} />
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={open ? "收起助手" : "打开助手"}
                  title={open ? "收起助手" : "打开助手"}
                  onClick={() => setOpen((current) => !current)}
                >
                  {open ? <PanelRightClose /> : <PanelRightOpen />}
                </Button>
              </>
            }
            composer={<ChatComposer value={value} onChange={setValue} onSubmit={() => setValue("")} />}
          >
            <ChatMessage role="assistant" name="工艺助手" text="点「写入草稿」会把这段说明追加到左侧。" />
          </ChatPanel>
        }
      >
        <div className="p-4 text-sm leading-6">
          <p className="font-medium">报修草稿</p>
          <p className="mt-2 text-muted-foreground">工位 A-03 扭矩超限，本工位件已隔离。</p>
        </div>
      </ChatDock>
    </div>
  );
}

function ChatLauncherDemo() {
  const [mode, setMode] = useState<"closed" | "open" | "minimized">("open");
  const [value, setValue] = useState("");
  const history = useDemoHistory();
  return (
    <div className="relative h-[28rem] w-full max-w-xl overflow-hidden rounded-[4px] border border-border bg-workspace">
      <p className="p-4 text-sm leading-6">SOP-扭矩校准正文。右下角是助手窗口。</p>
      <ChatLauncher
        mode={mode}
        onModeChange={setMode}
        title={<DemoHistoryTitle {...history} />}
        barLabel={history.currentTitle}
        showMark={false}
        unread={mode === "minimized"}
        actions={<ChatNewButton onClick={() => setValue("")} />}
        panel={
          <div className="flex min-h-0 flex-1 flex-col">
            <ChatThread>
              <ChatMessage role="user" name="操作员" text="这条告警是什么意思" />
              <ChatMessage role="assistant" name="工艺助手" text="ALM-4412：扭矩连续 3 拍超上限，本工位件需隔离。" />
            </ChatThread>
            <ChatComposer value={value} onChange={setValue} onSubmit={() => setValue("")} />
          </div>
        }
      />
    </div>
  );
}

function ChatHistoryDemo() {
  const history = useDemoHistory();
  return (
    <div className="flex h-10 w-full max-w-xl items-center rounded-[4px] border border-border bg-card px-3">
      <DemoHistoryTitle {...history} />
    </div>
  );
}

function ChatToolDemo() {
  const [running, setRunning] = useState(false);
  const items: ChatToolCallItem[] = [
    { id: 't-alm', title: '查告警字典', name: 'lookup_alarm', status: running ? 'running' : 'done', input: { 编码: 'ALM-4412' }, output: running ? undefined : { 含义: '扭矩连续 3 拍超上限' }, durationMs: running ? undefined : 420 },
    { id: 't-sop', title: '读工艺文件', name: 'read_sop', status: running ? 'running' : 'done', input: { 文件: 'SOP-扭矩校准' }, output: running ? undefined : { 结论: '超上限先隔离' }, durationMs: running ? undefined : 680 },
  ];
  return (
    <div className="w-full max-w-xl space-y-3">
      <Button size="sm" variant="outline" onClick={() => setRunning((current) => !current)}>{running ? '完成调用' : '模拟调用中'}</Button>
      <ChatToolGroup items={items} defaultOpen />
    </div>
  );
}

function ChatMetricDemo() {
  return (
    <div className="w-full max-w-xl">
      <ChatMetricRow>
        <ChatMetricCard label="当前读数" value={48.6} unit="N·m" hint="连续 3 拍" tone="error" />
        <ChatMetricCard label="工艺上限" value={42} unit="N·m" />
        <ChatMetricCard label="隔离件数" value={1} unit="件" hint="本工位产出" />
      </ChatMetricRow>
    </div>
  );
}

function ChatActionDemo() {
  const [status, setStatus] = useState<'pending' | 'done' | 'dismissed'>('pending');
  return (
    <div className="w-full max-w-xl space-y-3">
      {status !== 'pending' ? <Button size="sm" variant="outline" onClick={() => setStatus('pending')}>重新打开</Button> : null}
      <ChatActionPanel
        title="建议隔离本工位件"
        description="未复位前不要放行 A-03 产出。"
        details={[{ label: '工位', value: 'A-03' }, { label: '读数', value: '48.6 N·m' }]}
        status={status}
        primaryLabel="隔离本工位件"
        destructive
        confirm={{ title: '隔离本工位件？', description: '工位 A-03 当前产出将标为待复检，本班不能放行。' }}
        doneLabel="已隔离本工位件，待复检。"
        onDismiss={() => setStatus('dismissed')}
        onPrimary={() => { toast.success('已隔离本工位件，待复检。'); setStatus('done'); }}
      />
    </div>
  );
}

function ChatStatusDemo() {
  const [state, setState] = useState<"waiting" | "error">("waiting");
  return (
    <div className="w-full max-w-xl space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={state === "waiting" ? "primary" : "outline"} onClick={() => setState("waiting")}>
          等待首字
        </Button>
        <Button size="sm" variant={state === "error" ? "primary" : "outline"} onClick={() => setState("error")}>
          生成失败
        </Button>
      </div>
      <div className="rounded-[4px] border border-border bg-card px-3 py-3">
        {state === "waiting" ? (
          <div className="flex flex-col gap-2">
            <ChatStatus state="waiting" label="正在查 SOP-扭矩校准" />
            <ChatRetrieval
              items={[
                { id: "sop", label: "SOP-扭矩校准", state: "read" },
                { id: "alm", label: "ALM-4412", state: "queued" },
              ]}
            />
          </div>
        ) : (
          <ChatStatus state="error" label="工艺检索超时" onRetry={() => setState("waiting")} />
        )}
      </div>
    </div>
  );
}

export function Sample({name}:{name:string}){
 const [value,setValue]=useState('');const [filter,setFilter]=useState('all');const [open,setOpen]=useState(false);const [count,setCount]=useState(0);const [files,setFiles]=useState<File[]>([]);const [mode,setMode]=useState('ready');const ref=useRef<HTMLButtonElement>(null);
 const done=()=>{setCount(c=>c+1);setOpen(false)};
 const input=<input className="w-full max-w-sm" aria-label="任务名称" value={value} onChange={e=>setValue(e.target.value)} placeholder="输入任务名称"/>;
 const field=<FieldGroup label="任务名称" required htmlFor="task-name" helperText="输入后可观察示例状态"><input id="task-name" required className="w-full" value={value} onChange={e=>setValue(e.target.value)} placeholder="输入任务名称"/></FieldGroup>;
 const footer=<><Button variant="outline" onClick={()=>setOpen(false)}>取消</Button><Button onClick={done}>确认</Button></>;
 let body:ReactNode;
 switch(name){
 case 'Button':body=<><div className="flex flex-wrap gap-3">{(['primary','highlight','secondary','outline','ghost'] as const).map(v=><Button key={v} variant={v} onClick={()=>setValue(v)}>{v}</Button>)}<Button disabled>禁用</Button><Button size="sm" onClick={()=>setValue('sm')}>小尺寸</Button></div><p className="caption">已点击：{value||'—'}</p></>;break;
 case 'Card':body=<Card title="任务信息" accent="running" actions={<Button size="sm" variant="outline" onClick={()=>setCount(c=>c+1)}>更新</Button>} footer={`更新次数：${count}`}><p>巡检任务 WO-001</p><StatusBadge tone="running">执行中</StatusBadge></Card>;break;
 case 'PageHeader':body=<PageHeader eyebrow="现场作业" title="巡检任务" actions={<Button onClick={()=>setCount(c=>c+1)}>新建任务 {count||''}</Button>}/>;break;
 case 'StatusBadge':body=<div className="flex flex-wrap gap-3">{(['running','idle','paused','error','info'] as const).map((t,i)=><StatusBadge key={t} tone={t}>{['执行中','未开始','待确认','异常','信息'][i]}</StatusBadge>)}</div>;break;
 case 'StatusFilterChips':body=<><StatusFilterChips items={[{key:'all',label:'全部',count:2},{key:'pending',label:'待处理',count:1},{key:'running',label:'执行中',count:1}]} value={filter} onChange={setFilter}/><p>当前选择：{filter}</p></>;break;
 case 'RiskBanner':body=<>{(['info','warning','error'] as const).map(s=><RiskBanner key={s} severity={s} action={<Button size="sm" variant="outline" onClick={()=>setValue(s)}>查看</Button>}>{s==='info'?'有一条新记录':s==='warning'?'一项检查即将到期':'温度超出范围'}</RiskBanner>)}<p className="caption">已查看：{value||'—'}</p></>;break;
 case 'EmptyState':body=count?<Table/>:<EmptyState title="暂无任务" description="创建一条示例记录" icon={<Package/>} action={<Button onClick={done}>创建示例</Button>}/>;break;
 case 'StatCard':body=<div className="grid grid-cols-2 gap-4"><StatCard label="今日完成" value={24} unit="项" tone="running" trend={{direction:'up',label:'+4',intent:'positive'}} icon={<Activity/>}/><StatCard label="异常记录" value={2} unit="项" tone="error" trend={{direction:'up',label:'+2',intent:'negative'}} icon={<Package/>} footer="样例数据"/></div>;break;
 case 'FieldGroup':body=<>{field}<FieldGroup label="检查结果" error="请输入检查结果"><input aria-label="检查结果" aria-invalid="true" className="w-full max-w-sm"/></FieldGroup></>;break;
 case 'FieldLabel':body=<><FieldLabel htmlFor="label-input" required>设备名称</FieldLabel><input id="label-input" className="w-full max-w-sm" placeholder="点击标签可聚焦"/></>;break;
 case 'RequiredMark':body=<p>设备编号 <RequiredMark/> <span className="caption">仅必填标记，不提供校验</span></p>;break;
 case 'FormGrid':body=<FormGrid>{field}<FieldGroup label="备注"><input className="w-full max-w-sm" aria-label="备注" placeholder="补充说明"/></FieldGroup></FormGrid>;break;
 case 'LineItemSection':body=<LineItemSection title="检查明细" actions={<Button size="sm" onClick={()=>setCount(c=>c+1)}>添加示例行</Button>}><div className="p-4">{Array.from({length:count+1},(_,i)=><p key={i}>检查项 {i+1}：设备外观</p>)}</div></LineItemSection>;break;
 case 'RecordSelect':body=<><RecordSelect aria-label="设备" value={value} onChange={e=>setValue(e.target.value)} placeholder="选择设备" metaLabels={{status:'状态',location:'位置'}} options={[{value:'A',label:'设备 A',status:'运行',location:'一号线'},{value:'B',label:'设备 B',status:'停机',location:'二号线'}]}/><p className="caption">已选择：{value||'—'}</p></>;break;
 case 'FileUpload':body=<><FileUpload files={files} onFilesChange={setFiles} maxFiles={3} maxSizeBytes={2000000} labels={{dropPrompt:'拖入文件',browse:'选择文件',selectedFiles:'已选文件',removeFile:'移除',rejectedFiles:'文件超出数量或大小限制'}} hint="最多 3 个文件，每个不超过 2 MB；仅本地选择，不上传"/><p className="caption">已选择 {files.length} 个文件</p></>;break;
 case 'DataTable':case 'TableStatusCell':body=<Table/>;break;
 case 'TableViewport':body=<TableViewport><Table/></TableViewport>;break;
 case 'TableCellText':body=<div className="max-w-xs"><TableCellText clamp>{'设备检查记录需要保留完整的信息说明。'.repeat(12)}</TableCellText><p className="caption mt-3">两行截断示例</p></div>;break;
 case 'AsyncView':body=<><div className="flex flex-wrap gap-2">{['ready','loading','empty','error','forbidden'].map(s=><Button key={s} size="sm" variant={mode===s?'primary':'outline'} onClick={()=>setMode(s)}>{s}</Button>)}</div><AsyncView result={{data:mode==='ready'?rows:mode==='empty'?[]:undefined,error:mode==='error'?new Error('示例加载失败'):mode==='forbidden'?new ApiRequestError(403,'/api/tasks','这份数据对当前账号不可用'):null,isLoading:mode==='loading',refresh:()=>setMode('ready')}}>{()=> <Table/>}</AsyncView></>;break;
 case 'Dialog':case 'DialogActions':body=<><Button onClick={()=>setOpen(true)}>打开对话框</Button><Dialog open={open} onOpenChange={setOpen} title="任务详情" description="这是由脚手架 Dialog 渲染的对话框。" footer={<DialogActions>{footer}</DialogActions>}>{field}</Dialog></>;break;
 case 'FormDialog':body=<><Button onClick={()=>setOpen(true)}>新建任务</Button><FormDialog open={open} onOpenChange={setOpen} title="新建任务" submitLabel="保存" cancelLabel="取消" onSubmit={e=>{e.preventDefault();done()}}>{field}</FormDialog><p className="caption">已保存 {count} 次：{value||'—'}</p></>;break;
 case 'ConfirmDialog':body=<><Button onClick={()=>setOpen(true)}>停用示例设备</Button><ConfirmDialog open={open} onOpenChange={setOpen} title="停用设备？" description="只更新当前样例计数，不修改真实设备。" destructive confirmLabel="停用" cancelLabel="取消" onConfirm={done}/><p className="caption">已确认 {count} 次</p></>;break;
 case 'Drawer':body=<><Button onClick={()=>setOpen(true)}>打开详情抽屉</Button><Drawer open={open} onOpenChange={setOpen} title="设备详情" footer={footer}>{field}<Table/></Drawer></>;break;
 case 'OverlayPortal':body=<><Button onClick={()=>setOpen(true)}>挂载 Portal</Button><OverlayPortal open={open}><div className="fixed bottom-4 right-4 rounded-lg border border-border bg-card p-4 shadow-sm"><p>此内容直接挂载到 document.body</p><Button onClick={()=>setOpen(false)}>关闭</Button></div></OverlayPortal></>;break;
 case 'OverlayHeader':body=<>{value==='closed'?<Button onClick={()=>setValue('')}>重新显示</Button>:<OverlayHeader title="详情标题" description="标题、描述与关闭按钮" titleId="header-title" descriptionId="header-desc" closeButtonRef={ref} onClose={()=>setValue('closed')}/>}</>;break;
 case 'OverlayFooter':body=<><OverlayFooter>{footer}</OverlayFooter><p className="caption">已确认 {count} 次</p></>;break;
 case 'OverlayActionButton':body=<><div className="flex flex-wrap gap-3"><OverlayActionButton action={{label:'确认',variant:'primary',onClick:done}}/><OverlayActionButton action={{label:'删除',variant:'destructive',onClick:done}}/><OverlayActionButton action={{label:'提交',loading:true}}/></div><p className="caption">已点击 {count} 次</p></>;break;
 case 'RecommendationAction':body=<><RecommendationAction label="查看分派建议" title="分派预览" basis="按示例工作量推荐" impacts={impacts} labels={labels} confirmLabel="确认分派" cancelLabel="取消" onConfirm={()=>setCount(c=>c+1)}/><p className="caption">已执行 {count} 次</p></>;break;
 case 'ImpactPreviewDialog':body=<><Button onClick={()=>setOpen(true)}>查看影响范围</Button><ImpactPreviewDialog open={open} onOpenChange={setOpen} title="分派预览" impacts={impacts} labels={labels} confirmLabel="确认" cancelLabel="取消" onConfirm={done}/><p className="caption">已执行 {count} 次</p></>;break;
 case 'Shell':return <RouterProvider router={shellRouter}/>;
 case 'StationLayout':return <StationLayout user={user} title="装配执行" context="装配二线 · 工位 A-03 · 白班"><div className="p-5 space-y-4"><PageHeader title="当前检查任务"/>{field}<Button onClick={done}>完成检查 {count||''}</Button></div></StationLayout>;
 case 'ReviewLayout':return <ReviewLayout user={user} title="来料检验判定" context="待判定 12 批"><div className="p-5 space-y-4"><PageHeader title="待审核记录"/><Table/><Button onClick={done}>确认审核 {count||''}</Button></div></ReviewLayout>;
 case 'MonitorLayout':return <MonitorLayout title="一号线监控" subtitle="实时概览" updatedAt="2026-11-13T08:30:15+08:00"><div className="grid grid-cols-2 gap-4 p-5"><StatCard label="运行设备" value="12" tone="running"/><StatCard label="待处理异常" value="2" tone="error"/></div></MonitorLayout>;
 case 'ClientOnly':body=<ClientOnly fallback={<p>等待客户端挂载</p>}><p>客户端已挂载，可交互。</p><Button onClick={done}>计数 {count}</Button></ClientOnly>;break;
 case 'Toaster':body=<><Button onClick={()=>toast.success('示例操作已完成')}>显示消息提示</Button><Toaster/></>;break;
 case 'RouteErrorBoundary':body=<><p>此组件按设计不渲染可见错误界面。点击后会挂载隐藏错误标记并发送 Preview 消息。</p><Button onClick={done}>触发示例错误</Button>{count>0&&<RouteErrorBoundary error={new Error('Gallery sample error')} scope="gallery-example"/>}<p className="caption">触发次数：{count}。本页不是 Builder 错误卡片宿主。</p></>;break;
 case 'TemplatePreviewPlaceholder':body=<><p className="caption">原组件默认隐藏；开关只在本样例中开启展示。</p><Button onClick={()=>setOpen(!open)}>{open?'隐藏':'显示'}占位预览</Button>{open&&<div className="gallery-placeholder"><TemplatePreviewPlaceholder/></div>}</>;break;
 case 'ChatThread':case 'ChatMessage':body=<div className="flex h-[28rem] w-full max-w-xl flex-col overflow-hidden rounded-[4px] border border-border bg-card"><ChatThread><ChatMessage role="user" name="操作员" text="这条告警是什么意思"/><ChatMessage role="assistant" name="工艺助手" text={"**ALM-4412** 表示扭矩读数连续 3 拍超出上限。\n\n- 当前 **48.6 N·m**，上限 **42.0 N·m**\n- 本工位件需隔离"} citations={[{id:'sop',label:'SOP-扭矩校准',onOpen:()=>toast.success('已打开 SOP-扭矩校准')}]}/></ChatThread></div>;break;
 case 'ChatComposer':body=<ChatComposerDemo/>;break;
 case 'StreamText':body=<StreamTextDemo/>;break;
 case 'ChatPanel':body=<ChatPanelDemo/>;break;
 case 'ChatDock':body=<ChatDockDemo/>;break;
 case 'ChatLauncher':body=<ChatLauncherDemo/>;break;
 case 'ChatReasoning':body=<div className="w-full max-w-xl"><ChatReasoning durationMs={1400} steps={[{id:'s1',label:'对照 SOP-扭矩校准第 4 节'},{id:'s2',label:'核对 ALM-4412 触发条件'}]}>对照了 SOP-扭矩校准第 4 节与当前工位 ALM-4412 的触发条件。</ChatReasoning></div>;break;
 case 'ChatHistory':case 'ChatHistoryButton':case 'ChatHistorySelect':body=<ChatHistoryDemo/>;break;
 case 'ChatToolCall':case 'ChatToolGroup':body=<ChatToolDemo/>;break;
 case 'ChatMetricCard':case 'ChatMetricRow':body=<ChatMetricDemo/>;break;
 case 'ChatActionPanel':body=<ChatActionDemo/>;break;
 case 'ChatCodeBlock':body=<div className="w-full max-w-xl"><ChatCodeBlock filename="SOP-扭矩校准 · 复位" code={"1. 夹具打到空载\n2. 长按「传感器复位」至指示灯变绿\n3. 空载读数 0.0–0.4 N·m"} /></div>;break;
 case 'ChatStatus':case 'ChatRetrieval':body=<ChatStatusDemo/>;break;
 case 'ChatSpark':body=<div className="flex items-center gap-6"><span className="flex flex-col items-center gap-2 text-xs text-muted-foreground"><ChatSpark status="idle"/><span>待命</span></span><span className="flex flex-col items-center gap-2 text-xs text-muted-foreground"><ChatSpark status="thinking"/><span>检索</span></span><span className="flex flex-col items-center gap-2 text-xs text-muted-foreground"><ChatSpark status="writing"/><span>生成</span></span></div>;break;
 case 'ThinkingLoader':body=<div className="flex flex-col gap-3"><ThinkingLoader variant="plain"/><ThinkingLoader variant="pill" size="md"/></div>;break;
 default:body=<p>未配置样例：{name}</p>;
 }
 return <div className="sample-body space-y-4" data-sample={name}>{body}</div>;
}
