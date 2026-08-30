import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-transit-destination-suggestions-audit';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const today=(()=>{const d=new Date();return`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`})();
const dashboard={school:profile.school,selected:today,from:today,to:today,timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}};
const suggestions=[
  {id:'station-main',name:'동대구역',address:'대구광역시 동구 동부로 149',category:'기차역',x:128.6285,y:35.8795,distanceMeters:4120},
  {id:'station-subway',name:'동대구역 1호선',address:'대구광역시 동구 동대구로 530',category:'지하철역',x:128.6279,y:35.8779,distanceMeters:3980},
  {id:'station-transfer',name:'동대구역복합환승센터',address:'대구광역시 동구 동부로 149',category:'버스터미널',x:128.6292,y:35.8791,distanceMeters:4210},
];
const busSegment={type:'bus',minutes:18,distance:5600,stationCount:9,startName:'혁신도시입구',endName:'동대구역복합환승센터',startId:'123',endId:'789',lines:['708'],direction:'동대구역'};
const routeBody={generatedAt:new Date().toISOString(),destination:suggestions[0],serviceArea:{id:'daegu',name:'대구광역시',policy:'source+destination-inside'},provider:'TAGO-public-data',routes:[{id:'route-1',totalMinutes:24,walkMeters:310,payment:1500,transfers:0,segments:[{type:'walk',minutes:3,distance:180,lines:[]},busSegment,{type:'walk',minutes:3,distance:130,lines:[]}],realtime:null,realtimeLegs:[],arrivalAt:new Date(Date.now()+24*60000).toISOString(),badges:['추천']} ]};
const rail={generatedAt:new Date().toISOString(),provider:'KRIC-snapshot+Kakao-SW8',snapshotDate:'2026-06-30',waitModel:'estimated',routes:[]};
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page,counters,captured){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard);
    if(action==='media')return json(route,{media:{}});
    return json(route,{});
  });
  await page.route('**/functions/v1/transit-data*',route=>{
    const url=new URL(route.request().url()),action=url.searchParams.get('action')||'route';
    if(action==='destination-search'){
      counters.search+=1;captured.search=url;
      return json(route,{query:url.searchParams.get('query')||'',provider:'Kakao-Local',serviceArea:{id:'daegu',name:'대구광역시',policy:'source+destination-inside'},suggestions});
    }
    counters.route+=1;captured.route=url;return json(route,routeBody);
  });
  await page.route('**/functions/v1/transit-rail*',route=>{counters.rail+=1;return json(route,rail)});
  await page.addInitScript(({profile})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard')},{profile});
}
async function openTransit(page){
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready');
  await page.locator('[data-flow-transit-nav]:visible').first().click();
  await page.waitForSelector('#transitView:not(.hidden)');
  await page.locator('#transitDestinationEditBtn').click();
  await page.locator('#transitDestinationInput').fill('동대구');
  await page.waitForFunction(()=>document.querySelectorAll('[data-destination-suggestion]').length===3);
}
async function inspect(page){return page.evaluate(()=>{
  const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
  const panel=document.querySelector('#transitDestinationSuggestions'),input=document.querySelector('#transitDestinationInput'),submit=document.querySelector('.flow-transit-destination-submit');
  return{
    scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
    panel:rect(panel),input:rect(input),submit:rect(submit),viewportHeight:innerHeight,
    expanded:input?.getAttribute('aria-expanded')||'',
    names:[...document.querySelectorAll('.flow-transit-destination-suggestion-main strong')].map(n=>n.textContent.trim()),
    meta:[...document.querySelectorAll('.flow-transit-destination-suggestion-main em')].map(n=>n.textContent.trim()),
    addresses:[...document.querySelectorAll('.flow-transit-destination-suggestion>small')].map(n=>n.textContent.trim()),
  };
})}

const browser=await chromium.launch({headless:true});
const report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage(),counters={search:0,route:0,rail:0},captured={},pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  await fixture(page,counters,captured);await openTransit(page);const state=await inspect(page);report[testCase.name]={state,counters,pageErrors};
  if(counters.search!==1||counters.route!==0)throw new Error(`${testCase.name}: typing should only search real destinations ${JSON.stringify(counters)}`);
  if(state.expanded!=='true'||state.names[0]!=='동대구역'||state.names.length!==3)throw new Error(`${testCase.name}: related place results missing ${JSON.stringify(state)}`);
  if(!state.meta.some(v=>v.includes('기차역'))||!state.addresses[0]?.includes('대구광역시'))throw new Error(`${testCase.name}: real place metadata missing ${JSON.stringify(state)}`);
  if(state.scrollWidth>state.clientWidth+1||!state.panel||state.panel.left<-1||state.panel.right>state.clientWidth+1)throw new Error(`${testCase.name}: suggestion panel overflow ${JSON.stringify(state)}`);
  if(!state.input||state.panel.top<state.input.bottom-1||state.panel.top-state.input.bottom>14)throw new Error(`${testCase.name}: suggestions must sit directly below the search input ${JSON.stringify(state)}`);
  if(testCase.name==='mobile-portrait'&&(!state.submit||state.submit.top<state.panel.bottom-1))throw new Error(`${testCase.name}: free-text submit must follow suggestions instead of separating them from the input ${JSON.stringify(state)}`);
  if(testCase.name==='mobile-landscape'&&state.panel.height>120)throw new Error(`${testCase.name}: result list is too tall for landscape ${JSON.stringify(state)}`);
  if(pageErrors.length)throw new Error(`${testCase.name}: page errors ${JSON.stringify(pageErrors)}`);
  await page.screenshot({path:`${OUT}/destination-suggestions-${testCase.name}.png`,fullPage:false});
  await context.close();
}

{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage(),counters={search:0,route:0,rail:0},captured={},pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  await fixture(page,counters,captured);await openTransit(page);
  await page.locator('#transitDestinationInput').press('ArrowDown');
  await page.locator('#transitDestinationInput').press('Enter');
  await page.waitForFunction(()=>document.querySelectorAll('[data-transit-route]').length===1&&document.querySelector('#transitSchoolName')?.textContent?.trim()==='동대구역');
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-school-transit-destination-v1')||'null'));
  const routeUrl=captured.route;
  report.selection={counters,stored,routeParams:routeUrl?Object.fromEntries(routeUrl.searchParams):null,pageErrors};
  if(counters.search!==1||counters.route!==1||counters.rail!==1)throw new Error(`selection should search once then route once ${JSON.stringify(counters)}`);
  if(routeUrl?.searchParams.get('ex')!==String(suggestions[0].x)||routeUrl?.searchParams.get('ey')!==String(suggestions[0].y))throw new Error(`selected coordinates were not routed exactly ${routeUrl}`);
  if(routeUrl?.searchParams.get('destinationName')!=='동대구역'||routeUrl?.searchParams.get('destinationAddress')!==suggestions[0].address)throw new Error(`selected place identity was not preserved ${routeUrl}`);
  if(stored?.name!=='동대구역'||stored?.address!==suggestions[0].address||stored?.x!==suggestions[0].x||stored?.y!==suggestions[0].y||stored?.category!=='기차역')throw new Error(`selected place persistence incomplete ${JSON.stringify(stored)}`);
  if(pageErrors.length)throw new Error(`selection page errors ${JSON.stringify(pageErrors)}`);
  await page.screenshot({path:`${OUT}/destination-selected-mobile-portrait.png`,fullPage:false});
  await context.close();
}

await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));