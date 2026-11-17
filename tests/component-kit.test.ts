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
import { Avatar } from '../src/components/kit/ui/avatar';

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

test('route error components render unknown failures without throwing', async () => {
 const { RouteErrorBoundary } = await import('../src/components/ui/route-error-boundary');
 const { RouteError } = await import('../src/components/ui/route-error');
 for (const [error, expected] of [
  [new Error('Request failed'), 'Request failed'],
  ['Network unavailable', 'Network unavailable'],
  [null, 'orders failed to load'],
  [undefined, 'orders failed to load'],
  [{message: 42}, 'orders failed to load'],
  [new Error(''), 'orders failed to load'],
 ] as const) {
  const hidden = renderToString(createElement(RouteErrorBoundary, {error, scope: 'orders'}));
  assert.match(hidden, /data-route-error="orders" hidden=""/);
  assert.ok(hidden.includes(expected));
  const visible = renderToString(createElement(RouteError, {error, title: 'orders failed to load'}));
  assert.ok(visible.includes(expected));
 }
});

test('StatCard keeps numeric precision on first render and after a live update', async () => {
  const { StatCard } = await import('../src/components/ui/stat-card');
  const { formatAnimatedNumber, fractionDigitsOf } = await import('../src/components/ui/animated-number');
  for (const [value, text] of [[0.04, '0.04'], [1.25, '1.25'], [99.99, '99.99'], [12, '12'], [0.000123, '0.000123']] as const) {
    assert.match(renderToString(createElement(StatCard, { label: 'metric', value })), new RegExp(`>${text.replace('.', '\\.')}<`));
  }
  assert.equal(fractionDigitsOf(1.5e-7), 8);
  // Landing frame of a roll (exact target) and a mid-roll frame both keep the business precision.
  assert.equal(formatAnimatedNumber(99.99, [0.04, 99.99], undefined, 'en-US'), '99.99');
  assert.equal(formatAnimatedNumber(0.04, [99.99, 0.04], undefined, 'en-US'), '0.04');
  assert.equal(formatAnimatedNumber(1.2, [1, 1.25], undefined, 'en-US'), '1.2');
  assert.equal(formatAnimatedNumber(1.2468, [1, 1.25], undefined, 'en-US'), '1.25');
  // Explicit format stays the caller's rule, including a minimum above the inferred precision.
  assert.equal(formatAnimatedNumber(87.46, [87.46], { maximumFractionDigits: 1 }, 'en-US'), '87.5');
  assert.equal(formatAnimatedNumber(3, [3], { minimumFractionDigits: 2 }, 'en-US'), '3.00');
  assert.match(renderToString(createElement(StatCard, { label: 'ratio', value: 0.256, format: { style: 'percent', maximumFractionDigits: 1 } })), />25\.6%</);
});

test('keyword search fuzzy-matches any business-configured field', async () => {
  const { matchesKeyword, filterListRows } = await import('../src/lib/component-kit/list-search');
  type Queue = { code: string; name: string; spec: string; lines: { item: string }[] };
  const rows: Queue[] = [
    { code: 'Q-ALPHA-01', name: '装配队列', spec: 'M8 螺栓', lines: [{ item: '扭矩扳手' }] },
    { code: 'Q-BETA-02', name: '质检队列', spec: 'Φ12 轴承', lines: [] },
  ];
  const fields = [
    { key: 'code', label: '编码' },
    { key: 'name', label: '名称' },
    { key: 'spec', label: '规格' },
    { key: 'lines', label: '物料', value: (row: Queue) => row.lines.map((line) => line.item) },
  ];
  const codes = (keyword: string, scope = fields) => filterListRows(rows, { keyword, keywordFields: scope }).map((row) => row.code);
  assert.deepEqual(codes('alpha'), ['Q-ALPHA-01'], 'code, case-insensitive');
  assert.deepEqual(codes('质检'), ['Q-BETA-02'], 'name');
  assert.deepEqual(codes('m8'), ['Q-ALPHA-01'], 'spec');
  assert.deepEqual(codes('扳手'), ['Q-ALPHA-01'], 'custom reader over child rows');
  assert.deepEqual(codes('队列'), ['Q-ALPHA-01', 'Q-BETA-02'], 'any field may match');
  assert.deepEqual(codes('不存在'), [], 'no result');
  assert.deepEqual(codes('  '), ['Q-ALPHA-01', 'Q-BETA-02'], 'cleared keyword restores the list');
  assert.deepEqual(codes('m8', fields.slice(0, 2)), [], 'scope is what the business configures');
  assert.equal(matchesKeyword({ owner: { id: 'u1', name: '张明', code: 'EMP-001' } }, 'emp-001', [{ key: 'owner', label: '负责人' }]), true);
});

test('advanced filter combines filled conditions with AND and ignores empty ones', async () => {
  const { filterListRows, describeCondition } = await import('../src/lib/component-kit/list-search');
  const conditions: FieldDef[] = [
    { code: 'code', name: '编码', type: 'TEXT', widget: {} },
    { code: 'name', name: '名称', type: 'TEXT', widget: {} },
    { code: 'status', name: '状态', type: 'SINGLE_SELECT', widget: {}, options: [{ value: 'run', label: '执行中' }, { value: 'done', label: '已完成' }] },
    { code: 'due', name: '计划日期', type: 'DATETIME', widget: {} },
  ];
  const rows = [
    { code: 'WO-001', name: '装配复核', status: 'run', due: '2026-11-03' },
    { code: 'WO-002', name: '装配点检', status: 'done', due: '2026-11-20T08:00:00Z' },
    { code: 'WO-003', name: '质检抽样', status: 'run', due: '2026-12-02' },
  ];
  const codes = (values: Record<string, unknown>, keyword = '') =>
    filterListRows(rows, { conditions, values, keyword, keywordFields: [{ key: 'name', label: '名称' }, { key: 'code', label: '编码' }] }).map((row) => row.code);
  assert.deepEqual(codes({}), ['WO-001', 'WO-002', 'WO-003'], 'no condition, no filtering');
  assert.deepEqual(codes({ name: '装配' }), ['WO-001', 'WO-002']);
  assert.deepEqual(codes({ name: '装配', status: 'run' }), ['WO-001'], 'AND');
  assert.deepEqual(codes({ name: '装配', status: 'run', due: [null, null], code: '' }), ['WO-001'], 'empty conditions ignored');
  assert.deepEqual(codes({ due: ['2026-11-01', '2026-11-30'] }), ['WO-001', 'WO-002'], 'date range incl. datetime cells');
  assert.deepEqual(codes({ due: ['2026-12-01', null] }), ['WO-003'], 'open-ended range');
  // Clearing one condition only drops that condition.
  const applied = { name: '装配', status: 'run' };
  assert.deepEqual(codes({ ...applied, status: null }), ['WO-001', 'WO-002']);
  assert.deepEqual(codes({ code: 'WO-9' }), [], 'no result');
  // Keyword + advanced filter on one list: AND.
  assert.deepEqual(codes({ status: 'run' }, '质检'), ['WO-003']);
  assert.deepEqual(codes({ status: 'done' }, '质检'), []);
  assert.equal(describeCondition(conditions[2], 'run'), '状态：执行中');
  assert.equal(describeCondition(conditions[3], ['2026-11-01', '2026-11-30']), '计划日期：2026-11-01 ~ 2026-11-30');
  assert.equal(describeCondition(conditions[3], [null, '2026-11-30']), '计划日期 ≤ 2026-11-30');
  assert.equal(describeCondition(conditions[1], '  '), null);
});

test('Avatar renders the image, else the User icon fallback, with tokens only', () => {
  const render = (props: Parameters<typeof Avatar>[0]) => renderToString(createElement(Avatar, props));
  const url = 'https://oss.example.test/a.png?X-Amz-Signature=s';
  const image = render({ name: '张三', src: url });
  assert.match(image, /<img src="https:\/\/oss\.example\.test\/a\.png\?X-Amz-Signature=s" alt="张三"/);
  assert.match(image, /size-8[^"]*rounded-full/);
  assert.doesNotMatch(image, /bg-foreground|lucide-user/);
  // A member without an avatar ("") gets the platform's fallback: a User icon
  // on the dark token, never the name's initial, with or without a name.
  for (const name of ['mercy', undefined]) {
    const fallback = render({ name, src: '' });
    assert.doesNotMatch(fallback, /<img|>M</);
    assert.match(fallback, /rounded-full[^"]*bg-foreground[^"]*text-background[^"]*"[^>]*><svg[^>]*lucide-user/);
  }
  for (const html of [image, render({ name: 'mercy', src: '' })]) assert.doesNotMatch(html, /style=|#[0-9a-f]{3,6}\b/i);
});

/** uiText as renderToString escapes it. */
async function copy(key: Parameters<typeof import('../src/lib/app-chrome').uiText>[0]) {
 const { uiText } = await import('../src/lib/app-chrome');
 return uiText(key).replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
}

async function renderFailure(error: Error, extra: {data?: unknown; isLoading?: boolean; empty?: string} = {}) {
 const { AsyncView } = await import('../src/components/data/async-view');
 const calls: string[] = [];
 const result = {data: extra.data ?? null, error, isLoading: extra.isLoading ?? false, refresh: () => { calls.push('refresh'); }};
 const props = {result, children: () => 'LOADED', empty: extra.empty};
 return {html: renderToString(createElement(AsyncView<unknown>, props)), view: AsyncView<unknown>(props), calls};
}

/** Expands hook-free function components and returns the first element matching `match`. */
function findElement(node: unknown, match: (props: Record<string, unknown>) => boolean): {props: Record<string, unknown>} | null {
 if (Array.isArray(node)) {
  for (const child of node) { const hit = findElement(child, match); if (hit) return hit; }
  return null;
 }
 if (!node || typeof node !== 'object' || !('props' in node)) return null;
 const element = node as {type: unknown; props: Record<string, unknown>};
 if (match(element.props)) return element;
 if (typeof element.type === 'function') return findElement((element.type as (props: unknown) => unknown)(element.props), match);
 return findElement(element.props.children, match);
}

test('AsyncView failure is one quiet line; the raw message waits behind Details', async () => {
 const { ApiRequestError } = await import('../src/lib/utils');
 const error = new ApiRequestError(500, '/api/orders', 'relation "app_orders" does not exist');
 const { html } = await renderFailure(error);
 assert.match(html, /role="alert"/);
 assert.ok(html.includes(await copy('loadError')) && html.includes(await copy('retry')) && html.includes(await copy('errorDetails')));
 const start = html.indexOf('<details'), end = html.indexOf('</details>');
 assert.ok(start >= 0 && end > start, 'technical details sit in a disclosure');
 assert.doesNotMatch(html.slice(start, html.indexOf('>', start)), /\bopen\b/, 'details start collapsed');
 assert.ok(html.slice(start, end).includes('HTTP 500 /api/orders: relation &quot;app_orders&quot; does not exist'), 'expanding shows the message as is');
 assert.ok(!(html.slice(0, start) + html.slice(end)).includes('HTTP 500'), 'nothing technical outside the disclosure');
 assert.doesNotMatch(html.slice(0, html.indexOf('>')), /state-error|destructive|py-10/, 'neutral, compact container');
});

test('AsyncView names only transient platform codes, never guesses from text or status', async () => {
 const { ApiRequestError } = await import('../src/lib/utils');
 const neutral = await copy('loadError'), transient = await copy('loadErrorTransient');
 for (const code of ['node_restarting', 'upstream_error']) {
  const { html } = await renderFailure(new ApiRequestError(502, '/api/orders', 'upstream connection reset', code));
  assert.ok(html.includes(transient) && !html.includes(neutral), code);
 }
 for (const error of [
  new ApiRequestError(503, '/api/orders', 'node restarting, upstream error'),
  new ApiRequestError(403, '/api/orders', 'forbidden', 'grant_expired'),
  new Error('Failed to fetch'),
 ]) {
  const { html } = await renderFailure(error);
  assert.ok(html.includes(neutral) && !html.includes(transient), error.message);
 }
});

test('AsyncView Retry calls refresh and shows the retry in flight', async () => {
 const { uiText } = await import('../src/lib/app-chrome');
 const isRetry = (props: Record<string, unknown>) => props.children === uiText('retry') && typeof props.onClick === 'function';
 const idle = await renderFailure(new Error('HTTP 500 /api/orders'));
 const retry = findElement(idle.view, isRetry);
 assert.ok(retry, 'Retry button is rendered');
 (retry.props.onClick as () => void)();
 assert.deepEqual(idle.calls, ['refresh']);
 assert.equal(retry.props.loading, false);
 const busy = await renderFailure(new Error('HTTP 500 /api/orders'), {isLoading: true});
 assert.equal(findElement(busy.view, isRetry)?.props.loading, true);
 assert.match(busy.html, /aria-busy="true"/);
});

test('AsyncView never shows a failed load as empty or loaded', async () => {
 const { uiText } = await import('../src/lib/app-chrome');
 for (const extra of [{data: []}, {empty: 'NOTHING-HERE'}, {isLoading: true}]) {
  const error = new Error('HTTP 500 /api/orders');
  const { html } = await renderFailure(error, extra.data ? {} : extra);
  assert.match(html, /role="alert"/);
  assert.ok(!html.includes('NOTHING-HERE') && !html.includes(uiText('empty')) && !html.includes('LOADED'));
 }
 // Data already on screen stays there when a later refresh fails.
 const stale = await renderFailure(new Error('HTTP 500 /api/orders'), {data: [1]});
 assert.equal(stale.html, 'LOADED');
});
