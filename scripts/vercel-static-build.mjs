#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'dist');
const config=JSON.parse(await readFile(path.join(root,'vercel.json'),'utf8'));

const excludedDirs=new Set(['.git','.github','.devcontainer','node_modules','scripts','tests','supabase','dist','__pycache__']);
const excludedFiles=new Set(['.assetsignore','.gitignore','AGENTS.md','ADMIN.md','README.md','LICENSE','MONETIZATION_LAB.md','VERCEL_REST.md','vercel.json','wrangler.jsonc','cloudflare-worker.mjs']);
const publicExtensions=new Set(['.html','.css','.js','.mjs','.json','.xml','.txt','.svg','.webmanifest','.ico','.png','.jpg','.jpeg','.webp','.avif','.gif','.woff','.woff2']);

function withBase(html){
  return html.includes('<base ')?html:html.replace(/<head(\s[^>]*)?>/i,(tag)=>`${tag}\n  <base href="/">`);
}

function cleanPath(value){
  return String(value||'').replace(/^\/+|\/+$/g,'');
}

await rm(out,{recursive:true,force:true});
await mkdir(out,{recursive:true});

for(const entry of await readdir(root,{withFileTypes:true})){
  if(entry.isDirectory()){
    if(excludedDirs.has(entry.name)||entry.name.startsWith('.'))continue;
    await cp(path.join(root,entry.name),path.join(out,entry.name),{recursive:true});
    continue;
  }
  if(!entry.isFile()||excludedFiles.has(entry.name)||entry.name.startsWith('.'))continue;
  if(!publicExtensions.has(path.extname(entry.name).toLowerCase()))continue;
  await cp(path.join(root,entry.name),path.join(out,entry.name));
}

const materialized=[];
for(const rewrite of config.rewrites||[]){
  const source=cleanPath(rewrite?.source);
  const destination=cleanPath(rewrite?.destination);
  if(!source||!destination||/[():*+?]/.test(source))continue;
  if(!destination.endsWith('.html'))continue;

  const sourceFile=path.join(out,destination);
  const targetFile=path.join(out,source,'index.html');
  if(path.resolve(sourceFile)===path.resolve(targetFile))continue;

  let html=await readFile(sourceFile,'utf8');
  if(destination==='index.html')html=withBase(html);
  await mkdir(path.dirname(targetFile),{recursive:true});
  await writeFile(targetFile,html,'utf8');
  materialized.push({route:`/${source}`,from:`/${destination}`,file:path.relative(out,targetFile).replaceAll('\\','/')});
}

const required=['/home','/week','/schedule','/school','/university/timetable','/university/campus','/university/school'];
for(const route of required){
  const file=path.join(out,cleanPath(route),'index.html');
  await readFile(file);
}

console.log(`Prepared Vercel static output in ${path.relative(root,out)} with ${materialized.length} clean-route fallbacks.`);
for(const item of materialized)console.log(`${item.route} <- ${item.from} (${item.file})`);
