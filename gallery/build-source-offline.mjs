import { build } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = root + '.output/scaffold-library-offline';
for (const [entry, name] of [['scaffold-library.tsx','library'],['entry.tsx','preview']]) {
  await build({ configFile: false, root, publicDir: false,
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    plugins: [react(),tailwind()], resolve: { alias: { '@':root+'src' } },
    build: { outDir:out, emptyOutDir:name==='library', cssCodeSplit:false,
      lib: { entry:root+'gallery/'+entry, name:'Scaffold'+name, formats:['iife'], fileName:()=>name+'.js', cssFileName:name },
      rollupOptions:{output:{inlineDynamicImports:true}}
    }
  });
  writeFileSync(out+'/'+(name==='library'?'index':'preview')+'.html',`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tier0 Scaffold 组件库</title><link rel="stylesheet" href="${name}.css"></head><body><div id="root"></div><script src="${name}.js"></script></body></html>`);
}
writeFileSync(out+'/使用说明.txt','双击 index.html 打开。保留整个文件夹，无需启动服务。\n本版从脚手架 src/components 提炼，示例数据不代表后端接入或业务验收。\n');
