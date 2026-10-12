import { useState } from 'react';
import { ViewEditorDrawer } from '@/components/kit/meta/view-editor-drawer';
import { Button } from '@/components/ui/button';
import type { ViewDef } from '@/lib/component-kit/types';

export function ViewEditorExample() {
  const [open, setOpen] = useState(true);
  const [code, setCode] = useState<string | null>(null);
  const [saved, setSaved] = useState<ViewDef | null>(null);
  return <>
    <div className="flex flex-wrap gap-2">
      <Button onClick={() => {setCode(null);setOpen(true);}}>创建视图</Button>
      <Button variant="outline" disabled={!saved} onClick={() => {setCode(saved?.code ?? null);setOpen(true);}}>编辑已保存视图</Button>
    </div>
    <p role="status">{saved ? `已保存视图：${saved.name}（当前预览内）` : '创建一个视图，配置字段、过滤条件和排序。'}</p>
    <ViewEditorDrawer open={open} onOpenChange={setOpen} objectCode="product" viewCode={code} onSaved={view=>{setSaved(view);setOpen(false);}}/>
  </>;
}
