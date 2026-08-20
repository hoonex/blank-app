import {poiBadgeMarkup} from '/university/poi-icons.js';
const CAMPUS_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-campus';
const PROFILE_KEY='flow-university-profile-v1';
const TIMETABLE_KEY='flow-university-timetable-v1';
const DAY_NAMES=['월','화','수','목','금','토','일'];
const $c=(s)=>document.querySelector(s);const $$c=(s)=>[...document.querySelectorAll(s)];
let campusData=null,campusLoading=null,campusDay=Math.max(0,Math.min(6,(new Date().getDay()+6)%7)),nearbyType='dining';
const routeCache=new Map();

function cRead(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function cEsc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function cProfile(){return cRead(PROFILE_KEY,null)}
function cTimetable(){return cRead(TIMETABLE_KEY,null)}
function cToday(){return (new Date().getDay()+6)%7}
function minText(min){if(!Number.isFinite(min))return'';const v=((min%1440)+1440)%1440;return`${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}`}
function durationText(seconds){const m=Math.max(1,Math.round(Number(seconds||0)/60));return m<60?`${m}분`:`${Math.floor(m/60)}시간 ${m%60?`${m%60}분`:''}`.trim()}
function distanceText(meters){const m=Number(meters||0);return m>=1000?`${(m/1000).toFixed(m>=10000?0:1)}km`:`${Math.round(m/10)*10}m`}
function campusEntries(){const tt=cTimetable();if(!tt?.subjects)return[];return tt.subjects.flatMap((subject,subjectIndex)=>(subject.times||[]).map(time=>({...time,subject,subjectIndex,place:String(time.place||subject.place||'').trim()}))).filter(x=>Number.isFinite(x.day)&&Number.isFinite(x.startMinutes)).sort((a,b)=>a.day-b.day||a.startMinutes-b.startMinutes)}
function dayEntries(day){return campusEntries().filter(x=>x.day===day)}

function injectCampusShell(){
  if(!$c('link[href="/university/campus.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/university/campus.css';document.head.append(link)}
  const sidebarNav=$c('.sidebar .nav');
  if(sidebarNav&&!$c('.sidebar [data-view="campus"]')){
    const b=document.createElement('button');b.className='nav-item';b.dataset.view='campus';b.type='button';b.innerHTML='<strong>캠퍼스</strong><small>강의실 · 이동</small>';
    const school=sidebarNav.querySelector('[data-view="school"]');sidebarNav.insertBefore(b,school||null);
  }
  const bottom=$c('.bottom-nav');
  if(bottom&&!$c('.bottom-nav [data-view="campus"]')){
    const b=document.createElement('button');b.className='bottom-item';b.dataset.view='campus';b.type='button';b.textContent='캠퍼스';
    const school=bottom.querySelector('[data-view="school"]');bottom.insertBefore(b,school||null);
  }
  const main=$c('.main'),schoolView=$c('#schoolView');
  if(main&&schoolView&&!$c('#campusView')){
    const section=document.createElement('section');section.className='view campus-view hidden';section.id='campusView';section.dataset.panel='campus';
    section.innerHTML=`
      <header class="view-header">
        <div><span class="kicker">CAMPUS</span><h1>캠퍼스 이동</h1><p id="campusMeta">수업 장소를 캠퍼스 지도와 이동시간으로 연결합니다.</p></div>
        <button class="soft-button" id="campusRefreshBtn" type="button">위치 다시 찾기</button>
      </header>
      <div class="day-tabs" id="campusDayTabs"></div>
      <div class="campus-layout">
        <article class="panel campus-map-card">
          <div class="campus-map-wrap" id="campusMapWrap"><div class="campus-map-empty">시간표의 강의실 위치를 찾는 중입니다.</div></div>
          <div class="campus-map-note">지도에는 선택한 요일의 수업 장소만 표시합니다. 위치가 애매한 강의실은 목록에서 따로 표시됩니다.</div>
        </article>
        <div class="campus-side">
          <article class="panel campus-next" id="campusNextCard">
            <span>다음 이동</span><h2 id="campusNextTitle">시간표를 확인하세요</h2><p id="campusNextMeta">수업 장소가 있으면 도보 이동시간을 계산합니다.</p>
            <div class="campus-eta"><strong id="campusNextEta">—</strong><span id="campusNextDistance">도보 경로</span></div>
            <div class="campus-actions"><button class="primary-button" id="currentRouteBtn" type="button">현재 위치에서 계산</button><a class="soft-button link-button hidden" id="campusRouteLink" target="_blank" rel="noopener noreferrer">카카오맵 길찾기</a></div>
            <div class="campus-current-result hidden" id="campusCurrentResult"></div>
          </article>
          <article class="panel campus-section"><span class="campus-section-label">CLASS PLACES</span><h2>수업 장소</h2><div class="campus-place-list" id="campusPlaceList"></div></article>
        </div>
      </div>
      <div class="content-grid" style="margin-top:18px">
        <article class="panel campus-section"><span class="campus-section-label">WALK</span><h2>수업 사이 이동</h2><div class="campus-route-list" id="campusRouteList"></div></article>
        <article class="panel campus-section"><span class="campus-section-label">NEARBY</span><h2>캠퍼스 주변</h2><div class="campus-filter" id="campusFilter"><button class="active" data-nearby="dining" type="button">학식</button><button data-nearby="stores" type="button">편의점</button><button data-nearby="cafes" type="button">카페</button><button data-nearby="food" type="button">식당</button></div><div class="campus-nearby-list" id="campusNearbyList"></div></article>
      </div>`;
    main.insertBefore(section,schoolView);
  }
  $$c('[data-view="campus"]').forEach(b=>{if(b.dataset.campusBound)return;b.dataset.campusBound='1';b.addEventListener('click',()=>showCampusView(true))});
  $c('#campusRefreshBtn')?.addEventListener('click',()=>{campusData=null;routeCache.clear();void loadCampus(true)});
  $c('#currentRouteBtn')?.addEventListener('click',routeFromCurrentPosition);
  $c('#campusFilter')?.addEventListener('click',e=>{const b=e.target.closest?.('[data-nearby]');if(!b)return;nearbyType=b.dataset.nearby;$$c('#campusFilter [data-nearby]').forEach(x=>x.classList.toggle('active',x===b));renderNearby()});
}

function showCampusView(push=true){
  const profile=cProfile();if(!profile)return;
  $$c('[data-panel]').forEach(p=>p.classList.toggle('hidden',p.dataset.panel!=='campus'));
  $$c('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view==='campus'));
  if(push&&location.pathname!=='/university/campus')history.pushState({view:'campus'},'', '/university/campus');
  void loadCampus();
}
window.addEventListener('popstate',()=>{if(location.pathname==='/university/campus')setTimeout(()=>showCampusView(false),0)});

function renderCampusDayTabs(){
  const tt=cTimetable(),box=$c('#campusDayTabs');if(!box)return;
  if(!tt){box.innerHTML='';return}
  const days=[...new Set(campusEntries().map(x=>x.day))].sort((a,b)=>a-b);
  if(!days.length){box.innerHTML='';return}
  if(!days.includes(campusDay))campusDay=days.includes(cToday())?cToday():days[0];
  box.innerHTML=days.map(d=>`<button class="day-tab${d===campusDay?' active':''}" type="button" data-campus-day="${d}">${DAY_NAMES[d]}</button>`).join('');
  box.querySelectorAll('[data-campus-day]').forEach(b=>b.addEventListener('click',()=>{campusDay=Number(b.dataset.campusDay);renderCampusDayTabs();void renderCampus()}));
}
function resolutionFor(raw){return campusData?.places?.find(x=>String(x.raw).trim()===String(raw).trim())||null}
function resolvedPlace(raw){const r=resolutionFor(raw);return r?.resolved?r.place:null}
function uniqueDayPlaces(day){const out=[];const seen=new Set();for(const e of dayEntries(day)){if(!e.place)continue;const key=e.place.toLowerCase();if(seen.has(key))continue;seen.add(key);out.push({raw:e.place,entry:e,resolution:resolutionFor(e.place)})}return out}
function staticMapUrl(day){
  const center=campusData?.center;if(!center?.x||!center?.y)return'';
  const points=uniqueDayPlaces(day).map(x=>x.resolution?.resolved?x.resolution.place:null).filter(Boolean);
  const unique=[];const seen=new Set();for(const p of points){const k=`${p.x},${p.y}`;if(!seen.has(k)){seen.add(k);unique.push(p)}}
  const url=new URL(CAMPUS_EDGE);url.searchParams.set('action','static-map');url.searchParams.set('center',`${center.x},${center.y}`);if(unique.length)url.searchParams.set('markers',unique.slice(0,5).map(p=>`${p.x},${p.y}`).join(';'));url.searchParams.set('lv',unique.length>1?'4':'3');return url.toString()
}
function renderMap(){const box=$c('#campusMapWrap');if(!box)return;const src=staticMapUrl(campusDay),places=uniqueDayPlaces(campusDay),resolved=places.filter(x=>x.resolution?.resolved).length;if(!src){box.innerHTML='<div class="campus-map-empty">캠퍼스 위치를 찾지 못했습니다.</div>';return}box.innerHTML=`<img src="${cEsc(src)}" alt="${cEsc(cProfile()?.name||'대학교')} 수업 장소 지도"><div class="campus-map-badge">${DAY_NAMES[campusDay]}요일 · ${resolved}/${places.length||0}개 장소 확인</div>`}
function renderPlaces(){const box=$c('#campusPlaceList');if(!box)return;const list=uniqueDayPlaces(campusDay);if(!list.length){box.innerHTML='<div class="campus-status">이 요일에는 장소가 입력된 수업이 없습니다.</div>';return}box.innerHTML=list.map((x,i)=>{const r=x.resolution,p=r?.place,ok=r?.resolved;const meta=ok?[p.name,r.confidence<45?'위치 추정':'카카오 장소 확인'].filter(Boolean).join(' · '):'위치를 자동으로 찾지 못했습니다.';return `${ok&&p.url?`<a class="campus-place" href="${cEsc(p.url)}" target="_blank" rel="noopener noreferrer">`:'<div class="campus-place">'}<span class="campus-pin${ok?'':' unresolved'}">${i+1}</span><span><strong>${cEsc(x.raw)}</strong><small>${cEsc(meta)}</small></span><span class="campus-distance">${ok&&p.distance?distanceText(p.distance):ok?'확인':'—'}</span>${ok&&p.url?'</a>':'</div>'}`}).join('')}

async function campusApi(action,payload){const url=new URL(CAMPUS_EDGE);url.searchParams.set('action',action);const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||'캠퍼스 정보를 불러오지 못했습니다.');return body}
async function fetchRoute(start,end,startName,endName){if(!start?.x||!end?.x)return null;const key=`${start.x},${start.y}>${end.x},${end.y}`;if(routeCache.has(key))return routeCache.get(key);const promise=campusApi('route',{start,end,startName,endName}).then(x=>x.route).catch(()=>null);routeCache.set(key,promise);return promise}
async function renderRoutes(){
  const box=$c('#campusRouteList');if(!box)return;const list=dayEntries(campusDay).filter(x=>x.place);if(list.length<2){box.innerHTML='<div class="campus-status">이어지는 수업 장소가 2개 이상이면 이동시간을 계산합니다.</div>';return}
  box.innerHTML='<div class="campus-status">도보 경로 계산 중…</div>';
  const rows=[];
  for(let i=0;i<list.length-1;i++){
    const a=list[i],b=list[i+1],pa=resolvedPlace(a.place),pb=resolvedPlace(b.place);if(!pa||!pb)continue;
    if(pa.x===pb.x&&pa.y===pb.y){rows.push({a,b,route:{status:'OK',distance:0,time:0,landingUrl:pb.url},same:true});continue}
    const route=await fetchRoute(pa,pb,a.place,b.place);if(route?.status==='OK')rows.push({a,b,route});
  }
  if(!rows.length){box.innerHTML='<div class="campus-status">자동으로 연결할 수 있는 수업 간 이동 경로가 없습니다.</div>';return}
  box.innerHTML=rows.map(r=>`<a class="campus-route" href="${cEsc(r.route.landingUrl||'#')}" ${r.route.landingUrl?'target="_blank" rel="noopener noreferrer"':''}><span class="campus-pin">→</span><span><strong>${cEsc(r.a.place)} → ${cEsc(r.b.place)}</strong><small>${cEsc(`${r.a.end} 종료 · ${r.b.start} 시작${r.same?' · 같은 장소':''}`)}</small></span><span class="campus-distance">${r.same?'이동 없음':`${durationText(r.route.time)} · ${distanceText(r.route.distance)}`}</span></a>`).join('')
}
function nextUpcoming(){const day=cToday();const now=new Date(),mins=now.getHours()*60+now.getMinutes();const list=dayEntries(day).filter(x=>x.place);const next=list.find(x=>x.startMinutes>mins);if(!next)return null;const idx=list.indexOf(next),current=list.find(x=>x.startMinutes<=mins&&x.endMinutes>mins),prev=current||list.slice(0,idx).at(-1)||null;return{next,from:prev,mins}}
async function renderNext(){
  const title=$c('#campusNextTitle'),meta=$c('#campusNextMeta'),eta=$c('#campusNextEta'),dist=$c('#campusNextDistance'),link=$c('#campusRouteLink');if(!title)return;
  link?.classList.add('hidden');const n=nextUpcoming();if(!n){title.textContent='오늘 남은 이동 없음';meta.textContent='오늘의 다음 수업이 없거나 강의실 정보가 없습니다.';eta.textContent='—';dist.textContent='도보 경로';return}
  title.textContent=n.next.subject?.name||'다음 수업';meta.textContent=[n.next.start,n.next.place].filter(Boolean).join(' · ');const dest=resolvedPlace(n.next.place);if(!dest){eta.textContent='위치 확인 필요';dist.textContent=n.next.place;return}
  if(!n.from||!resolvedPlace(n.from.place)){eta.textContent='현재 위치로 계산';dist.textContent='첫 수업 이동';return}
  const start=resolvedPlace(n.from.place);if(start.x===dest.x&&start.y===dest.y){eta.textContent='이동 없음';dist.textContent='같은 장소';return}
  const route=await fetchRoute(start,dest,n.from.place,n.next.place);if(route?.status!=='OK'){eta.textContent='경로 없음';dist.textContent='카카오 도보 경로 미탐색';return}
  eta.textContent=durationText(route.time);dist.textContent=`${distanceText(route.distance)} · ${minText(n.next.startMinutes-Math.ceil(route.time/60)-3)} 출발 권장`;if(link&&route.landingUrl){link.href=route.landingUrl;link.classList.remove('hidden')}
}
function renderNearby(){const box=$c('#campusNearbyList');if(!box)return;const label={dining:'학식',stores:'편의점',cafes:'카페',food:'식당'}[nearbyType]||'주변';const list=campusData?.nearby?.[nearbyType]||[];if(!list.length){box.innerHTML=`<div class="campus-status">카카오맵에서 확인되는 ${label} 장소가 없습니다.</div>`;return}box.innerHTML=list.slice(0,7).map(p=>`<a class="campus-nearby" href="${cEsc(p.url||'#')}" target="_blank" rel="noopener noreferrer">${poiBadgeMarkup(nearbyType,p)}<span><strong>${cEsc(p.name)}</strong><small>${cEsc(p.category||p.roadAddress||p.address||'')}</small></span><span class="campus-distance">${p.distance?distanceText(p.distance):''}</span></a>`).join('')}
async function renderCampus(){if(!campusData)return;renderCampusDayTabs();renderMap();renderPlaces();renderNearby();await Promise.all([renderRoutes(),renderNext()])}

async function loadCampus(force=false){
  const profile=cProfile(),tt=cTimetable();if(!profile)return;if(campusData&&!force){await renderCampus();return}if(campusLoading&&!force)return campusLoading;
  const meta=$c('#campusMeta'),map=$c('#campusMapWrap');if(meta)meta.textContent='강의실 이름을 카카오 장소와 연결하는 중입니다.';if(map)map.innerHTML='<div class="campus-map-empty">강의실 위치를 찾는 중입니다.</div>';
  const items=tt?campusEntries().map(x=>({day:x.day,start:x.start,end:x.end,startMinutes:x.startMinutes,endMinutes:x.endMinutes,place:x.place,subject:x.subject?.name||''})):[];
  campusLoading=campusApi('campus',{schoolName:profile.name,address:profile.address,items}).then(async data=>{campusData=data;if(meta)meta.textContent=tt?`${profile.name} · 시간표 강의실 ${data.places?.length||0}곳 분석`:`${profile.name} 캠퍼스`;await renderCampus();return data}).catch(e=>{if(meta)meta.textContent=e.message;if(map)map.innerHTML=`<div class="campus-map-empty">${cEsc(e.message)}</div>`}).finally(()=>{campusLoading=null});return campusLoading
}

async function routeFromCurrentPosition(){
  const button=$c('#currentRouteBtn'),result=$c('#campusCurrentResult');const n=nextUpcoming();if(!n){result.textContent='오늘 남은 다음 수업이 없습니다.';result.classList.remove('hidden');return}const dest=resolvedPlace(n.next.place);if(!dest){result.textContent=`${n.next.place} 위치를 먼저 확인해야 합니다.`;result.classList.remove('hidden');return}if(!navigator.geolocation){result.textContent='이 브라우저는 위치 기능을 지원하지 않습니다.';result.classList.remove('hidden');return}
  button.disabled=true;button.textContent='현재 위치 확인 중…';navigator.geolocation.getCurrentPosition(async pos=>{try{button.textContent='도보 경로 계산 중…';const start={x:String(pos.coords.longitude),y:String(pos.coords.latitude)};window.dispatchEvent(new CustomEvent('flow:campus-current-position',{detail:{lat:Number(pos.coords.latitude),lng:Number(pos.coords.longitude),accuracy:Number(pos.coords.accuracy||0)}}));const route=await fetchRoute(start,dest,'현재 위치',n.next.place);if(route?.status==='OK'){window.dispatchEvent(new CustomEvent('flow:campus-current-route',{detail:{start,destination:dest,route,targetName:n.next.place}}));const leave=n.next.startMinutes-Math.ceil(route.time/60)-3;result.innerHTML=`<strong>현재 위치 → ${cEsc(n.next.place)}</strong><br>도보 ${durationText(route.time)} · ${distanceText(route.distance)} · ${minText(leave)}까지 출발 권장${route.landingUrl?`<br><a href="${cEsc(route.landingUrl)}" target="_blank" rel="noopener noreferrer">카카오맵에서 경로 열기</a>`:''}`;result.classList.remove('hidden')}else{result.textContent='현재 위치에서 도보 경로를 찾지 못했습니다.';result.classList.remove('hidden')}}finally{button.disabled=false;button.textContent='현재 위치에서 계산'}},err=>{result.textContent=err.code===1?'위치 권한을 허용하면 현재 위치에서 이동시간을 계산할 수 있습니다.':'현재 위치를 가져오지 못했습니다.';result.classList.remove('hidden');button.disabled=false;button.textContent='현재 위치에서 계산'},{enableHighAccuracy:false,timeout:8000,maximumAge:60000})
}

injectCampusShell();
if(location.pathname==='/university/campus')setTimeout(()=>showCampusView(false),0);
