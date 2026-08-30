export const FLOW_RELEASE='school-shell-v15-20260831';

export const ROUTE_SHELLS=Object.freeze({
  '/home':'/index.html',
  '/week':'/index.html',
  '/schedule':'/index.html',
  '/transit':'/index.html',
  '/school':'/index.html',
  '/admin':'/admin/index.html',
  '/university':'/university/index.html',
  '/university/timetable':'/university/index.html',
  '/university/campus':'/university/index.html',
  '/university/school':'/university/index.html',
});

const SCHOOL_CRITICAL_ASSETS=new Set([
  '/school.js',
  '/school-ia.js',
  '/school-metrics.js',
  '/school-surface-cleanup.js',
  '/sw.js',
]);

const SCHOOL_CRITICAL_STYLE=`<style id="flow-school-production-critical">
#todayView .status-grid>.status-card:nth-child(2),#todayView .status-grid>.status-card:nth-child(3){display:none!important}
#bottomNav>[data-view="week"]{display:none!important}
@media(max-width:900px){
  #todayView .status-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:0!important;margin:10px 0 12px!important;align-items:stretch;background:var(--surface)!important;border-radius:24px!important;overflow:hidden!important;box-shadow:var(--shadow)!important}
  #todayView .clock-card{grid-column:auto!important}
  #todayView .status-grid>.status-card:nth-child(1),#todayView .status-grid>.status-card:nth-child(4){min-width:0!important;min-height:104px!important;padding:12px 13px!important;background:transparent!important;border-radius:0!important;box-shadow:none!important}
  #todayView .status-grid>.status-card:nth-child(4){border-left:1px solid color-mix(in srgb,var(--text) 8%,transparent)!important}
  #todayView .status-card strong{margin-top:7px!important;font-size:.9rem!important;line-height:1.18}
  #todayView .status-card p{margin-top:4px!important;font-size:.57rem!important;line-height:1.35}
  #todayView .progress-track{margin-top:9px!important}
}
</style>`;

const SCHOOL_RECOVERY_SCRIPT=`<script id="flow-school-cache-recovery">(()=>{const cache='flow-school-shell-v15',guard='flow-sw-v15-reloaded';if('caches'in window)caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('flow-school-shell-')&&key!==cache).map(key=>caches.delete(key)))).catch(()=>{});if('serviceWorker'in navigator)window.addEventListener('load',async()=>{try{const hadController=Boolean(navigator.serviceWorker.controller);let reloadArmed=hadController&&sessionStorage.getItem(guard)!=='1';if(reloadArmed)navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloadArmed)return;reloadArmed=false;sessionStorage.setItem(guard,'1');location.reload()},{once:true});const registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await registration.update()}catch{}},{once:true})})();</script>`;

function normalizedPath(pathname){
  if(pathname.length>1&&pathname.endsWith('/'))return pathname.slice(0,-1);
  return pathname;
}

function schoolShellFor(pathname){
  const normalized=normalizedPath(pathname);
  if(normalized==='/'||normalized==='/index.html')return'/index.html';
  const shell=ROUTE_SHELLS[normalized];
  return shell==='/index.html'?shell:null;
}

function responseWithHeaders(response,{school=false}={}){
  const headers=new Headers(response.headers);
  headers.set('x-flow-release',FLOW_RELEASE);
  if(school)headers.set('cache-control','no-store, max-age=0, must-revalidate');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

async function schoolHtmlResponse(request,env,shell){
  const assetUrl=new URL(request.url);
  assetUrl.pathname=shell;
  const response=await env.ASSETS.fetch(new Request(assetUrl,request));
  if(request.method==='HEAD'||!response.ok)return responseWithHeaders(response,{school:true});
  const type=response.headers.get('content-type')||'';
  if(!type.includes('text/html'))return responseWithHeaders(response,{school:true});
  let html=await response.text();
  if(!html.includes('flow-school-production-critical'))html=html.replace('</head>',`${SCHOOL_CRITICAL_STYLE}</head>`);
  if(!html.includes('flow-school-cache-recovery'))html=html.replace('</body>',`${SCHOOL_RECOVERY_SCRIPT}</body>`);
  const headers=new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.delete('etag');
  headers.set('cache-control','no-store, max-age=0, must-revalidate');
  headers.set('x-flow-release',FLOW_RELEASE);
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}

export default{
  async fetch(request,env){
    if(request.method!=='GET'&&request.method!=='HEAD')return env.ASSETS.fetch(request);
    const url=new URL(request.url);
    const schoolShell=schoolShellFor(url.pathname);
    if(schoolShell)return schoolHtmlResponse(request,env,schoolShell);
    const shell=ROUTE_SHELLS[normalizedPath(url.pathname)];
    if(shell){
      const assetUrl=new URL(request.url);
      assetUrl.pathname=shell;
      return env.ASSETS.fetch(new Request(assetUrl,request));
    }
    const response=await env.ASSETS.fetch(request);
    if(SCHOOL_CRITICAL_ASSETS.has(url.pathname))return responseWithHeaders(response,{school:true});
    return response;
  },
};
