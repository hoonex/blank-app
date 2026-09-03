const root=document.documentElement;
const $=(selector,host=document)=>host?.querySelector?.(selector)||null;
const $$=(selector,host=document)=>[...(host?.querySelectorAll?.(selector)||[])];
const AMBIENT_KEY='flow-ambient-v1';
const MODE_KEY='flow-school-timetable-mode-v1';
let syncFrame=0;

function installStyle(){
  let style=$('#flow-school-runtime-contract-v6');
  if(!style){
    style=document.createElement('style');
    style.id='flow-school-runtime-contract-v6';
    style.textContent=`
/* One authoritative Today/Week state. Later responsive rules must never revive both bodies. */
html[data-flow-school-ui="v2"] body.flow-inline-week-active #todayView .timetable-card #dayStrip,
html[data-flow-school-ui="v2"] body.flow-inline-week-active #todayView .timetable-card #timetable{display:none!important}
html[data-flow-school-ui="v2"] body.flow-inline-week-active #todayView .timetable-card #inlineWeekTimetable{display:grid!important}
html[data-flow-school-ui="v2"] body:not(.flow-inline-week-active) #todayView .timetable-card #inlineWeekTimetable{display:none!important}
html[data-flow-school-ui="v2"] body.flow-inline-week-active #weekView{display:none!important;position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important;pointer-events:none!important}

/* Controls share a single physical geometry on phones and touch tablets. */
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #todayView .timetable-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;flex-wrap:nowrap!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle{
    position:relative!important;inset:auto!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:stretch!important;
    width:116px!important;min-width:116px!important;height:44px!important;min-height:44px!important;margin:0!important;padding:4px!important;box-sizing:border-box!important;
    border:0!important;border-radius:12px!important;corner-shape:round!important;overflow:hidden!important;background:color-mix(in srgb,var(--surface-2) 88%,var(--surface))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.64)!important
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle>button{
    position:relative!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;align-self:stretch!important;
    width:100%!important;min-width:0!important;height:36px!important;min-height:36px!important;margin:0!important;padding:0 8px!important;box-sizing:border-box!important;
    border:0!important;border-radius:9px!important;corner-shape:round!important;background:transparent!important;color:var(--muted)!important;box-shadow:none!important;
    font-size:.62rem!important;font-weight:820!important;line-height:1!important;vertical-align:middle!important;transform:none!important;translate:none!important
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle>button.active{
    background:var(--surface)!important;color:var(--accent)!important;box-shadow:0 4px 12px rgba(43,57,78,.08),inset 0 1px 0 rgba(255,255,255,.78)!important
  }
  html[data-flow-school-ui="v2"] body #todayView :is(.flow-school-utility-action,.timetable-actions>.neo-button,#allergyBtn){
    min-height:44px!important;height:44px!important;margin:0!important;padding:0 12px!important;box-sizing:border-box!important;
    border-radius:12px!important;corner-shape:round!important;font-size:.61rem!important;line-height:1!important
  }
  html[data-flow-school-ui="v2"] body #todayView .inline-week-toolbar .week-controls .neo-button{
    min-height:44px!important;height:44px!important;border-radius:12px!important;corner-shape:round!important
  }
}

/* Bottom navigation uses ordinary rounded rectangles. No squircle or giant pill shell. */
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav{
    min-height:58px!important;height:58px!important;padding:5px!important;border-radius:16px!important;corner-shape:round!important;overflow:hidden!important
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.mobile-tab{
    min-height:48px!important;height:48px!important;border-radius:11px!important;corner-shape:round!important
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav::before,
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    border-radius:11px!important;corner-shape:round!important
  }
}

/* Time ambience must be visible through the School shell instead of stopping behind an opaque page. */
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body{
  background-color:var(--bg)!important;
  background-image:
    radial-gradient(920px 620px at var(--flow-ambient-x,50%) -110px,color-mix(in srgb,var(--flow-ambient-a) 88%,transparent),transparent 68%),
    radial-gradient(760px 520px at calc(100% - var(--flow-ambient-x,50%)) 112%,color-mix(in srgb,var(--flow-ambient-b) 76%,transparent),transparent 70%),
    linear-gradient(145deg,color-mix(in srgb,var(--flow-ambient-a) 42%,var(--bg)),color-mix(in srgb,var(--flow-ambient-b) 38%,var(--bg)))!important;
  background-attachment:fixed!important
}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body :is(.product-shell,.product-main){background-color:color-mix(in srgb,var(--bg) 62%,transparent)!important;background-image:none!important}
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body .mobile-topbar{background-color:color-mix(in srgb,var(--bg) 70%,transparent)!important;backdrop-filter:blur(18px) saturate(1.08)!important;-webkit-backdrop-filter:blur(18px) saturate(1.08)!important}
/* Secondary School destinations intentionally flatten the Today date deck, but
   an explicit light theme must keep the shared topbar visibly light even when a
   dark mobile OS is forcing page colors. Match that structural selector so this
   contract wins regardless of when the responsive stylesheet finishes loading. */
html[data-flow-school-ui="v2"][data-theme="light"][data-theme-mode="light"] body #dashboard.product-shell:not(:has(#todayView:not(.hidden))) .mobile-topbar:has(#flowTodayDateDock){
  background:color-mix(in srgb,var(--bg) 94%,var(--surface))!important;
  background-color:color-mix(in srgb,var(--bg) 94%,var(--surface))!important
}

/* Coarse-pointer landscape keeps the same mobile information architecture up to tablet widths. */
@media(orientation:landscape) and (pointer:coarse) and (hover:none) and (max-width:1366px){
  html[data-flow-school-ui="v2"] body{overflow-x:hidden!important;padding-bottom:76px!important}
  html[data-flow-school-ui="v2"] body #dashboard.product-shell:not(.hidden){display:block!important;width:100%!important;max-width:none!important;padding:0 14px 18px!important;grid-template-columns:none!important}
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .desktop-sidebar{display:none!important}
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .product-main{width:100%!important;max-width:none!important;min-width:0!important;margin:0!important;padding:0!important}
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .mobile-topbar:has(#flowTodayDateDock){
    position:sticky!important;top:0!important;z-index:70!important;display:grid!important;grid-template-columns:auto minmax(260px,560px) minmax(108px,150px)!important;align-items:center!important;justify-content:space-between!important;
    width:100%!important;min-height:60px!important;height:60px!important;padding:5px 8px!important;gap:8px!important;box-sizing:border-box!important;border:0!important;box-shadow:none!important;overflow:visible!important
  }
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .mobile-topbar .flow-logo{display:flex!important;min-width:44px!important;min-height:44px!important;align-items:center!important}
  html[data-flow-school-ui="v2"] body #dashboard:not(.hidden) .mobile-school-button{display:grid!important;min-width:108px!important;max-width:150px!important;height:44px!important;min-height:44px!important;border-radius:12px!important;corner-shape:round!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #flowTodayDateDock{
    display:grid!important;width:min(100%,560px)!important;height:50px!important;min-height:50px!important;padding:3px 0!important;grid-template-columns:44px minmax(0,1fr) 44px!important;grid-template-rows:auto!important;border-radius:0!important;background:transparent!important;box-shadow:none!important
  }
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #flowTodayDateDock .flow-date-edge{display:grid!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #flowTodayDateDock :is(.flow-date-viewport,.flow-date-rail){height:44px!important}
  html[data-flow-school-ui="v2"] body #dashboard #todayView #schoolHero{display:none!important}
  html[data-flow-school-ui="v2"] body #todayView{max-width:1180px!important;margin-inline:auto!important;padding:4px 10px 12px!important}
  html[data-flow-school-ui="v2"] body #todayView .status-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin:8px 0 12px!important}
  html[data-flow-school-ui="v2"] body #todayView .today-grid{gap:12px!important}
  html[data-flow-school-ui="v2"] body #todayView .right-stack{grid-template-columns:minmax(0,.96fr) minmax(0,1.04fr)!important;gap:12px!important}
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav{
    display:grid!important;position:fixed!important;z-index:90!important;top:auto!important;bottom:max(9px,env(safe-area-inset-bottom))!important;left:50%!important;right:auto!important;
    width:min(620px,calc(100% - 28px))!important;min-height:58px!important;height:58px!important;padding:5px!important;transform:translateX(-50%)!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;grid-template-rows:48px!important;gap:2px!important;border-radius:16px!important;corner-shape:round!important;overflow:hidden!important
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.mobile-tab{height:48px!important;min-height:48px!important;border-radius:11px!important;corner-shape:round!important}
  html[data-flow-school-ui="v2"] body #flowSchoolSettingsView:not(.hidden){inset:60px 0 72px!important;padding:12px 14px 28px!important}
}

@media(orientation:landscape) and (pointer:coarse) and (hover:none) and (max-height:520px) and (max-width:1366px){
  html[data-flow-school-ui="v2"] body #todayView .status-card:not(.flow-home-noise){min-height:88px!important;padding:11px 13px!important}
  html[data-flow-school-ui="v2"] body #todayView .period-button{min-height:54px!important}
  html[data-flow-school-ui="v2"] body #todayView .right-stack>:is(.meal-card,.upcoming-card){min-height:250px!important}
}
`;
    document.head.append(style);
  }
  if(style.parentElement===document.head)document.head.append(style);
}

function ambientPhase(date=new Date()){
  const h=date.getHours()+date.getMinutes()/60;
  if(h<6.5)return'night';
  if(h<8.5)return'dawn';
  if(h<16.5)return'day';
  if(h<18.5)return'golden';
  if(h<21)return'evening';
  return'night';
}
const AMBIENT={
  light:{dawn:['#f7dfd8','#d9e8ff'],day:['#dcecff','#f6f8fc'],golden:['#f9d9a5','#e2eaf8'],evening:['#e9daf5','#d8e7fb'],night:['#d6e3f6','#eee5f6']},
  dark:{dawn:['#302a39','#26364a'],day:['#1e3041','#27333f'],golden:['#3c2f27','#263548'],evening:['#332a40','#233449'],night:['#162638','#222c3e']}
};
function setAttrIfChanged(node,name,value){if(node&&node.getAttribute(name)!==value)node.setAttribute(name,value)}
function syncAmbient(){
  const on=localStorage.getItem(AMBIENT_KEY)!=='off';
  const phase=ambientPhase();
  const theme=root.dataset.theme==='dark'?'dark':'light';
  const palette=AMBIENT[theme][phase];
  const ambient=on?'on':'off';
  if(root.dataset.flowAmbient!==ambient)root.dataset.flowAmbient=ambient;
  if(root.dataset.flowAmbientPhase!==phase)root.dataset.flowAmbientPhase=phase;
  if(root.style.getPropertyValue('--flow-ambient-a')!==palette[0])root.style.setProperty('--flow-ambient-a',palette[0]);
  if(root.style.getPropertyValue('--flow-ambient-b')!==palette[1])root.style.setProperty('--flow-ambient-b',palette[1]);
  const now=new Date(),minutes=now.getHours()*60+now.getMinutes(),x=`${Math.max(8,Math.min(92,8+(minutes/1439)*84)).toFixed(1)}%`;
  if(root.style.getPropertyValue('--flow-ambient-x')!==x)root.style.setProperty('--flow-ambient-x',x);
}

function normalizeInlineWeekButton(){
  const week=$('.timetable-mode-toggle .timetable-mode-button');
  if(!week)return false;
  /* Preserve the semantic Week selector after reparenting so all responsive and
     functional contracts still see the control. During click dispatch only, hide
     data-view before school.js's legacy route listener reads it, then restore it. */
  if(week.dataset.view!=='week')week.dataset.view='week';
  if(week.dataset.timetableMode!=='week')week.dataset.timetableMode='week';
  setAttrIfChanged(week,'aria-label','주간 시간표');
  if(week.dataset.flowLegacyWeekGuard!=='true'){
    week.dataset.flowLegacyWeekGuard='true';
    week.addEventListener('click',()=>{
      week.removeAttribute('data-view');
      queueMicrotask(()=>{if(week.isConnected)week.dataset.view='week'});
    },{capture:true});
  }
  return true;
}
function reconcileTimetableMode(){
  const shell=$('#inlineWeekTimetable');
  if(!shell)return false;
  normalizeInlineWeekButton();
  const weekly=document.body.classList.contains('flow-inline-week-active');
  shell.classList.toggle('hidden',!weekly);
  $('#weekView')?.classList.add('hidden');
  const daily=$('#timetable');
  setAttrIfChanged(daily,'aria-hidden',String(weekly));
  setAttrIfChanged(shell,'aria-hidden',String(!weekly));
  const title=$('#todayView .timetable-card .card-heading h2');
  if(title){const next=weekly?'주간 시간표':'오늘 시간표';if(title.textContent!==next)title.textContent=next}
  const mode=weekly?'week':'today';
  if(localStorage.getItem(MODE_KEY)!==mode)localStorage.setItem(MODE_KEY,mode);
  return true;
}
function scheduleSync(){
  if(syncFrame)return;
  syncFrame=requestAnimationFrame(()=>{
    syncFrame=0;
    installStyle();
    reconcileTimetableMode();
    syncAmbient();
  });
}
function bind(){
  const observer=new MutationObserver(records=>{
    if(records.some(record=>record.target===document.body||record.type==='childList'))scheduleSync();
  });
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  new MutationObserver(records=>{if(records.some(record=>record.attributeName==='data-flow-school-ui-styles'||record.attributeName==='data-flow-school-ui'))scheduleSync()}).observe(root,{attributes:true});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-flow-experience-toggle="ambient"]'))setTimeout(syncAmbient,0);
    if(event.target.closest?.('.timetable-mode-toggle button,#editSubjectsBtn,[data-view="today"],[data-view="schedule"],[data-view="school"]'))setTimeout(reconcileTimetableMode,0);
  },{capture:false});
  addEventListener('storage',event=>{if(event.key===AMBIENT_KEY)syncAmbient()});
  addEventListener('resize',scheduleSync,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(scheduleSync,80),{passive:true});
}

function init(){
  installStyle();
  syncAmbient();
  reconcileTimetableMode();
  bind();
  [0,80,240,700,1400].forEach(delay=>setTimeout(scheduleSync,delay));
  root.dataset.flowSchoolRuntimeV6='ready';
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
