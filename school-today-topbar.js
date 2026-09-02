import './school-today-exam-feed.js';

const root=document.documentElement;
const $=(selector,host=document)=>host.querySelector(selector);
const DATE_DOCK_ID='flowTodayDateDock';
const STYLE_ID='flow-school-today-deck-style';
let currentIso='';
let todayIso='';
let drag=null;
let settleTimer=0;
let liveTimer=0;
let suppressClickUntil=0;

function pad(value){return String(value).padStart(2,'0')}
function toIso(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function fromIso(value){const[y,m,d]=String(value||'').split('-').map(Number);return y&&m&&d?new Date(y,m-1,d,12):new Date()}
function addDays(value,delta){const date=fromIso(value);date.setDate(date.getDate()+delta);return toIso(date)}
function isToday(value){return value===toIso(new Date())}
function weekday(date){return new Intl.DateTimeFormat('ko-KR',{weekday:'short'}).format(date).replace('요일','')}
function activeIso(){return $('#datePicker')?.value||currentIso||toIso(new Date())}
function shortLandscape(){return matchMedia('(max-width:900px) and (max-height:520px) and (orientation:landscape)').matches}
function offsets(){
  if(matchMedia('(max-width:520px)').matches||shortLandscape())return[-1,0,1];
  return[-2,-1,0,1,2];
}
function ensureResponsiveStyle(){
  let link=document.querySelector('link[data-flow-school-today-responsive],link[href*="school-today-responsive.css"]');
  if(!link){link=document.createElement('link');link.rel='stylesheet';link.dataset.flowSchoolTodayResponsive='';document.head.append(link)}
  const next='/school-today-responsive.css?v=20260901-2';if(!link.href.endsWith(next))link.href=next;
}
function installStyle(){
  if($(`#${STYLE_ID}`))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
html[data-flow-school-ui="v2"] #${DATE_DOCK_ID}{display:none}
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#${DATE_DOCK_ID}){
    display:grid!important;grid-template-columns:auto minmax(180px,520px) minmax(104px,154px)!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;
    width:100%!important;min-height:60px!important;height:auto!important;padding:5px clamp(8px,1.8vw,18px)!important;box-sizing:border-box!important;
    background:color-mix(in srgb,var(--surface) 88%,var(--bg))!important;border:0!important;box-shadow:none!important;overflow:visible!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo{min-width:44px!important;min-height:44px!important;align-self:center!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy strong{font-size:1.08rem!important;font-weight:850!important;letter-spacing:-.06em!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy small{display:none!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button{
    position:relative!important;inset:auto!important;display:grid!important;align-content:center!important;justify-items:start!important;
    min-width:104px!important;max-width:154px!important;min-height:44px!important;height:44px!important;margin:0!important;padding:5px 9px!important;
    border:0!important;border-radius:14px!important;corner-shape:squircle!important;background:color-mix(in srgb,var(--surface) 78%,transparent)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.72)!important;text-align:left!important;backdrop-filter:blur(14px) saturate(1.08)!important;-webkit-backdrop-filter:blur(14px) saturate(1.08)!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span,
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span{font-size:.62rem!important;font-weight:850!important;letter-spacing:-.025em!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{margin-top:1px!important;color:var(--muted)!important;font-size:.48rem!important;font-weight:680!important}

  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}{
    --flow-date-x:0px;--flow-date-count:5;display:grid!important;grid-template-columns:44px minmax(0,1fr) 44px!important;align-items:center!important;justify-self:center!important;
    width:min(100%,520px)!important;min-width:0!important;height:50px!important;padding:3px 4px!important;box-sizing:border-box!important;
    border:0!important;border-radius:18px!important;corner-shape:squircle!important;background:color-mix(in srgb,var(--surface) 68%,transparent)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.76),0 5px 18px rgba(43,57,78,.045)!important;
    backdrop-filter:blur(18px) saturate(1.1)!important;-webkit-backdrop-filter:blur(18px) saturate(1.1)!important;
    overflow:visible!important;touch-action:pan-y!important;user-select:none!important;-webkit-user-select:none!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge{
    display:grid!important;place-items:center!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;padding:0!important;border:0!important;border-radius:13px!important;
    background:transparent!important;color:color-mix(in srgb,var(--text) 66%,var(--muted))!important;box-shadow:none!important;font-size:1rem!important;line-height:1!important;cursor:pointer!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge:active{transform:scale(.94)!important;background:color-mix(in srgb,var(--surface-2) 58%,transparent)!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport{
    position:relative!important;grid-column:2;width:100%!important;height:44px!important;min-width:0!important;overflow:hidden!important;border-radius:14px!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-focus{
    position:absolute!important;z-index:0!important;top:0!important;bottom:0!important;left:50%!important;width:calc(100% / var(--flow-date-count,5))!important;transform:translateX(-50%)!important;
    border-radius:13px!important;corner-shape:squircle!important;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 7%,var(--surface)),color-mix(in srgb,var(--surface) 88%,transparent))!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.86),0 4px 12px color-mix(in srgb,var(--accent) 8%,transparent)!important;pointer-events:none!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-focus::before{
    content:"";position:absolute;top:3px;left:50%;width:12px;height:2px;transform:translateX(-50%);border-radius:2px;background:color-mix(in srgb,var(--accent) 74%,transparent)
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-rail{
    position:relative!important;z-index:1!important;display:grid!important;grid-template-columns:repeat(var(--flow-date-count,5),minmax(0,1fr))!important;align-items:center!important;width:100%!important;height:44px!important;
    transform:translate3d(var(--flow-date-x,0px),0,0)!important;transition:transform .28s cubic-bezier(.16,1,.3,1)!important;will-change:transform!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}[data-dragging="true"] .flow-date-rail{transition:none!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day{
    position:relative!important;display:grid!important;grid-template-columns:auto auto!important;grid-template-rows:1fr auto!important;place-content:center!important;align-items:center!important;column-gap:3px!important;row-gap:0!important;
    width:calc(100% - 2px)!important;height:44px!important;min-height:44px!important;margin:auto!important;padding:3px 1px!important;box-sizing:border-box!important;border:0!important;border-radius:12px!important;
    background:transparent!important;color:var(--muted)!important;box-shadow:none!important;opacity:.64!important;transform:scale(.92)!important;
    transition:transform .22s cubic-bezier(.16,1,.3,1),opacity .18s ease,color .18s ease!important;cursor:pointer!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day[data-near="true"]{opacity:.84!important;transform:scale(.96)!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day[data-active="true"]{opacity:1!important;transform:scale(1)!important;color:var(--accent)!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-week{grid-row:1;align-self:end;font-size:.46rem!important;font-weight:780!important;line-height:1!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-num{grid-row:1;align-self:end;font-size:.78rem!important;font-weight:900!important;line-height:.95!important;letter-spacing:-.05em!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-today{grid-column:1/-1;grid-row:2;height:9px!important;color:var(--accent)!important;font-size:.39rem!important;font-weight:820!important;line-height:1!important;letter-spacing:-.02em!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-dots{display:none!important}

  html[data-flow-school-ui="v2"] body #todayView .timetable-actions{gap:2px!important}
  html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action,
  html[data-flow-school-ui="v2"] body #todayView .timetable-actions>.neo-button{
    min-height:44px!important;height:44px!important;padding:0 9px!important;background:transparent!important;box-shadow:none!important;border-radius:11px!important;font-size:.57rem!important
  }
  html[data-flow-school-ui="v2"] body #todayView #editSubjectsBtn.flow-school-utility-action{background:transparent!important;color:var(--accent)!important;box-shadow:none!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle{height:44px!important;min-width:98px!important;padding:5px!important;background:transparent!important;box-shadow:none!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button{min-height:34px!important;height:34px!important;padding:0 9px!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button.active{box-shadow:0 2px 8px rgba(43,57,78,.055),inset 0 1px 0 rgba(255,255,255,.76)!important}

  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] body #todayView .school-hero{height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:hidden!important}
  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] body #todayView .school-hero>*{display:none!important}
}
@media(max-width:720px){
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#${DATE_DOCK_ID}){grid-template-columns:auto minmax(150px,1fr) minmax(92px,118px)!important;gap:5px!important;min-height:58px!important;padding:4px 7px!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy strong{font-size:.94rem!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button{min-width:92px!important;max-width:118px!important;padding-inline:7px!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span{font-size:.57rem!important}html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{font-size:.44rem!important}
}
@media(max-width:520px){
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#${DATE_DOCK_ID}){grid-template-columns:44px minmax(0,1fr) minmax(88px,104px)!important;min-height:56px!important;padding:3px 5px!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy strong{font-size:.88rem!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button{min-width:88px!important;max-width:104px!important;height:44px!important;padding:5px 6px!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{display:none!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}{--flow-date-count:3;grid-template-columns:minmax(0,1fr)!important;height:48px!important;padding:2px!important;border-radius:16px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge{display:none!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport{grid-column:1!important}
}
@media(max-width:900px) and (max-height:520px) and (orientation:landscape){
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#${DATE_DOCK_ID}){
    position:relative!important;display:flex!important;align-items:center!important;justify-content:space-between!important;min-height:50px!important;height:50px!important;padding:3px 8px!important;gap:0!important
  }
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID}{
    --flow-date-count:3;position:absolute!important;left:max(54px,calc(env(safe-area-inset-left) + 48px))!important;top:3px!important;width:clamp(138px,20vw,170px)!important;height:44px!important;
    grid-template-columns:minmax(0,1fr)!important;padding:0!important;border-radius:14px!important;background:color-mix(in srgb,var(--surface) 54%,transparent)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.65)!important
  }
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID} .flow-date-edge{display:none!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID} .flow-date-viewport{grid-column:1!important;height:44px!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID} .flow-date-rail{height:44px!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID} .flow-date-day{height:44px!important;min-height:44px!important;padding:2px 0!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID} .flow-date-week{font-size:.4rem!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID} .flow-date-num{font-size:.68rem!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID} .flow-date-today{height:7px!important;font-size:.34rem!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-school-button{height:44px!important;min-height:44px!important;max-width:20vw!important}
}
@media(prefers-reduced-motion:reduce){html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} :is(.flow-date-rail,.flow-date-day){transition:none!important}}
`;
  document.head.append(style);
}
function renderRail(){
  const dock=$(`#${DATE_DOCK_ID}`),rail=$('.flow-date-rail',dock);if(!dock||!rail)return;
  currentIso=activeIso();const list=offsets();dock.style.setProperty('--flow-date-count',String(list.length));rail.style.setProperty('--flow-date-x','0px');
  dock.dataset.todaySelected=String(isToday(currentIso));
  rail.replaceChildren(...list.map(offset=>{
    const value=addDays(currentIso,offset),date=fromIso(value),button=document.createElement('button');button.type='button';button.className='flow-date-day';button.dataset.offset=String(offset);button.dataset.iso=value;button.dataset.active=String(offset===0);button.dataset.near=String(Math.abs(offset)===1);button.setAttribute('aria-label',new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(date));button.setAttribute('aria-current',offset===0?'date':'false');button.innerHTML=`<span class="flow-date-week">${weekday(date)}</span><strong class="flow-date-num">${date.getDate()}</strong><span class="flow-date-today">${isToday(value)?'오늘':''}</span>`;return button;
  }));
}
function setDate(value,{feedback=true}={}){
  const picker=$('#datePicker');if(!picker)return;picker.value=value;currentIso=value;renderRail();picker.dispatchEvent(new Event('change',{bubbles:true}));if(feedback&&navigator.vibrate)navigator.vibrate(7);
}
function shift(delta){setDate(addDays(activeIso(),delta))}
function resetDrag(){const dock=$(`#${DATE_DOCK_ID}`),rail=$('.flow-date-rail',dock);if(!dock||!rail)return;dock.dataset.dragging='false';rail.style.setProperty('--flow-date-x','0px');drag=null}
function settle(direction){
  const dock=$(`#${DATE_DOCK_ID}`),rail=$('.flow-date-rail',dock);if(!dock||!rail)return;clearTimeout(settleTimer);dock.dataset.dragging='false';
  if(!direction){rail.style.setProperty('--flow-date-x','0px');drag=null;return}
  const count=Math.max(3,offsets().length),amount=(direction>0?-100:100)/count;rail.style.setProperty('--flow-date-x',`${amount}%`);
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;settleTimer=setTimeout(()=>{shift(direction);drag=null},reduced?0:150);
}
function onPointerDown(event){
  if(event.button!==undefined&&event.button!==0)return;if(event.target.closest?.('[data-date-edge]'))return;
  const dock=$(`#${DATE_DOCK_ID}`);if(!dock)return;clearTimeout(settleTimer);dock.dataset.dragging='true';drag={id:event.pointerId,x:event.clientX,lastX:event.clientX,lastT:performance.now(),velocity:0,moved:false};try{dock.setPointerCapture?.(event.pointerId)}catch{}
}
function onPointerMove(event){
  if(!drag||event.pointerId!==drag.id)return;const rail=$(`#${DATE_DOCK_ID} .flow-date-rail`);if(!rail)return;
  const now=performance.now(),dt=Math.max(8,now-drag.lastT),step=event.clientX-drag.lastX;drag.velocity=drag.velocity*.55+(step/dt)*.45;drag.lastX=event.clientX;drag.lastT=now;
  const raw=event.clientX-drag.x;if(Math.abs(raw)>6)drag.moved=true;const sign=Math.sign(raw),distance=Math.abs(raw),elastic=sign*Math.min(96,distance<=54?distance:54+(distance-54)*.26);rail.style.setProperty('--flow-date-x',`${elastic.toFixed(1)}px`);
}
function onPointerUp(event){
  if(!drag||event.pointerId!==drag.id)return;const dx=event.clientX-drag.x,velocity=drag.velocity;if(drag.moved)suppressClickUntil=performance.now()+280;try{$(`#${DATE_DOCK_ID}`)?.releasePointerCapture?.(event.pointerId)}catch{}
  const direction=Math.abs(dx)>=32||Math.abs(velocity)>=.3?(dx<0||velocity<-.3?1:-1):0;settle(direction);
}
function syncLiveDate(){
  const nextToday=toIso(new Date());
  if(!todayIso){todayIso=nextToday;return}
  if(nextToday===todayIso)return;
  const wasFollowingToday=activeIso()===todayIso;todayIso=nextToday;
  if(wasFollowingToday)setDate(nextToday,{feedback:false});else renderRail();
}
function buildDock(){
  const topbar=$('.mobile-topbar');if(!topbar)return;let dock=$(`#${DATE_DOCK_ID}`);if(dock)return dock;
  dock=document.createElement('div');dock.id=DATE_DOCK_ID;dock.dataset.dragging='false';dock.setAttribute('aria-label','날짜 탐색');dock.innerHTML='<button class="flow-date-edge" data-date-edge="prev" type="button" aria-label="이전 날짜">‹</button><div class="flow-date-viewport"><div class="flow-date-focus" aria-hidden="true"></div><div class="flow-date-rail"></div></div><button class="flow-date-edge" data-date-edge="next" type="button" aria-label="다음 날짜">›</button><div class="flow-date-dots" aria-hidden="true"></div>';
  const school=$('#mobileSchoolBtn');if(school)topbar.insertBefore(dock,school);else topbar.append(dock);
  dock.addEventListener('click',event=>{if(performance.now()<suppressClickUntil)return;const edge=event.target.closest('[data-date-edge]');if(edge){shift(edge.dataset.dateEdge==='next'?1:-1);return}const day=event.target.closest('.flow-date-day');if(day?.dataset.iso&&day.dataset.iso!==activeIso())setDate(day.dataset.iso)});
  dock.addEventListener('pointerdown',onPointerDown);dock.addEventListener('pointermove',onPointerMove);dock.addEventListener('pointerup',onPointerUp);dock.addEventListener('pointercancel',resetDrag);renderRail();return dock;
}
function syncMode(){ensureResponsiveStyle();buildDock();renderRail();root.dataset.flowTodayTopbar=matchMedia('(max-width:1180px)').matches?'ready':'wide'}
function init(){
  ensureResponsiveStyle();installStyle();todayIso=toIso(new Date());buildDock();syncMode();
  document.addEventListener('change',event=>{if(event.target.matches?.('#datePicker'))requestAnimationFrame(renderRail)});
  document.addEventListener('click',event=>{if(event.target.closest?.('#todayBtn,#prevDay,#nextDay,[data-view="today"]'))requestAnimationFrame(renderRail)});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncLiveDate();requestAnimationFrame(renderRail)}});
  addEventListener('resize',()=>requestAnimationFrame(syncMode),{passive:true});window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(syncMode),{passive:true});
  liveTimer=setInterval(syncLiveDate,30000);addEventListener('pagehide',()=>clearInterval(liveTimer),{once:true});
  setTimeout(syncMode,120);setTimeout(syncMode,700);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();