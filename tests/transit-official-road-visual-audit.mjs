import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'transit-official-road-visual-audit';
await fs.mkdir(OUT,{recursive:true});
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계로1길 49'},grade:2,className:'6'};
const today=(()=>{const d=new Date();return`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`})();
const dashboard={school:profile.school,selected:today,from:today,to:today,timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}};
const walk=(start,end)=>({type:'walk',minutes:4,distance:260,stationCount:0,startName:start,endName:end,startId:'',endId:'',lines:[],direction:''});
const bus={type:'bus',minutes:21,distance:6900,stationCount:5,startName:'혁신도시입구',endName:'동구청앞',startId:'DGB7010001',endId:'DGB7010006',lines:['708'],direction:'동구청'};
const route={id:'route-1',pathType:2,baselineMinutes:30,totalMinutes:31,walkMeters:520,payment:0,transfers:0,stationCount:5,segments:[walk('현재 위치','혁신도시입구'),bus,walk('동구청앞','정동고등학교')],realtime:null,realtimeLegs:[],arrivalAt:new Date(Date.now()+31*60000).toISOString(),badges:['추천']};
const destination={name:'정동고등학교',address:'대구광역시 동구 용계로1길 49',x:128.695,y:35.876};
const stop=(id,name,order,x,y)=>({id,name,order,x,y});
const stops=[stop('DGB7010001','혁신도시입구',10,128.695,35.876),stop('DGB7010002','각산역',11,128.707,35.869),stop('DGB7010003','반야월역',12,128.714,35.866),stop('DGB7010004','동대구역환승센터',13,128.629,35.879),stop('DGB7010005','신암동',14,128.623,35.883),stop('DGB7010006','동구청앞',15,128.626,35.886)];
// Fixture is deliberately road-shaped and denser than the TAGO stop sequence, mirroring the Edge route.path contract.
const path=[{x:128.695,y:35.876},{x:128.698,y:35.8755},{x:128.701,y:35.874},{x:128.704,y:35.872},{x:128.707,y:35.869},{x:128.711,y:35.867},{x:128.714,y:35.866},{x:128.708,y:35.867},{x:128.699,y:35.869},{x:128.690,y:35.871},{x:128.680,y:35.873},{x:128.668,y:35.875},{x:128.655,y:35.877},{x:128.642,y:35.878},{x:128.629,y:35.879},{x:128.626,y:35.881},{x:128.623,y:35.883},{x:128.624,y:35.885},{x:128.626,y:35.886}];
const mapData={generatedAt:new Date().toISOString(),provider:'TAGO-public-data+Daegu-official-SHP',geometry:'daegu-official-bus-link-snapshot',geometrySnapshot:'2025-09-03',cityCode:'22',route:{id:'DGB708',no:'708',start:stops[0],end:stops.at(-1),stops,path,officialGeometry:{matchedStops:stops.length,routedPairs:stops.length-1,maxSnapMeters:14.2}},vehicles:[{vehicleNo:'대구70자1234',nodeId:'DGB7010002',nodeName:'각산역',nodeOrder:11,x:128.707,y:35.869}],vehicleStatus:'live'};
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function install(page){
  await page.addInitScript(()=>{
    class LatLng{constructor(lat,lng){this.lat=lat;this.lng=lng}getLat(){return this.lat}getLng(){return this.lng}}
    class LatLngBounds{constructor(){this.points=[]}extend(p){this.points.push(p)}}
    const pos=p=>({left:`${Math.max(7,Math.min(93,8+(p.getLng()-128.60)*555))}%`,top:`${Math.max(7,Math.min(91,84-(p.getLat()-35.85)*920))}%`});
    class Map{constructor(container){this.container=container;container.style.position='relative';const surface=document.createElement('div');surface.style.cssText='position:absolute;inset:0;background:linear-gradient(90deg,#edf1f5 0 23%,#e4eadf 23% 25%,#f5f5f2 25% 62%,#e7edf3 62% 64%,#f4f1eb 64%)';container.append(surface)}setZoomable(){}setDraggable(){}setBounds(){}relayout(){}}
    class Polyline{constructor({map,path,strokeColor,strokeWeight}){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:1';svg.setAttribute('viewBox','0 0 100 100');const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('fill','none');line.setAttribute('stroke',strokeColor||'#1769e0');line.setAttribute('stroke-width',String(Math.max(1,(strokeWeight||5)/2)));line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');line.dataset.pathPoints=String(path.length);line.setAttribute('points',path.map(p=>{const q=pos(p);return`${parseFloat(q.left)},${parseFloat(q.top)}`}).join(' '));svg.append(line);map.container.append(svg);this.node=svg}setMap(next){if(!next)this.node?.remove()}}
    class CustomOverlay{constructor({map,position,content,xAnchor=.5,yAnchor=.5}){this.content=content;content.style.position='absolute';content.style.zIndex='3';const q=pos(position);content.style.left=q.left;content.style.top=q.top;content.style.transform=`translate(${-xAnchor*100}%,${-yAnchor*100}%)`;map.container.append(content)}setMap(next){if(!next)this.content?.remove()}}
    window.kakao={maps:{Map,LatLng,LatLngBounds,Polyline,CustomOverlay,load:cb=>cb()}};
  });
  await page.route('**/functions/v1/school-data*',r=>{const action=new URL(r.request().url()).searchParams.get('action')||'';return json(r,action==='dashboard'?dashboard:action==='media'?{media:{}}:{})});
  await page.route('**/functions/v1/transit-data*',r=>json(r,{provider:'TAGO-public-data',destination,routes:[route],generatedAt:new Date().toISOString()}));
  await page.route('**/functions/v1/transit-rail*',r=>json(r,{provider:'KRIC-snapshot+Kakao-SW8',snapshotDate:'2026-06-30',waitModel:'estimated',routes:[]}));
  await page.route('**/functions/v1/transit-map*',r=>json(r,mapData));
  await page.addInitScript(({profile})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard')},{profile});
}
const browser=await chromium.launch({headless:true});const report={};
for(const c of cases){
  const context=await browser.newContext({viewport:c.viewport,isMobile:c.isMobile,hasTouch:c.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));await install(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready'&&document.documentElement.dataset.flowTransitMap==='ready',{timeout:10000});
  await page.locator('[data-flow-transit-nav]:visible').first().click();await page.locator('#transitLocateBtn').click();await page.waitForSelector('[data-transit-route="0"] .flow-transit-map-toggle',{timeout:10000});await page.locator('[data-transit-route="0"] .flow-transit-map-toggle').click();
  await page.waitForFunction(()=>document.querySelector('.flow-transit-map-shell')?.dataset.mapReady==='true');await page.waitForFunction(()=>getComputedStyle(document.querySelector('.flow-transit-map-sheet')).transform==='none');
  const state=await page.evaluate(()=>{const shell=document.querySelector('.flow-transit-map-shell'),sheet=document.querySelector('.flow-transit-map-sheet'),canvas=document.querySelector('.flow-transit-map-canvas');const rect=n=>{const r=n?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};return{trace:shell?.dataset.routeTrace||'',snapshot:shell?.dataset.geometrySnapshot||'',points:Number(shell?.dataset.routeTracePoints||0),stops:Number(shell?.dataset.stopCount||0),status:document.querySelector('.flow-transit-map-status')?.textContent?.trim()||'',note:document.querySelector('.flow-transit-map-note')?.textContent?.trim()||'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,sheet:rect(sheet),canvas:rect(canvas),vehiclePins:document.querySelectorAll('.flow-transit-map-vehicle').length,errors:[]}});
  state.errors=errors;report[c.name]=state;
  if(state.trace!=='official-road-geometry'||state.snapshot!=='2025-09-03'||state.points<=state.stops||!state.status.includes('공식 도로 경로')||!state.note.includes('공식 버스 노선 공간정보')||state.vehiclePins!==1||state.overflow>1||errors.length)throw new Error(`${c.name}: official road visual contract failed ${JSON.stringify(state)}`);
  if(!state.sheet||state.sheet.left<-1||state.sheet.top<-1||state.sheet.right>c.viewport.width+1||state.sheet.bottom>c.viewport.height+1)throw new Error(`${c.name}: sheet clips ${JSON.stringify(state.sheet)}`);
  if(!state.canvas||state.canvas.height<(c.name==='mobile-landscape'?190:250))throw new Error(`${c.name}: map canvas too small ${JSON.stringify(state.canvas)}`);
  await page.screenshot({path:`${OUT}/official-road-${c.name}.png`,fullPage:false});await context.close();
}
await browser.close();await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));