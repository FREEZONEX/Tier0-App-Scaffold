import { useState, useCallback, type SetStateAction } from 'react';
import { toast } from 'sonner';
/** Local preview fixtures only; applications supply their own persistence adapter. */
export function useLocalData<T>(key:string, initial:T) {
 const [value,setValue]=useState<T>(()=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:initial;}catch{return initial;}});
 const update=useCallback((action:SetStateAction<T>)=>{const next=typeof action==='function'?(action as (v:T)=>T)(value):action;try{localStorage.setItem(key,JSON.stringify(next));setValue(next);}catch(error){console.error(error);toast.error('保存失败，请检查本地存储');}},[key,value]);
 return [value,update] as const;
}
export function downloadCsv(name:string,rows:Record<string,unknown>[]){
 if(!rows.length){toast('没有可导出的数据');return;}
 const keys=Object.keys(rows[0]);const cell=(value:unknown)=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
 const csv='\ufeff'+[keys.map(cell).join(','),...rows.map(row=>keys.map(key=>cell(row[key])).join(','))].join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast.success('已生成 CSV 文件');
}
