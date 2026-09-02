const $=(s,r=document)=>r?.querySelector?.(s)||null;
const $$=(s,r=document)=>[...(r?.querySelectorAll?.(s)||[])];
const root=document.documentElement;
const PROFILE_KEY='flow-school-profile-v3';
const CACHE_PREFIX='flow-school-cache-v4:';
const EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
const HAPTIC_KEY='flow-haptics-v1';
const AMBIENT_KEY='flow-ambient-v1';
const EXAM_KEYWORDS=/시험|평가|모의|중간|기말|고사|수능|학력|듣기/;
const DAY_WINDOW=40;
const EXAM_STEP=84;
const EXAM_STACK_STEP=60;
let dateState=null,dateRaf=0,dateSuppressUntil=0,lastDetent=0,bootFrame=0;
let examState={items:[],remote:[],cursor:null,horizon:null,exhausted:false,loading:false,frame:0,interacted:false,signature:''};

const official=[
  {date:'2026-09-02',grades:[1,2],name:'9월 전국연합학력평가',detail:'1·2학년 전국연합학력평가',kind:'전국연합'},
  {date:'2026-09-02',grades:[3],name:'9월 대학수학능력시험 모의평가',detail:'한국교육과정평가원 주관 모의평가',kind:'모의평가'},
  {date:'2026-09-08',grades:[1],name:'2학기 전국 영어듣기능력평가',detail:'1학년 전국 영어듣기능력평가',kind:'영어듣기'},
  {date:'2026-09-09',grades:[2],name:'2학기 전국 영어듣기능력평가',detail:'2학년 전국 영어듣기능력평가',kind:'영어듣기'},
  {date:'2026-09-10',grades:[3],name:'2학기 전국 영어듣기능력평가',detail:'3학년 전국 영어듣기능력평가',kind:'영어듣기'},
  {date:'2026-10-20',grades:[1,2],name:'10월 전국연합학력평가',detail:'경기도교육청 주관 전국연합학력평가',kind:'전국연합'},
  {date:'2026-10-20',grades:[3],name:'10월 전국연합학력평가',detail:'서울특별시교육청 주관 전국연합학력평가',kind:'전국연합'},
  {date:'2026-11-19',grades:[3],name:'2027학년도 대학수학능력시험',detail:'한국교육과정평가원',kind:'수능'},
];

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function pad(v){return String(v).padStart(2,'0')}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function enabled(key){return localStorage.getItem(key)!=='off'}
function profile(){return readJson(PROFILE_KEY,null)}
function grade(){return Math.max(1,Math.min(6,Number(profile()?.grade)||1))}
function iso(date=new Date()){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function fromIso(value){const[y,m,d]=String(value||'').split('-').map(Number);return y&&m&&d?new Date(y,m-1,d,12):new Date()}
function addDays(value,delta){const d=fromIso(value);d.setDate(d.getDate()+delta);return iso(d)}
function ymd(date){return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}`}
function weekday(date){return new Intl.DateTimeFormat('ko-KR',{weekday:'short'}).format(date).replace('요일','')}
function dateLabel(value){const d=fromIso(value);return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(d)}
function dday(value){const target=fromIso(value),now=new Date(),base=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12),diff=Math.round((target-base)/86400000);return diff===0?'D-DAY':diff>0?`D-${diff}`:`D+${Math.abs(diff)}`}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function haptic(pattern=4){if(!enabled(HAPTIC_KEY)||typeof navigator.vibrate!=='function')return;try{navigator.vibrate(pattern)}catch{}}
function visibleDateCount(){return matchMedia('(max-width:520px)').matches||matchMedia('(max-width:900px) and (max-height:520px) and (orientation:landscape)').matches?3:5}

function installStyle(){
  if($('#flow-school-mobile-v5-style'))return;
  const style=document.createElement('style');style.id='flow-school-mobile-v5-style';style.textContent=`
/* A saved-profile boot gate must also hide descendants that set visibility inline. */
html[data-flow-school-boot="profile"]:not([data-flow-school-surface="ready"]) #dashboard:not(.hidden) *{visibility:hidden!important;pointer-events:none!important}

/* Keep landing geometry deterministic before late School polish arrives. */
@media(max-width:820px){#landing .landing-header{height:44px!important;min-height:44px!important}}

/* Kinetic date wheel: the focus lens stays fixed while a virtual rail coasts underneath it. */
html[data-flow-school-ui="v2"] #flowTodayDateDock[data-flow-kinetic="v5"] .flow-date-viewport{touch-action:pan-y!important;cursor:grab!important}
html[data-flow-school-ui="v2"] #flowTodayDateDock[data-flow-kinetic="v5"][data-kinetic-dragging="true"] .flow-date-viewport{cursor:grabbing!important}
html[data-flow-school-ui="v2"] #flowTodayDateDock[data-flow-kinetic="v5"] .flow-date-rail{transition:none!important}
html[data-flow-school-ui="v2"] #flowTodayDateDock[data-flow-kinetic="v5"][data-kinetic-snap="true"] .flow-date-rail{transition:transform .24s cubic-bezier(.18,.92,.22,1)!important}
html[data-flow-school-ui="v2"] #flowTodayDateDock[data-flow-kinetic="v5"] .flow-date-day{pointer-events:auto!important}
html[data-flow-school-ui="v2"] #flowTodayDateDock[data-flow-kinetic="v5"] .flow-date-focus{pointer-events:none!important}

/* Today/Week is one segmented control. Kill inherited inline/baseline offsets on phones. */
@media(max-width:699px){
  html[data-flow-school-ui="v2"][data-flow-school-mobile-v5="ready"] body #todayView .timetable-mode-toggle{
    display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:stretch!important;
    width:116px!important;min-width:116px!important;height:44px!important;min-height:44px!important;padding:4px!important;box-sizing:border-box!important
  }
  html[data-flow-school-ui="v2"][data-flow-school-mobile-v5="ready"] body #todayView .timetable-mode-toggle>button{
    position:relative!important;inset:0!important;display:flex!important;align-items:center!important;justify-content:center!important;align-self:stretch!important;
    width:100%!important;min-width:0!important;height:36px!important;min-height:36px!important;margin:0!important;padding:0 8px!important;
    line-height:1!important;vertical-align:middle!important;transform:none!important
  }
}

/* Settings is one scroll surface. The floating nav overlays it; content owns the clearance. */
@media(max-width:900px),(min-width:901px) and (max-width:1024px) and (orientation:portrait){
  html[data-flow-school-ui="v2"] body #flowSchoolSettingsView#flowSchoolSettingsView:not(.hidden){inset:64px 0 0!important;bottom:0!important;padding-bottom:calc(138px + env(safe-area-inset-bottom))!important;scroll-padding-bottom:calc(138px + env(safe-area-inset-bottom))!important;overscroll-behavior-y:contain!important}
  html[data-flow-school-ui="v2"] body .product-main{padding-bottom:calc(124px + env(safe-area-inset-bottom))!important}
  html[data-flow-school-ui="v2"] body #bottomNav.mobile-bottom-nav{bottom:calc(10px + env(safe-area-inset-bottom))!important}
}
@media(max-width:520px){html[data-flow-school-ui="v2"] body #flowSchoolSettingsView#flowSchoolSettingsView:not(.hidden){top:58px!important;padding-bottom:calc(134px + env(safe-area-inset-bottom))!important;scroll-padding-bottom:calc(134px + env(safe-area-inset-bottom))!important}}

/* Keep the time palette visible through the School shell. */
html[data-flow-school-ui="v2"][data-flow-ambient="on"] body .product-shell,html[data-flow-school-ui="v2"][data-flow-ambient="on"] body .product-main{background-color:color-mix(in srgb,var(--bg) 84%,transparent)!important}

/* Scroll-driven exam deck: one detailed card, three readable compact cards, one rear peek. */
html[data-flow-school-ui="v2"] #todayView .upcoming-card[data-flow-exam-deck="v5"]{overflow:visible!important}
html[data-flow-school-ui="v2"] #todayView .upcoming-card[data-flow-exam-deck="v5"]>#eventList,
html[data-flow-school-ui="v2"] #todayView .upcoming-card[data-flow-exam-deck="v5"]>#flowExamFeedV3{display:none!important}
html[data-flow-school-ui="v2"] #todayView #flowExamDeckV5{position:relative;height:336px;overflow-y:auto;overflow-x:hidden;scroll-snap-type:y mandatory;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:none;border-radius:20px;touch-action:pan-y}
html[data-flow-school-ui="v2"] #todayView #flowExamDeckV5::-webkit-scrollbar{display:none}
html[data-flow-school-ui="v2"] #todayView .flow-exam-stage-v5{position:sticky;z-index:3;top:0;height:336px;pointer-events:none;overflow:hidden;contain:layout paint}
html[data-flow-school-ui="v2"] #todayView .flow-exam-runway-v5{position:relative;z-index:1;margin-top:-336px;padding-top:336px}
html[data-flow-school-ui="v2"] #todayView .flow-exam-snap-v5{height:${EXAM_STEP}px;scroll-snap-align:start;scroll-snap-stop:normal}
html[data-flow-school-ui="v2"] #todayView .flow-exam-card-v5{--flow-active:0;position:absolute;isolation:isolate;contain:layout paint style;left:0;right:0;top:0;box-sizing:border-box;height:calc(62px + 64px * var(--flow-active));padding:calc(10px + 6px * var(--flow-active)) calc(12px + 5px * var(--flow-active));border:0;border-radius:calc(15px + 5px * var(--flow-active));corner-shape:squircle;overflow:hidden;background:color-mix(in srgb,var(--surface) 96%,var(--surface-2));box-shadow:0 7px 18px rgba(43,57,78,.065),inset 0 1px 0 rgba(255,255,255,.72);transform:translate3d(0,var(--flow-y,0px),0) scale(var(--flow-scale,1));opacity:var(--flow-opacity,1);filter:saturate(var(--flow-sat,1));transform-origin:50% 0;will-change:transform,opacity;backface-visibility:hidden;transition:box-shadow .14s linear,color .12s linear}
html[data-flow-school-ui="v2"] #todayView .flow-exam-card-v5::before{content:"";position:absolute;z-index:0;inset:0;border-radius:inherit;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 85%,#3956b8),color-mix(in srgb,var(--accent) 61%,#7889d8));opacity:var(--flow-active);transform:translateZ(0);pointer-events:none}
html[data-flow-school-ui="v2"] #todayView .flow-exam-card-v5[data-active]{color:#fff;box-shadow:0 13px 30px color-mix(in srgb,var(--accent) 19%,transparent),inset 0 1px 0 rgba(255,255,255,.27)}
html[data-flow-school-ui="v2"] #todayView .flow-exam-card-v5::after{content:"";position:absolute;z-index:0;right:16px;bottom:12px;width:54px;height:42px;border-radius:13px;corner-shape:squircle;background:linear-gradient(145deg,rgba(255,255,255,.28),rgba(255,255,255,.04));opacity:var(--flow-active);transform:rotate(-8deg);pointer-events:none}
html[data-flow-school-ui="v2"] #todayView .flow-exam-top-v5{position:relative;z-index:1;display:flex;align-items:center;gap:7px;min-height:22px;color:var(--muted);font-size:.52rem;font-weight:720;white-space:nowrap;transition:color .12s linear}
html[data-flow-school-ui="v2"] #todayView .flow-exam-card-v5[data-active] .flow-exam-top-v5{color:rgba(255,255,255,.78)}
html[data-flow-school-ui="v2"] #todayView .flow-exam-dday-v5{display:inline-flex;align-items:center;min-height:22px;padding:0 7px;border-radius:8px;background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--accent);font-weight:860;transition:background .12s linear,color .12s linear}
html[data-flow-school-ui="v2"] #todayView .flow-exam-card-v5[data-active] .flow-exam-dday-v5{background:rgba(255,255,255,.16);color:#fff}
html[data-flow-school-ui="v2"] #todayView .flow-exam-card-v5 h3{position:relative;z-index:1;margin:5px 0 0;max-width:calc(100% - 28px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.69rem;line-height:1.25;letter-spacing:-.03em;transition:color .12s linear}
html[data-flow-school-ui="v2"] #todayView .flow-exam-card-v5[data-active] h3{max-width:76%;margin-top:9px;font-size:.96rem;white-space:normal;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}
html[data-flow-school-ui="v2"] #todayView .flow-exam-detail-v5{position:relative;z-index:1;max-width:74%;margin:6px 0 0;color:rgba(255,255,255,.78);font-size:.56rem;line-height:1.45;opacity:var(--flow-active);transform:translateY(var(--flow-detail-y,0px));pointer-events:none}
html[data-flow-school-ui="v2"] #todayView .flow-exam-loading-v5{position:absolute;left:0;right:0;bottom:3px;text-align:center;color:var(--muted);font-size:.48rem;opacity:.7}
@media(max-width:620px){html[data-flow-school-ui="v2"] #todayView #flowExamDeckV5,html[data-flow-school-ui="v2"] #todayView .flow-exam-stage-v5{height:326px}html[data-flow-school-ui="v2"] #todayView .flow-exam-runway-v5{margin-top:-326px;padding-top:326px}}
@media(prefers-reduced-motion:reduce){html[data-flow-school-ui="v2"] #todayView #flowExamDeckV5{scroll-behavior:auto!important}}
`;
  document.head.append(style);
}

function dateParts(){const dock=$('#flowTodayDateDock'),viewport=$('.flow-date-viewport',dock),rail=$('.flow-date-rail',dock),input=$('#datePicker');return{dock,viewport,rail,input}}
function slotWidth(){const{viewport}=dateParts();return Math.max(36,(viewport?.getBoundingClientRect().width||240)/visibleDateCount())}
function dayMarkup(base){
  const today=iso();let html='';const slot=slotWidth();
  for(let offset=-DAY_WINDOW;offset<=DAY_WINDOW;offset++){
    const value=addDays(base,offset),date=fromIso(value);
    html+=`<button class="flow-date-day flow-date-day-v5" type="button" data-v5="true" data-offset="${offset}" data-iso="${value}" style="--flow-date-base:${(offset*slot).toFixed(2)}px"><span class="flow-date-week">${weekday(date)}</span><strong class="flow-date-num">${date.getDate()}</strong><span class="flow-date-today">${value===today?'오늘':''}</span></button>`;
  }
  return html;
}
function renderDateWindow(base){
  const{dock,rail}=dateParts();if(!dock||!rail)return false;dock.dataset.flowKinetic='v5';dock.style.setProperty('--flow-date-count',String(visibleDateCount()));dock.style.setProperty('--flow-date-slot',`${slotWidth().toFixed(2)}px`);
  rail.innerHTML=dayMarkup(base);rail.style.setProperty('--flow-date-x','0px');dateState={base,position:0,velocity:0,dragging:false,id:null,lastX:0,lastT:0,startX:0,startY:0,moved:false,preview:0};applyDateVisual(0,true);return true
}
function applyDateVisual(position,force=false){
  const{dock,rail}=dateParts();if(!dock||!rail||!dateState)return;dateState.position=position;rail.style.setProperty('--flow-date-x',`${position.toFixed(2)}px`);const slot=slotWidth(),preview=Math.round(-position/slot),visibleRadius=(visibleDateCount()-1)/2+.56;
  if(force||preview!==dateState.preview){dateState.preview=preview;if(performance.now()-lastDetent>28){lastDetent=performance.now();haptic(3)}}
  $$('.flow-date-day-v5',rail).forEach(node=>{const offset=Number(node.dataset.offset)||0,center=(offset*slot)+position,distance=Math.abs(center/slot),scale=clamp(1-distance*.075,.78,1),opacity=clamp(1-distance*.2,.16,1),isPreview=offset===preview,isVisual=distance<=visibleRadius;node.style.setProperty('--flow-date-scale',scale.toFixed(3));node.style.setProperty('--flow-date-opacity',opacity.toFixed(3));node.style.visibility=isVisual?'visible':'hidden';node.tabIndex=isVisual?0:-1;node.setAttribute('aria-hidden',String(!isVisual));node.dataset.active=String(isPreview);node.toggleAttribute('data-preview',isPreview);if(isPreview)node.setAttribute('aria-current','date');else node.removeAttribute('aria-current')});
}
function rebaseDateIfNeeded(){
  if(!dateState)return;const slot=slotWidth();if(Math.abs(dateState.position)<slot*8)return;const shift=Math.trunc(-dateState.position/slot);if(!shift)return;const nextBase=addDays(dateState.base,shift),nextPosition=dateState.position+shift*slot;dateState.base=nextBase;const{rail}=dateParts();if(rail)rail.innerHTML=dayMarkup(nextBase);dateState.position=nextPosition;dateState.preview=0;applyDateVisual(nextPosition,true)
}
function commitDateWheel(){
  if(!dateState)return;const slot=slotWidth(),offset=Math.round(-dateState.position/slot),value=addDays(dateState.base,offset),{dock,input}=dateParts();dateState.base=value;dateState.position=0;dateState.velocity=0;if(dock){delete dock.dataset.kineticSnap;delete dock.dataset.kineticDragging}if(input&&input.value!==value){input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}))}haptic([7,18,5]);setTimeout(()=>{if(dateState?.dragging)return;const live=dateParts();if(live.rail)renderDateWindow(live.input?.value||value)},0)
}
function magneticSnap(){
  if(!dateState)return;const{dock}=dateParts(),slot=slotWidth(),target=-Math.round(-dateState.position/slot)*slot;dateState.position=target;if(dock)dock.dataset.kineticSnap='true';applyDateVisual(target,true);setTimeout(commitDateWheel,245)
}
function runDateInertia(){
  cancelAnimationFrame(dateRaf);let last=performance.now();
  const tick=now=>{if(!dateState||dateState.dragging)return;const dt=Math.min(32,Math.max(8,now-last));last=now;dateState.velocity*=Math.pow(.93,dt/16.67);dateState.position+=dateState.velocity*dt;rebaseDateIfNeeded();applyDateVisual(dateState.position);if(Math.abs(dateState.velocity)<.055){dateRaf=0;magneticSnap();return}dateRaf=requestAnimationFrame(tick)};
  dateRaf=requestAnimationFrame(tick)
}
function bindDateWheel(){
  const{dock,viewport,rail,input}=dateParts();if(!dock||!viewport||!rail||!input)return false;if(dock.dataset.flowKineticBound==='true'){if(!rail.querySelector('.flow-date-day-v5'))renderDateWindow(input.value||iso());return true}
  dock.dataset.flowKineticBound='true';renderDateWindow(input.value||iso());
  dock.addEventListener('pointerdown',event=>{
    if(!event.target.closest?.('.flow-date-viewport')||!event.isPrimary||(event.pointerType==='mouse'&&event.button!==0))return;event.stopImmediatePropagation();cancelAnimationFrame(dateRaf);dateRaf=0;const now=performance.now();dateState.dragging=true;dateState.id=event.pointerId;dateState.startX=event.clientX;dateState.startY=event.clientY;dateState.lastX=event.clientX;dateState.lastT=now;dateState.velocity=0;dateState.moved=false;dock.dataset.kineticDragging='true';delete dock.dataset.kineticSnap;try{viewport.setPointerCapture?.(event.pointerId)}catch{}
  },true);
  dock.addEventListener('pointermove',event=>{
    if(!dateState?.dragging||event.pointerId!==dateState.id)return;event.stopImmediatePropagation();const dx=event.clientX-dateState.lastX,dy=event.clientY-dateState.startY,totalX=event.clientX-dateState.startX;if(!dateState.moved&&Math.abs(dy)>12&&Math.abs(dy)>Math.abs(totalX)*1.15){dateState.dragging=false;delete dock.dataset.kineticDragging;return}if(Math.abs(totalX)>5)dateState.moved=true;if(!dateState.moved)return;event.preventDefault();const now=performance.now(),dt=Math.max(8,now-dateState.lastT),instant=dx/dt;dateState.velocity=dateState.velocity*.58+instant*.42;dateState.position+=dx;dateState.lastX=event.clientX;dateState.lastT=now;rebaseDateIfNeeded();applyDateVisual(dateState.position)
  },true);
  const end=event=>{if(!dateState?.dragging||event.pointerId!==dateState.id)return;event.stopImmediatePropagation();dateState.dragging=false;delete dock.dataset.kineticDragging;try{viewport.releasePointerCapture?.(event.pointerId)}catch{}if(dateState.moved){dateSuppressUntil=performance.now()+450;runDateInertia()}else magneticSnap()};
  dock.addEventListener('pointerup',end,true);dock.addEventListener('pointercancel',event=>{if(dateState?.dragging&&event.pointerId===dateState.id){event.stopImmediatePropagation();dateState.dragging=false;delete dock.dataset.kineticDragging;magneticSnap()}},true);
  dock.addEventListener('click',event=>{if(!event.target.closest?.('.flow-date-viewport'))return;event.stopImmediatePropagation();if(performance.now()<dateSuppressUntil){event.preventDefault();return}const day=event.target.closest('.flow-date-day-v5');if(!day)return;event.preventDefault();const offset=Number(day.dataset.offset)||0;dateState.position=-offset*slotWidth();magneticSnap()},true);
  input.addEventListener('change',()=>setTimeout(()=>{if(!dateState?.dragging)renderDateWindow(input.value||iso())},0));
  new MutationObserver(()=>{if(dock.dataset.flowKineticBound==='true'&&!rail.querySelector('.flow-date-day-v5')&&!dateState?.dragging)queueMicrotask(()=>renderDateWindow(input.value||iso()))}).observe(rail,{childList:true});
  addEventListener('resize',()=>{if(!dateState?.dragging)renderDateWindow(input.value||iso())},{passive:true});
  return true
}

function cacheEvents(){
  const p=profile();if(!p?.school?.schoolCode)return[];const prefix=`${CACHE_PREFIX}${p.school.schoolCode}:${p.grade}:${p.className}:`,rows=[];
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;const entry=readJson(key,null),events=entry?.payload?.events;if(Array.isArray(events))rows.push(...events)}return rows
}
function parseExam(event){
  if(!event)return null;const name=String(event.name||'').trim(),detail=String(event.content||event.detail||'').trim();if(!EXAM_KEYWORDS.test(`${name} ${detail}`))return null;const raw=String(event.date||'').replace(/\D/g,'');if(raw.length<8)return null;const value=`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;const flag=event?.[`grade${grade()}`],flags=[1,2,3,4,5,6].map(n=>event?.[`grade${n}`]).filter(Boolean);if(flag&&flag!=='Y'&&!(flags.length&&flags.every(v=>v!=='Y')))return null;return{date:value,name,detail:detail||'학교 학사일정',kind:event.kind||'학교 시험'}
}
function examKey(item){const text=`${item.name} ${item.detail||''}`;if(/전국연합|학력평가/.test(text))return`${item.date}:national`;if(/영어듣기/.test(text))return`${item.date}:listening`;if(/모의평가/.test(text))return`${item.date}:mock`;return`${item.date}:${item.name}`}
function collectExams(){
  const today=iso(),g=grade(),merged=[...cacheEvents(),...examState.remote].map(parseExam).filter(Boolean);merged.push(...official.filter(e=>e.grades.includes(g)));const map=new Map();for(const item of merged.filter(e=>e.date>=today)){const key=examKey(item),old=map.get(key);if(!old||String(item.detail).length>String(old.detail).length)map.set(key,item)}return[...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'ko'))
}
function resetExamHorizon(){const now=new Date(),end=now.getMonth()>=2?new Date(now.getFullYear()+1,1,28,12):new Date(now.getFullYear(),1,28,12);examState.cursor=new Date(now.getFullYear(),now.getMonth()+1,1,12);examState.horizon=end;examState.exhausted=examState.cursor>end}
async function fetchExamMonth(date){const p=profile();if(!p?.school?.officeCode||!p?.school?.schoolCode)return[];const url=new URL(EDGE),params={action:'dashboard',office:p.school.officeCode,school:p.school.schoolCode,grade:p.grade,class:p.className,kind:p.school.kind,date:ymd(date)};Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))});const response=await fetch(url,{cache:'no-store'});if(!response.ok)return[];const body=await response.json().catch(()=>({}));return Array.isArray(body.events)?body.events:[]}
async function loadMoreExams(){
  if(examState.loading||examState.exhausted||!examState.interacted)return;examState.loading=true;try{const before=collectExams().length;while(examState.cursor<=examState.horizon){const target=new Date(examState.cursor);examState.cursor=new Date(target.getFullYear(),target.getMonth()+1,1,12);examState.remote.push(...await fetchExamMonth(target));if(collectExams().length>before)break}if(examState.cursor>examState.horizon)examState.exhausted=true;renderExamDeck(true)}finally{examState.loading=false}
}
function examCard(item,index){return `<article class="flow-exam-card-v5" data-exam-index="${index}"><div class="flow-exam-top-v5"><span class="flow-exam-dday-v5">${dday(item.date)}</span><span>${dateLabel(item.date)}</span><span>${escapeHtml(item.kind||'시험')}</span></div><h3>${escapeHtml(item.name)}</h3><p class="flow-exam-detail-v5">${escapeHtml(item.detail||'시험 일정을 확인하세요.')}</p></article>`}
function smoothstep(value){const t=clamp(value,0,1);return t*t*(3-2*t)}
function examY(relative){if(relative<0)return relative*140;const linear=relative*136,stacked=136+(relative-1)*EXAM_STACK_STEP,blend=smoothstep((relative-.72)/.56);return linear+(stacked-linear)*blend}
function setStyleIfChanged(node,name,value){if(node.style.getPropertyValue(name)!==value)node.style.setProperty(name,value)}
function updateExamStage(){
  const deck=$('#flowExamDeckV5'),stage=$('.flow-exam-stage-v5',deck);if(!deck||!stage)return;const cursor=deck.scrollTop/EXAM_STEP,index=Math.floor(cursor);$$('.flow-exam-card-v5',stage).forEach(card=>{const i=Number(card.dataset.examIndex),rel=i-cursor;if(rel<-1.05||rel>4.3){if(card.style.display!=='none')card.style.display='none';if(card.hasAttribute('data-active'))card.removeAttribute('data-active');return}if(card.style.display!=='block')card.style.display='block';const rawActive=clamp(1-Math.abs(rel),0,1),active=smoothstep(rawActive),y=examY(rel),scale=rel<=1?1-.018*Math.max(0,rel):clamp(.982-(rel-1)*.015,.92,.982),opacity=rel<0?clamp(1+rel,0,1):rel<=3?1:clamp(1-(rel-3)*.55,.28,1),isActive=rel>=-.5&&rel<.5;setStyleIfChanged(card,'--flow-active',active.toFixed(3));setStyleIfChanged(card,'--flow-y',`${y.toFixed(2)}px`);setStyleIfChanged(card,'--flow-scale',scale.toFixed(3));setStyleIfChanged(card,'--flow-opacity',opacity.toFixed(3));setStyleIfChanged(card,'--flow-sat',String(clamp(1-(Math.max(0,rel-1)*.035),.86,1)));setStyleIfChanged(card,'--flow-detail-y',`${((1-active)*4).toFixed(2)}px`);if(isActive&&!card.hasAttribute('data-active'))card.setAttribute('data-active','true');else if(!isActive&&card.hasAttribute('data-active'))card.removeAttribute('data-active')});if(examState.interacted&&index>=examState.items.length-4&&!examState.exhausted)void loadMoreExams()
}
function renderExamDeck(preserve=false){
  const card=$('#todayView .upcoming-card');if(!card)return false;card.dataset.flowExamDeck='v5';const old=$('#flowExamFeedV3');if(old)old.style.display='none';const nextItems=collectExams(),signature=nextItems.map(item=>`${item.date}:${item.name}:${item.detail||''}`).join('|');examState.items=nextItems;let deck=$('#flowExamDeckV5'),saved=preserve&&deck?deck.scrollTop:0;if(!deck){deck=document.createElement('div');deck.id='flowExamDeckV5';deck.setAttribute('aria-label','다가오는 시험');(old||$('#eventList',card))?.after(deck)}else if(deck.dataset.flowExamSignature===signature){if(preserve&&Math.abs(deck.scrollTop-saved)>.5)deck.scrollTop=saved;updateExamStage();return true}const cards=examState.items.map(examCard).join(''),snaps=examState.items.map((_,i)=>`<div class="flow-exam-snap-v5" data-snap-index="${i}"></div>`).join('');deck.innerHTML=`<div class="flow-exam-stage-v5">${cards}</div><div class="flow-exam-runway-v5">${snaps}<div style="height:252px"></div></div>`;deck.dataset.flowExamSignature=signature;deck.scrollTop=saved;deck.onscroll=()=>{if(examState.frame)return;examState.frame=requestAnimationFrame(()=>{examState.frame=0;updateExamStage()})};if(deck.dataset.flowExamIntentBound!=='true'){deck.dataset.flowExamIntentBound='true';const arm=()=>{examState.interacted=true};deck.addEventListener('wheel',arm,{passive:true});deck.addEventListener('pointerdown',arm,{passive:true});deck.addEventListener('touchstart',arm,{passive:true});deck.addEventListener('keydown',event=>{if(['ArrowDown','PageDown','End',' '].includes(event.key))arm()})}updateExamStage();return true
}
function bindExamDeck(){if(!examState.cursor)resetExamHorizon();renderExamDeck();[120,420,900,1600].forEach(delay=>setTimeout(()=>renderExamDeck(true),delay));document.addEventListener('change',event=>{if(event.target.matches?.('#datePicker'))setTimeout(()=>renderExamDeck(true),120)});document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="today"]'))setTimeout(()=>renderExamDeck(true),120)})}

const ambientPalettes={dawn:['#ffe2c2','#e8ecfb'],day:['#fff0b8','#edf2f4'],golden:['#ffd39a','#e9def6'],evening:['#e3cef4','#dce6f8'],night:['#cfc3f2','#d9e2f7']};
function syncAmbientVisibility(){
  if(!enabled(AMBIENT_KEY))return;const now=new Date(),h=now.getHours()+now.getMinutes()/60,phase=h<6.5?'night':h<8.5?'dawn':h<16.5?'day':h<18.5?'golden':h<21?'evening':'night',palette=ambientPalettes[phase]||ambientPalettes.day;root.dataset.flowAmbient='on';root.dataset.flowAmbientPhase=phase;root.style.setProperty('--flow-ambient-a',palette[0]);root.style.setProperty('--flow-ambient-b',palette[1])
}
function syncSettingsClearance(){
  const panel=$('#flowSchoolSettingsView');if(!panel)return false;const touchFirst=matchMedia('(max-width:900px), (min-width:901px) and (max-width:1024px) and (orientation:portrait)').matches;
  if(!touchFirst){['padding-bottom','scroll-padding-bottom','bottom'].forEach(name=>panel.style.removeProperty(name));return false}
  const clearance=matchMedia('(max-width:520px)').matches?'134px':'138px';panel.style.setProperty('padding-bottom',`calc(${clearance} + env(safe-area-inset-bottom))`,'important');panel.style.setProperty('scroll-padding-bottom',`calc(${clearance} + env(safe-area-inset-bottom))`,'important');panel.style.setProperty('bottom','0px','important');return true
}
function installHapticFallback(){
  document.addEventListener('pointerdown',event=>{if(!event.isPrimary||!event.target.closest?.('.mobile-tab,.flow-settings-segment button,.flow-experience-settings-grid button,.timetable-mode-toggle button'))return;haptic(5)},{capture:true,passive:true});
  document.addEventListener('click',event=>{const button=event.target.closest?.('[data-flow-experience-toggle="haptics"]');if(button&&enabled(HAPTIC_KEY))setTimeout(()=>haptic([8,18,6]),0)},{capture:true,passive:true})
}
function installSettingsRepair(){
  syncAmbientVisibility();syncSettingsClearance();[120,700,1500].forEach(delay=>setTimeout(()=>{syncAmbientVisibility();syncSettingsClearance()},delay));setInterval(syncAmbientVisibility,60000);addEventListener('resize',syncSettingsClearance,{passive:true});
  document.addEventListener('click',event=>{if(event.target.closest?.('#mobileSettingsBtn,#settingsBtn')){setTimeout(()=>{syncAmbientVisibility();syncSettingsClearance();const panel=$('#flowSchoolSettingsView');if(panel)panel.scrollTop=Math.max(0,panel.scrollTop)},0);setTimeout(syncSettingsClearance,80)}if(event.target.closest?.('[data-flow-experience-toggle="ambient"]')){setTimeout(syncAmbientVisibility,0);setTimeout(syncAmbientVisibility,120)}},{capture:true,passive:true})
}
function boot(){
  installStyle();const bind=()=>{bindDateWheel();if(!$('#flowExamDeckV5'))bindExamDeck()};bind();[60,180,520,1100].forEach(delay=>setTimeout(bind,delay));
  const observer=new MutationObserver(()=>{if(bootFrame)return;bootFrame=requestAnimationFrame(()=>{bootFrame=0;bind();syncSettingsClearance()})});observer.observe(document.body,{subtree:true,childList:true});
  installHapticFallback();installSettingsRepair();root.dataset.flowSchoolMobileV5='ready'
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();