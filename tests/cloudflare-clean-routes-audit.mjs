import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import worker,{ROUTE_SHELLS} from '../cloudflare-worker.mjs';

const wrangler=JSON.parse(await readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8'));
const vercel=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));

assert.equal(wrangler.name,'blank-app');
assert.equal(wrangler.main,'./cloudflare-worker.mjs');
assert.equal(wrangler.assets?.directory,'./');
assert.equal(wrangler.assets?.binding,'ASSETS');
assert.equal(wrangler.assets?.not_found_handling,undefined,'Do not use a global SPA fallback: Flow has separate School and University shells.');

const vercelRoutes=Object.fromEntries((vercel.rewrites||[]).map(({source,destination})=>[source,destination]));
assert.deepEqual(ROUTE_SHELLS,vercelRoutes,'Cloudflare clean routes must stay in lockstep with Vercel rewrites.');

const calls=[];
const env={ASSETS:{fetch:async request=>{
  const url=new URL(request.url);
  calls.push({pathname:url.pathname,search:url.search,method:request.method});
  return new Response(`asset:${url.pathname}`,{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
}}};

for(const [route,shell] of Object.entries(ROUTE_SHELLS)){
  for(const pathname of [route,`${route}/`]){
    calls.length=0;
    const response=await worker.fetch(new Request(`https://blank-app.agfvrd.workers.dev${pathname}?refresh=1`),env);
    assert.equal(response.status,200,`${pathname} should resolve successfully`);
    assert.equal(calls.length,1,`${pathname} should make one asset lookup`);
    assert.equal(calls[0].pathname,shell,`${pathname} should serve ${shell}`);
    assert.equal(calls[0].search,'?refresh=1','query string must survive a shell rewrite');
  }
}

calls.length=0;
await worker.fetch(new Request('https://blank-app.agfvrd.workers.dev/schedule?head=1',{method:'HEAD'}),env);
assert.deepEqual(calls[0],{pathname:'/index.html',search:'?head=1',method:'HEAD'});

calls.length=0;
await worker.fetch(new Request('https://blank-app.agfvrd.workers.dev/not-a-flow-route?x=1'),env);
assert.deepEqual(calls[0],{pathname:'/not-a-flow-route',search:'?x=1',method:'GET'},'Unknown paths must retain normal static-asset 404 behavior.');

calls.length=0;
await worker.fetch(new Request('https://blank-app.agfvrd.workers.dev/schedule',{method:'POST',body:'x'}),env);
assert.deepEqual(calls[0],{pathname:'/schedule',search:'',method:'POST'},'Non-navigation methods must not be rewritten.');

console.log(JSON.stringify({routes:Object.keys(ROUTE_SHELLS).length,schoolShell:'/index.html',universityShell:'/university/index.html',status:'ok'},null,2));
