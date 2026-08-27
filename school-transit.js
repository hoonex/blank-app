const TRANSIT_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-data';
const PROFILE_KEY='flow-school-profile-v3';
const REFRESH_MS=30000;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

let lastCoords=null;
let refreshTimer=0;
let requestAbort=null;
let loading=false;

function profile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]))}
function active(){return location.pathname==='/transit'&&!$('#transitView')?.classList.contains('hidden')}
function schoolDestination(){
  const school=profile()?.school||{};
  return{
    name:school.name||'선택한 학교',
    query:[school.address,school.addressDetail].filter(Boolean).join(' ').trim()||school.name||'',
    address:[school.address,school.addressDetail].filter(Boolean).join(' ').trim(),
  };
}
function installStyle(){
  if($('link[data-flow-school-transit]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='/school-transit.css?v=20260827-1';link.dataset.flowSchoolTransit='';document.head.append(link);
}
function navButton(kind){
  const button=document.createElement('button');button.type='button';button.dataset.view='transit';button.dataset.flowTransitNav='';
  if(kind==='desktop'){
    button.className='nav-item';button.innerHTML='<span>교통</span><small>버스 · 지하철</small>';
  }else{
    button.className='mobile-tab';button.innerHTML='<span>교통</span>';
  }
  button.addEventListener('click',()=>showTransit({push:true}));
  return button;
}
function installNavigation(){
  const side=$('.side-nav');
  if(side&&!$('[data-flow-transit-nav]',side)){
    const button=navButton('desktop'),schedule=$('[data-view="schedule"]',side);schedule?.after(button);
  }
  const bottom=$('#bottomNav');
  if(bottom&&!$('[data-flow-transit-nav]',bottom)){
    const button=navButton('mobile'),schedule=$('[data-view="schedule"]',bottom);schedule?.after(button);
  }
}
function installView(){
  if($('#transitView'))return;
  const main=$('.product-main');if(!main)return;
  const footer=$('.source-note',main);
  const section=document.createElement('section');
  section.className='view hidden';section.id='transitView';section.dataset.viewPanel='transit';
  section.innerHTML=`
    <header class="view-header flow-transit-header">
      <div><h1>교통</h1><p>현재 위치에서 학교까지 버스 · 지하철 · 도보 경로를 비교합니다.</p></div>
      <button class="neo-button compact flow-transit-refresh" id="transitRefreshBtn" type="button" disabled>새로고침</button>
    </header>
    <article class="content-card neo-panel flow-transit-search">
      <div class="flow-transit-endpoints" aria-label="이동 구간">
        <div><span>출발</span><strong>현재 위치</strong><small id="transitLocationCopy">위치 권한은 검색할 때만 사용합니다.</small></div>
        <i aria-hidden="true"></i>
        <div><span>도착</span><strong id="transitSchoolName">선택한 학교</strong><small id="transitSchoolAddress"></small></div>
      </div>
      <button class="primary-button flow-transit-locate" id="transitLocateBtn" type="button">현재 위치에서 찾기</button>
      <div class="flow-transit-state" id="transitState" role="status" aria-live="polite">검색하면 최대 5개의 대중교통 경로를 비교합니다.</div>
    </article>
    <div class="flow-transit-summary hidden" id="transitSummary"></div>
    <section class="flow-transit-routes" id="transitRoutes" aria-label="추천 교통 경로"></section>`;
  if(footer)main.insertBefore(section,footer);else main.append(section);
  $('#transitLocateBtn')?.addEventListener('click',()=>locateAndLoad({manual:true}));
  $('#transitRefreshBtn')?.addEventListener('click',()=>locateAndLoad({manual:true,refresh:true}));
}
function syncDestination(){
  const destination=schoolDestination();
  if($('#transitSchoolName'))$('#transitSchoolName').textContent=destination.name;
  if($('#transitSchoolAddress'))$('#transitSchoolAddress').textContent=destination.address||'학교 위치를 자동으로 찾습니다.';
}
function setState(message,kind='neutral'){
  const state=$('#transitState');if(!state)return;state.textContent=message;state.dataset.kind=kind;
}
function setLoading(on){
  loading=on;
  $('#transitLocateBtn')?.toggleAttribute('disabled',on);
  $('#transitRefreshBtn')?.toggleAttribute('disabled',on||!lastCoords);
  $('#transitView')?.classList.toggle('is-loading',on);
}
function stopRefresh(){clearTimeout(refreshTimer);refreshTimer=0}
function scheduleRefresh(){
  stopRefresh();if(!active()||!lastCoords||document.hidden)return;
  refreshTimer=setTimeout(()=>{if(active()&&!document.hidden)locateAndLoad({background:true,refresh:true});},REFRESH_MS);
}
function showTransit({push=true}={}){
  installNavigation();installView();syncDestination();
  $$('[data-view-panel]').forEach(panel=>panel.classList.toggle('hidden',panel.id!=='transitView'));
  $$('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view==='transit'));
  if(push&&location.pathname!=='/transit')history.pushState({view:'transit'},'', '/transit');
  if(lastCoords)scheduleRefresh();
}
function leaveTransit(){stopRefresh();requestAbort?.abort();requestAbort=null;$$('[data-flow-transit-nav]').forEach(button=>button.classList.remove('active'))}
function locate({maximumAge=15000}={}){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation)return reject(new Error('이 브라우저에서는 위치 기능을 사용할 수 없습니다.'));
    navigator.geolocation.getCurrentPosition(
      position=>resolve({x:position.coords.longitude,y:position.coords.latitude,accuracy:position.coords.accuracy}),
      error=>{
        if(error.code===1)reject(new Error('위치 권한이 필요합니다. 브라우저 설정에서 위치 접근을 허용해주세요.'));
        else if(error.code===2)reject(new Error('현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.'));
        else reject(new Error('위치 확인 시간이 초과됐습니다. 다시 시도해주세요.'));
      },
      {enableHighAccuracy:false,timeout:9000,maximumAge},
    );
  });
}
async function fetchRoutes(coords){
  const destination=schoolDestination();if(!destination.query)throw new Error('먼저 학교를 선택해주세요.');
  requestAbort?.abort();requestAbort=new AbortController();
  const url=new URL(TRANSIT_EDGE);url.searchParams.set('action','route');url.searchParams.set('sx',String(coords.x));url.searchParams.set('sy',String(coords.y));url.searchParams.set('destination',destination.query);
  const response=await fetch(url,{signal:requestAbort.signal});const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'교통 경로를 불러오지 못했습니다.');return body;
}
function clock(iso){
  const date=new Date(iso);if(Number.isNaN(date.getTime()))return'—';return new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
}
function won(value){return Number(value)>0?`${new Intl.NumberFormat('ko-KR').format(Number(value))}원`:'요금 정보 없음'}
function segmentLabel(segment){
  if(segment.type==='walk')return`도보 ${segment.minutes}분`;
  const line=(segment.lines||[]).join(' · ')||(segment.type==='bus'?'버스':'지하철');
  return`${line} ${segment.minutes}분`;
}
function segmentDetail(segment){
  if(segment.type==='walk')return`도보 · ${Math.round(Number(segment.distance)||0)}m · 약 ${segment.minutes}분`;
  const line=(segment.lines||[]).join(' · ')||(segment.type==='bus'?'버스':'지하철');
  const stations=segment.stationCount?`${segment.stationCount}정거장`:'';
  const direction=segment.direction?` · ${esc(segment.direction)} 방면`:'';
  return`${esc(line)} · ${esc(segment.startName||'승차')} → ${esc(segment.endName||'하차')}${stations?` · ${stations}`:''}${direction} · 약 ${segment.minutes}분`;
}
function routeRealtime(route){
  const legs=Array.isArray(route?.realtimeLegs)?route.realtimeLegs.filter(Boolean):[];
  return legs.length?legs:(route?.realtime?[route.realtime]:[]);
}
function liveRow(live,index){
  const transfer=Number(live?.legIndex)>0||index>0;
  const label=transfer?'환승 실시간':'실시간';
  const timing=transfer?`환승 후 ${Math.max(0,Number(live.waitAddedMinutes)||0)}분 대기`:`${Math.max(0,Number(live.arrivalMinutes)||0)}분 후`;
  const stops=Number.isFinite(Number(live?.stops))?` · ${Number(live.stops)}정거장 전`:'';
  return`<div class="flow-transit-live" data-live-leg="${index}"><b>${label}</b><span>${esc(live?.routeNo||'버스')} · ${timing}${stops}</span></div>`;
}
function routeCard(route,index){
  const badges=(route.badges||[]).map(badge=>`<span>${esc(badge)}</span>`).join('');
  const liveCopy=routeRealtime(route).map(liveRow).join('');
  const chips=(route.segments||[]).filter(segment=>segment.minutes||segment.type!=='walk').map(segment=>`<span class="flow-transit-segment-chip ${esc(segment.type)}">${esc(segmentLabel(segment))}</span>`).join('<i aria-hidden="true">›</i>');
  const steps=(route.segments||[]).map((segment,step)=>`<li><b>${step+1}</b><span>${segmentDetail(segment)}</span></li>`).join('');
  return`<article class="content-card neo-panel flow-transit-route${index===0?' is-best':''}" data-transit-route="${index}">
    <div class="flow-transit-route-top">
      <div class="flow-transit-badges">${badges||`<span>경로 ${index+1}</span>`}</div>
      <div class="flow-transit-time"><strong>${route.totalMinutes}분</strong><span>${clock(route.arrivalAt)} 도착</span></div>
    </div>
    ${liveCopy}
    <div class="flow-transit-segments">${chips}</div>
    <div class="flow-transit-meta"><span>환승 ${route.transfers}회</span><span>도보 ${Math.round(route.walkMeters||0)}m</span><span>${won(route.payment)}</span></div>
    <details class="flow-transit-details"${index===0?' open':''}><summary>경로 상세</summary><ol>${steps}</ol></details>
  </article>`;
}
function renderRoutes(body){
  const routes=Array.isArray(body?.routes)?body.routes:[];if(!routes.length)throw new Error('표시할 교통 경로가 없습니다.');
  const realtime=routes.some(route=>routeRealtime(route).length>0);
  const multi=routes.some(route=>routeRealtime(route).length>1);
  const summary=$('#transitSummary');
  if(summary){
    summary.classList.remove('hidden');
    const title=multi?'환승 버스까지 실시간 도착을 반영했습니다.':realtime?'실시간 버스 도착을 일부 반영했습니다.':'예상 소요시간 기준 경로입니다.';
    const detail=multi?'환승 지점 도착 이후 탈 수 있는 다음 버스를 골라 대기시간을 보정합니다.':realtime?'버스 도착정보가 있는 승차 구간의 대기시간을 보정합니다.':'실시간 도착정보가 없는 구간은 평균 이동시간을 사용합니다.';
    summary.innerHTML=`<strong>${title}</strong><span>${detail}</span>`;
  }
  $('#transitRoutes').innerHTML=routes.map(routeCard).join('');
  window.dispatchEvent(new CustomEvent('flow:transit-routes-rendered',{detail:{routes,generatedAt:body?.generatedAt||new Date().toISOString()}}));
  const generated=new Date(body.generatedAt||Date.now());
  setState(`${routes.length}개 경로 · ${new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(generated)} 갱신`,realtime?'live':'neutral');
}
async function locateAndLoad({manual=false,background=false,refresh=false}={}){
  if(loading)return;if(!active()&&!manual)return;
  setLoading(true);if(!background)setState(refresh?'현재 위치와 교통 상황을 다시 확인하는 중…':'현재 위치를 확인하는 중…','loading');
  try{
    const coords=await locate({maximumAge:refresh?10000:30000});lastCoords=coords;
    const accuracy=Number(coords.accuracy);if($('#transitLocationCopy'))$('#transitLocationCopy').textContent=Number.isFinite(accuracy)?`현재 위치 · 약 ${Math.max(10,Math.round(accuracy/10)*10)}m 정확도`:'현재 위치';
    if(!background)setState('버스 · 지하철 경로를 비교하는 중…','loading');
    const body=await fetchRoutes(coords);renderRoutes(body);
  }catch(error){
    if(error?.name==='AbortError')return;
    setState(error instanceof Error?error.message:'교통 정보를 불러오지 못했습니다.','error');
    if(!background)$('#transitRoutes').innerHTML='';
  }finally{setLoading(false);scheduleRefresh()}
}
function handleNavigationClick(event){
  const destination=event.target.closest?.('[data-view]');
  if(destination&&destination.dataset.view!=='transit')leaveTransit();
}
function handlePopState(){
  if(location.pathname==='/transit')showTransit({push:false});else leaveTransit();
}
function init(){
  installStyle();installNavigation();installView();syncDestination();
  document.addEventListener('click',handleNavigationClick,{capture:true});
  window.addEventListener('popstate',()=>queueMicrotask(handlePopState));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRefresh();else if(active()&&lastCoords)scheduleRefresh()});
  if(location.pathname==='/transit')queueMicrotask(()=>showTransit({push:false}));
  document.documentElement.dataset.flowTransit='ready';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
