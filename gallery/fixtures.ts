import type {ComponentKitAdapter} from '@/components/kit/provider';
export const options=[{value:'a',label:'装配车间',color:'#050b14'},{value:'b',label:'质检车间',color:'#166534'},{value:'c',label:'包装车间',disabled:true}];
export const fields:any[]=[{code:'code',name:'记录编码',type:'TEXT',widget:{required:true},width:140},{code:'name',name:'记录名称',type:'TEXT',widget:{required:true},width:180},{code:'qty',name:'计划数量',type:'NUMBER',widget:{minValue:0},width:140},{code:'status',name:'生产状态',type:'SINGLE_SELECT',options:[{value:'a',label:'执行中',color:'#050b14'},{value:'b',label:'已完成',color:'#166534'}],widget:{},width:140}];
export const rows:any[]=[{id:'demo-1',__key:'1',code:'ITEM-1001',name:'示例项目 A',qty:120,status:'a',type:'0',jobNumber:3},{id:'demo-2',__key:'2',code:'ITEM-1002',name:'示例项目 B',qty:80,status:'b',type:'0',jobNumber:2},{id:'demo-3',__key:'3',code:'ITEM-1003',name:'示例项目 C',qty:200,status:'a',type:'0',jobNumber:1}];
export const sections:any[]=[{key:'base',label:'基本信息',type:'form',zone:'FORM_HEADER',items:fields}];
export const views:any[]=[{code:'all',objectCode:'product',name:'全部记录',icon:'blue',builtIn:true,groupingField:null,rowHeight:'MID',scope:{all:true},visibleFields:null,columns:{},filters:[],sorts:[],sortOrder:0},{code:'mine',objectCode:'product',name:'我的关注',icon:'green',builtIn:false,groupingField:null,rowHeight:'MID',scope:{mine:true},visibleFields:null,columns:{},filters:[],sorts:[],sortOrder:1}];
export function config(code='product'){const o:any=undefined;return{objectCode:code,objectName:o?.name||'记录',module:o?.module||'baseline',primaryField:o?.primaryField||'code',statusField:o?.statusField,capabilities:o?.capabilities||{},searchConditions:o?.searchConditions||fields,listColumns:o?.listColumns||fields,formSections:o?.formSections||sections,views,activeView:views[0],prefs:{columns:{},sorts:[],rowHeight:'MID',pageSize:10},groupingField:null};}
export function records(code='product'){const c=config(code);return rows.map((r,i)=>{const v:any={...r};for(const f of [...c.listColumns,...c.formSections.flatMap((s:any)=>s.items)]){if(v[f.code]!=null)continue;v[f.code]=f.type==='NUMBER'?10+i*5:f.type==='DATETIME'?'2026-09-18T08:30:00Z':f.type==='SINGLE_SELECT'?f.options?.[0]?.value??'1':f.type==='MULTI_SELECT'?[]:f.type==='RELATION_OBJECT'?{id:'demo-1',name:f.reference?.objectCode==='person'?'张明':'标准件 A',code:'REF-001'}:['IMAGE','ATTACHMENT','RELATION_REFERENCE'].includes(f.type)?[]:f.name+'示例';}for(const s of c.formSections)if(s.type==='table')v[s.key]=[];return v;});}
export const org:any={company:{id:'co1',name:'示例制造有限公司',personCount:12},companyName:'示例制造有限公司',departments:[{id:'d1',name:'制造中心',code:'DEP-01',parentId:null,personCount:12,children:[{id:'d2',name:'装配车间',code:'DEP-02',parentId:'d1',personCount:8,children:[]}]}],positions:[{id:'p1',name:'生产主管',code:'POS-01'}]};
export const persons=[{id:'u1',name:'张明',code:'EMP-001',departmentId:'d2',departmentName:'装配车间',enabled:true},{id:'u2',name:'李晨',code:'EMP-002',departmentId:'d2',departmentName:'装配车间',enabled:true}];
export const imageUrl='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><rect width="480" height="300" fill="#e8f1fc"/><rect x="90" y="60" width="300" height="180" rx="20" fill="#9bb9dc"/><circle cx="240" cy="150" r="60" fill="#496f9c"/><circle cx="240" cy="150" r="32" fill="#dfefff"/><text x="30" y="275" font-family="sans-serif" fill="#345">ITEM-1001 / DEMO</text></svg>');
export const images=[{uid:'img1',name:'支架样品.svg',type:'image/svg+xml',size:2048,url:imageUrl}];

// Preview-only data adapter. Production components never install mocks or fetch fixed routes.
export const adapter: ComponentKitAdapter = {
 canObject: () => true,
 printableObjects: [{value:'product',label:'示例记录'}],
 codeRuleTypes: [{value:'RECORD',label:'记录编号'}],
 codeRuleProperties: {RECORD:[{key:'code',label:'记录编码'}]},
 request: async ({path,method,body,signal}) => {
 signal?.throwIfAborted();
 const p=new URL(path,'http://preview.invalid').pathname;
 if(p.includes('/mobile-cards/')) {const key=p.split('/')[4];return p.endsWith('/options')?{key,objectCode:'product',fields,components:[{key:'progress',label:'进度'}],lockedFields:[],statusFields:['status']}:{key,moduleName:'记录卡片',itemName:'列表',titleFields:['name'],indicatorField:'qty',displayFields:['code','qty'],components:[],...(body as object)}};
 if(p.includes('/meta/import-template/')) return {objectCode:'product',objectName:'记录',fileName:'记录模板.xlsx',columns:fields.map(f=>({code:f.code,name:f.name,type:f.type,required:!!f.widget?.required,tip:null,options:f.options?.map((o:any)=>o.label)}))};
 if(p.includes('/meta/export/')) return {logId:'demo-export',fileName:'记录.xlsx',columns:fields,rows:rows.map(r=>fields.map(f=>String(r[f.code]??'')))};
 if(p.includes('/meta/import/')) {const imported=(body as any)?.rows??[];return {logId:'demo-import',total:imported.length,succeeded:imported.length,failed:0,rows:imported.map((_:unknown,i:number)=>({row:i+1,ok:true}))}};
 if(p.includes('/meta/config/')) return config(p.split('/').pop());
 if(p.includes('/meta/query/')) return {list:records(),total:3,page:{current:1,pageSize:10},groups:[],summary:{qty:400}};
 if(p.includes('/reference-options/')) return {list:rows.map(r=>({id:r.id,name:r.name,code:r.code,label:r.name,value:r.id}))};
 if(p.includes('/reference-tree/')) return fields.map(f=>({key:f.code,label:f.name,value:f.code,children:[]}));
 if(p.includes('/meta/view-options/')) return {objectCode:'product',objectName:'记录',fields,columnCandidates:fields,filterCandidates:fields,sortCandidates:fields,groupCandidates:fields};
 if(p.includes('/meta/views/')) return method==='GET'?views:{...views[1],...(body as object)};
 if(p.includes('/org/tree')) return org;
 if(p.includes('/org/persons')) return {list:persons};
 if(p.includes('/print-template-options/')) return {objectCode:'product',headerFields:fields,detailSections:[]};
 if(p.endsWith('/print-templates')) return [{id:'p1',name:'记录卡',objectCode:'product',layout:'CARD',headerFields:[],detailFields:[],showQrCode:false}];
 if(p.endsWith('/print/render')) return {pages:[{title:'记录卡',header:[{label:'记录名称',value:'示例项目 A'}],detail:null,layout:'CARD'}]};
 if(p.endsWith('/code-rule-options')) return {documentTypes:{RECORD:{objectCode:'product',fallback:'ITEM'}}};
 if(p.includes('/excel-logs')) return {list:[],total:0,page:{current:1,pageSize:10}};
 if(p.includes('/meta/prefs/')) return {...config().prefs,...(body as object)};
 if(p.includes('/active-view/')) return {};
 throw new Error('样例未配置此数据操作：'+method+' '+p);
 }
};
