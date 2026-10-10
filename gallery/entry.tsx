import { ComponentKitProvider } from '@/components/kit/provider';
import { adapter } from './fixtures';
import {createRootRoute,createRouter,createMemoryHistory,RouterProvider} from '@tanstack/react-router';import {emptyDraft} from '@/components/editors/custom-fields/field-type-meta';
import React,{useState,useRef}from'react';import{createRoot}from'react-dom/client';import{Plus,Settings,Check,Package,Search,Download}from'lucide-react';import{registry}from'./registry';import{Sample}from'./samples';import{options,fields,rows,sections,views,org,persons,images,config,records}from'./fixtures';import{columnStatesFrom}from'@/lib/component-kit/list-columns';import{Button}from'@/components/ui/button';import{Toaster}from'@/components/toaster';import'./preview.css';
const sample=new URLSearchParams(location.search).get('sample')||'Input';const variants=new Set(["Shell", "ImpactPreviewDialog", "RecommendationAction", "ClientOnly", "AsyncView", "DataTable", "TableViewport", "TableCellText", "TableStatusCell", "RequiredMark", "FieldLabel", "FileUpload", "FieldGroup", "FormGrid", "LineItemSection", "RecordSelect", "MonitorLayout", "ReviewLayout", "StationLayout", "ConfirmDialog", "Dialog", "DialogActions", "Drawer", "FormDialog", "OverlayPortal", "OverlayHeader", "OverlayFooter", "OverlayActionButton", "Toaster", "Button", "Card", "EmptyState", "StatusFilterChips", "PageHeader", "RiskBanner", "StatCard", "StatusBadge"]);
class Boundary extends React.Component<any,any>{state={e:null};static getDerivedStateFromError(e:any){return{e}}componentDidCatch(e:any){(window as any).__demoError=String(e);parent.postMessage({type:'sample-error',name:sample,error:String(e)},'*')}render(){return this.state.e?<div className="demo-error">此样例仍需适配，请重置样例重试。<br/>{String(this.state.e)}</div>:this.props.children}}
function SegmentedDemo(){
 const [selected,setSelected]=useState<string | number>('a');
 const [changes,setChanges]=useState(0);
 const [locked,setLocked]=useState(false);
 return <><registry.Segmented aria-label="车间筛选" options={options} value={selected} disabled={locked} onChange={(v:string | number)=>{setSelected(v);setChanges(n=>n+1)}}/>
 <p role="status">当前：{selected==='a'?'装配车间 · 待处理 12 项':'质检车间 · 待处理 4 项'} · 已切换 {changes} 次</p>
 <div className="demo-row"><Button variant="outline" onClick={()=>setLocked(v=>!v)}>{locked?'启用控件':'禁用控件'}</Button><Button variant="outline" onClick={()=>setSelected('a')}>外部重置选中项</Button></div>
 <p className="caption">左右方向键切换，Home / End 跳转首尾；自动跳过禁用项。</p></>;
}
function FormDemo(){
 const [value,setValue]=useState<Record<string,unknown>>({...rows[0]});
 const [saved,setSaved]=useState(false);
 const formRef=useRef<import('@/components/kit/meta/meta-form').MetaFormHandle>(null);
 return <form onSubmit={e=>{e.preventDefault();setSaved(!!formRef.current?.validate());}}>
   <registry.MetaForm sections={sections} value={value} onChange={(v:Record<string,unknown>)=>{setValue(v);setSaved(false)}} formRef={formRef}/>
   <div className="demo-row" style={{marginTop:20}}><Button type="submit">保存示例</Button><Button type="button" variant="outline" onClick={()=>{setValue({});setSaved(false);formRef.current?.resetErrors()}}>清空表单</Button></div>
   {saved&&<p role="status">示例已保存（当前预览内）。</p>}
 </form>;
}
function Demo({name}:{name:string}){const [v,S]=useState<any>('a'),[value,V]=useState<any>(rows[0]),[list,L]=useState<any[]>(rows),[open,O]=useState(true),[checked,C]=useState(true),[many,M]=useState<any[]>(['a']),[states,CS]=useState<any[]>(columnStatesFrom(fields)),[filters,F]=useState<any[]>([{field:'name',operator:'LIKE',value:'支架'}]),[sorts,SS]=useState<any[]>([{field:'code',direction:'ASC'}]),[msg,MSG]=useState(''),[wall,W]=useState({year:2026,month:9,day:18,hour:9,minute:30,second:0});const ref=useRef<HTMLDivElement>(null),floatRef=useRef<HTMLDivElement>(null);const hit=()=>MSG('已操作 · 仅演示');const done=async()=>{hit();};const Comp=registry[name];const form=<registry.MetaForm sections={sections} value={value} onChange={V}/>;const common:any={open,onOpenChange:O,onClose:()=>O(false),onCancel:()=>O(false),onSubmit:done,onSave:done,onSaved:hit,onCreated:hit,onConfirm:hit,onChange:S,onClick:hit,title:'示例：物料与生产',objectCode:'product',objectName:'物料',mode:'create',value:v,items:[],rows:list,fields,record:rows[0],row:rows[0],canManage:true,disabled:false};const field=(i=0)=><registry.FieldControl field={fields[i]} value={value[fields[i].code]} onChange={(x:any)=>V({...value,[fields[i].code]:x})}/>;let body:any;
if(variants.has(name))return <Sample name={name}/>;
switch(name){
case'Input':body=<><Comp placeholder="请输入物料名称" allowClear prefix={<Search size={16}/>}/><Comp defaultValue="MAT-1001" status="error"/><Comp value="禁用状态" disabled/></>;break;
case'TextArea':body=<Comp placeholder="填写生产备注" maxLength={200} showCount autoSize/>;break;
case'NumberInput':body=<><Comp defaultValue={1250.5} thousandSeparator precision={2} suffix="元"/><Comp defaultValue={10} min={0} max={100} step={5}/></>;break;
case'NumberRangeInput':body=<Comp defaultValue={[10,100]}/>;break;
case'Select':body=<><Comp options={options} defaultValue="a" allowClear showSearch/><Comp multiple options={options} defaultValue={['a','b']}/></>;break;
case'Checkbox':body=<><Comp checked={checked} onChange={C}>启用质量检查</Comp><Comp indeterminate>部分选中</Comp><Comp disabled checked>禁用</Comp></>;break;
case'CheckboxIndicator':body=<div className="demo-row"><Comp checked/><Comp indeterminate/><Comp checked={false}/></div>;break;
case'Segmented':body=<SegmentedDemo/>;break;
case'CheckboxGroup':case'RadioGroup':body=<Comp options={options} defaultValue={name==='CheckboxGroup'?['a']:'a'}/>;break;
case'Switch':body=<div className="demo-row"><Comp checked={checked} onChange={C} checkedChildren="开" unCheckedChildren="关"/><Comp disabled/><Comp loading/></div>;break;
case'DatePicker':body=<><Comp defaultValue="2026-09-18"/><Comp precision="DATETIME_SECOND" defaultValue="2026-09-18 09:30:00"/></>;break;
case'DateRangePicker':body=<Comp defaultValue={['2026-09-18','2026-09-25']}/>;break;
case'CalendarPanel':body=<Comp viewYear={wall.year} viewMonth={wall.month} onViewChange={(year:number,month:number)=>W({...wall,year,month})} today={wall} selected={wall} onPick={W}/>;break;
case'TimeColumns':body=<Comp value={wall} onChange={W} withSeconds/>;break;
case'IconButton':body=<div className="demo-row"><Comp icon={<Plus/>} label="新增" onClick={hit}/><Comp icon={<Settings/>} label="设置" variant="outline"/><Comp icon={<Plus/>} label="禁用" disabled/></div>;break;
case'TextButton':body=<div className="demo-row"><Comp icon={<Plus/>} onClick={hit}>新增物料</Comp><Comp tone="danger">删除</Comp><Comp disabled>不可编辑</Comp></div>;break;
case'SplitButton':body=<Comp icon={<Download/>} variant="primary" onClick={hit} menuItems={[{key:'all',label:'导出全部',onClick:hit},{key:'selected',label:'导出已选',onClick:hit}]}>导出</Comp>;break;
case'Tag':case'StatusTag':body=<div className="demo-row">{['default','processing','success','warning','error'].map((tone,i)=><Comp key={tone} tone={tone} dot closable={name==='Tag'}>{['草稿','执行中','已完成','待审核','异常'][i]}</Comp>)}</div>;break;
case'ColorDotLabel':body=<div className="demo-row"><Comp color="#050b14">装配车间</Comp><Comp color="#166534">质检车间</Comp></div>;break;
case'Avatar':body=<div className="demo-row"><Comp name="张明"/><Comp name="李晨" size="lg"/><Comp name="王珊" shape="square"/></div>;break;
case'Badge':body=<div className="demo-row"><Comp count={12}><registry.Avatar name="张明"/></Comp><Comp dot><Button>消息</Button></Comp></div>;break;
case'HighlightText':body=<Comp text="精密铝合金支架 · 支架成品" keyword="支架"/>;break;
case'EllipsisText':body=<div style={{width:230}}><Comp>这是一个很长的物料名称，鼠标悬停后可以查看完整内容。</Comp></div>;break;
case'FieldTypeIcon':body=<div className="demo-row">{['TEXT','NUMBER','DATETIME','SINGLE_SELECT','IMAGE'].map(kind=><Comp key={kind} type={kind} kind={kind}/>)}</div>;break;
case'Empty':body=<Comp description="暂无物料记录"><Button onClick={hit}>创建物料</Button></Comp>;break;
case'Spin':body=<Comp tip="正在加载"/>;break;
case'Skeleton':body=<Comp rows={3} avatar/>;break;
case'TableSkeleton':body=<Comp rows={4} columns={4}/>;break;
case'ProgressBar':body=<><Comp percent={68}/><Comp percent={100} status="success"/><Comp percent={35} status="exception"/></>;break;
case'ProgressRing':body=<div className="demo-row"><Comp percent={68}/><Comp percent={100} status="success"/></div>;break;
case'Popover':body=<Comp content={<div className="p-4">查看、编辑或停用当前物料。<Button onClick={hit}>编辑</Button></div>}><Button>点击打开气泡</Button></Comp>;break;
case'DropdownMenu':body=<Comp items={[{key:'edit',label:'编辑物料',onClick:hit},{key:'copy',label:'复制物料',onClick:hit},{key:'delete',label:'删除',danger:true,onClick:hit}]}><Button>操作菜单</Button></Comp>;break;
case'Tooltip':body=<Comp title="保存后对所有新工单生效"><Button>悬停查看说明</Button></Comp>;break;
case'FloatingLayer':body=<><Button onClick={()=>O(!open)}>开关浮层</Button><Comp open={open} layerId="demo-layer" floatingRef={floatRef} placement="bottom-start" style={{position:'absolute',top:90,left:28}}><div className="rounded-md border bg-white p-4 shadow-lg">浮层内容</div></Comp></>;break;
case'Tabs':body=<Comp items={[{key:'a',label:'基本信息',children:'物料 MAT-1001 · 精密铝合金支架'},{key:'b',label:'生产记录',children:'本月完成 120 件'},{key:'c',label:'操作日志',children:'张明创建了当前记录'}]}/>;break;
case'CapsuleGroup':body=<Comp items={[{key:'a',label:'全部',count:32},{key:'b',label:'执行中',count:12},{key:'c',label:'已完成',count:20}]}/>;break;
case'AnchorTabs':body=<div ref={ref} style={{maxHeight:320,overflow:'auto'}}><Comp containerRef={ref} items={[{key:'base',label:'基本信息'},{key:'detail',label:'明细信息'}]}/><div data-anchor-key="base" style={{height:200}}>基本信息{form}</div><div data-anchor-key="detail" style={{height:220}}>明细信息</div></div>;break;
case'Pagination':body=<Comp total={126} current={Number(v)||1} pageSize={10} onChange={S}/>;break;
case'CollapseSection':body=<Comp title="基本信息" defaultOpen>{form}</Comp>;break;
case'TreeList':body=<Comp searchable checkable defaultExpandAll nodes={[{key:'a',title:'制造中心',count:12,children:[{key:'b',title:'装配车间',count:8},{key:'c',title:'质检车间',count:4}]}]}/>;break;
case'DataGrid':body=<Comp columns={fields.map(f=>({key:f.code,title:f.name,width:f.width,render:f.type==='SINGLE_SELECT'?(r:any)=><registry.StatusTag tone={r.status==='a'?'processing':'success'}>{r.status==='a'?'执行中':'已完成'}</registry.StatusTag>:undefined}))} rows={list} rowKey={(r:any)=>r.id} selection={{mode:'multiple',selectedKeys:many,onChange:M}} showIndex summary={{name:'合计',qty:400}}/>;break;
case'ImageUpload':case'AttachmentUpload':body=<Comp defaultValue={images} value={Array.isArray(v)?v:images} onChange={S}/>;break;
case'ImageThumbs':body=<Comp value={images} size={100}/>;break;
case'ImagePreview':body=<><Button onClick={()=>O(true)}>打开图片预览</Button><Comp images={images} index={open?0:null} onIndexChange={(x:any)=>O(x!==null)}/></>;break;
case'FilePreview':body=<><Button onClick={()=>O(true)}>打开文件预览</Button><Comp file={open?{uid:'doc',name:'生产说明.txt',type:'text/plain',url:'data:text/plain,Sample',size:128}:null} onClose={()=>O(false)}/></>;break;
case'MetaForm':body=<FormDemo/>;break;
case'FieldControl':body=<>{fields.map((f,i)=><label key={f.code}>{f.name}{field(i)}</label>)}</>;break;
case'FieldValue':body=<div className="demo-row">{fields.map(f=><div key={f.code}><p className="caption">{f.name}</p><Comp field={f} value={rows[0][f.code]}/></div>)}</div>;break;
case'DetailTable':body=<Comp items={fields} rows={list} onChange={L} summaryFields={['qty']} maxHeight={420}/>;break;
case'SearchPanel':body=<Comp conditions={fields} values={value} onValueChange={(k:any,x:any)=>V({...value,[k]:x})} expanded={checked} onExpandedChange={C} onSearch={hit} onReset={()=>V({})}/>;break;
case'SearchFieldControl':body=<Comp field={fields[0]} value={v} onChange={S}/>;break;
case'FieldConfigPopover':case'ColumnConfigList':body=<Comp states={states} onChange={CS}/>;break;
case'SortPopover':case'SortConditionList':body=<Comp fields={fields} value={sorts} onChange={SS}/>;break;
case'FilterConditionList':body=<Comp fields={fields} value={filters} onChange={F}/>;break;
case'FilterValueEditor':body=<Comp field={fields[0]} operator="LIKE" value={v} onChange={S}/>;break;
case'RowHeightMenu':body=<Comp value={['LOW','MID','HIGH'].includes(v)?v:'MID'} onChange={S}/>;break;
case'RowActions':body=<Comp actions={[{key:'edit',label:'编辑',onClick:hit},{key:'print',label:'打印',onClick:hit},{key:'delete',label:'删除',danger:true,onClick:hit}]}/>;break;
case'ViewTabs':body=<Comp views={views} activeCode={v==='a'?'all':v} onSwitch={S} onEdit={hit} onCopy={hit} onDelete={hit} onOpenList={hit} manageable/>;break;
case'ViewIcon':body=<div className="demo-row">{['dark','blue','green','orange','red'].map(icon=><Comp key={icon} icon={icon}/>)}</div>;break;
case'ViewScopeSelect':body=<Comp value={typeof v==='object'?v:{all:true}} onChange={S}/>;break;
case'ViewListDrawer':body=<Comp {...common} activeCode="all" onCreate={hit} onEdit={hit} onCopy={hit} onDelete={hit} onChanged={hit}/>;break;
case'ViewEditorDrawer':body=<Comp {...common} viewCode={null}/>;break;
case'FormDrawer':case'FullscreenModal':body=<><Button onClick={()=>O(true)}>打开表单</Button><Comp {...common} anchors={[{key:'base',label:'基本信息'}]} footer={<Button onClick={done}>保存演示</Button>}>{form}</Comp></>;break;
case'MetaListPage':body=<Comp objectCode="product" title="物料档案" onCreate={hit} onOpenRecord={hit} importable exportable rowActions={()=>[{key:'edit',label:'编辑',onClick:hit}]} />;break;
case'ReferenceInput':case'PersonInput':case'ReferenceSelect':body=<Comp {...common} value={typeof v==='object'?v:{id:'demo-1',name:'精密铝合金支架',code:'MAT-1001'}}/>;break;
case'ReferencePicker':case'PersonPicker':body=<Comp {...common} value={null} multiple/>;break;
case'ImportDialog':body=<Comp {...common}/>;break;
case'ExportDialog':body=<Comp {...common} request={{page:{current:1,pageSize:10}}} fieldCodes={fields.map(f=>f.code)} total={126} selectedIds={['demo-1']}/>;break;
case'ExcelLogModal':body=<Comp {...common} type="IMPORT"/>;break;
case'PrintDialog':body=<Comp {...common} ids={['demo-1']}/>;break;
case'MobileCard':body=<Comp config={{titleFields:['code','name'],indicatorField:'qty',displayFields:['status'],components:[]}} fields={fields} record={rows[0]} actions={<Button onClick={hit}>查看详情</Button>}/>;break;
case'MobileCardConfigDialog':body=<Comp {...common} cardKey="report"/>;break;
case'SessionExpiredDialog':body=<><Button onClick={()=>window.dispatchEvent(new CustomEvent('lingo:session-expired'))}>显示会话过期提示</Button><Comp/></>;break;
case'PageContainer':case'PageCard':case'ResponsivePage':case'WorkbenchLayout':case'PageToolbar':body=<Comp title="物料档案"><Button>新增物料</Button>{form}</Comp>;break;
case'PageHeaderLink':body=<Comp to="/" onClick={(e:any)=>{e.preventDefault();hit()}}>返回物料档案</Comp>;break;

case'RouteError':body=<Comp error={new Error('示例加载错误')} reset={hit}/>;break;
default:body=<Business name={name} common={common} value={value} V={V} list={list} L={L} hit={hit}/>;
}
return <><div className="sample-body"><div className="demo-stack">{body}</div>{msg&&<p className="demo-status">{msg}</p>}</div><Toaster/></>;
}

const tasks=[{id:'t1',processName:'下料',progress:100,processStatus:2,planQty:120,goodQty:120,defectQty:0,unfinishedQty:0,workOrderCode:'WO-001',lastReportTime:'2026-09-18T08:00:00Z'},{id:'t2',processName:'装配',progress:68,processStatus:1,planQty:120,goodQty:82,defectQty:2,unfinishedQty:38,workOrderCode:'WO-001',lastReportTime:'2026-09-18T09:00:00Z'}];
const board={generatedAt:'2026-09-18T09:00:00Z',today:'2026-09-18',kpis:{wipWorkOrderPlanQty:1200,wipWorkOrderCount:24,wipTaskCount:48,wipTaskPlanQty:2800,overdueWorkOrderCount:2,overdueTaskCount:4,todayFinishedWorkOrderCount:6,todayFinishedTaskCount:18,todayOutputQty:860,todayGoodQty:860,todayDefectQty:12,todayDefectRate:1.38},outputTrend:[1,2,3,4,5,6,7].map((i)=>({date:'2026-09-'+(11+i),label:'09-'+(11+i),finishedWorkOrders:i+2,outputQty:90+i*25})),defectTrend:[1,2,3,4,5,6,7].map(i=>({date:'2026-09-'+(11+i),label:'09-'+(11+i),defectQty:10+i,goodQty:100+i*20,defectRate:2+i/10})),personRanking:[{personId:'u1',name:'张明',qty:360},{personId:'u2',name:'李晨',qty:280}],todayReports:[{id:'r1',time:'2026-09-18T09:00:00Z',personName:'张明',workOrderCode:'WO-001',processName:'装配',goodQty:80,defectQty:2,approveStatus:1}],defectDistribution:[{id:'d1',name:'尺寸偏差',qty:8,ratio:66.7},{id:'d2',name:'表面划痕',qty:4,ratio:33.3}],defectDistributionTotal:12,workOrders:[{id:'w1',code:'WO-001',status:1,tasks,productCode:'MAT-1001',productName:'精密铝合金支架',productSpec:'A-10',planQty:120,realityQty:82,completionRate:68,progress:84,overdue:false}],taskProgress:tasks};

function Business({name,common,value,V,list,L,hit}:any){const Comp=registry[name];const [selected,S]=useState<any>([]);const p:any={...common,rows:list,items:list,data:list,options:[],value:selected,onChange:S,persons:[],processes:[],groups:[],fields,columns:fields.map(f=>({key:f.code,title:f.name,width:f.width})),candidates:{routes:[],processes:[]},initialValues:rows[0],target:{mode:'create',id:null},recordId:null,ruleId:null,templateId:null,viewCode:null,onReorder:async()=>{},onCreate:hit,onEdit:hit,onDelete:hit,onViewPersons:hit,onPick:hit,onPatch:(patch:any)=>V({...value,...patch}),row:value,tree:org,canCreate:true,canEdit:true,canDelete:true,save:async(v:any)=>({...v,id:'demo'}),onScopeChange:S,onPersonsChange:S,onCheckedChange:S,scope:'ALL',checked:true,readonly:false};
switch(name){



case'CustomFieldForm':p.initial={...emptyDraft(),name:'检验等级'};break;








case'ExpressionEditorDialog':p.value='数量 > 100';p.known=new Set(['数量']);p.groups=[{key:'fields',label:'对象字段',variables:[{label:'数量',value:'数量'},{label:'物料名称',value:'物料名称'}]}];break;
case'VariablePicker':p.groups=[{key:'fields',label:'对象字段',variables:[{label:'物料名称',value:'name'},{label:'计划数量',value:'qty'}]}];break;
case'OptionListEditor':p.type='SINGLE_SELECT';p.options=selected.length?selected:[{key:'1',value:'1',label:'普通',color:'#050b14',isDefault:true},{key:'2',value:'2',label:'加急',color:'#b91c1c'}];break;
case'CustomFieldTable':p.objectLabel='物料';p.limit=80;p.fields=[{objectCode:'product',fieldCode:'custom1',name:'检验等级',type:'TEXT',widget:{required:true},sortOrder:0,createdByName:'张明',createdAt:'2026-09-18T09:00:00Z'}];break;

case'ReferenceCascader':p.nodes=[{code:'product',name:'物料',label:'物料',children:[{code:'name',name:'物料名称',label:'物料名称',children:[]}]}];break;
case'FieldOrderPicker':p.candidates=fields.map(f=>({code:f.code,name:f.name}));p.value=selected;p.label='选择打印字段';break;
case'PrintTemplatePreview':p.name='标准物料卡';p.layout='CARD';p.showQrCode=true;p.headerFields=fields.slice(0,2).map(f=>({code:f.code,name:f.name}));p.detailFields=fields.map(f=>({code:f.code,name:f.name}));break;















case'DualAxisChart':p.points=[{key:'1',label:'周一',bar:80,line:2},{key:'2',label:'周二',bar:120,line:1},{key:'3',label:'周三',bar:98,line:3},{key:'4',label:'周四',bar:140,line:2},{key:'5',label:'周五',bar:160,line:1}];p.bar={name:'产量',unit:'件',color:'#050b14',format:String};p.line={name:'不良率',unit:'%',color:'#f59e0b',format:String};return <div style={{height:340}}><Comp {...p}/></div>;

case'ProgressRingChain':p.items=[{id:'1',name:'下料',percent:100},{id:'2',name:'装配',percent:68},{id:'3',name:'检验',percent:30}];p.tasks=p.items.map((x:any)=>({...x,processName:x.name,progress:x.percent}));p.ringSize=64;p.availableWidth=600;break;

}
return <Comp {...p}/>;
}
const route=createRootRoute({component:()=> <ComponentKitProvider adapter={adapter}><Boundary><Demo name={sample}/></Boundary></ComponentKitProvider>});const router=createRouter({routeTree:route,history:createMemoryHistory({initialEntries:['/']})});createRoot(document.getElementById('root')!).render(<RouterProvider router={router}/>);
