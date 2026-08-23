const NAV_SELECTOR='.mobile-bottom-nav, .bottom-nav';
const TAB_SELECTOR='.mobile-tab, .bottom-item';
const GLASS_KEY='flow-glass-mode-v2';
const INSET=5;
let nav=null,source=null,lens=null,sample=null,scene=null,refreshTimer=0,scrollFrame=0,mapUrl='',stylePromise=null;

const visible=node=>{if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};

function ensureStyles(){
  if(stylePromise)return stylePromise;
  const href='/flow-refraction.css';
  let link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(node=>{try{return new URL(node.href,location.href).pathname===href}catch{return false}});
  if(link?.sheet)return stylePromise=Promise.resolve();
  if(!link){link=document.createElement('link');link.rel='stylesheet';link.href=href;document.head.append(link)}
  stylePromise=new Promise(resolve=>{link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});setTimeout(resolve,1200)});
  return stylePromise;
}
function activeNav(){return [...document.querySelectorAll(NAV_SELECTOR)].find(visible)||null}
function sourceFor(node){return node?.classList.contains('mobile-bottom-nav')?document.querySelector('.product-main'):document.querySelector('.main')}
function tabs(node){return node?[...node.querySelectorAll(`:scope > ${TAB_SELECTOR.split(', ').join(', :scope > ')}`)].filter(button=>!button.hidden&&getComputedStyle(button).display!=='none'):[]}
function targetX(node){
  const list=tabs(node);if(!node||!list.length)return 0;
  const rect=node.getBoundingClientRect(),slot=Math.max(1,rect.width-INSET*2)/list.length,index=Math.max(0,list.findIndex(button=>button.classList.contains('active')));
  return slot*index;
}
function currentLensX(){
  if(!nav)return 0;
  const inline=Number.parseFloat(nav.style.getPropertyValue('--flow-lens-x'));
  return Number.isFinite(inline)?inline:targetX(nav);
}
function syncSceneMotion({animate=false}={}){
  if(!scene||!nav)return;
  const x=currentLensX(),duration=animate?(Number.parseFloat(nav.style.getPropertyValue('--flow-lens-duration'))||420):0,ease=nav.style.getPropertyValue('--flow-lens-ease').trim()||'cubic-bezier(.18,1.18,.28,1)';
  scene.style.setProperty('transition',duration>0?`transform ${duration}ms ${ease}`:'none','important');
  scene.style.setProperty('transform',`translate3d(${-x.toFixed(2)}px,0,0)`,'important');
}
function supportsSvgFilter(){
  const probe=document.createElement('i');probe.setAttribute('aria-hidden','true');
  probe.style.cssText='position:fixed;left:-9999px;top:-9999px;width:8px;height:8px;pointer-events:none;filter:url(#flow-liquid-nav-refraction)';
  document.body.append(probe);const ok=/url\(/i.test(getComputedStyle(probe).filter||'');probe.remove();return ok;
}
async function prepareFilter(){
  const filter=document.querySelector('#flow-liquid-nav-refraction');if(!filter)return false;
  filter.setAttribute('color-interpolation-filters','sRGB');
  filter.querySelector('feDisplacementMap')?.setAttribute('scale','20');
  filter.querySelector('feGaussianBlur')?.setAttribute('stdDeviation','0.10');
  filter.querySelector('feColorMatrix')?.setAttribute('values','1.04');
  const image=filter.querySelector('feImage'),href=image?.getAttribute('href')||image?.getAttribute('xlink:href')||'';
  /* WebKit can silently reject data: URLs in feImage. A blob URL keeps the
     same generated map while making ordinary SVG filter rendering portable. */
  if(image&&href.startsWith('data:')&&!mapUrl){
    try{const blob=await fetch(href).then(response=>response.blob());mapUrl=URL.createObjectURL(blob);image.setAttribute('href',mapUrl)}catch{}
  }
  return supportsSvgFilter();
}
function ensureLens(){
  const nextNav=activeNav(),nextSource=sourceFor(nextNav);if(!nextNav||!nextSource)return false;
  if(nav===nextNav&&source===nextSource&&lens?.isConnected)return true;
  lens?.remove();nav=nextNav;source=nextSource;
  lens=document.createElement('div');lens.className='flow-refraction-copy-lens';lens.dataset.flowRefractionLens='true';lens.setAttribute('aria-hidden','true');
  sample=document.createElement('div');sample.className='flow-refraction-sample';
  scene=document.createElement('div');scene.className='flow-refraction-scene';
  sample.append(scene);lens.append(sample);nav.prepend(lens);
  return true;
}
function sanitizeClone(copy){
  copy.removeAttribute('id');
  copy.querySelectorAll('[id]').forEach(node=>node.removeAttribute('id'));
  copy.querySelectorAll('label[for]').forEach(node=>node.removeAttribute('for'));
  copy.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby]').forEach(node=>{node.removeAttribute('aria-controls');node.removeAttribute('aria-labelledby');node.removeAttribute('aria-describedby')});
  copy.querySelectorAll('button,a,input,select,textarea,[tabindex]').forEach(node=>{
    node.setAttribute('tabindex','-1');node.setAttribute('aria-hidden','true');
    for(const attr of ['data-flow-settings-glass','data-flow-settings-theme','data-theme-choice','data-view','data-go','data-go-view','data-close-dialog'])node.removeAttribute(attr);
    if(node.matches('a'))node.removeAttribute('href');
  });
}
function cloneSource(){
  if(!source||!scene)return;
  const copy=source.cloneNode(true);copy.classList.add('flow-refraction-source-copy');copy.setAttribute('aria-hidden','true');copy.setAttribute('inert','');
  copy.querySelectorAll('script,.flow-refraction-copy-lens,#flow-liquid-optics').forEach(node=>node.remove());
  sanitizeClone(copy);
  scene.replaceChildren(copy);
  syncGeometry();
}
function syncGeometry({animateScene=false}={}){
  if(!ensureLens()||!visible(nav)||!visible(source))return;
  const navRect=nav.getBoundingClientRect(),sourceRect=source.getBoundingClientRect(),copy=scene.firstElementChild;
  nav.style.setProperty('--flow-refraction-rest-x',`${targetX(nav).toFixed(2)}px`);
  nav.style.setProperty('--flow-refraction-scene-left',`${(sourceRect.left-(navRect.left+INSET)).toFixed(2)}px`);
  nav.style.setProperty('--flow-refraction-scene-top',`${(sourceRect.top-(navRect.top+INSET)).toFixed(2)}px`);
  if(copy){
    copy.style.setProperty('position','absolute','important');copy.style.setProperty('left','0','important');copy.style.setProperty('top','0','important');
    copy.style.setProperty('width',`${sourceRect.width.toFixed(2)}px`,'important');copy.style.setProperty('height',`${Math.max(sourceRect.height,source.scrollHeight).toFixed(2)}px`,'important');
    copy.style.setProperty('margin','0','important');copy.style.setProperty('max-width','none','important');copy.style.setProperty('pointer-events','none','important');
    copy.style.setProperty('transform','none','important');copy.style.setProperty('animation','none','important');
  }
  syncSceneMotion({animate:animateScene});
}
function scheduleRefresh(delay=80){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(document.documentElement.dataset.flowGlassMode!=='optical')return;ensureLens();cloneSource()},delay)}
function onScroll(){if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;syncGeometry()})}
function disable(){
  lens?.remove();lens=sample=scene=null;
  if(nav){for(const name of ['--flow-refraction-rest-x','--flow-refraction-scene-left','--flow-refraction-scene-top'])nav.style.removeProperty(name)}
  nav=source=null;document.documentElement.removeAttribute('data-flow-refraction-copy');
}
async function syncMode(){
  const root=document.documentElement;
  if((localStorage.getItem(GLASS_KEY)||'standard')!=='optical'&&root.dataset.flowGlassMode!=='optical'){disable();return}
  await ensureStyles();
  const ok=await prepareFilter();if(!ok){root.dataset.flowGlassRefraction='fallback';disable();return}
  if(!ensureLens())return;
  root.dataset.flowGlassRefraction='true';root.dataset.flowRefractionCopy='true';cloneSource();
}

window.addEventListener('flow:glass-mode-changed',()=>void syncMode(),{passive:true});
window.addEventListener('flow:refraction-refresh',()=>scheduleRefresh(0),{passive:true});
window.addEventListener('flow:timetable-changed',()=>scheduleRefresh(70),{passive:true});
window.addEventListener('scroll',onScroll,{passive:true,capture:true});
window.addEventListener('resize',()=>{syncGeometry();scheduleRefresh(120)},{passive:true});
window.addEventListener('pageshow',()=>scheduleRefresh(40),{passive:true});
window.addEventListener('pagehide',()=>{if(mapUrl){URL.revokeObjectURL(mapUrl);mapUrl=''}},{passive:true});

document.addEventListener('pointermove',event=>{
  if(!nav||document.documentElement.dataset.flowGlassMode!=='optical'||!event.target.closest?.(NAV_SELECTOR))return;
  /* flow-native.js is registered first and has already written --flow-lens-x.
     Mirror that exact translation with the inverse transform so the visual
     copy stays registered to the real page while the glass aperture moves. */
  syncSceneMotion({animate:false});
},{capture:true,passive:true});
document.addEventListener('pointerup',event=>{
  if(!nav||document.documentElement.dataset.flowGlassMode!=='optical'||!event.target.closest?.(NAV_SELECTOR))return;
  syncSceneMotion({animate:true});
},{capture:true,passive:true});
document.addEventListener('pointercancel',event=>{
  if(!nav||document.documentElement.dataset.flowGlassMode!=='optical'||!event.target.closest?.(NAV_SELECTOR))return;
  syncSceneMotion({animate:true});
},{capture:true,passive:true});
document.addEventListener('transitionend',event=>{
  if(event.target!==lens||event.propertyName!=='transform')return;
  syncSceneMotion({animate:false});
},{passive:true});
document.addEventListener('click',event=>{
  if(!event.target.closest?.('[data-view],[data-go],[data-go-view],#mobileSettingsBtn,.flow-mobile-settings,.flow-university-settings-button,#prevDay,#nextDay,#todayBtn,#prevWeek,#nextWeek,#thisWeekBtn,#prevMonth,#nextMonth'))return;
  queueMicrotask(()=>syncGeometry({animateScene:true}));scheduleRefresh(460);
},{passive:true});

setTimeout(()=>{void syncMode();scheduleRefresh(700)},24);
