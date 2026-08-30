import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-transit-focus-audit';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const today=(()=>{const d=new Date();return`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`})();
const dashboard={school:profile.school,selected:today,from:today,to:today,timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}};
const destination={name:'정동고등학교',address:'대구광역시 동구 용계동 54',x:128.7004,y:35.8467};
const walk=(minutes,distance,startName,endName)=>({type:'walk',minutes,distance,stationCount:0,startName,endName,startId:'',endId:'',lines:[],direction:''});
const bus=(line,minutes,startName,endName,startId,endId)=>({type:'bus',minutes,distance:4200,stationCount:8,startName,endName,startId,endId,lines:[line],direction:endName});
const subway={type:'subway',minutes:18,distance:0,stationCount:9,startName:'안심',endName:'동대구역',startId:'DG-1-32',endId:'DG-1-21',lines:['1호선'],direction:'설화명곡'};
const live=(line,minutes,stops)=>({routeNo:line,seconds:minutes*60,stops,arrivalMinutes:minutes,waitAddedMinutes:minutes,source:'TAGO',checkedAt:new Date().toISOString(),stopName:'혁신도시입구',legIndex:0});
const makeBusRoute=(index,line,total,transfer=0)=>({
  id:`bus-${index}`,totalMinutes:total,walkMeters:240+index*70,payment:index===4?0:1500,transfers:transfer,
  segments:[walk(3,150,'현재 위치','혁신도시입구'),bus(line,total-6,'혁신도시입구','동구청앞',`S${index}A`,`S${index}B`),walk(3,120,'동구청앞','정동고등학교')],
  realtime:live(line,5+index,3+index),realtimeLegs:[live(line,5+index,3+index)],arrivalAt:new Date(Date.now()+total*60000).toISOString(),badges:index===0?['추천']:[],
});
const busRoutes=[makeBusRoute(0,'708',24),makeBusRoute(1,'814',27),makeBusRoute(2,'401',30),makeBusRoute(3,'동구2',33)];
const railRoute={id:'rail-1',totalMinutes:29,walkMeters:480,payment:0,transfers:0,segments:[walk(4,240,'현재 위치','안심'),subway,walk(7,240,'동대구역','정동고등학교')],realtime:null,realtimeLegs:[],arrivalAt:new Date(Date.now()+29*60000).toISOString(),badges:[]};
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
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  await page.route('**/functions/v1/transit-data*',route=>{const url=new URL(route.request().url()),action=url.searchParams.get('action')||'route';if(action==='destination-search')return json(route,{query:url.searchParams.get('query')||'',suggestions:[]});counters.bus+=1;return json(route,{generatedAt:new Date().toISOString(),provider:'TAGO-public-data',destination,routes:busRoutes})});
  await page.route('**/functions/v1/transit-rail*',route=>{counters.rail+=1;return json(route,{generatedAt:new Date().toISOString(),provider:'KRIC-snapshot+Kakao-SW8',snapshotDate:'2026-06-30',waitModel:'estimated',routes:[railRoute]})});
  await page.addInitScript(({profile})=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard')},{profile});
}
async function inspect(page){return page.evaluate(()=>{
  const cards=[...document.querySelectorAll('[data-transit-route]')];
  const visible=cards.filter(card=>getComputedStyle(card).display!=='none');
  const first=cards[0],firstRect=first?.getBoundingClientRect();
  return{
    cardCount:cards.length,visibleCount:visible.length,primaryCount:cards.filter(card=>card.classList.contains('flow-transit-primary')).length,
    alternativeCount:cards.filter(card=>card.classList.contains('flow-transit-alternative')).length,
    openDetails:cards.filter(card=>card.querySelector('.flow-transit-details')?.open).length,
    summary:document.querySelector('#transitSummary')?.textContent?.trim()||'',state:document.querySelector('#transitState')?.textContent?.trim()||'',
    moreText:document.querySelector('#transitMoreRoutesBtn')?.textContent?.trim()||'',moreExpanded:document.querySelector('#transitMoreRoutesBtn')?.getAttribute('aria-expanded')||'',
    firstBadge:first?.querySelector('.flow-transit-badges span')?.textContent?.trim()||'',firstMap:Boolean(first?.querySelector('.flow-transit-map-toggle')),
    meta:[...document.querySelectorAll('.flow-transit-meta span')].map(node=>({text:node.textContent.trim(),hidden:node.hidden})),
    todayCard:Boolean(document.querySelector('#flowTransitTodayCard')),todayReady:document.documentElement.dataset.flowTransitToday||'',
    focusReady:document.documentElement.dataset.flowTransitFocus||'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    firstTop:firstRect?.top??null,viewportHeight:innerHeight,
  };
})}

const browser=await chromium.launch({headless:true});const report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage(),counters={bus:0,rail:0},errors=[];page.on('pageerror',error=>errors.push(String(error)));await fixture(page,counters);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready'&&document.documentElement.dataset.flowTransitFocus==='ready');
  if(await page.locator('#flowTransitTodayCard').count())throw new Error(`${testCase.name}: rejected Today Transit card still exists`);
  await page.locator('[data-flow-transit-nav]:visible').first().click();await page.waitForSelector('#transitView:not(.hidden)');
  await page.locator('#transitLocateBtn').click();await page.waitForFunction(()=>document.querySelectorAll('[data-transit-route]').length===5&&document.querySelector('#transitMoreRoutesBtn'));
  await page.waitForFunction(()=>document.querySelector('#transitState')?.textContent?.includes('상위 3개 표시'));
  await page.waitForTimeout(60);
  const focused=await inspect(page);report[testCase.name]={focused,counters:{...counters},errors:[...errors]};
  if(counters.bus!==1||counters.rail!==1)throw new Error(`${testCase.name}: expected one explicit bus + rail search ${JSON.stringify(counters)}`);
  if(focused.cardCount!==5||focused.visibleCount!==3||focused.primaryCount!==1||focused.alternativeCount!==4)throw new Error(`${testCase.name}: focused route hierarchy failed ${JSON.stringify(focused)}`);
  if(focused.openDetails!==0||focused.firstBadge!=='추천'||!focused.summary.includes('추천 24분')||!focused.summary.includes('708'))throw new Error(`${testCase.name}: primary route is still noisy or unclear ${JSON.stringify(focused)}`);
  if(focused.state!=='현재 위치 기준 · 5개 비교 · 상위 3개 표시')throw new Error(`${testCase.name}: verbose base renderer state leaked back into focused Transit ${JSON.stringify(focused)}`);
  if(focused.moreText!=='다른 경로 2개 더 보기'||focused.moreExpanded!=='false')throw new Error(`${testCase.name}: hidden alternatives control failed ${JSON.stringify(focused)}`);
  if(focused.meta.some(item=>item.text==='환승 0회')||focused.meta.some(item=>item.text==='요금 정보 없음'&&!item.hidden))throw new Error(`${testCase.name}: route metadata noise remains ${JSON.stringify(focused.meta)}`);
  if(focused.todayCard||focused.todayReady||focused.focusReady!=='ready'||focused.overflow>1||errors.length)throw new Error(`${testCase.name}: focused Transit regression ${JSON.stringify({focused,errors})}`);
  if(testCase.name==='mobile-landscape'&&focused.firstTop!==null&&focused.firstTop>focused.viewportHeight-30)throw new Error(`${testCase.name}: primary route is pushed below the first fold ${JSON.stringify(focused)}`);
  await page.screenshot({path:`${OUT}/transit-focus-${testCase.name}.png`,fullPage:false});
  await page.screenshot({path:`${OUT}/transit-focus-${testCase.name}-full.png`,fullPage:true});
  await page.locator('#transitMoreRoutesBtn').click();const expanded=await inspect(page);report[testCase.name].expanded=expanded;
  if(expanded.visibleCount!==5||expanded.moreExpanded!=='true'||expanded.moreText!=='다른 경로 접기')throw new Error(`${testCase.name}: expanding alternatives failed ${JSON.stringify(expanded)}`);
  await page.locator('#transitMoreRoutesBtn').click();const collapsed=await inspect(page);report[testCase.name].collapsed=collapsed;
  if(collapsed.visibleCount!==3||collapsed.moreExpanded!=='false')throw new Error(`${testCase.name}: collapsing alternatives failed ${JSON.stringify(collapsed)}`);
  await context.close();
}
await browser.close();await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
