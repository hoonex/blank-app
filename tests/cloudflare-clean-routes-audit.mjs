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
const shellMarkup=pathname=>`<!doctype html><html lang="ko" data-theme="light"><head><meta name="color-scheme" content="only light"><title>${pathname.includes('university')?'Flow University':pathname.includes('admin')?'Flow Admin':'Flow School'}</title></head><body>asset:${pathname}</body></html>`;
const htmlCanonicalPath=pathname=>pathname==='/index.html'?'/':pathname.replace(/index\.html$/,'');
const env={ASSETS:{fetch:async request=>{
  const url=new URL(request.url);
  calls.push({pathname:url.pathname,search:url.search,method:request.method,redirect:request.redirect});
  if(request.redirect==='manual'&&['/index.html','/admin/index.html','/university/index.html'].includes(url.pathname)){
    return Response.redirect(new URL(htmlCanonicalPath(url.pathname),url),307);
  }
  return new Response(shellMarkup(url.pathname),{status:200,headers:{'content-type':'text/html; charset=utf-8'}});
}}};

function assertColorSchemeContract(html,label){
  assert.match(html,/<meta name="color-scheme" content="light dark">/,`${label} must advertise authored light+dark support to Android WebView/Samsung Internet.`);
  assert.match(html,/id="flow-color-scheme-contract"/,`${label} must install the host-dark color-scheme contract.`);
  assert.match(html,/html:not\(\[data-theme="dark"\]\)\{color-scheme:light dark!important\}/,`${label} must advertise authored dual-scheme support while Flow is visually light.`);
  assert.match(html,/@media\(prefers-color-scheme:dark\)\{html:not\(\[data-theme="dark"\]\)\{color-scheme:dark!important\}\}/,`${label} must handshake with a dark host so force-dark engines see an authored dark-capable page.`);
  assert.match(html,/html\[data-theme="dark"\]\{color-scheme:dark!important\}/,`${label} must preserve Flow's own dark mode.`);
  assert.match(html,/html:not\(\[data-theme="dark"\]\) :is\(input,select,textarea\)\{color-scheme:light!important\}/,`${label} must keep native form controls light when Flow is explicitly light.`);
  assert.match(html,/id="flow-color-scheme-guard"/,`${label} must keep runtime theme code from removing the WebView support signal.`);
}

for(const [route,shell] of Object.entries(ROUTE_SHELLS)){
  for(const pathname of [route,`${route}/`]){
    calls.length=0;
    const incoming=new Request(`https://blank-app.agfvrd.workers.dev${pathname}?refresh=1`,{redirect:'manual'});
    const response=await worker.fetch(incoming,env);
    assert.equal(response.status,200,`${pathname} should resolve successfully without leaking the asset canonicalization redirect`);
    assert.equal(calls.length,1,`${pathname} should make one asset lookup`);
    assert.equal(calls[0].pathname,shell,`${pathname} should serve ${shell}`);
    assert.equal(calls[0].search,'?refresh=1','query string must survive a shell rewrite');
    assert.equal(calls[0].redirect,'follow',`${pathname} shell fetch must follow internal static-asset HTML redirects while the incoming Worker request remains manual.`);
    const html=await response.text();
    assertColorSchemeContract(html,pathname);
    if(shell==='/index.html'){
      assert.match(html,/id="flow-school-production-critical"/,`${pathname} should keep the School production critical layer.`);
      assert.match(html,/id="flow-school-cache-recovery"/,`${pathname} should keep the School cache recovery layer.`);
    }
  }
}

for(const pathname of ['/university/index.html','/admin/index.html']){
  calls.length=0;
  const response=await worker.fetch(new Request(`https://blank-app.agfvrd.workers.dev${pathname}`,{redirect:'manual'}),env);
  assert.equal(response.status,200,`${pathname} shell fetch should absorb static-asset canonicalization redirects.`);
  assert.equal(calls[0].pathname,pathname,`${pathname} should preserve the direct shell path.`);
  assert.equal(calls[0].redirect,'follow',`${pathname} shell fetch should override the incoming manual redirect mode.`);
  assertColorSchemeContract(await response.text(),pathname);
}

calls.length=0;
await worker.fetch(new Request('https://blank-app.agfvrd.workers.dev/schedule?head=1',{method:'HEAD',redirect:'manual'}),env);
assert.deepEqual(calls[0],{pathname:'/index.html',search:'?head=1',method:'HEAD',redirect:'follow'});

calls.length=0;
await worker.fetch(new Request('https://blank-app.agfvrd.workers.dev/not-a-flow-route?x=1',{redirect:'manual'}),env);
assert.deepEqual(calls[0],{pathname:'/not-a-flow-route',search:'?x=1',method:'GET',redirect:'manual'},'Unknown paths must retain normal static-asset 404 behavior.');

calls.length=0;
await worker.fetch(new Request('https://blank-app.agfvrd.workers.dev/schedule',{method:'POST',body:'x',redirect:'manual'}),env);
assert.deepEqual(calls[0],{pathname:'/schedule',search:'',method:'POST',redirect:'manual'},'Non-navigation methods must not be rewritten.');

console.log(JSON.stringify({routes:Object.keys(ROUTE_SHELLS).length,schoolShell:'/index.html',universityShell:'/university/index.html',assetRedirectMode:'follow',incomingRedirectMode:'manual',colorSchemeContract:'host-dark-handshake/authored-theme-preserved',status:'ok'},null,2));
