const root=document.documentElement;
root.dataset.flowSchoolUi='v2';

function attachStyle(href,key){
  if(document.querySelector(`link[${key}]`))return;
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=href;
  link.setAttribute(key,'');
  document.head.append(link);
}

attachStyle('/school-uiux-v2.css?v=20260831-1','data-flow-school-ui-v2');
attachStyle('/school-uiux-v2-system.css?v=20260831-1','data-flow-school-ui-v2-system');

/* Week is an inline Today mode now. Compact portrait keeps the shared root
 * destination transition, armed only by navigation interaction. Larger touch
 * layouts retain child content-settle motion so the entire Optical source plane
 * never disappears or moves during wide-tablet first-fold navigation.
 * Reduced-motion remains authoritative. */
function installDestinationMotionContract(){
  if(document.querySelector('#flow-school-v2-destination-motion'))return;
  const style=document.createElement('style');
  style.id='flow-school-v2-destination-motion';
  style.textContent=`
@media(max-width:520px) and (orientation:portrait){
  html[data-flow-school-ui="v2"][data-flow-school-destination-motion="armed"] :is(#todayView,#scheduleView,#schoolView,#flowSchoolSettingsView):not(.hidden){
    animation:flow-view-enter var(--flow-motion-medium,240ms) var(--flow-motion-spring,cubic-bezier(.16,1,.3,1)) both!important;
    transform-origin:50% 18%;
  }
}
@media(prefers-reduced-motion:reduce){
  html[data-flow-school-ui="v2"][data-flow-school-destination-motion="armed"] :is(#todayView,#scheduleView,#schoolView,#flowSchoolSettingsView):not(.hidden){
    animation:none!important;
    transform:none!important;
  }
}`;
  document.head.append(style);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#bottomNav > .mobile-tab,.side-nav > .nav-item'))root.dataset.flowSchoolDestinationMotion='armed';
  },{capture:true});
}
installDestinationMotionContract();

/* School has one moving glass lens, but compact Chrome must not derive its
 * vertical box from an absolutely-positioned pseudo element's top/bottom pair.
 * The real tab is the hit target and therefore the geometry source of truth.
 * Binding the lens to that rendered box keeps Standard and Optical aligned on
 * phones, portrait tablets, browser UI resizes, and safe-area changes. */
let mobileLensFrame=0,mobileLensResizeObserver=null,mobileLensMutationObserver=null,mobileLensObservedNav=null;
function syncMobileLensBox(){
  mobileLensFrame=0;
  const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
  if(!nav||getComputedStyle(nav).display==='none')return;
  const active=nav.querySelector(':scope > .mobile-tab.active')||nav.querySelector(':scope > .mobile-tab:not([hidden])');
  if(!active||getComputedStyle(active).display==='none')return;
  const navRect=nav.getBoundingClientRect(),activeRect=active.getBoundingClientRect();
  if(!navRect.width||!navRect.height||!activeRect.width||!activeRect.height)return;
  const top=Math.max(0,activeRect.top-navRect.top);
  nav.style.setProperty('--flow-school-lens-top',`${top.toFixed(2)}px`);
  nav.style.setProperty('--flow-school-lens-height',`${activeRect.height.toFixed(2)}px`);
}
function scheduleMobileLensBox(){
  if(mobileLensFrame)return;
  mobileLensFrame=requestAnimationFrame(()=>requestAnimationFrame(syncMobileLensBox));
}
function ensureMobileLensObservers(){
  const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
  if(!nav||nav===mobileLensObservedNav)return;
  mobileLensResizeObserver?.disconnect();
  mobileLensMutationObserver?.disconnect();
  mobileLensObservedNav=nav;
  if('ResizeObserver'in window){
    mobileLensResizeObserver=new ResizeObserver(scheduleMobileLensBox);
    mobileLensResizeObserver.observe(nav);
  }
  mobileLensMutationObserver=new MutationObserver(scheduleMobileLensBox);
  mobileLensMutationObserver.observe(nav,{subtree:true,attributes:true,attributeFilter:['class','hidden']});
  syncMobileLensBox();
}
function installMobileLensBoxContract(){
  if(!document.querySelector('#flow-school-mobile-lens-box')){
    const style=document.createElement('style');
    style.id='flow-school-mobile-lens-box';
    style.textContent=`
@media(max-width:900px),(min-width:901px) and (max-width:1024px) and (orientation:portrait){
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav::before{
    top:var(--flow-school-lens-top,6px)!important;
    bottom:auto!important;
    height:var(--flow-school-lens-height,calc(100% - 12px))!important;
  }
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav>.flow-refraction-copy-lens{
    top:var(--flow-school-lens-top,6px)!important;
    bottom:auto!important;
    height:var(--flow-school-lens-height,calc(100% - 12px))!important;
  }
}`;
    document.head.append(style);
  }
  ensureMobileLensObservers();
  scheduleMobileLensBox();
}
installMobileLensBoxContract();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installMobileLensBoxContract,{once:true});
document.addEventListener('click',event=>{if(event.target.closest?.('#bottomNav'))scheduleMobileLensBox()},{capture:false});
window.addEventListener('flow:glass-mode-changed',scheduleMobileLensBox,{passive:true});
window.addEventListener('resize',scheduleMobileLensBox,{passive:true});
window.visualViewport?.addEventListener('resize',scheduleMobileLensBox,{passive:true});
setTimeout(installMobileLensBoxContract,120);
setTimeout(scheduleMobileLensBox,700);

/* The v2 app bar adds its own border/padding inset. Optical Glass historically
 * assumed the moving lens began exactly five pixels from the nav border box,
 * which leaves the counter-positioned source copy a few pixels off once that
 * shell geometry changes. Align from the rendered lens itself so the visual
 * sample remains pixel-locked without changing hit geometry or lens motion. */
let refractionSyncFrame=0,refractionObserver=null,observedScene=null;
function syncRefractionCopy(){
  refractionSyncFrame=0;
  if(root.dataset.flowRefractionCopy!=='true')return;
  const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
  const lens=nav?.querySelector(':scope > .flow-refraction-copy-lens');
  const source=document.querySelector('.product-main');
  if(!nav||!lens||!source)return;
  const lensRect=lens.getBoundingClientRect(),sourceRect=source.getBoundingClientRect();
  const transform=getComputedStyle(lens).transform;
  let tx=0,ty=0;
  if(transform&&transform!=='none'){
    try{const matrix=new DOMMatrixReadOnly(transform);tx=matrix.m41;ty=matrix.m42}catch{}
  }
  nav.style.setProperty('--flow-refraction-scene-left',`${(sourceRect.left-(lensRect.left-tx)).toFixed(2)}px`);
  nav.style.setProperty('--flow-refraction-scene-top',`${(sourceRect.top-(lensRect.top-ty)).toFixed(2)}px`);
}
function ensureRefractionObserver(){
  const scene=document.querySelector('#bottomNav.mobile-bottom-nav > .flow-refraction-copy-lens .flow-refraction-scene');
  if(!scene||scene===observedScene)return;
  refractionObserver?.disconnect();observedScene=scene;
  refractionObserver=new MutationObserver(()=>syncRefractionCopy());
  refractionObserver.observe(scene,{childList:true});
  syncRefractionCopy();
}
function syncRefractionSettled(){
  ensureRefractionObserver();
  syncMobileLensBox();
  syncRefractionCopy();
}
function scheduleRefractionSync(){
  if(refractionSyncFrame)return;
  refractionSyncFrame=requestAnimationFrame(()=>requestAnimationFrame(syncRefractionSettled));
}
function refractionBurst(){
  syncRefractionSettled();
  /* flow-refraction schedules cloneSource() on a zero-delay timer. Queue our
   * zero-delay settle after that listener so its legacy INSET geometry cannot
   * overwrite the v2 lens-origin correction. Later settles cover stylesheet
   * and font layout without keeping a render loop alive. */
  setTimeout(syncRefractionSettled,0);
  setTimeout(syncRefractionSettled,40);
  setTimeout(syncRefractionSettled,120);
}
window.addEventListener('flow:refraction-refresh',refractionBurst,{passive:true});
window.addEventListener('flow:glass-mode-changed',refractionBurst,{passive:true});
window.addEventListener('resize',scheduleRefractionSync,{passive:true});
window.addEventListener('scroll',scheduleRefractionSync,{passive:true,capture:true});
document.addEventListener('pointermove',event=>{if(event.target.closest?.('#bottomNav'))scheduleRefractionSync()},{passive:true,capture:true});
setTimeout(refractionBurst,180);
setTimeout(refractionBurst,760);