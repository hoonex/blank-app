import './school-today-exam-feed.js';

const root=document.documentElement;
const $=(selector,host=document)=>host.querySelector(selector);
const DATE_DOCK_ID='flowTodayDateDock';
const STYLE_ID='flow-school-today-deck-style';
let currentIso='';
let drag=null;
let settleTimer=0;
let suppressClickUntil=0;

function pad(value){return String(value).padStart(2,'0')}
function toIso(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function fromIso(value){const[y,m,d]=String(value||'').split('-').map(Number);return y&&m&&d?new Date(y,m-1,d,12):new Date()}
function addDays(value,delta){const date=fromIso(value);date.setDate(date.getDate()+delta);return toIso(date)}
function isToday(value){return value===toIso(new Date())}
function weekday(date){return new Intl.DateTimeFormat('ko-KR',{weekday:'short'}).format(date).replace('요일','')}
function activeIso(){return $('#datePicker')?.value||currentIso||toIso(new Date())}
function offsets(){
  if(matchMedia('(max-width:520px)').matches)return[-1,0,1];
  if(matchMedia('(max-width:900px) and (orientation:landscape)').matches)return[-2,-1,0,1,2];
  return[-3,-2,-1,0,1,2,3];
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
  html[data-flow-school-ui="v2"] body .mobile-topbar:has(#${DATE_DOCK_ID}){
    display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;align-items:center!important;gap:18px!important;
    width:100%!important;min-height:108px!important;padding:12px clamp(14px,3vw,34px)!important;box-sizing:border-box!important;
    background:transparent!important;border:0!important;box-shadow:none!important;overflow:visible!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo{min-width:max-content!important;align-self:center!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy strong{font-size:1.5rem!important;font-weight:850!important;letter-spacing:-.06em!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy small{display:none!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button{
    position:relative!important;inset:auto!important;display:grid!important;align-content:center!important;justify-items:start!important;
    min-width:144px!important;max-width:176px!important;min-height:58px!important;margin:0!important;padding:9px 13px!important;
    border:0!important;border-radius:18px!important;corner-shape:squircle!important;background:color-mix(in srgb,var(--surface) 94%,var(--surface-2))!important;
    box-shadow:0 9px 24px rgba(43,57,78,.08),inset 0 1px 0 rgba(255,255,255,.82)!important;text-align:left!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span,
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span{font-size:.68rem!important;font-weight:850!important;letter-spacing:-.025em!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{margin-top:3px!important;color:var(--muted)!important;font-size:.54rem!important;font-weight:680!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}{
    --flow-date-x:0px;display:grid!important;grid-template-columns:42px minmax(0,1fr) 42px!important;grid-template-rows:68px 8px!important;
    align-items:center!important;justify-self:center!important;width:min(100%,690px)!important;min-width:0!important;height:90px!important;padding:7px 9px 6px!important;
    box-sizing:border-box!important;border:0!important;border-radius:30px!important;corner-shape:squircle!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--surface) 78%,transparent),color-mix(in srgb,var(--surface-2) 72%,transparent))!important;
    box-shadow:0 16px 42px rgba(48,67,101,.11),inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(90,108,142,.06)!important;
    backdrop-filter:blur(22px) saturate(1.12)!important;-webkit-backdrop-filter:blur(22px) saturate(1.12)!important;
    overflow:visible!important;touch-action:pan-y!important;user-select:none!important;-webkit-user-select:none!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge{
    display:grid!important;place-items:center!important;width:40px!important;height:40px!important;padding:0!important;border:0!important;border-radius:14px!important;corner-shape:squircle!important;
    background:color-mix(in srgb,var(--surface) 83%,transparent)!important;color:var(--text)!important;box-shadow:0 4px 12px rgba(43,57,78,.06),inset 0 1px 0 rgba(255,255,255,.75)!important;
    font-size:1.25rem!important;line-height:1!important;cursor:pointer!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge:active{transform:scale(.95)!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport{grid-column:2;grid-row:1;width:100%!important;height:68px!important;min-width:0!important;overflow:hidden!important;border-radius:22px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-rail{
    display:grid!important;grid-template-columns:repeat(var(--flow-date-count,7),minmax(0,1fr))!important;align-items:center!important;width:100%!important;height:68px!important;
    transform:translate3d(var(--flow-date-x,0px),0,0)!important;transition:transform .32s cubic-bezier(.16,1,.3,1)!important;will-change:transform!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}[data-dragging="true"] .flow-date-rail{transition:none!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day{
    position:relative!important;display:grid!important;grid-template-rows:auto auto auto!important;place-items:center!important;align-content:center!important;gap:1px!important;
    width:calc(100% - 6px)!important;height:54px!important;margin:auto!important;padding:4px 1px!important;box-sizing:border-box!important;border:0!important;border-radius:17px!important;corner-shape:squircle!important;
    background:transparent!important;color:var(--muted)!important;box-shadow:none!important;opacity:.74!important;transform:scale(.92)!important;
    transition:transform .28s cubic-bezier(.16,1,.3,1),opacity .2s ease,background .2s ease,color .2s ease,box-shadow .2s ease!important;cursor:pointer!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day[data-near="true"]{opacity:.9!important;transform:scale(.97)!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day[data-active="true"]{
    height:62px!important;border-radius:21px!important;opacity:1!important;transform:translateY(-2px) scale(1.08)!important;color:var(--accent)!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 9%,var(--surface)),color-mix(in srgb,var(--surface) 88%,var(--surface-2)))!important;
    box-shadow:0 12px 27px color-mix(in srgb,var(--accent) 17%,transparent),inset 0 1px 0 rgba(255,255,255,.92),0 0 0 1px color-mix(in srgb,var(--accent) 12%,transparent)!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-week{font-size:.5rem!important;font-weight:770!important;line-height:1!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-num{font-size:.9rem!important;font-weight:880!important;line-height:1.05!important;letter-spacing:-.04em!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-today{height:9px!important;color:var(--accent)!important;font-size:.43rem!important;font-weight:820!important;line-height:1!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-dots{grid-column:1/-1;grid-row:2;display:flex!important;justify-content:center!important;align-items:center!important;gap:7px!important;height:8px!important;pointer-events:none!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-dots i{display:block!important;width:5px!important;height:5px!important;border-radius:2px!important;corner-shape:squircle!important;background:color-mix(in srgb,var(--muted) 25%,transparent)!important;transition:width .2s ease,background .2s ease!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-dots i.active{width:13px!important;background:var(--accent)!important}
  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] body #todayView .school-hero{height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:hidden!important}
  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] body #todayView .school-hero>*{display:none!important}
}
@media(max-width:720px){
  html[data-flow-school-ui="v2"] body .mobile-topbar:has(#${DATE_DOCK_ID}){gap:10px!important;min-height:92px!important;padding-inline:12px!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy strong{font-size:1.13rem!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button{min-width:116px!important;max-width:132px!important;min-height:52px!important;padding:7px 10px!important;border-radius:16px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}{height:78px!important;grid-template-columns:34px minmax(0,1fr) 34px!important;grid-template-rows:60px 6px!important;padding:6px 7px!important;border-radius:25px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge{width:32px!important;height:32px!important;border-radius:11px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport,html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-rail{height:60px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day{height:48px!important;border-radius:15px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day[data-active="true"]{height:56px!important;border-radius:19px!important}
}
@media(max-width:520px){
  html[data-flow-school-ui="v2"] body .mobile-topbar:has(#${DATE_DOCK_ID}){grid-template-columns:auto minmax(0,1fr) auto!important;gap:7px!important;min-height:76px!important;padding:7px 8px!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy strong{font-size:.91rem!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button{min-width:92px!important;max-width:106px!important;min-height:46px!important;padding:6px 8px!important;border-radius:14px!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span{font-size:.57rem!important}html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{font-size:.47rem!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}{grid-template-columns:minmax(0,1fr)!important;grid-template-rows:52px 5px!important;height:66px!important;padding:5px!important;border-radius:21px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge{display:none!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport{grid-column:1!important;height:52px!important;border-radius:17px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-rail{height:52px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day{height:42px!important;border-radius:13px!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day[data-active="true"]{height:49px!important;border-radius:16px!important;transform:translateY(-1px) scale(1.05)!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-week{font-size:.43rem!important}html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-num{font-size:.76rem!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-dots{gap:4px!important}html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-dots i{width:3px!important;height:3px!important}html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-dots i.active{width:9px!important}
}
@media(prefers-reduced-motion:reduce){html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} :is(.flow-date-rail,.flow-date-day,.flow-date-dots i){transition:none!important}}
`;
  document.head.append(style);
}
function renderRail(){
  const dock=$(`#${DATE_DOCK_ID}`),rail=$('.flow-date-rail',dock);if(!dock||!rail)return;
  currentIso=activeIso();const list=offsets();dock.style.setProperty('--flow-date-count',String(list.length));rail.style.setProperty('--flow-date-x','0px');
  rail.replaceChildren(...list.map(offset=>{
    const value=addDays(currentIso,offset),date=fromIso(value),button=document.createElement('button');button.type='button';button.className='flow-date-day';button.dataset.offset=String(offset);button.dataset.iso=value;button.dataset.active=String(offset===0);button.dataset.near=String(Math.abs(offset)===1);button.setAttribute('aria-label',new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(date));button.setAttribute('aria-current',offset===0?'date':'false');button.innerHTML=`<span class="flow-date-week">${weekday(date)}</span><strong class="flow-date-num">${date.getDate()}</strong><span class="flow-date-today">${isToday(value)?'오늘':''}</span>`;return button;
  }));
  const dots=$('.flow-date-dots',dock);if(dots)dots.innerHTML='<i></i><i></i><i class="active"></i><i></i><i></i>';
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
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;settleTimer=setTimeout(()=>{shift(direction);drag=null},reduced?0:170);
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
function buildDock(){
  const topbar=$('.mobile-topbar');if(!topbar)return;let dock=$(`#${DATE_DOCK_ID}`);if(dock)return dock;
  dock=document.createElement('div');dock.id=DATE_DOCK_ID;dock.dataset.dragging='false';dock.setAttribute('aria-label','날짜 탐색');dock.innerHTML='<button class="flow-date-edge" data-date-edge="prev" type="button" aria-label="이전 날짜">‹</button><div class="flow-date-viewport"><div class="flow-date-rail"></div></div><button class="flow-date-edge" data-date-edge="next" type="button" aria-label="다음 날짜">›</button><div class="flow-date-dots" aria-hidden="true"></div>';
  const school=$('#mobileSchoolBtn');if(school)topbar.insertBefore(dock,school);else topbar.append(dock);
  dock.addEventListener('click',event=>{if(performance.now()<suppressClickUntil)return;const edge=event.target.closest('[data-date-edge]');if(edge){shift(edge.dataset.dateEdge==='next'?1:-1);return}const day=event.target.closest('.flow-date-day');if(day?.dataset.iso&&day.dataset.iso!==activeIso())setDate(day.dataset.iso)});
  dock.addEventListener('pointerdown',onPointerDown);dock.addEventListener('pointermove',onPointerMove);dock.addEventListener('pointerup',onPointerUp);dock.addEventListener('pointercancel',resetDrag);renderRail();return dock;
}
function syncMode(){ensureResponsiveStyle();buildDock();renderRail();root.dataset.flowTodayTopbar=matchMedia('(max-width:1180px)').matches?'ready':'wide'}
function init(){
  ensureResponsiveStyle();installStyle();buildDock();syncMode();
  document.addEventListener('change',event=>{if(event.target.matches?.('#datePicker'))requestAnimationFrame(renderRail)});
  document.addEventListener('click',event=>{if(event.target.closest?.('#todayBtn,#prevDay,#nextDay,[data-view="today"]'))requestAnimationFrame(renderRail)});
  addEventListener('resize',()=>requestAnimationFrame(syncMode),{passive:true});window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(syncMode),{passive:true});
  setTimeout(syncMode,120);setTimeout(syncMode,700);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
