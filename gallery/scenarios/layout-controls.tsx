import { useRef, useState } from 'react';
import { AnchorTabs } from '@/components/kit/ui/tabs';
import { DropdownMenu } from '@/components/kit/ui/dropdown-menu';
import { Input, TextArea } from '@/components/kit/ui/input';
import { Button } from '@/components/ui/button';

export function AnchorNavigationExample() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState('base');
  return <div className="min-w-0 rounded-md border border-border">
    <div className="border-b border-border px-4">
      <AnchorTabs containerRef={containerRef} items={[{key:'base',label:'基本信息'},{key:'detail',label:'明细信息'},{key:'notes',label:'备注信息'}]} onChange={setActive}/>
    </div>
    <div ref={containerRef} aria-label="工单分区内容" tabIndex={0} className="h-72 min-w-0 overflow-y-auto overscroll-contain px-4">
      <section data-anchor-key="base" className="min-h-80 space-y-4 py-4">
        <h3 className="font-medium">基本信息</h3>
        <label className="block space-y-2"><span>工单编码</span><Input defaultValue="WO-20261012-001" aria-label="工单编码"/></label>
        <label className="block space-y-2"><span>工单名称</span><Input defaultValue="设备例行检查" aria-label="工单名称"/></label>
      </section>
      <section data-anchor-key="detail" className="min-h-80 space-y-4 border-t border-border py-4">
        <h3 className="font-medium">明细信息</h3><p>检查循环水泵、连接管线及压力表。</p>
        <label className="block space-y-2"><span>检查记录</span><TextArea aria-label="检查记录" placeholder="填写检查结果"/></label>
      </section>
      <section data-anchor-key="notes" className="min-h-80 space-y-4 border-t border-border py-4">
        <h3 className="font-medium">备注信息</h3><TextArea aria-label="备注信息" placeholder="填写补充说明"/>
      </section>
    </div>
    <p role="status" className="border-t border-border px-4 py-2 text-sm text-muted-foreground">当前分区：{{base:'基本信息',detail:'明细信息',notes:'备注信息'}[active]}</p>
  </div>;
}

export function DropdownLayoutExample() {
  const [result,setResult] = useState('尚未执行操作');
  const items=[{key:'edit',label:'编辑记录'},{key:'copy',label:'复制记录'},{key:'locked',label:'归档记录（不可用）',disabled:true},{key:'divider',type:'divider' as const},{key:'delete',label:'删除记录',danger:true}];
  return <>
    <DropdownMenu items={items} aria-label="记录操作" onSelect={key=>setResult(`已选择：${key}`)}><Button>操作菜单</Button></DropdownMenu>
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border p-4">
      <span className="text-sm">右对齐工具栏</span>
      <DropdownMenu items={items} aria-label="工具栏操作" onSelect={key=>setResult(`已选择：${key}`)}><Button variant="outline">更多操作</Button></DropdownMenu>
    </div>
    <p role="status" className="text-sm text-muted-foreground">{result}</p>
  </>;
}
