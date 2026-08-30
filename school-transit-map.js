const TRANSIT_MAP_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-map';
/* Kakao JavaScript app keys are browser-facing identifiers by provider design. */
const KAKAO_JS_KEY='cc0aae65f94df3b64e5d231dd3a9963a';
const PROFILE_KEY='flow-school-profile-v3';
const VEHICLE_REFRESH_MS=15000;
const TRIP_MAX_ROUTE_DISTANCE_METERS=700;
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let sdkPromise=null;
let currentRoutes=[];
let activeSheet=null;
let activeTrigger=null;
let activeController=null;
let currentMap=null;
let currentLayers=[];
let currentVehicleLayers=[];
let activeBusLegs=[];
let activeStopCount=0;
let activeTracePointCount=0;
let vehicleRefreshTimer=0;
let tripWatchId=null;
let activeTrip=null;
let renderToken=0;

function profile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
function region(){return String(profile()?.school?.address||'').trim().split(/\s+/)[0]||''}
function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function installStyle(){
  if(!$('link[data-flow-transit-map]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/school-transit-map.css?v=20260830-2';link.dataset.flowTransitMap='';document.head.append(link)}
  if(!$('link[data-flow-transit-rail-map]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/school-transit-rail-map.css?v=20260828-1';link.dataset.flowTransitRailMap='';document.head.append(link)}
}
function loadSdk(){
  if(window.kakao?.maps?.Map)return Promise.resolve(true);
  if(['localhost','127.0.0.1','::1'].includes(location.hostname))return Promise.resolve(Boolean(window.kakao?.maps?.Map));
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise(resolve=>{
    const existing=$('script[data-flow-kakao-transit-map]');
    const script=existing||document.createElement('script');
    const finish=ok=>{if(!ok){script.remove();sdkPromise=null}resolve(ok)};
    if(!existing){script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JS_KEY)}&autoload=false`;script.async=true;script.dataset.flowKakaoTransitMap='';document.head.append(script)}
    const ready=()=>{try{kakao.maps.load(()=>finish(Boolean(kakao.maps.Map)))}catch{finish(false)}};
    if(window.kakao?.maps?.load)ready();else{script.addEventListener('load',ready,{once:true});script.addEventListener('error',()=>finish(false),{once:true})}
  });
  return sdkPromise;
}
function busMapCapable(route){return(route?.segments||[]).some(segment=>segment.type==='bus'&&segment.startId&&segment.endId&&(segment.lines||[]).length)}
function railMapCapable(route){return(route?.segments||[]).some(segment=>segment.type==='subway'&&(segment.lines||[]).length)}
function mapCapable(route){return busMapCapable(route)||railMapCapable(route)}
function mapMode(route){return busMapCapable(route)?'bus':railMapCapable(route)?'rail':'none'}
function decorateCards(){
  $$('[data-transit-route]').forEach((card,index)=>{
    card.querySelector('.flow-transit-map-toggle')?.remove();
    const route=currentRoutes[index],mode=mapMode(route);if(mode==='none')return;
    const details=card.querySelector('.flow-transit-details');
    const button=document.createElement('button');
    button.type='button';button.className='neo-button compact flow-transit-map-toggle';button.dataset.transitMapToggle=String(index);button.textContent=mode==='bus'?'지도 보기':'노선도 보기';
    button.setAttribute('aria-expanded','false');button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','flowTransitMapDialog');
    if(details)card.insertBefore(button,details);else card.append(button);
  });
}
function stopVehicleRefresh(){clearTimeout(vehicleRefreshTimer);vehicleRefreshTimer=0}
function stopTripWatch(){
  if(tripWatchId!==null&&navigator.geolocation?.clearWatch)navigator.geolocation.clearWatch(tripWatchId);
  tripWatchId=null;
}
function clearTripGuideState(){stopTripWatch();activeTrip=null}
function clearVehicleLayers(){for(const layer of currentVehicleLayers)try{layer.setMap?.(null)}catch{}currentVehicleLayers=[]}
function clearLayers(){
  clearTripGuideState();clearVehicleLayers();for(const layer of currentLayers)try{layer.setMap?.(null)}catch{}
  currentLayers=[];currentMap=null;activeBusLegs=[];activeStopCount=0;activeTracePointCount=0;
}
function closeMap({restoreFocus=true}={}){
  renderToken+=1;stopVehicleRefresh();activeController?.abort();activeController=null;clearLayers();
  const trigger=activeTrigger;if(trigger)trigger.setAttribute('aria-expanded','false');
  activeSheet?.remove();activeSheet=null;activeTrigger=null;document.body.classList.remove('flow-transit-map-open');
  if(restoreFocus&&trigger?.isConnected)requestAnimationFrame(()=>trigger.focus({preventScroll:true}));
}
function point(item){const x=Number(item?.x),y=Number(item?.y);return Number.isFinite(x)&&Number.isFinite(y)&&window.kakao?.maps?new kakao.maps.LatLng(y,x):null}
function routeTrace(data){
  const official=Array.isArray(data?.route?.path)?data.route.path.map(point).filter(Boolean):[];
  if(data?.geometry==='daegu-official-bus-link-snapshot'&&official.length>1)return{path:official,kind:'official-road-geometry',official:true};
  const fallback=(Array.isArray(data?.route?.stops)?data.route.stops:[]).map(point).filter(Boolean);
  return{path:fallback,kind:'stop-sequence-fallback',official:false};
}
function sameStop(a,b){
  if(!a||!b)return false;const aid=String(a.id||'').trim(),bid=String(b.id||'').trim();if(aid&&bid&&aid===bid)return true;
  const ax=Number(a.x),ay=Number(a.y),bx=Number(b.x),by=Number(b.y);if(![ax,ay,bx,by].every(Number.isFinite))return false;
  return Math.hypot(ax-bx,ay-by)<=0.00035;
}
function pinNode(kind,label='',station=''){
  const node=document.createElement('span');node.className=`flow-transit-map-pin ${kind}`;
  node.innerHTML=`<i aria-hidden="true"></i><b><span>${esc(label)}</span>${station?`<small>${esc(station)}</small>`:''}</b>`;return node;
}
function stopDot(){const node=document.createElement('i');node.className='flow-transit-map-stop';return node}
function vehicleNode(line){const node=document.createElement('span');node.className='flow-transit-map-vehicle';node.innerHTML=`<i aria-hidden="true"></i><b>${esc(line||'버스')}</b>`;return node}
async function fetchLeg(segment,signal){
  const url=new URL(TRANSIT_MAP_EDGE);url.searchParams.set('action','route-map');url.searchParams.set('region',region());url.searchParams.set('line',String(segment.lines?.[0]||''));
  url.searchParams.set('startId',String(segment.startId||''));url.searchParams.set('endId',String(segment.endId||''));url.searchParams.set('startName',String(segment.startName||''));url.searchParams.set('endName',String(segment.endName||''));
  const response=await fetch(url,{signal});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'버스 지도 정보를 불러오지 못했습니다.');return body;
}
function setStatus(sheet,text,kind='neutral'){const status=$('.flow-transit-map-status',sheet);if(status){status.textContent=text;status.dataset.kind=kind}}
function legChip(bus,index,total){
  const line=esc(bus.lines?.[0]||'버스'),start=esc(bus.startName||'승차'),end=esc(bus.endName||'하차');
  const role=total>1?(index===0?'첫 버스':index===total-1?'마지막 버스':`환승 ${index}`):'버스';
  return`<div class="flow-transit-map-leg"><span>${role}</span><strong>${line}</strong><small>${start} → ${end}</small></div>`;
}
function railChip(segment,index,total){
  const line=esc(segment.lines?.[0]||'지하철'),start=esc(segment.startName||'승차'),end=esc(segment.endName||'하차');
  const role=total>1?(index===0?'첫 지하철':index===total-1?'환승 후':'환승'):'지하철';
  return`<div class="flow-transit-map-leg"><span>${role}</span><strong>${line}</strong><small>${start} → ${end}</small></div>`;
}
function railLineClass(segment){const digit=String(segment.lines?.[0]||'').match(/[123]/)?.[0]||'x';return`line-${digit}`}
function railSchematic(route){
  const rails=(route.segments||[]).filter(segment=>segment.type==='subway');
  return`<div class="flow-transit-rail-schematic">${rails.map((segment,index)=>{
    const stations=Math.max(1,Number(segment.stationCount)||1),direction=segment.direction?`${esc(segment.direction)} 방면`:'';
    return`${index?'<div class="flow-transit-rail-transfer"><i></i><span>환승</span></div>':''}<section class="flow-transit-rail-section ${railLineClass(segment)}"><header><strong>${esc(segment.lines?.[0]||'지하철')}</strong><span>${stations}개 역${direction?` · ${direction}`:''}</span></header><div class="flow-transit-rail-track"><span><i></i><b>${esc(segment.startName||'승차')}</b></span><em><i></i></em><span><i></i><b>${esc(segment.endName||'하차')}</b></span></div></section>`;
  }).join('')}</div>`;
}
function tripGuideMarkup(){
  return`<div class="flow-transit-trip-guide" data-transit-trip-guide data-phase="idle">
    <div class="flow-transit-trip-copy"><span>여정 안내</span><strong data-transit-trip-title>탑승부터 하차까지 안내</strong><small data-transit-trip-detail>여정 시작 후 탑승 중에만 현재 위치를 사용합니다.</small></div>
    <button class="flow-transit-trip-action" type="button" data-transit-trip-action disabled>여정 시작</button>
  </div>`;
}
function mapSheet(route,index){
  const mode=mapMode(route),buses=(route.segments||[]).filter(segment=>segment.type==='bus'),rails=(route.segments||[]).filter(segment=>segment.type==='subway');
  const lines=(mode==='bus'?buses:rails).map(segment=>segment.lines?.[0]).filter(Boolean).join(' · ')||(mode==='bus'?'버스':'지하철');
  const transferLegend=(mode==='bus'?buses:rails).length>1?'<span class="transfer"><i></i>환승</span>':'';
  const title=mode==='bus'?'버스 경로 지도':'지하철 경로 노선도';
  const legs=mode==='bus'?buses.map((bus,i)=>legChip(bus,i,buses.length)).join(''):rails.map((rail,i)=>railChip(rail,i,rails.length)).join('');
  const stage=mode==='bus'?'<div class="flow-transit-map-stage"><div class="flow-transit-map-canvas" aria-label="버스 노선 지도"></div></div>':`<div class="flow-transit-map-stage flow-transit-rail-stage" aria-label="지하철 경로 노선도">${railSchematic(route)}</div>`;
  const status=mode==='bus'?'노선과 운행 차량을 불러오는 중…':'지하철 경로를 표시했습니다. 실제 열차 위치는 제공하지 않습니다.';
  const note=mode==='bus'?'<small class="flow-transit-map-note">대구시 공식 버스 도로 링크를 현재 정류장 순서에 맞춰 불러옵니다.</small>':'';
  const guide=mode==='bus'?tripGuideMarkup():'';
  const legend=mode==='bus'?`<span class="board"><i></i>승차</span>${transferLegend}<span class="alight"><i></i>하차</span><span class="vehicle"><i></i>운행 버스</span>`:`<span class="board"><i></i>승차</span>${transferLegend}<span class="alight"><i></i>하차</span>`;
  const root=document.createElement('div');root.className='flow-transit-map-shell';root.id='flowTransitMapDialog';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-labelledby','flowTransitMapTitle');root.dataset.transitMapPanel=String(index);root.dataset.mapMode=mode;
  root.innerHTML=`<button class="flow-transit-map-backdrop" type="button" data-transit-map-dismiss aria-label="지도 닫기"></button><section class="flow-transit-map-sheet" tabindex="-1"><div class="flow-transit-map-grabber" aria-hidden="true"></div><header class="flow-transit-map-head"><div class="flow-transit-map-title"><span>${index===0?'추천 경로':`경로 ${index+1}`}</span><h2 id="flowTransitMapTitle">${title}</h2><p>${esc(lines)} · ${Math.max(0,Number(route.totalMinutes)||0)}분</p></div><button type="button" class="flow-transit-map-close" data-transit-map-close aria-label="${mode==='bus'?'버스 지도':'지하철 노선도'} 닫기">닫기</button></header><div class="flow-transit-map-legs" aria-label="${mode==='bus'?'버스':'지하철'} 구간">${legs}</div>${stage}<footer class="flow-transit-map-footer"><div class="flow-transit-map-footer-copy">${guide}<div class="flow-transit-map-status" role="status" aria-live="polite">${status}</div>${note}</div><div class="flow-transit-map-legend" aria-label="지도 범례">${legend}</div></footer></section>`;
  root.querySelector('[data-transit-map-close]')?.addEventListener('click',()=>closeMap());root.querySelector('[data-transit-map-dismiss]')?.addEventListener('click',()=>closeMap());root.querySelector('[data-transit-trip-action]')?.addEventListener('click',handleTripAction);return root;
}
function drawLeg(map,bounds,data,index,total,previousEnd,nextStart){
  const stops=Array.isArray(data?.route?.stops)?data.route.stops:[],trace=routeTrace(data),path=trace.path;if(stops.length<2||path.length<2)return{stopCount:0,official:false};
  const palette=['#1769e0','#5b67c8','#008f7a'],color=palette[index%palette.length];
  const halo=new kakao.maps.Polyline({map,path,strokeWeight:index?8:9,strokeColor:'#ffffff',strokeOpacity:.68});currentLayers.push(halo);
  const polyline=new kakao.maps.Polyline({map,path,strokeWeight:index?4:5,strokeColor:color,strokeOpacity:index?.82:.94});currentLayers.push(polyline);
  activeTracePointCount+=path.length;path.forEach(position=>bounds.extend(position));
  stops.slice(1,-1).forEach(stop=>{const position=point(stop);if(!position)return;const overlay=new kakao.maps.CustomOverlay({map,position,content:stopDot(),xAnchor:.5,yAnchor:.5,zIndex:3});currentLayers.push(overlay)});
  const firstStop=stops[0],lastStop=stops.at(-1),start=point(firstStop),end=point(lastStop),joinedFromPrevious=index>0&&sameStop(previousEnd,firstStop),joinsNext=index<total-1&&sameStop(lastStop,nextStart);
  if(start&&!joinedFromPrevious){bounds.extend(start);const overlay=new kakao.maps.CustomOverlay({map,position:start,content:pinNode('board',index?'환승 승차':'승차',firstStop?.name||''),xAnchor:.5,yAnchor:1.05,zIndex:6});currentLayers.push(overlay)}
  if(end){bounds.extend(end);const final=index===total-1,kind=final?'alight':joinsNext?'transfer':'alight',label=final?'하차':joinsNext?'환승':'환승 하차';const overlay=new kakao.maps.CustomOverlay({map,position:end,content:pinNode(kind,label,lastStop?.name||''),xAnchor:.5,yAnchor:1.05,zIndex:6});currentLayers.push(overlay)}
  return{stopCount:stops.length,official:trace.official};
}
function drawVehicles(map,data,line,bounds=null){
  const vehicles=Array.isArray(data?.vehicles)?data.vehicles:[];let count=0;
  for(const vehicle of vehicles){const position=point(vehicle);if(!position)continue;const overlay=new kakao.maps.CustomOverlay({map,position,content:vehicleNode(line),xAnchor:.5,yAnchor:.65,zIndex:8});currentVehicleLayers.push(overlay);bounds?.extend(position);count+=1}
  return count;
}
function routeLineKey(segment){return`${String(segment?.lines?.[0]||'').replace(/\s+/g,'').toLowerCase()}:${segment?.startId||segment?.startName||''}:${segment?.endId||segment?.endName||''}`}
function tripRouteKey(route){return(route?.segments||[]).filter(segment=>segment.type==='bus'||segment.type==='subway').map(segment=>`${segment.type}:${routeLineKey(segment)}`).join('|')}
function realtimeForBus(route,segment,busIndex){
  const lives=Array.isArray(route?.realtimeLegs)?route.realtimeLegs.filter(Boolean):route?.realtime?[route.realtime]:[];
  const line=String(segment?.lines?.[0]||'').replace(/\s+/g,'').toLowerCase();
  return lives.find(live=>Number(live?.legIndex)===busIndex&&String(live?.routeNo||'').replace(/\s+/g,'').toLowerCase()===line)
    ||lives.find(live=>Number(live?.legIndex)===busIndex)
    ||lives.find(live=>String(live?.routeNo||'').replace(/\s+/g,'').toLowerCase()===line)
    ||null;
}
function buildTripLegs(route,successful){
  let busIndex=0;
  return(route?.segments||[]).filter(segment=>segment.type==='bus'||segment.type==='subway').map(segment=>{
    if(segment.type==='subway')return{type:'subway',segment,stops:[],live:null,busIndex:null};
    const match=successful.find(item=>item.bus===segment)||successful.find(item=>routeLineKey(item.bus)===routeLineKey(segment));
    const leg={type:'bus',segment,stops:Array.isArray(match?.data?.route?.stops)?match.data.route.stops:[],live:realtimeForBus(route,segment,busIndex),busIndex};
    busIndex+=1;return leg;
  }).filter(leg=>leg.type==='subway'||leg.stops.length>1);
}
function distanceMeters(ax,ay,bx,by){
  const rad=Math.PI/180,lat1=ay*rad,lat2=by*rad,dLat=(by-ay)*rad,dLon=(bx-ax)*rad;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}
function tripProgress(stops,position){
  if(!Array.isArray(stops)||stops.length<2||!position)return null;
  let nearestIndex=-1,nearestDistance=Number.POSITIVE_INFINITY;
  stops.forEach((stop,index)=>{
    const x=Number(stop?.x),y=Number(stop?.y);if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const meters=distanceMeters(position.x,position.y,x,y);if(meters<nearestDistance){nearestDistance=meters;nearestIndex=index}
  });
  if(nearestIndex<0)return null;
  return{nearestIndex,nearestDistance,nearestStop:stops[nearestIndex],remaining:Math.max(0,stops.length-1-nearestIndex)};
}
function tripNodes(){
  const guide=activeSheet?.querySelector('[data-transit-trip-guide]');
  return{guide,title:guide?.querySelector('[data-transit-trip-title]'),detail:guide?.querySelector('[data-transit-trip-detail]'),action:guide?.querySelector('[data-transit-trip-action]')};
}
function currentTripLeg(){return activeTrip?.legs?.[activeTrip.index]||null}
function setTripCopy(title,detail,actionLabel,{phase=activeTrip?.phase||'idle',disabled=false,remaining=null}={}){
  const nodes=tripNodes();if(!nodes.guide)return;
  nodes.guide.dataset.phase=phase;
  if(remaining===null)delete nodes.guide.dataset.remaining;else nodes.guide.dataset.remaining=String(remaining);
  if(nodes.title)nodes.title.textContent=title;
  if(nodes.detail)nodes.detail.textContent=detail;
  if(nodes.action){nodes.action.textContent=actionLabel;nodes.action.disabled=disabled}
}
function renderTripGuide(){
  if(!activeTrip||!activeSheet?.isConnected)return;
  const leg=currentTripLeg();
  if(activeTrip.phase==='idle'){
    setTripCopy('탑승부터 하차까지 안내','여정 시작 후 탑승 중에만 현재 위치를 사용합니다.','여정 시작',{phase:'idle'});return;
  }
  if(activeTrip.phase==='complete'){
    setTripCopy('여정 안내 완료','버스·지하철 탑승 구간 안내를 마쳤습니다. 남은 도보 구간을 확인하세요.','다시 시작',{phase:'complete'});return;
  }
  if(!leg){activeTrip.phase='complete';renderTripGuide();return}
  const line=String(leg.segment?.lines?.[0]||(leg.type==='bus'?'버스':'지하철'));
  if(activeTrip.phase==='waiting'){
    if(leg.type==='subway'){
      const stations=Math.max(1,Number(leg.segment?.stationCount)||1);
      setTripCopy(`${line} · ${leg.segment?.startName||'승차역'} 승차`,`실시간 열차 위치는 사용하지 않습니다 · ${stations}개 역 이동`,'지하철 탑승',{phase:'waiting'});return;
    }
    const live=leg.live;
    const liveCopy=live?`실시간 ${Math.max(0,Number(live.stops)||0)}정거장 전 · 약 ${Math.max(0,Number(live.arrivalMinutes)||0)}분 후`:'실시간 도착정보 없음 · 탑승 후 현재 위치로 진행 상황을 계산합니다.';
    setTripCopy(`${line} · ${leg.segment?.startName||'승차 정류장'} 승차`,liveCopy,'탑승했어요',{phase:'waiting'});return;
  }
  if(activeTrip.phase==='riding'&&leg.type==='subway'){
    const stations=Math.max(1,Number(leg.segment?.stationCount)||1);
    setTripCopy(`${line} · ${leg.segment?.endName||'하차역'}에서 하차`,`실시간 열차 위치 없음 · 노선 순서 기준 ${stations}개 역`,'하차했어요',{phase:'riding'});return;
  }
  if(activeTrip.locationError){
    setTripCopy('현재 위치를 확인하지 못했습니다',activeTrip.locationError,'위치 다시 확인',{phase:'error'});return;
  }
  if(!activeTrip.lastPosition){
    setTripCopy(`${line} · ${leg.segment?.endName||'하차 정류장'}까지 이동 중`,'현재 위치를 확인하는 중…','하차했어요',{phase:'riding'});return;
  }
  const progress=tripProgress(leg.stops,activeTrip.lastPosition);
  if(!progress||progress.nearestDistance>TRIP_MAX_ROUTE_DISTANCE_METERS){
    setTripCopy(`${line} · ${leg.segment?.endName||'하차 정류장'}까지 이동 중`,'현재 위치가 노선에서 멀어 정거장 진행 계산을 잠시 보류합니다.','하차했어요',{phase:'riding'});return;
  }
  const accuracy=Number(activeTrip.lastPosition.accuracy),accuracyCopy=Number.isFinite(accuracy)?` · 위치 정확도 약 ${Math.max(10,Math.round(accuracy/10)*10)}m`:'';
  if(progress.remaining===0){
    setTripCopy(`${leg.segment?.endName||'하차 정류장'} 도착`,`현재 위치 기준 ${progress.nearestStop?.name||'하차 정류장'} 부근${accuracyCopy}`,'하차했어요',{phase:'riding',remaining:0});return;
  }
  if(progress.remaining===1){
    setTripCopy('다음 정류장에서 하차 준비',`${progress.nearestStop?.name||'현재 정류장'} 부근 · 1정거장 남음${accuracyCopy}`,'하차했어요',{phase:'riding',remaining:1});return;
  }
  setTripCopy(`약 ${progress.remaining}정거장 남음`,`${progress.nearestStop?.name||'현재 정류장'} 부근 · 현재 위치 기준${accuracyCopy}`,'하차했어요',{phase:'riding',remaining:progress.remaining});
}
function setupTripGuide(route,successful){
  const legs=buildTripLegs(route,successful);if(!legs.length)return;
  activeTrip={route,key:tripRouteKey(route),legs,index:0,phase:'idle',started:false,lastPosition:null,locationError:''};
  const action=tripNodes().action;if(action)action.disabled=false;renderTripGuide();
}
function refreshTripRoute(route){
  if(!activeTrip||!route)return;
  activeTrip.route=route;
  activeTrip.legs.forEach(leg=>{if(leg.type==='bus'&&Number.isInteger(leg.busIndex))leg.live=realtimeForBus(route,leg.segment,leg.busIndex)});
  renderTripGuide();
}
function startTripWatch(){
  stopTripWatch();
  const leg=currentTripLeg();if(!activeTrip||activeTrip.phase!=='riding'||leg?.type!=='bus'||document.hidden)return;
  if(!navigator.geolocation?.watchPosition){activeTrip.locationError='이 브라우저에서는 위치 기능을 사용할 수 없습니다.';renderTripGuide();return}
  activeTrip.locationError='';activeTrip.lastPosition=null;renderTripGuide();
  tripWatchId=navigator.geolocation.watchPosition(position=>{
    if(!activeTrip||activeTrip.phase!=='riding'||currentTripLeg()?.type!=='bus')return;
    activeTrip.locationError='';
    activeTrip.lastPosition={x:position.coords.longitude,y:position.coords.latitude,accuracy:position.coords.accuracy};
    renderTripGuide();
  },error=>{
    if(!activeTrip)return;
    activeTrip.locationError=error.code===1?'위치 권한이 필요합니다. 브라우저 설정에서 위치 접근을 허용해주세요.':error.code===2?'현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.':'위치 확인 시간이 초과됐습니다. 다시 시도해주세요.';
    stopTripWatch();renderTripGuide();
  },{enableHighAccuracy:false,timeout:10000,maximumAge:5000});
}
function advanceTripLeg(){
  stopTripWatch();if(!activeTrip)return;
  activeTrip.index+=1;activeTrip.lastPosition=null;activeTrip.locationError='';
  if(activeTrip.index>=activeTrip.legs.length)activeTrip.phase='complete';else activeTrip.phase='waiting';
  renderTripGuide();
}
function handleTripAction(){
  if(!activeTrip)return;
  const leg=currentTripLeg();
  if(activeTrip.phase==='idle'||activeTrip.phase==='complete'){
    activeTrip.index=0;activeTrip.phase='waiting';activeTrip.started=true;activeTrip.lastPosition=null;activeTrip.locationError='';renderTripGuide();return;
  }
  if(activeTrip.phase==='waiting'){
    activeTrip.phase='riding';activeTrip.lastPosition=null;activeTrip.locationError='';
    renderTripGuide();if(leg?.type==='bus')startTripWatch();return;
  }
  if(activeTrip.phase==='error'){activeTrip.phase='riding';activeTrip.locationError='';startTripWatch();return}
  if(activeTrip.phase==='riding')advanceTripLeg();
}
function scheduleVehicleRefresh(delay=VEHICLE_REFRESH_MS){
  stopVehicleRefresh();if(!activeSheet?.isConnected||activeSheet.dataset.mapMode!=='bus'||!activeBusLegs.length||document.hidden)return;
  vehicleRefreshTimer=setTimeout(()=>refreshVehicleMarkers(),Math.max(500,delay));
}
async function refreshVehicleMarkers(){
  if(!activeSheet?.isConnected||activeSheet.dataset.mapMode!=='bus'||!currentMap||!activeBusLegs.length||document.hidden)return;
  const token=renderToken;activeController?.abort();activeController=new AbortController();
  const results=await Promise.all(activeBusLegs.map(bus=>fetchLeg(bus,activeController.signal).catch(error=>({error:error instanceof Error?error.message:String(error)}))));
  if(token!==renderToken||!activeSheet?.isConnected||!currentMap)return;
  const available=results.map((data,i)=>({data,bus:activeBusLegs[i]})).filter(item=>!item.data?.error);
  if(!available.length){setStatus(activeSheet,'실시간 차량 위치를 갱신하지 못했습니다. 잠시 후 다시 시도합니다.','neutral');scheduleVehicleRefresh();return}
  clearVehicleLayers();let vehicleCount=0;available.forEach(({data,bus})=>{vehicleCount+=drawVehicles(currentMap,data,String(bus.lines?.[0]||''))});
  const stamp=new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());
  setStatus(activeSheet,vehicleCount?`정류장 ${activeStopCount}곳 · 운행 버스 ${vehicleCount}대 · ${stamp} 갱신`:`정류장 ${activeStopCount}곳 · ${stamp} 기준 실시간 차량 위치 없음`,vehicleCount?'live':'neutral');
  activeSheet.dataset.vehicleCount=String(vehicleCount);activeSheet.dataset.vehicleUpdatedAt=new Date().toISOString();
  scheduleVehicleRefresh();
}
async function openMap(index,button){
  const route=currentRoutes[index];if(!route||!mapCapable(route))return;if(activeTrigger===button&&activeSheet){closeMap();return}
  closeMap({restoreFocus:false});activeTrigger=button;button.setAttribute('aria-expanded','true');
  const sheet=mapSheet(route,index);activeSheet=sheet;document.body.append(sheet);document.body.classList.add('flow-transit-map-open');const token=++renderToken;
  requestAnimationFrame(()=>sheet.classList.add('is-open'));sheet.querySelector('.flow-transit-map-sheet')?.focus({preventScroll:true});
  if(sheet.dataset.mapMode==='rail'){
    sheet.dataset.mapReady='true';sheet.dataset.vehicleCount='0';setStatus(sheet,'노선 순서 기반 예상 경로입니다. 대구 도시철도 실시간 열차 위치 데이터는 사용하지 않습니다.','neutral');
    window.dispatchEvent(new CustomEvent('flow:transit-map-ready',{detail:{mode:'rail',index}}));return;
  }
  const sdk=await loadSdk();if(token!==renderToken||!sheet.isConnected)return;if(!sdk){setStatus(sheet,'지도를 불러오지 못했습니다. 다시 열어 재시도해주세요.','error');return}
  const buses=(route.segments||[]).filter(segment=>segment.type==='bus');activeController=new AbortController();
  const results=await Promise.all(buses.map(bus=>fetchLeg(bus,activeController.signal).catch(error=>({error:error instanceof Error?error.message:String(error)}))));
  if(token!==renderToken||!sheet.isConnected)return;
  const successful=results.map((data,i)=>({data,bus:buses[i]})).filter(item=>!item.data?.error&&Array.isArray(item.data?.route?.stops)&&item.data.route.stops.length>1);
  if(!successful.length){setStatus(sheet,results.find(x=>x?.error)?.error||'표시할 버스 노선 지도를 찾지 못했습니다.','error');return}
  const firstPoint=point(successful[0].data.route.stops[0]);if(!firstPoint){setStatus(sheet,'노선 좌표를 읽지 못했습니다.','error');return}
  const canvas=$('.flow-transit-map-canvas',sheet);currentMap=new kakao.maps.Map(canvas,{center:firstPoint,level:5});try{currentMap.setZoomable?.(true);currentMap.setDraggable?.(true)}catch{}
  const bounds=new kakao.maps.LatLngBounds();let stopCount=0,officialLegs=0;successful.forEach(({data},i)=>{const previousEnd=i?successful[i-1].data.route.stops.at(-1):null,nextStart=i<successful.length-1?successful[i+1].data.route.stops[0]:null;const drawn=drawLeg(currentMap,bounds,data,i,successful.length,previousEnd,nextStart);stopCount+=drawn.stopCount;if(drawn.official)officialLegs+=1});
  clearVehicleLayers();let vehicleCount=0;successful.forEach(({data,bus})=>{vehicleCount+=drawVehicles(currentMap,data,String(bus.lines?.[0]||''))});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token!==renderToken||!currentMap)return;try{currentMap.relayout?.();if(stopCount>1)currentMap.setBounds(bounds,54,54,54,54)}catch{try{if(stopCount>1)currentMap.setBounds(bounds)}catch{}}}));
  activeBusLegs=successful.map(item=>item.bus);activeStopCount=stopCount;setupTripGuide(route,successful);
  const allOfficial=officialLegs===successful.length;const snapshot=successful.find(item=>item.data?.geometrySnapshot)?.data?.geometrySnapshot||'2025-09-03';
  const note=$('.flow-transit-map-note',sheet);if(note)note.textContent=allOfficial?`대구시 공식 버스 노선 공간정보(${snapshot})의 도로 링크를 현재 TAGO 정류장 순서에 맞춰 표시합니다.`:'공식 도로 링크를 복원하지 못한 일부 구간은 실제 TAGO 정류장 연결선으로 표시합니다.';
  setStatus(sheet,vehicleCount?`정류장 ${stopCount}곳 · ${allOfficial?'공식 도로 경로 · ':''}운행 버스 ${vehicleCount}대 · 15초마다 갱신`:`정류장 ${stopCount}곳 · ${allOfficial?'공식 도로 경로 · ':''}실시간 차량 위치 없음 · 15초마다 재확인`,vehicleCount?'live':'neutral');
  sheet.dataset.mapReady='true';sheet.dataset.vehicleCount=String(vehicleCount);sheet.dataset.stopCount=String(stopCount);sheet.dataset.routeTrace=allOfficial?'official-road-geometry':'stop-sequence-fallback';sheet.dataset.routeTracePoints=String(activeTracePointCount);sheet.dataset.geometrySnapshot=String(snapshot);window.dispatchEvent(new CustomEvent('flow:transit-map-ready',{detail:{mode:'bus',index,vehicleCount,officialGeometry:allOfficial}}));scheduleVehicleRefresh();
}
function handleClick(event){const button=event.target.closest?.('[data-transit-map-toggle]');if(button){openMap(Number(button.dataset.transitMapToggle),button);return}const destination=event.target.closest?.('[data-view]');if(destination&&destination.dataset.view!=='transit'&&activeSheet)closeMap({restoreFocus:false})}
function handleKeydown(event){if(event.key==='Escape'&&activeSheet){event.preventDefault();closeMap()}}
function handleRoutes(event){
  currentRoutes=Array.isArray(event.detail?.routes)?event.detail.routes:[];
  if(activeSheet&&activeTrip?.started){
    const replacement=currentRoutes.find(route=>tripRouteKey(route)===activeTrip.key);if(replacement)refreshTripRoute(replacement);
    const index=Number(activeSheet.dataset.transitMapPanel||0);decorateCards();activeTrigger=$(`[data-transit-route="${index}"] [data-transit-map-toggle]`);activeTrigger?.setAttribute('aria-expanded','true');return;
  }
  closeMap({restoreFocus:false});decorateCards();
}
function handleVisibility(){
  if(document.hidden){stopVehicleRefresh();stopTripWatch();return}
  if(activeSheet?.dataset.mapMode==='bus')scheduleVehicleRefresh(750);
  if(activeTrip?.started&&activeTrip.phase==='riding'&&currentTripLeg()?.type==='bus')startTripWatch();
}
function init(){installStyle();document.addEventListener('click',handleClick);document.addEventListener('keydown',handleKeydown);document.addEventListener('visibilitychange',handleVisibility);window.addEventListener('flow:transit-routes-rendered',handleRoutes);document.documentElement.dataset.flowTransitMap='ready'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
