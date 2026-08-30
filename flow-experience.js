const HAPTIC_KEY='flow-haptics-v1';
const AMBIENT_KEY='flow-ambient-v1';
const MOTION_KEY='flow-motion-v1';
const STYLE='/flow-experience.css';
const DAY_STEP_PX=34;
const MAX_DAY_STEP=7;
const DATE_BUBBLE_HALF=40;
const DATE_EDGE_GAP=10;
const DATE_EDGE_RESERVE=22;
const CONTACT_SELECTOR='button,.neo-button,.primary-button,.soft-button,.mobile-tab,.bottom-item,.day-chip,.meal-tab,.choice-chip,.subject-chip,.allergy-chip,.calendar-day,.result-btn,.result-button,.widget-link';
const COMPLEX_GESTURE_SELECTOR='#widgetDashboard,[data-widget-id],.widget-picker,.widget-gallery-sheet,.widget-v2-controls,.widget-controls,.widget-v2-resize';
const SELECT_HAPTIC_SELECTOR='.mobile-tab,.bottom-item,.nav-item,.day-chip,.meal-tab,.choice-chip,.subject-chip,.allergy-chip,.flow-settings-segment button,.flow-setting-segment button';
const MAGNET_SELECTOR='.mobile-tab,.bottom-item,.nav-item,.neo-button,.primary-button,.soft-button,.today-jump,.mobile-school-button,.school-identity,.text-button,.choice-chip,.subject-chip,.meal-tab,.day-chip,.flow-experience-settings-grid button';
const NAV_SELECTOR='.mobile-bottom-nav,.bottom-nav';
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
const magnetStates=new WeakMap();
let ambientTimer=0,dateGesture=null,suppressDateClickUntil=0,lastTouchAt=0,activeMagnet=null,hoverMagnet=null,sceneTimer=0;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function enabled(key){return localStorage.getItem(key)!=='off'}
function setEnabled(key,on){localStorage.setItem(key,on?'on':'off')}
function touchLike(event){return event?.pointerType==='touch'||event?.pointerType==='pen'||matchMedia('(pointer:coarse)').matches}
function hapticSupported(){return typeof navigator.vibrate==='function'}
function motionEnabled(){return enabled(MOTION_KEY)&&!reducedMotion.matches}

function ensureStyle(){
  if([...document.styleSheets].some(sheet=>{try{return new URL(sheet.href,location.href).pathname===STYLE}catch{return false}})||$(`link[href="${STYLE}"]`))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=STYLE;document.head.append(link)
}

const AMBIENT={
  light:{dawn:['#f8e8e5','#dfeafb'],day:['#e7f1ff','#f7f8fb'],golden:['#fde5bd','#e4edf9'],evening:['#eee1f5','#dce9f8'],night:['#dfe8f7','#f2eaf7']},
  dark:{dawn:['#2b2937','#273447'],day:['#202d3a','#27313d'],golden:['#3b2e27','#273343'],evening:['#30293b','#243245'],night:['#172536','#222b3d']}
};
function ambientPhase(date=new Date()){
  const h=date.getHours()+date.getMinutes()/60;
  if(h<6.5)return'night';if(h<8.5)return'dawn';if(h<16.5)return'day';if(h<18.5)return'golden';if(h<21)return'evening';return'night'
}
function ambientLabel(phase){return({dawn:'아침',day:'낮',golden:'해질녘',evening:'저녁',night:'밤'})[phase]||'낮'}
function effectiveTheme(){return document.documentElement.dataset.theme==='dark'?'dark':'light'}
function applyAmbient(date=new Date()){
  const root=document.documentElement,on=enabled(AMBIENT_KEY),phase=ambientPhase(date),theme=effectiveTheme(),palette=AMBIENT[theme][phase];
  root.dataset.flowAmbient=on?'on':'off';root.dataset.flowAmbientPhase=phase;
  root.style.setProperty('--flow-ambient-a',palette[0]);root.style.setProperty('--flow-ambient-b',palette[1]);
  const minutes=date.getHours()*60+date.getMinutes(),x=clamp(8+(minutes/1439)*84,8,92);
  root.style.setProperty('--flow-ambient-x',`${x.toFixed(1)}%`);root.style.setProperty('--flow-ambient-label',`"${ambientLabel(phase)}"`);
  syncExperienceSettings()
}
function scheduleAmbient(){
  clearTimeout(ambientTimer);const now=Date.now(),period=10*60*1000,delay=period-(now%period)+40;
  ambientTimer=setTimeout(()=>{applyAmbient();scheduleAmbient()},delay)
}

function haptic(kind='select'){
  if(!enabled(HAPTIC_KEY)||!hapticSupported()||Date.now()-lastTouchAt>1200)return false;
  const pattern=kind==='detent'?4:kind==='impact'?[8,18,7]:6;
  try{return Boolean(navigator.vibrate(pattern))}catch{return false}
}
function trackTouch(event){if(touchLike(event))lastTouchAt=Date.now()}
function ownsComplexGesture(target){return Boolean(target?.closest?.(COMPLEX_GESTURE_SELECTOR))}
function installContactFeedback(){
  document.addEventListener('pointerdown',event=>{
    trackTouch(event);if(ownsComplexGesture(event.target))return;
    const host=event.target.closest?.(CONTACT_SELECTOR);if(!host||host.disabled)return;
    const rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return;
    host.classList.add('flow-contact-host');host.style.setProperty('--flow-contact-x',`${event.clientX-rect.left}px`);host.style.setProperty('--flow-contact-y',`${event.clientY-rect.top}px`);
    $('.flow-contact-flare',host)?.remove();const flare=document.createElement('i');flare.className='flow-contact-flare';flare.setAttribute('aria-hidden','true');host.append(flare)
  },{capture:true,passive:true});
  document.addEventListener('click',event=>{if(Date.now()-lastTouchAt>900||ownsComplexGesture(event.target))return;const target=event.target.closest?.(SELECT_HAPTIC_SELECTOR);if(target&&!target.disabled)haptic('select')},{capture:true,passive:true})
}

function magnetState(host){
  let state=magnetStates.get(host);if(state)return state;
  state={x:0,y:0,tx:0,ty:0,raf:0};magnetStates.set(host,state);host.classList.add('flow-magnetic');return state
}
function runMagnet(host){
  const state=magnetState(host);if(state.raf)return;
  const tick=()=>{
    state.x+=(state.tx-state.x)*.34;state.y+=(state.ty-state.y)*.34;
    if(Math.abs(state.tx-state.x)<.035)state.x=state.tx;if(Math.abs(state.ty-state.y)<.035)state.y=state.ty;
    host.style.setProperty('--flow-magnet-x',`${state.x.toFixed(2)}px`);host.style.setProperty('--flow-magnet-y',`${state.y.toFixed(2)}px`);
    if(state.x===state.tx&&state.y===state.ty){state.raf=0;return}
    state.raf=requestAnimationFrame(tick)
  };
  state.raf=requestAnimationFrame(tick)
}
function setMagnet(host,x=0,y=0){
  if(!host)return;const state=magnetState(host);state.tx=motionEnabled()?x:0;state.ty=motionEnabled()?y:0;runMagnet(host)
}
function magnetVector(host,event,strength,limit){
  const rect=host.getBoundingClientRect();if(!rect.width||!rect.height)return[0,0];
  return[clamp((event.clientX-(rect.left+rect.width/2))*strength,-limit,limit),clamp((event.clientY-(rect.top+rect.height/2))*strength,-limit,limit)]
}
function releaseMagnet(host){if(!host)return;host.classList.remove('flow-pressing');setMagnet(host,0,0)}
function syncMotionMode(){
  const root=document.documentElement;
  root.dataset.flowMotion=motionEnabled()?'on':enabled(MOTION_KEY)?'reduced':'off';
  root.dataset.flowHapticsSupported=hapticSupported()?'true':'false';
  if(!motionEnabled())$$('.flow-magnetic').forEach(host=>releaseMagnet(host));
  syncExperienceSettings()
}
function installMagneticControls(){
  document.addEventListener('pointerdown',event=>{
    if(!motionEnabled()||ownsComplexGesture(event.target))return;
    const host=event.target.closest?.(MAGNET_SELECTOR);if(!host||host.disabled)return;
    const coarse=touchLike(event),[x,y]=magnetVector(host,event,coarse?.11:.16,coarse?5.5:8);
    host.classList.add('flow-pressing');setMagnet(host,x,y);activeMagnet={host,id:event.pointerId}
  },{capture:true,passive:true});
  document.addEventListener('pointermove',event=>{
    if(!motionEnabled())return;
    if(activeMagnet&&event.pointerId===activeMagnet.id){
      const [x,y]=magnetVector(activeMagnet.host,event,.12,7);setMagnet(activeMagnet.host,x,y);return
    }
    if(event.pointerType!=='mouse')return;
    const host=event.target.closest?.(MAGNET_SELECTOR);
    if(hoverMagnet&&hoverMagnet!==host)releaseMagnet(hoverMagnet);
    hoverMagnet=host||null;if(!host||host.disabled)return;
    const [x,y]=magnetVector(host,event,.15,8);setMagnet(host,x,y)
  },{capture:true,passive:true});
  const finish=event=>{if(activeMagnet&&event.pointerId===activeMagnet.id){releaseMagnet(activeMagnet.host);activeMagnet=null}};
  document.addEventListener('pointerup',finish,{capture:true,passive:true});document.addEventListener('pointercancel',finish,{capture:true,passive:true});
  document.addEventListener('pointerout',event=>{if(event.pointerType==='mouse'&&hoverMagnet&&!hoverMagnet.contains(event.relatedTarget)){releaseMagnet(hoverMagnet);hoverMagnet=null}},{capture:true,passive:true})
}

function navActive(nav){return $('.mobile-tab.active,.bottom-item.active',nav)||$('.mobile-tab,.bottom-item',nav)}
function setNavFieldForElement(nav,item,instant=false){
  if(!item)return;const nr=nav.getBoundingClientRect(),ir=item.getBoundingClientRect();if(!nr.width||!ir.width)return;
  nav.classList.toggle('flow-nav-instant',instant);nav.style.setProperty('--flow-nav-x',`${(ir.left-nr.left).toFixed(2)}px`);nav.style.setProperty('--flow-nav-w',`${ir.width.toFixed(2)}px`);
  if(instant)requestAnimationFrame(()=>nav.classList.remove('flow-nav-instant'))
}
function settleNav(nav,delay=0){setTimeout(()=>setNavFieldForElement(nav,navActive(nav)),delay)}
function installNavFields(){
  $$(NAV_SELECTOR).forEach(nav=>{
    if(nav.dataset.flowNavField==='ready')return;nav.dataset.flowNavField='ready';requestAnimationFrame(()=>setNavFieldForElement(nav,navActive(nav),true));
    let dragId=null;
    nav.addEventListener('pointerdown',event=>{if(!motionEnabled())return;const item=event.target.closest?.('.mobile-tab,.bottom-item');if(!item)return;dragId=event.pointerId;nav.classList.add('flow-nav-dragging');setNavFieldForElement(nav,item)},{passive:true});
    nav.addEventListener('pointermove',event=>{if(!motionEnabled()||dragId!==event.pointerId)return;const nr=nav.getBoundingClientRect();const width=parseFloat(getComputedStyle(nav).getPropertyValue('--flow-nav-w'))||nr.width/Math.max(1,$$('.mobile-tab,.bottom-item',nav).length);const x=clamp(event.clientX-nr.left-width/2,4,nr.width-width-4);nav.style.setProperty('--flow-nav-x',`${x.toFixed(2)}px`)},{passive:true});
    const end=event=>{if(dragId!==event.pointerId)return;dragId=null;nav.classList.remove('flow-nav-dragging');settleNav(nav,0);settleNav(nav,120)};
    nav.addEventListener('pointerup',end,{passive:true});nav.addEventListener('pointercancel',end,{passive:true});
    nav.addEventListener('click',()=>{settleNav(nav,0);settleNav(nav,160)},{passive:true});
    if('ResizeObserver'in window)new ResizeObserver(()=>setNavFieldForElement(nav,navActive(nav),true)).observe(nav)
  })
}

function parsePickerDate(input){
  const value=input?.value||'';const m=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return new Date();return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12)
}
function ymd(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function scrubLabel(step){if(!step)return'오늘';return step>0?`${step}일 후`:`${Math.abs(step)}일 전`}
function resistedDateOvershoot(distance){return DATE_EDGE_RESERVE*(1-Math.exp(-Math.max(0,distance)/DATE_EDGE_RESERVE))}
function datePresentationOffset(label,dx){
  const rect=label?.getBoundingClientRect?.();if(!rect?.width)return dx;
  const center=rect.left+rect.width/2;
  const min=DATE_EDGE_GAP+DATE_BUBBLE_HALF+DATE_EDGE_RESERVE-center;
  const max=innerWidth-DATE_EDGE_GAP-DATE_BUBBLE_HALF-DATE_EDGE_RESERVE-center;
  if(min>max)return clamp(dx,max,min);
  if(dx<min)return min-resistedDateOvershoot(min-dx);
  if(dx>max)return max+resistedDateOvershoot(dx-max);
  return dx
}
function clearDateGesture(){
  if(!dateGesture)return;const {label,controller}=dateGesture;label.removeAttribute('data-flow-scrubbing');label.removeAttribute('data-flow-scrub-label');controller?.style.removeProperty('--flow-date-drag');dateGesture=null
}
function finishDateGesture(event,cancel=false){
  const g=dateGesture;if(!g||event.pointerId!==g.id)return;
  try{g.label.releasePointerCapture?.(g.id)}catch{}
  const step=cancel?0:g.step,moved=g.dragging;clearDateGesture();
  if(!moved||!step)return;
  event.preventDefault?.();suppressDateClickUntil=performance.now()+500;
  const final=new Date(g.base);final.setDate(final.getDate()+step);g.input.value=ymd(final);haptic('impact');g.input.dispatchEvent(new Event('change',{bubbles:true}))
}
function installDateScrubber(){
  const controller=$('.date-controller');if(!controller)return;
  const label=$('.date-label',controller),input=$('#datePicker',controller);if(!label||!input||label.dataset.flowScrubBound)return;
  label.dataset.flowScrubBound='true';controller.classList.add('flow-date-controller');
  const detents=document.createElement('span');detents.className='flow-date-detents';detents.setAttribute('aria-hidden','true');detents.innerHTML='<i></i><i></i><i></i><i></i><i></i><i></i><i></i>';controller.append(detents);
  label.addEventListener('pointerdown',event=>{
    if(!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;trackTouch(event);
    dateGesture={id:event.pointerId,label,controller,input,base:parsePickerDate(input),startX:event.clientX,startY:event.clientY,step:0,dragging:false,cancelled:false};
    try{label.setPointerCapture?.(event.pointerId)}catch{}
  });
  label.addEventListener('pointermove',event=>{
    const g=dateGesture;if(!g||event.pointerId!==g.id)return;const dx=event.clientX-g.startX,dy=event.clientY-g.startY;
    if(!g.dragging){if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.1){g.cancelled=true;return finishDateGesture(event,true)}if(Math.abs(dx)<9)return;g.dragging=true;label.dataset.flowScrubbing='true'}
    if(g.cancelled)return;event.preventDefault();const next=clamp(Math.round(dx/DAY_STEP_PX),-MAX_DAY_STEP,MAX_DAY_STEP);
    controller.style.setProperty('--flow-date-drag',`${datePresentationOffset(label,dx).toFixed(2)}px`);
    if(next!==g.step){g.step=next;label.dataset.flowScrubLabel=scrubLabel(next);haptic('detent')}
  });
  label.addEventListener('pointerup',event=>finishDateGesture(event));label.addEventListener('pointercancel',event=>finishDateGesture(event,true));
  label.addEventListener('click',event=>{if(performance.now()<suppressDateClickUntil){event.preventDefault();event.stopImmediatePropagation()}},{capture:true})
}

function installMotionDemo(card){
  const demo=$('[data-flow-motion-demo]',card),orb=$('.flow-motion-orb',demo);if(!demo||!orb||demo.dataset.flowBound)return;demo.dataset.flowBound='true';
  let gesture=null,lastDetent=0;
  demo.addEventListener('pointerdown',event=>{if(!motionEnabled())return;trackTouch(event);gesture={id:event.pointerId,x:event.clientX,y:event.clientY};demo.dataset.flowDragging='true';try{demo.setPointerCapture?.(event.pointerId)}catch{}},{passive:true});
  demo.addEventListener('pointermove',event=>{if(!gesture||event.pointerId!==gesture.id)return;const x=clamp(event.clientX-gesture.x,-52,52),y=clamp(event.clientY-gesture.y,-20,20);orb.style.setProperty('--flow-demo-x',`${x.toFixed(1)}px`);orb.style.setProperty('--flow-demo-y',`${y.toFixed(1)}px`);const detent=Math.round(x/26);if(detent!==lastDetent){lastDetent=detent;haptic('detent')}},{passive:true});
  const end=event=>{if(!gesture||event.pointerId!==gesture.id)return;gesture=null;lastDetent=0;delete demo.dataset.flowDragging;orb.style.setProperty('--flow-demo-x','0px');orb.style.setProperty('--flow-demo-y','0px')};
  demo.addEventListener('pointerup',end,{passive:true});demo.addEventListener('pointercancel',end,{passive:true})
}
function experienceCard(panel){
  const stack=$('.flow-settings-stack',panel);if(!stack||$('.flow-experience-settings',stack))return;
  const card=document.createElement('section');card.className='flow-settings-card flow-experience-settings';
  card.innerHTML='<div class="flow-experience-head"><span>FEEL</span><h2>감각과 움직임</h2><p>화면을 단순히 전환하지 않고 손가락, 시간, 기기 움직임에 반응하도록 만듭니다.</p></div><div class="flow-motion-demo" data-flow-motion-demo><i class="flow-motion-orb" aria-hidden="true"></i><div><strong>Spatial Motion</strong><small>원을 잡아 당겨보세요. 빠르게 따라오고 끝에서는 천천히 멈춥니다.</small></div></div><div class="flow-experience-settings-grid"><div><span>공간 움직임</span><small>버튼과 탭이 손가락 쪽으로 끌리고 놓을 때 spring처럼 복귀합니다.</small></div><button type="button" data-flow-experience-toggle="motion"></button><div><span>시간 분위기</span><small data-flow-ambient-copy></small></div><button type="button" data-flow-experience-toggle="ambient"></button><div><span>촉각 피드백</span><small data-flow-haptics-copy></small></div><button type="button" data-flow-experience-toggle="haptics"></button></div>';
  stack.append(card);installMotionDemo(card);card.addEventListener('click',event=>{const button=event.target.closest?.('[data-flow-experience-toggle]');if(!button||button.disabled)return;const kind=button.dataset.flowExperienceToggle;if(kind==='ambient'){setEnabled(AMBIENT_KEY,!enabled(AMBIENT_KEY));applyAmbient()}else if(kind==='motion'){setEnabled(MOTION_KEY,!enabled(MOTION_KEY));syncMotionMode()}else{const on=!enabled(HAPTIC_KEY);setEnabled(HAPTIC_KEY,on);syncExperienceSettings();if(on){lastTouchAt=Date.now();haptic('impact')}}});syncExperienceSettings()
}
function syncExperienceSettings(){
  $$('.flow-settings-view').forEach(panel=>{
    experienceCard(panel);const phase=document.documentElement.dataset.flowAmbientPhase||ambientPhase(),copy=$('[data-flow-ambient-copy]',panel),hapticCopy=$('[data-flow-haptics-copy]',panel);
    if(copy)copy.textContent=`현재 ${ambientLabel(phase)} · 배경 빛과 반사의 방향을 시간에 맞춥니다.`;
    if(hapticCopy)hapticCopy.textContent=hapticSupported()?'선택, 날짜 다이얼, 제스처 경계를 짧은 진동으로 알립니다.':'이 브라우저는 진동 API를 제공하지 않아 촉각 피드백을 사용할 수 없습니다.';
    $$('[data-flow-experience-toggle]',panel).forEach(button=>{
      const kind=button.dataset.flowExperienceToggle,supported=kind!=='haptics'||hapticSupported();const on=kind==='ambient'?enabled(AMBIENT_KEY):kind==='motion'?enabled(MOTION_KEY):enabled(HAPTIC_KEY);
      button.disabled=!supported;button.textContent=supported?(on?'켜짐':'꺼짐'):'미지원';button.classList.toggle('active',supported&&on);button.setAttribute('aria-pressed',String(supported&&on));button.setAttribute('aria-disabled',String(!supported))
    })
  })
}
function installSettingsIntegration(){
  $$('.flow-settings-view').forEach(experienceCard);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#mobileSettingsBtn,#settingsBtn,.flow-mobile-settings,.flow-university-settings-button'))queueMicrotask(()=>{$$('.flow-settings-view').forEach(experienceCard);installNavFields()});
    if(event.target.closest?.('[data-theme-choice],[data-flow-settings-theme],[data-flow-university-theme-choice],[data-university-theme]'))setTimeout(()=>applyAmbient(),0)
  },{capture:true,passive:true})
}

function installSceneMotion(){
  let lastY=scrollY,lastT=performance.now();
  addEventListener('scroll',()=>{
    if(!motionEnabled())return;const now=performance.now(),y=scrollY,velocity=clamp((y-lastY)/Math.max(16,now-lastT),-2.2,2.2);lastY=y;lastT=now;
    const root=document.documentElement;root.style.setProperty('--flow-scroll-v',velocity.toFixed(3));root.style.setProperty('--flow-scroll-y',`${clamp(y*.026,0,18).toFixed(2)}px`);root.style.setProperty('--flow-scroll-a',`${(velocity*3).toFixed(2)}px`);root.style.setProperty('--flow-scroll-b',`${(velocity*5).toFixed(2)}px`);
    clearTimeout(sceneTimer);sceneTimer=setTimeout(()=>{root.style.setProperty('--flow-scroll-v','0');root.style.setProperty('--flow-scroll-a','0px');root.style.setProperty('--flow-scroll-b','0px')},110)
  },{passive:true})
}
function installTiltResponse(){
  if(!('DeviceOrientationEvent'in window)||typeof DeviceOrientationEvent.requestPermission==='function')return;
  addEventListener('deviceorientation',event=>{if(!motionEnabled())return;const x=clamp(Number(event.gamma)||0,-18,18)/18,y=clamp((Number(event.beta)||45)-45,-18,18)/18;document.documentElement.style.setProperty('--flow-tilt-x',`${(x*12).toFixed(2)}px`);document.documentElement.style.setProperty('--flow-tilt-y',`${(y*8).toFixed(2)}px`);document.documentElement.style.setProperty('--flow-tilt-soft-x',`${(x*5.4).toFixed(2)}px`)},{passive:true})
}

function init(){
  ensureStyle();applyAmbient();scheduleAmbient();syncMotionMode();installContactFeedback();installMagneticControls();installNavFields();installDateScrubber();installSettingsIntegration();installSceneMotion();installTiltResponse();document.documentElement.dataset.flowExperience='ready';
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){applyAmbient();scheduleAmbient();installNavFields()}},{passive:true});
  window.addEventListener('storage',event=>{if(event.key===AMBIENT_KEY||event.key===HAPTIC_KEY||event.key===MOTION_KEY){applyAmbient();syncMotionMode()}},{passive:true});
  reducedMotion.addEventListener?.('change',syncMotionMode);addEventListener('resize',()=>installNavFields(),{passive:true})
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();