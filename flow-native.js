const NAV_SELECTOR='.mobile-bottom-nav, .bottom-nav';
const TAB_SELECTOR='.mobile-tab, .bottom-item';
const SHEET_SELECTOR='.sheet, .dialog-sheet';
const SHEET_HANDLE='.flow-sheet-grab-handle';
const GLASS_KEY='flow-glass-mode-v2';
const UNIVERSITY_THEME_KEY='flow-university-theme-v1';
const DRAG_THRESHOLD=7;
const PROJECT_MS=100;
const SHEET_PROJECT_MS=90;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let gesture=null;
let sheetGesture=null;
let syntheticClick=false;
let suppressClickUntil=0;
let settleTimer=0;
let sheetTimer=0;
let glassSupport=null;

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const now=()=>performance.now();

function installMaterialLayer(){
  const href='/flow-material.css';
  let link=[...document.querySelectorAll('link[rel="stylesheet"]')].find(node=>{try{return new URL(node.href,location.href).pathname===href}catch{return false}});
  if(!link){link=document.createElement('link');link.rel='stylesheet';link.href=href}
  document.head.append(link);
}

function roundedRectSdf(x,y,halfW,halfH,radius){
  const qx=Math.abs(x)-(halfW-radius),qy=Math.abs(y)-(halfH-radius);
  const ox=Math.max(qx,0),oy=Math.max(qy,0);
  return Math.hypot(ox,oy)+Math.min(Math.max(qx,qy),0)-radius;
}
function roundedRectNormal(x,y,halfW,halfH,radius){
  const sx=x<0?-1:1,sy=y<0?-1:1,ix=halfW-radius,iy=halfH-radius;
  const qx=Math.abs(x)-ix,qy=Math.abs(y)-iy;
  if(qx>0&&qy>0){const length=Math.max(.001,Math.hypot(qx,qy));return[sx*qx/length,sy*qy/length]}
  return qx>qy?[sx,0]:[0,sy]
}
function displacementMap(width,height,{radiusRatio=.24,bezelRatio=.22}={}){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d',{alpha:true});if(!context)return'';
  const image=context.createImageData(width,height),pixels=image.data;
  const halfW=width/2-.5,halfH=height/2-.5,min=Math.min(width,height),radius=Math.min(min*.49,min*radiusRatio),bezel=Math.max(8,min*bezelRatio);
  for(let py=0;py<height;py++)for(let px=0;px<width;px++){
    const i=(py*width+px)*4,x=px-halfW,y=py-halfH,sdf=roundedRectSdf(x,y,halfW,halfH,radius);
    let dx=0,dy=0,weight=0;
    if(sdf<=0){
      const edge=-sdf,t=1-clamp(edge/bezel,0,1),smooth=t*t*(3-2*t);
      weight=Math.pow(smooth,.86);
      const [nx,ny]=roundedRectNormal(x,y,halfW,halfH,radius);
      dx=-nx*weight;dy=-ny*weight;
    }
    pixels[i]=Math.round(clamp(128+dx*126,0,255));
    pixels[i+1]=Math.round(clamp(128+dy*126,0,255));
    pixels[i+2]=Math.round(clamp(128+weight*112,0,255));
    pixels[i+3]=255;
  }
  context.putImageData(image,0,0);return canvas.toDataURL('image/png');
}

/*
 * Optical Glass is explicit progressive enhancement. The default material is
 * stable frost/specular glass. When the user opts in and the browser retains
 * an SVG URL inside backdrop-filter, a shape-adapted displacement map bends
 * the live backdrop itself. No screenshot/canvas copy of page content is used.
 */
function installLiquidGlassOptics(){
  if(glassSupport!==null)return glassSupport;
  if(document.querySelector('#flow-liquid-optics'))return document.documentElement.dataset.flowGlassRefraction==='true';
  const navMap=displacementMap(320,112,{radiusRatio:.49,bezelRatio:.26});
  const sheetMap=displacementMap(288,288,{radiusRatio:.12,bezelRatio:.18});
  if(!navMap||!sheetMap){glassSupport=false;return false}
  const host=document.createElement('div');
  host.id='flow-liquid-optics';
  host.setAttribute('aria-hidden','true');
  host.style.cssText='position:fixed;width:0;height:0;overflow:hidden;pointer-events:none;contain:strict';
  host.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" focusable="false" aria-hidden="true"><defs>
    <filter id="flow-liquid-nav-refraction" x="-16%" y="-42%" width="132%" height="184%" color-interpolation-filters="sRGB">
      <feImage href="${navMap}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="flowNavMap"/>
      <feDisplacementMap in="SourceGraphic" in2="flowNavMap" scale="18" xChannelSelector="R" yChannelSelector="G" result="flowNavRefracted"/>
      <feGaussianBlur in="flowNavRefracted" stdDeviation="0.22" result="flowNavSoft"/>
      <feColorMatrix in="flowNavSoft" type="saturate" values="1.1"/>
    </filter>
    <filter id="flow-liquid-sheet-refraction" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
      <feImage href="${sheetMap}" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="flowSheetMap"/>
      <feDisplacementMap in="SourceGraphic" in2="flowSheetMap" scale="22" xChannelSelector="R" yChannelSelector="G" result="flowSheetRefracted"/>
      <feGaussianBlur in="flowSheetRefracted" stdDeviation="0.28" result="flowSheetSoft"/>
      <feColorMatrix in="flowSheetSoft" type="saturate" values="1.08"/>
    </filter>
  </defs></svg>`;
  (document.body||document.documentElement).prepend(host);

  const probe=document.createElement('i');
  probe.setAttribute('aria-hidden','true');
  probe.style.cssText='position:fixed;left:-9999px;top:-9999px;width:8px;height:8px;pointer-events:none;backdrop-filter:url(#flow-liquid-nav-refraction) blur(1px);-webkit-backdrop-filter:url(#flow-liquid-nav-refraction) blur(1px)';
  (document.body||document.documentElement).append(probe);
  const style=getComputedStyle(probe),computed=style.backdropFilter||style.webkitBackdropFilter||'';
  glassSupport=/url\(/i.test(computed);probe.remove();return glassSupport;
}
function glassMode(){return localStorage.getItem(GLASS_KEY)==='optical'?'optical':'standard'}
function syncGlassControls(){
  const mode=glassMode(),refraction=document.documentElement.dataset.flowGlassRefraction||'off';
  document.querySelectorAll('[data-flow-glass-choice]').forEach(button=>{
    const active=button.dataset.flowGlassChoice===mode;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
  const status=mode==='standard'?'기본 유리 · 안정성과 가독성 우선':refraction==='true'?'Optical Glass 활성화 · 실제 배경 굴절 사용':'Optical Glass 선택됨 · 이 브라우저에서는 기본 유리로 대체됨';
  document.querySelectorAll('[data-flow-glass-status]').forEach(node=>node.textContent=status);
}
function applyGlassMode(mode=glassMode(),{persist=false}={}){
  const normalized=mode==='optical'?'optical':'standard',root=document.documentElement;
  if(persist)localStorage.setItem(GLASS_KEY,normalized);
  root.dataset.flowGlassMode=normalized;
  root.dataset.flowGlassRefraction=normalized==='optical'?(installLiquidGlassOptics()?'true':'fallback'):'off';
  syncGlassControls();
  window.dispatchEvent(new CustomEvent('flow:glass-mode-changed',{detail:{mode:normalized,refraction:root.dataset.flowGlassRefraction}}));
}
function wireGlassChoices(root=document){
  root.querySelectorAll('[data-flow-glass-choice]').forEach(button=>{
    if(button.dataset.flowGlassWired)return;button.dataset.flowGlassWired='true';
    button.addEventListener('click',()=>applyGlassMode(button.dataset.flowGlassChoice,{persist:true}));
  });
}
function glassSettingsMarkup(){return`<h3>유리 효과</h3><p>기본은 안정적인 유리 재질입니다. Optical Glass는 지원되는 Chromium에서 뒤 콘텐츠 자체를 굴절시킵니다.</p><div class="segmented flow-glass-segment" aria-label="유리 효과"><button type="button" data-flow-glass-choice="standard">기본</button><button type="button" data-flow-glass-choice="optical">Optical</button></div><small class="flow-glass-status" data-flow-glass-status></small>`}
function installSchoolGlassSettings(){
  const sheet=document.querySelector('#settingsDialog .settings-sheet');if(!sheet||sheet.querySelector('.flow-glass-settings'))return;
  const group=document.createElement('div');group.className='settings-group flow-glass-settings';group.innerHTML=glassSettingsMarkup();
  const anchor=sheet.querySelector('#installBtn')?.closest('.settings-group')||sheet.querySelector('#saveSettingsBtn');
  if(anchor)anchor.before(group);else sheet.append(group);
  wireGlassChoices(group);
}
function universityTheme(){const value=localStorage.getItem(UNIVERSITY_THEME_KEY)||'light';return['light','system','dark'].includes(value)?value:'light'}
function syncUniversityThemeControls(){
  const value=universityTheme();
  document.querySelectorAll('[data-flow-university-theme-choice]').forEach(button=>{
    const active=button.dataset.flowUniversityThemeChoice===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
}
function setUniversityTheme(value){
  if(!['light','system','dark'].includes(value))return;
  const relay=document.querySelector(`.flow-theme-segment [data-university-theme="${value}"]`);
  if(relay)relay.click();
  else{
    localStorage.setItem(UNIVERSITY_THEME_KEY,value);
    const effective=value==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):value;
    document.documentElement.dataset.theme=effective;document.documentElement.dataset.themeMode=value;
  }
  queueMicrotask(syncUniversityThemeControls);
}
function installUniversitySettings(){
  if(!document.querySelector('.mobile-header')||document.querySelector('#flowUniversitySettingsDialog'))return;
  const dialog=document.createElement('dialog');dialog.id='flowUniversitySettingsDialog';
  dialog.innerHTML=`<div class="dialog-sheet flow-settings-sheet"><button class="dialog-close" data-flow-settings-close type="button" aria-label="닫기">×</button><span class="kicker">SETTINGS</span><h2>화면 설정</h2><section class="flow-setting-section"><h3>화면</h3><div class="flow-setting-segment flow-theme-settings-segment" aria-label="화면 테마"><button type="button" data-flow-university-theme-choice="light">밝게</button><button type="button" data-flow-university-theme-choice="system">기기 설정</button><button type="button" data-flow-university-theme-choice="dark">어둡게</button></div></section><section class="flow-setting-section flow-glass-settings">${glassSettingsMarkup()}</section></div>`;
  document.body.append(dialog);
  dialog.querySelector('[data-flow-settings-close]')?.addEventListener('click',()=>dialog.close());
  dialog.querySelectorAll('[data-flow-university-theme-choice]').forEach(button=>button.addEventListener('click',()=>setUniversityTheme(button.dataset.flowUniversityThemeChoice)));
  wireGlassChoices(dialog);syncUniversityThemeControls();
  const bottom=document.querySelector('.sidebar-bottom');if(bottom&&!bottom.querySelector('.flow-university-settings-button')){
    const button=document.createElement('button');button.className='soft-button full flow-university-settings-button';button.type='button';button.textContent='설정';button.addEventListener('click',()=>{syncUniversityThemeControls();syncGlassControls();dialog.showModal()});bottom.prepend(button);
  }
}
function settingsIcon(){return'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h8m4 0h4M4 17h4m4 0h8"/><circle cx="14" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>'}
function installMobileSettingsControl(){
  const header=document.querySelector('.mobile-topbar, .mobile-header');if(!header||header.querySelector('.flow-mobile-settings'))return;
  const button=document.createElement('button');button.className='flow-mobile-settings';button.type='button';button.setAttribute('aria-label','설정');button.innerHTML=settingsIcon();
  const schoolTrigger=document.querySelector('#mobileSettingsBtn'),universityDialog=document.querySelector('#flowUniversitySettingsDialog');
  button.addEventListener('click',()=>{
    if(schoolTrigger){schoolTrigger.click();return}
    if(universityDialog){syncUniversityThemeControls();syncGlassControls();universityDialog.showModal()}
  });
  const identity=header.querySelector('.mobile-school-button, .mobile-school');header.insertBefore(button,identity||null);
}
function sheetFor(dialog){return dialog?.querySelector?.(':scope > .sheet, :scope > .dialog-sheet')||null}
function resetSheetMotion(dialog,{resting=false}={}){
  if(!dialog)return;
  for(const name of ['data-flow-sheet-grabbed','data-flow-sheet-dragging','data-flow-sheet-settling','data-flow-sheet-dismissing','data-flow-sheet-resting'])dialog.removeAttribute(name);
  if(resting)dialog.dataset.flowSheetResting='true';
  for(const name of ['--flow-sheet-y','--flow-sheet-scale','--flow-sheet-duration','--flow-sheet-opacity','--flow-sheet-backdrop-opacity'])dialog.style.removeProperty(name);
}
function installSheetHandles(){
  for(const dialog of document.querySelectorAll('dialog')){
    const sheet=sheetFor(dialog);if(!sheet||sheet.querySelector(`:scope > ${SHEET_HANDLE}`))continue;
    const handle=document.createElement('div');
    handle.className=SHEET_HANDLE.slice(1);
    handle.setAttribute('aria-hidden','true');
    sheet.prepend(handle);
    dialog.addEventListener('close',()=>{
      if(sheetGesture?.dialog===dialog)sheetGesture=null;
      clearTimeout(sheetTimer);
      resetSheetMotion(dialog);
    },{passive:true});
  }
}
function installVisualSystem(){
  installSchoolGlassSettings();
  installUniversitySettings();
  installMobileSettingsControl();
  installSheetHandles();
  applyGlassMode();
  /* Existing School/University polish links finish synchronously on startup. Move this one last. */
  setTimeout(installMaterialLayer,0);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installVisualSystem,{once:true});
else installVisualSystem();

function setSheetMotion(state,y){
  const progress=clamp(Math.max(0,y)/Math.min(360,Math.max(160,state.rect.height*.65)),0,1);
  const scale=1-Math.min(.018,progress*.018);
  state.currentY=y;
  state.dialog.style.setProperty('--flow-sheet-y',`${y.toFixed(2)}px`);
  state.dialog.style.setProperty('--flow-sheet-scale',scale.toFixed(4));
  state.dialog.style.setProperty('--flow-sheet-opacity','1');
  state.dialog.style.setProperty('--flow-sheet-backdrop-opacity',(1-progress*.58).toFixed(3));
}
function beginSheetGesture(event){
  if(reducedMotion.matches||!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return false;
  const handle=event.target.closest?.(SHEET_HANDLE);const sheet=handle?.closest?.(SHEET_SELECTOR);const dialog=sheet?.closest?.('dialog[open]');
  if(!handle||!sheet||!dialog||sheetFor(dialog)!==sheet)return false;
  clearTimeout(sheetTimer);
  const t=now(),rect=sheet.getBoundingClientRect();
  sheetGesture={dialog,sheet,handle,pointerId:event.pointerId,startY:event.clientY,lastY:event.clientY,lastT:t,velocity:0,currentY:0,rect,dragging:false};
  dialog.dataset.flowSheetGrabbed='true';
  dialog.style.setProperty('--flow-sheet-y','0px');
  dialog.style.setProperty('--flow-sheet-scale','1');
  dialog.style.setProperty('--flow-sheet-opacity','1');
  dialog.style.setProperty('--flow-sheet-backdrop-opacity','1');
  try{handle.setPointerCapture?.(event.pointerId)}catch{}
  event.preventDefault();
  return true;
}
function settleSheet(state,dismiss=false){
  const {dialog,handle,pointerId,rect}=state;
  try{handle.releasePointerCapture?.(pointerId)}catch{}
  dialog.removeAttribute('data-flow-sheet-grabbed');
  dialog.removeAttribute('data-flow-sheet-dragging');
  dialog.dataset.flowSheetSettling='true';
  const speed=Math.max(0,state.velocity);
  const duration=dismiss?clamp(205-speed*45,145,215):clamp(250-Math.min(speed,1.4)*28,210,260);
  dialog.style.setProperty('--flow-sheet-duration',`${Math.round(duration)}ms`);
  if(dismiss){
    dialog.dataset.flowSheetDismissing='true';
    const target=Math.max(window.innerHeight*.78,rect.height+90);
    dialog.style.setProperty('--flow-sheet-y',`${Math.round(target)}px`);
    dialog.style.setProperty('--flow-sheet-scale','.985');
    dialog.style.setProperty('--flow-sheet-opacity','0');
    dialog.style.setProperty('--flow-sheet-backdrop-opacity','0');
  }else{
    dialog.style.setProperty('--flow-sheet-y','0px');
    dialog.style.setProperty('--flow-sheet-scale','1');
    dialog.style.setProperty('--flow-sheet-opacity','1');
    dialog.style.setProperty('--flow-sheet-backdrop-opacity','1');
  }
  clearTimeout(sheetTimer);
  sheetTimer=setTimeout(()=>{
    if(dismiss){
      if(dialog.open)dialog.close();
      resetSheetMotion(dialog);
      return;
    }
    resetSheetMotion(dialog,{resting:true});
  },duration+45);
}
function releaseSheetGesture(event,cancelled=false){
  if(!sheetGesture||event.pointerId!==sheetGesture.pointerId)return false;
  const state=sheetGesture;sheetGesture=null;
  if(cancelled||!state.dragging){settleSheet(state,false);return true}
  const y=Math.max(0,state.currentY),threshold=clamp(state.rect.height*.22,92,162);
  const projected=y+Math.max(0,state.velocity)*SHEET_PROJECT_MS;
  const dismiss=y>=threshold||(y>72&&state.velocity>.9)||(y>72&&projected>threshold*1.18);
  settleSheet(state,dismiss);
  return true;
}
function cancelSheetGesture(){
  if(!sheetGesture)return;
  const {dialog,handle,pointerId}=sheetGesture;sheetGesture=null;
  try{handle.releasePointerCapture?.(pointerId)}catch{}
  clearTimeout(sheetTimer);
  resetSheetMotion(dialog,{resting:true});
}

document.addEventListener('pointerdown',event=>{beginSheetGesture(event)},{capture:true,passive:false});
document.addEventListener('pointermove',event=>{
  const state=sheetGesture;if(!state||event.pointerId!==state.pointerId)return;
  const dy=event.clientY-state.startY;
  if(!state.dragging&&Math.abs(dy)>=2){state.dragging=true;state.dialog.dataset.flowSheetDragging='true'}
  if(!state.dragging)return;
  event.preventDefault();
  const t=now(),dt=Math.max(1,t-state.lastT),instant=(event.clientY-state.lastY)/dt;
  state.velocity=state.velocity*.56+instant*.44;state.lastY=event.clientY;state.lastT=t;
  const y=dy>=0?(dy<=180?dy:180+(dy-180)*.48):Math.max(-10,dy*.12);
  setSheetMotion(state,y);
},{capture:true,passive:false});
document.addEventListener('pointerup',event=>{releaseSheetGesture(event,false)},{capture:true});
document.addEventListener('pointercancel',event=>{releaseSheetGesture(event,true)},{capture:true});

function buttons(nav){return [...nav.querySelectorAll(`:scope > ${TAB_SELECTOR.split(', ').join(', :scope > ')}`)].filter(button=>!button.hidden&&getComputedStyle(button).display!=='none')}
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
window.addEventListener('blur',()=>{cancelGesture();cancelSheetGesture()},{passive:true});
window.addEventListener('resize',()=>{cancelGesture();cancelSheetGesture()},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelGesture();cancelSheetGesture()}},{passive:true});
