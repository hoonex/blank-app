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
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView .timetable-card,
html[data-flow-school-ui="v2"][data-flow-school-layout="desktop"] body #dashboard #todayView .right-stack{
  grid-column:auto!important;
}
@media (max-width:1180px) and (max-height:620px) and (orientation:landscape){
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard #todayView .status-card:not(.flow-home-noise){
    border:0!important;
  }
  html[data-flow-school-ui="v2"][data-flow-school-layout="tablet"] body #dashboard #scheduleView .schedule-layout > .content-card:not(.calendar-card){
    padding-top:10px!important;
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
