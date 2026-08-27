import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||process.env.FLOW_BASE_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'school-transit-audit';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const today=(()=>{const d=new Date();return`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`})();
const dashboard={school:profile.school,selected:today,from:today,to:today,timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}};
const baseSegments=[
  {type:'walk',minutes:4,distance:270,stationCount:0,startName:'',endName:'정류장',startId:'',endId:'',lines:[],direction:''},
  {type:'bus',minutes:21,distance:6900,stationCount:12,startName:'혁신도시입구',endName:'동구청앞',startId:'123',endId:'456',lines:['708'],direction:''},
  {type:'walk',minutes:5,distance:330,stationCount:0,startName:'동구청앞',endName:'정동고등학교',startId:'',endId:'',lines:[],direction:''},
];
const route=(index,overrides={})=>({
  id:`route-${index+1}`,pathType:index%3===0?2:3,baselineMinutes:30+index*3,totalMinutes:32+index*3,
  walkMeters:600-index*45,payment:1500+index*50,transfers:index%3,stationCount:12+index,
  segments:index===1?[baseSegments[0],{type:'subway',minutes:16,distance:6200,stationCount:8,startName:'안심역',endName:'동대구역',startId:'1',endId:'2',lines:['1호선'],direction:'설화명곡'},baseSegments[2]]:baseSegments,
  realtime:index<3?{routeNo:index===0?'708':'814',seconds:360+index*120,stops:4+index,arrivalMinutes:6+index*2,waitAddedMinutes:2+index,source:'TAGO',checkedAt:new Date().toISOString()}:null,
  arrivalAt:new Date(Date.now()+(32+index*3)*60000).toISOString(),badges:index===0?['추천']:index===1?['걷기 적음']:index===2?['환승 적음']:[],...overrides,
});
const transit={generatedAt:new Date().toISOString(),destination:{name:'정동고등학교',address:'대구광역시 동구 용계동 54',x:128.7,y:35.87},realtimeCoverage:'partial',routes:Array.from({length:5},(_,i)=>route(i))};

const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];

function json(route,body){return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard);
    if(action==='media')return json(route,{media:{}});
    return json(route,{});
  });
  await page.route('**/functions/v1/transit-data*',route=>json(route,transit));
  await page.addInitScript(({profile})=>{
    localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');
  },{profile});
}
async function inspect(page){
  return page.evaluate(()=>{
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const bottom=[...document.querySelectorAll('#bottomNav>*')].filter(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}).map(node=>node.textContent.trim());
    const first=document.querySelector('[data-transit-route="0"]');
    return{
      path:location.pathname,
      scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
      routeCount:document.querySelectorAll('[data-transit-route]').length,
      first:rect(first),viewportHeight:innerHeight,
      liveCount:document.querySelectorAll('.flow-transit-live').length,
      bottom,
      transitActive:document.querySelector('[data-flow-transit-nav].active')?.textContent.trim()||'',
      viewVisible:!document.querySelector('#transitView')?.classList.contains('hidden'),
    };
  });
}

const browser=await chromium.launch({headless:true});
const report={};
for(const testCase of cases){
  const context=await browser.newContext({
    viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',
    geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation'],
  });
  const page=await context.newPage();const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  await fixture(page);await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready');
  await page.waitForFunction(()=>[...document.styleSheets].some(sheet=>String(sheet.href||'').includes('school-transit.css')));
  await page.locator('[data-flow-transit-nav]:visible').first().click();
  await page.waitForSelector('#transitView:not(.hidden)');
  await page.locator('#transitLocateBtn').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-transit-route]').length===5);
  await page.waitForTimeout(100);
  const state=await inspect(page);report[testCase.name]={...state,pageErrors};
  if(state.path!=='/transit'||!state.viewVisible)throw new Error(`${testCase.name}: transit route/view state failed ${JSON.stringify(state)}`);
  if(state.routeCount!==5)throw new Error(`${testCase.name}: expected five route cards ${JSON.stringify(state)}`);
  if(state.liveCount<1)throw new Error(`${testCase.name}: realtime arrival enrichment is not visible ${JSON.stringify(state)}`);
  if(state.scrollWidth>state.clientWidth+1)throw new Error(`${testCase.name}: horizontal overflow ${JSON.stringify(state)}`);
  if(testCase.viewport.width<=900&&state.bottom.length!==5)throw new Error(`${testCase.name}: School bottom navigation should have five destinations ${JSON.stringify(state.bottom)}`);
  if(testCase.name==='mobile-landscape'&&(!state.first||state.first.top>state.viewportHeight-24))throw new Error(`${testCase.name}: first transit route is pushed below the first fold ${JSON.stringify(state)}`);
  if(pageErrors.length)throw new Error(`${testCase.name}: page errors ${JSON.stringify(pageErrors)}`);
  await page.screenshot({path:`${OUT}/school-transit-${testCase.name}.png`,fullPage:false});
  await page.screenshot({path:`${OUT}/school-transit-${testCase.name}-full.png`,fullPage:true});
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
