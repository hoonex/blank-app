const EDGE_V5 = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
const PROFILE_KEY_V5 = 'flow-school-profile-v3';
const THEME_KEY_V5 = 'flow-school-theme-v3';
const RANK_TOTAL_KEY = 'flow-school-rank-total-v1';

const ROUTE_TO_VIEW = {'/home':'today','/week':'week','/schedule':'schedule','/school':'school'};
const VIEW_TO_ROUTE = {today:'/home',week:'/week',schedule:'/schedule',school:'/school'};
const MOCK_SOURCE = 'https://www.ebsi.co.kr/ebs/xip/xipa/retrieveExmSchedRngNext.ebs';
const LISTENING_SOURCE = 'https://www.ebsi.co.kr/ebs/pot/potg/EnglishListening03.ebs';

const NATIONAL_2026 = [
  {date:'2026-03-24',grades:[1,2,3],name:'3월 전국연합학력평가',org:'서울특별시교육청',source:MOCK_SOURCE},
  {date:'2026-05-07',grades:[3],name:'5월 전국연합학력평가',org:'경기도교육청',source:MOCK_SOURCE},
  {date:'2026-06-04',grades:[1,2],name:'6월 전국연합학력평가',org:'부산광역시교육청',source:MOCK_SOURCE},
  {date:'2026-06-04',grades:[3],name:'6월 대학수학능력시험 모의평가',org:'한국교육과정평가원',source:MOCK_SOURCE},
  {date:'2026-07-08',grades:[3],name:'7월 전국연합학력평가',org:'인천광역시교육청',source:MOCK_SOURCE},
  {date:'2026-09-02',grades:[1,2],name:'9월 전국연합학력평가',org:'인천광역시교육청',source:MOCK_SOURCE},
  {date:'2026-09-02',grades:[3],name:'9월 대학수학능력시험 모의평가',org:'한국교육과정평가원',source:MOCK_SOURCE},
  {date:'2026-10-20',grades:[1,2],name:'10월 전국연합학력평가',org:'경기도교육청',source:MOCK_SOURCE},
  {date:'2026-10-20',grades:[3],name:'10월 전국연합학력평가',org:'서울특별시교육청',source:MOCK_SOURCE},
  {date:'2026-11-19',grades:[3],name:'2027학년도 대학수학능력시험',org:'한국교육과정평가원',source:MOCK_SOURCE},
  {date:'2026-04-07',grades:[1],name:'1학기 전국 영어듣기능력평가',org:'시도교육청',source:LISTENING_SOURCE},
  {date:'2026-04-08',grades:[2],name:'1학기 전국 영어듣기능력평가',org:'시도교육청',source:LISTENING_SOURCE},
  {date:'2026-04-09',grades:[3],name:'1학기 전국 영어듣기능력평가',org:'시도교육청',source:LISTENING_SOURCE},
  {date:'2026-09-08',grades:[1],name:'2학기 전국 영어듣기능력평가',org:'시도교육청',source:LISTENING_SOURCE},
  {date:'2026-09-09',grades:[2],name:'2학기 전국 영어듣기능력평가',org:'시도교육청',source:LISTENING_SOURCE},
  {date:'2026-09-10',grades:[3],name:'2학기 전국 영어듣기능력평가',org:'시도교육청',source:LISTENING_SOURCE},
];

let v5Data = null;
let v5Abort = null;
let routeLock = false;
const systemMedia = matchMedia('(prefers-color-scheme: dark)');

function readProfile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY_V5)||'null')}catch{return null}}
function selectedIso(){return document.querySelector('#datePicker')?.value || new Date().toISOString().slice(0,10)}
function isoTo8(v){return String(v||'').replaceAll('-','')}
function isoToLabel(v){const [y,m,d]=String(v||'').split('-');return y&&m&&d?`${y}.${m}.${d}`:''}
function prettyDate(v){const [y,m,d]=String(v||'').split('-').map(Number);if(!y)return'';return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(y,m-1,d,12))}
function isHigh(profile=readProfile()){return !!profile?.school?.kind?.includes('고등')}
function grade(profile=readProfile()){return Math.max(1,Math.min(6,Number(profile?.grade)||1))}
function nationalFor(profile=readProfile()){return isHigh(profile)?NATIONAL_2026.filter(e=>e.grades.includes(grade(profile))):[]}
function monthPrefix(){return (document.querySelector('#monthPicker')?.value || selectedIso().slice(0,7))}

function syncSystemTheme(){
  const pref=localStorage.getItem(THEME_KEY_V5)||'light';
  const html=document.documentElement;
  if(pref==='system'){
    const effective=systemMedia.matches?'dark':'light';
    html.dataset.themeMode='system';
    if(html.dataset.theme!==effective) html.dataset.theme=effective;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content',effective==='dark'?'#202833':'#edf2f7');
    const btn=document.querySelector('#landingThemeBtn');if(btn)btn.textContent='System';
  }else{
    html.dataset.themeMode=pref;
    if(html.dataset.theme!==pref) html.dataset.theme=pref;
  }
}
new MutationObserver(()=>{if(document.documentElement.dataset.theme==='system')syncSystemTheme()}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
systemMedia.addEventListener?.('change',()=>{if(localStorage.getItem(THEME_KEY_V5)==='system')syncSystemTheme()});
document.addEventListener('click',e=>{if(e.target.closest?.('[data-theme-choice],#landingThemeBtn'))setTimeout(syncSystemTheme,0)});

function routeView(view,push=true){
  const route=VIEW_TO_ROUTE[view];
  if(!route||location.pathname===route)return;
  history[push?'pushState':'replaceState']({view},'',route);
}
function clickView(view){
  const btn=document.querySelector(`.nav-item[data-view="${view}"]`)||document.querySelector(`.mobile-tab[data-view="${view}"]`);
  if(!btn)return;
  routeLock=true;btn.click();routeLock=false;
}
function applyRoute(){
  if(!readProfile())return;
  const view=ROUTE_TO_VIEW[location.pathname];
  if(view)clickView(view);
  else if(location.pathname==='/')routeView('today',false);
}
document.addEventListener('click',e=>{
  const direct=e.target.closest?.('[data-view]');
  const go=e.target.closest?.('[data-go-view]');
  const view=direct?.dataset.view||go?.dataset.goView;
  if(view&&!routeLock)setTimeout(()=>routeView(view,true),0);
});
window.addEventListener('popstate',applyRoute);

async function fetchV5Data(){
  const profile=readProfile();if(!profile)return;
  v5Abort?.abort();v5Abort=new AbortController();
  const params=new URLSearchParams({action:'dashboard',office:profile.school.officeCode,school:profile.school.schoolCode,grade:String(profile.grade),class:String(profile.className),kind:profile.school.kind||'',date:isoTo8(selectedIso())});
  try{
    const r=await fetch(`${EDGE_V5}?${params}`,{signal:v5Abort.signal});
    if(!r.ok)throw new Error('school data');
    v5Data=await r.json();
    enhanceAll();
  }catch(e){if(e.name!=='AbortError')enhanceAll()}
}

function eventApplies(e){
  const g=grade();
  const flag=e?.[`grade${g}`];
  const flags=[1,2,3,4,5,6].map(n=>e?.[`grade${n}`]).filter(Boolean);
  if(flag==='Y'||!flag)return true;
  if(flags.length&&flags.every(v=>v!=='Y'))return true;
  return false;
}
function schoolEvents(){return (v5Data?.events||[]).filter(eventApplies).sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
function schoolEventsOn(iso=selectedIso()){const key=isoTo8(iso);return schoolEvents().filter(e=>e.date===key)}
function nationalEventsOn(iso=selectedIso()){return nationalFor().filter(e=>e.date===iso)}

function renderScheduleFromV5(){
  if(!v5Data)return;
  const grid=document.querySelector('#scheduleGrid');if(!grid)return;
  const rows=schoolEvents();
  grid.replaceChildren();
  if(!rows.length){
    const empty=document.createElement('div');empty.className='empty';empty.textContent='공개된 학교 학사일정이 없습니다.';grid.append(empty);
  }else for(const e of rows){
    const row=document.createElement('div');row.className='schedule-row';row.dataset.date=e.date;
    const time=document.createElement('time');time.textContent=`${e.date.slice(0,4)}.${e.date.slice(4,6)}.${e.date.slice(6,8)}`;
    const strong=document.createElement('strong');strong.textContent=e.name||'일정';
    row.append(time,strong);
    if(e.content){const p=document.createElement('p');p.textContent=e.content;row.append(p)}
    grid.append(row);
  }
  decorateCalendar();
  renderSelectedDay();
}
function decorateCalendar(){
  if(!v5Data)return;
  const map=new Map();for(const e of schoolEvents()){if(!map.has(e.date))map.set(e.date,[]);map.get(e.date).push(e)}
  document.querySelectorAll('.calendar-day[data-calendar-date]').forEach(day=>{
    const key=day.dataset.calendarDate;const events=map.get(key)||[];
    day.querySelectorAll('.v5-calendar-dot,.v5-calendar-label').forEach(x=>x.remove());
    if(!events.length)return;
    if(!day.querySelector('.calendar-dot')){const dot=document.createElement('span');dot.className='calendar-dot v5-calendar-dot';day.append(dot)}
    if(!day.querySelector('.calendar-event-label')){const label=document.createElement('span');label.className='calendar-event-label v5-calendar-label';label.textContent=events[0].name;day.append(label)}
  });
}

function ensureSelectedPanel(){
  const grid=document.querySelector('#scheduleGrid');if(!grid||document.querySelector('#selectedDayPanel'))return;
  const panel=document.createElement('div');panel.id='selectedDayPanel';panel.className='selected-day-panel';grid.before(panel);
}
function renderSelectedDay(){
  ensureSelectedPanel();const panel=document.querySelector('#selectedDayPanel');if(!panel)return;
  const iso=selectedIso();const school=schoolEventsOn(iso);const national=nationalEventsOn(iso);
  panel.replaceChildren();
  const date=document.createElement('div');date.className='selected-day-date';date.textContent=prettyDate(iso);
  const title=document.createElement('div');title.className='selected-day-title';title.textContent=(school.length||national.length)?'선택한 날짜':'이날 일정 없음';
  panel.append(date,title);
  if(school.length||national.length){
    const items=document.createElement('div');items.className='selected-day-items';
    for(const [source,event] of [...school.map(e=>['학교',e]),...national.map(e=>['전국',e])]){
      const item=document.createElement('div');item.className='selected-day-item';
      const pill=document.createElement('span');pill.className='source-pill';pill.textContent=source;
      const b=document.createElement('b');b.textContent=event.name;
      item.append(pill,b);items.append(item);
    }
    panel.append(items);
  }
  const label=isoToLabel(iso);
  document.querySelectorAll('#scheduleGrid .schedule-row').forEach(row=>row.classList.toggle('selected-event',row.querySelector('time')?.textContent===label));
}

function ensureNationalCard(){
  const layout=document.querySelector('.schedule-layout');if(!layout||document.querySelector('#nationalScheduleCard'))return;
  const card=document.createElement('section');card.id='nationalScheduleCard';card.className='national-schedule-card';layout.after(card);
}
function renderNationalSchedule(){
  ensureNationalCard();const card=document.querySelector('#nationalScheduleCard');if(!card)return;
  const profile=readProfile();
  if(!isHigh(profile)){card.hidden=true;return} card.hidden=false;
  const events=nationalFor(profile).filter(e=>e.date.startsWith(monthPrefix()));
  card.replaceChildren();
  const head=document.createElement('div');head.className='national-schedule-head';
  const copy=document.createElement('div');const kicker=document.createElement('span');kicker.className='section-kicker';kicker.textContent='HIGH SCHOOL';
  const h=document.createElement('h2');h.textContent='전국 시험 일정';copy.append(kicker,h);head.append(copy);card.append(head);
  const list=document.createElement('div');list.className='national-schedule-list';
  if(!events.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='이번 달 전국 단위 시험 일정이 없습니다.';list.append(empty)}
  for(const e of events){
    const row=document.createElement('a');row.className='national-event';row.href=e.source;row.target='_blank';row.rel='noopener noreferrer';row.style.textDecoration='none';row.style.color='inherit';
    const t=document.createElement('time');t.textContent=e.date.slice(5).replace('-','.');const strong=document.createElement('strong');strong.textContent=e.name;const small=document.createElement('small');small.textContent=e.org;
    row.append(t,strong,small);list.append(row);
  }
  card.append(list);
}

function enhanceTimetable(){
  const profile=readProfile();if(!profile||!v5Data)return;
  const edit=document.querySelector('#editSubjectsBtn');
  const desc=document.querySelector('.timetable-card .card-heading p');
  const high=isHigh(profile);
  if(edit)edit.hidden=!high;
  if(desc)desc.textContent=high?'NEIS 시간표를 기준으로 표시하며 실제 빈 과목만 직접 수정할 수 있습니다.':'NEIS에 공개된 시간표를 그대로 표시합니다.';
  const raw=(v5Data.timetable||[]).filter(r=>r.date===isoTo8(selectedIso()));
  const rawByPeriod=new Map(raw.map(r=>[Number(r.period),r]));
  const buttons=[...document.querySelectorAll('#timetable .period-button[data-period]')];
  for(const btn of buttons){
    const p=Number(btn.dataset.period);const source=rawByPeriod.get(p);const name=btn.querySelector('.period-name');const origin=btn.querySelector('.period-origin');
    if(!source){if(name){name.textContent='—';name.classList.remove('elective');name.classList.add('is-empty')}if(origin)origin.textContent='';continue}
    if(!high&&!String(source.subject||'').trim()){if(name){name.textContent='—';name.classList.remove('elective');name.classList.add('is-empty')}if(origin)origin.textContent=''}
  }
  const empty=document.querySelector('#timetable .empty');
  if(empty&&raw.length===0){
    const events=schoolEventsOn();const vacation=events.find(e=>/방학/.test(e.name||''));const notable=vacation||events.find(e=>/(휴업|개학|방학식|졸업|입학|개교기념)/.test(e.name||''));
    empty.className='timetable-state';empty.replaceChildren();
    const strong=document.createElement('strong');strong.textContent=notable?.name||'—';
    const sub=document.createElement('span');sub.textContent=notable?'학사일정':'공개된 시간표가 없습니다.';empty.append(strong,sub);
    const quick=document.querySelector('#quickLessonSub');if(quick)quick.textContent=notable?.name||'시간표 없음';
  }
}

function ensureRankCard(){
  const view=document.querySelector('#schoolView');const info=document.querySelector('#schoolInfoGrid');if(!view||!info||document.querySelector('#rankCard'))return;
  const card=document.createElement('section');card.id='rankCard';card.className='rank-card';
  card.innerHTML='<span class="section-kicker">RANK</span><h2>석차 계산</h2><p>수강자수와 석차를 넣으면 상위 비율과 5등급 구간을 계산합니다. 동점자는 실제 성적표 산출과 다를 수 있습니다.</p><div class="rank-grid"><label class="rank-field">수강자수<input id="rankTotal" type="number" min="1" inputmode="numeric" placeholder="예: 240"></label><label class="rank-field">석차<input id="rankValue" type="number" min="1" inputmode="numeric" placeholder="예: 23"></label></div><div class="rank-result"><strong id="rankMain">값을 입력하세요</strong><span id="rankSub">5등급제 단순 비율 참고</span></div>';
  info.after(card);
  const saved=Number(localStorage.getItem(RANK_TOTAL_KEY)||0);if(saved)card.querySelector('#rankTotal').value=String(saved);
  card.querySelectorAll('input').forEach(input=>input.addEventListener('input',renderRank));renderRank();
}
function renderRank(){
  const total=Number(document.querySelector('#rankTotal')?.value||0),rank=Number(document.querySelector('#rankValue')?.value||0);const main=document.querySelector('#rankMain'),sub=document.querySelector('#rankSub');if(!main||!sub)return;
  if(total>0)localStorage.setItem(RANK_TOTAL_KEY,String(total));
  if(!(total>0&&rank>0&&rank<=total)){main.textContent='값을 입력하세요';sub.textContent='수강자수 기준';return}
  const pct=rank/total*100;const g=pct<=10?1:pct<=34?2:pct<=66?3:pct<=90?4:5;
  main.textContent=`상위 ${pct.toFixed(pct<10?1:0)}% · ${g}등급 구간`;
  sub.textContent=`${rank} / ${total}명`;
}
function renderRankVisibility(){ensureRankCard();const card=document.querySelector('#rankCard');if(card)card.hidden=!isHigh()}

function simplifyCopy(){
  const search=document.querySelector('#schoolSearch');if(search)search.placeholder='학교 이름을 입력하세요';
  const switchSearch=document.querySelector('#switchSearch');if(switchSearch)switchSearch.placeholder='학교 이름을 입력하세요';
  const eyebrow=document.querySelector('.onboarding-copy .eyebrow');if(eyebrow)eyebrow.textContent='FLOW SCHOOL';
  const p=document.querySelector('.onboarding-copy p');if(p)p.textContent='시간표, 급식, 학사일정과 학교정보를 한곳에서 확인합니다.';
  const hints=document.querySelector('.search-hints');if(hints)hints.innerHTML='<span>시간표</span><span>급식</span><span>학사일정</span>';
}

function enhanceAll(){syncSystemTheme();simplifyCopy();renderScheduleFromV5();renderNationalSchedule();enhanceTimetable();renderRankVisibility();renderSelectedDay()}

/* Keep Schedule open when a calendar date is selected. */
document.addEventListener('click',event=>{
  const day=event.target.closest?.('.calendar-day[data-calendar-date]');if(!day)return;
  const raw=day.dataset.calendarDate||'';if(!/^\d{8}$/.test(raw))return;
  const picker=document.querySelector('#datePicker');if(!picker)return;
  event.preventDefault();event.stopImmediatePropagation();
  picker.value=`${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`;
  picker.dispatchEvent(new Event('change',{bubbles:true}));
  setTimeout(()=>{routeView('schedule',false);renderSelectedDay()},0);
},true);

document.querySelector('#datePicker')?.addEventListener('change',()=>setTimeout(fetchV5Data,0));
document.querySelector('#monthPicker')?.addEventListener('change',()=>setTimeout(()=>{fetchV5Data();renderNationalSchedule()},0));
document.addEventListener('click',e=>{
  if(e.target.closest?.('#prevMonth,#nextMonth,#prevWeek,#nextWeek,#thisWeekBtn,#prevDay,#nextDay,#todayBtn'))setTimeout(fetchV5Data,60);
  if(e.target.closest?.('[data-view="school"]'))setTimeout(renderRankVisibility,0);
  if(e.target.closest?.('[data-view="schedule"],[data-go-view="schedule"]'))setTimeout(()=>{renderSelectedDay();renderNationalSchedule()},0);
});

for(const target of ['#timetable','#calendarGrid','#scheduleGrid','#dashboard'].map(s=>document.querySelector(s)).filter(Boolean)){
  new MutationObserver(()=>requestAnimationFrame(()=>{if(target.id==='timetable')enhanceTimetable();if(target.id==='calendarGrid')decorateCalendar();if(target.id==='scheduleGrid')renderSelectedDay();if(target.id==='dashboard'){applyRoute();renderRankVisibility()}})).observe(target,{childList:true,subtree:true,attributes:target.id==='dashboard',attributeFilter:target.id==='dashboard'?['class']:undefined});
}

syncSystemTheme();simplifyCopy();setTimeout(()=>{applyRoute();fetchV5Data();renderRankVisibility()},0);
