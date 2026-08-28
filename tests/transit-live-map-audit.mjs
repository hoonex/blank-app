import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'transit-live-map-audit';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계로1길 49'},grade:2,className:'6'};
const today=(()=>{const d=new Date();return`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`})();
const dashboard={school:profile.school,selected:today,from:today,to:today,timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}};
const walk=(start,end,minutes=4,distance=260)=>({type:'walk',minutes,distance,stationCount:0,startName:start,endName:end,startId:'',endId:'',lines:[],direction:''});
const subwayA={type:'subway',minutes:15,distance:0,stationCount:7,startName:'안심(혁신도시.첨복단지)',endName:'반월당',startId:'DG-1-32',endId:'DG-1-16',lines:['1호선'],direction:'설화명곡'};
const subwayB={type:'subway',minutes:6,distance:0,stationCount:3,startName:'반월당',endName:'경대병원',startId:'DG-2-T-반월당',endId:'DG-2-16',lines:['2호선'],direction:'영남대'};
const railRoute={id:'rail-1',pathType:1,baselineMinutes:34,totalMinutes:34,walkMeters:520,payment:0,transfers:1,stationCount:10,segments:[walk('현재 위치','안심(혁신도시.첨복단지)'),subwayA,subwayB,walk('경대병원','정동고등학교')],realtime:null,realtimeLegs:[],arrivalAt:new Date(Date.now()+34*60000).toISOString(),badges:['추천'],estimateMode:'static-snapshot'};
const busSegment={type:'bus',minutes:21,distance:6900,stationCount:5,startName:'혁신도시입구',endName:'동구청앞',startId:'DGB7010001',endId:'DGB7010006',lines:['708'],direction:'동구청'};
const busRoute={id:'route-1',pathType:2,baselineMinutes:30,totalMinutes:31,walkMeters:520,payment:0,transfers:0,stationCount:5,segments:[walk('현재 위치','혁신도시입구'),busSegment,walk('동구청앞','정동고등학교')],realtime:null,realtimeLegs:[],arrivalAt:new Date(Date.now()+31*60000).toISOString(),badges:['추천']};
const destination={name:'정동고등학교',address:'대구광역시 동구 용계로1길 49',x:128.695,y:35.876};
const stop=(id,name,order,x,y)=>({id,name,order,x,y});
const routeStops=[stop('DGB7010001','혁신도시입구',10,128.695,35.876),stop('DGB7010002','각산역',11,128.707,35.869),stop('DGB7010003','반야월역',12,128.714,35.866),stop('DGB7010004','동대구역환승센터',13,128.629,35.879),stop('DGB7010005','신암동',14,128.623,35.883),stop('DGB7010006','동구청앞',15,128.626,35.886)];
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function baseFixture(page,mode,counters){
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  if(mode==='rail'){
    await page.route('**/functions/v1/transit-data*',route=>json(route,{provider:'TAGO-public-data',destination,routes:[],error:'버스 경로 없음'},502));
    await page.route('**/functions/v1/transit-rail*',route=>json(route,{provider:'KRIC-snapshot+Kakao-SW8',snapshotDate:'2026-06-30',waitModel:'estimated',routes:[railRoute]}));
  }else{
    await page.route('**/functions/v1/transit-data*',route=>json(route,{provider:'TAGO-public-data',destination,routes:[busRoute],generatedAt:new Date().toISOString()}));
    await page.route('**/functions/v1/transit-rail*',route=>json(route,{provider:'KRIC-snapshot+Kakao-SW8',snapshotDate:'2026-06-30',waitModel:'estimated',routes:[]}));
    await page.route('**/functions/v1/transit-map*',route=>{counters.map+=1;const moved=counters.map>1;return json(route,{generatedAt:new Date().toISOString(),provider:'TAGO-public-data',geometry:'route-stop-sequence',cityCode:'22',route:{id:'DGB708',no:'708',start:routeStops[0],end:routeStops.at(-1),stops:routeStops},vehicles:[{vehicleNo:'대구70자1234',nodeId:moved?'DGB7010003':'DGB7010002',nodeName:moved?'반야월역':'각산역',nodeOrder:moved?12:11,x:moved?128.713:128.707,y:moved?35.866:35.869}],vehicleStatus:'live'})});
  }
  await page.addInitScript(({profile})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard')},{profile});
}
async function installKakaoFixture(page){
  await page.addInitScript(()=>{
    class LatLng{constructor(lat,lng){this.lat=lat;this.lng=lng}getLat(){return this.lat}getLng(){return this.lng}}
    class LatLngBounds{constructor(){this.points=[]}extend(p){this.points.push(p)}}
    const pos=p=>({left:`${Math.max(8,Math.min(92,10+(p.getLng()-128.60)*520))}%`,top:`${Math.max(8,Math.min(88,82-(p.getLat()-35.85)*900))}%`});
    class Map{constructor(container){this.container=container;container.style.position='relative';const bg=document.createElement('div');bg.style.cssText='position:absolute;inset:0;background:linear-gradient(135deg,#e9eef5,#dfe8f3)';container.append(bg)}setZoomable(){}setDraggable(){}setBounds(){}relayout(){}}
    class Polyline{constructor({map,path,strokeColor}){this.map=map;const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:1';svg.setAttribute('viewBox','0 0 100 100');const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('fill','none');line.setAttribute('stroke',strokeColor||'#1769e0');line.setAttribute('stroke-width','2');line.setAttribute('points',path.map(p=>{const q=pos(p);return`${parseFloat(q.left)},${parseFloat(q.top)}`}).join(' '));svg.append(line);map.container.append(svg);this.node=svg}setMap(next){if(!next)this.node?.remove();this.map=next}}
    class CustomOverlay{constructor({map,position,content,xAnchor=.5,yAnchor=.5}){this.map=map;this.content=content;content.style.position='absolute';content.style.zIndex='3';const q=pos(position);content.style.left=q.left;content.style.top=q.top;content.style.transform=`translate(${-xAnchor*100}%,${-yAnchor*100}%)`;map.container.append(content)}setMap(next){if(!next)this.content?.remove();this.map=next}}
    window.kakao={maps:{Map,LatLng,LatLngBounds,Polyline,CustomOverlay,load:callback=>callback()}};
  });
}
async function enterTransit(page){
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready'&&document.documentElement.dataset.flowTransitMap==='ready',{timeout:10000});
  await page.locator('[data-flow-transit-nav]:visible').first().click();await page.locator('#transitLocateBtn').click();await page.waitForSelector('[data-transit-route="0"]',{timeout:10000});await page.waitForSelector('[data-transit-route="0"] .flow-transit-map-toggle',{timeout:5000});
}
const browser=await chromium.launch({headless:true});const report={rail:{},bus:{}};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage(),errors=[],counters={map:0};page.on('pageerror',error=>errors.push(String(error)));await baseFixture(page,'rail',counters);await enterTransit(page);
  const button=page.locator('[data-transit-route="0"] .flow-transit-map-toggle');if((await button.textContent())?.trim()!=='노선도 보기')throw new Error(`${testCase.name}: rail route must expose 노선도 보기`);
  await button.click();await page.waitForFunction(()=>document.querySelector('.flow-transit-map-shell')?.dataset.mapReady==='true');
  const state=await page.evaluate(()=>({mode:document.querySelector('.flow-transit-map-shell')?.dataset.mapMode||'',sections:document.querySelectorAll('.flow-transit-rail-section').length,status:document.querySelector('.flow-transit-map-status')?.textContent?.trim()||'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,sheet:(()=>{const r=document.querySelector('.flow-transit-map-sheet')?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom}:null})()}));
  if(state.mode!=='rail'||state.sections!==2||!state.status.includes('실시간 열차 위치')||counters.map!==0||state.overflow>1)throw new Error(`${testCase.name}: rail sheet contract failed ${JSON.stringify({state,counters,errors})}`);
  if(!state.sheet||state.sheet.left<-1||state.sheet.top<-1||state.sheet.right>testCase.viewport.width+1||state.sheet.bottom>testCase.viewport.height+1)throw new Error(`${testCase.name}: rail sheet outside viewport ${JSON.stringify(state.sheet)}`);
  await page.screenshot({path:`${OUT}/rail-${testCase.name}.png`,fullPage:false});report.rail[testCase.name]={...state,pageErrors:errors};await context.close();
}
{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage(),errors=[],counters={map:0};page.on('pageerror',error=>errors.push(String(error)));await installKakaoFixture(page);await baseFixture(page,'bus',counters);await enterTransit(page);
  const button=page.locator('[data-transit-route="0"] .flow-transit-map-toggle');if((await button.textContent())?.trim()!=='지도 보기')throw new Error('bus route must expose 지도 보기');await button.click();await page.waitForFunction(()=>document.querySelector('.flow-transit-map-shell')?.dataset.mapReady==='true');
  if(counters.map!==1)throw new Error(`expected one lazy map request at open, got ${counters.map}`);const firstUpdated=await page.getAttribute('.flow-transit-map-shell','data-vehicle-updated-at');
  await page.waitForFunction(()=>document.querySelector('.flow-transit-map-shell')?.dataset.vehicleUpdatedAt,{timeout:22000});await page.waitForFunction(()=>document.querySelector('.flow-transit-map-shell')?.dataset.vehicleUpdatedAt!==arguments[0],firstUpdated,{timeout:22000}).catch(()=>{});
  await page.waitForFunction(()=>document.querySelector('.flow-transit-map-status')?.textContent?.includes('갱신'),{timeout:22000});
  if(counters.map<2)throw new Error(`live bus map did not refresh: ${counters.map} request(s)`);
  const busState=await page.evaluate(()=>({mode:document.querySelector('.flow-transit-map-shell')?.dataset.mapMode||'',vehicleCount:document.querySelector('.flow-transit-map-shell')?.dataset.vehicleCount||'',updatedAt:document.querySelector('.flow-transit-map-shell')?.dataset.vehicleUpdatedAt||'',status:document.querySelector('.flow-transit-map-status')?.textContent?.trim()||'',vehiclePins:document.querySelectorAll('.flow-transit-map-vehicle').length,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
  if(busState.mode!=='bus'||busState.vehicleCount!=='1'||!busState.updatedAt||busState.vehiclePins!==1||busState.overflow>1||errors.length)throw new Error(`live bus map contract failed ${JSON.stringify({busState,counters,errors})}`);
  await page.screenshot({path:`${OUT}/bus-live-mobile-portrait.png`,fullPage:false});report.bus.mobilePortrait={...busState,mapRequests:counters.map,pageErrors:errors};await context.close();
}
await browser.close();await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
