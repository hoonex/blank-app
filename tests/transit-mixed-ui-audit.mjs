import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173/';
const OUT='transit-mixed-audit';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const today=(()=>{const d=new Date();return`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`})();
const dashboard={school:profile.school,selected:today,from:today,to:today,timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}};
const walk=(startName,endName,minutes,distance)=>({type:'walk',minutes,distance,stationCount:0,startName,endName,startId:'',endId:'',lines:[],direction:''});
const bus=(line,startName,endName,startId,endId,minutes,stationCount,direction)=>({type:'bus',minutes,distance:0,stationCount,startName,endName,startId,endId,lines:[line],direction});
const subway={type:'subway',minutes:13,distance:0,stationCount:6,startName:'동대구역',endName:'신천(경북대입구)',startId:'DG-1-21',endId:'DG-1-20',lines:['1호선'],direction:'설화명곡'};
const live=(routeNo,legIndex,stopName)=>({routeNo,seconds:360+legIndex*180,stops:4-legIndex,arrivalMinutes:6+legIndex*3,waitAddedMinutes:2+legIndex,source:'TAGO',checkedAt:new Date().toISOString(),stopName,legIndex});
const accessLive=live('708',0,'혁신도시입구'),egressLive=live('814',2,'신천역앞');
const mixed={
  id:'mixed-1',pathType:4,baselineMinutes:35,totalMinutes:37,walkMeters:390,payment:0,transfers:2,stationCount:17,
  segments:[
    walk('현재 위치','혁신도시입구',2,120),
    bus('708','혁신도시입구','동대구역환승센터','S1','S2',10,6,'동대구역'),
    walk('동대구역환승센터','동대구역',2,110),
    subway,
    walk('신천(경북대입구)','신천역앞',1,60),
    bus('814','신천역앞','경북대북문앞','S3','S4',7,5,'범물동'),
    walk('경북대북문앞','목적지',2,100),
  ],
  realtime:accessLive,realtimeLegs:[accessLive,egressLive],arrivalAt:new Date(Date.now()+37*60000).toISOString(),badges:['추천'],estimateMode:'mixed-static-rail-2026-06-30',mixedMode:'bus-subway-bus',
};
const pureBus={
  id:'bus-1',pathType:2,baselineMinutes:45,totalMinutes:46,walkMeters:520,payment:0,transfers:0,stationCount:19,
  segments:[walk('현재 위치','혁신도시입구',4,260),bus('708','혁신도시입구','경북대북문앞','S1','S4',37,19,'칠곡'),walk('경북대북문앞','목적지',5,260)],
  realtime:accessLive,realtimeLegs:[accessLive],arrivalAt:new Date(Date.now()+46*60000).toISOString(),badges:[],
};
const transit={
  generatedAt:new Date().toISOString(),destination:{name:'경북대학교',address:'대구광역시 북구 대학로 80',x:128.6113,y:35.8888,region:'대구광역시'},
  serviceArea:{id:'daegu',name:'대구광역시',policy:'source+destination-inside'},provider:'TAGO-public-data',providers:['TAGO-public-data','KRIC-snapshot+Kakao-SW8'],
  realtimeCoverage:'multi-leg',routeModes:['bus-direct','bus-one-transfer','bus-subway-bus','bus-subway-walk','walk-subway-bus'],mixedRouting:'protected-orchestrator',mixedAvailable:true,
  routes:[mixed,pureBus],
};
const rail={generatedAt:new Date().toISOString(),provider:'KRIC-snapshot+Kakao-SW8',snapshotDate:'2026-06-30',realtimeCoverage:'none',waitModel:'estimated',routeModes:['subway-direct','subway-one-transfer'],routes:[]};

const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];

function fulfill(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}

async function fixture(page,counters){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return fulfill(route,dashboard);
    if(action==='media')return fulfill(route,{media:{}});
    return fulfill(route,{});
  });
  await page.route('**/functions/v1/transit-data*',route=>{counters.bus+=1;return fulfill(route,transit)});
  await page.route('**/functions/v1/transit-rail*',route=>{counters.rail+=1;return fulfill(route,rail)});
  await page.addInitScript(({profile})=>{
    localStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
  },{profile});
}

const browser=await chromium.launch({headless:true});
const report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage();
  const counters={bus:0,rail:0},pageErrors=[],consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  await fixture(page,counters);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready');
  await page.locator('[data-flow-transit-nav]:visible').first().click();
  await page.locator('#transitLocateBtn').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-transit-route]').length===2);
  await page.waitForTimeout(100);
  const state=await page.evaluate(()=>{
    const first=document.querySelector('[data-transit-route="0"]');
    const transitTypes=[...first.querySelectorAll('.flow-transit-segment-chip')].map(node=>node.classList.contains('bus')?'bus':node.classList.contains('subway')?'subway':'walk');
    return{
      routeCount:document.querySelectorAll('[data-transit-route]').length,
      transitTypes:transitTypes.filter(type=>type!=='walk'),
      badge:first.querySelector('.flow-transit-badges span')?.textContent?.trim()||'',
      details:first.querySelector('.flow-transit-details')?.textContent?.trim()||'',
      liveRows:first.querySelectorAll('.flow-transit-live').length,
      transferLiveRows:first.querySelectorAll('.flow-transit-live[data-live-leg="1"],.flow-transit-live[data-live-leg="2"]').length,
      summary:document.querySelector('#transitSummary')?.textContent?.trim()||'',
      scrollWidth:document.documentElement.scrollWidth,
      clientWidth:document.documentElement.clientWidth,
      viewVisible:!document.querySelector('#transitView')?.classList.contains('hidden'),
    };
  });
  report[testCase.name]={...state,counters,pageErrors,consoleErrors};
  if(counters.bus!==1||counters.rail!==1)throw new Error(`${testCase.name}: expected one gated Transit request and one rail comparison request ${JSON.stringify(counters)}`);
  if(!state.viewVisible||state.routeCount!==2)throw new Error(`${testCase.name}: mixed Transit cards did not render ${JSON.stringify(state)}`);
  if(state.transitTypes.join('>')!=='bus>subway>bus')throw new Error(`${testCase.name}: mixed route order is wrong ${JSON.stringify(state.transitTypes)}`);
  if(state.badge!=='추천'||!state.details.includes('1호선')||!state.details.includes('708')||!state.details.includes('814'))throw new Error(`${testCase.name}: mixed route detail is incomplete ${JSON.stringify(state)}`);
  if(state.liveRows!==2||state.transferLiveRows<1)throw new Error(`${testCase.name}: mixed bus realtime legs are not preserved ${JSON.stringify(state)}`);
  if(!state.summary.includes('도시철도'))throw new Error(`${testCase.name}: mixed-mode summary is missing ${JSON.stringify(state)}`);
  if(state.scrollWidth>state.clientWidth+1)throw new Error(`${testCase.name}: horizontal overflow ${JSON.stringify(state)}`);
  if(pageErrors.length||consoleErrors.length)throw new Error(`${testCase.name}: browser errors ${JSON.stringify({pageErrors,consoleErrors})}`);
  await page.screenshot({path:`${OUT}/mixed-${testCase.name}.png`,fullPage:false});
  await page.screenshot({path:`${OUT}/mixed-${testCase.name}-full.png`,fullPage:true});
  await context.close();
}
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
await browser.close();
console.log(JSON.stringify({ok:true,viewports:Object.keys(report),route:'bus>subway>bus'},null,2));
