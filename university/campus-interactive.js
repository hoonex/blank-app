const KAKAO_JS_KEY='cc0aae65f94df3b64e5d231dd3a9963a';
const CAMPUS_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-campus';
const PROFILE_KEY='flow-university-profile-v1';
const TIMETABLE_KEY='flow-university-timetable-v1';
const DAY_NAMES=['월','화','수','목','금','토','일'];

let sdkPromise=null;
let campusPromise=null;
let campusSignature='';
let campusData=null;
let map=null;
let mapContainer=null;
let classOverlays=[];
let poiOverlays=[];
let routeLines=[];
let currentOverlay=null;
let currentRouteLine=null;
let poiLayerEnabled=false;
let renderToken=0;
const routeCache=new Map();

function read(key,fallback=null){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function profile(){return read(PROFILE_KEY,null)}
function timetable(){return read(TIMETABLE_KEY,null)}
function todayIndex(){return (new Date().getDay()+6)%7}
function entries(){
  const tt=timetable();
  if(!tt?.subjects)return[];
  return tt.subjects.flatMap((subject,subjectIndex)=>(subject.times||[]).map(time=>({
    ...time,subject,subjectIndex,place:String(time.place||subject.place||'').trim()
  }))).filter(x=>Number.isFinite(x.day)&&Number.isFinite(x.startMinutes)).sort((a,b)=>a.day-b.day||a.startMinutes-b.startMinutes);
}
function dayEntries(day){return entries().filter(x=>x.day===day)}
function selectedDay(){
  const active=document.querySelector('#campusDayTabs [data-campus-day].active');
  if(active)return Number(active.dataset.campusDay);
  const days=[...new Set(entries().map(x=>x.day))];
  return days.includes(todayIndex())?todayIndex():(days[0]??todayIndex());
}
function selectedNearby(){return document.querySelector('#campusFilter [data-nearby].active')?.dataset.nearby||'dining'}
function uniquePlaces(day){
  const out=[];const seen=new Set();
  for(const entry of dayEntries(day)){
    if(!entry.place)continue;
    const key=entry.place.toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);out.push({raw:entry.place,entry});
  }
  return out;
}
function resolution(raw){return campusData?.places?.find(x=>String(x.raw).trim()===String(raw).trim())||null}
function resolved(raw){const r=resolution(raw);return r?.resolved?r.place:null}
function signature(){
  const p=profile(),tt=timetable();
  if(!p)return'';
  const placeBits=entries().map(x=>`${x.day}:${x.startMinutes}:${x.place}`).join('|');
  return `${p.id||''}|${p.name||''}|${p.address||''}|${tt?.year||''}|${tt?.semester||''}|${placeBits}`;
}
async function campusApi(action,payload){
  const url=new URL(CAMPUS_EDGE);url.searchParams.set('action',action);
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'캠퍼스 정보를 불러오지 못했습니다.');
  return body;
}
async function getCampusData(){
  const p=profile();if(!p)return null;
  const nextSignature=signature();
  if(campusData&&campusSignature===nextSignature)return campusData;
  if(campusPromise&&campusSignature===nextSignature)return campusPromise;
  campusSignature=nextSignature;
  campusPromise=campusApi('campus',{
    schoolName:p.name,address:p.address,
    items:entries().filter(x=>x.place).map(x=>({place:x.place}))
  }).then(data=>{campusData=data;return data}).finally(()=>{campusPromise=null});
  return campusPromise;
}
function loadSdk(){
  if(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname==='::1')return Promise.resolve(false);
  if(window.kakao?.maps?.Map)return Promise.resolve(true);
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise((resolve)=>{
    const existing=document.querySelector('script[data-flow-kakao-map-sdk]');
    const finish=()=>{
      if(!window.kakao?.maps){resolve(false);return}
      try{window.kakao.maps.load(()=>resolve(Boolean(window.kakao?.maps?.Map)))}catch{resolve(false)}
    };
    if(existing){if(existing.dataset.loaded==='true')finish();else{existing.addEventListener('load',finish,{once:true});existing.addEventListener('error',()=>resolve(false),{once:true})}return}
    const script=document.createElement('script');
    script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JS_KEY)}&autoload=false`;
    script.async=true;script.defer=true;script.dataset.flowKakaoMapSdk='1';
    script.addEventListener('load',()=>{script.dataset.loaded='true';finish()},{once:true});
    script.addEventListener('error',()=>resolve(false),{once:true});
    document.head.append(script);
  });
  return sdkPromise;
}
function clearLayer(list){for(const item of list){try{item.setMap(null)}catch{}}list.length=0}
function clearCurrent(){try{currentOverlay?.setMap(null)}catch{};try{currentRouteLine?.setMap(null)}catch{};currentOverlay=null;currentRouteLine=null}
function pointToLatLng(point){
  if(!window.kakao?.maps||!point)return null;
  let x,y;
  if(Array.isArray(point)){x=Number(point[0]);y=Number(point[1])}
  else{x=Number(point.x??point.lng??point.longitude??point.lon);y=Number(point.y??point.lat??point.latitude)}
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  return new kakao.maps.LatLng(y,x);
}
function placeLatLng(place){return pointToLatLng({x:place?.x,y:place?.y})}
function extend(bounds,latlng){if(latlng)bounds.extend(latlng)}
function markerNode(index,item,isNext=false){
  const link=document.createElement(item?.url?'a':'span');
  link.className=`flow-campus-marker${isNext?' is-next':''}`;
  link.textContent=String(index);
  link.title=item?.name||`수업 장소 ${index}`;
  if(item?.url){link.href=item.url;link.target='_blank';link.rel='noopener noreferrer'}
  return link;
}
function poiNode(type,item){
  const labels={dining:'학',stores:'편',cafes:'카',food:'식'};
  const link=document.createElement(item?.url?'a':'span');
  link.className=`flow-campus-poi flow-campus-poi-${type}`;
  link.textContent=labels[type]||'·';link.title=item?.name||'캠퍼스 장소';
  if(item?.url){link.href=item.url;link.target='_blank';link.rel='noopener noreferrer'}
  return link;
}
function nextUpcoming(){
  const day=todayIndex(),now=new Date(),mins=now.getHours()*60+now.getMinutes();
  return dayEntries(day).filter(x=>x.place).find(x=>x.startMinutes>mins)||null;
}
async function route(start,end,startName,endName){
  if(!start?.x||!start?.y||!end?.x||!end?.y)return null;
  const key=`${start.x},${start.y}>${end.x},${end.y}`;
  if(routeCache.has(key))return routeCache.get(key);
  const promise=campusApi('route',{start,end,startName,endName}).then(x=>x.route).catch(()=>null);
  routeCache.set(key,promise);return promise;
}
function drawPolyline(routeData,options={}){
  if(routeData?.status!=='OK'||!Array.isArray(routeData.points)||!routeData.points.length||!map)return null;
  const path=routeData.points.map(pointToLatLng).filter(Boolean);
  if(path.length<2)return null;
  const line=new kakao.maps.Polyline({
    map,path,strokeWeight:options.current?6:5,
    strokeColor:options.current?'#1769e0':'#26384f',
    strokeOpacity:options.current?.92:.78,strokeStyle:'solid'
  });
  return{line,path};
}
function ensureMap(){
  const wrap=document.querySelector('#campusMapWrap');
  if(!wrap||!campusData?.center?.x||!campusData?.center?.y||!window.kakao?.maps?.Map)return false;
  if(map&&mapContainer?.isConnected)return true;
  mapContainer=document.createElement('div');mapContainer.className='campus-interactive-map';mapContainer.setAttribute('aria-label','인터랙티브 캠퍼스 지도');
  wrap.append(mapContainer);
  map=new kakao.maps.Map(mapContainer,{center:new kakao.maps.LatLng(Number(campusData.center.y),Number(campusData.center.x)),level:3});
  map.setZoomable(true);map.setDraggable(true);
  kakao.maps.event.addListener(map,'tilesloaded',()=>{wrap.classList.add('interactive-ready');wrap.dataset.interactiveMap='ready';const badge=wrap.querySelector('.campus-map-badge');if(badge&&!badge.dataset.interactiveLabel){badge.dataset.interactiveLabel='1';badge.textContent=`${badge.textContent} · 이동/확대 가능`}}, {once:true});
  return true;
}
async function renderMapLayers(){
  const token=++renderToken;
  if(!map||!campusData)return;
  clearLayer(classOverlays);clearLayer(poiOverlays);clearLayer(routeLines);clearCurrent();
  const day=selectedDay(),places=uniquePlaces(day),next=day===todayIndex()?nextUpcoming():null;
  const bounds=new kakao.maps.LatLngBounds();let boundCount=0;
  places.forEach((item,index)=>{
    const place=resolved(item.raw);const pos=placeLatLng(place);if(!place||!pos)return;
    const isNext=Boolean(next&&next.place===item.raw);
    const overlay=new kakao.maps.CustomOverlay({map,position:pos,content:markerNode(index+1,place,isNext),xAnchor:.5,yAnchor:1.06,zIndex:isNext?5:4});
    classOverlays.push(overlay);extend(bounds,pos);boundCount++;
  });
  const list=dayEntries(day).filter(x=>x.place);
  for(let i=0;i<list.length-1;i++){
    if(token!==renderToken)return;
    const a=list[i],b=list[i+1],pa=resolved(a.place),pb=resolved(b.place);
    if(!pa||!pb||(pa.x===pb.x&&pa.y===pb.y))continue;
    const result=await route(pa,pb,a.place,b.place);
    const drawn=drawPolyline(result);
    if(!drawn)continue;
    routeLines.push(drawn.line);for(const p of drawn.path){extend(bounds,p);boundCount++}
  }
  if(poiLayerEnabled){
    const type=selectedNearby(),items=campusData?.nearby?.[type]||[];
    for(const item of items.slice(0,8)){
      const pos=placeLatLng(item);if(!pos)continue;
      const overlay=new kakao.maps.CustomOverlay({map,position:pos,content:poiNode(type,item),xAnchor:.5,yAnchor:.5,zIndex:3});
      poiOverlays.push(overlay);extend(bounds,pos);boundCount++;
    }
  }
  if(boundCount>1)map.setBounds(bounds);else if(boundCount===1){const first=places.map(x=>placeLatLng(resolved(x.raw))).find(Boolean);if(first){map.setCenter(first);map.setLevel(3)}}
  setTimeout(()=>{try{map.relayout()}catch{}},30);
}
async function activateInteractiveMap(){
  if(!document.querySelector('#campusView:not(.hidden)')&&location.pathname!=='/university/campus')return;
  const wrap=document.querySelector('#campusMapWrap');if(!wrap)return;
  try{
    const [data,sdkReady]=await Promise.all([getCampusData(),loadSdk()]);
    if(!data||!sdkReady)return;
    if(!ensureMap())return;
    await renderMapLayers();
  }catch{ /* static REST map remains visible as fallback */ }
}
function currentDestination(){const next=nextUpcoming();if(!next)return null;const place=resolved(next.place);return place?{entry:next,place}:null}
function getPosition(){return new Promise((resolve,reject)=>navigator.geolocation?.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:9000,maximumAge:45000}))}
async function drawCurrentRoute(){
  if(!map||!campusData)return;
  const dest=currentDestination();if(!dest)return;
  try{
    const pos=await getPosition();
    const start={x:String(pos.coords.longitude),y:String(pos.coords.latitude)};
    const result=await route(start,dest.place,'현재 위치',dest.entry.place);
    if(result?.status!=='OK')return;
    clearCurrent();
    const startPos=placeLatLng(start),destPos=placeLatLng(dest.place);if(!startPos||!destPos)return;
    const node=document.createElement('span');node.className='flow-campus-current';node.title='현재 위치';
    currentOverlay=new kakao.maps.CustomOverlay({map,position:startPos,content:node,xAnchor:.5,yAnchor:.5,zIndex:6});
    const drawn=drawPolyline(result,{current:true});if(drawn)currentRouteLine=drawn.line;
    const bounds=new kakao.maps.LatLngBounds();bounds.extend(startPos);bounds.extend(destPos);for(const p of drawn?.path||[])bounds.extend(p);map.setBounds(bounds);
  }catch{ /* geolocation denial is already handled by the existing campus UI */ }
}
function scheduleActivate(delay=80){setTimeout(()=>void activateInteractiveMap(),delay)}

document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-view="campus"]'))scheduleActivate(100);
  if(event.target.closest?.('[data-campus-day]'))scheduleActivate(120);
  if(event.target.closest?.('#campusFilter [data-nearby]')){poiLayerEnabled=true;scheduleActivate(100)}
  if(event.target.closest?.('#campusRefreshBtn')){campusData=null;campusPromise=null;campusSignature='';routeCache.clear();scheduleActivate(450)}
  if(event.target.closest?.('#currentRouteBtn'))setTimeout(()=>void drawCurrentRoute(),250);
},{passive:true});
window.addEventListener('popstate',()=>{if(location.pathname==='/university/campus')scheduleActivate(120)});
window.addEventListener('resize',()=>{if(map&&document.querySelector('#campusView:not(.hidden)'))setTimeout(()=>{try{map.relayout()}catch{}},80)},{passive:true});

if(location.pathname==='/university/campus')scheduleActivate(500);
