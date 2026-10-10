import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({root,publicDir:false,plugins:[react(),tailwind()],resolve:{alias:{'@':fileURLToPath(new URL('../src',import.meta.url))}},build:{emptyOutDir:true,outDir:'../.output/component-gallery',rollupOptions:{input:{index:root+'index.html',preview:root+'preview.html'}}}});
