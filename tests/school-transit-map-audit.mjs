import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||process.env.FLOW_BASE_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'school-transit-map-audit';
await fs.mkdir(OUT,{recursive:true});
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const today=(()=>{const d=new Date();return`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`})();
const dashboard={school:profile.school,selected:today,from:today,to:today,timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}};
const walkStart={type:'walk',minutes:4,distance:270,stationCount:0,startName:'현재 위치',endName:'혁신도시입구',startId:'',endId:'',lines:[],direction:''};
const walkEnd={type:'walk',minutes:5,distance:330,stationCount:0,startName:'동구청앞',endName:'정동고등학교',startId:'',endId:'',lines:[],direction:''};
const directBus={type:'bus',minutes:21,distance:6900,stationCount:5,startName:'혁신도시입구',endName:'동구청앞',startId:'DGB7010001',endId:'DGB7010006',lines:['708'],direction:'동구청'};
const transferBusA={type:'bus',minutes:11,distance:3400,stationCount:3,startName:'혁신도시입구',endName:'동대구역환승센터',startId:'DGB7010001',endId:'DGB7010004',lines:['708'],direction:'동대구역'};
const transferBusB={type:'bus',minutes:10,distance:3100,stationCount:2,startName:'동대구역환승센터',endName:'동구청앞',startId:'DGB7020001',endId:'DGB7020003',lines:['814'],direction:'범물동'};
const subway={type:'subway',minutes:16,distance:6200,stationCount:8,startName:'안심역',endName:'동대구역',startId:'1',endId:'2',lines:['1호선'],direction:'설화명곡'};
const live={routeNo:'708',seconds:360,stops:4,arrivalMinutes:6,waitAddedMinutes:6,source:'TAGO',checkedAt:new Date().toISOString(),stopName:'혁신도시입구',legIndex:0};
const route=(index)=>({
  id:`route-${index+1}`,pathType:index===1?3:index===2?1:2,baselineMinutes:30+index*3,totalMinutes:32+index*3,walkMeters:600-index*45,payment:0,transfers:index===1?1:0,stationCount:12+index,
  segments:index===1?[walkStart,transferBusA,transferBusB,walkEnd]:index===2?[walkStart,subway,walkEnd]:[walkStart,directBus,walkEnd],realtime:index===0?live:null,realtimeLegs:index===0?[live]:[],arrivalAt:new Date(Date.now()+(32+index*3)*60000).toISOString(),badges:index===0?['추천']:[],
});
const transit={generatedAt:new Date().toISOString(),destination:{name:'정동고등학교',address:'대구광역시 동구 용계동 54',x:128.7,y:35.87},realtimeCoverage:'partial',routes:Array.from({length:5},(_,i)=>route(i))};
const stop=(id,name,order,x,y)=>({id,name,order,x,y});
const map708={generatedAt:new Date().toISOString(),provider:'TAGO-public-data',geometry:'route-stop-sequence',cityCode:'22',route:{id:'DGB708',no:'708',start:stop('DGB7010001','혁신도시입구',10,128.695,35.876),end:stop('DGB7010006','동구청앞',15,128.626,35.886),stops:[stop('DGB7010001','혁신도시입구',10,128.695,35.876),stop('DGB7010002','각산역',11,128.708,35.868),stop('DGB7010003','반야월역',12,128.714,35.866),stop('DGB7010004','동대구역환승센터',13,128.629,35.879),stop('DGB7010005','신암동',14,128.623,35.883),stop('DGB7010006','동구청앞',15,128.626,35.886)]},vehicles:[{vehicleNo:'대구70자1234',nodeId:'DGB7010002',nodeName:'각산역',nodeOrder:11,x:128.707,y:35.869}],vehicleStatus:'live'};
const map814={...map708,route:{...map708.route,id:'DGB814',no:'814',start:stop('DGB7020001','동대구역환승센터',20,128.629,35.879),end:stop('DGB7020003','동구청앞',22,128.626,35.886),stops:[stop('DGB7020001','동대구역환승센터',20,128.629,35.879),stop('DGB7020002','신암동',21,128.623,35.883),stop('DGB7020003','동구청앞',22,128.626,35.886)]},vehicles:[],vehicleStatus:'unavailable'};
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];
function json(route,body){return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function installKakaoFixture(page){
  await page.addInitScript(()=>{
    class LatLng{constructor(lat,lng){this.lat=lat;this.lng=lng}getLat(){return this.lat}getLng(){return this.lng}}
    class LatLngBounds{constructor(){this.points=[]}extend(p){this.points.push(p)}}
    const pos=(p)=>({left:`${Math.max(8,Math.min(92,10+(p.getLng()-128.60)*520))}%`,top:`${Math.max(8,Math.min(88,82-(p.getLat()-35.85)*900))}%`});
    class Map{constructor(container){this.container=container;container.classList.add('fixture-kakao-map');const surface=document.createElement('div');surface.className='fixture-kakao-surface';surface.innerHTML='<i></i><i></i><i></i><i></i><span>대구</span>';container.append(surface)}setZoomable(){}setDraggable(){}setBounds(){}relayout(){}setCenter(){}setLevel(){}}
    class Polyline{constructor({map,path,strokeColor,strokeWeight}){this.map=map;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 100 100');svg.classList.add('fixture-route-line');const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('fill','none');line.setAttribute('stroke',strokeColor||'#1769e0');line.setAttribute('stroke-width',String(Math.max(1,(strokeWeight||5)/2)));line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');line.setAttribute('points',path.map(p=>{const q=pos(p);return`${parseFloat(q.left)},${parseFloat(q.top)}`}).join(' '));svg.append(line);map.container.append(svg)}setMap(next){if(!next)this.map=null}}
    class CustomOverlay{constructor({map,position,content}){this.map=map;this.content=content;content.classList.add('fixture-overlay');const q=pos(position);content.style.left=q.left;content.style.top=q.top;map.container.append(content)}setMap(next){if(!next)this.content?.remove();this.map=next}}
    window.kakao={maps:{Map,LatLng,LatLngBounds,Polyline,CustomOverlay,load:callback=>callback()}};
  });
}
async function fixture(page,counters){
  await installKakaoFixture(page);
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  await page.route('**/functions/v1/transit-data*',route=>json(route,transit));
  await page.route('**/functions/v1/transit-map*',route=>{counters.map+=1;const line=new URL(route.request().url()).searchParams.get('line');return json(route,line==='814'?map814:map708)});
  await page.addInitScript(({profile})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard')},{profile});
}
async function inspect(page){return page.evaluate(()=>{const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};const panel=document.querySelector('.flow-transit-map-panel');return{scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,toggles:document.querySelectorAll('.flow-transit-map-toggle').length,panels:document.querySelectorAll('.flow-transit-map-panel').length,panel:rect(panel),ready:panel?.dataset.mapReady||'',vehicles:panel?.dataset.vehicleCount||'',pins:document.querySelectorAll('.flow-transit-map-pin').length,vehiclePins:document.querySelectorAll('.flow-transit-map-vehicle').length,lines:document.querySelectorAll('.fixture-route-line').length,status:document.querySelector('.flow-transit-map-status')?.textContent?.trim()||'',pageHeight:document.documentElement.scrollHeight}})}
const browser=await chromium.launch({headless:true});const report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage(),pageErrors=[],counters={map:0};page.on('pageerror',error=>pageErrors.push(String(error)));await fixture(page,counters);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready'&&document.documentElement.dataset.flowTransitMap==='ready');
  await page.locator('[data-flow-transit-nav]:visible').first().click();await page.locator('#transitLocateBtn').click();await page.waitForFunction(()=>document.querySelectorAll('[data-transit-route]').length===5&&document.querySelectorAll('.flow-transit-map-toggle').length>=4);
  if(counters.map!==0)throw new Error(`${testCase.name}: map data must stay lazy before click, got ${counters.map}`);
  await page.locator('[data-transit-route="0"] .flow-transit-map-toggle').click();await page.waitForFunction(()=>document.querySelector('.flow-transit-map-panel')?.dataset.mapReady==='true');await page.waitForTimeout(80);
  const state=await inspect(page);report[testCase.name]={...state,mapRequests:counters.map,pageErrors};
  if(counters.map!==1)throw new Error(`${testCase.name}: expected one lazy route-map request, got ${counters.map}`);
  if(state.panels!==1||state.ready!=='true'||state.lines<1||state.pins<2||state.vehiclePins<1)throw new Error(`${testCase.name}: bus map visual layers incomplete ${JSON.stringify(state)}`);
  if(!state.status.includes('운행 차량 1대'))throw new Error(`${testCase.name}: live vehicle status missing ${JSON.stringify(state)}`);
  if(state.scrollWidth>state.clientWidth+1)throw new Error(`${testCase.name}: horizontal overflow ${JSON.stringify(state)}`);
  if(pageErrors.length)throw new Error(`${testCase.name}: page errors ${JSON.stringify(pageErrors)}`);
  await page.screenshot({path:`${OUT}/school-transit-map-${testCase.name}.png`,fullPage:false});await page.screenshot({path:`${OUT}/school-transit-map-${testCase.name}-full.png`,fullPage:true});await context.close();
}
await browser.close();await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
