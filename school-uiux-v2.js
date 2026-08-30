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
function scheduleRefractionSync(){
  if(refractionSyncFrame)return;
  refractionSyncFrame=requestAnimationFrame(()=>requestAnimationFrame(()=>{ensureRefractionObserver();syncRefractionCopy()}));
}
function refractionBurst(){
  scheduleRefractionSync();
  setTimeout(scheduleRefractionSync,40);
  setTimeout(scheduleRefractionSync,120);
}
window.addEventListener('flow:refraction-refresh',refractionBurst,{passive:true});
window.addEventListener('flow:glass-mode-changed',refractionBurst,{passive:true});
window.addEventListener('resize',scheduleRefractionSync,{passive:true});
window.addEventListener('scroll',scheduleRefractionSync,{passive:true,capture:true});
document.addEventListener('pointermove',event=>{if(event.target.closest?.('#bottomNav'))scheduleRefractionSync()},{passive:true,capture:true});
setTimeout(refractionBurst,180);
setTimeout(refractionBurst,760);
