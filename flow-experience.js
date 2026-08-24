const HAPTIC_KEY='flow-haptics-v1';
const AMBIENT_KEY='flow-ambient-v1';
const STYLE='/flow-experience.css';
const DAY_STEP_PX=34;
const MAX_DAY_STEP=7;
const CONTACT_SELECTOR='button,.neo-button,.primary-button,.soft-button,.mobile-tab,.bottom-item,.day-chip,.meal-tab,.choice-chip,.subject-chip,.allergy-chip,.calendar-day,.result-btn,.result-button,.widget-link';
const COMPLEX_GESTURE_SELECTOR='#widgetDashboard,[data-widget-id],.widget-picker,.widget-gallery-sheet,.widget-v2-controls,.widget-controls,.widget-v2-resize';
const SELECT_HAPTIC_SELECTOR='.mobile-tab,.bottom-item,.nav-item,.day-chip,.meal-tab,.choice-chip,.subject-chip,.allergy-chip,.flow-settings-segment button,.flow-setting-segment button';
let ambientTimer=0,dateGesture=null,suppressDateClickUntil=0,lastTouchAt=0;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function enabled(key){return localStorage.getItem(key)!=='off'}
function setEnabled(key,on){localStorage.setItem(key,on?'on':'off')}
function touchLike(event){return event?.pointerType==='touch'||event?.pointerType==='pen'||matchMedia('(pointer:coarse)').matches}

function ensureStyle(){
  if([...document.styleSheets].some(sheet=>{try{return new URL(sheet.href,location.href).pathname===STYLE}catch{return false}})||$(`link[href="${STYLE}"]`))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=STYLE;document.head.append(link)
}

const AMBIENT={
  light:{dawn:['#f4ecea','#e8eef8'],day:['#eef4f8','#f7f8fa'],golden:['#f6eddd','#e9eff6'],evening:['#eee8ec','#e7edf7'],night:['#e9eef6','#f3f4f7']},
  dark:{dawn:['#252936','#2d2a31'],day:['#212a35','#242d38'],golden:['#302a27','#252d38'],evening:['#292834','#222b37'],night:['#1b2430','#202936']}
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
  if(!enabled(HAPTIC_KEY)||!navigator.vibrate||Date.now()-lastTouchAt>1200)return false;
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
  const clear=event=>{const host=event.target.closest?.('.flow-contact-host');if(!host)return;setTimeout(()=>$('.flow-contact-flare',host)?.remove(),120)};
  document.addEventListener('pointerup',clear,{capture:true,passive:true});document.addEventListener('pointercancel',clear,{capture:true,passive:true});
  document.addEventListener('click',event=>{if(Date.now()-lastTouchAt>900||ownsComplexGesture(event.target))return;const target=event.target.closest?.(SELECT_HAPTIC_SELECTOR);if(target&&!target.disabled)haptic('select')},{capture:true,passive:true})
}

function parsePickerDate(input){
  const value=input?.value||'';const m=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return new Date();return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12)
}
function ymd(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function scrubLabel(step){if(!step)return'오늘';return step>0?`${step}일 후`:`${Math.abs(step)}일 전`}
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
  const controller=$('.date-controller'),label=$('.date-label',controller),input=$('#datePicker',controller);if(!controller||!label||!input||label.dataset.flowScrubBound)return;
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
    controller.style.setProperty('--flow-date-drag',`${clamp(dx,-DAY_STEP_PX*MAX_DAY_STEP,DAY_STEP_PX*MAX_DAY_STEP)}px`);
    if(next!==g.step){g.step=next;label.dataset.flowScrubLabel=scrubLabel(next);haptic('detent')}
  });
  label.addEventListener('pointerup',event=>finishDateGesture(event));label.addEventListener('pointercancel',event=>finishDateGesture(event,true));
  label.addEventListener('click',event=>{if(performance.now()<suppressDateClickUntil){event.preventDefault();event.stopImmediatePropagation()}},{capture:true})
}

function experienceCard(panel){
  const stack=$('.flow-settings-stack',panel);if(!stack||$('.flow-experience-settings',stack))return;
  const card=document.createElement('section');card.className='flow-settings-card flow-experience-settings';
  card.innerHTML='<h2>감각과 분위기</h2><p>시간의 흐름과 손가락 조작에 맞춰 화면의 빛과 촉각 피드백을 조정합니다. 정보 자체는 바뀌지 않습니다.</p><div class="flow-experience-settings-grid"><div><span>시간 분위기</span><small data-flow-ambient-copy></small></div><button type="button" data-flow-experience-toggle="ambient"></button><div><span>촉각 피드백</span><small>지원되는 기기에서 선택과 다이얼의 경계를 짧게 알립니다.</small></div><button type="button" data-flow-experience-toggle="haptics"></button></div>';
  stack.append(card);card.addEventListener('click',event=>{const button=event.target.closest?.('[data-flow-experience-toggle]');if(!button)return;const kind=button.dataset.flowExperienceToggle;if(kind==='ambient'){setEnabled(AMBIENT_KEY,!enabled(AMBIENT_KEY));applyAmbient()}else{const on=!enabled(HAPTIC_KEY);setEnabled(HAPTIC_KEY,on);syncExperienceSettings();if(on){lastTouchAt=Date.now();haptic('impact')}}});syncExperienceSettings()
}
function syncExperienceSettings(){
  $$('.flow-settings-view').forEach(panel=>{experienceCard(panel);const phase=document.documentElement.dataset.flowAmbientPhase||ambientPhase();const copy=$('[data-flow-ambient-copy]',panel);if(copy)copy.textContent=`현재 ${ambientLabel(phase)} · 화면 여백의 빛을 아주 천천히 맞춥니다.`;$$('[data-flow-experience-toggle]',panel).forEach(button=>{const on=button.dataset.flowExperienceToggle==='ambient'?enabled(AMBIENT_KEY):enabled(HAPTIC_KEY);button.textContent=on?'켜짐':'꺼짐';button.classList.toggle('active',on);button.setAttribute('aria-pressed',String(on))})})
}
function installSettingsIntegration(){
  $$('.flow-settings-view').forEach(experienceCard);
  document.addEventListener('click',event=>{
    if(event.target.closest?.('#mobileSettingsBtn,#settingsBtn,.flow-mobile-settings,.flow-university-settings-button'))queueMicrotask(()=>$$('.flow-settings-view').forEach(experienceCard));
    if(event.target.closest?.('[data-theme-choice],[data-flow-settings-theme],[data-flow-university-theme-choice],[data-university-theme]'))setTimeout(()=>applyAmbient(),0)
  },{capture:true,passive:true})
}
function init(){
  ensureStyle();applyAmbient();scheduleAmbient();installContactFeedback();installDateScrubber();installSettingsIntegration();document.documentElement.dataset.flowExperience='ready';
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){applyAmbient();scheduleAmbient()}},{passive:true});
  window.addEventListener('storage',event=>{if(event.key===AMBIENT_KEY||event.key===HAPTIC_KEY)applyAmbient()},{passive:true})
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
