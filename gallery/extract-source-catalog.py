from pathlib import Path
import re,json,subprocess
root=Path(__file__).resolve().parents[1]
reg=(root/'gallery/registry.ts').read_text();imports=dict(re.findall(r'import \{ (\w+) \} from "(@/components/[^"]+)";',reg))
groups={
'通用':[('按钮','Button IconButton TextButton SplitButton'),('高亮文本','HighlightText'),('省略文本','EllipsisText'),('字段图标','FieldTypeIcon')],
'布局':[('表单布局','FormGrid FieldGroup LineItemSection'),('页面容器','PageContainer PageCard ResponsivePage'),('页头与工具栏','PageHeader PageToolbar'),('表格滚动容器','TableViewport')],
'导航':[('锚点导航','AnchorTabs'),('下拉菜单','DropdownMenu'),('分页','Pagination'),('标签页','Tabs CapsuleGroup'),('页头链接','PageHeaderLink')],
'数据录入':[('输入框','Input TextArea'),('数字输入','NumberInput NumberRangeInput'),('选择器','Select'),('日期选择','DatePicker DateRangePicker'),('复选框','Checkbox CheckboxGroup'),('单选框','RadioGroup'),('开关','Switch'),('文件上传','FileUpload ImageUpload AttachmentUpload'),('记录下拉','RecordSelect'),('参照输入','ReferenceInput ReferenceSelect PersonInput'),('表单字段','FieldControl FieldLabel RequiredMark'),('级联参照','ReferenceCascader')],
'数据展示':[('头像','Avatar'),('徽标','Badge'),('卡片','Card'),('折叠分区','CollapseSection'),('空状态','Empty EmptyState'),('图片与文件预览','ImagePreview FilePreview ImageThumbs'),('气泡卡片','Popover'),('分段控制器','Segmented'),('统计卡片','StatCard'),('数据表格','DataGrid DataTable'),('标签与状态','Tag StatusTag StatusBadge ColorDotLabel'),('文字提示','Tooltip'),('树列表','TreeList'),('字段值','FieldValue')],
'反馈':[('风险提示','RiskBanner'),('抽屉','Drawer'),('对话框','Dialog ConfirmDialog FormDialog FullscreenModal'),('消息提示','Toaster'),('进度','ProgressBar ProgressRing'),('骨架屏','Skeleton TableSkeleton'),('加载状态','Spin AsyncView')],
'重型组件':[('元数据表单','MetaForm'),('可编辑明细表','DetailTable'),('元数据列表页','MetaListPage'),('参照选择弹窗','ReferencePicker PersonPicker'),('查询条件','SearchPanel FilterConditionList SortConditionList'),('字段配置','CustomFieldForm CustomFieldTable OptionListEditor'),('表达式编辑','ExpressionEditorDialog VariablePicker'),('编码规则编辑','CodeRuleEditor'),('打印模板','PrintTemplateEditor PrintTemplatePreview'),('导入导出','ImportDialog ExportDialog ExcelLogModal'),('视图管理','ViewTabs ViewEditorDrawer ViewListDrawer'),('记录卡片','MobileCard MobileCardConfigDialog')]
}
items=[];used=set()
for category,entries in groups.items():
 for label,names in entries:
  examples=[]
  for name in names.split():
   assert name in imports,name
   source=imports[name].replace('@/','src/')+'.tsx';assert (root/source).exists(),source
   examples.append(dict(name=name,source=source,importPath=imports[name]));used.add(name)
  items.append(dict(id=examples[0]['name'],label=label,category=category,examples=examples))
sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,env=__import__('os').environ).decode().strip()
(root/'gallery/scaffold-catalog.json').write_text(json.dumps(dict(sourceCommit=sha,items=items,excluded=[dict(name=n,source=p,reason='辅助构件、应用布局或尚未独立整理的扩展；不冒充基础组件') for n,p in imports.items() if n not in used]),ensure_ascii=False,indent=2)+'\n')
print(len(items),'entries',len(used),'real exports')
