const EDGE = 'https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
const PROFILE_KEY = 'flow-school-profile-v3';
const OLD_PROFILE_KEY = 'flow-school-profile-v2';
const THEME_KEY = 'flow-school-theme-v3';
const OVERRIDE_KEY = 'flow-school-overrides-v2';
const ALLERGY_KEY = 'flow-school-allergies-v1';
const BELL_KEY = 'flow-school-bell-v1';
const MEDIA_PREFIX = 'flow-school-media-v1:';
const CACHE_PREFIX = 'flow-school-cache-v3:';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const SUBJECT_PRESETS = ['국어','문학','독서','수학','수학Ⅰ','수학Ⅱ','미적분','확률과 통계','영어','영어Ⅰ','영어Ⅱ','한국사','통합사회','통합과학','물리학','화학','생명과학','지구과학','사회·문화','생활과 윤리','윤리와 사상','한국지리','세계지리','경제','정치와 법','정보','인공지능 기초','제2외국어','체육','음악','미술','진로','자율','동아리'];
const ALLERGENS = {1:'난류',2:'우유',3:'메밀',4:'땅콩',5:'대두',6:'밀',7:'고등어',8:'게',9:'새우',10:'돼지고기',11:'복숭아',12:'토마토',13:'아황산류',14:'호두',15:'닭고기',16:'쇠고기',17:'오징어',18:'조개류',19:'잣'};
const CSAT_DATE = new Date(2026, 10, 19, 9);

let profile = readJson(PROFILE_KEY, null) || readJson(OLD_PROFILE_KEY, null);
if (profile && !localStorage.getItem(PROFILE_KEY)) writeJson(PROFILE_KEY, profile);
let selectedDate = noon(new Date());
let data = null;
let currentView = 'today';
let editMode = false;
let mealType = null;
let searchTimer = null;
let searchAbort = null;
let dashboardAbort = null;
let toastTimer = null;
let searchResults = [];
let selectedSetupSchool = null;
let selectedSubjectRow = null;
let selectedPreset = '';
let installPrompt = null;
let media = null;
let clockTimer = null;

function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function esc(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function pad(n) { return String(n).padStart(2,'0'); }
function noon(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); }
function ymd(d) { return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`; }
function isoDate(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function parseYmd(v) { return new Date(+v.slice(0,4), +v.slice(4,6)-1, +v.slice(6,8), 12); }
function koDate(d, long=true) { return new Intl.DateTimeFormat('ko-KR', long ? {month:'long',day:'numeric',weekday:'short'} : {month:'numeric',day:'numeric'}).format(d); }
function shortDay(d) { return new Intl.DateTimeFormat('ko-KR',{weekday:'short'}).format(d).replace('요일',''); }
function sameDay(a,b) { return ymd(a)===ymd(b); }
function currentTheme() { return localStorage.getItem(THEME_KEY) || 'light'; }
function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}`; }
function fmtDate8(v) { return /^\d{8}$/.test(v||'') ? `${v.slice(0,4)}.${v.slice(4,6)}.${v.slice(6,8)}` : (v || '—'); }
function daysBetween(a,b) { return Math.ceil((noon(b)-noon(a))/86400000); }
function weekdayIndex(v) { return parseYmd(v).getDay(); }

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'),2200);
}
function loading(on) { $('#loadingLine').classList.toggle('active',on); }
function applyTheme(value=currentTheme()) {
  const next = ['light','system','dark'].includes(value) ? value : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem(THEME_KEY,next);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next==='dark' ? '#202833' : '#edf2f7');
  $$('#themeSegment [data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===next));
  if ($('#landingThemeBtn')) $('#landingThemeBtn').textContent = next==='light' ? 'Light' : next==='dark' ? 'Dark' : 'System';
}
function cycleTheme() {
  const order=['light','system','dark'];
  applyTheme(order[(order.indexOf(currentTheme())+1)%order.length]);
}
function cacheKey() { return profile ? `${CACHE_PREFIX}${profile.school.schoolCode}:${profile.grade}:${profile.className}` : ''; }
function saveCache(payload) { if (profile) writeJson(cacheKey(),{at:Date.now(),payload}); }
function loadCache() { return readJson(cacheKey(),null)?.payload || null; }
function overrideMap() { return readJson(OVERRIDE_KEY,{}); }
function overrideId(row) { return `${profile?.school?.schoolCode||''}:${profile?.grade||''}:${profile?.className||''}:${weekdayIndex(row.date)}:${row.period}`; }
function subjectFor(row) { return overrideMap()[overrideId(row)] || row.subject || '선택과목'; }
function setSubjectOverride(row, subject) {
  const all=overrideMap(); const id=overrideId(row); const clean=String(subject||'').trim();
  if (!clean || clean===row.subject) delete all[id]; else all[id]=clean;
  writeJson(OVERRIDE_KEY,all);
}
function allergies() { return new Set(readJson(ALLERGY_KEY,[]).map(Number)); }
function bellDefaults() {
  const kind=profile?.school?.kind||'';
  if (kind.includes('초등')) return {start:'09:00',lesson:40,break:10};
  if (kind.includes('중학')) return {start:'09:00',lesson:45,break:10};
  return {start:'08:30',lesson:50,break:10};
}
function bellConfig() { return {...bellDefaults(),...readJson(BELL_KEY,{})}; }

async function api(params, signal) {
  const url=new URL(EDGE);
  Object.entries(params).forEach(([k,v])=>{ if(v!==undefined&&v!==null&&v!=='') url.searchParams.set(k,String(v)); });
  const response=await fetch(url,{signal});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(body.error||'데이터를 불러오지 못했습니다.');
  return body;
}

function showLanding() {
  $('#landing').classList.remove('hidden'); $('#dashboard').classList.add('hidden');
  setTimeout(()=>$('#schoolSearch')?.focus(),80);
}
function showDashboard() {
  $('#landing').classList.add('hidden'); $('#dashboard').classList.remove('hidden');
  renderIdentity(); switchView(currentView,false);
}
function renderIdentity() {
  if(!profile) return;
  const {name}=profile.school; const cls=`${profile.grade}학년 ${profile.className}반`;
  $('#schoolNameTop').textContent=name; $('#schoolClassTop').textContent=cls;
  $('#mobileSchoolName').textContent=name; $('#mobileClassName').textContent=cls;
  $('#heroSchoolName').textContent=name; $('#heroSchoolMeta').textContent=cls;
  const initial=name.replace(/(초등학교|중학교|고등학교|학교)$/,'').trim().slice(0,1)||'S';
  ['#schoolInitial','#schoolInitialSmall','#profileInitial'].forEach(s=>$(s).textContent=initial);
}

function renderSearchResults(target, schools, message='검색 결과가 없습니다.') {
  const box=$(target); searchResults=Array.isArray(schools)?schools:[];
  if(!searchResults.length){box.innerHTML=`<div class="search-state">${esc(message)}</div>`;box.classList.remove('hidden');return;}
  box.innerHTML=searchResults.map((s,i)=>`<button class="result-btn" type="button" data-result-index="${i}"><span><span class="result-name">${esc(s.name)}</span><span class="result-meta">${esc(s.officeName)} · ${esc(s.address||s.location||s.kind||'')}</span></span><span class="result-kind">${esc(s.highSchoolType||s.kind||'학교')}</span></button>`).join('');
  box.classList.remove('hidden');
  box.querySelectorAll('[data-result-index]').forEach(btn=>btn.addEventListener('click',()=>chooseSchool(searchResults[Number(btn.dataset.resultIndex)])));
}
async function runSearch(inputSelector,resultSelector){
  const q=$(inputSelector).value.trim(), box=$(resultSelector);
  if(q.length<2){box.classList.add('hidden');box.innerHTML='';return;}
  searchAbort?.abort(); searchAbort=new AbortController(); box.classList.remove('hidden'); box.innerHTML='<div class="search-state">학교 찾는 중…</div>';
  try{const result=await api({action:'search',q},searchAbort.signal);renderSearchResults(resultSelector,result.schools);}catch(error){if(error.name!=='AbortError')renderSearchResults(resultSelector,[],error.message||'검색에 실패했습니다.');}
}
function debounceSearch(inputSelector,resultSelector){clearTimeout(searchTimer);searchTimer=setTimeout(()=>runSearch(inputSelector,resultSelector),230);}

function gradeCount(kind=''){return kind.includes('초등')?6:3;}
async function chooseSchool(school){
  if(!school)return; selectedSetupSchool=school;
  $('#schoolResults').classList.add('hidden'); $('#switchResults').classList.add('hidden'); if($('#switchDialog').open)$('#switchDialog').close();
  $('#setupSchoolName').textContent=`${school.name} · ${school.officeName}`;
  $('#gradeRow').innerHTML=Array.from({length:gradeCount(school.kind)},(_,i)=>`<button class="choice-chip${i===0?' active':''}" data-grade="${i+1}" type="button">${i+1}학년</button>`).join('');
  $$('#gradeRow [data-grade]').forEach(btn=>btn.addEventListener('click',()=>{ $$('#gradeRow [data-grade]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');loadClassChoices(); }));
  $('#setupDialog').showModal(); await loadClassChoices();
}
async function loadClassChoices(){
  if(!selectedSetupSchool)return; const grade=Number($('#gradeRow [data-grade].active')?.dataset.grade||1); const box=$('#classRow');
  box.innerHTML='<span class="loading-copy">반 정보 불러오는 중</span>'; $('#manualClassWrap').classList.add('hidden');
  try{const result=await api({action:'classes',office:selectedSetupSchool.officeCode,school:selectedSetupSchool.schoolCode,grade}); const classes=result.classes||[];
    if(classes.length){box.innerHTML=classes.map((c,i)=>`<button class="choice-chip${i===0?' active':''}" data-class="${esc(c)}" type="button">${esc(c)}반</button>`).join(''); $$('#classRow [data-class]').forEach(btn=>btn.addEventListener('click',()=>{$$('#classRow [data-class]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');}));}
    else throw new Error('no classes');
  }catch{box.innerHTML='';$('#manualClassWrap').classList.remove('hidden');}
}
function saveSetup(){
  if(!selectedSetupSchool)return; const grade=Number($('#gradeRow [data-grade].active')?.dataset.grade||1); const selected=$('#classRow [data-class].active')?.dataset.class; const manual=$('#classInput').value.trim()||'1';
  profile={school:selectedSetupSchool,grade,className:selected||manual}; writeJson(PROFILE_KEY,profile); localStorage.removeItem(OLD_PROFILE_KEY); $('#setupDialog').close(); selectedDate=noon(new Date()); data=null; media=null; showDashboard(); loadDashboard(); loadMedia();
}
function reselectClass(){if(!profile)return;selectedSetupSchool=profile.school;$('#switchDialog').close();chooseSchool(profile.school);}
function clearProfile(){localStorage.removeItem(PROFILE_KEY);localStorage.removeItem(OLD_PROFILE_KEY);profile=null;data=null;media=null;$('#switchDialog').close();showLanding();}

async function loadDashboard(){
  if(!profile)return; dashboardAbort?.abort();dashboardAbort=new AbortController();loading(true);$('#errorBox').classList.add('hidden');
  try{data=await api({action:'dashboard',office:profile.school.officeCode,school:profile.school.schoolCode,grade:profile.grade,class:profile.className,kind:profile.school.kind,date:ymd(selectedDate)},dashboardAbort.signal);if(data.school){profile.school={...profile.school,...data.school};writeJson(PROFILE_KEY,profile);}saveCache(data);renderAll();}
  catch(error){if(error.name==='AbortError')return;const cached=loadCache();if(cached){data=cached;renderAll();$('#errorBox').textContent='새 데이터를 불러오지 못해 마지막 저장 정보를 표시합니다.';}else{data={school:profile.school,timetable:[],meals:[],events:[]};renderAll();$('#errorBox').textContent=error.message||'학교 정보를 불러오지 못했습니다.';}$('#errorBox').classList.remove('hidden');}
  finally{loading(false);}
}
async function loadMedia(){
  if(!profile)return; const key=MEDIA_PREFIX+profile.school.schoolCode; const cached=readJson(key,null); if(cached){media=cached;renderMedia();return;}
  try{const result=await api({action:'media',office:profile.school.officeCode,school:profile.school.schoolCode});media=result.media||{};writeJson(key,media);renderMedia();}catch{media={};renderMedia();}
}
function setImage(id,url){const img=$(id);if(!img)return;img.classList.remove('loaded');img.removeAttribute('src');if(!url)return;img.onload=()=>img.classList.add('loaded');img.onerror=()=>img.classList.remove('loaded');img.src=url;}
function setBackground(id,url){const el=$(id);if(!el)return;el.classList.toggle('has-image',!!url);el.style.backgroundImage=url?`url("${String(url).replace(/"/g,'%22')}")`:'';}
function renderMedia(){const hero=media?.hero||'';const logo=media?.logo||'';setBackground('#schoolHeroImage',hero);setBackground('#profilePhoto',hero);setImage('#schoolLogo',logo);setImage('#schoolLogoSmall',logo);setImage('#profileLogo',logo);}

function rawRowsForDate(date=selectedDate){return (data?.timetable||[]).filter(x=>x.date===ymd(date)).sort((a,b)=>a.period-b.period);}
function maxPeriod(){return Math.max(0,...(data?.timetable||[]).map(r=>Number(r.period)||0));}
function dayRows(date=selectedDate){
  const rows=rawRowsForDate(date); if(!rows.length)return[]; const max=Math.max(maxPeriod(),...rows.map(r=>r.period));
  return Array.from({length:max},(_,i)=>rows.find(r=>Number(r.period)===i+1)||{date:ymd(date),period:i+1,subject:'',synthetic:true});
}
function selectedMeals(){return (data?.meals||[]).filter(x=>x.date===ymd(selectedDate));}
function gradeEventApplies(event){const key=profile?.grade===1?'grade1':profile?.grade===2?'grade2':'grade3';const v=event?.[key];return !v||v==='Y'||v==='해당없음';}
function monthEvents(){return (data?.events||[]).filter(gradeEventApplies).sort((a,b)=>a.date.localeCompare(b.date));}
function nextEvents(){const today=ymd(new Date());return monthEvents().filter(e=>e.date>=today).slice(0,5);}
function nextEventText(){const e=nextEvents()[0];if(!e)return'예정 없음';const diff=daysBetween(new Date(),parseYmd(e.date));return diff<=0?e.name:`D-${diff} ${e.name}`;}
function weekDates(){if(data?.from){const start=parseYmd(data.from);return Array.from({length:5},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});}const start=noon(selectedDate);const day=start.getDay();start.setDate(start.getDate()+(day===0?-6:1-day));return Array.from({length:5},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d;});}

function renderHero(){
  renderIdentity(); const today=sameDay(selectedDate,new Date()); $('#heroEyebrow').textContent=today?'TODAY':'SELECTED DATE'; $('#heroDate').textContent=today?'오늘':koDate(selectedDate,false); $('#dateTitle').textContent=koDate(selectedDate); $('#datePicker').value=isoDate(selectedDate);
  const rows=dayRows();const meals=selectedMeals();$('#quickLessons').textContent=rows.length?`${rows.length}교시`:'수업 없음';$('#quickLessonSub').textContent=rows.length?`${subjectFor(rows[0])}부터`:'휴업일 또는 미등록';
  $('#quickMeal').textContent=meals.length?meals.map(m=>m.type).join(' · '):'급식 없음';$('#quickMealSub').textContent=meals[0]?.calories||'오늘 제공';$('#quickEvent').textContent=nextEventText();$('#quickEventSub').textContent=nextEvents()[0]?fmtDate8(nextEvents()[0].date):'등록된 일정 없음';
  renderCsat(); renderClock();
}
function renderCsat(){const diff=daysBetween(new Date(),CSAT_DATE);$('#csatDday').textContent=diff>=0?`D-${diff}`:'종료';}
function renderDayStrip(){const days=weekDates();$('#dayStrip').innerHTML=days.map(d=>`<button class="day-chip${sameDay(d,selectedDate)?' active':''}" data-date="${ymd(d)}" type="button"><span>${shortDay(d)}</span><strong>${d.getDate()}</strong></button>`).join('');$$('#dayStrip [data-date]').forEach(btn=>btn.addEventListener('click',()=>{selectedDate=parseYmd(btn.dataset.date);renderAll();}));}
function renderTimetable(){
  const rows=dayRows();const box=$('#timetable');box.classList.toggle('editing',editMode);$('#editSubjectsBtn').classList.toggle('active',editMode);$('#editSubjectsBtn').textContent=editMode?'편집 끝내기':'과목 편집';
  if(!rows.length){box.innerHTML='<div class="empty">이 날짜에는 공개된 시간표가 없습니다.</div>';return;}
  box.innerHTML=rows.map(row=>{const shown=subjectFor(row);const changed=shown!==(row.subject||'');const elective=!row.subject||shown==='선택과목';return `<button class="period-button" type="button" data-period="${row.period}"><span class="period-no">${row.period}</span><span><span class="period-name${elective?' elective':''}">${esc(shown)}</span>${editMode?'<span class="period-edit-hint">눌러서 변경</span>':''}</span><span class="period-origin">${changed&&row.subject?`NEIS ${esc(row.subject)}`:row.synthetic?'선택과목':''}</span></button>`;}).join('');
  $$('#timetable [data-period]').forEach(btn=>btn.addEventListener('click',()=>{if(!editMode)return;const row=rows.find(r=>String(r.period)===btn.dataset.period);openSubjectDialog(row);}));
}
function openSubjectDialog(row){selectedSubjectRow=row;selectedPreset=subjectFor(row);$('#subjectDialogTitle').textContent=`${shortDay(parseYmd(row.date))}요일 ${row.period}교시`;$('#customSubjectInput').value=selectedPreset==='선택과목'?'':selectedPreset;renderSubjectPresets();$('#subjectDialog').showModal();}
function renderSubjectPresets(){$('#subjectPresets').innerHTML=SUBJECT_PRESETS.map(s=>`<button class="subject-chip${s===selectedPreset?' selected':''}" data-subject="${esc(s)}" type="button">${esc(s)}</button>`).join('');$$('#subjectPresets [data-subject]').forEach(btn=>btn.addEventListener('click',()=>{selectedPreset=btn.dataset.subject;$('#customSubjectInput').value=selectedPreset;renderSubjectPresets();}));}
function saveSubject(){if(!selectedSubjectRow)return;const value=$('#customSubjectInput').value.trim()||selectedPreset||'선택과목';setSubjectOverride(selectedSubjectRow,value);$('#subjectDialog').close();renderTimetable();renderWeek();toast('선택과목을 저장했습니다.');}
function resetSubject(){if(!selectedSubjectRow)return;setSubjectOverride(selectedSubjectRow,'');$('#subjectDialog').close();renderTimetable();renderWeek();toast('NEIS 시간표로 되돌렸습니다.');}

function allergenIds(raw=''){const ids=[];for(const m of String(raw).matchAll(/\((\d+(?:\.\d+)*)\.?\)/g)){m[1].split('.').map(Number).filter(n=>n>=1&&n<=19).forEach(n=>ids.push(n));}return [...new Set(ids)];}
function dishName(raw=''){return String(raw).replace(/\((\d+(?:\.\d+)*)\.?\)/g,'').replace(/\s+/g,' ').trim();}
function activeMeal(){const meals=selectedMeals();if(!mealType||!meals.some(m=>m.type===mealType))mealType=meals[0]?.type||null;return meals.find(m=>m.type===mealType)||meals[0]||null;}
function renderMeals(){
  const meals=selectedMeals(),tabs=$('#mealTabs'),list=$('#mealList'),cal=$('#mealCal'); if(!meals.length){tabs.innerHTML='';list.innerHTML='<div class="empty">이 날짜에는 급식 정보가 없습니다.</div>';cal.textContent='';$('#mealDetailBtn').classList.add('hidden');$('#mealDetails').classList.add('hidden');return;}
  const meal=activeMeal();tabs.innerHTML=meals.map(m=>`<button class="meal-tab${m.type===meal.type?' active':''}" data-type="${esc(m.type)}" type="button">${esc(m.type)}</button>`).join('');$$('#mealTabs [data-type]').forEach(btn=>btn.addEventListener('click',()=>{mealType=btn.dataset.type;$('#mealDetails').classList.add('hidden');renderMeals();}));
  const selected=allergies();list.innerHTML=meal.dishes.map(raw=>{const ids=allergenIds(raw);const hits=ids.filter(id=>selected.has(id));const warning=hits.map(id=>ALLERGENS[id]).join(', ');return `<button class="dish${hits.length?' risk':''}" type="button" data-dish="${esc(dishName(raw))}"><strong>${esc(dishName(raw))}</strong>${hits.length?`<small>주의 · ${esc(warning)}</small>`:''}</button>`;}).join('');
  $$('#mealList [data-dish]').forEach(btn=>btn.addEventListener('click',()=>{const q=encodeURIComponent(`${btn.dataset.dish} 음식 ${profile.school.name}`);window.open(`https://www.google.com/search?tbm=isch&q=${q}`,'_blank','noopener,noreferrer');}));
  cal.textContent=meal.calories?`총 ${meal.calories}`:'NEIS 급식 데이터';$('#mealDetailBtn').classList.remove('hidden');$('#mealDetails').textContent=`영양정보\n${stripBr(meal.nutrition)||'정보 없음'}\n\n원산지\n${stripBr(meal.origin)||'정보 없음'}`;
}
function stripBr(v=''){return String(v).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<[^>]+>/g,'').trim();}
function renderAllergyGrid(){const selected=allergies();$('#allergyGrid').innerHTML=Object.entries(ALLERGENS).map(([id,name])=>`<button class="allergy-chip${selected.has(Number(id))?' selected':''}" data-allergy="${id}" type="button">${id}. ${name}</button>`).join('');$$('#allergyGrid [data-allergy]').forEach(btn=>btn.addEventListener('click',()=>btn.classList.toggle('selected')));}
function saveAllergies(){const ids=$$('#allergyGrid .selected').map(x=>Number(x.dataset.allergy));writeJson(ALLERGY_KEY,ids);$('#allergyDialog').close();renderMeals();toast('알레르기 표시를 저장했습니다.');}
function renderEvents(){const events=nextEvents();$('#eventList').innerHTML=events.length?events.map(e=>{const d=parseYmd(e.date);return `<div class="event"><div class="event-date"><strong>${d.getDate()}</strong><span>${d.getMonth()+1}월</span></div><div><div class="event-name">${esc(e.name)}</div>${e.content?`<div class="event-content">${esc(e.content)}</div>`:''}</div></div>`;}).join(''):'<div class="empty">이번 달 남은 학사일정이 없습니다.</div>';}

function renderWeek(){
  const days=weekDates(),max=maxPeriod();$('#weekRangeText').textContent=days.length?`${koDate(days[0],false)} – ${koDate(days[4],false)} · ${profile.school.name}`:'이번 주'; if(!max){$('#weekTable').innerHTML='<div class="empty">이번 주 시간표가 없습니다.</div>';return;}
  const cells=['<div class="week-cell week-head">교시</div>',...days.map(d=>`<div class="week-cell week-head">${shortDay(d)} ${d.getDate()}</div>`)];
  for(let p=1;p<=max;p++){cells.push(`<div class="week-cell week-period">${p}</div>`);for(const d of days){const raw=(data?.timetable||[]).find(r=>r.date===ymd(d)&&Number(r.period)===p);const any=(data?.timetable||[]).some(r=>r.date===ymd(d));const row=raw||{date:ymd(d),period:p,subject:'',synthetic:true};const subject=any?subjectFor(row):'—';cells.push(`<div class="week-cell"><div class="week-subject${subject==='선택과목'?' elective':''}">${esc(subject)}</div></div>`);}}
  $('#weekTable').innerHTML=cells.join('');
}
function renderSchedule(){const rows=monthEvents();$('#scheduleGrid').innerHTML=rows.length?rows.map(e=>`<div class="schedule-row"><time>${esc(fmtDate8(e.date))}</time><strong>${esc(e.name)}</strong>${e.content?`<p>${esc(e.content)}</p>`:''}</div>`).join(''):'<div class="empty">이번 달 학사일정이 없습니다.</div>';renderCalendar();}
function renderCalendar(){
  const d=noon(selectedDate),first=new Date(d.getFullYear(),d.getMonth(),1,12),start=new Date(first);start.setDate(first.getDate()-first.getDay());const weekdays=['일','월','화','수','목','금','토'];const cells=weekdays.map(x=>`<div class="calendar-weekday">${x}</div>`);
  const eventMap=new Map();monthEvents().forEach(e=>{if(!eventMap.has(e.date))eventMap.set(e.date,[]);eventMap.get(e.date).push(e);});
  for(let i=0;i<42;i++){const day=new Date(start);day.setDate(start.getDate()+i);const key=ymd(day),events=eventMap.get(key)||[];cells.push(`<button class="calendar-day${day.getMonth()!==d.getMonth()?' outside':''}${sameDay(day,new Date())?' today':''}${sameDay(day,selectedDate)?' selected':''}" type="button" data-calendar-date="${key}"><strong>${day.getDate()}</strong>${events.length?'<span class="calendar-dot"></span>':''}${events[0]?`<span class="calendar-event-label">${esc(events[0].name)}</span>`:''}</button>`);}
  $('#calendarMonthTitle').textContent=`${d.getFullYear()}년 ${d.getMonth()+1}월`;$('#monthPicker').value=monthKey(d);$('#calendarGrid').innerHTML=cells.join('');$$('[data-calendar-date]').forEach(btn=>btn.addEventListener('click',()=>{const next=parseYmd(btn.dataset.calendarDate);const monthChanged=next.getMonth()!==selectedDate.getMonth()||next.getFullYear()!==selectedDate.getFullYear();selectedDate=next;if(monthChanged)loadDashboard();else{renderAll();switchView('today');}}));
}
function renderSchoolInfo(){
  const s=data?.school||profile?.school;if(!s)return;$('#profileName').textContent=s.name||'학교';$('#profileKind').textContent=[s.kind,s.highSchoolType].filter(Boolean).join(' · ')||'학교';$('#profileEnglishName').textContent=s.englishName||'';
  const entries=[['설립구분',s.type],['학교 구분',s.highSchoolType||s.kind],['남녀 구분',s.coed],['주야',s.dayNight],['설립일',fmtDate8(s.founded)],['개교기념일',fmtDate8(s.anniversary)],['교육청',s.officeName],['관할기관',s.jurisdiction],['주소',[s.address,s.addressDetail].filter(Boolean).join(' ')],['전화',s.phone],['팩스',s.fax],['계열',s.highSchoolTrack||s.specialPurpose]];
  $('#schoolInfoGrid').innerHTML=entries.filter(([,v])=>v).map(([k,v])=>`<div class="info-tile"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
  const home=normalizeUrl(s.homepage);$('#homepageLink').href=home||'#';$('#homepageLink').classList.toggle('hidden',!home);$('#mapLink').href=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address||s.name)}`;$('#phoneLink').href=s.phone?`tel:${s.phone.replace(/[^\d+]/g,'')}`:'#';$('#phoneLink').classList.toggle('hidden',!s.phone);
}
function normalizeUrl(v=''){if(!v)return'';return /^https?:\/\//i.test(v)?v:`https://${v}`;}

function renderClock(){
  if(!profile)return; const rows=rawRowsForDate(new Date());const cfg=bellConfig();const [h,m]=String(cfg.start).split(':').map(Number);const now=new Date();const start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),h||8,m||30);const lesson=Number(cfg.lesson)||50,brk=Number(cfg.break)||10,total=lesson+brk;const mins=(now-start)/60000;const lessons=rows.length||Math.max(maxPeriod(),7);
  let title='수업 전',caption=`1교시 ${cfg.start} 시작`,progress=0;
  if(now.getDay()===0||now.getDay()===6){title='주말';caption='오늘은 정규 수업이 없어요.';}
  else if(mins<0){title='수업 전';caption=`1교시까지 ${Math.max(1,Math.ceil(-mins))}분`;}
  else{const idx=Math.floor(mins/total);const inside=mins-idx*total;if(idx>=lessons){title='오늘 수업 종료';caption='오늘도 수고했어요.';progress=100;}else if(inside<lesson){title=`${idx+1}교시 수업 중`;const row=rows.find(r=>Number(r.period)===idx+1);caption=row?.subject?`${subjectFor(row)} · ${Math.ceil(lesson-inside)}분 남음`:`${Math.ceil(lesson-inside)}분 남음`;progress=Math.max(0,Math.min(100,inside/lesson*100));}else{title=`${idx+1}교시 후 쉬는 시간`;caption=`다음 수업까지 ${Math.ceil(total-inside)}분`;progress=100;}}
  $('#clockTitle').textContent=title;$('#clockCaption').textContent=`${caption} · 예상 타종`;$('#clockProgress').style.width=`${progress}%`;
}
function renderSettings(){const cfg=bellConfig();$('#bellStart').value=cfg.start;$('#lessonMinutes').value=cfg.lesson;$('#breakMinutes').value=cfg.break;applyTheme();}
function saveSettings(){const cfg={start:$('#bellStart').value||'08:30',lesson:Math.max(30,Math.min(90,Number($('#lessonMinutes').value)||50)),break:Math.max(5,Math.min(30,Number($('#breakMinutes').value)||10))};writeJson(BELL_KEY,cfg);$('#settingsDialog').close();renderClock();toast('설정을 저장했습니다.');}

function switchView(view,scroll=true){currentView=view;$$('[data-view-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.viewPanel!==view));$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if(view==='week')renderWeek();if(view==='schedule')renderSchedule();if(view==='school')renderSchoolInfo();if(scroll)window.scrollTo({top:0,behavior:'smooth'});}
function shiftDay(delta){const d=noon(selectedDate);d.setDate(d.getDate()+delta);const weekChanged=(d.getDay()===1&&delta>0)||(selectedDate.getDay()===1&&delta<0)||(d.getDay()===0)||(d.getDay()===6);selectedDate=d;if(weekChanged)loadDashboard();else renderAll();}
function shiftWeek(delta){const d=noon(selectedDate);d.setDate(d.getDate()+delta*7);selectedDate=d;loadDashboard();}
function shiftMonth(delta){const d=noon(selectedDate);d.setDate(1);d.setMonth(d.getMonth()+delta);selectedDate=d;loadDashboard();}
function renderAll(){renderIdentity();renderHero();renderDayStrip();renderTimetable();renderMeals();renderEvents();renderWeek();renderSchedule();renderSchoolInfo();renderMedia();}
function openSwitch(){if(!profile)return;$('#currentSchoolMeta').textContent=`${profile.school.name} · ${profile.grade}학년 ${profile.className}반`;$('#switchSearch').value='';$('#switchResults').classList.add('hidden');$('#switchDialog').showModal();setTimeout(()=>$('#switchSearch').focus(),100);}
function openSettings(){renderSettings();$('#settingsDialog').showModal();}

function bind(){
  applyTheme();
  $('#landingThemeBtn').addEventListener('click',cycleTheme);
  $('#schoolSearch').addEventListener('input',()=>debounceSearch('#schoolSearch','#schoolResults'));$('#schoolSearchBtn').addEventListener('click',()=>runSearch('#schoolSearch','#schoolResults'));$('#schoolSearch').addEventListener('keydown',e=>{if(e.key==='Enter')runSearch('#schoolSearch','#schoolResults');});
  $('#switchSearch').addEventListener('input',()=>debounceSearch('#switchSearch','#switchResults'));
  $('#schoolBtn').addEventListener('click',openSwitch);$('#mobileSchoolBtn').addEventListener('click',openSwitch);$('#reselectClassBtn').addEventListener('click',reselectClass);$('#changeSchoolBtn').addEventListener('click',clearProfile);$('#setupSave').addEventListener('click',saveSetup);
  $('#prevDay').addEventListener('click',()=>shiftDay(-1));$('#nextDay').addEventListener('click',()=>shiftDay(1));$('#todayBtn').addEventListener('click',()=>{selectedDate=noon(new Date());loadDashboard();});$('#dateTitle').addEventListener('click',()=>$('#datePicker').showPicker?.());$('#datePicker').addEventListener('change',()=>{if(!$('#datePicker').value)return;const [y,m,d]=$('#datePicker').value.split('-').map(Number);selectedDate=new Date(y,m-1,d,12);loadDashboard();});
  $('#editSubjectsBtn').addEventListener('click',()=>{editMode=!editMode;renderTimetable();});$('#saveSubjectBtn').addEventListener('click',saveSubject);$('#resetSubjectBtn').addEventListener('click',resetSubject);$('#customSubjectInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveSubject();}});
  $('#allergyBtn').addEventListener('click',()=>{renderAllergyGrid();$('#allergyDialog').showModal();});$('#saveAllergyBtn').addEventListener('click',saveAllergies);$('#mealDetailBtn').addEventListener('click',()=>$('#mealDetails').classList.toggle('hidden'));
  $('#prevWeek').addEventListener('click',()=>shiftWeek(-1));$('#nextWeek').addEventListener('click',()=>shiftWeek(1));$('#thisWeekBtn').addEventListener('click',()=>{selectedDate=noon(new Date());loadDashboard();});
  $('#prevMonth').addEventListener('click',()=>shiftMonth(-1));$('#nextMonth').addEventListener('click',()=>shiftMonth(1));$('#monthPicker').addEventListener('change',()=>{if(!$('#monthPicker').value)return;const [y,m]=$('#monthPicker').value.split('-').map(Number);selectedDate=new Date(y,m-1,1,12);loadDashboard();});
  $$('[data-view]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));$$('[data-go-view]').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.goView)));
  $('#settingsBtn').addEventListener('click',openSettings);$('#mobileSettingsBtn').addEventListener('click',openSettings);$('#saveSettingsBtn').addEventListener('click',saveSettings);$$('[data-theme-choice]').forEach(btn=>btn.addEventListener('click',()=>applyTheme(btn.dataset.themeChoice)));
  $$('.dialog-close').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog').close()));
  $('#installBtn').addEventListener('click',async()=>{if(installPrompt){installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;}else toast('브라우저 메뉴의 홈 화면에 추가를 사용하세요.');});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;});
  window.addEventListener('focus',renderClock);
}

if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
bind();
if(profile){showDashboard();loadDashboard();loadMedia();}else showLanding();
clearInterval(clockTimer);clockTimer=setInterval(renderClock,30000);
