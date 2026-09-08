import './school-desktop-workspace.js';

const root=document.documentElement;
const MOBILE_QUERY='(max-width:520px)';
const TABLET_QUERY='(min-width:521px) and (max-width:1180px)';
const WIDE_TOUCH_TABLET='(min-width:1181px) and (max-width:1536px) and (max-height:1024px) and (orientation:landscape)';
const LAYOUT_STYLE_ID='flow-school-layout-contract-style';
let syncFrame=0;

function wideTouchTablet(){
  if(!matchMedia(WIDE_TOUCH_TABLET).matches)return false;
  const touchCapable=Number(navigator.maxTouchPoints||0)>0;
  const touchPrimary=matchMedia('(pointer:coarse)').matches||matchMedia('(hover:none)').matches;
  return touchCapable&&touchPrimary;
}

function layoutMode(){
  if(matchMedia(MOBILE_QUERY).matches)return'mobile';
  if(matchMedia(TABLET_QUERY).matches||wideTouchTablet())return'tablet';
  return'desktop';
}

function ensureLayoutStyle(){
  if(document.getElementById(LAYOUT_STYLE_ID))return;
  const style=document.createElement('style');
  style.id=LAYOUT_STYLE_ID;
  style.textContent=`
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard:not(.hidden) .mobile-topbar,
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
  display:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard:not(.hidden) .desktop-sidebar{
  display:grid!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView{
  max-width:1320px!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView .timetable-card,
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView .right-stack{
  grid-column:auto!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard #todayView .status-card:not(.flow-home-noise){
  border:0!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard.product-shell:not(.hidden) .mobile-topbar .flow-logo-copy small{
  display:none!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .school-info-grid{
  grid-template-columns:repeat(12,minmax(0,1fr))!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .school-info-grid>.info-tile{
  grid-column:span 3!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .school-info-grid>.info-tile-empty{
  grid-column:1/-1!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .school-info-grid:has(>.info-tile:nth-child(4n+1):last-child)>.info-tile:last-child{
  grid-column:5/span 4!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .school-info-grid:has(>.info-tile:nth-child(4n+2):last-child)>.info-tile:nth-last-child(2){
  grid-column:3/span 4!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .school-info-grid:has(>.info-tile:nth-child(4n+2):last-child)>.info-tile:last-child{
  grid-column:7/span 4!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #schoolView .school-info-grid:has(>.info-tile:nth-child(4n+3):last-child)>.info-tile:nth-last-child(-n+3){
  grid-column:span 4!important;
}
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #landing .school-search-panel{
  transform:translateY(-30px)!important;
}
html[data-flow-school-ui="v2"] body #switchDialog[open]{
  z-index:240!important;
}
html[data-flow-school-ui="v2"] body:has(#switchDialog[open]) #dashboard:not(.hidden) .mobile-topbar,
html[data-flow-school-ui="v2"] body:has(#switchDialog[open]) #dashboard:not(.hidden) .desktop-sidebar{
  pointer-events:none!important;
}
@media (min-width:351px) and (max-width:520px){
  html[data-flow-school-ui="v2"] body #dashboard #schoolView .school-info-grid{
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:8px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard #schoolView .school-info-grid>.info-tile{
    min-width:0!important;
    padding:12px 13px!important;
  }
}
/* Normal desktop is a two-column workspace. This final contract intentionally
   wins over older desktop redesign styles that used a block shell. */
@media (min-width:1181px) and (min-height:681px){
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden){
    display:grid!important;
    grid-template-columns:216px minmax(0,1fr)!important;
    grid-template-rows:auto!important;
    align-items:start!important;
    align-content:start!important;
    gap:18px!important;
    width:min(1720px,calc(100% - 32px))!important;
    max-width:none!important;
    margin:0 auto!important;
    padding:16px 0 42px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden)>#desktopSidebar.desktop-sidebar{
    grid-column:1!important;
    grid-row:1!important;
    align-self:start!important;
    display:flex!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden)>.product-main{
    grid-column:2!important;
    grid-row:1!important;
    align-self:start!important;
    width:100%!important;
    max-width:none!important;
    min-width:0!important;
    margin:0!important;
    padding:0!important;
    transform:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden)>#bottomNav.mobile-bottom-nav{
    display:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView .timetable-mode-toggle{
    display:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"][data-flow-glass-mode="optical"] body #dashboard.product-shell:not(.hidden) #desktopSidebar.desktop-sidebar{
    background:radial-gradient(150% 105% at -8% -4%,rgba(255,255,255,.76) 0%,rgba(255,255,255,.19) 30%,transparent 56%),linear-gradient(145deg,rgba(249,251,255,.66),rgba(244,248,253,.47))!important;
    border-color:rgba(255,255,255,.72)!important;
    box-shadow:0 22px 62px rgba(31,48,80,.12),inset 0 1px 0 rgba(255,255,255,.91)!important;
    backdrop-filter:blur(23px) saturate(168%) brightness(1.025) contrast(1.02)!important;
    -webkit-backdrop-filter:blur(23px) saturate(168%) brightness(1.025) contrast(1.02)!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"][data-flow-glass-mode="optical"][data-theme="dark"] body #dashboard.product-shell:not(.hidden) #desktopSidebar.desktop-sidebar{
    background:radial-gradient(150% 105% at -8% -4%,rgba(255,255,255,.16) 0%,rgba(255,255,255,.035) 31%,transparent 57%),linear-gradient(145deg,rgba(25,31,39,.65),rgba(17,21,27,.51))!important;
    border-color:rgba(255,255,255,.15)!important;
    box-shadow:0 24px 66px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.16)!important;
    backdrop-filter:blur(23px) saturate(142%) brightness(.965) contrast(1.035)!important;
    -webkit-backdrop-filter:blur(23px) saturate(142%) brightness(.965) contrast(1.035)!important;
  }
}
/* Content proportions have only two families: phone and desktop. Tablet chrome
   stays tablet-specific, but tablet content uses the same proportions as desktop. */
@media (min-width:521px) and (min-height:521px){
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid,
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid{
    display:grid!important;
    grid-template-columns:minmax(0,1.42fr) minmax(0,.72fr)!important;
    align-items:start!important;
    gap:16px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.timetable-card,
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack,
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.timetable-card,
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack{
    grid-column:auto!important;
    min-width:0!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack,
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard.product-shell:not(.hidden) main.product-main #todayView.view:not(.hidden)>.today-grid>.right-stack{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    gap:16px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard #scheduleView .schedule-layout,
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #scheduleView .schedule-layout{
    display:grid!important;
    grid-template-columns:minmax(0,1.16fr) minmax(0,.84fr)!important;
    align-items:start!important;
    gap:16px!important;
  }
}
@media (max-width:1180px) and (max-height:620px) and (orientation:landscape){
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard #scheduleView .schedule-layout > .content-card:not(.calendar-card){
    padding-top:10px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard #scheduleView #scheduleGrid{
    margin-top:-3px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard #transitView.flow-transit-focused .flow-transit-search{
    margin-bottom:6px!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard #transitView.flow-transit-focused .flow-transit-summary{
    margin-bottom:0!important;
  }
}
@media (min-width:1181px) and (max-width:1366px) and (max-height:620px) and (orientation:landscape){
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body:has(#flowSchoolSettingsView:not(.hidden)) #dashboard.product-shell:not(.hidden){
    display:block!important;
    width:100%!important;
    max-width:none!important;
    margin:0!important;
    padding:0 14px 20px!important;
    grid-template-columns:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body:has(#flowSchoolSettingsView:not(.hidden)) #dashboard:not(.hidden) .desktop-sidebar{
    display:none!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body:has(#flowSchoolSettingsView:not(.hidden)) #dashboard:not(.hidden) .mobile-topbar{
    display:grid!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body:has(#flowSchoolSettingsView:not(.hidden)) #dashboard:not(.hidden) #bottomNav.mobile-bottom-nav{
    display:grid!important;
  }
}
`;
  document.head.appendChild(style);
}

function applyLayoutState(){
  const mode=layoutMode();
  root.dataset.flowSchoolLayout=mode;
  root.dataset.flowSchoolTabletRotation=mode==='desktop'?'wide':'compact';
  root.dataset.flowTodayTopbar=mode==='desktop'?'wide':'ready';
  root.dataset.flowSchoolResponsiveContract='v2';
}

function syncLayoutState(){
  cancelAnimationFrame(syncFrame);
  syncFrame=requestAnimationFrame(applyLayoutState);
}

ensureLayoutStyle();
applyLayoutState();
window.addEventListener('resize',syncLayoutState,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(syncLayoutState,60),{passive:true});
window.visualViewport?.addEventListener?.('resize',syncLayoutState,{passive:true});
