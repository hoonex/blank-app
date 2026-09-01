const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const PROFILE_KEY='flow-school-profile-v3';
const CACHE_PREFIX='flow-school-cache-v4:';
const EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/school-data';
const EXAM_KEYWORDS=/시험|평가|모의|중간|기말|고사|수능|학력|듣기/;
const INITIAL_VISIBLE=3;
const REVEAL_BATCH=3;
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
let visibleCount=INITIAL_VISIBLE;
let remoteEvents=[];
let monthCursor=null;
let horizon=null;
let exhausted=false;
let loadingPromise=null;
let scrollFrame=0;
let userHasScrolled=false;

function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function profile(){return readJson(PROFILE_KEY,null)}
function grade(){return Math.max(1,Math.min(6,Number(profile()?.grade)||1))}
function pad(value){return String(value).padStart(2,'0')}
function iso(date=new Date()){return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`}
function ymd(date){return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}`}
function parseYmd(value){const text=String(value||'').replace(/\D/g,'');return text.length>=8?new Date(+text.slice(0,4),+text.slice(4,6)-1,+text.slice(6,8),12):null}
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function appliesToGrade(event){
  const g=grade(),flag=event?.[`grade${g}`],flags=[1,2,3,4,5,6].map(n=>event?.[`grade${n}`]).filter(Boolean);
  if(flag==='Y'||!flag)return true;
  return Boolean(flags.length&&flags.every(value=>value!=='Y'));
}
function asExam(event){
  if(!event||!appliesToGrade(event))return null;
  const name=String(event.name||'').trim(),detail=String(event.content||event.detail||'').trim();
  if(!EXAM_KEYWORDS.test(`${name} ${detail}`))return null;
  const date=parseYmd(event.date);if(!date)return null;
  return{date:iso(date),name,detail:detail||'학교 학사일정',kind:event.kind||'학교 시험'};
}
function cacheEvents(){
  const p=profile();if(!p?.school?.schoolCode)return[];
  const prefix=`${CACHE_PREFIX}${p.school.schoolCode}:${p.grade}:${p.className}:`;
  const rows=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key?.startsWith(prefix))continue;
    const entry=readJson(key,null),events=entry?.payload?.events;
    if(Array.isArray(events))rows.push(...events);
  }
  return rows;
}
function groupKey(item){
  const text=`${item.name} ${item.detail||''}`;
  if(/전국연합|학력평가/.test(text))return`${item.date}:national`;
  if(/영어듣기/.test(text))return`${item.date}:listening`;
  if(/모의평가/.test(text))return`${item.date}:mock`;
  return`${item.date}:${item.name}`;
}
function allExams(){
  const today=iso(),g=grade(),merged=[...cacheEvents(),...remoteEvents].map(asExam).filter(Boolean);
  merged.push(...official.filter(item=>item.grades.includes(g)));
  const dedup=new Map();
  for(const item of merged.filter(item=>item.date>=today)){
    const key=groupKey(item),old=dedup.get(key);
    if(!old||String(item.detail||'').length>String(old.detail||'').length)dedup.set(key,item);
  }
  return[...dedup.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name,'ko'));
}
function dday(date){
  const target=new Date(`${date}T12:00:00`),now=new Date(),base=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12),diff=Math.round((target-base)/86400000);
  return diff===0?'D-DAY':diff>0?`D-${diff}`:`D+${Math.abs(diff)}`;
}
function dateLabel(date){
  const [y,m,d]=date.split('-').map(Number);return new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',weekday:'short'}).format(new Date(y,m-1,d,12));
}
function ensureStyle(){
  if($('#flow-school-exam-feed-v3-style'))return;
  const style=document.createElement('style');style.id='flow-school-exam-feed-v3-style';style.textContent=`
html[data-flow-school-ui="v2"] #todayView .upcoming-card[data-flow-exam-feed="v3"]{overflow:visible!important}
html[data-flow-school-ui="v2"] #todayView .upcoming-card[data-flow-exam-feed="v3"]>#eventList{display:none!important}
html[data-flow-school-ui="v2"] #todayView #flowExamFeedV3{display:grid;gap:8px;min-width:0}
html[data-flow-school-ui="v2"] #todayView .flow-exam-feature-v3{position:relative;min-height:118px;padding:17px 18px 18px;border:0;border-radius:20px;corner-shape:squircle;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 84%,#3956b8),color-mix(in srgb,var(--accent) 60%,#7286d8));color:#fff;box-shadow:0 12px 28px color-mix(in srgb,var(--accent) 18%,transparent),inset 0 1px 0 rgba(255,255,255,.28)}
html[data-flow-school-ui="v2"] #todayView .flow-exam-feature-v3::after{content:"";position:absolute;right:18px;bottom:14px;width:64px;height:48px;border-radius:14px;corner-shape:squircle;background:linear-gradient(145deg,rgba(255,255,255,.38),rgba(255,255,255,.08));box-shadow:-13px -8px 0 -4px rgba(255,255,255,.12);transform:rotate(-8deg);pointer-events:none}
html[data-flow-school-ui="v2"] #todayView .flow-exam-feature-top{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:.58rem;font-weight:720;color:rgba(255,255,255,.78)}
html[data-flow-school-ui="v2"] #todayView .flow-exam-feature-v3 .flow-exam-dday-v3{display:inline-flex;align-items:center;min-height:28px;padding:0 9px;border-radius:10px;corner-shape:squircle;background:rgba(255,255,255,.16);color:#fff;font-size:.66rem;font-weight:880}
html[data-flow-school-ui="v2"] #todayView .flow-exam-feature-v3 h3{position:relative;z-index:1;max-width:72%;margin:0;font-size:1rem;line-height:1.25;letter-spacing:-.04em}
html[data-flow-school-ui="v2"] #todayView .flow-exam-feature-v3 p{position:relative;z-index:1;max-width:70%;margin:7px 0 0;color:rgba(255,255,255,.78);font-size:.59rem;line-height:1.48}
html[data-flow-school-ui="v2"] #todayView .flow-exam-row-v3{display:grid;grid-template-columns:54px minmax(0,1fr) 20px;align-items:center;gap:10px;min-height:62px;padding:9px 11px;border:0;border-radius:16px;corner-shape:squircle;background:color-mix(in srgb,var(--surface) 95%,var(--surface-2));box-shadow:0 5px 14px rgba(43,57,78,.055),inset 0 1px 0 rgba(255,255,255,.7);animation:flow-exam-row-in .22s cubic-bezier(.16,1,.3,1) both}
html[data-flow-school-ui="v2"] #todayView .flow-exam-row-date{display:grid;gap:3px;justify-items:start;color:var(--muted);font-size:.49rem;font-weight:700}
html[data-flow-school-ui="v2"] #todayView .flow-exam-row-date strong{display:inline-flex;align-items:center;min-height:24px;padding:0 7px;border-radius:9px;corner-shape:squircle;background:color-mix(in srgb,var(--accent) 9%,var(--surface));color:var(--accent);font-size:.57rem;font-weight:860}
html[data-flow-school-ui="v2"] #todayView .flow-exam-row-copy{min-width:0}.flow-exam-row-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:.68rem;line-height:1.25}.flow-exam-row-copy small{display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:.51rem}
html[data-flow-school-ui="v2"] #todayView .flow-exam-row-arrow{color:color-mix(in srgb,var(--muted) 75%,transparent);font-size:1rem;text-align:center}
html[data-flow-school-ui="v2"] #todayView .flow-exam-feed-sentinel{display:grid;place-items:center;min-height:38px;margin-top:1px;color:var(--muted);font-size:.51rem;font-weight:670;letter-spacing:.01em}
html[data-flow-school-ui="v2"] #todayView .flow-exam-feed-sentinel[data-state="done"]{opacity:.66}
html[data-flow-school-ui="v2"] #todayView .flow-exam-feed-empty{padding:28px 8px;color:var(--muted);font-size:.65rem;text-align:center}
@keyframes flow-exam-row-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:620px){html[data-flow-school-ui="v2"] #todayView .flow-exam-feature-v3{min-height:108px;padding:15px 16px}html[data-flow-school-ui="v2"] #todayView .flow-exam-feature-v3 h3{max-width:76%;font-size:.9rem}html[data-flow-school-ui="v2"] #todayView .flow-exam-feature-v3 p{max-width:76%;font-size:.55rem}html[data-flow-school-ui="v2"] #todayView .flow-exam-row-v3{grid-template-columns:50px minmax(0,1fr) 16px;min-height:58px;padding:8px 10px}}
@media(prefers-reduced-motion:reduce){html[data-flow-school-ui="v2"] #todayView .flow-exam-row-v3{animation:none!important}}
`;
  document.head.append(style);
}
function ensureFeed(){
  const card=$('#todayView .upcoming-card'),old=$('#eventList');if(!card||!old)return null;
  card.dataset.flowExamFeed='v3';
  let feed=$('#flowExamFeedV3');if(!feed){feed=document.createElement('div');feed.id='flowExamFeedV3';feed.dataset.flowExamVisible='0';feed.setAttribute('aria-live','polite');old.after(feed)}
  const title=$('.card-heading h2',card),kicker=$('.section-kicker',card);if(title)title.textContent='다가오는 시험';if(kicker)kicker.textContent='EXAMS';
  return feed;
}
function markup(exams){
  if(!exams.length)return'<div class="flow-exam-feed-empty">다가오는 시험 일정이 없습니다.</div>';
  const visible=exams.slice(0,Math.min(visibleCount,exams.length)),first=visible[0],rows=visible.slice(1);
  const hero=`<article class="flow-exam-feature-v3" data-flow-exam-item="0" data-exam-date="${first.date}"><div class="flow-exam-feature-top"><span class="flow-exam-dday-v3">${dday(first.date)}</span><span>${dateLabel(first.date)}</span><span>${escapeHtml(first.kind||'시험')}</span></div><h3>${escapeHtml(first.name)}</h3><p>${escapeHtml(first.detail||'시험 일정을 확인하세요.')}</p></article>`;
  const rowMarkup=rows.map((exam,index)=>`<article class="flow-exam-row-v3" data-flow-exam-item="${index+1}" data-exam-date="${exam.date}"><div class="flow-exam-row-date"><strong>${dday(exam.date)}</strong><span>${dateLabel(exam.date)}</span></div><div class="flow-exam-row-copy"><strong>${escapeHtml(exam.name)}</strong><small>${escapeHtml(exam.detail||exam.kind||'시험 일정')}</small></div><span class="flow-exam-row-arrow" aria-hidden="true">›</span></article>`).join('');
  return hero+rowMarkup;
}
function render(){
  ensureStyle();const feed=ensureFeed();if(!feed)return;const exams=allExams(),visible=Math.min(visibleCount,exams.length),hasMore=visible<exams.length||!exhausted;
  const body=markup(exams);const footer=exams.length?`<div class="flow-exam-feed-sentinel" data-flow-exam-sentinel data-state="${hasMore?'more':'done'}">${hasMore?'아래로 스크롤하면 다음 시험을 이어서 표시합니다.':'이번 학년도 시험을 모두 확인했습니다.'}</div>`:'';
  const html=body+footer;if(feed.innerHTML!==html)feed.innerHTML=html;feed.dataset.flowExamVisible=String(visible);feed.dataset.flowExamTotal=String(exams.length);feed.dataset.flowExamExhausted=String(exhausted&&!hasMore);
}
function resetHorizon(){
  const now=new Date(),academicEnd=now.getMonth()>=2?new Date(now.getFullYear()+1,1,28,12):new Date(now.getFullYear(),1,28,12);
  monthCursor=new Date(now.getFullYear(),now.getMonth()+1,1,12);horizon=academicEnd;exhausted=monthCursor>horizon;
}
async function fetchMonth(date){
  const p=profile();if(!p?.school?.officeCode||!p?.school?.schoolCode)return[];
  const url=new URL(EDGE);const params={action:'dashboard',office:p.school.officeCode,school:p.school.schoolCode,grade:p.grade,class:p.className,kind:p.school.kind,date:ymd(date)};
  for(const [key,value] of Object.entries(params))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
  const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`exam month ${response.status}`);const body=await response.json().catch(()=>({}));return Array.isArray(body.events)?body.events:[];
}
function nextMonth(){if(!monthCursor)return null;const current=new Date(monthCursor),next=new Date(current.getFullYear(),current.getMonth()+1,1,12);monthCursor=next;return current}
async function loadUntilNewExam(){
  const before=allExams().length;
  while(!exhausted&&monthCursor&&horizon&&monthCursor<=horizon){
    const target=nextMonth();if(!target)break;
    try{remoteEvents.push(...await fetchMonth(target))}catch{}
    if(monthCursor>horizon)exhausted=true;
    if(allExams().length>before)break;
  }
  if(monthCursor&&horizon&&monthCursor>horizon)exhausted=true;
}
async function revealMore(){
  if(loadingPromise)return loadingPromise;
  loadingPromise=(async()=>{
    let exams=allExams();
    if(visibleCount<exams.length){visibleCount=Math.min(exams.length,visibleCount+REVEAL_BATCH);render();return}
    if(!exhausted){await loadUntilNewExam();exams=allExams();visibleCount=Math.min(exams.length,visibleCount+REVEAL_BATCH);render();return}
    render();
  })().finally(()=>{loadingPromise=null});
  return loadingPromise;
}
function checkScroll(){
  scrollFrame=0;if(!userHasScrolled)return;const sentinel=$('[data-flow-exam-sentinel]');if(!sentinel||sentinel.dataset.state!=='more')return;
  const rect=sentinel.getBoundingClientRect();if(rect.top<=innerHeight+120&&rect.bottom>=-80)void revealMore();
}
function onScroll(){if(scrollY>24)userHasScrolled=true;if(scrollFrame)return;scrollFrame=requestAnimationFrame(checkScroll)}
function refreshFromDashboard(){[0,120,420,900].forEach(delay=>setTimeout(render,delay))}
function init(){
  ensureStyle();resetHorizon();render();refreshFromDashboard();
  addEventListener('scroll',onScroll,{passive:true});
  document.addEventListener('change',event=>{if(event.target.matches?.('#datePicker'))refreshFromDashboard()});
  document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="today"]'))refreshFromDashboard()});
  addEventListener('focus',()=>queueMicrotask(render),{passive:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
