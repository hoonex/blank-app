const CAMPUS_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-campus';
const PROFILE_KEY='flow-university-profile-v1';
const TIMETABLE_KEY='flow-university-timetable-v1';
const CACHE_PREFIX='flow-dashboard-campus-v1:';
const LOCAL_HOSTS=new Set(['localhost','127.0.0.1','::1']);
let campusData=null,campusSignature='',campusPromise=null;
const routeCache=new Map();
let claimed=false,refreshTimer=null;

function read(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function todayIndex(){return(new Date().getDay()+6)%7}
function minuteText(n){if(!Number.isFinite(n))return'';const v=((Math.round(n)%1440)+1440)%1440;return`${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`}
function durationText(seconds){const min=Math.max(1,Math.round(Number(seconds||0)/60));return min<60?`${min}분`:`${Math.floor(min/60)}시간${min%60?` ${min%60}분`:''}`}
function distanceText(meters){const m=Math.max(0,Number(meters||0));if(!m)return'';return m>=1000?`${(m/1000).toFixed(m>=10000?0:1)}km`:`${Math.max(10,Math.round(m/10)*10)}m`}
function setText(el,value){if(el&&el.textContent!==value)el.textContent=value}
function profile(){return read(PROFILE_KEY,null)}
function timetable(){return read(TIMETABLE_KEY,null)}
function entries(){const tt=timetable();if(!tt?.subjects)return[];return tt.subjects.flatMap(subject=>(subject.times||[]).map(time=>({...time,subject,place:String(time.place||subject.place||'').trim()}))).filter(x=>Number.isFinite(x.day)&&Number.isFinite(x.startMinutes)&&Number.isFinite(x.endMinutes)).sort((a,b)=>a.day-b.day||a.startMinutes-b.startMinutes)}
function todayEntries(){return entries().filter(x=>x.day===todayIndex()&&x.place)}
function nextContext(){const list=todayEntries(),now=new Date(),mins=now.getHours()*60+now.getMinutes();const next=list.find(x=>x.startMinutes>mins);if(!next)return null;const index=list.indexOf(next),current=list.find(x=>x.startMinutes<=mins&&x.endMinutes>mins),previous=current||list.slice(0,index).at(-1)||null;return{next,previous,mins}}
function signature(){const p=profile(),tt=timetable();if(!p||!tt)return'';return`${p.id||''}|${p.name||''}|${p.address||''}|${tt.year||''}|${tt.semester||''}|${entries().map(x=>`${x.day}:${x.startMinutes}:${x.endMinutes}:${x.place}`).join('|')}`}
function hash(value){let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}
function widgetParts(){const widget=document.querySelector('[data-widget-id="campus"]');if(!widget)return null;const title=widget.querySelector('#widgetCampusLiveTitle,#widgetCampusTitle');const meta=widget.querySelector('#widgetCampusLiveMeta,#widgetCampusMeta');const button=widget.querySelector('#widgetCampusBtn');if(!title||!meta)return null;if(!claimed){title.id='widgetCampusLiveTitle';meta.id='widgetCampusLiveMeta';claimed=true}return{widget,title,meta,button}}
function widgetVisible(parts){return parts&&!parts.widget.classList.contains('widget-hidden')}
function remoteAllowed(){return !LOCAL_HOSTS.has(location.hostname)||sessionStorage.getItem('flow-dashboard-campus-test')==='1'}
async function campusApi(action,payload){const url=new URL(CAMPUS_EDGE);url.searchParams.set('action',action);const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'캠퍼스 정보를 불러오지 못했습니다.');return body}
function resolution(data,raw){const row=data?.places?.find(x=>String(x.raw||'').trim()===String(raw||'').trim());return row?.resolved?row.place:null}
async function getCampusData(){const p=profile(),tt=timetable(),sig=signature();if(!p||!tt||!sig)return null;if(campusData&&campusSignature===sig)return campusData;if(campusPromise&&campusSignature===sig)return campusPromise;campusSignature=sig;const cacheKey=`${CACHE_PREFIX}${hash(sig)}`;try{const cached=JSON.parse(sessionStorage.getItem(cacheKey)||'null');if(cached?.data&&Date.now()-Number(cached.savedAt||0)<6*3600000){campusData=cached.data;return campusData}}catch{}
  const items=entries().filter(x=>x.place).map(x=>({day:x.day,start:x.start,end:x.end,startMinutes:x.startMinutes,endMinutes:x.endMinutes,place:x.place,subject:x.subject?.name||''}));
  campusPromise=campusApi('campus',{schoolName:p.name,address:p.address,items}).then(data=>{campusData=data;try{sessionStorage.setItem(cacheKey,JSON.stringify({savedAt:Date.now(),data}))}catch{}return data}).finally(()=>{campusPromise=null});return campusPromise
}
async function getRoute(start,end,startName,endName){if(!start?.x||!start?.y||!end?.x||!end?.y)return null;if(String(start.x)===String(end.x)&&String(start.y)===String(end.y))return{status:'OK',time:0,distance:0,same:true};const key=`${start.x},${start.y}>${end.x},${end.y}`;if(routeCache.has(key))return routeCache.get(key);const promise=campusApi('route',{start,end,startName,endName}).then(x=>x.route).catch(()=>null);routeCache.set(key,promise);return promise}
function basicState(parts,ctx){if(!ctx){setText(parts.title,'오늘 이동 없음');setText(parts.meta,'남은 강의실 이동이 없습니다.');if(parts.button)setText(parts.button,'캠퍼스 보기');return false}setText(parts.title,ctx.next.place||ctx.next.subject?.name||'다음 강의실');setText(parts.meta,[ctx.next.start,ctx.next.subject?.name].filter(Boolean).join(' · ')||'캠퍼스 이동을 확인합니다.');if(parts.button)setText(parts.button,'캠퍼스 보기');return true}
async function refresh(){clearTimeout(refreshTimer);const parts=widgetParts();if(!parts||!widgetVisible(parts))return;const ctx=nextContext();if(!basicState(parts,ctx)||!remoteAllowed())return;try{const data=await getCampusData();if(!data)return;const destination=resolution(data,ctx.next.place);if(!destination){setText(parts.meta,`${ctx.next.start||minuteText(ctx.next.startMinutes)} · 위치 확인 필요`);return}if(!ctx.previous){setText(parts.meta,`${ctx.next.start||minuteText(ctx.next.startMinutes)} · 첫 수업 · 위치 확인`);return}const start=resolution(data,ctx.previous.place);if(!start){setText(parts.meta,`${ctx.next.start||minuteText(ctx.next.startMinutes)} · 출발 위치 확인 필요`);return}const route=await getRoute(start,destination,ctx.previous.place,ctx.next.place);if(!route||route.status!=='OK'){setText(parts.meta,`${ctx.next.start||minuteText(ctx.next.startMinutes)} · 경로 확인 필요`);return}if(route.same||Number(route.distance||0)===0){setText(parts.meta,'같은 장소 · 이동 없음');if(parts.button)setText(parts.button,'강의실 보기');parts.widget.dataset.campusEta='0';return}const walkMin=Math.max(1,Math.ceil(Number(route.time||0)/60)),leave=ctx.next.startMinutes-walkMin-3,distance=distanceText(route.distance);setText(parts.meta,`도보 ${durationText(route.time)}${distance?` · ${distance}`:''} · ${minuteText(leave)} 출발 권장`);if(parts.button)setText(parts.button,'경로 자세히');parts.widget.dataset.campusEta=String(walkMin);parts.widget.dataset.campusDistance=String(Number(route.distance||0));parts.widget.dataset.campusLeave=minuteText(leave)}catch{setText(parts.meta,`${ctx.next.start||minuteText(ctx.next.startMinutes)} · 캠퍼스에서 경로 확인`)}
function schedule(delay=180){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>void refresh(),delay)}
function invalidate(){campusData=null;campusSignature='';campusPromise=null;routeCache.clear();schedule(220)}
function waitForWidget(attempt=0){const parts=widgetParts();if(parts){schedule(120);return}if(attempt<24)setTimeout(()=>waitForWidget(attempt+1),100)}
window.addEventListener('flow:timetable-changed',invalidate);
window.addEventListener('storage',event=>{if(event.key===TIMETABLE_KEY||event.key===PROFILE_KEY)invalidate()});
window.addEventListener('popstate',()=>schedule(160));
document.addEventListener('click',event=>{if(event.target.closest?.('[data-view="today"],#widgetDoneBtn,[data-picker-id="campus"],#runImportBtn,#personalForm,#deletePersonalBtn'))schedule(220)},{passive:true});
setInterval(()=>schedule(80),60000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>waitForWidget(),{once:true});else waitForWidget();
