const NAV_SELECTOR='.mobile-bottom-nav, .bottom-nav';
const TAB_SELECTOR='.mobile-tab, .bottom-item';
const GLASS_KEY='flow-glass-mode-v2';
const INSET=5;
let nav=null,source=null,lens=null,sample=null,scene=null,refreshTimer=0,scrollFrame=0,mapUrl='';

const visible=node=>{if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0};

function ensureStyles(){
  const href='/flow-refraction.css';
  let link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(node=>{try{return new URL(node.href,location.href).pathname===href}catch{return false}});
  if(!link){link=document.createElement('link');link.rel='stylesheet';link.href=href}
  document.head.append(link);
}
function activeNav(){return [...document.querySelectorAll(NAV_SELECTOR)].find(visible)||null}
function sourceFor(node){return node?.classList.contains('mobile-bottom-nav')?document.querySelector('.product-main'):document.querySelector('.main')}
function tabs(node){return node?[...node.querySelectorAll(`:scope > ${TAB_SELECTOR.split(', ').join(', :scope > ')}`)].filter(button=>!button.hidden&&getComputedStyle(button).display!=='none'):[]}
function targetX(node){
  const list=tabs(node);if(!node||!list.length)return 0;
  const rect=node.getBoundingClientRect(),slot=Math.max(1,rect.width-INSET*2)/list.length,index=Math.max(0,list.findIndex(button=>button.classList.contains('active')));
  return slot*index;
}
function supportsSvgFilter(){
  const probe=document.createElement('i');probe.setAttribute('aria-hidden','true');
  probe.style.cssText='position:fixed;left:-9999px;top:-9999px;width:8px;height:8px;pointer-events:none;filter:url(#flow-liquid-nav-refraction)';
  document.body.append(probe);const ok=/url\(/i.test(getComputedStyle(probe).filter||'');probe.remove();return ok;
}
async function prepareFilter(){
  const filter=document.querySelector('#flow-liquid-nav-refraction');if(!filter)return false;
  filter.querySelector('feDisplacementMap')?.setAttribute('scale','32');
  filter.querySelector('feGaussianBlur')?.setAttribute('stdDeviation','0.08');
  filter.querySelector('feColorMatrix')?.setAttribute('values','1');
  const image=filter.querySelector('feImage'),href=image?.getAttribute('href')||image?.getAttribute('xlink:href')||'';
  if(image&&href.startsWith('data:')&&!mapUrl){
    try{const blob=await fetch(href).then(response=>response.blob());mapUrl=URL.createObjectURL(blob);image.setAttribute('href',mapUrl)}catch{}
  }
  return supportsSvgFilter();
}
function ensureLens(){
  const nextNav=activeNav(),nextSource=sourceFor(nextNav);if(!nextNav||!nextSource)return false;
  if(nav===nextNav&&source===nextSource&&lens?.isConnected)return true;
  lens?.remove();nav=nextNav;source=nextSource;
  lens=document.createElement('div');lens.className='flow-refraction-copy-lens';lens.setAttribute('aria-hidden','true');
  sample=document.createElement('div');sample.className='flow-refraction-sample';
  scene=document.createElement('div');scene.className='flow-refraction-scene';
  sample.append(scene);lens.append(sample);nav.prepend(lens);
  return true;
}
function cloneSource(){
  if(!source||!scene)return;
  const copy=source.cloneNode(true);copy.classList.add('flow-refraction-source-copy');copy.setAttribute('aria-hidden','true');copy.setAttribute('inert','');
  copy.querySelectorAll('script,.flow-refraction-copy-lens,#flow-liquid-optics').forEach(node=>node.remove());
  copy.querySelectorAll('button,a,input,select,textarea,[tabindex]').forEach(node=>{node.setAttribute('tabindex','-1');node.setAttribute('aria-hidden','true')});
  scene.replaceChildren(copy);
  syncGeometry();
}
function syncGeometry(){
  if(!ensureLens()||!visible(nav)||!visible(source))return;
  const navRect=nav.getBoundingClientRect(),sourceRect=source.getBoundingClientRect(),copy=scene.firstElementChild;
  nav.style.setProperty('--flow-copy-lens-x',`${targetX(nav).toFixed(2)}px`);
  nav.style.setProperty('--flow-refraction-scene-left',`${(sourceRect.left-(navRect.left+INSET)).toFixed(2)}px`);
  nav.style.setProperty('--flow-refraction-scene-top',`${(sourceRect.top-(navRect.top+INSET)).toFixed(2)}px`);
  if(copy){
    copy.style.setProperty('position','absolute','important');copy.style.setProperty('left','0','important');copy.style.setProperty('top','0','important');
    copy.style.setProperty('width',`${sourceRect.width.toFixed(2)}px`,'important');copy.style.setProperty('height',`${Math.max(sourceRect.height,source.scrollHeight).toFixed(2)}px`,'important');
    copy.style.setProperty('margin','0','important');copy.style.setProperty('max-width','none','important');copy.style.setProperty('pointer-events','none','important');
    copy.style.setProperty('transform','none','important');copy.style.setProperty('animation','none','important');
  }
}
function scheduleRefresh(delay=80){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(document.documentElement.dataset.flowGlassMode!=='optical')return;ensureLens();cloneSource()},delay)}
function onScroll(){if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{scrollFrame=0;syncGeometry()})}
function disable(){lens?.remove();lens=sample=scene=null;nav?.style.removeProperty('--flow-copy-lens-x');nav?.style.removeProperty('--flow-refraction-scene-left');nav?.style.removeProperty('--flow-refraction-scene-top');nav=source=null}
async function syncMode(){
  if((localStorage.getItem(GLASS_KEY)||'standard')!=='optical'&&document.documentElement.dataset.flowGlassMode!=='optical'){disable();return}
  ensureStyles();
  const ok=await prepareFilter();if(!ok){document.documentElement.dataset.flowGlassRefraction='fallback';disable();return}
  if(!ensureLens())return;
  document.documentElement.dataset.flowGlassRefraction='true';cloneSource();
}

window.addEventListener('flow:glass-mode-changed',()=>void syncMode(),{passive:true});
window.addEventListener('flow:refraction-refresh',()=>scheduleRefresh(0),{passive:true});
window.addEventListener('flow:timetable-changed',()=>scheduleRefresh(70),{passive:true});
window.addEventListener('scroll',onScroll,{passive:true});
window.addEventListener('resize',()=>{syncGeometry();scheduleRefresh(120)},{passive:true});
window.addEventListener('pageshow',()=>scheduleRefresh(40),{passive:true});
document.addEventListener('click',event=>{
  if(!event.target.closest?.('[data-view],[data-go],[data-go-view],#mobileSettingsBtn,.flow-mobile-settings,.flow-university-settings-button,#prevDay,#nextDay,#todayBtn,#prevWeek,#nextWeek,#thisWeekBtn,#prevMonth,#nextMonth'))return;
  queueMicrotask(syncGeometry);scheduleRefresh(180);
},{passive:true});

setTimeout(()=>{ensureStyles();void syncMode();scheduleRefresh(700)},24);
