const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const PROFILE_KEY='flow-school-profile-v3';
const BELL_KEY='flow-school-bell-v1';
const EXAM_KEYWORDS=/시험|평가|모의|중간|기말|고사|수능|학력|듣기/;
let examStackIndex=0;
let examSignature='';
let academicExamCache=[];

const OFFICIAL_EXAMS_2026=[
  {date:'2026-09-02',grades:[1,2],name:'9월 전국연합학력평가',detail:'1·2학년 전국연합학력평가',kind:'전국연합'},
  {date:'2026-09-02',grades:[3],name:'9월 대학수학능력시험 모의평가',detail:'한국교육과정평가원 주관 모의평가',kind:'모의평가'},
  {date:'2026-09-08',grades:[1],name:'2학기 전국 영어듣기능력평가',detail:'1학년 전국 영어듣기능력평가',kind:'영어듣기'},
  {date:'2026-09-09',grades:[2],name:'2학기 전국 영어듣기능력평가',detail:'2학년 전국 영어듣기능력평가',kind:'영어듣기'},
  {date:'2026-09-10',grades:[3],name:'2학기 전국 영어듣기능력평가',detail:'3학년 전국 영어듣기능력평가',kind:'영어듣기'},
  {date:'2026-10-20',grades:[1,2],name:'10월 전국연합학력평가',detail:'경기도교육청 주관 전국연합학력평가',kind:'전국연합'},
  {date:'2026-10-20',grades:[3],name:'10월 전국연합학력평가',detail:'서울특별시교육청 주관 전국연합학력평가',kind:'전국연합'},
  {date:'2026-11-19',grades:[3],name:'2027학년도 대학수학능력시험',detail:'한국교육과정평가원',kind:'수능'},
];

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function pad(value){return String(value).padStart(2,'0')}
function isoLocal(date=new Date()){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function ymdLocal(date=new Date()){return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}`}
function minuteOfDay(date=new Date()){return date.getHours()*60+date.getMinutes()+date.getSeconds()/60}
function parseTime(value,fallback){const match=String(value||'').match(/^(\d{1,2}):(\d{2})$/);return match?Number(match[1])*60+Number(match[2]):fallback}
function formatMinutes(total){const value=((Math.round(total)%1440)+1440)%1440;return `${pad(Math.floor(value/60))}:${pad(value%60)}`}
function profile(){return readJson(PROFILE_KEY,{})||{}}
function grade(){return Math.max(1,Math.min(6,Number(profile()?.grade)||1))}
function schoolKind(){return String(profile()?.school?.kind||'')}
function bellDefaults(){const kind=schoolKind();if(kind.includes('초등'))return{start:'09:00',lesson:40,break:10,meal:'12:10',mealEnd:'13:00'};if(kind.includes('중학'))return{start:'09:00',lesson:45,break:10,meal:'12:20',mealEnd:'13:10'};return{start:'08:30',lesson:50,break:10,meal:'12:20',mealEnd:'13:10'}}
function bellConfig(){const cfg={...bellDefaults(),...readJson(BELL_KEY,{})};if(!cfg.mealEnd)cfg.mealEnd=formatMinutes(parseTime(cfg.meal,12*60+20)+50);return cfg}
function periodWindows(count=7){
  const cfg=bellConfig(),lesson=Math.max(25,Number(cfg.lesson)||50),brk=Math.max(5,Number(cfg.break)||10);
  let cursor=parseTime(cfg.start,8*60+30);const mealStart=parseTime(cfg.meal,12*60+20),mealEnd=Math.max(mealStart+30,parseTime(cfg.mealEnd,mealStart+50));const windows=[];
  for(let period=1;period<=count;period++){
    const start=cursor,end=start+lesson;windows.push({period,start,end});
    if(period===4)cursor=Math.max(end+brk,mealEnd);else cursor=end+brk;
  }
  return windows;
}
function selectedDayIsToday(){const active=$('#dayStrip .day-chip.active');return !active?.dataset?.date||active.dataset.date===ymdLocal()}
function setTextIfChanged(node,value){if(node&&node.textContent!==value)node.textContent=value}

function installStyles(){
  if($('#flow-school-timetable-polish-style'))return;
  const style=document.createElement('style');
  style.id='flow-school-timetable-polish-style';
  style.textContent=`
html[data-flow-school-ui="v2"] body #todayView .timetable-actions{gap:6px!important;align-items:center!important;justify-content:flex-end!important}
html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle{box-sizing:border-box!important;min-width:104px!important;height:42px!important;padding:3px!important;border:0!important;border-radius:999px!important;background:color-mix(in srgb,var(--surface-2) 86%,var(--surface))!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.62),inset 0 -2px 6px rgba(55,72,101,.055)!important}
html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button{min-height:34px!important;padding:0 11px!important;border:0!important;border-radius:999px!important;font-size:.64rem!important;font-weight:820!important;color:var(--muted)!important;box-shadow:none!important}
html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button.active{background:var(--surface)!important;color:var(--accent)!important;box-shadow:0 5px 13px rgba(43,57,78,.09),inset 0 1px 0 rgba(255,255,255,.72)!important}
html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action{box-sizing:border-box!important;min-height:42px!important;padding:0 13px!important;border:0!important;border-radius:999px!important;background:color-mix(in srgb,var(--surface) 91%,var(--surface-2))!important;color:var(--text)!important;box-shadow:0 5px 14px rgba(43,57,78,.075),inset 0 1px 0 rgba(255,255,255,.7),inset 0 -2px 6px rgba(55,72,101,.045)!important;font-size:.64rem!important;font-weight:790!important;transition:transform .16s ease,background .16s ease,box-shadow .16s ease!important}
html[data-flow-school-ui="v2"] body #todayView #editSubjectsBtn.flow-school-utility-action{background:color-mix(in srgb,var(--accent) 8%,var(--surface))!important;color:var(--accent)!important}
html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action:active{transform:translateY(1px) scale(.98)!important;box-shadow:inset 0 3px 8px rgba(58,75,105,.10),inset 0 -1px 1px rgba(255,255,255,.6)!important}
html[data-flow-school-ui="v2"] body #todayView .meal-card #allergyBtn.flow-school-utility-action{min-height:40px!important;padding-inline:12px!important;background:color-mix(in srgb,var(--surface) 88%,var(--surface-2))!important}
html[data-flow-school-ui="v2"] body #todayView .period-button{corner-shape:squircle!important;border-radius:18px!important;box-shadow:none!important;filter:none!important;overflow:hidden!important}
html[data-flow-school-ui="v2"] body #todayView .period-button::before,html[data-flow-school-ui="v2"] body #todayView .period-button::after{box-shadow:none!important}
html[data-flow-school-ui="v2"] body #todayView .period-no{border-radius:999px!important;clip-path:circle(50% at 50% 50%)!important;-webkit-clip-path:circle(50% at 50% 50%)!important;overflow:hidden!important;flex:0 0 auto!important}
html[data-flow-school-ui="v2"] body #todayView .period-button>span:nth-child(2){min-width:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px}
html[data-flow-school-ui="v2"] body #todayView .flow-period-time{display:block;font-size:.54rem;font-weight:650;letter-spacing:.015em;line-height:1.2;color:color-mix(in srgb,var(--muted) 88%,transparent)}
html[data-flow-school-ui="v2"] body #todayView .period-button.flow-period-current{background:color-mix(in srgb,var(--accent) 7%,var(--surface))!important}
html[data-flow-school-ui="v2"] body #todayView .period-button.flow-period-current .period-no{background:color-mix(in srgb,var(--accent) 17%,var(--surface-2))!important;color:var(--accent)!important}
html[data-flow-school-ui="v2"] body #todayView .period-button.flow-period-current .period-name{color:var(--text)!important}
html[data-flow-school-ui="v2"] body #todayView .period-button.flow-period-current .flow-period-time{color:var(--accent);font-weight:760}
html[data-flow-school-ui="v2"] body #todayView .upcoming-card{overflow:hidden!important}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-stack{position:relative;height:224px;overflow:visible;touch-action:pan-x;user-select:none;-webkit-user-select:none;perspective:900px}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-card{position:absolute;left:0;right:0;top:0;box-sizing:border-box;min-height:112px;padding:15px 16px;border:0;border-radius:18px;corner-shape:squircle;background:color-mix(in srgb,var(--surface) 96%,var(--surface-2));box-shadow:0 9px 24px rgba(43,57,78,.065),inset 0 1px 0 rgba(255,255,255,.75);transform-origin:50% 0;transition:transform .24s cubic-bezier(.2,.9,.22,1),opacity .2s ease,filter .2s ease;will-change:transform,opacity}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-card[data-depth="0"]{z-index:3;transform:translate3d(0,calc(var(--flow-exam-drag,0px) * .52),0) scale(1);opacity:1}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-card[data-depth="1"]{z-index:2;transform:translate3d(8px,94px,-20px) scale(.965);opacity:.86;filter:saturate(.92)}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-card[data-depth="2"]{z-index:1;transform:translate3d(15px,154px,-42px) scale(.93);opacity:.72;filter:saturate(.9) blur(.08px)}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-stack[data-swipe="up"] .flow-exam-card[data-depth="0"]{transform:translate3d(0,-78px,0) scale(.975);opacity:0}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-stack[data-swipe="down"] .flow-exam-card[data-depth="0"]{transform:translate3d(0,58px,0) scale(.985);opacity:0}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-date{display:flex;align-items:center;gap:8px;margin-bottom:7px;color:var(--muted);font-size:.58rem;font-weight:730}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-dday{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--accent);font-size:.58rem;font-weight:850}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-card h3{margin:0;font-size:.91rem;line-height:1.3;letter-spacing:-.035em}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-card p{margin:6px 0 0;color:var(--muted);font-size:.59rem;line-height:1.45}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-card[data-depth]:not([data-depth="0"]){min-height:82px;padding-top:13px}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-card[data-depth]:not([data-depth="0"]) p{display:none}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-card[data-depth]:not([data-depth="0"]) .flow-exam-dday{min-height:20px;padding-inline:6px}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-empty{padding:22px 0;color:var(--muted);font-size:.68rem}
html[data-flow-school-ui="v2"] body #todayView .flow-exam-hint{position:absolute;right:4px;bottom:-2px;color:color-mix(in srgb,var(--muted) 72%,transparent);font-size:.53rem;font-weight:650;letter-spacing:.01em}
html[data-flow-android-stable-glass="true"][data-flow-glass-mode="optical"] body .mobile-bottom-nav>.flow-refraction-copy-lens{display:none!important}
html[data-flow-android-stable-glass="true"] body .flow-optical-jelly{display:none!important}
html[data-flow-android-stable-glass="true"] body .mobile-bottom-nav{isolation:isolate;transform:translateZ(0)}
.inline-week-timetable{gap:11px!important}.inline-week-toolbar{padding-top:1px!important}.inline-week-toolbar .week-controls{gap:6px!important}.inline-week-toolbar .week-controls .neo-button{box-sizing:border-box!important;min-width:70px!important;min-height:40px!important;padding:0 12px!important;border-radius:13px!important;border:1px solid color-mix(in srgb,var(--text) 7%,transparent)!important;background:var(--surface-2)!important;color:var(--text)!important;box-shadow:none!important;font-size:.64rem!important;font-weight:780!important}.inline-week-toolbar .week-controls #thisWeekBtn{background:color-mix(in srgb,var(--accent) 11%,var(--surface))!important;border-color:color-mix(in srgb,var(--accent) 20%,transparent)!important;color:var(--accent)!important}.flow-inline-week-active .timetable-card .neis-timetable-help{margin-top:13px!important;padding-top:13px!important}
@media(max-width:900px){html[data-flow-school-ui="v2"] body #todayView .timetable-actions{gap:4px!important}html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle{min-width:86px!important;height:36px!important;padding:2px!important}html[data-flow-school-ui="v2"] body #todayView .timetable-mode-toggle button{min-height:32px!important;padding:0 7px!important;font-size:.57rem!important}html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action{min-height:36px!important;padding:0 9px!important;font-size:.57rem!important}html[data-flow-school-ui="v2"] body #todayView .meal-card #allergyBtn.flow-school-utility-action{min-height:36px!important;padding-inline:10px!important}html[data-flow-school-ui="v2"] body #todayView .period-button{border-radius:17px!important}html[data-flow-school-ui="v2"] body #todayView .flow-period-time{font-size:.52rem}html[data-flow-school-ui="v2"] body #todayView .flow-exam-stack{height:220px}.inline-week-toolbar .week-controls{gap:5px!important}.inline-week-toolbar .week-controls .neo-button{min-width:0!important;min-height:36px!important;padding:0 8px!important;border-radius:11px!important;font-size:.58rem!important}}
@media(prefers-reduced-motion:reduce){html[data-flow-school-ui="v2"] body #todayView .flow-school-utility-action,html[data-flow-school-ui="v2"] body #todayView .flow-exam-card{transition:none!important}}
`;
  document.head.append(style);
}

function normalizeActionControls(){
  const actions=$('.timetable-actions');const toggle=actions?$('.timetable-mode-toggle',actions):null;const edit=$('#editSubjectsBtn'),share=$('#shareTimetableBtn'),allergy=$('#allergyBtn');
  if(actions){
    if(toggle&&actions.firstElementChild!==toggle)actions.prepend(toggle);
    if(edit&&toggle?.nextElementSibling!==edit)actions.insertBefore(edit,share?.parentElement===actions?share:null);
    if(share&&actions.lastElementChild!==share)actions.append(share);
  }
  if(edit){if(!edit.classList.contains('flow-school-utility-action'))edit.classList.add('flow-school-utility-action');if(edit.dataset.flowSchoolAction!=='edit')edit.dataset.flowSchoolAction='edit'}
  if(share){if(!share.classList.contains('flow-school-utility-action'))share.classList.add('flow-school-utility-action');if(share.dataset.flowSchoolAction!=='share')share.dataset.flowSchoolAction='share'}
  if(allergy){if(!allergy.classList.contains('flow-school-utility-action'))allergy.classList.add('flow-school-utility-action');if(allergy.dataset.flowSchoolAction!=='allergy')allergy.dataset.flowSchoolAction='allergy'}
}
function moveHelpLast(){const card=$('.timetable-card'),help=$('#neisTimetableHelp');if(!card||!help||help.parentElement!==card)return;if(card.lastElementChild!==help)card.append(help)}
function enhanceTimetable(){
  const rows=$$('#todayView #timetable .period-button[data-period]');if(!rows.length)return;const max=Math.max(7,...rows.map(row=>Number(row.dataset.period)||0)),windows=periodWindows(max),now=minuteOfDay(),today=selectedDayIsToday();let current=0;if(today){const hit=windows.find(window=>now>=window.start&&now<window.end);current=hit?.period||0}
  rows.forEach(row=>{const period=Number(row.dataset.period)||0,window=windows.find(item=>item.period===period),copy=row.children[1];if(!window||!copy)return;let time=$('.flow-period-time',copy);if(!time){time=document.createElement('small');time.className='flow-period-time';copy.append(time)}const active=current===period,text=`${formatMinutes(window.start)}–${formatMinutes(window.end)}${active?' · 진행 중':''}`;setTextIfChanged(time,text);if(row.classList.contains('flow-period-current')!==active)row.classList.toggle('flow-period-current',active);if(active){if(row.getAttribute('aria-current')!=='true')row.setAttribute('aria-current','true')}else if(row.hasAttribute('aria-current'))row.removeAttribute('aria-current')});
}
function captureAcademicExams(){
  const events=$$('#eventList .event');if(!events.length)return;const now=new Date(),captured=[];for(const event of events){const name=$('.event-name',event)?.textContent?.trim()||'',content=$('.event-content',event)?.textContent?.trim()||'';if(!EXAM_KEYWORDS.test(`${name} ${content}`))continue;const day=Number($('.event-date strong',event)?.textContent||0),month=Number(($('.event-date span',event)?.textContent||'').replace(/[^0-9]/g,''));if(!day||!month)continue;let year=now.getFullYear();const candidate=new Date(year,month-1,day,12);if(candidate<new Date(now.getFullYear(),now.getMonth()-2,1))year++;captured.push({date:`${year}-${pad(month)}-${pad(day)}`,name,detail:content||'학교 학사일정',kind:'학교 시험'})}if(captured.length)academicExamCache=captured;
}
function examGroup(exam){const text=`${exam.name} ${exam.detail}`;if(/전국연합|학력평가/.test(text))return`${exam.date}:national`;if(/영어듣기/.test(text))return`${exam.date}:listening`;if(/모의평가/.test(text))return`${exam.date}:mock`;return`${exam.date}:${exam.name}`}
function upcomingExams(){captureAcademicExams();const today=isoLocal(),g=grade(),items=[...academicExamCache,...OFFICIAL_EXAMS_2026.filter(item=>item.grades.includes(g))].filter(item=>item.date>=today).sort((a,b)=>a.date.localeCompare(b.date));const dedup=new Map();for(const item of items){const key=examGroup(item),old=dedup.get(key);if(!old||String(item.detail||'').length>String(old.detail||'').length)dedup.set(key,item)}return[...dedup.values()].sort((a,b)=>a.date.localeCompare(b.date))}
function examDday(date){const now=new Date(),[y,m,d]=date.split('-').map(Number),target=new Date(y,m-1,d,12),base=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12),diff=Math.round((target-base)/86400000);return diff===0?'D-DAY':diff>0?`D-${diff}`:`D+${Math.abs(diff)}`}
function examDateLabel(date){const[y,m,d]=date.split('-').map(Number);return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(y,m-1,d,12))}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[char]))}
function examCardMarkup(exam,depth){return `<article class="flow-exam-card" data-depth="${depth}" data-exam-date="${exam.date}"><div class="flow-exam-date"><span class="flow-exam-dday">${examDday(exam.date)}</span><span>${examDateLabel(exam.date)}</span><span>${exam.kind||'시험'}</span></div><h3>${escapeHtml(exam.name)}</h3>${depth===0?`<p>${escapeHtml(exam.detail||'시험 일정을 확인하세요.')}</p>`:''}</article>`}
function updateQuickExam(exams){
  const card=$('#quickEvent')?.closest('.status-card'),first=exams[0],label=card?.querySelector('.status-label'),quick=$('#quickEvent'),sub=$('#quickEventSub');setTextIfChanged(label,'다음 시험');
  if(!first){setTextIfChanged(quick,'예정 없음');setTextIfChanged(sub,'확인된 시험 일정 없음');return}
  setTextIfChanged(quick,`${examDday(first.date)} ${first.name}`);setTextIfChanged(sub,examDateLabel(first.date));
}
function renderExamStack(){
  const box=$('#eventList'),card=box?.closest('.upcoming-card');if(!box||!card)return;captureAcademicExams();const exams=upcomingExams(),signature=exams.map(item=>`${item.date}:${item.name}:${item.detail||''}`).join('|');if(signature!==examSignature){examSignature=signature;examStackIndex=0}
  const title=$('.card-heading h2',card),kicker=$('.section-kicker',card);setTextIfChanged(title,'다가오는 시험');setTextIfChanged(kicker,'EXAMS');updateQuickExam(exams);
  if(!box.classList.contains('flow-exam-stack'))box.classList.add('flow-exam-stack');const count=String(exams.length);if(box.dataset.flowExamCount!==count)box.dataset.flowExamCount=count;
  examStackIndex=Math.max(0,Math.min(examStackIndex,Math.max(0,exams.length-1)));const renderKey=`${signature}::${examStackIndex}`;if(box.dataset.flowExamRenderKey===renderKey){bindExamStack(box);return}
  const visible=exams.slice(examStackIndex,examStackIndex+3),markup=visible.length?visible.map((exam,index)=>examCardMarkup(exam,index)).join('')+(exams.length>1?'<span class="flow-exam-hint">위아래로 넘겨 보기</span>':''):'<div class="flow-exam-empty">다가오는 시험 일정이 없습니다.</div>';
  if(box.innerHTML!==markup)box.innerHTML=markup;box.dataset.flowExamRenderKey=renderKey;bindExamStack(box);
}
function bindExamStack(box){
  if(box.dataset.flowExamBound==='true')return;box.dataset.flowExamBound='true';let startY=0,startAt=0,dragging=false;const reset=()=>{dragging=false;if(box.style.getPropertyValue('--flow-exam-drag')!=='0px')box.style.setProperty('--flow-exam-drag','0px');if(box.dataset.swipe)delete box.dataset.swipe};const settle=direction=>{const list=upcomingExams();if(direction==='up'&&examStackIndex<list.length-1){box.dataset.swipe='up';setTimeout(()=>{examStackIndex++;renderExamStack();reset()},170)}else if(direction==='down'&&examStackIndex>0){box.dataset.swipe='down';setTimeout(()=>{examStackIndex--;renderExamStack();reset()},170)}else reset()};box.addEventListener('pointerdown',event=>{if(event.button!==0)return;dragging=true;startY=event.clientY;startAt=performance.now();box.setPointerCapture?.(event.pointerId)});box.addEventListener('pointermove',event=>{if(!dragging)return;const dy=Math.max(-92,Math.min(72,event.clientY-startY)),value=`${dy}px`;if(box.style.getPropertyValue('--flow-exam-drag')!==value)box.style.setProperty('--flow-exam-drag',value)});const end=event=>{if(!dragging)return;const dy=event.clientY-startY,elapsed=Math.max(16,performance.now()-startAt),velocity=dy/elapsed;box.releasePointerCapture?.(event.pointerId);if(dy<-34||velocity<-.42)settle('up');else if(dy>34||velocity>.42)settle('down');else reset()};box.addEventListener('pointerup',end);box.addEventListener('pointercancel',reset);
}
function markAndroidStableGlass(){if(/Android/i.test(navigator.userAgent||'')&&document.documentElement.dataset.flowAndroidStableGlass!=='true')document.documentElement.dataset.flowAndroidStableGlass='true'}
function enhance(){normalizeActionControls();moveHelpLast();enhanceTimetable();renderExamStack()}
function scheduleEnhance(){[0,120,360,900,1800,3500,7000].forEach(delay=>setTimeout(enhance,delay))}
function init(){
  markAndroidStableGlass();installStyles();scheduleEnhance();
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-view="today"]')){queueMicrotask(enhance);return}
    if(event.target.closest('#prevDay,#nextDay,#todayBtn,#editSubjectsBtn'))[0,120,360,900].forEach(delay=>setTimeout(enhance,delay));
  });
  document.addEventListener('change',event=>{if(event.target.matches('#datePicker,#monthPicker'))[0,120,360,900].forEach(delay=>setTimeout(enhance,delay))});
  window.addEventListener('focus',()=>queueMicrotask(enhance));setInterval(()=>{if(!document.hidden)enhanceTimetable()},30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
