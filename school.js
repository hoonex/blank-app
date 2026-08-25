const EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
const PROFILE_KEY = 'flow-school-profile-v3';
const OLD_PROFILE_KEY = 'flow-school-profile-v2';
const THEME_KEY = 'flow-school-theme-v3';
const OVERRIDE_KEY = 'flow-school-overrides-v2';
const ALLERGY_KEY = 'flow-school-allergies-v1';
const BELL_KEY = 'flow-school-bell-v1';
const MEDIA_PREFIX = 'flow-school-media-v1:';
const CACHE_PREFIX = 'flow-school-cache-v4:';
const RANK_TOTAL_KEY = 'flow-school-rank-total-v1';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const ROUTE_TO_VIEW = {'/home':'today','/week':'week','/schedule':'schedule','/school':'school'};
const VIEW_TO_ROUTE = {today:'/home',week:'/week',schedule:'/schedule',school:'/school'};
const SUBJECT_PRESETS = ['국어','문학','독서','수학','수학Ⅰ','수학Ⅱ','미적분','확률과 통계','영어','영어Ⅰ','영어Ⅱ','한국사','통합사회','통합과학','물리학','화학','생명과학','지구과학','사회·문화','생활과 윤리','윤리와 사상','한국지리','세계지리','경제','정치와 법','정보','인공지능 기초','제2외국어','체육','음악','미술','진로','자율','동아리'];
const ALLERGENS = {1:'난류',2:'우유',3:'메밀',4:'땅콩',5:'대두',6:'밀',7:'고등어',8:'게',9:'새우',10:'돼지고기',11:'복숭아',12:'토마토',13:'아황산류',14:'호두',15:'닭고기',16:'쇠고기',17:'오징어',18:'조개류',19:'잣'};
const CSAT_DATE = new Date(2026,10,19,9);
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

let profile = readJson(PROFILE_KEY,null) || readJson(OLD_PROFILE_KEY,null);
if(profile && !localStorage.getItem(PROFILE_KEY)) writeJson(PROFILE_KEY,profile);
let selectedDate = noon(new Date());
let currentView = ROUTE_TO_VIEW[location.pathname] || 'today';
let data = null;
let dataKey = '';
let media = null;
let editMode = false;
let mealType = null;
let selectedSetupSchool = null;
let selectedSubjectRow = null;
let selectedPreset = '';
let searchResults = [];
let searchTimer = null;
let searchAbort = null;
let dashboardAbort = null;
let toastTimer = null;
let installPrompt = null;
const memoryCache = new Map();
const themeMedia = matchMedia('(prefers-color-scheme: dark)');

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback}}
function writeJson(key,value){localStorage.setItem(key,JSON.stringify(value))}
function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function pad(n){return String(n).padStart(2,'0')}
function noon(d){return new Date(d.getFullYear(),d.getMonth(),d.getDate(),12)}
function ymd(d){return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`}
function isoDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseYmd(v){return new Date(+v.slice(0,4),+v.slice(4,6)-1,+v.slice(6,8),12)}
function koDate(d,long=true){return new Intl.DateTimeFormat('ko-KR',long?{month:'long',day:'numeric',weekday:'short'}:{month:'numeric',day:'numeric'}).format(d)}
function prettyIso(v){const [y,m,d]=String(v||'').split('-').map(Number);return y?new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(y,m-1,d,12)):''}
function shortDay(d){return new Intl.DateTimeFormat('ko-KR',{weekday:'short'}).format(d).replace('요일','')}
function sameDay(a,b){return ymd(a)===ymd(b)}
function fmtDate8(v){return /^\d{8}$/.test(v||'')?`${v.slice(0,4)}.${v.slice(4,6)}.${v.slice(6,8)}`:(v||'—')}
function monthKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}`}
function daysBetween(a,b){return Math.ceil((noon(b)-noon(a))/86400000)}
function weekdayIndex(v){return parseYmd(v).getDay()}
function isHigh(){return !!profile?.school?.kind?.includes('고등')}
function grade(){return Math.max(1,Math.min(6,Number(profile?.grade)||1))}
function weekStart(date=selectedDate){const d=noon(date),day=d.getDay();d.setDate(d.getDate()+(day===0?-6:1-day));return d}
function weekDates(date=selectedDate){const start=weekStart(date);return Array.from({length:5},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d})}
function queryKey(date=selectedDate){if(!profile)return'';return `${profile.school.schoolCode}:${profile.grade}:${profile.className}:${ymd(weekStart(date))}:${monthKey(date)}`}
function cacheStorageKey(key){return `${CACHE_PREFIX}${key}`}

function toast(message){const el=$('#toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1800)}
function loading(on){$('#loadingLine')?.classList.toggle('active',on)}
function openDialog(selector){const dialog=$(selector);if(!dialog)return;document.body.classList.add('dialog-open');dialog.showModal()}
function closeDialog(dialog){dialog?.close();if(!$$('dialog').some(d=>d.open))document.body.classList.remove('dialog-open')}

function currentTheme(){return localStorage.getItem(THEME_KEY)||'light'}
function applyTheme(value=currentTheme()){
  const pref=['light','system','dark'].includes(value)?value:'light';
  const effective=pref==='system'?(themeMedia.matches?'dark':'light'):pref;
  const root=document.documentElement,colorScheme=effective==='dark'?'dark':'only light';
  localStorage.setItem(THEME_KEY,pref);
  root.dataset.theme=effective;
  root.dataset.themeMode=pref;
  root.style.colorScheme=colorScheme;
  document.querySelector('meta[name="color-scheme"]')?.setAttribute('content',colorScheme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',effective==='dark'?'#202833':'#edf2f7');
  $$('#themeSegment [data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===pref));
  if($('#landingThemeBtn'))$('#landingThemeBtn').textContent=pref==='light'?'Light':pref==='dark'?'Dark':'System';
}
function cycleTheme(){const order=['light','system','dark'];applyTheme(order[(order.indexOf(currentTheme())+1)%order.length])}
themeMedia.addEventListener?.('change',()=>{if(currentTheme()==='system')applyTheme('system')});

async function api(params,signal){
  const url=new URL(EDGE);Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))});
  const response=await fetch(url,{signal});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'데이터를 불러오지 못했습니다.');return body;
}

function renderIdentity(){
  if(!profile)return;const name=profile.school.name||'학교';const cls=`${profile.grade}학년 ${profile.className}반`;
  for(const [id,value] of [['#schoolNameTop',name],['#schoolClassTop',cls],['#mobileSchoolName',name],['#mobileClassName',cls],['#heroSchoolName',name],['#heroSchoolMeta',cls]])if($(id))$(id).textContent=value;
  const initial=name.replace(/(초등학교|중학교|고등학교|학교)$/,'').trim().slice(0,1)||'S';
  ['#schoolInitial','#schoolInitialSmall','#profileInitial'].forEach(s=>{if($(s))$(s).textContent=initial});
}
function showLanding(){
  $('#landing')?.classList.remove('hidden');$('#dashboard')?.classList.add('hidden');
  if(location.pathname!=='/')history.replaceState({},'', '/');
}
function showDashboard(){
  $('#landing')?.classList.add('hidden');$('#dashboard')?.classList.remove('hidden');renderIdentity();switchView(currentView,{push:false});
}

function renderSearchResults(target,schools,message='검색 결과가 없습니다.'){
  const box=$(target);if(!box)return;searchResults=Array.isArray(schools)?schools:[];
  if(!searchResults.length){box.innerHTML=`<div class="search-state">${esc(message)}</div>`;box.classList.remove('hidden');return}
  box.innerHTML=searchResults.map((s,i)=>`<button class="result-btn" type="button" data-result-index="${i}"><span><span class="result-name">${esc(s.name)}</span><span class="result-meta">${esc(s.officeName)} · ${esc(s.address||s.location||s.kind||'')}</span></span><span class="result-kind">${esc(s.highSchoolType||s.kind||'학교')}</span></button>`).join('');
  box.classList.remove('hidden');box.querySelectorAll('[data-result-index]').forEach(btn=>btn.addEventListener('click',()=>chooseSchool(searchResults[Number(btn.dataset.resultIndex)])));
}
async function runSearch(inputSelector,resultSelector){
  const input=$(inputSelector),box=$(resultSelector);if(!input||!box)return;const q=input.value.trim();if(q.length<2){box.classList.add('hidden');box.innerHTML='';return}
  searchAbort?.abort();searchAbort=new AbortController();box.classList.remove('hidden');box.innerHTML='<div class="search-state">학교 찾는 중…</div>';
  try{const result=await api({action:'search',q},searchAbort.signal);renderSearchResults(resultSelector,result.schools)}catch(error){if(error.name!=='AbortError')renderSearchResults(resultSelector,[],error.message||'검색에 실패했습니다.')}
}
function debounceSearch(inputSelector,resultSelector){clearTimeout(searchTimer);searchTimer=setTimeout(()=>runSearch(inputSelector,resultSelector),220)}
function gradeCount(kind=''){return kind.includes('초등')?6:3}
async function chooseSchool(school){
  if(!school)return;selectedSetupSchool=school;$('#schoolResults')?.classList.add('hidden');$('#switchResults')?.classList.add('hidden');if($('#switchDialog')?.open)closeDialog($('#switchDialog'));
  $('#setupSchoolName').textContent=`${school.name} · ${school.officeName}`;
  $('#gradeRow').innerHTML=Array.from({length:gradeCount(school.kind)},(_,i)=>`<button class="choice-chip${i===0?' active':''}" data-grade="${i+1}" type="button">${i+1}학년</button>`).join('');
  $$('#gradeRow [data-grade]').forEach(btn=>btn.addEventListener('click',()=>{$$('#gradeRow [data-grade]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');loadClassChoices()}));
  openDialog('#setupDialog');await loadClassChoices();
}
async function loadClassChoices(){
  if(!selectedSetupSchool)return;const gradeValue=Number($('#gradeRow [data-grade].active')?.dataset.grade||1),box=$('#classRow');box.innerHTML='<span class="loading-copy">반 정보 불러오는 중</span>';$('#manualClassWrap').classList.add('hidden');
  try{const result=await api({action:'classes',office:selectedSetupSchool.officeCode,school:selectedSetupSchool.schoolCode,grade:gradeValue});const classes=result.classes||[];if(!classes.length)throw new Error('no classes');box.innerHTML=classes.map((c,i)=>`<button class="choice-chip${i===0?' active':''}" data-class="${esc(c)}" type="button">${esc(c)}반</button>`).join('');$$('#classRow [data-class]').forEach(btn=>btn.addEventListener('click',()=>{$$('#classRow [data-class]').forEach(x=>x.classList.remove('active'));btn.classList.add('active')}))}catch{box.innerHTML='';$('#manualClassWrap').classList.remove('hidden')}
}
function saveSetup(){
  if(!selectedSetupSchool)return;const gradeValue=Number($('#gradeRow [data-grade].active')?.dataset.grade||1);const className=$('#classRow [data-class].active')?.dataset.class||$('#classInput').value.trim()||'1';
  profile={school:selectedSetupSchool,grade:gradeValue,className};writeJson(PROFILE_KEY,profile);localStorage.removeItem(OLD_PROFILE_KEY);closeDialog($('#setupDialog'));selectedDate=noon(new Date());data=null;dataKey='';memoryCache.clear();currentView='today';showDashboard();loadDashboard();loadMedia();
}
function openSwitch(){if(!profile)return;$('#currentSchoolMeta').textContent=`${profile.school.name} · ${profile.grade}학년 ${profile.className}반`;$('#switchSearch').value='';$('#switchResults').classList.add('hidden');openDialog('#switchDialog');setTimeout(()=>$('#switchSearch')?.focus(),80)}
function reselectClass(){if(!profile)return;selectedSetupSchool=profile.school;closeDialog($('#switchDialog'));chooseSchool(profile.school)}
function clearProfile(){localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(OLD_PROFILE_KEY);profile=null;data=null;dataKey='';memoryCache.clear();closeDialog($('#switchDialog'));showLanding()}

function saveCache(key,payload){memoryCache.set(key,payload);try{writeJson(cacheStorageKey(key),{at:Date.now(),payload})}catch{}}
function loadCache(key){if(memoryCache.has(key))return memoryCache.get(key);const cached=readJson(cacheStorageKey(key),null);if(cached?.payload){memoryCache.set(key,cached.payload);return cached.payload}return null}
async function loadDashboard({force=false}={}){
  if(!profile)return;const key=queryKey();if(!force){const cached=loadCache(key);if(cached){data=cached;dataKey=key;renderActiveView();return}}
  dashboardAbort?.abort();dashboardAbort=new AbortController();loading(true);$('#errorBox')?.classList.add('hidden');
  try{
    const result=await api({action:'dashboard',office:profile.school.officeCode,school:profile.school.schoolCode,grade:profile.grade,class:profile.className,kind:profile.school.kind,date:ymd(selectedDate)},dashboardAbort.signal);
    data=result;dataKey=key;if(data.school){profile.school={...profile.school,...data.school};writeJson(PROFILE_KEY,profile)}saveCache(key,data);renderActiveView();
  }catch(error){if(error.name==='AbortError')return;const cached=loadCache(key);data=cached||{school:profile.school,timetable:[],meals:[],events:[]};dataKey=key;renderActiveView();if($('#errorBox')){$('#errorBox').textContent=cached?'새 데이터를 불러오지 못해 마지막 저장 정보를 표시합니다.':(error.message||'학교 정보를 불러오지 못했습니다.');$('#errorBox').classList.remove('hidden')}}finally{loading(false)}
}
function ensureDataFor(date,{force=false}={}){selectedDate=noon(date);const key=queryKey();if(!force&&data&&dataKey===key){renderActiveView();return}loadDashboard({force})}

async function loadMedia(){
  if(!profile)return;const key=MEDIA_PREFIX+profile.school.schoolCode;const cached=readJson(key,null);if(cached){media=cached;renderMedia();return}
  try{const result=await api({action:'media',office:profile.school.officeCode,school:profile.school.schoolCode});media=result.media||{};writeJson(key,media);renderMedia()}catch{media={};renderMedia()}
}
function setImage(id,url){const img=$(id);if(!img)return;img.classList.remove('loaded');img.removeAttribute('src');if(!url)return;img.onload=()=>img.classList.add('loaded');img.onerror=()=>img.classList.remove('loaded');img.src=url}
function setBackground(id,url){const el=$(id);if(!el)return;el.classList.toggle('has-image',!!url);el.style.backgroundImage=url?`url("${String(url).replace(/"/g,'%22')}")`:''}
function renderMedia(){const hero=media?.hero||'',logo=media?.logo||'';setBackground('#schoolHeroImage',hero);setBackground('#profilePhoto',hero);setImage('#schoolLogo',logo);setImage('#schoolLogoSmall',logo);setImage('#profileLogo',logo)}

function gradeEventApplies(event){const flag=event?.[`grade${grade()}`];const flags=[1,2,3,4,5,6].map(n=>event?.[`grade${n}`]).filter(Boolean);if(flag==='Y'||!flag)return true;if(flags.length&&flags.every(v=>v!=='Y'))return true;return false}
function monthEvents(){return (data?.events||[]).filter(gradeEventApplies).sort((a,b)=>String(a.date).localeCompare(String(b.date)))}
function eventsOn(date=selectedDate){const key=ymd(date);return monthEvents().filter(e=>e.date===key)}
function nextEvents(){const today=ymd(new Date());return monthEvents().filter(e=>e.date>=today).slice(0,5)}
function nextEventText(){const e=nextEvents()[0];if(!e)return'예정 없음';const diff=daysBetween(new Date(),parseYmd(e.date));return diff<=0?e.name:`D-${diff} ${e.name}`}
function nationalFor(){return isHigh()?NATIONAL_2026.filter(e=>e.grades.includes(grade())):[]}
function nationalOn(date=selectedDate){return nationalFor().filter(e=>e.date===isoDate(date))}
function rawRowsForDate(date=selectedDate){return (data?.timetable||[]).filter(x=>x.date===ymd(date)).sort((a,b)=>Number(a.period)-Number(b.period))}
function maxPeriodWeek(date=selectedDate){const dates=new Set(weekDates(date).map(ymd));return Math.max(0,...(data?.timetable||[]).filter(r=>dates.has(r.date)).map(r=>Number(r.period)||0))}
function specialEvent(date=selectedDate){return eventsOn(date).find(e=>/(공휴일|휴업|방학|개교기념|재량휴업|졸업|입학)/.test(e.name||''))||null}
function specialRowsLabel(rows){const names=rows.map(r=>String(r.subject||'').trim()).filter(Boolean);if(!names.length)return'';const specials=names.filter(n=>/(공휴일|휴업|방학|개교기념|재량휴업)/.test(n));if(specials.length!==names.length)return'';const counts=new Map();for(const n of specials)counts.set(n,(counts.get(n)||0)+1);return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0]?.[0]||''}
function dayRows(date=selectedDate){const rows=rawRowsForDate(date);if(!rows.length)return[];const max=Math.max(...rows.map(r=>Number(r.period)||0),maxPeriodWeek(date));return Array.from({length:max},(_,i)=>rows.find(r=>Number(r.period)===i+1)||{date:ymd(date),period:i+1,subject:'',synthetic:true})}
function overrideMap(){return readJson(OVERRIDE_KEY,{})}
function overrideId(row){return `${profile?.school?.schoolCode||''}:${profile?.grade||''}:${profile?.className||''}:${weekdayIndex(row.date)}:${row.period}`}
function subjectFor(row){const overridden=overrideMap()[overrideId(row)];if(overridden)return overridden;if(String(row.subject||'').trim())return row.subject;return isHigh()?'선택과목':'—'}
function setSubjectOverride(row,subject){const all=overrideMap(),id=overrideId(row),clean=String(subject||'').trim();if(!clean||clean===row.subject)delete all[id];else all[id]=clean;writeJson(OVERRIDE_KEY,all)}

function renderHero(){
  renderIdentity();const today=sameDay(selectedDate,new Date());$('#heroEyebrow').textContent=today?'TODAY':'SELECTED DATE';$('#heroDate').textContent=today?'오늘':koDate(selectedDate,false);$('#dateTitle').textContent=koDate(selectedDate);$('#datePicker').value=isoDate(selectedDate);
  const raw=rawRowsForDate(),rows=dayRows(),special=specialRowsLabel(raw)||specialEvent()?.name||'',meals=(data?.meals||[]).filter(x=>x.date===ymd(selectedDate));
  $('#quickLessons').textContent=special?'—':rows.length?`${rows.length}교시`:'—';$('#quickLessonSub').textContent=special||(rows[0]?subjectFor(rows[0]):'시간표 없음');
  const lunch=bellConfig().meal||'12:20';$('#quickMeal').textContent=meals.length?meals.map(m=>m.type).join(' · '):'급식 없음';$('#quickMealSub').textContent=meals.length?[lunch,meals[0]?.calories].filter(Boolean).join(' · '):'오늘 제공 없음';$('#quickEvent').textContent=nextEventText();$('#quickEventSub').textContent=nextEvents()[0]?fmtDate8(nextEvents()[0].date):'등록된 일정 없음';
  const diff=daysBetween(new Date(),CSAT_DATE);$('#csatDday').textContent=diff>=0?`D-${diff}`:'종료';renderClock();
}
function renderDayStrip(){const days=weekDates();$('#dayStrip').innerHTML=days.map(d=>`<button class="day-chip${sameDay(d,selectedDate)?' active':''}" data-date="${ymd(d)}" type="button"><span>${shortDay(d)}</span><strong>${d.getDate()}</strong></button>`).join('');$$('#dayStrip [data-date]').forEach(btn=>btn.addEventListener('click',()=>ensureDataFor(parseYmd(btn.dataset.date))))}
function renderTimetable(){
  const raw=rawRowsForDate(),box=$('#timetable'),special=specialRowsLabel(raw)||(!raw.length?specialEvent()?.name:'');box.classList.toggle('editing',editMode);$('#editSubjectsBtn').hidden=!isHigh();$('#editSubjectsBtn').classList.toggle('active',editMode);$('#editSubjectsBtn').textContent=editMode?'편집 끝내기':'과목 편집';
  const desc=$('.timetable-card .card-heading p');if(desc)desc.textContent=isHigh()?'공개 시간표의 빈 교시는 필요한 경우 직접 수정할 수 있습니다.':'NEIS에 공개된 시간표를 표시합니다.';
  if(special){box.innerHTML=`<div class="timetable-state"><strong>${esc(special)}</strong><span>학사일정</span></div>`;return}
  const rows=dayRows();if(!rows.length){box.innerHTML='<div class="timetable-state"><strong>—</strong><span>공개된 시간표가 없습니다.</span></div>';return}
  box.innerHTML=rows.map(row=>{const shown=subjectFor(row),changed=shown!==(row.subject||''),elective=shown==='선택과목';return `<button class="period-button" type="button" data-period="${row.period}"><span class="period-no">${row.period}</span><span><span class="period-name${elective?' elective':''}${shown==='—'?' is-empty':''}">${esc(shown)}</span>${editMode&&isHigh()?'<span class="period-edit-hint">눌러서 변경</span>':''}</span><span class="period-origin">${changed&&row.subject?`NEIS ${esc(row.subject)}`:''}</span></button>`}).join('');
  $$('#timetable [data-period]').forEach(btn=>btn.addEventListener('click',()=>{if(!editMode||!isHigh())return;const row=rows.find(r=>String(r.period)===btn.dataset.period);openSubjectDialog(row)}));
}
function openSubjectDialog(row){selectedSubjectRow=row;selectedPreset=subjectFor(row);$('#subjectDialogTitle').textContent=`${shortDay(parseYmd(row.date))}요일 ${row.period}교시`;$('#customSubjectInput').value=selectedPreset==='선택과목'?'':selectedPreset;renderSubjectPresets();openDialog('#subjectDialog')}
function renderSubjectPresets(){$('#subjectPresets').innerHTML=SUBJECT_PRESETS.map(s=>`<button class="subject-chip${s===selectedPreset?' selected':''}" data-subject="${esc(s)}" type="button">${esc(s)}</button>`).join('');$$('#subjectPresets [data-subject]').forEach(btn=>btn.addEventListener('click',()=>{selectedPreset=btn.dataset.subject;$('#customSubjectInput').value=selectedPreset;renderSubjectPresets()}))}
function saveSubject(){if(!selectedSubjectRow)return;const value=$('#customSubjectInput').value.trim()||selectedPreset||'선택과목';setSubjectOverride(selectedSubjectRow,value);closeDialog($('#subjectDialog'));renderActiveView();toast('과목을 저장했습니다.')}
function resetSubject(){if(!selectedSubjectRow)return;setSubjectOverride(selectedSubjectRow,'');closeDialog($('#subjectDialog'));renderActiveView();toast('NEIS 시간표로 되돌렸습니다.')}

function selectedMeals(){return (data?.meals||[]).filter(x=>x.date===ymd(selectedDate))}
function allergies(){return new Set(readJson(ALLERGY_KEY,[]).map(Number))}
function allergenIds(raw=''){const ids=[];for(const m of String(raw).matchAll(/\((\d+(?:\.\d+)*)\.?\)/g))m[1].split('.').map(Number).filter(n=>n>=1&&n<=19).forEach(n=>ids.push(n));return[...new Set(ids)]}
function dishName(raw=''){return String(raw).replace(/\((\d+(?:\.\d+)*)\.?\)/g,'').replace(/\s+/g,' ').trim()}
function activeMeal(){const meals=selectedMeals();if(!mealType||!meals.some(m=>m.type===mealType))mealType=meals[0]?.type||null;return meals.find(m=>m.type===mealType)||meals[0]||null}
function stripBr(v=''){return String(v).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').trim()}
function renderMeals(){
  const meals=selectedMeals(),tabs=$('#mealTabs'),list=$('#mealList'),cal=$('#mealCal');if(!meals.length){tabs.innerHTML='';list.innerHTML='<div class="empty">이 날짜에는 급식 정보가 없습니다.</div>';cal.textContent='';$('#mealDetailBtn').classList.add('hidden');$('#mealDetails').classList.add('hidden');return}
  const meal=activeMeal();tabs.innerHTML=meals.map(m=>`<button class="meal-tab${m.type===meal.type?' active':''}" data-type="${esc(m.type)}" type="button">${esc(m.type)}</button>`).join('');$$('#mealTabs [data-type]').forEach(btn=>btn.addEventListener('click',()=>{mealType=btn.dataset.type;$('#mealDetails').classList.add('hidden');renderMeals()}));
  const selected=allergies();list.innerHTML=meal.dishes.map(raw=>{const ids=allergenIds(raw),hits=ids.filter(id=>selected.has(id)),warning=hits.map(id=>ALLERGENS[id]).join(', ');return `<button class="dish${hits.length?' risk':''}" type="button" data-dish="${esc(dishName(raw))}"><strong>${esc(dishName(raw))}</strong>${hits.length?`<small>주의 · ${esc(warning)}</small>`:''}</button>`}).join('');
  $$('#mealList [data-dish]').forEach(btn=>btn.addEventListener('click',()=>window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${btn.dataset.dish} 음식`)}`,'_blank','noopener,noreferrer')));
  const lunch=bellConfig().meal||'12:20';cal.textContent=[`급식 ${lunch}`,meal.calories?`총 ${meal.calories}`:'NEIS 급식 데이터'].join(' · ');$('#mealDetailBtn').classList.remove('hidden');$('#mealDetails').textContent=`영양정보\n${stripBr(meal.nutrition)||'정보 없음'}\n\n원산지\n${stripBr(meal.origin)||'정보 없음'}`;
}
function renderAllergyGrid(){const selected=allergies();$('#allergyGrid').innerHTML=Object.entries(ALLERGENS).map(([id,name])=>`<button class="allergy-chip${selected.has(Number(id))?' selected':''}" data-allergy="${id}" type="button">${id}. ${name}</button>`).join('');$$('#allergyGrid [data-allergy]').forEach(btn=>btn.addEventListener('click',()=>btn.classList.toggle('selected')))}
function saveAllergies(){writeJson(ALLERGY_KEY,$$('#allergyGrid .selected').map(x=>Number(x.dataset.allergy)));closeDialog($('#allergyDialog'));renderMeals();toast('알레르기 표시를 저장했습니다.')}
function renderEvents(){const events=nextEvents();$('#eventList').innerHTML=events.length?events.map(e=>{const d=parseYmd(e.date);return `<div class="event"><div class="event-date"><strong>${d.getDate()}</strong><span>${d.getMonth()+1}월</span></div><div><div class="event-name">${esc(e.name)}</div>${e.content?`<div class="event-content">${esc(e.content)}</div>`:''}</div></div>`}).join(''):'<div class="empty">이번 달 남은 학사일정이 없습니다.</div>'}

function renderToday(){renderHero();renderDayStrip();renderTimetable();renderMeals();renderEvents();renderMedia()}
function renderWeek(){
  const days=weekDates(),max=maxPeriodWeek();$('#weekRangeText').textContent=`${koDate(days[0],false)} – ${koDate(days[4],false)} · ${profile.school.name}`;if(!max){$('#weekTable').innerHTML='<div class="empty">이번 주 시간표가 없습니다.</div>';return}
  const cells=['<div class="week-cell week-head">교시</div>',...days.map(d=>`<div class="week-cell week-head">${shortDay(d)} ${d.getDate()}</div>` )];
  const dayMeta=days.map(d=>{const raw=rawRowsForDate(d);return{raw,special:specialRowsLabel(raw)||(!raw.length?specialEvent(d)?.name:'')}});
  for(let p=1;p<=max;p++){
    cells.push(`<div class="week-cell week-period">${p}</div>`);
    days.forEach((d,i)=>{const meta=dayMeta[i];let subject='—';if(meta.special)subject=p===1?meta.special:'—';else if(meta.raw.length){const raw=meta.raw.find(r=>Number(r.period)===p),row=raw||{date:ymd(d),period:p,subject:'',synthetic:true};subject=subjectFor(row)}cells.push(`<div class="week-cell"><div class="week-subject${subject==='선택과목'?' elective':''}${subject==='—'?' is-empty':''}">${esc(subject)}</div></div>`)})
  }
  $('#weekTable').innerHTML=cells.join('');
}

function ensureSelectedDayPanel(){const grid=$('#scheduleGrid');if(!grid)return null;let panel=$('#selectedDayPanel');if(!panel){panel=document.createElement('div');panel.id='selectedDayPanel';panel.className='selected-day-panel';grid.before(panel)}return panel}
function renderSelectedDay(){const panel=ensureSelectedDayPanel();if(!panel)return;const school=eventsOn(),national=nationalOn();panel.replaceChildren();const date=document.createElement('div');date.className='selected-day-date';date.textContent=koDate(selectedDate);const title=document.createElement('div');title.className='selected-day-title';title.textContent=(school.length||national.length)?'선택한 날짜':'이날 일정 없음';panel.append(date,title);if(school.length||national.length){const items=document.createElement('div');items.className='selected-day-items';for(const [source,event] of [...school.map(e=>['학교',e]),...national.map(e=>['전국',e])]){const item=document.createElement('div');item.className='selected-day-item';item.innerHTML=`<span class="source-pill">${source}</span><b>${esc(event.name)}</b>`;items.append(item)}panel.append(items)}}
function renderCalendar(){
  const d=noon(selectedDate),first=new Date(d.getFullYear(),d.getMonth(),1,12),start=new Date(first);start.setDate(first.getDate()-first.getDay());const weekdays=['일','월','화','수','목','금','토'];const cells=weekdays.map(x=>`<div class="calendar-weekday">${x}</div>`),eventMap=new Map();monthEvents().forEach(e=>{if(!eventMap.has(e.date))eventMap.set(e.date,[]);eventMap.get(e.date).push(e)});nationalFor().filter(e=>e.date.startsWith(monthKey(d))).forEach(e=>{const key=e.date.replaceAll('-','');if(!eventMap.has(key))eventMap.set(key,[]);eventMap.get(key).push(e)});
  for(let i=0;i<42;i++){const day=new Date(start);day.setDate(start.getDate()+i);const key=ymd(day),events=eventMap.get(key)||[];cells.push(`<button class="calendar-day${day.getMonth()!==d.getMonth()?' outside':''}${sameDay(day,new Date())?' today':''}${sameDay(day,selectedDate)?' selected':''}" type="button" data-calendar-date="${key}"><strong>${day.getDate()}</strong>${events.length?'<span class="calendar-dot"></span>':''}${events[0]?`<span class="calendar-event-label">${esc(events[0].name)}</span>`:''}</button>`)}
  $('#calendarMonthTitle').textContent=`${d.getFullYear()}년 ${d.getMonth()+1}월`;$('#monthPicker').value=monthKey(d);$('#calendarGrid').innerHTML=cells.join('');$$('[data-calendar-date]').forEach(btn=>btn.addEventListener('click',()=>{const next=parseYmd(btn.dataset.calendarDate);const changed=monthKey(next)!==monthKey(selectedDate);selectedDate=next;if(changed)loadDashboard();else renderSchedule()}));
}
function ensureNationalCard(){let card=$('#nationalScheduleCard');if(card)return card;const layout=$('.schedule-layout');if(!layout)return null;card=document.createElement('section');card.id='nationalScheduleCard';card.className='national-schedule-card';layout.after(card);return card}
function renderNationalSchedule(){const card=ensureNationalCard();if(!card)return;if(!isHigh()){card.hidden=true;return}card.hidden=false;const events=nationalFor().filter(e=>e.date.startsWith(monthKey(selectedDate)));card.innerHTML=`<div class="national-schedule-head"><div><span class="section-kicker">HIGH SCHOOL</span><h2>전국 시험 일정</h2></div></div><div class="national-schedule-list">${events.length?events.map(e=>`<a class="national-event" href="${esc(e.source)}" target="_blank" rel="noopener noreferrer"><time>${e.date.slice(5).replace('-','.')}</time><strong>${esc(e.name)}</strong><small>${esc(e.org)}</small></a>`).join(''):'<div class="empty">이번 달 전국 단위 시험 일정이 없습니다.</div>'}</div>`}
function renderSchedule(){
  const rows=monthEvents();$('#scheduleGrid').innerHTML=rows.length?rows.map(e=>`<div class="schedule-row${e.date===ymd(selectedDate)?' selected-event':''}"><time>${fmtDate8(e.date)}</time><strong>${esc(e.name)}</strong>${e.content?`<p>${esc(e.content)}</p>`:''}</div>`).join(''):'<div class="empty">이번 달 학사일정이 없습니다.</div>';renderCalendar();renderSelectedDay();renderNationalSchedule();
}

function normalizeUrl(v=''){if(!v)return'';return/^https?:\/\//i.test(v)?v:`https://${v}`}
function ensureRankCard(){let card=$('#rankCard');if(card)return card;const info=$('#schoolInfoGrid');if(!info)return null;card=document.createElement('section');card.id='rankCard';card.className='rank-card';card.innerHTML='<span class="section-kicker">RANK</span><h2>석차 계산</h2><p>수강자수와 석차를 넣으면 상위 비율과 5등급 구간을 계산합니다.</p><div class="rank-grid"><label class="rank-field">수강자수<input id="rankTotal" type="number" min="1" inputmode="numeric" placeholder="예: 240"></label><label class="rank-field">석차<input id="rankValue" type="number" min="1" inputmode="numeric" placeholder="예: 23"></label></div><div class="rank-result"><strong id="rankMain">값을 입력하세요</strong><span id="rankSub">수강자수 기준</span></div>';info.after(card);const saved=Number(localStorage.getItem(RANK_TOTAL_KEY)||0);if(saved)$('#rankTotal').value=String(saved);card.querySelectorAll('input').forEach(input=>input.addEventListener('input',renderRank));return card}
function renderRank(){const total=Number($('#rankTotal')?.value||0),rank=Number($('#rankValue')?.value||0),main=$('#rankMain'),sub=$('#rankSub');if(!main||!sub)return;if(total>0)localStorage.setItem(RANK_TOTAL_KEY,String(total));if(!(total>0&&rank>0&&rank<=total)){main.textContent='값을 입력하세요';sub.textContent='수강자수 기준';return}const pct=rank/total*100,g=pct<=10?1:pct<=34?2:pct<=66?3:pct<=90?4:5;main.textContent=`상위 ${pct.toFixed(pct<10?1:0)}% · ${g}등급 구간`;sub.textContent=`${rank} / ${total}명`}
function renderSchoolInfo(){
  const s={...(profile?.school||{}),...(data?.school||{})};if(!s.name)return;$('#profileName').textContent=s.name||'학교';$('#profileKind').textContent=[s.kind,s.highSchoolType].filter(Boolean).join(' · ')||'학교';$('#profileEnglishName').textContent=s.englishName||[s.officeName,s.location].filter(Boolean).join(' · ');
  const entries=[['설립구분',s.type],['학교 구분',s.highSchoolType||s.kind],['남녀 구분',s.coed],['주야',s.dayNight],['설립일',s.founded?fmtDate8(s.founded):''],['개교기념일',s.anniversary?fmtDate8(s.anniversary):''],['교육청',s.officeName],['관할기관',s.jurisdiction],['지역',s.location],['주소',[s.address,s.addressDetail].filter(Boolean).join(' ')],['전화',s.phone],['팩스',s.fax],['계열',s.highSchoolTrack||s.specialPurpose]];const visible=entries.filter(([,v])=>String(v||'').trim());$('#schoolInfoGrid').innerHTML=visible.length?visible.map(([k,v])=>`<div class="info-tile"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join(''):'<div class="info-tile info-tile-empty"><span>학교 정보</span><strong>공개된 기본정보가 없습니다.</strong></div>';
  const status=$('#schoolInfoStatus');if(status)status.textContent=visible.length>=6?`NEIS 학교기본정보 ${visible.length}개 항목을 표시 중입니다.`:`NEIS에서 공개된 학교기본정보 ${visible.length}개 항목만 표시됩니다.`;
  const home=normalizeUrl(s.homepage);$('#homepageLink').href=home||'#';$('#homepageLink').classList.toggle('hidden',!home);$('#mapLink').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address||s.name)}`;$('#phoneLink').href=s.phone?`tel:${s.phone.replace(/[^\d+]/g,'')}`:'#';$('#phoneLink').classList.toggle('hidden',!s.phone);const rankCard=ensureRankCard();if(rankCard)rankCard.hidden=!isHigh();renderRank();renderMedia();
}

function bellDefaults(){const kind=profile?.school?.kind||'';if(kind.includes('초등'))return{start:'09:00',lesson:40,break:10,meal:'12:10'};if(kind.includes('중학'))return{start:'09:00',lesson:45,break:10,meal:'12:20'};return{start:'08:30',lesson:50,break:10,meal:'12:20'}}
function bellConfig(){return{...bellDefaults(),...readJson(BELL_KEY,{})}}
function renderClock(){
  if(!profile||currentView!=='today')return;const now=new Date(),rows=dayRows(now),cfg=bellConfig(),[h,m]=String(cfg.start).split(':').map(Number),start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),h||8,m||30),lesson=Number(cfg.lesson)||50,brk=Number(cfg.break)||10,total=lesson+brk,mins=(now-start)/60000,lessons=rows.length||Math.max(maxPeriodWeek(now),7);let title='수업 전',caption=`1교시 ${cfg.start} 시작`,progress=0;
  if(now.getDay()===0||now.getDay()===6){title='주말';caption='오늘은 정규 수업이 없습니다.'}else if(mins<0){caption=`1교시까지 ${Math.max(1,Math.ceil(-mins))}분`}else{const idx=Math.floor(mins/total),inside=mins-idx*total;if(idx>=lessons){title='오늘 수업 종료';caption='오늘도 수고했어요.';progress=100}else if(inside<lesson){title=`${idx+1}교시 수업 중`;const row=rows.find(r=>Number(r.period)===idx+1);caption=row?`${subjectFor(row)} · ${Math.ceil(lesson-inside)}분 남음`:`${Math.ceil(lesson-inside)}분 남음`;progress=Math.max(0,Math.min(100,inside/lesson*100))}else{title=`${idx+1}교시 후 쉬는 시간`;caption=`다음 수업까지 ${Math.ceil(total-inside)}분`;progress=100}}
  $('#clockTitle').textContent=title;$('#clockCaption').textContent=`${caption} · 예상 타종`;$('#clockProgress').style.width=`${progress}%`;
}
function renderSettings(){const cfg=bellConfig();$('#bellStart').value=cfg.start;$('#lessonMinutes').value=cfg.lesson;$('#breakMinutes').value=cfg.break;if($('#mealStart'))$('#mealStart').value=cfg.meal||'12:20';applyTheme()}
function saveSettings(){writeJson(BELL_KEY,{start:$('#bellStart').value||'08:30',lesson:Math.max(30,Math.min(90,Number($('#lessonMinutes').value)||50)),break:Math.max(5,Math.min(30,Number($('#breakMinutes').value)||10)),meal:$('#mealStart')?.value||'12:20'});closeDialog($('#settingsDialog'));renderActiveView();toast('설정을 저장했습니다.')}

function renderActiveView(){
  if(!profile)return;renderIdentity();if(currentView==='today')renderToday();else if(currentView==='week')renderWeek();else if(currentView==='schedule')renderSchedule();else if(currentView==='school')renderSchoolInfo();
}
function switchView(view,{push=true}={}){
  if(!VIEW_TO_ROUTE[view])view='today';currentView=view;$$('[data-view-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.viewPanel!==view));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(push&&location.pathname!==VIEW_TO_ROUTE[view])history.pushState({view},'',VIEW_TO_ROUTE[view]);renderActiveView();
}
window.addEventListener('popstate',()=>switchView(ROUTE_TO_VIEW[location.pathname]||'today',{push:false}));

function shiftDay(delta){const d=noon(selectedDate);d.setDate(d.getDate()+delta);ensureDataFor(d)}
function shiftWeek(delta){const d=noon(selectedDate);d.setDate(d.getDate()+delta*7);ensureDataFor(d)}
function shiftMonth(delta){const d=noon(selectedDate);d.setDate(1);d.setMonth(d.getMonth()+delta);ensureDataFor(d)}

function ensureShareButton(){const heading=$('.timetable-card .card-heading');if(!heading||$('#shareTimetableBtn'))return;const edit=$('#editSubjectsBtn'),actions=document.createElement('div');actions.className='timetable-actions';actions.style.cssText='display:flex;gap:8px;align-items:center';const share=document.createElement('button');share.id='shareTimetableBtn';share.type='button';share.className='neo-button compact';share.textContent='공유';share.addEventListener('click',shareTimetable);if(edit){edit.replaceWith(actions);actions.append(share,edit)}else{actions.append(share);heading.append(actions)}}
async function shareTimetable(){const rows=dayRows(),body=rows.length?rows.map(r=>`${r.period}교시 ${subjectFor(r)}`).join('\n'):(specialEvent()?.name||'시간표 정보 없음'),text=`${profile.school.name} · ${profile.grade}학년 ${profile.className}반\n${koDate(selectedDate)}\n\n${body}\n\nFlow School · ${location.origin}/home`;try{if(navigator.share)await navigator.share({title:'오늘 시간표',text});else{await navigator.clipboard.writeText(text);toast('시간표를 복사했습니다.')}}catch(error){if(error?.name!=='AbortError')toast('공유하지 못했습니다.')}}

function bind(){
  applyTheme();ensureShareButton();
  $('#landingThemeBtn')?.addEventListener('click',cycleTheme);
  $('#schoolSearch')?.addEventListener('input',()=>debounceSearch('#schoolSearch','#schoolResults'));$('#schoolSearchBtn')?.addEventListener('click',()=>runSearch('#schoolSearch','#schoolResults'));$('#schoolSearch')?.addEventListener('keydown',e=>{if(e.key==='Enter')runSearch('#schoolSearch','#schoolResults')});$('#switchSearch')?.addEventListener('input',()=>debounceSearch('#switchSearch','#switchResults'));
  $('#schoolBtn')?.addEventListener('click',openSwitch);$('#mobileSchoolBtn')?.addEventListener('click',openSwitch);$('#reselectClassBtn')?.addEventListener('click',reselectClass);$('#changeSchoolBtn')?.addEventListener('click',clearProfile);$('#setupSave')?.addEventListener('click',saveSetup);
  $('#prevDay')?.addEventListener('click',()=>shiftDay(-1));$('#nextDay')?.addEventListener('click',()=>shiftDay(1));$('#todayBtn')?.addEventListener('click',()=>ensureDataFor(new Date()));$('#dateTitle')?.addEventListener('click',()=>$('#datePicker')?.showPicker?.());$('#datePicker')?.addEventListener('change',()=>{if(!$('#datePicker').value)return;const[y,m,d]=$('#datePicker').value.split('-').map(Number);ensureDataFor(new Date(y,m-1,d,12))});
  $('#editSubjectsBtn')?.addEventListener('click',()=>{editMode=!editMode;renderTimetable()});$('#saveSubjectBtn')?.addEventListener('click',saveSubject);$('#resetSubjectBtn')?.addEventListener('click',resetSubject);$('#customSubjectInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveSubject()}});
  $('#allergyBtn')?.addEventListener('click',()=>{renderAllergyGrid();openDialog('#allergyDialog')});$('#saveAllergyBtn')?.addEventListener('click',saveAllergies);$('#mealDetailBtn')?.addEventListener('click',()=>$('#mealDetails').classList.toggle('hidden'));
  $('#prevWeek')?.addEventListener('click',()=>shiftWeek(-1));$('#nextWeek')?.addEventListener('click',()=>shiftWeek(1));$('#thisWeekBtn')?.addEventListener('click',()=>ensureDataFor(new Date()));
  $('#prevMonth')?.addEventListener('click',()=>shiftMonth(-1));$('#nextMonth')?.addEventListener('click',()=>shiftMonth(1));$('#monthPicker')?.addEventListener('change',()=>{if(!$('#monthPicker').value)return;const[y,m]=$('#monthPicker').value.split('-').map(Number);ensureDataFor(new Date(y,m-1,1,12))});
  $$('[data-view]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));$$('[data-go-view]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.goView)));
  $('#settingsBtn')?.addEventListener('click',()=>{renderSettings();openDialog('#settingsDialog')});$('#mobileSettingsBtn')?.addEventListener('click',()=>{renderSettings();openDialog('#settingsDialog')});$('#saveSettingsBtn')?.addEventListener('click',saveSettings);$$('[data-theme-choice]').forEach(btn=>btn.addEventListener('click',()=>applyTheme(btn.dataset.themeChoice)));
  $$('.dialog-close').forEach(btn=>btn.addEventListener('click',()=>closeDialog(btn.closest('dialog'))));$$('dialog').forEach(dialog=>{dialog.addEventListener('close',()=>{if(!$$('dialog').some(d=>d.open))document.body.classList.remove('dialog-open')});dialog.addEventListener('cancel',()=>setTimeout(()=>{if(!$$('dialog').some(d=>d.open))document.body.classList.remove('dialog-open')},0))});
  $('#installBtn')?.addEventListener('click',async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null}else toast('브라우저 메뉴에서 홈 화면에 추가할 수 있습니다.')});window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
}

if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
bind();
setInterval(renderClock,30000);
if(profile){showDashboard();loadDashboard();loadMedia()}else showLanding();
