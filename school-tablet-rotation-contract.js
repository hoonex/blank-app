const root=document.documentElement;
const STYLE_ID='flow-school-tablet-rotation-contract-style';
const COMPACT_QUERY='(max-width:1180px)';
const TOUCH_LANDSCAPE_DIMENSIONS='(max-width:1536px) and (max-height:1024px) and (orientation:landscape)';
let syncFrame=0;

function touchLandscapeShell(){
  if(!matchMedia(TOUCH_LANDSCAPE_DIMENSIONS).matches)return false;
  const touchCapable=Number(navigator.maxTouchPoints||0)>0;
  const touchPrimary=matchMedia('(pointer:coarse)').matches||matchMedia('(hover:none)').matches;
  return touchCapable&&touchPrimary;
}
function compactShell(){
  return matchMedia(COMPACT_QUERY).matches||touchLandscapeShell();
}

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
/* Compact School owns one top date shell. The runtime dataset is authoritative so
   desktop-like tablet UAs cannot choose a different shell from mobile tablet UAs. */
@media (max-width:1180px), (max-width:1536px) and (max-height:1024px) and (orientation:landscape){
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #todayView #schoolHero{
    display:none!important;
    width:0!important;
    height:0!important;
    min-height:0!important;
    margin:0!important;
    padding:0!important;
    border:0!important;
    box-shadow:none!important;
    overflow:hidden!important;
  }
}

/* Large Android tablets can expose a desktop-like 1536x1024 CSS viewport while
   still being touch-first. Keep that whole touch-landscape band on the same
   compact School shell instead of falling back to desktop sidebar + legacy hero. */
@media (max-width:1536px) and (max-height:1024px) and (orientation:landscape){
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body{
    overflow-x:hidden!important;
    padding-bottom:84px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard.product-shell:not(.hidden){
    display:block!important;
    width:100%!important;
    max-width:none!important;
    padding:0 16px 24px!important;
    grid-template-columns:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard:not(.hidden) .desktop-sidebar,
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard #todayView #schoolHero{
    display:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard:not(.hidden) .product-main{
    width:100%!important;
    max-width:none!important;
    min-width:0!important;
    margin:0!important;
    padding:0!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard:not(.hidden) .mobile-topbar{
    position:sticky!important;
    top:0!important;
    z-index:70!important;
    display:grid!important;
    grid-template-columns:minmax(72px,auto) minmax(420px,620px) minmax(112px,164px)!important;
    align-items:center!important;
    justify-content:space-between!important;
    width:100%!important;
    min-height:62px!important;
    height:62px!important;
    padding:5px 9px!important;
    gap:10px!important;
    border:0!important;
    border-radius:0!important;
    background:color-mix(in srgb,var(--surface) 88%,var(--bg))!important;
    box-shadow:none!important;
    overflow:visible!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard:not(.hidden) .mobile-topbar .flow-logo{
    display:flex!important;
    align-items:center!important;
    min-width:72px!important;
    min-height:44px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard:not(.hidden) .mobile-topbar .flow-logo-copy strong{
    font-size:1.03rem!important;
    font-weight:850!important;
    letter-spacing:-.055em!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard:not(.hidden) .mobile-topbar .flow-logo-copy small{display:none!important}
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard:not(.hidden) .mobile-school-button{
    position:relative!important;
    inset:auto!important;
    display:grid!important;
    align-content:center!important;
    justify-items:end!important;
    width:100%!important;
    min-width:112px!important;
    max-width:164px!important;
    height:46px!important;
    min-height:46px!important;
    margin:0!important;
    padding:4px 8px!important;
    border:0!important;
    border-radius:14px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--surface) 88%,transparent)!important;
    box-shadow:0 4px 14px rgba(43,57,78,.06),inset 0 1px 0 rgba(255,255,255,.62)!important;
    text-align:right!important;
    overflow:hidden!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard:not(.hidden) .mobile-school-button :is(span,small){
    display:block!important;
    max-width:100%!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    white-space:nowrap!important;
  }

  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard:has(#todayView:not(.hidden)) #flowTodayDateDock{
    --flow-date-count:5;
    --flow-date-x:0px;
    display:grid!important;
    grid-template-columns:44px minmax(0,1fr) 44px!important;
    align-items:center!important;
    justify-self:center!important;
    width:min(100%,620px)!important;
    min-width:0!important;
    height:50px!important;
    min-height:50px!important;
    padding:3px 0!important;
    box-sizing:border-box!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    overflow:visible!important;
    touch-action:pan-y!important;
    user-select:none!important;
    -webkit-user-select:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock .flow-date-edge{
    display:grid!important;
    place-items:center!important;
    width:44px!important;
    height:44px!important;
    min-width:44px!important;
    min-height:44px!important;
    padding:0!important;
    border:0!important;
    border-radius:13px!important;
    corner-shape:round!important;
    background:transparent!important;
    color:color-mix(in srgb,var(--text) 58%,var(--muted))!important;
    box-shadow:none!important;
    font-size:1.12rem!important;
    font-weight:700!important;
    line-height:1!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock .flow-date-viewport{
    position:relative!important;
    grid-column:2!important;
    width:100%!important;
    min-width:0!important;
    height:44px!important;
    overflow:hidden!important;
    border-radius:15px!important;
    background:transparent!important;
    isolation:isolate!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock .flow-date-focus{
    position:absolute!important;
    z-index:0!important;
    top:0!important;
    bottom:0!important;
    left:50%!important;
    width:calc((100% / var(--flow-date-count,5)) - 5px)!important;
    transform:translateX(-50%)!important;
    border:1px solid color-mix(in srgb,var(--accent) 15%,transparent)!important;
    border-radius:14px!important;
    corner-shape:round!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 9%,var(--surface)),color-mix(in srgb,var(--surface) 95%,transparent))!important;
    box-shadow:0 5px 14px color-mix(in srgb,var(--accent) 9%,transparent),inset 0 1px 0 rgba(255,255,255,.82)!important;
    pointer-events:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock .flow-date-focus::before{
    content:""!important;
    position:absolute!important;
    top:3px!important;
    left:50%!important;
    width:14px!important;
    height:2px!important;
    transform:translateX(-50%)!important;
    border-radius:2px!important;
    background:color-mix(in srgb,var(--accent) 78%,transparent)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock .flow-date-rail{
    position:absolute!important;
    z-index:1!important;
    inset:0!important;
    width:100%!important;
    height:44px!important;
    transform:translate3d(var(--flow-date-x,0px),0,0)!important;
    will-change:transform!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock :is(.flow-date-day,.flow-date-buffer-day){
    --flow-date-base:0px;
    --flow-date-scale:.84;
    position:absolute!important;
    left:50%!important;
    top:0!important;
    display:grid!important;
    grid-template-rows:11px 18px 8px!important;
    place-content:center!important;
    align-items:center!important;
    justify-items:center!important;
    width:calc((100% / var(--flow-date-count,5)) - 5px)!important;
    height:44px!important;
    min-height:44px!important;
    margin:0!important;
    padding:4px 2px 2px!important;
    box-sizing:border-box!important;
    border:0!important;
    border-radius:13px!important;
    background:transparent!important;
    color:var(--muted)!important;
    box-shadow:none!important;
    opacity:var(--flow-date-opacity,.42)!important;
    transform:translate3d(var(--flow-date-base),0,0) translateX(-50%) scale(var(--flow-date-scale))!important;
    transform-origin:50% 50%!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock .flow-date-day[data-preview="true"]{
    color:var(--accent)!important;
    font-weight:850!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock .flow-date-week{
    grid-row:1!important;
    font-size:.54rem!important;
    font-weight:780!important;
    line-height:1!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock .flow-date-num{
    grid-row:2!important;
    font-size:.95rem!important;
    font-weight:900!important;
    line-height:1!important;
    letter-spacing:-.055em!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #flowTodayDateDock .flow-date-today{
    grid-row:3!important;
    height:8px!important;
    color:var(--accent)!important;
    font-size:.43rem!important;
    font-weight:850!important;
    line-height:1!important;
  }

  /* #dashboard is intentionally doubled here: late global-shell rules also use an
     ID-heavy selector, so the tablet bridge must remain authoritative after those
     styles are raised again during rotation. */
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    display:grid!important;
    visibility:visible!important;
    opacity:1!important;
    pointer-events:auto!important;
    position:fixed!important;
    z-index:90!important;
    top:auto!important;
    bottom:max(10px,env(safe-area-inset-bottom))!important;
    left:50%!important;
    right:auto!important;
    width:min(700px,calc(100% - 32px))!important;
    min-height:62px!important;
    height:62px!important;
    max-height:62px!important;
    padding:6px!important;
    transform:translateX(-50%)!important;
    grid-template-rows:50px!important;
    gap:2px!important;
    border-radius:9999px!important;
    corner-shape:round!important;
    overflow:hidden!important;
    background:color-mix(in srgb,var(--surface) 91%,transparent)!important;
    box-shadow:0 10px 30px rgba(36,48,69,.12)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"][data-flow-transit-surface="dormant"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    --flow-tab-count:4!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"]:not([data-flow-transit-surface="dormant"]) body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    --flow-tab-count:5!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.mobile-tab,
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.flow-mobile-settings{
    min-width:0!important;
    width:100%!important;
    height:50px!important;
    min-height:50px!important;
    padding:0 8px!important;
    border:0!important;
    border-radius:9999px!important;
    corner-shape:round!important;
    background:transparent!important;
    box-shadow:none!important;
    line-height:1!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #dashboard#dashboard:not(.hidden) #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    border-radius:9999px!important;
    corner-shape:round!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body #todayView{
    width:100%!important;
    max-width:1180px!important;
    margin-inline:auto!important;
    padding:6px 10px 16px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-tablet-rotation="compact"] body .product-main{
    padding-bottom:calc(124px + env(safe-area-inset-bottom))!important;
    scroll-padding-bottom:calc(124px + env(safe-area-inset-bottom))!important;
  }
}
`;
  document.head.append(style);
}

function syncHero(compact){
  const hero=document.getElementById('schoolHero');
  if(!hero)return;
  if(compact){
    hero.dataset.flowTabletHeroSuppressed='true';
    hero.hidden=true;
    hero.style.setProperty('display','none','important');
    return;
  }
  if(hero.dataset.flowTabletHeroSuppressed==='true'){
    delete hero.dataset.flowTabletHeroSuppressed;
    hero.hidden=false;
    hero.style.removeProperty('display');
  }
}
function applyCompactState(){
  const compact=compactShell();
  const next=compact?'ready':'wide';
  if(root.dataset.flowTodayTopbar!==next)root.dataset.flowTodayTopbar=next;
  root.dataset.flowSchoolTabletRotation=compact?'compact':'wide';
  syncHero(compact);
}
function syncCompactState(){
  cancelAnimationFrame(syncFrame);
  syncFrame=requestAnimationFrame(applyCompactState);
}

installStyle();
applyCompactState();
window.addEventListener('resize',syncCompactState,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(syncCompactState,60),{passive:true});
window.visualViewport?.addEventListener?.('resize',syncCompactState,{passive:true});