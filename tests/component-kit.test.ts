import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { ComponentKitProvider, useKitAdapter, useKitApi, type KitApi } from '../src/components/kit/provider';
import { createKitApi } from '../src/lib/component-kit/api-client';
import { validateFormSections, validateRows, sumColumn } from '../src/lib/component-kit/form-model';
import type { FieldDef, SectionDef } from '../src/lib/component-kit/types';
import { formatNumber, parseNumberText, isTypingNumber } from '../src/components/kit/ui/number-utils';
import { fileExtension, isPdfFile } from '../src/components/kit/ui/file-utils';
import { validateCodeRuleDraft } from '../src/components/editors/code-rules/code-rule-model';

const field: FieldDef = { code: 'name', name: '名称', type: 'TEXT', widget: {required: true} };
const sections: SectionDef[] = [{key:'base',label:'基本信息',type:'form',zone:'FORM_HEADER',items:[field]}];
test('form validation rejects required visible fields and accepts values', () => {
 assert.ok(validateFormSections(sections,{name:''},'create').name);
 assert.deepEqual(validateFormSections(sections,{name:'设备 A'},'create'),{});
});
test('editable rows retain row-level validation and numeric totals', () => {
 const rows=[{__key:'a',name:'',qty:2},{__key:'b',name:'B',qty:3}];
 assert.equal(validateRows([field],rows).length,1);
 assert.equal(sumColumn(rows,'qty'),5);
});
test('decimal typing and file extension parsing survive extraction', () => {
 assert.equal(formatNumber(1234.5,{thousandSeparator:true,precision:2,fixedDecimals:true}),'1,234.50');
 assert.equal(parseNumberText('.'),null);
 assert.equal(isTypingNumber('1.25',{precision:1}),false);
 assert.equal(fileExtension('报告.PDF'),'pdf');
 assert.equal(isPdfFile({name:'报告.PDF',url:'demo.pdf'}),true);
});
test('transport adapters are instance-scoped and preserve request payloads', async () => {
 const seen: unknown[]=[];
 const one=createKitApi(async r=>{seen.push(r);return 'one'});
 const two=createKitApi(async()=> 'two');
 const controller=new AbortController();
 assert.equal(await one.sendJson('/api/meta/query/example',{method:'POST',body:{page:2},signal:controller.signal}),'one');
 assert.equal(await two.getJson('/api/meta/config/example'),'two');
 assert.deepEqual(seen,[{path:'/api/meta/query/example',method:'POST',body:{page:2},signal:controller.signal}]);
});
test('aborted component requests never reach an adapter', async () => {
 let called=false;const api=createKitApi(async()=>{called=true;return null});
 const controller=new AbortController();controller.abort();
 await assert.rejects(api.getJson('/api/meta/config/example',{signal:controller.signal}),{name:'AbortError'});
 assert.equal(called,false);
});
test('provider permissions fail closed and SSR renders do not share adapters', async () => {
 const captured: KitApi[]=[];
 function Probe(){const api=useKitApi();const adapter=useKitAdapter();captured.push(api);return createElement('span',null,String(adapter.canObject?.('example','create')??false));}
 assert.equal(renderToString(createElement(Probe)),'<span>false</span>');
 for(const name of ['first','second']) renderToString(createElement(ComponentKitProvider,{adapter:{request:async()=>name,canObject:()=>true}},createElement(Probe)));
 assert.equal(await captured[1].getJson('/record'),'first');
 assert.equal(await captured[2].getJson('/record'),'second');
});
test('code-rule field validation uses supplied catalogs, independent of business objects', () => {
 const draft={code:'',name:'编号',businessType:'CUSTOM',remark:'',segments:[{key:'a',type:'BIZ_FIELD' as const,value:'serial',padMode:'NONE' as const,padChar:'0',length:6,visible:true}]};
 assert.ok(validateCodeRuleDraft(draft).rows);
 assert.equal(validateCodeRuleDraft(draft,{CUSTOM:[{key:'serial',label:'序列'}]}).rows,undefined);
});

test('required field titles render one trailing marker and preserve control validation', async () => {
 const { FieldGroup } = await import('../src/components/forms/form-layout');
 for (const tag of ['input', 'select', 'textarea']) {
  const props = {
   label: '设备名称', htmlFor: 'equipment', required: true,
   children: createElement(tag, { id: 'equipment', required: true }),
  };
  const html = renderToString(createElement(FieldGroup, props));
  assert.equal((html.match(/data-required-marker="true"/g) ?? []).length, 1);
  assert.match(html, /设备名称<\/span><span[^>]*>\*<\/span><\/label>/);
  assert.match(html, new RegExp(`<${tag}[^>]*required=""`));
  assert.ok(html.indexOf('</label>') < html.indexOf(`<${tag}`));
 }
 const optionalProps = { label: '备注', children: createElement('input') };
 const optional = renderToString(createElement(FieldGroup, optionalProps));
 assert.doesNotMatch(optional, /data-required-marker/);
});

test('metadata forms keep the required marker after the title in both layouts', async () => {
 const { MetaForm } = await import('../src/components/kit/meta/meta-form');
 for (const layout of ['vertical', 'horizontal'] as const) {
  const html = renderToString(createElement(MetaForm, {
   sections, value: {name: ''}, onChange: () => {}, layout,
  }));
  assert.equal((html.match(/data-required-marker="true"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /flex-row-reverse/);
  assert.ok(html.indexOf('名称') < html.indexOf('data-required-marker'));
 }
});

test('managed lifecycle fields are read-only and do not require client defaults', async () => {
 const {isFieldReadonly, defaultFieldValue}=await import('../src/lib/component-kit/form-model');
 for (const stateManagement of ['action','derived'] as const) {
  const status: FieldDef={code:'status',name:'状态',type:'SINGLE_SELECT',widget:{stateManagement,required:true,defaultValue:'approved'}};
  assert.equal(isFieldReadonly(status,'create'),true);
  assert.equal(isFieldReadonly(status,'edit'),true);
  assert.equal(defaultFieldValue(status),undefined);
  assert.deepEqual(validateFormSections([{...sections[0],items:[status]}],{},'create'),{});
 }
});

test('lifecycle actions enforce permissions, transitions, concurrency and transactional rollback', async () => {
 const {executeLifecycleAction}=await import('../src/lib/lifecycle/execute');
 const {assertNoManagedState}=await import('../src/lib/lifecycle');
 assert.throws(()=>assertNoManagedState({status:'approved'},['status']));
 assertNoManagedState({name:'A'},['status']);
 type State='draft'|'submitted';
 type Store={state:State;version:number;effects:number;audit:number};
 let store:Store={state:'draft',version:1,effects:0,audit:0};
 let permitted=true, valid=true, conflict=false, failEffect=false;
 const run=(actionId='submit',expectedVersion=1)=>executeLifecycleAction<State,Store,Store>({
  definition:{initial:'draft',actions:[{id:'submit',label:'提交',from:['draft'],to:'submitted',permission:'submit'}]},
  actionId,expectedVersion,
  transaction:async fn=>{const draft={...store};const result=await fn(draft);store=draft;return result;},
  load:async tx=>({...tx}),authorize:async()=>permitted,
  validate:async()=>{if(!valid)throw Error('invalid');},
  compareAndSet:async(tx,record,next)=>{if(conflict||tx.version!==record.version)return false;tx.state=next;tx.version++;return true;},
  apply:async tx=>{tx.effects++;if(failEffect)throw Error('failed');},
  audit:async tx=>{tx.audit++;},
 });
 await assert.rejects(run('approve')); permitted=false;await assert.rejects(run());permitted=true;
 valid=false;await assert.rejects(run());valid=true;
 conflict=true;await assert.rejects(run());conflict=false;
 failEffect=true;await assert.rejects(run());failEffect=false;
 assert.deepEqual(store,{state:'draft',version:1,effects:0,audit:0});
 await run(); await assert.rejects(run()); await assert.rejects(run('submit',2));
 assert.deepEqual(store,{state:'submitted',version:2,effects:1,audit:1});
});

test('MetaForm renders managed state as display even with a custom editable renderer', async () => {
 const {MetaForm}=await import('../src/components/kit/meta/meta-form');
 const status:FieldDef={code:'status',name:'状态',type:'SINGLE_SELECT',options:[{value:'draft',label:'草稿'}],widget:{stateManagement:'action'}};
 for(const mode of ['create','edit'] as const) {
  const html=renderToString(createElement(MetaForm,{
   sections:[{...sections[0],items:[status]}],value:{status:'draft'},mode,onChange:()=>{},
   renderField:()=>createElement('input',{'data-unsafe':'true'}),
  }));
  assert.match(html,/草稿/); assert.doesNotMatch(html,/data-unsafe|<select|role="combobox"/);
 }
});
