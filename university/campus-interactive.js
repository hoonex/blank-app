import '/university/dashboard.js';
import '/university/ui-unify.js';
import '/university/dashboard-editor-feedback.js';
import {decoratePoiNode} from '/university/poi-icons.js';
const KAKAO_JS_KEY='cc0aae65f94df3b64e5d231dd3a9963a';
const CAMPUS_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/university-campus';
const PROFILE_KEY='flow-university-profile-v1',TIMETABLE_KEY='flow-university-timetable-v1';
let sdkPromise=null,campusPromise=null,campusSignature='',campusData=null,map=null,mapContainer=null,classOverlays=[],poiOverlays=[],routeLines=[],routeOverlays=[],currentOverlay=null,currentRouteLine=null,currentRouteOverlay=null,currentPosition=null,currentRouteData=null,poiLayerEnabled=false,renderToken=0;
const routeCache=new Map();

function read(k,f=null){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}
function profile(){return read(PROFILE_KEY)}
function timetable(){return read(TIMETABLE_KEY)}
function todayIndex(){return(new Date().getDay()+6)%7}
function entries(){const tt=timetable();if(!tt?.subjects)return[];return tt.subjects.flatMap((subject,subjectIndex)=>(subject.times||[]).map(time=>({...time,subject,subjectIndex,place:String(time.place||subject.place||'').trim()}))).filter(x=>Number.isFinite(x.day)&&Number.isFinite(x.startMinutes)).sort((a,b)=>a.day-b.day||a.startMinutes-b.startMinutes)}
function dayEntries(d){return entries().filter(x=>x.day===d)}
function selectedDay(){const a=document.querySelector('#campusDayTabs [data-campus-day].active');if(a)return Number(a.dataset.campusDay);const days=[...new Set(entries().map(x=>x.day))];return days.includes(todayIndex())?todayIndex():(days[0]??todayIndex())}
function selectedNearby(){return document.querySelector('#campusFilter [data-nearby].active')?.dataset.nearby||'dining'}
function uniquePlaces(day){const out=[],seen=new Set();for(const entry of dayEntries(day)){if(!entry.place)continue;const key=entry.place.toLowerCase();if(seen.has(key))continue;seen.add(key);out.push({raw:entry.place,entry})}return out}
function resolution(raw){return campusData?.places?.find(x=>String(x.raw).trim()===String(raw).trim())||null}
function resolved(raw){const r=resolution(raw);return r?.resolved?r.place:null}
function signature(){const p=profile(),tt=timetable();if(!p)return'';return`${p.id||''}|${p.name||''}|${p.address||''}|${tt?.year||''}|${tt?.semester||''}|${entries().map(x=>`${x.day}:${x.startMinutes}:${x.place}`).join('|')}`}

async function campusApi(action,payload){const url=new URL(CAMPUS_EDGE);url.searchParams.set('action',action);const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)}),b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'캠퍼스 정보를 불러오지 못했습니다.');return b}
async function getCampusData(){const p=profile();if(!p)return null;const s=signature();if(campusData&&campusSignature===s)return campusData;if(campusPromise&&campusSignature===s)return campusPromise;campusSignature=s;campusPromise=campusApi('campus',{schoolName:p.name,address:p.address,items:entries().filter(x=>x.place).map(x=>({place:x.place}))}).then(d=>campusData=d).finally(()=>campusPromise=null);return campusPromise}
function loadSdk(){if(['localhost','127.0.0.1','::1'].includes(location.hostname))return Promise.resolve(false);if(window.kakao?.maps?.Map)return Promise.resolve(true);if(sdkPromise)return sdkPromise;sdkPromise=new Promise(resolve=>{const script=document.createElement('script');script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JS_KEY)}&autoload=false`;script.async=true;script.onload=()=>{try{kakao.maps.load(()=>resolve(Boolean(kakao.maps.Map)))}catch{resolve(false)}};script.onerror=()=>resolve(false);document.head.append(script)});return sdkPromise}
function clearLayer(list){for(const x of list)try{x.setMap(null)}catch{}list.length=0}
function point(p){if(!window.kakao?.maps||!p)return null;const x=Number(Array.isArray(p)?p[0]:p.x??p.lng),y=Number(Array.isArray(p)?p[1]:p.y??p.lat);return Number.isFinite(x)&&Number.isFinite(y)?new kakao.maps.LatLng(y,x):null}
function placePoint(p){return point({x:p?.x,y:p?.y})}
function currentLocationNode(){const root=document.createElement('span');root.className='flow-campus-current-location';root.setAttribute('aria-label','현재 위치');root.innerHTML='<i></i><b>현재 위치</b>';return root}
function renderCurrentLocation(bounds){
  if(currentOverlay){try{currentOverlay.setMap(null)}catch{}currentOverlay=null}
  if(!map||!currentPosition)return 0;
  const pos=point(currentPosition);if(!pos)return 0;
  currentOverlay=new kakao.maps.CustomOverlay({map,position:pos,content:currentLocationNode(),xAnchor:.5,yAnchor:.5,zIndex:9});bounds?.extend(pos);
  return 1
}

function markerNode(index,item,entry,isNext=false){
  const root=document.createElement(item?.url?'a':'span');
  root.className=`flow-campus-class-pin${isNext?' is-next':''}`;
  if(item?.url){root.href=item.url;root.target='_blank';root.rel='noopener noreferrer'}
  root.title=entry?.place||item?.name||'';
  const pin=document.createElement('span');
  pin.className='flow-campus-marker';
  pin.textContent=String(index);
  const label=document.createElement('span');
  label.className='flow-campus-course-label';
  label.textContent=entry?.subject?.name||entry?.place||item?.name||'수업';
  root.append(pin,label);
  return root;
}
function poiNode(type,item){const n=document.createElement(item?.url?'a':'span');n.className=`flow-campus-poi flow-campus-poi-${type}`;decoratePoiNode(n,type,item);if(item?.url){n.href=item.url;n.target='_blank';n.rel='noopener noreferrer'}return n}
function routeDistanceText(meters){const m=Math.max(0,Number(meters||0));if(!m)return'';return m>=1000?`${(m/1000).toFixed(m>=10000?0:1)}km`:`${Math.max(10,Math.round(m/10)*10)}m`}
function routeMidpoint(path){
  if(!path?.length)return null;
  if(path.length===1)return path[0];
  const segments=[];
  let total=0;
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    const aLat=a.getLat(),aLng=a.getLng(),bLat=b.getLat(),bLng=b.getLng();
    const meanLat=(aLat+bLat)*Math.PI/360;
    const dx=(bLng-aLng)*Math.cos(meanLat),dy=bLat-aLat;
    const length=Math.hypot(dx,dy);
    if(length<=0)continue;
    segments.push({aLat,aLng,bLat,bLng,length,start:total});
    total+=length;
  }
  if(!segments.length)return path[Math.floor(path.length/2)];
  const target=total/2;
  const segment=segments.find(s=>s.start+s.length>=target)||segments.at(-1);
  const ratio=Math.max(0,Math.min(1,(target-segment.start)/segment.length));
  return new kakao.maps.LatLng(segment.aLat+(segment.bLat-segment.aLat)*ratio,segment.aLng+(segment.bLng-segment.aLng)*ratio);
}
function routeLabel(routeData,path,prefix='도보'){
  const sec=Number(routeData?.duration??routeData?.durationSeconds??routeData?.time??0);
  const dist=Number(routeData?.distance??routeData?.distanceMeters??0);
  let min=sec>0?Math.max(1,Math.round(sec/60)):0;
  if(!min&&dist>0)min=Math.max(1,Math.round(dist/75));
  const position=routeMidpoint(path);
  if(!min||!position)return null;
  const node=document.createElement('span');
  node.className=`flow-campus-route-time${prefix==='현재'?' is-current':''}`;
  const distance=routeDistanceText(dist);
  node.textContent=distance?`${prefix} ${min}분 · ${distance}`:`${prefix} ${min}분`;
  return{node,position};
}
function nextUpcoming(){const now=new Date(),mins=now.getHours()*60+now.getMinutes();return dayEntries(todayIndex()).filter(x=>x.place).find(x=>x.startMinutes>mins)||null}
async function route(a,b,an,bn){if(!a?.x||!a?.y||!b?.x||!b?.y)return null;const k=`${a.x},${a.y}>${b.x},${b.y}`;if(routeCache.has(k))return routeCache.get(k);const p=campusApi('route',{start:a,end:b,startName:an,endName:bn}).then(x=>x.route).catch(()=>null);routeCache.set(k,p);return p}
function drawPolyline(r,current=false){if(r?.status!=='OK'||!Array.isArray(r.points)||!r.points.length||!map)return null;const path=r.points.map(point).filter(Boolean);if(path.length<2)return null;return{line:new kakao.maps.Polyline({map,path,strokeWeight:current?6:5,strokeColor:current?'#1769e0':'#26384f',strokeOpacity:current?.92:.8}),path}}
function renderCurrentRoute(bounds){
  if(currentRouteLine){try{currentRouteLine.setMap(null)}catch{}currentRouteLine=null}
  if(currentRouteOverlay){try{currentRouteOverlay.setMap(null)}catch{}currentRouteOverlay=null}
  if(!map||!currentRouteData?.route)return 0;
  const drawn=drawPolyline(currentRouteData.route,true);if(!drawn)return 0;
  currentRouteLine=drawn.line;drawn.path.forEach(p=>bounds?.extend(p));
  const label=routeLabel(currentRouteData.route,drawn.path,'현재');if(label){currentRouteOverlay=new kakao.maps.CustomOverlay({map,position:label.position,content:label.node,xAnchor:.5,yAnchor:.5,zIndex:8})}
  return drawn.path.length
}

function ensureMap(){const wrap=document.querySelector('#campusMapWrap');if(!wrap||!campusData?.center?.x||!campusData?.center?.y||!window.kakao?.maps?.Map)return false;if(map&&mapContainer?.isConnected)return true;mapContainer=document.createElement('div');mapContainer.className='campus-interactive-map';wrap.append(mapContainer);map=new kakao.maps.Map(mapContainer,{center:new kakao.maps.LatLng(Number(campusData.center.y),Number(campusData.center.x)),level:3});map.setZoomable(true);map.setDraggable(true);kakao.maps.event.addListener(map,'tilesloaded',()=>{wrap.classList.add('interactive-ready');wrap.dataset.interactiveMap='ready'});return true}
async function renderMapLayers(){
  const token=++renderToken;
  if(!map||!campusData)return;
  clearLayer(classOverlays);clearLayer(poiOverlays);clearLayer(routeLines);clearLayer(routeOverlays);
  const day=selectedDay(),places=uniquePlaces(day),next=day===todayIndex()?nextUpcoming():null,bounds=new kakao.maps.LatLngBounds();
  let count=0;
  places.forEach((item,i)=>{
    const p=resolved(item.raw),pos=placePoint(p);
    if(!p||!pos)return;
    const overlay=new kakao.maps.CustomOverlay({map,position:pos,content:markerNode(i+1,p,item.entry,Boolean(next&&next.place===item.raw)),xAnchor:.5,yAnchor:1.18,zIndex:5});
    classOverlays.push(overlay);bounds.extend(pos);count++;
  });
  const list=dayEntries(day).filter(x=>x.place);
  for(let i=0;i<list.length-1;i++){
    if(token!==renderToken)return;
    const a=list[i],b=list[i+1],pa=resolved(a.place),pb=resolved(b.place);
    if(!pa||!pb||(pa.x===pb.x&&pa.y===pb.y))continue;
    const result=await route(pa,pb,a.place,b.place),drawn=drawPolyline(result);
    if(!drawn)continue;
    routeLines.push(drawn.line);
    drawn.path.forEach(p=>{bounds.extend(p);count++});
    const label=routeLabel(result,drawn.path);
    if(label){const o=new kakao.maps.CustomOverlay({map,position:label.position,content:label.node,xAnchor:.5,yAnchor:.5,zIndex:4});routeOverlays.push(o)}
  }
  if(poiLayerEnabled){const type=selectedNearby();for(const item of(campusData?.nearby?.[type]||[]).slice(0,8)){const pos=placePoint(item);if(!pos)continue;poiOverlays.push(new kakao.maps.CustomOverlay({map,position:pos,content:poiNode(type,item),xAnchor:.5,yAnchor:.5,zIndex:3}));bounds.extend(pos);count++}}
  count+=renderCurrentLocation(bounds);
  count+=renderCurrentRoute(bounds);
  if(count>1)map.setBounds(bounds);
  setTimeout(()=>{try{map.relayout()}catch{}},30);
}
async function activate(){const wrap=document.querySelector('#campusMapWrap');if(!wrap)return;try{const[data,sdk]=await Promise.all([getCampusData(),loadSdk()]);if(data&&sdk&&ensureMap())await renderMapLayers()}catch{}}
function schedule(d=80){setTimeout(()=>void activate(),d)}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-view="campus"],[data-campus-day]'))schedule(120);if(e.target.closest?.('#campusFilter [data-nearby]')){poiLayerEnabled=true;schedule(100)}if(e.target.closest?.('#campusRefreshBtn')){campusData=null;campusSignature='';routeCache.clear();schedule(450)}},{passive:true});
window.addEventListener('flow:campus-current-position',e=>{const lat=Number(e.detail?.lat),lng=Number(e.detail?.lng),accuracy=Number(e.detail?.accuracy||0);if(!Number.isFinite(lat)||!Number.isFinite(lng))return;currentPosition={lat,lng,accuracy};schedule(0)});
window.addEventListener('flow:campus-current-route',e=>{const d=e.detail||{},sx=Number(d.start?.x),sy=Number(d.start?.y);if(Number.isFinite(sx)&&Number.isFinite(sy))currentPosition={lng:sx,lat:sy,accuracy:0};currentRouteData=d;schedule(0)});
window.addEventListener('popstate',()=>{if(location.pathname==='/university/campus')schedule(120)});
window.addEventListener('resize',()=>{if(map)setTimeout(()=>{try{map.relayout()}catch{}},80)},{passive:true});
if(location.pathname==='/university/campus')schedule(500);