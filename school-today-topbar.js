/* Flow School — compact Today top rail
 * Keeps the existing School date state as the source of truth while presenting
 * a gesture-first, magnetic five-day rail between Flow and the school selector.
 */
const root=document.documentElement;
const $=selector=>document.querySelector(selector);

const STYLE_ID='flow-school-today-topbar-style';
const DATE_DOCK_ID='flowTodayDateDock';
let currentIso='';
let drag=null;
let settleTimer=0;

function pad(value){return String(value).padStart(2,'0')}
function toIso(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function fromIso(value){
  const [y,m,d]=String(value||'').split('-').map(Number);
  return y&&m&&d?new Date(y,m-1,d,12):new Date();
}
function addDays(value,delta){const date=fromIso(value);date.setDate(date.getDate()+delta);return toIso(date)}
function isToday(value){return value===toIso(new Date())}
function weekday(date){return new Intl.DateTimeFormat('ko-KR',{weekday:'short'}).format(date).replace('요일','')}

function installStyle(){
  if($( `#${STYLE_ID}`))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
html[data-flow-school-ui="v2"] #${DATE_DOCK_ID}{display:none}
@media(max-width:900px),(min-width:901px) and (max-width:1024px) and (orientation:portrait){
  html[data-flow-school-ui="v2"] .mobile-topbar:has(#${DATE_DOCK_ID}){
    display:grid!important;
    grid-template-columns:auto minmax(0,1fr) auto!important;
    align-items:center!important;
    gap:12px!important;
    min-height:78px!important;
    padding:10px 12px!important;
  }
  html[data-flow-school-ui="v2"] .mobile-topbar .flow-logo{min-width:max-content!important}
  html[data-flow-school-ui="v2"] .mobile-topbar .flow-logo-copy small{display:none!important}
  html[data-flow-school-ui="v2"] .mobile-topbar .mobile-school-button{
    position:relative!important;
    inset:auto!important;
    min-width:126px!important;
    max-width:164px!important;
    min-height:50px!important;
    padding:7px 12px!important;
    margin:0!important;
    border:0!important;
    border-radius:16px!important;
    corner-shape:squircle!important;
    background:color-mix(in srgb,var(--surface) 94%,var(--surface-2))!important;
    box-shadow:0 6px 18px rgba(43,57,78,.07),inset 0 1px 0 rgba(255,255,255,.82)!important;
  }
  html[data-flow-school-ui="v2"] .mobile-topbar .mobile-school-button span,
  html[data-flow-school-ui="v2"] .mobile-topbar .mobile-school-button small{
    overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important
  }
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID}{
    display:flex!important;
    min-width:0;
    height:58px;
    align-items:center;
    gap:5px;
    padding:4px;
    border:0;
    border-radius:20px;
    corner-shape:squircle;
    background:color-mix(in srgb,var(--surface) 78%,transparent);
    box-shadow:0 10px 30px rgba(43,57,78,.08),inset 0 1px 0 rgba(255,255,255,.78);
    backdrop-filter:blur(18px) saturate(1.08);
    -webkit-backdrop-filter:blur(18px) saturate(1.08);
    overflow:hidden;
    touch-action:pan-y;
    user-select:none;
    -webkit-user-select:none;
  }
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-edge{
    width:34px;height:46px;flex:0 0 34px;border:0;border-radius:13px;corner-shape:squircle;
    background:transparent;color:var(--muted);font-size:1.15rem;line-height:1;cursor:pointer
  }
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-viewport{min-width:0;flex:1;height:50px;overflow:hidden;border-radius:16px}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-rail{
    --flow-date-drag:0px;
    height:50px;display:grid;grid-template-columns:repeat(5,minmax(44px,1fr));align-items:center;
    transform:translate3d(var(--flow-date-drag),0,0);
    transition:transform .34s cubic-bezier(.16,1,.3,1);
    will-change:transform;
  }
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID}[data-dragging="true"] .flow-date-rail{transition:none!important}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID}[data-snap="next"] .flow-date-rail{transform:translate3d(-17%,0,0)!important}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID}[data-snap="prev"] .flow-date-rail{transform:translate3d(17%,0,0)!important}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-day{
    height:44px;min-width:0;padding:3px 2px;border:0;border-radius:13px;corner-shape:squircle;
    display:grid;grid-template-rows:auto auto;place-items:center;align-content:center;gap:1px;
    background:transparent;color:var(--muted);cursor:pointer;
    transform:scale(.92);opacity:.62;
    transition:transform .34s cubic-bezier(.16,1,.3,1),opacity .22s ease,background .22s ease,color .22s ease,box-shadow .22s ease
  }
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-day[data-near="true"]{transform:scale(.96);opacity:.82}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-day[data-active="true"]{
    transform:translateY(-1px) scale(1.06);opacity:1;color:var(--accent);
    background:color-mix(in srgb,var(--accent) 9%,var(--surface));
    box-shadow:0 6px 18px color-mix(in srgb,var(--accent) 13%,transparent),inset 0 1px 0 rgba(255,255,255,.86)
  }
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-week{font-size:.48rem;font-weight:760;line-height:1}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-num{font-size:.84rem;font-weight:860;line-height:1.05;letter-spacing:-.035em}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-day[data-active="true"] .flow-date-num::after{
    content:attr(data-today-label);display:block;height:8px;margin-top:2px;font-size:.42rem;font-weight:780;letter-spacing:0;color:var(--accent)
  }

  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] #todayView .school-hero{
    min-height:0!important;height:0!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;
    background:transparent!important;box-shadow:none!important;overflow:visible!important
  }
  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] #todayView .school-hero :is(.school-hero-image,.school-hero-shade,.school-hero-content){display:none!important}
  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] #todayView .status-grid{
    margin:10px 0 14px!important;border:0!important;overflow:visible!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;padding:0!important;gap:10px!important
  }
  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] #todayView .status-card{
    border:0!important;border-radius:19px!important;corner-shape:squircle!important;background:var(--flow-today-surface)!important;box-shadow:var(--flow-today-shadow-soft)!important
  }
  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] #todayView .status-card+.status-card:not(.flow-home-noise){border-left:0!important}
}
@media(max-width:560px){
  html[data-flow-school-ui="v2"] .mobile-topbar:has(#${DATE_DOCK_ID}){grid-template-columns:auto minmax(116px,1fr) auto!important;gap:7px!important;padding-inline:9px!important}
  html[data-flow-school-ui="v2"] .mobile-topbar .mobile-school-button{min-width:100px!important;max-width:116px!important;padding-inline:8px!important}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID}{height:52px;border-radius:17px;padding:3px}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-edge{display:none!important}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-viewport,
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-rail{height:46px}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-rail{grid-template-columns:repeat(3,minmax(36px,1fr));margin-inline:-33.333%}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-day:is([data-offset="-2"],[data-offset="2"]){visibility:hidden;pointer-events:none}
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} .flow-date-day{height:40px;border-radius:11px}
}
@media(min-width:901px) and (max-width:1024px) and (orientation:landscape){
  html[data-flow-school-ui="v2"] #todayView .school-hero{min-height:106px!important;border-radius:22px!important}
  html[data-flow-school-ui="v2"] #todayView .school-hero-content{min-height:106px!important;padding:14px 18px!important}
  html[data-flow-school-ui="v2"] #todayView .school-hero .school-badge{display:none!important}
  html[data-flow-school-ui="v2"] #todayView .school-hero-copy{display:none!important}
  html[data-flow-school-ui="v2"] #todayView .hero-right{margin:auto!important;align-items:center!important}
  html[data-flow-school-ui="v2"] #todayView .today-jump{display:none!important}
}
@media(prefers-reduced-motion:reduce){
  html[data-flow-school-ui="v2"] #${DATE_DOCK_ID} :is(.flow-date-rail,.flow-date-day){transition:none!important}
}
`;
  document.head.append(style);
}

function activeIso(){return $('#datePicker')?.value||currentIso||toIso(new Date())}
function renderRail(){
  const dock=$( `#${DATE_DOCK_ID}`);if(!dock)return;
  const rail=dock.querySelector('.flow-date-rail');if(!rail)return;
  currentIso=activeIso();
  rail.replaceChildren(...[-2,-1,0,1,2].map(offset=>{
    const iso=addDays(currentIso,offset),date=fromIso(iso),button=document.createElement('button');
    button.type='button';button.className='flow-date-day';button.dataset.offset=String(offset);button.dataset.iso=iso;
    button.dataset.active=String(offset===0);button.dataset.near=String(Math.abs(offset)===1);
    button.dataset.todayLabel=isToday(iso)?'오늘':'';
    button.setAttribute('aria-label',new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(date));
    button.setAttribute('aria-current',offset===0?'date':'false');
    button.innerHTML=`<span class="flow-date-week">${weekday(date)}</span><strong class="flow-date-num">${date.getDate()}</strong>`;
    return button;
  }));
}
function setDate(value,{feedback=true}={}){
  const picker=$('#datePicker');if(!picker)return;
  picker.value=value;currentIso=value;renderRail();
  picker.dispatchEvent(new Event('change',{bubbles:true}));
  if(feedback&&navigator.vibrate)navigator.vibrate(7);
}
function shift(delta){setDate(addDays(activeIso(),delta))}

function resetDrag(){
  const dock=$( `#${DATE_DOCK_ID}`),rail=dock?.querySelector('.flow-date-rail');if(!dock||!rail)return;
  dock.dataset.dragging='false';delete dock.dataset.snap;rail.style.setProperty('--flow-date-drag','0px');drag=null;
}
function settle(direction){
  const dock=$( `#${DATE_DOCK_ID}`),rail=dock?.querySelector('.flow-date-rail');if(!dock||!rail)return;
  clearTimeout(settleTimer);dock.dataset.dragging='false';rail.style.setProperty('--flow-date-drag','0px');
  if(!direction){delete dock.dataset.snap;drag=null;return}
  dock.dataset.snap=direction>0?'next':'prev';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  settleTimer=setTimeout(()=>{delete dock.dataset.snap;shift(direction);drag=null},reduced?0:155);
}
function onPointerDown(event){
  if(event.button!==undefined&&event.button!==0)return;
  const dock=$( `#${DATE_DOCK_ID}`);if(!dock)return;
  clearTimeout(settleTimer);delete dock.dataset.snap;dock.dataset.dragging='true';
  drag={id:event.pointerId,x:event.clientX,lastX:event.clientX,lastT:performance.now(),velocity:0};
  dock.setPointerCapture?.(event.pointerId);
}
function onPointerMove(event){
  if(!drag||event.pointerId!==drag.id)return;
  const dock=$( `#${DATE_DOCK_ID}`),rail=dock?.querySelector('.flow-date-rail');if(!rail)return;
  const now=performance.now(),dt=Math.max(8,now-drag.lastT),step=event.clientX-drag.lastX;
  drag.velocity=drag.velocity*.55+(step/dt)*.45;drag.lastX=event.clientX;drag.lastT=now;
  const raw=event.clientX-drag.x,sign=Math.sign(raw),distance=Math.abs(raw),elastic=sign*Math.min(72,distance<=48?distance:48+(distance-48)*.28);
  rail.style.setProperty('--flow-date-drag',`${elastic.toFixed(1)}px`);
}
function onPointerUp(event){
  if(!drag||event.pointerId!==drag.id)return;
  const dx=event.clientX-drag.x,velocity=drag.velocity;
  const direction=Math.abs(dx)>=34||Math.abs(velocity)>=.34?(dx<0||velocity<-.34?1:-1):0;
  settle(direction);
}

function buildDock(){
  const topbar=$('.mobile-topbar');if(!topbar||$( `#${DATE_DOCK_ID}`))return;
  const school=$('#mobileSchoolBtn');
  const dock=document.createElement('div');dock.id=DATE_DOCK_ID;dock.dataset.dragging='false';dock.setAttribute('aria-label','날짜 탐색');
  dock.innerHTML='<button class="flow-date-edge" data-date-edge="prev" type="button" aria-label="이전 날짜">‹</button><div class="flow-date-viewport"><div class="flow-date-rail"></div></div><button class="flow-date-edge" data-date-edge="next" type="button" aria-label="다음 날짜">›</button>';
  if(school)topbar.insertBefore(dock,school);else topbar.append(dock);
  dock.addEventListener('click',event=>{
    const edge=event.target.closest('[data-date-edge]');if(edge){shift(edge.dataset.dateEdge==='next'?1:-1);return}
    const day=event.target.closest('.flow-date-day');if(day?.dataset.iso&&day.dataset.iso!==activeIso())setDate(day.dataset.iso);
  });
  dock.addEventListener('pointerdown',onPointerDown);dock.addEventListener('pointermove',onPointerMove);dock.addEventListener('pointerup',onPointerUp);dock.addEventListener('pointercancel',resetDrag);
  renderRail();
}

function syncMode(){
  buildDock();renderRail();
  const topbar=$('.mobile-topbar');
  const compact=!!topbar&&getComputedStyle(topbar).display!=='none'&&matchMedia('(max-width:900px), (min-width:901px) and (max-width:1024px) and (orientation:portrait)').matches;
  root.dataset.flowTodayTopbar=compact?'ready':'wide';
}

function observeDateSource(){
  const source=$('#dateTitle')||$('#heroDate');if(!source)return;
  new MutationObserver(()=>requestAnimationFrame(renderRail)).observe(source,{subtree:true,childList:true,characterData:true});
}

function init(){
  installStyle();buildDock();observeDateSource();syncMode();
  window.addEventListener('resize',()=>requestAnimationFrame(syncMode),{passive:true});
  window.visualViewport?.addEventListener('resize',()=>requestAnimationFrame(syncMode),{passive:true});
  setTimeout(syncMode,120);setTimeout(syncMode,700);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
