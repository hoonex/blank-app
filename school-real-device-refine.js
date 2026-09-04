const SCHOOL_LOGO_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-logo';
const SCHOOL_LOGO_CACHE_PREFIX='flow-school-logo-fallback-v3:';
const SCHOOL_PROFILE_KEY='flow-school-profile-v3';

function unsafeSchoolMediaUrl(value=''){
  const raw=String(value||'').trim();
  if(!raw||raw.startsWith('data:image/')||raw.startsWith('blob:'))return false;
  try{
    const url=new URL(raw,location.href),path=decodeURIComponent(url.pathname).toLowerCase(),query=url.search.toLowerCase();
    if(!/^https?:$/.test(url.protocol))return true;
    if(/\/sso(?:\/|$)/.test(path))return true;
    if(/\/(?:login|signin|auth)(?:\/|$)/.test(path))return true;
    if(/(?:^|\/)(?:index|login|signin|auth)\.do$/.test(path)&&!/(?:image|img|photo|logo|file|attach|download)/.test(`${path}${query}`))return true;
    return false;
  }catch{return true}
}
function schoolLogoHost(homepage=''){
  const raw=String(homepage||'').trim();if(!raw)return'';
  try{return new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).hostname.replace(/^www\./,'')}
  catch{return''}
}
function schoolCodeFromStorage(){
  try{return JSON.parse(localStorage.getItem(SCHOOL_PROFILE_KEY)||'null')?.school?.schoolCode||''}
  catch{return''}
}
function blobToDataUrl(blob){
  return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(typeof reader.result==='string'?reader.result:'');reader.onerror=()=>reject(reader.error||new Error('logo read failed'));reader.readAsDataURL(blob)})
}
async function eagerProxyLogo(homepage='',schoolCode=''){
  const host=schoolLogoHost(homepage),code=String(schoolCode||schoolCodeFromStorage()).trim();if(!host||!code)return'';
  const cacheKey=`${SCHOOL_LOGO_CACHE_PREFIX}${code}`;
  try{
    const cached=JSON.parse(localStorage.getItem(cacheKey)||'null'),age=Date.now()-Number(cached?.savedAt||0),missAge=Date.now()-Number(cached?.missAt||0);
    if(cached?.dataUrl?.startsWith('data:image/')&&age<14*86400000)return cached.dataUrl;
    if(cached?.missAt&&missAge<24*86400000)return'';
  }catch{}
  try{
    const url=new URL(SCHOOL_LOGO_EDGE);url.searchParams.set('host',host);
    const response=await fetch(url,{cache:'force-cache',signal:AbortSignal.timeout?.(3500)});
    if(response.status===204){try{localStorage.setItem(cacheKey,JSON.stringify({missAt:Date.now()}))}catch{}return''}
    if(!response.ok)return'';
    const type=(response.headers.get('content-type')||'').toLowerCase();if(!type.startsWith('image/'))return'';
    const blob=await response.blob();if(blob.size<32||blob.size>300000)return'';
    const dataUrl=await blobToDataUrl(blob);if(!dataUrl.startsWith('data:image/'))return'';
    const source=response.headers.get('x-flow-logo-source')||'logo-proxy-eager';
    try{localStorage.setItem(cacheKey,JSON.stringify({dataUrl,source,savedAt:Date.now()}))}catch{}
    return dataUrl;
  }catch{return''}
}

/* school.js starts its media request before the progressive School shell finishes
   booting. Patch Response.json while that request is in flight so navigation/SSO
   HTML can never be promoted to an image URL. If the primary resolver has no safe
   logo, resolve the existing same-origin-safe logo proxy now instead of mutating
   the header several seconds later during idle. */
if(!globalThis.__flowSchoolMediaResponseGuard){
  globalThis.__flowSchoolMediaResponseGuard=true;
  const nativeJson=Response.prototype.json;
  Response.prototype.json=async function(...args){
    const body=await nativeJson.apply(this,args),responseUrl=String(this.url||'');
    if(!responseUrl.includes('/functions/v1/school-data')||!/[?&]action=media(?:&|$)/.test(responseUrl)||!body||typeof body!=='object')return body;
    const media={...(body.media||{})};let changed=false;
    if(unsafeSchoolMediaUrl(media.hero)){media.hero='';changed=true}
    if(unsafeSchoolMediaUrl(media.logo)){media.logo='';media.logoSource='rejected-navigation';changed=true}
    if(!media.logo&&body.homepage){
      let code='';try{code=new URL(responseUrl).searchParams.get('school')||''}catch{}
      const fallback=await eagerProxyLogo(body.homepage,code);
      if(fallback){media.logo=fallback;media.logoSource='logo-proxy-eager';changed=true}
    }
    return changed?{...body,media}:body;
  };
}

const style=document.createElement('style');
style.id='flow-school-real-device-refine-style';
style.textContent=`
/* The visual search shell is already tall enough; make the actual input own the
   same hit area in every viewport instead of leaving a 19px native input inside it. */
html body #landing #schoolSearch{
  box-sizing:border-box!important;
  min-height:44px!important;
  height:44px!important;
  padding-block:0!important;
}

/* Week navigation is compact visually, but every viewport still needs a real
   44px interactive target. Keep desktop widths unchanged and grow only height. */
html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar :is(#prevWeek,#thisWeekBtn,#nextWeek){
  box-sizing:border-box!important;
  min-height:44px!important;
  height:44px!important;
}

@media(max-width:520px){
  /* Preserve the existing soft-clay material contract without restoring the old
     floating tile appearance. On-device this reads as edge definition, not a card. */
  html[data-flow-school-ui="v2"] body #dashboard .mobile-topbar .mobile-school-button{
    box-shadow:inset 0 1px 0 rgba(255,255,255,.48),inset 0 -1px 0 rgba(43,57,78,.03)!important;
  }

  /* Keep the two status surfaces balanced; solve long Korean exam names through
     typography instead of stealing width from the current-state card. */
  html[data-flow-school-ui="v2"] body #todayView .status-card:last-child strong{
    font-size:.72rem!important;
    line-height:1.2!important;
    letter-spacing:-.035em!important;
    word-break:keep-all!important;
    overflow-wrap:anywhere!important;
  }

  /* Make the help affordance read as a control rather than a stray footer label. */
  html[data-flow-school-ui="v2"] body #todayView .neis-timetable-help{
    border-top:0!important;
    padding-top:3px!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .neis-timetable-help summary{
    box-sizing:border-box!important;
    min-height:44px!important;
    padding:0 10px!important;
    border-radius:10px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--surface-2) 54%,transparent)!important;
    color:var(--muted)!important;
    font-weight:760!important;
  }

  /* This is a final geometry contract, not a theme suggestion. #dashboard adds
     enough specificity that school-today-responsive.css may load later without
     reintroducing its older 9px/11px curvature. */
  html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle{
    border-radius:12px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView .timetable-mode-toggle button,
  html[data-flow-school-ui="v2"] body #dashboard #todayView #editSubjectsBtn,
  html[data-flow-school-ui="v2"] body #dashboard #todayView #shareTimetableBtn{
    border-radius:10px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #editSubjectsBtn{
    background:color-mix(in srgb,var(--accent) 7%,var(--surface))!important;
    color:var(--accent)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView #shareTimetableBtn{
    background:color-mix(in srgb,var(--surface-2) 58%,var(--surface))!important;
    color:var(--text)!important;
  }

  /* Do not move the segmented control when Week hides Today-only utilities. */
  html[data-flow-school-ui="v2"] body.flow-inline-week-active #dashboard #todayView .timetable-actions{
    justify-content:flex-start!important;
  }

  /* A 360px device has ~304px of timetable content width. The old 320px floor
     clipped Friday even though the six columns can fit comfortably. Fit the grid
     to its card instead of forcing horizontal scrolling. */
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-table-wrap{
    overflow-x:hidden!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-table{
    width:100%!important;
    min-width:0!important;
    max-width:100%!important;
    grid-template-columns:24px repeat(5,minmax(0,1fr))!important;
  }

  /* Bottom navigation is explicitly circular-rounded, never a superellipse.
     Every inner interactive/optical layer shares the same 12px radius. */
  html[data-flow-school-ui="v2"] body #dashboard #bottomNav.mobile-bottom-nav{
    border-radius:16px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #bottomNav.mobile-bottom-nav>.mobile-tab,
  html[data-flow-school-ui="v2"] body #dashboard #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"] body #dashboard #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    border-radius:12px!important;
    corner-shape:round!important;
  }

  /* Keep the moving active lens geometry for interaction/optical contracts, but
     lower its standard-mode contrast so it stops reading as a nested giant card. */
  html[data-flow-school-ui="v2"]:not([data-flow-glass-mode="optical"]) body #dashboard #bottomNav.mobile-bottom-nav::before{
    background:color-mix(in srgb,var(--accent) 2.5%,var(--surface))!important;
    border-color:transparent!important;
    box-shadow:none!important;
  }
}

/* Short touch landscape has enough horizontal room, but the legacy Week toolbar
   constrains all three navigation buttons into a ~91px track. Preserve a real
   44px hit box for arrows and a readable current-week action without changing
   the compact visual language used by the landscape shell. */
@media(min-width:521px) and (max-width:1180px) and (max-height:620px) and (orientation:landscape){
  html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar .week-controls{
    width:max-content!important;
    min-width:162px!important;
    max-width:100%!important;
    grid-template-columns:44px 64px 44px!important;
    flex:0 0 auto!important;
    gap:5px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar #prevWeek,
  html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar #nextWeek{
    box-sizing:border-box!important;
    width:44px!important;
    min-width:44px!important;
    height:44px!important;
    min-height:44px!important;
    flex:0 0 44px!important;
    padding:0!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #todayView .inline-week-toolbar #thisWeekBtn{
    box-sizing:border-box!important;
    width:64px!important;
    min-width:64px!important;
    height:44px!important;
    min-height:44px!important;
    flex:0 0 64px!important;
    padding:0 8px!important;
    white-space:nowrap!important;
  }
}

@media(max-width:380px){
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-cell{padding-inline:2px!important}
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-head{font-size:.49rem!important}
  html[data-flow-school-ui="v2"] body #dashboard #todayView .week-subject{font-size:.49rem!important;letter-spacing:-.015em!important}
}

@media(min-width:390px) and (max-width:520px){
  html[data-flow-school-ui="v2"] body #todayView .week-head{font-size:.53rem!important}
  html[data-flow-school-ui="v2"] body #todayView .week-period{font-size:.54rem!important}
  html[data-flow-school-ui="v2"] body #todayView .week-subject{font-size:.54rem!important;line-height:1.2!important}
}
`;
document.head.append(style);

/* The shared follower already owns tab changes. Its only stale case was a late
   responsive width change that did not resize the nav border box. Observe the
   actual tab boxes instead of adding another animation/timer loop. */
function installBottomNavTabMetricObserver(){
  const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
  if(!nav||nav.dataset.flowTabMetricObserver==='ready'||!('ResizeObserver' in window))return;
  const sync=()=>{
    const dashboard=document.querySelector('#dashboard');
    if(!dashboard||dashboard.classList.contains('hidden')||innerWidth>1180)return;
    const active=nav.querySelector(':scope > .mobile-tab.active')||nav.querySelector(':scope > .mobile-tab');
    if(!active)return;
    const nr=nav.getBoundingClientRect(),ir=active.getBoundingClientRect();
    if(!nr.width||!ir.width)return;
    nav.style.setProperty('--flow-nav-x',`${(ir.left-nr.left).toFixed(2)}px`);
    nav.style.setProperty('--flow-nav-w',`${ir.width.toFixed(2)}px`);
  };
  const observer=new ResizeObserver(sync);
  nav.querySelectorAll(':scope > .mobile-tab').forEach(tab=>observer.observe(tab));
  nav.dataset.flowTabMetricObserver='ready';
  queueMicrotask(sync);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installBottomNavTabMetricObserver,{once:true});else installBottomNavTabMetricObserver();
document.documentElement.dataset.flowSchoolRealDeviceRefine='v2';
