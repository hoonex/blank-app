const TRANSIT_MAP_EDGE='https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/transit-map';
const KAKAO_JS_KEY='cc0aae65f94df3b64e5d231dd3a9963a';
const PROFILE_KEY='flow-school-profile-v3';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
let sdkPromise=null;
let currentRoutes=[];
let openCard=null;
let currentMap=null;
let currentLayers=[];
let renderToken=0;

function profile(){try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')}catch{return null}}
function region(){return String(profile()?.school?.address||'').trim().split(/\s+/)[0]||''}
function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function installStyle(){
  if($('link[data-flow-transit-map]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='/school-transit-map.css?v=20260828-1';link.dataset.flowTransitMap='';document.head.append(link);
}
function loadSdk(){
  if(window.kakao?.maps?.Map)return Promise.resolve(true);
  if(['localhost','127.0.0.1','::1'].includes(location.hostname))return Promise.resolve(Boolean(window.kakao?.maps?.Map));
  if(sdkPromise)return sdkPromise;
  sdkPromise=new Promise(resolve=>{
    const script=document.createElement('script');
    script.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KAKAO_JS_KEY)}&autoload=false`;
    script.async=true;
    script.onload=()=>{try{kakao.maps.load(()=>resolve(Boolean(kakao.maps.Map)))}catch{resolve(false)}};
    script.onerror=()=>resolve(false);
    document.head.append(script);
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
    button.type='button';button.className='neo-button compact flow-transit-map-toggle';button.dataset.transitMapToggle=String(index);button.textContent='지도';button.setAttribute('aria-expanded','false');
    if(details)card.insertBefore(button,details);else card.append(button);
  });
}
function clearLayers(){
  for(const layer of currentLayers)try{layer.setMap?.(null)}catch{}
  currentLayers=[];currentMap=null;
}
function closeMap(){
  renderToken+=1;clearLayers();
  if(openCard){openCard.querySelector('.flow-transit-map-panel')?.remove();openCard.querySelector('.flow-transit-map-toggle')?.setAttribute('aria-expanded','false');openCard.classList.remove('has-transit-map')}
  openCard=null;
}
function point(item){
  const x=Number(item?.x),y=Number(item?.y);
  return Number.isFinite(x)&&Number.isFinite(y)&&window.kakao?.maps?new kakao.maps.LatLng(y,x):null;
}
function pinNode(kind,label=''){
  const node=document.createElement('span');node.className=`flow-transit-map-pin ${kind}`;
  node.innerHTML=`<i aria-hidden="true"></i><b>${esc(label)}</b>`;
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
function setStatus(panel,text,kind='neutral'){
  const status=$('.flow-transit-map-status',panel);if(status){status.textContent=text;status.dataset.kind=kind}
}
function mapPanel(route,index){
  const panel=document.createElement('section');panel.className='flow-transit-map-panel';panel.dataset.transitMapPanel=String(index);
  const buses=(route.segments||[]).filter(segment=>segment.type==='bus');
  panel.innerHTML=`<div class="flow-transit-map-head"><div><strong>버스 지도</strong><span>${buses.map(bus=>esc(bus.lines?.[0]||'버스')).join(' · ')}</span></div><button type="button" class="flow-transit-map-close" aria-label="지도 닫기">닫기</button></div><div class="flow-transit-map-status" role="status">노선과 운행 차량을 불러오는 중…</div><div class="flow-transit-map-canvas" aria-label="버스 노선 지도"></div>`;
  panel.querySelector('.flow-transit-map-close')?.addEventListener('click',closeMap);
  return panel;
}
function drawLeg(map,bounds,data,line,index){
  const stops=Array.isArray(data?.route?.stops)?data.route.stops:[];
  const path=stops.map(point).filter(Boolean);if(path.length<2)return{stops:0,vehicles:0};
  const polyline=new kakao.maps.Polyline({map,path,strokeWeight:index?5:6,strokeColor:index?'#56677b':'#1769e0',strokeOpacity:index?.72:.88});currentLayers.push(polyline);path.forEach(position=>bounds.extend(position));
  stops.slice(1,-1).forEach(stop=>{const position=point(stop);if(!position)return;const overlay=new kakao.maps.CustomOverlay({map,position,content:stopDot(),xAnchor:.5,yAnchor:.5,zIndex:3});currentLayers.push(overlay)});
  const start=point(stops[0]),end=point(stops.at(-1));
  if(start){const overlay=new kakao.maps.CustomOverlay({map,position:start,content:pinNode('board',index?'환승':'승차'),xAnchor:.5,yAnchor:1.05,zIndex:6});currentLayers.push(overlay)}
  if(end){const overlay=new kakao.maps.CustomOverlay({map,position:end,content:pinNode('alight',index+1===1?'하차':index?'하차':'하차'),xAnchor:.5,yAnchor:1.05,zIndex:6});currentLayers.push(overlay)}
  const vehicles=Array.isArray(data?.vehicles)?data.vehicles:[];
  for(const vehicle of vehicles){const position=point(vehicle);if(!position)continue;const overlay=new kakao.maps.CustomOverlay({map,position,content:vehicleNode(line),xAnchor:.5,yAnchor:.65,zIndex:8});currentLayers.push(overlay);bounds.extend(position)}
  return{stops:stops.length,vehicles:vehicles.length};
}
async function openMap(index,button){
  const route=currentRoutes[index];if(!route||!mapCapable(route))return;
  const card=button.closest('[data-transit-route]');if(!card)return;
  if(openCard===card){closeMap();return}
  closeMap();openCard=card;card.classList.add('has-transit-map');button.setAttribute('aria-expanded','true');
  const panel=mapPanel(route,index),details=card.querySelector('.flow-transit-details');if(details)card.insertBefore(panel,details);else card.append(panel);
  const token=++renderToken;
  const sdk=await loadSdk();if(token!==renderToken)return;
  if(!sdk){setStatus(panel,'지도를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.','error');return}
  const buses=(route.segments||[]).filter(segment=>segment.type==='bus');
  const controller=new AbortController();panel._flowAbort=controller;
  const results=await Promise.all(buses.map(bus=>fetchLeg(bus,controller.signal).catch(error=>({error:error instanceof Error?error.message:String(error)}))));
  if(token!==renderToken||!panel.isConnected)return;
  const successful=results.map((data,i)=>({data,bus:buses[i]})).filter(item=>!item.data?.error&&Array.isArray(item.data?.route?.stops)&&item.data.route.stops.length>1);
  if(!successful.length){setStatus(panel,results.find(x=>x?.error)?.error||'표시할 버스 노선 지도를 찾지 못했습니다.','error');return}
  const firstPoint=point(successful[0].data.route.stops[0]);if(!firstPoint){setStatus(panel,'노선 좌표를 읽지 못했습니다.','error');return}
  const canvas=$('.flow-transit-map-canvas',panel);currentMap=new kakao.maps.Map(canvas,{center:firstPoint,level:5});
  try{currentMap.setZoomable?.(true);currentMap.setDraggable?.(true)}catch{}
  const bounds=new kakao.maps.LatLngBounds();let stopCount=0,vehicleCount=0;
  successful.forEach(({data,bus},i)=>{const count=drawLeg(currentMap,bounds,data,String(bus.lines?.[0]||''),i);stopCount+=count.stops;vehicleCount+=count.vehicles});
  try{if(stopCount>1)currentMap.setBounds(bounds)}catch{}
  setStatus(panel,vehicleCount?`정류장 ${stopCount}곳 · 운행 차량 ${vehicleCount}대`:`정류장 ${stopCount}곳 · 실시간 차량 위치 없음`,vehicleCount?'live':'neutral');
  panel.dataset.mapReady='true';panel.dataset.vehicleCount=String(vehicleCount);
}
function handleClick(event){const button=event.target.closest?.('[data-transit-map-toggle]');if(button)openMap(Number(button.dataset.transitMapToggle),button)}
function handleRoutes(event){currentRoutes=Array.isArray(event.detail?.routes)?event.detail.routes:[];closeMap();decorateCards()}
function init(){installStyle();document.addEventListener('click',handleClick);window.addEventListener('flow:transit-routes-rendered',handleRoutes);document.documentElement.dataset.flowTransitMap='ready'}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
