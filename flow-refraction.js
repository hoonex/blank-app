const NAV_SELECTOR='.mobile-bottom-nav, .bottom-nav';
const TAB_SELECTOR='.mobile-tab, .bottom-item';
const GLASS_KEY='flow-glass-mode-v2';
const INSET=5;
let nav=null,source=null,lens=null,sample=null,scene=null,refreshTimer=0,scrollFrame=0,mapData='',stylePromise=null,idAliasStyle=null,idAliasSignature='';

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
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
function sourceFor(node){
  if(node?.classList.contains('mobile-bottom-nav')){
    const dedicated=document.querySelector('#switchDialog[open][data-flow-dedicated="true"]');
    if(dedicated&&visible(dedicated))return dedicated;
    return document.querySelector('.product-main');
  }
  return document.querySelector('.main');
}
function sourceKind(node){
  if(node?.matches?.('#switchDialog[open][data-flow-dedicated="true"]'))return'school-switch';
  if(node?.classList?.contains('product-main'))return'school-main';
  if(node?.classList?.contains('main'))return'university-main';
  return'unknown';
}
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

/* Kube-style convex refraction profile: a squircle surface supplies the slope,
   Snell's law converts that slope to a refracted ray, and the resulting
   magnitude is normalized into the R/G displacement field. */
function roundedRectSdf(x,y,halfW,halfH,radius){
  const qx=Math.abs(x)-(halfW-radius),qy=Math.abs(y)-(halfH-radius),ox=Math.max(qx,0),oy=Math.max(qy,0);
  return Math.hypot(ox,oy)+Math.min(Math.max(qx,qy),0)-radius;
}
function roundedRectNormal(x,y,halfW,halfH,radius){
  const sx=x<0?-1:1,sy=y<0?-1:1,ix=halfW-radius,iy=halfH-radius,qx=Math.abs(x)-ix,qy=Math.abs(y)-iy;
  if(qx>0&&qy>0){const length=Math.max(.001,Math.hypot(qx,qy));return[sx*qx/length,sy*qy/length]}
  return qx>qy?[sx,0]:[0,sy];
}
function squircleHeight(t){const u=1-clamp(t,0,1);return Math.pow(Math.max(0,1-u*u*u*u),.25)}
function snellProfile(samples=256,refractiveIndex=1.5){
  const raw=new Float32Array(samples);let maximum=0;
  for(let i=0;i<samples;i++){
    const t=i/(samples-1),epsilon=1/(samples*2),t0=Math.max(0,t-epsilon),t1=Math.min(1,t+epsilon),h=squircleHeight(t),slope=(squircleHeight(t1)-squircleHeight(t0))/Math.max(1e-5,t1-t0),normalLength=Math.hypot(slope,1),nx=-slope/normalLength,nz=1/normalLength,eta=1/refractiveIndex,cosI=nz,k=1-eta*eta*(1-cosI*cosI);
    if(k<=0||h<=0){raw[i]=0;continue}
    const coefficient=eta*cosI-Math.sqrt(k),tx=coefficient*nx,tz=-eta+coefficient*nz,magnitude=Math.max(0,h*tx/Math.max(1e-4,-tz));
    raw[i]=magnitude;maximum=Math.max(maximum,magnitude);
  }
  if(maximum<=0)return raw;
  for(let i=0;i<samples;i++)raw[i]/=maximum;
  return raw;
}
function sampleProfile(profile,t){const value=clamp(t,0,1)*(profile.length-1),lo=Math.floor(value),hi=Math.min(profile.length-1,lo+1),mix=value-lo;return profile[lo]*(1-mix)+profile[hi]*mix}
function snellDisplacementMap(width,height,{radiusRatio=.49,bezelRatio=.28,refractiveIndex=1.5,oversample=2}={}){
  const scale=Math.max(1,oversample|0),w=width*scale,h=height*scale,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const context=canvas.getContext('2d',{alpha:true});if(!context)return'';
  const image=context.createImageData(w,h),pixels=image.data,halfW=w/2-.5,halfH=h/2-.5,min=Math.min(w,h),radius=Math.min(min*.49,min*radiusRatio),bezel=Math.max(8*scale,min*bezelRatio),profile=snellProfile(256,refractiveIndex);
  for(let py=0;py<h;py++)for(let px=0;px<w;px++){
    const i=(py*w+px)*4,x=px-halfW,y=py-halfH,sdf=roundedRectSdf(x,y,halfW,halfH,radius);let dx=0,dy=0,magnitude=0;
    if(sdf<=0){const depth=-sdf;if(depth<bezel){magnitude=sampleProfile(profile,depth/bezel);const[nx,ny]=roundedRectNormal(x,y,halfW,halfH,radius);dx=-nx*magnitude;dy=-ny*magnitude}}
    pixels[i]=Math.round(clamp(128+dx*127,0,255));pixels[i+1]=Math.round(clamp(128+dy*127,0,255));pixels[i+2]=128;pixels[i+3]=255;
  }
  context.putImageData(image,0,0);
  if(scale===1)return canvas.toDataURL('image/png');
  const target=document.createElement('canvas');target.width=width;target.height=height;const out=target.getContext('2d',{alpha:true});if(!out)return canvas.toDataURL('image/png');out.imageSmoothingEnabled=true;out.imageSmoothingQuality='high';out.drawImage(canvas,0,0,width,height);return target.toDataURL('image/png');
}
function supportsSvgFilter(){
  const probe=document.createElement('i');probe.setAttribute('aria-hidden','true');
  probe.style.cssText='position:fixed;left:-9999px;top:-9999px;width:8px;height:8px;pointer-events:none;filter:url(#flow-liquid-nav-refraction)';
  document.body.append(probe);const ok=/url\(/i.test(getComputedStyle(probe).filter||'');probe.remove();return ok;
}
async function prepareFilter(){
  const filter=document.querySelector('#flow-liquid-nav-refraction');if(!filter)return false;
  /* Chromium resolves raster filter inputs more reliably when the defining SVG
     owns a non-zero viewport and is not trapped by strict containment. Keep it
     offscreen rather than collapsing it to 0x0 or display:none. */
  const host=document.querySelector('#flow-liquid-optics'),svg=host?.querySelector('svg');
  if(host)host.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;overflow:visible;pointer-events:none';
  if(svg){svg.setAttribute('width','1');svg.setAttribute('height','1')}
  filter.setAttribute('color-interpolation-filters','sRGB');
  filter.querySelector('feDisplacementMap')?.setAttribute('scale','20');
  filter.querySelector('feGaussianBlur')?.setAttribute('stdDeviation','0.10');
  filter.querySelector('feColorMatrix')?.setAttribute('values','1.04');
  const image=filter.querySelector('feImage');
  if(image&&!mapData){
    mapData=snellDisplacementMap(320,112,{radiusRatio:.49,bezelRatio:.28,refractiveIndex:1.5,oversample:2});
    if(mapData)image.setAttribute('href',mapData);
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

function rewriteIdSelector(selector){
  return selector.replace(/#([A-Za-z_][\w-]*)/g,(_,id)=>`:is([data-flow-refraction-id="${id}"],#flow-refraction-specificity-sentinel)`);
}
function collectIdAliasRules(rules){
  let output='';
  for(const rule of rules){
    if(rule.selectorText&&rule.selectorText.includes('#')&&rule.style){output+=`${rewriteIdSelector(rule.selectorText)}{${rule.style.cssText}}`;continue}
    if(!rule.cssRules?.length)continue;
    const inner=collectIdAliasRules(rule.cssRules);if(!inner)continue;
    const text=rule.cssText||'',brace=text.indexOf('{');if(brace>0)output+=`${text.slice(0,brace)}{${inner}}`;
  }
  return output;
}
function ensureIdStyleAliases(){
  const sheets=[...document.styleSheets],signature=sheets.map(sheet=>{try{return`${sheet.href||'inline'}:${sheet.cssRules.length}`}catch{return`${sheet.href||'external'}:x`}}).join('|');
  if(signature===idAliasSignature&&idAliasStyle?.isConnected)return;
  let css='';for(const sheet of sheets)try{css+=collectIdAliasRules(sheet.cssRules)}catch{}
  if(!idAliasStyle){idAliasStyle=document.createElement('style');idAliasStyle.id='flow-refraction-id-aliases';document.head.append(idAliasStyle)}
  idAliasStyle.textContent=css;idAliasSignature=signature;
}
function sanitizeClone(copy){
  const idNodes=[];if(copy.id)idNodes.push(copy);copy.querySelectorAll('[id]').forEach(node=>idNodes.push(node));
  idNodes.forEach(node=>{node.dataset.flowRefractionId=node.id;node.removeAttribute('id')});
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
  ensureIdStyleAliases();
  const copy=source.cloneNode(true);copy.classList.add('flow-refraction-source-copy');copy.dataset.flowRefractionSource=sourceKind(source);copy.setAttribute('aria-hidden','true');copy.setAttribute('inert','');
  copy.querySelectorAll('script,.flow-refraction-copy-lens,#flow-liquid-optics').forEach(node=>node.remove());
  sanitizeClone(copy);
  scene.replaceChildren(copy);
  syncGeometry();
}
function syncGeometry({animateScene=false}={}){
  if(!ensureLens()||!visible(nav)||!visible(source))return;
  const navRect=nav.getBoundingClientRect(),sourceRect=source.getBoundingClientRect(),copy=scene.firstElementChild,isDedicated=source.matches?.('#switchDialog[open][data-flow-dedicated="true"]'),localScrollLeft=isDedicated?source.scrollLeft:0,localScrollTop=isDedicated?source.scrollTop:0;
  nav.style.setProperty('--flow-refraction-rest-x',`${targetX(nav).toFixed(2)}px`);
  nav.style.setProperty('--flow-refraction-scene-left',`${(sourceRect.left-localScrollLeft-(navRect.left+INSET)).toFixed(2)}px`);
  nav.style.setProperty('--flow-refraction-scene-top',`${(sourceRect.top-localScrollTop-(navRect.top+INSET)).toFixed(2)}px`);
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
window.addEventListener('pageshow',event=>{if(event.persisted)void syncMode();else scheduleRefresh(40)},{passive:true});

document.addEventListener('focusin',event=>{if(event.target?.matches?.('#switchSearch'))scheduleRefresh(0)},{capture:true,passive:true});
document.addEventListener('input',event=>{if(event.target?.matches?.('#switchSearch'))scheduleRefresh(520)},{capture:true,passive:true});
document.addEventListener('close',event=>{if(event.target?.matches?.('#switchDialog'))scheduleRefresh(0)},true);
document.addEventListener('pointermove',event=>{
  if(!nav||document.documentElement.dataset.flowGlassMode!=='optical'||!event.target.closest?.(NAV_SELECTOR))return;
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
  if(event.target.closest?.('#mobileSchoolBtn,#schoolBtn')){queueMicrotask(()=>scheduleRefresh(0));return}
  if(!event.target.closest?.('[data-view],[data-go],[data-go-view],#mobileSettingsBtn,.flow-mobile-settings,.flow-university-settings-button,#prevDay,#nextDay,#todayBtn,#prevWeek,#nextWeek,#thisWeekBtn,#prevMonth,#nextMonth'))return;
  queueMicrotask(()=>syncGeometry({animateScene:true}));scheduleRefresh(460);
},{passive:true});

setTimeout(()=>{void syncMode();scheduleRefresh(700)},24);