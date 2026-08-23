const NAV_SELECTOR='.mobile-bottom-nav, .bottom-nav';
const TAB_SELECTOR='.mobile-tab, .bottom-item';
const DRAG_THRESHOLD=7;
const PROJECT_MS=100;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let gesture=null;
let syntheticClick=false;
let suppressClickUntil=0;
let settleTimer=0;

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const now=()=>performance.now();

function buttons(nav){return [...nav.querySelectorAll(`:scope > ${TAB_SELECTOR.split(', ').join(', :scope > ')}`)]}
function activeIndex(list){return Math.max(0,list.findIndex(button=>button.classList.contains('active')))}
function geometry(nav,list,index){
  const rect=nav.getBoundingClientRect();
  const inset=5;
  const inner=Math.max(1,rect.width-inset*2);
  const slot=inner/Math.max(1,list.length);
  const max=slot*Math.max(0,list.length-1);
  const center=rect.left+inset+index*slot+slot/2;
  return{rect,inset,slot,max,center};
}
function setPressed(nav,on){
  if(on)nav.dataset.flowLensPressed='true';
  else nav.removeAttribute('data-flow-lens-pressed');
}
function setDragging(nav,on){
  if(on)nav.dataset.flowLensDragging='true';
  else nav.removeAttribute('data-flow-lens-dragging');
}
function clearInline(nav,{keepPosition=false}={}){
  for(const name of ['--flow-lens-scale-x','--flow-lens-scale-y','--flow-lens-light-x','--flow-lens-duration','--flow-lens-ease'])nav.style.removeProperty(name);
  if(!keepPosition)nav.style.removeProperty('--flow-lens-x');
}
function settle(nav,index,geo,currentX,velocity=0){
  clearTimeout(settleTimer);
  setPressed(nav,false);setDragging(nav,false);
  const target=clamp(index*geo.slot,0,geo.max);
  const distance=Math.abs(target-currentX);
  const speed=Math.abs(velocity);
  const duration=clamp(250+distance*.42-speed*35,230,390);
  nav.dataset.flowLensSettling='true';
  nav.style.setProperty('--flow-lens-duration',`${Math.round(duration)}ms`);
  nav.style.setProperty('--flow-lens-ease','cubic-bezier(.16,1.18,.26,1)');
  nav.style.setProperty('--flow-lens-scale-x',speed>.45?'1.035':'1.015');
  nav.style.setProperty('--flow-lens-scale-y','1');
  nav.style.setProperty('--flow-lens-x',`${target}px`);
  settleTimer=setTimeout(()=>{
    nav.removeAttribute('data-flow-lens-settling');
    clearInline(nav);
  },duration+80);
}
function cancelGesture(){
  if(!gesture)return;
  const {nav,list,geo,currentX=0}=gesture;
  settle(nav,activeIndex(list),geo,currentX,0);
  gesture=null;
}
function releaseGesture(event,cancelled=false){
  if(!gesture||event.pointerId!==gesture.pointerId)return;
  const state=gesture;gesture=null;
  const {nav,list,geo}=state;
  try{nav.releasePointerCapture?.(event.pointerId)}catch{}
  if(!state.dragging||cancelled){settle(nav,activeIndex(list),geo,state.currentX,state.velocity);return}
  const projection=clamp(state.velocity*PROJECT_MS,-geo.slot*.42,geo.slot*.42);
  const projected=clamp(state.currentX+projection,0,geo.max);
  const targetIndex=clamp(Math.round(projected/geo.slot),0,list.length-1);
  const target=list[targetIndex];
  suppressClickUntil=now()+420;
  syntheticClick=true;
  try{target?.click()}finally{syntheticClick=false}
  const selected=activeIndex(list);
  settle(nav,selected,geo,state.currentX,state.velocity);
}

document.addEventListener('pointerdown',event=>{
  if(reducedMotion.matches||!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;
  const button=event.target.closest?.(TAB_SELECTOR);const nav=button?.closest?.(NAV_SELECTOR);
  if(!nav||button.parentElement!==nav||!button.classList.contains('active'))return;
  const list=buttons(nav);if(list.length<2)return;
  const index=activeIndex(list),geo=geometry(nav,list,index),t=now();
  clearTimeout(settleTimer);nav.removeAttribute('data-flow-lens-settling');clearInline(nav);
  const grabOffset=event.clientX-geo.center;
  gesture={nav,list,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastT:t,velocity:0,currentX:index*geo.slot,grabOffset,geo,dragging:false};
  nav.style.setProperty('--flow-tab-count',String(list.length));
  const local=clamp(((event.clientX-(geo.center-geo.slot/2))/geo.slot)*100,15,85);
  nav.style.setProperty('--flow-lens-light-x',`${local.toFixed(1)}%`);
  setPressed(nav,true);
},{capture:true});

document.addEventListener('pointermove',event=>{
  const state=gesture;if(!state||event.pointerId!==state.pointerId)return;
  const dx=event.clientX-state.startX,dy=event.clientY-state.startY;
  if(!state.dragging){
    if(Math.abs(dy)>DRAG_THRESHOLD&&Math.abs(dy)>Math.abs(dx)*1.18){cancelGesture();return}
    if(Math.abs(dx)<DRAG_THRESHOLD||Math.abs(dx)<=Math.abs(dy)*1.05)return;
    state.dragging=true;setDragging(state.nav,true);
    try{state.nav.setPointerCapture?.(event.pointerId)}catch{}
  }
  event.preventDefault();
  const t=now(),dt=Math.max(1,t-state.lastT),instant=(event.clientX-state.lastX)/dt;
  state.velocity=state.velocity*.58+instant*.42;state.lastX=event.clientX;state.lastT=t;
  const center=event.clientX-state.grabOffset;
  const x=clamp(center-(state.geo.rect.left+state.geo.inset+state.geo.slot/2),0,state.geo.max);
  state.currentX=x;
  const stretch=1.075+Math.min(.105,Math.abs(state.velocity)*.055);
  state.nav.style.setProperty('--flow-lens-x',`${x.toFixed(2)}px`);
  state.nav.style.setProperty('--flow-lens-scale-x',stretch.toFixed(3));
  state.nav.style.setProperty('--flow-lens-scale-y','1.065');
  state.nav.style.setProperty('--flow-lens-duration','0ms');
  const lensCenter=state.geo.rect.left+state.geo.inset+x+state.geo.slot/2;
  const local=clamp(50+(event.clientX-lensCenter)/state.geo.slot*55,14,86);
  state.nav.style.setProperty('--flow-lens-light-x',`${local.toFixed(1)}%`);
},{capture:true,passive:false});

document.addEventListener('pointerup',event=>releaseGesture(event,false),{capture:true});
document.addEventListener('pointercancel',event=>releaseGesture(event,true),{capture:true});
document.addEventListener('click',event=>{
  if(syntheticClick||now()>suppressClickUntil)return;
  if(event.target.closest?.(NAV_SELECTOR)){event.preventDefault();event.stopImmediatePropagation()}
},{capture:true});
window.addEventListener('blur',cancelGesture,{passive:true});
window.addEventListener('resize',cancelGesture,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelGesture()},{passive:true});
