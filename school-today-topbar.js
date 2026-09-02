import './school-today-exam-feed.js';

const root=document.documentElement;
const $=(selector,host=document)=>host?.querySelector?.(selector)||null;
const DATE_DOCK_ID='flowTodayDateDock';
const STYLE_ID='flow-school-today-deck-style';
const BUFFER_OFFSETS=[-4,-3,-2,-1,0,1,2,3,4];
let currentIso='';
let todayIso='';
let drag=null;
let settleTimer=0;
let liveTimer=0;
let suppressClickUntil=0;
let resizeFrame=0;

function pad(value){return String(value).padStart(2,'0')}
function toIso(date){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function fromIso(value){const[y,m,d]=String(value||'').split('-').map(Number);return y&&m&&d?new Date(y,m-1,d,12):new Date()}
function addDays(value,delta){const date=fromIso(value);date.setDate(date.getDate()+delta);return toIso(date)}
function isToday(value){return value===toIso(new Date())}
function weekday(date){return new Intl.DateTimeFormat('ko-KR',{weekday:'short'}).format(date).replace('요일','')}
function activeIso(){return $('#datePicker')?.value||currentIso||toIso(new Date())}
function shortLandscape(){return matchMedia('(max-width:900px) and (max-height:520px) and (orientation:landscape)').matches}
function visibleCount(){return matchMedia('(max-width:520px)').matches||shortLandscape()?3:5}
function reducedMotion(){return matchMedia('(prefers-reduced-motion: reduce)').matches}

function ensureResponsiveStyle(){
  let link=document.querySelector('link[data-flow-school-today-responsive],link[href*="school-today-responsive.css"]');
  if(!link){link=document.createElement('link');link.rel='stylesheet';link.dataset.flowSchoolTodayResponsive='';document.head.append(link)}
  const next='/school-today-responsive.css?v=20260901-2';
  if(!link.href.endsWith(next))link.href=next;
}

function installStyle(){
  if($(`#${STYLE_ID}`))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
html[data-flow-school-ui="v2"] #${DATE_DOCK_ID}{display:none}
@media(max-width:1180px){
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#${DATE_DOCK_ID}){
    display:grid!important;
    grid-template-columns:auto minmax(220px,480px) minmax(112px,156px)!important;
    align-items:center!important;
    justify-content:space-between!important;
    gap:8px!important;
    width:100%!important;
    min-height:60px!important;
    height:auto!important;
    padding:5px clamp(8px,1.8vw,18px)!important;
    box-sizing:border-box!important;
    background:color-mix(in srgb,var(--surface) 88%,var(--bg))!important;
    border:0!important;
    box-shadow:none!important;
    overflow:visible!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo{min-width:44px!important;min-height:44px!important;align-self:center!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy strong{font-size:1.08rem!important;font-weight:850!important;letter-spacing:-.055em!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy small{display:none!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button{
    position:relative!important;
    inset:auto!important;
    display:grid!important;
    align-content:center!important;
    justify-items:end!important;
    min-width:112px!important;
    max-width:156px!important;
    min-height:44px!important;
    height:44px!important;
    margin:0!important;
    padding:4px 6px!important;
    border:0!important;
    border-radius:12px!important;
    corner-shape:squircle!important;
    text-align:right!important;
    overflow:hidden!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span,
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{
    display:block!important;
    max-width:100%!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    white-space:nowrap!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span{font-size:.68rem!important;font-weight:850!important;letter-spacing:-.025em!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{margin-top:2px!important;color:var(--muted)!important;font-size:.52rem!important;font-weight:720!important}

  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}{
    --flow-date-x:0px;
    --flow-date-count:5;
    --flow-date-slot:72px;
    display:grid!important;
    grid-template-columns:44px minmax(0,1fr) 44px!important;
    align-items:center!important;
    justify-self:center!important;
    width:min(100%,480px)!important;
    min-width:0!important;
    height:50px!important;
    padding:3px 0!important;
    box-sizing:border-box!important;
    border:0!important;
    border-radius:0!important;
    background:transparent!important;
    box-shadow:none!important;
    backdrop-filter:none!important;
    -webkit-backdrop-filter:none!important;
    overflow:visible!important;
    touch-action:pan-y!important;
    user-select:none!important;
    -webkit-user-select:none!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge{
    display:grid!important;
    place-items:center!important;
    width:44px!important;
    height:44px!important;
    min-width:44px!important;
    min-height:44px!important;
    padding:0!important;
    border:0!important;
    border-radius:13px!important;
    background:transparent!important;
    color:color-mix(in srgb,var(--text) 58%,var(--muted))!important;
    box-shadow:none!important;
    font-size:1.12rem!important;
    font-weight:700!important;
    line-height:1!important;
    cursor:pointer!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge:active{
    transform:scale(.92)!important;
    background:color-mix(in srgb,var(--surface-2) 64%,transparent)!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport{
    position:relative!important;
    grid-column:2;
    width:100%!important;
    height:44px!important;
    min-width:0!important;
    overflow:hidden!important;
    border-radius:15px!important;
    background:transparent!important;
    isolation:isolate!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport::before,
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport::after{
    content:"";
    position:absolute;
    z-index:4;
    top:0;
    bottom:0;
    width:18px;
    pointer-events:none
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport::before{
    left:0;
    background:linear-gradient(90deg,color-mix(in srgb,var(--surface) 74%,transparent),transparent)
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport::after{
    right:0;
    background:linear-gradient(270deg,color-mix(in srgb,var(--surface) 74%,transparent),transparent)
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-focus{
    position:absolute!important;
    z-index:0!important;
    top:0!important;
    bottom:0!important;
    left:50%!important;
    width:calc((100% / var(--flow-date-count,5)) - 5px)!important;
    transform:translateX(-50%)!important;
    border:1px solid color-mix(in srgb,var(--accent) 15%,transparent)!important;
    border-radius:14px!important;
    corner-shape:squircle!important;
    background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 10%,var(--surface)),color-mix(in srgb,var(--surface) 95%,transparent))!important;
    box-shadow:0 5px 14px color-mix(in srgb,var(--accent) 10%,transparent),inset 0 1px 0 rgba(255,255,255,.9)!important;
    pointer-events:none!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}[data-dragging="true"] .flow-date-focus{
    border-color:color-mix(in srgb,var(--accent) 24%,transparent)!important;
    box-shadow:0 7px 18px color-mix(in srgb,var(--accent) 14%,transparent),inset 0 1px 0 rgba(255,255,255,.9)!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-focus::before{
    content:"";
    position:absolute;
    top:3px;
    left:50%;
    width:14px;
    height:2px;
    transform:translateX(-50%);
    border-radius:2px;
    background:color-mix(in srgb,var(--accent) 78%,transparent)
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-rail{
    position:absolute!important;
    z-index:1!important;
    inset:0!important;
    width:100%!important;
    height:44px!important;
    transform:translate3d(var(--flow-date-x,0px),0,0)!important;
    transition:transform .26s cubic-bezier(.2,.9,.2,1)!important;
    will-change:transform!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}[data-dragging="true"] .flow-date-rail{transition:none!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}[data-snap="true"] .flow-date-rail{transition:transform .18s cubic-bezier(.2,.95,.25,1)!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day{
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
    transition:transform .14s linear,opacity .14s linear,color .14s linear!important;
    cursor:pointer!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}[data-dragging="true"] .flow-date-day{transition:none!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-day[data-preview="true"]{
    color:var(--accent)!important;
    font-weight:850!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-week{
    grid-row:1;
    font-size:.54rem!important;
    font-weight:780!important;
    line-height:1!important;
    letter-spacing:-.01em!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-num{
    grid-row:2;
    font-size:.95rem!important;
    font-weight:900!important;
    line-height:1!important;
    letter-spacing:-.055em!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-today{
    grid-row:3;
    height:8px!important;
    color:var(--accent)!important;
    font-size:.43rem!important;
    font-weight:850!important;
    line-height:1!important;
    letter-spacing:-.02em!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-dots{display:none!important}

  html[data-flow-school-ui="v2"] body #todayView .timetable-actions{
    display:flex!important;
    align-items:center!important;
    justify-content:flex-end!important;
    gap:6px!important;
    min-width:0!important;
    max-width:100%!important;
    flex-wrap:nowrap!important
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle{
    position:relative!important;
    isolation:isolate!important;
    display:grid!important;
    grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important;
    width:116px!important;
    min-width:116px!important;
    height:44px!important;
    padding:4px!important;
    border:0!important;
    border-radius:13px!important;
    overflow:hidden!important;
    background:color-mix(in srgb,var(--surface-2) 62%,transparent)!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.58)!important
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle::before,
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle::after,
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button::before,
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button::after{display:none!important;content:none!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button{
    position:relative!important;
    z-index:1!important;
    width:100%!important;
    min-width:0!important;
    min-height:36px!important;
    height:36px!important;
    padding:0 8px!important;
    border:0!important;
    border-radius:10px!important;
    background:transparent!important;
    color:var(--muted)!important;
    box-shadow:none!important;
    transform:none!important;
    font-size:.66rem!important;
    font-weight:820!important
  }
  html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button.active{
    background:var(--surface)!important;
    color:var(--accent)!important;
    box-shadow:0 3px 10px rgba(43,57,78,.075),inset 0 1px 0 rgba(255,255,255,.8)!important;
    transform:none!important
  }
  html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action,
  html[data-flow-school-ui="v2"] body #todayView .timetable-actions>.neo-button{
    min-height:44px!important;
    height:44px!important;
    min-width:0!important;
    padding:0 10px!important;
    border-radius:12px!important;
    font-size:.67rem!important;
    font-weight:790!important
  }
  html[data-flow-school-ui="v2"] body #todayView #editSubjectsBtn.flow-school-utility-action{
    background:color-mix(in srgb,var(--accent) 7%,var(--surface))!important;
    color:var(--accent)!important
  }

  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] body #todayView .school-hero{
    height:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:hidden!important
  }
  html[data-flow-school-ui="v2"][data-flow-today-topbar="ready"] body #todayView .school-hero>*{display:none!important}
}
@media(max-width:720px){
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#${DATE_DOCK_ID}){
    grid-template-columns:44px minmax(0,1fr) minmax(102px,118px)!important;
    gap:4px!important;
    min-height:58px!important;
    padding:4px 6px!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy strong{font-size:.96rem!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button{min-width:102px!important;max-width:118px!important;padding-inline:5px!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span{font-size:.61rem!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{font-size:.48rem!important}
}
@media(max-width:520px){
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#${DATE_DOCK_ID}){
    grid-template-columns:42px minmax(0,1fr) minmax(98px,108px)!important;
    gap:3px!important;
    min-height:56px!important;
    padding:3px 5px!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .flow-logo-copy strong{font-size:.9rem!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button{
    min-width:98px!important;
    max-width:108px!important;
    height:44px!important;
    padding:4px 3px!important
  }
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button span{font-size:.58rem!important}
  html[data-flow-school-ui="v2"] body .mobile-topbar .mobile-school-button small{display:block!important;font-size:.46rem!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID}{
    --flow-date-count:3;
    grid-template-columns:minmax(0,1fr)!important;
    height:48px!important;
    padding:2px 0!important
  }
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-edge{display:none!important}
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} .flow-date-viewport{grid-column:1!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-card .card-heading{align-items:flex-start!important;flex-wrap:wrap!important}
  html[data-flow-school-ui="v2"] body #todayView .timetable-actions{width:100%!important;justify-content:flex-start!important}
}
@media(max-width:900px) and (max-height:520px) and (orientation:landscape){
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-topbar:has(#${DATE_DOCK_ID}){
    position:relative!important;
    display:flex!important;
    align-items:center!important;
    justify-content:space-between!important;
    min-height:50px!important;
    height:50px!important;
    padding:3px 8px!important;
    gap:0!important
  }
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID}{
    --flow-date-count:3;
    position:absolute!important;
    left:max(56px,calc(env(safe-area-inset-left) + 50px))!important;
    top:3px!important;
    width:clamp(214px,27vw,238px)!important;
    height:44px!important;
    grid-template-columns:minmax(0,1fr)!important;
    padding:0!important
  }
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID} .flow-date-edge{display:none!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) #${DATE_DOCK_ID} .flow-date-viewport{grid-column:1!important}
  html[data-flow-school-ui="v2"] body #dashboard:has(#todayView:not(.hidden)) .mobile-school-button{
    min-width:112px!important;
    max-width:132px!important;
    height:44px!important
  }
  html[data-flow-school-ui="v2"] body #todayView{padding-top:2px!important}
}
@media(prefers-reduced-motion:reduce){
  html[data-flow-school-ui="v2"] body #${DATE_DOCK_ID} :is(.flow-date-rail,.flow-date-day,.flow-date-focus){transition:none!important}
}
`;
  document.head.append(style);
}

function dockParts(){
  const dock=$(`#${DATE_DOCK_ID}`);
  return{dock,viewport:$('.flow-date-viewport',dock),rail:$('.flow-date-rail',dock)};
}
function slotWidth(){
  const{dock,viewport}=dockParts();
  if(!dock||!viewport)return 0;
  const count=Math.max(3,Number(dock.style.getPropertyValue('--flow-date-count'))||visibleCount());
  return viewport.getBoundingClientRect().width/count;
}
function closestPreview(dx=0,slot=slotWidth()){
  if(!slot)return 0;
  return Math.max(-3,Math.min(3,Math.round(-dx/slot)));
}
function updateRailVisual(dx=0){
  const{dock,rail}=dockParts();
  if(!dock||!rail)return;
  const slot=slotWidth();
  rail.style.setProperty('--flow-date-x',`${Number(dx||0).toFixed(1)}px`);
  dock.dataset.preview=String(closestPreview(dx,slot));
  [...rail.children].forEach(button=>{
    const offset=Number(button.dataset.offset)||0;
    button.style.setProperty('--flow-date-base',`${(offset*slot).toFixed(2)}px`);
    const distance=slot?Math.abs(offset*slot+dx)/slot:Math.abs(offset);
    const scale=Math.max(.76,1.035-Math.min(distance,3.5)*.095);
    const opacity=Math.max(.24,1-Math.min(distance,3.5)*.235);
    button.style.setProperty('--flow-date-scale',scale.toFixed(3));
    button.style.setProperty('--flow-date-opacity',opacity.toFixed(3));
    button.dataset.preview=String(distance<.5);
  });
}
function layoutRail(){
  cancelAnimationFrame(resizeFrame);
  resizeFrame=requestAnimationFrame(()=>updateRailVisual(Number.parseFloat(dockParts().rail?.style.getPropertyValue('--flow-date-x')||'0')||0));
}

function renderRail(){
  const{dock,rail}=dockParts();
  if(!dock||!rail)return;
  currentIso=activeIso();
  const count=visibleCount();
  dock.style.setProperty('--flow-date-count',String(count));
  dock.dataset.dragging='false';
  dock.dataset.snap='false';
  dock.dataset.todaySelected=String(isToday(currentIso));
  rail.style.setProperty('--flow-date-x','0px');
  rail.replaceChildren(...BUFFER_OFFSETS.map(offset=>{
    const value=addDays(currentIso,offset);
    const date=fromIso(value);
    const button=document.createElement('button');
    button.type='button';
    button.className='flow-date-day';
    button.dataset.offset=String(offset);
    button.dataset.iso=value;
    button.dataset.active=String(offset===0);
    button.setAttribute('aria-label',new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'long'}).format(date));
    button.setAttribute('aria-current',offset===0?'date':'false');
    button.innerHTML=`<span class="flow-date-week">${weekday(date)}</span><strong class="flow-date-num">${date.getDate()}</strong><span class="flow-date-today">${isToday(value)?'오늘':''}</span>`;
    return button;
  }));
  requestAnimationFrame(()=>updateRailVisual(0));
}

function setDate(value,{feedback=true}={}){
  const picker=$('#datePicker');
  if(!picker)return;
  picker.value=value;
  currentIso=value;
  renderRail();
  picker.dispatchEvent(new Event('change',{bubbles:true}));
  if(feedback&&navigator.vibrate)navigator.vibrate(7);
}
function shift(delta){setDate(addDays(activeIso(),delta))}

function resetDrag({animate=false}={}){
  const{dock,rail}=dockParts();
  if(!dock||!rail)return;
  clearTimeout(settleTimer);
  dock.dataset.dragging='false';
  dock.dataset.snap=String(Boolean(animate));
  drag=null;
  updateRailVisual(0);
  if(animate&&!reducedMotion())settleTimer=setTimeout(()=>{dock.dataset.snap='false'},190);
  else dock.dataset.snap='false';
}
function settle(direction){
  const{dock}=dockParts();
  if(!dock)return;
  clearTimeout(settleTimer);
  dock.dataset.dragging='false';
  if(!direction){resetDrag({animate:true});return}
  const slot=slotWidth();
  const target=direction>0?-slot:slot;
  dock.dataset.snap='true';
  updateRailVisual(target);
  const delay=reducedMotion()?0:175;
  settleTimer=setTimeout(()=>{
    dock.dataset.snap='false';
    shift(direction);
    drag=null;
  },delay);
}

function onPointerDown(event){
  if(event.button!==undefined&&event.button!==0)return;
  if(event.target.closest?.('[data-date-edge]'))return;
  const{dock}=dockParts();
  if(!dock)return;
  clearTimeout(settleTimer);
  dock.dataset.dragging='true';
  dock.dataset.snap='false';
  drag={id:event.pointerId,x:event.clientX,lastX:event.clientX,lastT:performance.now(),velocity:0,moved:false};
  try{dock.setPointerCapture?.(event.pointerId)}catch{}
}
function onPointerMove(event){
  if(!drag||event.pointerId!==drag.id)return;
  const now=performance.now();
  const dt=Math.max(8,now-drag.lastT);
  const step=event.clientX-drag.lastX;
  drag.velocity=drag.velocity*.55+(step/dt)*.45;
  drag.lastX=event.clientX;
  drag.lastT=now;
  const raw=event.clientX-drag.x;
  if(Math.abs(raw)>6)drag.moved=true;
  const sign=Math.sign(raw);
  const distance=Math.abs(raw);
  const elastic=sign*Math.min(96,distance<=54?distance:54+(distance-54)*.26);
  updateRailVisual(elastic);
}
function onPointerUp(event){
  if(!drag||event.pointerId!==drag.id)return;
  const dx=event.clientX-drag.x;
  const velocity=drag.velocity;
  if(drag.moved)suppressClickUntil=performance.now()+300;
  try{dockParts().dock?.releasePointerCapture?.(event.pointerId)}catch{}
  const direction=Math.abs(dx)>=32||Math.abs(velocity)>=.3?(dx<0||velocity<-.3?1:-1):0;
  settle(direction);
}
function onPointerCancel(event){
  if(drag&&event.pointerId!==undefined&&event.pointerId!==drag.id)return;
  resetDrag({animate:true});
}

function buildDock(){
  const topbar=$('.mobile-topbar');
  if(!topbar)return null;
  let dock=$(`#${DATE_DOCK_ID}`);
  if(dock)return dock;
  dock=document.createElement('div');
  dock.id=DATE_DOCK_ID;
  dock.dataset.dragging='false';
  dock.dataset.snap='false';
  dock.setAttribute('aria-label','날짜 탐색');
  dock.innerHTML='<button class="flow-date-edge" data-date-edge="prev" type="button" aria-label="이전 날짜">‹</button><div class="flow-date-viewport"><div class="flow-date-focus" aria-hidden="true"></div><div class="flow-date-rail"></div></div><button class="flow-date-edge" data-date-edge="next" type="button" aria-label="다음 날짜">›</button><div class="flow-date-dots" aria-hidden="true"></div>';
  const school=$('#mobileSchoolBtn');
  if(school)topbar.insertBefore(dock,school);
  else topbar.append(dock);
  dock.addEventListener('click',event=>{
    if(performance.now()<suppressClickUntil)return;
    const edge=event.target.closest('[data-date-edge]');
    if(edge){settle(edge.dataset.dateEdge==='next'?1:-1);return}
    const day=event.target.closest('.flow-date-day');
    if(!day?.dataset.iso)return;
    const offset=Number(day.dataset.offset)||0;
    if(!offset)return;
    const direction=Math.sign(offset);
    if(Math.abs(offset)===1)settle(direction);
    else setDate(day.dataset.iso);
  });
  dock.addEventListener('pointerdown',onPointerDown);
  dock.addEventListener('pointermove',onPointerMove);
  dock.addEventListener('pointerup',onPointerUp);
  dock.addEventListener('pointercancel',onPointerCancel);
  renderRail();
  return dock;
}

function syncLiveDate(){
  const nextToday=toIso(new Date());
  if(!todayIso){todayIso=nextToday;return}
  if(nextToday===todayIso)return;
  const wasFollowing=activeIso()===todayIso;
  todayIso=nextToday;
  if(wasFollowing)setDate(nextToday,{feedback:false});
  else renderRail();
}
function syncMode(){
  ensureResponsiveStyle();
  buildDock();
  renderRail();
  root.dataset.flowTodayTopbar=matchMedia('(max-width:1180px)').matches?'ready':'wide';
}
function onResize(){
  const dock=$(`#${DATE_DOCK_ID}`);
  if(!dock)return;
  const nextCount=visibleCount();
  const current=Number(dock.style.getPropertyValue('--flow-date-count'))||0;
  if(current!==nextCount)renderRail();
  else layoutRail();
}
function init(){
  ensureResponsiveStyle();
  installStyle();
  todayIso=toIso(new Date());
  buildDock();
  syncMode();
  document.addEventListener('change',event=>{
    if(event.target.matches?.('#datePicker'))requestAnimationFrame(renderRail);
  });
  document.addEventListener('click',event=>{
    if(event.target.closest?.('[data-view="today"],[data-go-view="today"]'))requestAnimationFrame(syncMode);
  });
  addEventListener('resize',onResize,{passive:true});
  addEventListener('orientationchange',()=>setTimeout(onResize,80),{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncLiveDate()});
  liveTimer=setInterval(syncLiveDate,30000);
  root.dataset.flowTodayDateScrubber='v4';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
