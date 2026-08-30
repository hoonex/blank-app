import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-transit-today-audit';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계로1길 49'},grade:2,className:'6'};
const now=new Date(),today=`${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+2),nextDate=`${next.getFullYear()}${String(next.getMonth()+1).padStart(2,'0')}${String(next.getDate()).padStart(2,'0')}`;
const dashboard={
  school:profile.school,selected:today,from:today,to:today,
  timetable:[1,2,3,4,5,6].map((period,index)=>({date:today,period,subject:['문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][index]})),
  meals:[{date:today,type:'중식',dishes:['현미밥','된장국(5.6.)','닭갈비(5.6.15.)'],calories:'742 Kcal',nutrition:'',origin:''}],
  events:[{date:nextDate,name:'동아리 활동',content:'정규 동아리'}],scheduleMeta:{mode:'month',count:1},
};
const destination={name:'정동고등학교',address:'대구광역시 동구 용계로1길 49',x:128.695,y:35.876};
const route={
  id:'route-1',totalMinutes:24,walkMeters:320,payment:1500,transfers:0,
  segments:[
    {type:'walk',minutes:3,distance:170,startName:'현재 위치',endName:'혁신도시입구',lines:[]},
    {type:'bus',minutes:18,distance:5900,stationCount:9,startName:'혁신도시입구',endName:'동구청앞',startId:'DGB1',endId:'DGB9',lines:['708'],direction:'동구청'},
    {type:'walk',minutes:3,distance:150,startName:'동구청앞',endName:'정동고등학교',lines:[]},
  ],
  realtime:null,realtimeLegs:[],arrivalAt:new Date(Date.now()+24*60000).toISOString(),badges:['추천'],
};
const busBody={generatedAt:new Date().toISOString(),destination,serviceArea:{id:'daegu',name:'대구광역시',policy:'source+destination-inside'},provider:'TAGO-public-data',routes:[route]};
const railBody={generatedAt:new Date().toISOString(),provider:'KRIC-snapshot+Kakao-SW8',snapshotDate:'2026-06-30',waitModel:'estimated',routes:[]};
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page,counters){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard);
    if(action==='media')return json(route,{media:{}});
    return json(route,{});
  });
  await page.route('**/functions/v1/transit-data*',route=>{
    const url=new URL(route.request().url()),action=url.searchParams.get('action')||'route';
    if(action==='destination-search')return json(route,{query:url.searchParams.get('query')||'',provider:'Kakao-Local',suggestions:[]});
    counters.route+=1;return json(route,busBody);
  });
  await page.route('**/functions/v1/transit-rail*',route=>{counters.rail+=1;return json(route,railBody)});
  await page.addInitScript(({profile})=>{
    if(!sessionStorage.getItem('flow-transit-today-audit-init')){
      localStorage.clear();sessionStorage.clear();sessionStorage.setItem('flow-transit-today-audit-init','1');
    }
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
    let calls=0;
    const geolocation={
      getCurrentPosition(success){calls+=1;queueMicrotask(()=>success({coords:{longitude:128.696,latitude:35.876,accuracy:18}}))},
      watchPosition(){return 1},clearWatch(){},
    };
    Object.defineProperty(window,'__flowGeoCalls',{configurable:true,get:()=>calls});
    Object.defineProperty(navigator,'geolocation',{configurable:true,get:()=>geolocation});
  },{profile});
}
async function openToday(page){
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready'&&document.documentElement.dataset.flowTransitToday==='ready');
  await page.waitForFunction(()=>[...document.styleSheets].some(sheet=>String(sheet.href||'').includes('school-transit-today.css')));
  await page.waitForFunction(()=>document.querySelector('#quickLessons')?.textContent?.includes('교시'));
  await page.waitForSelector('#flowTransitTodayCard');
}
async function inspect(page){return page.evaluate(()=>{
  const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const card=document.querySelector('#flowTransitTodayCard'),grid=document.querySelector('#todayView .status-grid');
  return{
    path:location.pathname,state:card?.dataset.state||'',label:card?.querySelector('[data-transit-today-label]')?.textContent?.trim()||'',
    value:card?.querySelector('[data-transit-today-value]')?.textContent?.trim()||'',meta:card?.querySelector('[data-transit-today-meta]')?.textContent?.trim()||'',
    card:rect(card),grid:rect(grid),columns:getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
    scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,geoCalls:Number(window.__flowGeoCalls||0),
    summary:sessionStorage.getItem('flow-school-transit-today-v1'),
  };
})}
async function goToday(page){
  await page.locator('[data-view="today"]:visible').first().click();
  await page.waitForSelector('#todayView:not(.hidden)');
  await page.waitForFunction(()=>location.pathname==='/home'&&document.querySelector('#flowTransitTodayCard'));
}

const browser=await chromium.launch({headless:true}),report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage(),counters={route:0,rail:0},pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  await fixture(page,counters);await openToday(page);
  const idle=await inspect(page);report[testCase.name]={idle};
  const expectedColumns=testCase.viewport.width>1280?5:2;
  if(idle.state!=='idle'||idle.label!=='교통'||idle.value!=='학교까지 경로'||!idle.meta.includes('정동고등학교'))throw new Error(`${testCase.name}: Today Transit idle context failed ${JSON.stringify(idle)}`);
  if(idle.geoCalls!==0||counters.route!==0||counters.rail!==0)throw new Error(`${testCase.name}: Today must not request location or Transit before explicit search ${JSON.stringify({idle,counters})}`);
  if(idle.columns!==expectedColumns||!idle.card||idle.card.left<-1||idle.card.right>idle.clientWidth+1||idle.card.width<110||idle.scrollWidth>idle.clientWidth+1)throw new Error(`${testCase.name}: Today Transit card layout failed ${JSON.stringify(idle)}`);
  await page.screenshot({path:`${OUT}/today-transit-idle-${testCase.name}.png`,fullPage:false});

  await page.locator('#flowTransitTodayCard').click();
  await page.waitForSelector('#transitView:not(.hidden)');
  await page.waitForFunction(()=>location.pathname==='/transit');
  const transitEntry=await page.evaluate(()=>({geoCalls:Number(window.__flowGeoCalls||0),routeCount:document.querySelectorAll('[data-transit-route]').length}));
  if(transitEntry.geoCalls!==0||transitEntry.routeCount!==0||counters.route!==0||counters.rail!==0)throw new Error(`${testCase.name}: opening Transit from Today must stay permission-free ${JSON.stringify({transitEntry,counters})}`);

  await page.locator('#transitLocateBtn').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-transit-route]').length===1);
  const explicit=await page.evaluate(()=>({geoCalls:Number(window.__flowGeoCalls||0)}));
  if(explicit.geoCalls!==1||counters.route!==1||counters.rail!==1)throw new Error(`${testCase.name}: explicit Transit search should request location once and route once ${JSON.stringify({explicit,counters})}`);

  await goToday(page);await page.waitForFunction(()=>document.querySelector('#flowTransitTodayCard')?.dataset.state==='recent');
  const recent=await inspect(page);report[testCase.name].recent=recent;
  if(recent.label!=='최근 교통'||!recent.value.startsWith('24분 · ')||!recent.value.includes('도착')||!recent.meta.includes('정동고등학교')||!recent.meta.includes('708')||!recent.meta.includes('환승 없음'))throw new Error(`${testCase.name}: recent Transit summary is incomplete ${JSON.stringify(recent)}`);
  if(recent.geoCalls!==1||counters.route!==1||counters.rail!==1||recent.scrollWidth>recent.clientWidth+1)throw new Error(`${testCase.name}: returning to Today triggered unintended Transit work ${JSON.stringify({recent,counters})}`);
  if(pageErrors.length)throw new Error(`${testCase.name}: page errors ${JSON.stringify(pageErrors)}`);
  await page.screenshot({path:`${OUT}/today-transit-recent-${testCase.name}.png`,fullPage:false});
  await page.screenshot({path:`${OUT}/today-transit-recent-${testCase.name}-full.png`,fullPage:true});

  await page.locator('#flowTransitTodayCard').click();await page.waitForFunction(()=>location.pathname==='/transit');
  const reopen=await page.evaluate(()=>Number(window.__flowGeoCalls||0));
  if(reopen!==1||counters.route!==1||counters.rail!==1)throw new Error(`${testCase.name}: reopening Transit should not silently refresh location/routes ${JSON.stringify({reopen,counters})}`);
  await goToday(page);

  await openToday(page);
  const persisted=await inspect(page);report[testCase.name].persisted=persisted;
  if(persisted.state!=='recent'||!persisted.value.startsWith('24분 · ')||persisted.geoCalls!==0||counters.route!==1||counters.rail!==1)throw new Error(`${testCase.name}: same-session Transit summary did not survive navigation without refetch ${JSON.stringify({persisted,counters})}`);

  if(testCase.name==='mobile-portrait'){
    await page.evaluate(()=>{const key='flow-school-transit-today-v1',value=JSON.parse(sessionStorage.getItem(key)||'null');if(value){value.savedAt=Date.now()-11*60*1000;sessionStorage.setItem(key,JSON.stringify(value))}});
    await openToday(page);const expired=await inspect(page);report[testCase.name].expired=expired;
    if(expired.state!=='idle'||expired.summary!==null||expired.geoCalls!==0||counters.route!==1||counters.rail!==1)throw new Error(`expired Today Transit summary must fall back without background work ${JSON.stringify({expired,counters})}`);
    await page.screenshot({path:`${OUT}/today-transit-expired-mobile-portrait.png`,fullPage:false});
  }
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
