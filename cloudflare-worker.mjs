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
  '/school-today-clay.css',
  '/sw.js',
]);

const SCHOOL_CRITICAL_STYLE=`<style id="flow-school-production-critical">
#todayView .status-grid>.status-card:nth-child(2),#todayView .status-grid>.status-card:nth-child(3){display:none!important}
#bottomNav>[data-view="week"]{display:none!important}
@media(max-width:900px){
  .mobile-school-button{border:0!important;background:var(--surface)!important;box-shadow:0 7px 16px rgba(52,70,101,.11),inset 0 1px 1px rgba(255,255,255,.88)!important}
  #todayView .school-hero{min-height:112px!important;border:0!important;border-radius:25px!important;box-shadow:0 18px 42px rgba(49,70,126,.20)!important}
  #todayView .school-hero-content{min-height:112px!important;padding:13px 14px 14px!important;display:block!important}
  #todayView .school-hero .school-badge,#todayView .school-hero-copy h1,#todayView .school-hero-copy p{display:none!important}
  #todayView .school-hero-copy{position:absolute!important;top:15px!important;left:17px!important}
  #todayView .hero-right{position:absolute!important;left:13px!important;right:13px!important;top:auto!important;bottom:12px!important;width:auto!important;margin:0!important;align-items:stretch!important}
  #todayView .date-controller{width:100%!important;min-height:54px!important;padding:5px!important;border:0!important;border-radius:19px!important;background:rgba(248,250,255,.94)!important;box-shadow:0 10px 24px rgba(13,26,59,.18),inset 0 2px 1px rgba(255,255,255,.92),inset 0 -4px 9px rgba(78,96,132,.075)!important}
  #todayView .date-controller button{width:42px!important;height:42px!important;flex:0 0 42px!important;border:0!important;border-radius:15px!important}
  #todayView .date-label{min-width:0!important;flex:1 1 auto!important;text-align:center!important}
  #todayView .status-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;margin:11px 2px 14px!important;padding:0!important;align-items:stretch!important;background:transparent!important;border:0!important;border-radius:0!important;overflow:visible!important;box-shadow:none!important}
  #todayView .clock-card{grid-column:auto!important}
  #todayView .status-grid>.status-card:nth-child(1),#todayView .status-grid>.status-card:nth-child(4){min-width:0!important;min-height:80px!important;padding:12px 13px!important;background:var(--surface)!important;border:0!important;border-radius:19px!important;box-shadow:0 13px 30px rgba(52,70,101,.12),inset 0 2px 1px rgba(255,255,255,.88),inset 0 -4px 10px rgba(75,95,128,.065)!important}
  #todayView .status-grid>.status-card:nth-child(4){border-left:0!important}
  #todayView .status-card strong{margin-top:6px!important;font-size:.86rem!important;line-height:1.18}
  #todayView .status-card p{margin-top:4px!important;font-size:.55rem!important;line-height:1.35}
  #todayView .progress-track{margin-top:7px!important}
}
@media(max-width:520px){
  #todayView .school-hero,#todayView .school-hero-content{min-height:106px!important}
  #todayView .school-hero{border-radius:23px!important}
  #todayView .school-hero-copy{top:13px!important;left:15px!important}
  #todayView .hero-right{left:11px!important;right:11px!important;bottom:10px!important}
  #todayView .date-controller{min-height:51px!important;padding:4px!important;border-radius:18px!important}
  #todayView .date-controller button{width:39px!important;height:39px!important;flex-basis:39px!important;border-radius:14px!important}
  #todayView .status-grid{gap:8px!important;margin:10px 1px 13px!important}
  #todayView .status-grid>.status-card:nth-child(1),#todayView .status-grid>.status-card:nth-child(4){min-height:76px!important;padding:11px 12px!important;border-radius:18px!important}
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