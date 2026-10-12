import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import catalog from './scaffold-catalog.json';
import './scaffold-library.css';
const categories = ['通用','布局','导航','数据录入','数据展示','反馈','重型组件'];
function Library() {
  const [active,setActive]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [example,setExample]=useState('');
  const [mobile,setMobile]=useState(false);
  const [revision,setRevision]=useState(0);
  const selected=catalog.items.find(item=>item.id===active);
  const current=selected?.examples.find(item=>item.name===example)??selected?.examples[0];
  const visible=catalog.items.filter(item=>`${item.label} ${item.examples.map(e=>e.name).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  function choose(id:string){setActive(id);setExample('');setRevision(0);}
  return <div className="source-library">
    <aside><header><strong>Tier0 Scaffold</strong><span>组件库</span></header>
      <input aria-label="搜索组件" placeholder="搜索组件名称…" value={search} onChange={e=>setSearch(e.target.value)}/>
      <button className={!active?'active':''} onClick={()=>setActive(null)}>组件总览 <small>{catalog.items.length}</small></button>
      {categories.map(category=><section key={category}><h2>{category}</h2>{visible.filter(item=>item.category===category).map(item=><button key={item.id} className={active===item.id?'active':''} onClick={()=>choose(item.id)}><span>{item.label}</span><small>{item.id}</small></button>)}</section>)}
    </aside>
    <main>{selected&&current?<>
      <p className="eyebrow">{selected.category}</p><h1>{selected.label} <small>{selected.id}</small></h1>
      <p className="intro">脚手架中的实际组件，可直接导入使用。</p>
      <div className="example-tabs" role="tablist" aria-label="组件导出">{selected.examples.map(item=><button role="tab" aria-selected={current.name===item.name} key={item.name} onClick={()=>{setExample(item.name);setRevision(0)}}>{item.name}</button>)}</div>
      <div className="preview-toolbar"><strong>交互示例</strong><div><button onClick={()=>setMobile(v=>!v)}>{mobile?'桌面宽度':'375px 宽度'}</button><button onClick={()=>setRevision(v=>v+1)}>重置示例</button></div></div>
      <div className="source-preview"><iframe key={`${current.name}-${revision}`} title={`${current.name}交互示例`} style={{width:mobile?'min(375px,100%)':'100%'}} src={`preview.html?sample=${encodeURIComponent(current.name)}`}/></div>
      <h2>使用</h2><pre><code>{`import { ${current.name} } from '${current.importPath}';`}</code></pre>
      <p className="source-path">源码：{current.source}</p><p className="footnote">示例使用本地数据；涉及查询、保存或权限的组件需由应用接入实际接口。</p>
    </>:<><p className="eyebrow">TIER0 / SCAFFOLD</p><h1>组件总览</h1><p className="intro">从脚手架源码提炼，按用途组织。选择组件查看实际交互、导出名称与使用方式。</p>
      <div className="source-summary"><span>{catalog.items.length} 个组件条目</span><span>{catalog.items.reduce((n,i)=>n+i.examples.length,0)} 个导出</span><span>源码版本 {catalog.sourceCommit.slice(0,7)}</span></div>
      {categories.map(category=>{const items=visible.filter(item=>item.category===category);return items.length>0&&<section key={category} className="source-category"><h2>{category} <small>{items.length}</small></h2><div className="source-grid">{items.map(item=><button key={item.id} onClick={()=>choose(item.id)}><strong>{item.label}</strong><code>{item.id}</code><span>{item.examples.length>1?`${item.examples.length} 个导出 / 用法`:'查看示例'} →</span></button>)}</div></section>})}
      {!visible.length&&<p>没有匹配的组件。</p>}
    </>}</main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Library/>);
