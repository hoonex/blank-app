const TRANSIT_MAP_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-map';
/* Kakao JavaScript app keys are browser-facing identifiers by provider design. */
const KAKAO_JS_KEY='cc0aae65f94df3b64e5d231dd3a9963a';
const PROFILE_KEY='flow-school-profile-v3';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let sdkPromise=null;
let currentRoutes=[];
let activeSheet=null;
let activeTrigger=null;
let activeController=null;
let currentMap=null;
let currentLayers=[];
let renderToken=0;

function profile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
function region(){return String(profile()?.school?.address||'').trim().split(/\s+/)[0]||''}
function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function installStyle(){
  if($('link[data-flow-transit-map]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='/school-transit-map.css?v=20260828-2';link.dataset.flowTransitMap='';document.head.append(link);
}
function loadSdk(){
  if(window.kakao?.maps?.Map)return Promise.resolve(true);
  if(['localhost','127.0.0.1','::1'].includes(location.hostname))return Promise.resolve(Boolean(window.kakao?.maps?.Map));
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise(resolve=>{
    const existing=$('script[data-flow-kakao-transit-map]');
    const script=existing||document.createElement('script');
    const finish=ok=>{if(!ok){script.remove();sdkPromise=null}resolve(ok)};
    if(!existing){
      script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JS_KEY)}&autoload=false`;
      script.async=true;script.dataset.flowKakaoTransitMap='';document.head.append(script);
    }
    const ready=()=>{try{kakao.maps.load(()=>finish(Boolean(kakao.maps.Map)))}catch{finish(false)}};
    if(window.kakao?.maps?.load)ready();
    else{script.addEventListener('load',ready,{once:true});script.addEventListener('error',()=>finish(false),{once:true})}
  });
  return sdkPromise;
}
function mapCapable(route){return(route?.segments||[]).some(segment=>segment.type==='bus'&&segment.startId&&segment.endId&&(segment.lines||[]).length)}
function decorateCards(){
  $$('[data-transit-route]').forEach((card,index)=>{
    card.querySelector('.flow-transit-map-toggle')?.remove();
    if(!mapCapable(currentRoutes[index]))return;
    const details=card.querySelector('.flow-transit-details');
    const button=document.createElement('button');
    button.type='button';button.className='neo-button compact flow-transit-map-toggle';button.dataset.transitMapToggle=String(index);button.textContent='지도 보기';
    button.setAttribute('aria-expanded','false');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','flowTransitMapDialog');
    if(details)card.insertBefore(button,details);else card.append(button);
  });
}
function clearLayers(){
  for(const layer of currentLayers)try{layer.setMap?.(null)}catch{}
  currentLayers=[];currentMap=null;
}
function closeMap({restoreFocus=true}={}){
  renderToken+=1;
  activeController?.abort();activeController=null;
  clearLayers();
  const trigger=activeTrigger;
  if(trigger)trigger.setAttribute('aria-expanded','false');
  activeSheet?.remove();activeSheet=null;activeTrigger=null;
  document.body.classList.remove('flow-transit-map-open');
  if(restoreFocus&&trigger?.isConnected)requestAnimationFrame(()=>trigger.focus({preventScroll:true}));
}
function point(item){
  const x=Number(item?.x),y=Number(item?.y);
  return Number.isFinite(x)&&Number.isFinite(y)&&window.kakao?.maps?new kakao.maps.LatLng(y,x):null;
}
function pinNode(kind,label='',station=''){
  const node=document.createElement('span');node.className=`flow-transit-map-pin ${kind}`;
  node.innerHTML=`<i aria-hidden="true"></i><b><span>${esc(label)}</span>${station?`<small>${esc(station)}</small>`:''}</b>`;
  return node;
}
function stopDot(){const node=document.createElement('i');node.className='flow-transit-map-stop';return node}
function vehicleNode(line){
  const node=document.createElement('span');node.className='flow-transit-map-vehicle';node.innerHTML=`<i aria-hidden="true"></i><b>${esc(line||'버스')}</b>`;return node;
}
async function fetchLeg(segment,signal){
  const url=new URL(TRANSIT_MAP_EDGE);
  url.searchParams.set('action','route-map');url.searchParams.set('region',region());url.searchParams.set('line',String(segment.lines?.[0]||''));
  url.searchParams.set('startId',String(segment.startId||''));url.searchParams.set('endId',String(segment.endId||''));
  url.searchParams.set('startName',String(segment.startName||''));url.searchParams.set('endName',String(segment.endName||''));
  const response=await fetch(url,{signal});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'버스 지도 정보를 불러오지 못했습니다.');return body;
}
function setStatus(sheet,text,kind='neutral'){
  const status=$('.flow-transit-map-status',sheet);if(status){status.textContent=text;status.dataset.kind=kind}
}
function legChip(bus,index,total){
  const line=esc(bus.lines?.[0]||'버스');
  const start=esc(bus.startName||'승차');
  const end=esc(bus.endName||'하차');
  const role=total>1?(index===0?'첫 버스':index===total-1?'마지막 버스':`환승 ${index}`):'버스';
  return`<div class="flow-transit-map-leg"><span>${role}</span><strong>${line}</strong><small>${start} → ${end}</small></div>`;
}
function mapSheet(route,index){
  const buses=(route.segments||[]).filter(segment=>segment.type==='bus');
  const lines=buses.map(bus=>bus.lines?.[0]).filter(Boolean).join(' · ')||'버스';
  const root=document.createElement('div');root.className='flow-transit-map-shell';root.id='flowTransitMapDialog';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','flowTransitMapTitle');root.dataset.transitMapPanel=String(index);
  root.innerHTML=`
    <button class="flow-transit-map-backdrop" type="button" data-transit-map-dismiss aria-label="지도 닫기"></button>
    <section class="flow-transit-map-sheet" tabindex="-1">
      <div class="flow-transit-map-grabber" aria-hidden="true"></div>
      <header class="flow-transit-map-head">
        <div class="flow-transit-map-title"><span>${index===0?'추천 경로':`경로 ${index+1}`}</span><h2 id="flowTransitMapTitle">버스 경로 지도</h2><p>${esc(lines)} · ${Math.max(0,Number(route.totalMinutes)||0)}분</p></div>
        <button type="button" class="flow-transit-map-close" data-transit-map-close aria-label="버스 지도 닫기">닫기</button>
      </header>
      <div class="flow-transit-map-legs" aria-label="버스 구간">${buses.map((bus,i)=>legChip(bus,i,buses.length)).join('')}</div>
      <div class="flow-transit-map-stage"><div class="flow-transit-map-canvas" aria-label="버스 노선 지도"></div></div>
      <footer class="flow-transit-map-footer">
        <div class="flow-transit-map-status" role="status" aria-live="polite">노선과 운행 차량을 불러오는 중…</div>
        <div class="flow-transit-map-legend" aria-label="지도 범례"><span class="board"><i></i>승차</span><span class="alight"><i></i>하차</span><span class="vehicle"><i></i>운행 버스</span></div>
      </footer>
    </section>`;
  root.querySelector('[data-transit-map-close]')?.addEventListener('click',()=>closeMap());
  root.querySelector('[data-transit-map-dismiss]')?.addEventListener('click',()=>closeMap());
  return root;
}
function drawLeg(map,bounds,data,line,index,total){
  const stops=Array.isArray(data?.route?.stops)?data.route.stops:[];
  const path=stops.map(point).filter(Boolean);if(path.length<2)return{stops:0,vehicles:0};
  const palette=['#1769e0','#5b67c8','#008f7a'];
  const polyline=new kakao.maps.Polyline({map,path,strokeWeight:index?5:6,strokeColor:palette[index%palette.length],strokeOpacity:index?.78:.9});currentLayers.push(polyline);path.forEach(position=>bounds.extend(position));
  stops.slice(1,-1).forEach(stop=>{const position=point(stop);if(!position)return;const overlay=new kakao.maps.CustomOverlay({map,position,content:stopDot(),xAnchor:.5,yAnchor:.5,zIndex:3});currentLayers.push(overlay)});
  const start=point(stops[0]),end=point(stops.at(-1));
  if(start){const overlay=new kakao.maps.CustomOverlay({map,position:start,content:pinNode('board',index?'환승 승차':'승차',stops[0]?.name||''),xAnchor:.5,yAnchor:1.05,zIndex:6});currentLayers.push(overlay)}
  if(end){const label=index===total-1?'하차':'환승';const overlay=new kakao.maps.CustomOverlay({map,position:end,content:pinNode('alight',label,stops.at(-1)?.name||''),xAnchor:.5,yAnchor:1.05,zIndex:6});currentLayers.push(overlay)}
  const vehicles=Array.isArray(data?.vehicles)?data.vehicles:[];
  for(const vehicle of vehicles){const position=point(vehicle);if(!position)continue;const overlay=new kakao.maps.CustomOverlay({map,position,content:vehicleNode(line),xAnchor:.5,yAnchor:.65,zIndex:8});currentLayers.push(overlay);bounds.extend(position)}
  return{stops:stops.length,vehicles:vehicles.length};
}
async function openMap(index,button){
  const route=currentRoutes[index];if(!route||!mapCapable(route))return;
  if(activeTrigger===button&&activeSheet){closeMap();return}
  closeMap({restoreFocus:false});
  activeTrigger=button;button.setAttribute('aria-expanded','true');
  const sheet=mapSheet(route,index);activeSheet=sheet;document.body.append(sheet);document.body.classList.add('flow-transit-map-open');
  const token=++renderToken;
  requestAnimationFrame(()=>sheet.classList.add('is-open'));
  sheet.querySelector('.flow-transit-map-sheet')?.focus({preventScroll:true});
  const sdk=await loadSdk();if(token!==renderToken||!sheet.isConnected)return;
  if(!sdk){setStatus(sheet,'지도를 불러오지 못했습니다. 다시 열어 재시도해주세요.','error');return}
  const buses=(route.segments||[]).filter(segment=>segment.type==='bus');
  activeController=new AbortController();
  const results=await Promise.all(buses.map(bus=>fetchLeg(bus,activeController.signal).catch(error=>({error:error instanceof Error?error.message:String(error)}))));
  if(token!==renderToken||!sheet.isConnected)return;
  const successful=results.map((data,i)=>({data,bus:buses[i]})).filter(item=>!item.data?.error&&Array.isArray(item.data?.route?.stops)&&item.data.route.stops.length>1);
  if(!successful.length){setStatus(sheet,results.find(x=>x?.error)?.error||'표시할 버스 노선 지도를 찾지 못했습니다.','error');return}
  const firstPoint=point(successful[0].data.route.stops[0]);if(!firstPoint){setStatus(sheet,'노선 좌표를 읽지 못했습니다.','error');return}
  const canvas=$('.flow-transit-map-canvas',sheet);currentMap=new kakao.maps.Map(canvas,{center:firstPoint,level:5});
  try{currentMap.setZoomable?.(true);currentMap.setDraggable?.(true)}catch{}
  const bounds=new kakao.maps.LatLngBounds();let stopCount=0,vehicleCount=0;
  successful.forEach(({data,bus},i)=>{const count=drawLeg(currentMap,bounds,data,String(bus.lines?.[0]||''),i,successful.length);stopCount+=count.stops;vehicleCount+=count.vehicles});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    if(token!==renderToken||!currentMap)return;
    try{currentMap.relayout?.();if(stopCount>1)currentMap.setBounds(bounds,54,54,54,54)}catch{try{if(stopCount>1)currentMap.setBounds(bounds)}catch{}}
  }));
  setStatus(sheet,vehicleCount?`정류장 ${stopCount}곳 · 현재 운행 차량 ${vehicleCount}대`:`정류장 ${stopCount}곳 · 실시간 차량 위치 없음`,vehicleCount?'live':'neutral');
  sheet.dataset.mapReady='true';sheet.dataset.vehicleCount=String(vehicleCount);sheet.dataset.stopCount=String(stopCount);
}
function handleClick(event){
  const button=event.target.closest?.('[data-transit-map-toggle]');if(button){openMap(Number(button.dataset.transitMapToggle),button);return}
  const destination=event.target.closest?.('[data-view]');if(destination&&destination.dataset.view!=='transit'&&activeSheet)closeMap({restoreFocus:false});
}
function handleKeydown(event){if(event.key==='Escape'&&activeSheet){event.preventDefault();closeMap()}}
function handleRoutes(event){currentRoutes=Array.isArray(event.detail?.routes)?event.detail.routes:[];closeMap({restoreFocus:false});decorateCards()}
function init(){installStyle();document.addEventListener('click',handleClick);document.addEventListener('keydown',handleKeydown);window.addEventListener('flow:transit-routes-rendered',handleRoutes);document.documentElement.dataset.flowTransitMap='ready'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
