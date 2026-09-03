const root=document.documentElement;
const $=(selector,host=document)=>host?.querySelector?.(selector)||null;
const $$=(selector,host=document)=>[...(host?.querySelectorAll?.(selector)||[])];
let weekDriving=false;

function installStyle(){
  if($('#flow-school-real-device-hotfix-style'))return;
  const style=document.createElement('style');
  style.id='flow-school-real-device-hotfix-style';
  style.textContent=`
/* Real-device phone pass: keep 44px hit targets, reduce visible chrome and let the
   timetable own the screen instead of surrounding cards. */
@media(max-width:520px){
  html[data-flow-school-ui="v2"] body #todayView{
    --flow-today-gap:9px!important;
    --flow-today-radius:17px!important;
    padding-inline:8px!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#flowTodayDateDock){
    min-height:56px!important;
    padding:3px 7px!important;
    gap:5px!important;
    background:color-mix(in srgb,var(--surface) 78%,transparent)!important;
    box-shadow:none!important;
    border-bottom:1px solid color-mix(in srgb,var(--text) 4%,transparent)!important;
  }
  html[data-flow-school-ui="v2"] body #dashboard .mobile-topbar .mobile-school-button{
    min-width:102px!important;
    max-width:118px!important;
    min-height:44px!important;
    height:44px!important;
    padding:3px 2px!important;
    border:0!important;
    border-radius:8px!important;
    corner-shape:round!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"] body #flowTodayDateDock .flow-date-focus{
    border-radius:11px!important;
    corner-shape:round!important;
    border-color:color-mix(in srgb,var(--accent) 12%,transparent)!important;
    background:color-mix(in srgb,var(--accent) 5%,transparent)!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"] body #flowTodayDateDock .flow-date-focus::before{opacity:.72!important}

  html[data-flow-school-ui="v2"] body #todayView .status-grid{
    gap:7px!important;
    margin:6px 0 9px!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .status-card:not(.flow-home-noise){
    min-height:72px!important;
    padding:10px 11px!important;
    border-radius:15px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--surface) 92%,transparent)!important;
    box-shadow:0 5px 16px rgba(43,57,78,.045),inset 0 1px 0 rgba(255,255,255,.62)!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .status-card strong{
    margin-top:4px!important;
    font-size:.78rem!important;
    line-height:1.18!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .status-card p{
    margin-top:3px!important;
    font-size:.49rem!important;
    line-height:1.28!important;
    display:-webkit-box!important;
    -webkit-box-orient:vertical!important;
    -webkit-line-clamp:2!important;
    overflow:hidden!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .progress-track{height:3px!important;margin-top:6px!important}

  html[data-flow-school-ui="v2"] body #todayView :is(.timetable-card,.meal-card,.upcoming-card){
    border-radius:17px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--surface) 94%,transparent)!important;
    box-shadow:0 6px 20px rgba(43,57,78,.045),inset 0 1px 0 rgba(255,255,255,.62)!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-card{padding:12px!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-card .card-heading{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    align-items:stretch!important;
    gap:7px!important;
    margin-bottom:9px!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-card .card-heading h2{
    font-size:.91rem!important;
    line-height:1.15!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-actions{
    display:grid!important;
    grid-template-columns:104px minmax(0,1fr) 64px!important;
    align-items:stretch!important;
    width:100%!important;
    gap:4px!important;
    transform:none!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle{
    order:1!important;
    width:104px!important;
    min-width:104px!important;
    height:44px!important;
    min-height:44px!important;
    padding:3px!important;
    border-radius:11px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--surface-2) 68%,transparent)!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button{
    min-height:38px!important;
    height:38px!important;
    padding:0 6px!important;
    border-radius:8px!important;
    corner-shape:round!important;
    font-size:.56rem!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button.active{
    box-shadow:0 2px 7px rgba(43,57,78,.055)!important;
  }
  html[data-flow-school-ui="v2"] body #todayView #editSubjectsBtn{
    order:2!important;
    width:100%!important;
  }
  html[data-flow-school-ui="v2"] body #todayView #shareTimetableBtn{
    order:3!important;
    width:64px!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action,
  html[data-flow-school-ui="v2"] body #todayView .timetable-actions>.neo-button{
    min-height:44px!important;
    height:44px!important;
    padding:0 7px!important;
    border-radius:10px!important;
    corner-shape:round!important;
    box-shadow:none!important;
    font-size:.55rem!important;
  }
  html[data-flow-school-ui="v2"] body.flow-inline-week-active #todayView .timetable-actions{
    display:flex!important;
    justify-content:flex-end!important;
  }
  html[data-flow-school-ui="v2"] body.flow-inline-week-active #todayView :is(#editSubjectsBtn,#shareTimetableBtn){display:none!important}

  html[data-flow-school-ui="v2"] body #todayView #timetable{gap:4px!important;margin-top:0!important}
  html[data-flow-school-ui="v2"] body #todayView .period-button{
    min-height:48px!important;
    height:auto!important;
    padding:5px 8px!important;
    border-radius:12px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--surface) 94%,var(--surface-2))!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .period-no{
    width:32px!important;
    min-width:32px!important;
    height:32px!important;
    border-radius:9px!important;
    corner-shape:round!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .period-name{font-size:.66rem!important}
  html[data-flow-school-ui="v2"] body #todayView .flow-period-time{font-size:.49rem!important;margin-top:0!important}

  html[data-flow-school-ui="v2"] body #todayView .inline-week-timetable{gap:7px!important}
  html[data-flow-school-ui="v2"] body #todayView .inline-week-toolbar{
    display:grid!important;
    grid-template-columns:minmax(0,1fr)!important;
    gap:5px!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .inline-week-toolbar #weekRangeText{
    font-size:.53rem!important;
    line-height:1.25!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .inline-week-toolbar .week-controls{
    display:grid!important;
    grid-template-columns:44px minmax(0,1fr) 44px!important;
    width:100%!important;
    gap:4px!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .inline-week-toolbar .week-controls .neo-button{
    width:100%!important;
    min-width:44px!important;
    min-height:44px!important;
    height:44px!important;
    padding:0!important;
    border-radius:10px!important;
    box-shadow:none!important;
    font-size:.56rem!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .week-table-wrap{
    width:100%!important;
    overflow-x:auto!important;
    overscroll-behavior-x:contain!important;
    scrollbar-width:none!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .week-table-wrap::-webkit-scrollbar{display:none!important}
  html[data-flow-school-ui="v2"] body #todayView .week-table{
    width:100%!important;
    min-width:320px!important;
    grid-template-columns:26px repeat(5,minmax(54px,1fr))!important;
    border-radius:11px!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .week-cell{
    min-height:36px!important;
    padding:4px 3px!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .week-head{min-height:32px!important;font-size:.51rem!important}
  html[data-flow-school-ui="v2"] body #todayView .week-period{font-size:.52rem!important}
  html[data-flow-school-ui="v2"] body #todayView .week-subject{font-size:.51rem!important;line-height:1.18!important}
  html[data-flow-school-ui="v2"] body #todayView .neis-timetable-help{
    margin-top:8px!important;
    padding-top:7px!important;
    font-size:.58rem!important;
  }
  html[data-flow-school-ui="v2"] body #todayView .neis-timetable-help summary{
    display:flex!important;
    align-items:center!important;
    min-height:44px!important;
  }

  /* The ad creative is 320x100. Do not spend another card's worth of height on it,
     and isolate the third-party iframe from glass/filter compositing on Android. */
  html[data-flow-school-ui="v2"] body .flow-adfit-rail--school-top:has(iframe),
  html[data-flow-school-ui="v2"] body .flow-adfit-rail--school-top:has(.flow-adfit-mock){
    width:100%!important;
    min-height:106px!important;
    height:auto!important;
    margin:5px 0 8px!important;
    padding:3px 0!important;
    gap:0!important;
    border:0!important;
    border-radius:0!important;
    corner-shape:round!important;
    background:transparent!important;
    box-shadow:none!important;
    filter:none!important;
    transform:none!important;
    backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;
    contain:layout paint!important;
    isolation:isolate!important;
  }
  html[data-flow-school-ui="v2"] body .flow-adfit-rail--school-top .flow-adfit-label{display:none!important}
  html[data-flow-school-ui="v2"] body .flow-adfit-rail--school-top .flow-adfit-slot{
    display:block!important;
    width:320px!important;
    max-width:100%!important;
    min-height:100px!important;
    height:100px!important;
    margin:0 auto!important;
    overflow:hidden!important;
    contain:layout paint!important;
    isolation:isolate!important;
    transform:none!important;
    filter:none!important;
    backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;
  }
  html[data-flow-school-ui="v2"] body .flow-adfit-rail--school-top .flow-adfit-slot>iframe{
    display:block!important;
    width:320px!important;
    max-width:100%!important;
    height:100px!important;
    margin:0!important;
    border:0!important;
    transform:none!important;
    filter:none!important;
  }

  /* The nav hit target remains 44px, but the bar and selected state stop reading as
     a second giant card floating over the timetable. */
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav{
    min-height:54px!important;
    height:54px!important;
    max-height:54px!important;
    padding:5px 6px!important;
    bottom:calc(8px + env(safe-area-inset-bottom))!important;
    border-radius:15px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--surface) 91%,transparent)!important;
    box-shadow:0 8px 24px rgba(36,48,69,.11)!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.mobile-tab{
    min-height:44px!important;
    height:44px!important;
    border-radius:9px!important;
    corner-shape:round!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.mobile-tab.active{
    background:transparent!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav::before{
    border-radius:10px!important;
    corner-shape:round!important;
    background:color-mix(in srgb,var(--accent) 6%,var(--surface))!important;
    border:1px solid color-mix(in srgb,var(--accent) 13%,transparent)!important;
    box-shadow:none!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{border-radius:10px!important}
  html[data-flow-school-ui="v2"] body .product-main{
    padding-bottom:calc(118px + env(safe-area-inset-bottom))!important;
    scroll-padding-bottom:calc(118px + env(safe-area-inset-bottom))!important;
  }

  html[data-flow-school-ui="v2"][data-flow-ambient="on"] body #todayView :is(.status-card,.timetable-card,.meal-card,.upcoming-card){
    background-color:color-mix(in srgb,var(--surface) 91%,transparent)!important;
  }
}
`;
  document.head.append(style);
}

function compactWeekControls(){
  if(!matchMedia('(max-width:520px)').matches)return;
  const prev=$('#prevWeek'),current=$('#thisWeekBtn'),next=$('#nextWeek');
  if(prev){prev.textContent='‹';prev.setAttribute('aria-label','이전 주')}
  if(current){current.textContent='이번 주';current.setAttribute('aria-label','이번 주')}
  if(next){next.textContent='›';next.setAttribute('aria-label','다음 주')}
}

function restoreInlineWeekShell(){
  const inline=$('#inlineWeekTimetable'),today=$('#todayView'),weekView=$('#weekView');
  if(!inline||!today)return;
  document.body.classList.add('flow-inline-week-active');
  today.classList.remove('hidden');
  inline.classList.remove('hidden');
  weekView?.classList.add('hidden');
  const title=$('.timetable-card .card-heading h2');if(title)title.textContent='주간 시간표';
  const weekButton=$('.timetable-mode-toggle .timetable-mode-button,[data-timetable-mode="week"]');
  const todayButton=$('[data-timetable-mode="today"]');
  todayButton?.classList.remove('active');todayButton?.setAttribute('aria-pressed','false');
  weekButton?.classList.add('active');weekButton?.setAttribute('aria-pressed','true');
  $$('#bottomNav>[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view==='today'));
  $$('.side-nav>[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view==='today'));
  if(location.pathname==='/week')history.replaceState({view:'today'},'', '/home');
}

function markWeekRenderState(){
  const table=$('#weekTable');
  const visibleCells=table?$$('.week-cell',table).filter(cell=>cell.getClientRects().length):[];
  root.dataset.flowInlineWeekCells=String(visibleCells.length);
  root.dataset.flowInlineWeekRendered=visibleCells.length>=6?'true':'false';
}

function driveWeekRender(){
  if(weekDriving)return;
  const inline=$('#inlineWeekTimetable');
  const legacy=$('.side-nav>[data-view="week"]');
  if(!inline||!legacy)return;
  weekDriving=true;
  try{
    /* school.js still owns the authoritative weekly data/render function. Its
       hidden desktop Week destination is the existing render entry point. Drive
       that owner once, then restore the public inline Today shell. This also
       leaves school.js in week mode so prev/next week data refreshes render the
       weekly table instead of silently repainting Today. */
    legacy.click();
    restoreInlineWeekShell();
    requestAnimationFrame(markWeekRenderState);
  }finally{weekDriving=false}
}

function installWeekRenderBridge(){
  const weekButton=$('.timetable-mode-toggle .timetable-mode-button,[data-timetable-mode="week"]');
  if(weekButton&&!weekButton.dataset.flowRealDeviceBridge){
    weekButton.dataset.flowRealDeviceBridge='true';
    weekButton.addEventListener('click',()=>setTimeout(driveWeekRender,0));
  }
  if(document.body.classList.contains('flow-inline-week-active'))setTimeout(driveWeekRender,0);
  const table=$('#weekTable');
  if(table&&!table.dataset.flowRealDeviceObserved){
    table.dataset.flowRealDeviceObserved='true';
    new MutationObserver(markWeekRenderState).observe(table,{childList:true,subtree:true});
    markWeekRenderState();
  }
}

function init(){
  installStyle();
  compactWeekControls();
  installWeekRenderBridge();
  root.dataset.flowSchoolRealDevice='v1';
  window.addEventListener('resize',compactWeekControls,{passive:true});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
