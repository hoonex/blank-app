import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||process.env.FLOW_BASE_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'school-transit-audit';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const today=(()=>{const d=new Date();return`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`})();
const dashboard={school:profile.school,selected:today,from:today,to:today,timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}};
const walkStart={type:'walk',minutes:4,distance:270,stationCount:0,startName:'현재 위치',endName:'혁신도시입구',startId:'',endId:'',lines:[],direction:''};
const walkEnd={type:'walk',minutes:5,distance:330,stationCount:0,startName:'동구청앞',endName:'정동고등학교',startId:'',endId:'',lines:[],direction:''};
const directBus={type:'bus',minutes:21,distance:6900,stationCount:12,startName:'혁신도시입구',endName:'동구청앞',startId:'123',endId:'456',lines:['708'],direction:'동구청'};
const transferBusA={type:'bus',minutes:11,distance:3400,stationCount:6,startName:'혁신도시입구',endName:'동대구역환승센터',startId:'123',endId:'789',lines:['708'],direction:'동대구역'};
const transferBusB={type:'bus',minutes:10,distance:3100,stationCount:5,startName:'동대구역환승센터',endName:'동구청앞',startId:'789',endId:'456',lines:['814'],direction:'범물동'};
function live(routeNo,index,overrides={}){
  return{routeNo,seconds:360+index*120,stops:4+index,arrivalMinutes:6+index*2,waitAddedMinutes:2+index,source:'TAGO',checkedAt:new Date().toISOString(),stopName:index?'동대구역환승센터':'혁신도시입구',legIndex:index,...overrides};
}
const busRoute=(index)=>{
  const first=index<3?live(index===0?'708':'814',0):null;
  const second=index===1?live('814',1,{seconds:1560,stops:3,arrivalMinutes:26,waitAddedMinutes:3}):null;
  const segments=index===1?[walkStart,transferBusA,transferBusB,walkEnd]:[walkStart,{...directBus,lines:[index===2?'814':index===3?'401':'708']},walkEnd];
  return{
    id:`bus-${index+1}`,pathType:index===1?3:2,baselineMinutes:30+index*3,totalMinutes:32+index*3,
    walkMeters:600-index*45,payment:1500+index*50,transfers:index===1?1:0,stationCount:12+index,
    segments,realtime:first,realtimeLegs:[first,second].filter(Boolean),
    arrivalAt:new Date(Date.now()+(32+index*3)*60000).toISOString(),badges:[],
  };
};
const transit={generatedAt:new Date().toISOString(),destination:{name:'정동고등학교',address:'대구광역시 동구 용계동 54',x:128.7004,y:35.8467},serviceArea:{id:'daegu',name:'대구광역시',policy:'source+destination-inside'},provider:'TAGO-public-data',realtimeCoverage:'multi-leg',routes:Array.from({length:5},(_,i)=>busRoute(i))};
const customTransitDestination={name:'동대구역',address:'대구광역시 동구 동부로 149',x:128.6285,y:35.8795};
const railWalkStart={type:'walk',minutes:3,distance:210,stationCount:0,startName:'현재 위치',endName:'안심(혁신도시.첨복단지)',startId:'',endId:'',lines:[],direction:''};
const subway={type:'subway',minutes:16,distance:0,stationCount:8,startName:'안심(혁신도시.첨복단지)',endName:'동대구역',startId:'DG-1-32',endId:'DG-1-21',lines:['1호선'],direction:'설화명곡'};
const railWalkEnd={type:'walk',minutes:4,distance:260,stationCount:0,startName:'동대구역',endName:'목적지',startId:'',endId:'',lines:[],direction:''};
const rail={generatedAt:new Date().toISOString(),provider:'KRIC-snapshot+Kakao-SW8',snapshotDate:'2026-06-30',realtimeCoverage:'none',waitModel:'estimated',routeModes:['subway-direct','subway-one-transfer'],routes:[{
  id:'rail-1',pathType:1,baselineMinutes:27,totalMinutes:27,walkMeters:470,payment:0,transfers:0,stationCount:8,
  segments:[railWalkStart,subway,railWalkEnd],realtime:null,realtimeLegs:[],arrivalAt:new Date(Date.now()+27*60000).toISOString(),badges:[],estimateMode:'static-snapshot',
}]};

const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page,counters,{busFailure=false,outsideFailure=false}={}){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard);
    if(action==='media')return json(route,{media:{}});
    return json(route,{});
  });
  await page.route('**/functions/v1/transit-data*',route=>{
    counters.bus+=1;
    const query=new URL(route.request().url()).searchParams.get('destination')||'';
    if(outsideFailure)return json(route,{code:'OUT_OF_SERVICE_AREA',error:'출발 위치가 대구광역시 밖입니다. Flow 교통은 현재 대구광역시 안에서만 경로를 검색합니다.',position:'source',detectedRegion:'경상북도',serviceArea:{id:'daegu',name:'대구광역시',policy:'source+destination-inside'},routes:[]},422);
    if(busFailure)return json(route,{error:'공공 교통데이터에서 연결 가능한 버스 경로를 찾지 못했습니다.',destination:transit.destination,provider:'TAGO-public-data',routes:[]},502);
    return json(route,{...transit,destination:query.includes('동대구역')?customTransitDestination:transit.destination});
  });
  await page.route('**/functions/v1/transit-rail*',route=>{counters.rail+=1;return json(route,rail)});
  await page.addInitScript(({profile})=>{
    localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');
  },{profile});
}
async function inspect(page){
  return page.evaluate(()=>{
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const visible=node=>Boolean(node&&!node.classList.contains('hidden')&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden');
    const bottom=[...document.querySelectorAll('#bottomNav>*')].filter(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0}).map(node=>node.textContent.trim());
    const first=document.querySelector('[data-transit-route="0"]');
    const search=document.querySelector('.flow-transit-search');
    const destinationCard=document.querySelector('#transitDestinationEditBtn'),editor=document.querySelector('#transitDestinationEditor'),input=document.querySelector('#transitDestinationInput'),reset=document.querySelector('#transitDestinationResetBtn'),locate=document.querySelector('#transitLocateBtn');
    return{
      path:location.pathname,
      scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,
      routeCount:document.querySelectorAll('[data-transit-route]').length,
      subwayCount:document.querySelectorAll('.flow-transit-segment-chip.subway').length,
      first:rect(first),viewportHeight:innerHeight,
      firstHasSubway:Boolean(first?.querySelector('.flow-transit-segment-chip.subway')),
      firstBadge:first?.querySelector('.flow-transit-badges span')?.textContent?.trim()||'',
      liveCount:document.querySelectorAll('.flow-transit-live').length,
      transferLiveCount:document.querySelectorAll('.flow-transit-live[data-live-leg="1"]').length,
      summary:document.querySelector('#transitSummary')?.textContent.trim()||'',
      state:document.querySelector('#transitState')?.textContent.trim()||'',
      stateKind:document.querySelector('#transitState')?.dataset.kind||'',
      serviceAreaLabel:search?getComputedStyle(search,'::before').content.replace(/^['"]|['"]$/g,''):'',
      destinationCard:rect(destinationCard),destinationName:document.querySelector('#transitSchoolName')?.textContent?.trim()||'',destinationAddress:document.querySelector('#transitSchoolAddress')?.textContent?.trim()||'',destinationKind:document.querySelector('#transitDestinationKind')?.textContent?.trim()||'',destinationExpanded:destinationCard?.getAttribute('aria-expanded')||'',destinationEditorOpen:visible(editor),destinationSubmit:document.querySelector('.flow-transit-destination-submit')?.textContent?.trim()||'',destinationInputFocused:document.activeElement===input,resetVisible:visible(reset),locateVisible:visible(locate),locateAction:locate?.textContent?.trim()||'',
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
  const page=await context.newPage();const pageErrors=[],counters={bus:0,rail:0};page.on('pageerror',error=>pageErrors.push(String(error)));
  await fixture(page,counters);await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready');
  await page.waitForFunction(()=>[...document.styleSheets].some(sheet=>String(sheet.href||'').includes('school-transit.css')));
  await page.locator('[data-flow-transit-nav]:visible').first().click();
  await page.waitForSelector('#transitView:not(.hidden)');

  const destinationIdle=await inspect(page);
  if(destinationIdle.destinationName!=='정동고등학교'||destinationIdle.destinationKind!=='학교'||destinationIdle.destinationExpanded!=='false'||destinationIdle.destinationEditorOpen||destinationIdle.locateAction!=='학교까지 경로 찾기')throw new Error(`${testCase.name}: destination card idle state is unclear ${JSON.stringify(destinationIdle)}`);
  await page.locator('#transitDestinationEditBtn').click();
  await page.waitForFunction(()=>document.querySelector('#transitDestinationEditBtn')?.getAttribute('aria-expanded')==='true'&&!document.querySelector('#transitDestinationEditor')?.classList.contains('hidden'));
  await page.waitForTimeout(50);
  const destinationEditor=await inspect(page);report[`${testCase.name}-destination-editor`]={...destinationEditor,counters:{...counters},pageErrors:[...pageErrors]};
  if(!destinationEditor.destinationEditorOpen||destinationEditor.destinationSubmit!=='이곳으로 경로 찾기'||!destinationEditor.destinationInputFocused||destinationEditor.locateVisible)throw new Error(`${testCase.name}: destination editor must be a single focused action ${JSON.stringify(destinationEditor)}`);
  if(!destinationEditor.destinationCard||destinationEditor.destinationCard.left<-1||destinationEditor.destinationCard.right>destinationEditor.clientWidth+1||destinationEditor.scrollWidth>destinationEditor.clientWidth+1)throw new Error(`${testCase.name}: destination editor/card overflow ${JSON.stringify(destinationEditor)}`);
  await page.screenshot({path:`${OUT}/school-transit-destination-${testCase.name}.png`,fullPage:false});
  await page.locator('#transitDestinationEditBtn').click();
  await page.waitForFunction(()=>document.querySelector('#transitDestinationEditBtn')?.getAttribute('aria-expanded')==='false'&&document.querySelector('#transitDestinationEditor')?.classList.contains('hidden'));

  await page.locator('#transitLocateBtn').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-transit-route]').length===5);
  await page.waitForTimeout(100);
  const state=await inspect(page);report[testCase.name]={...state,counters,pageErrors};
  if(counters.bus!==1||counters.rail!==1)throw new Error(`${testCase.name}: Transit should request bus once then rail once ${JSON.stringify(counters)}`);
  if(state.path!=='/transit'||!state.viewVisible)throw new Error(`${testCase.name}: transit route/view state failed ${JSON.stringify(state)}`);
  if(!state.serviceAreaLabel.includes('대구광역시'))throw new Error(`${testCase.name}: Daegu service-area label is not rendered ${JSON.stringify(state)}`);
  if(state.routeCount!==5)throw new Error(`${testCase.name}: expected five merged route cards ${JSON.stringify(state)}`);
  if(state.subwayCount<1||!state.firstHasSubway||state.firstBadge!=='추천')throw new Error(`${testCase.name}: fastest subway route must join merged recommendations ${JSON.stringify(state)}`);
  if(state.liveCount<2)throw new Error(`${testCase.name}: realtime bus enrichment is not visible after rail merge ${JSON.stringify(state)}`);
  if(state.transferLiveCount<1)throw new Error(`${testCase.name}: transfer-leg realtime arrival is not visible after rail merge ${JSON.stringify(state)}`);
  if(!state.summary.includes('도시철도'))throw new Error(`${testCase.name}: rail-aware Transit summary is missing ${JSON.stringify(state)}`);
  if(state.scrollWidth>state.clientWidth+1)throw new Error(`${testCase.name}: horizontal overflow ${JSON.stringify(state)}`);
  if(testCase.viewport.width<=900&&state.bottom.length!==5)throw new Error(`${testCase.name}: School bottom navigation should have five destinations ${JSON.stringify(state.bottom)}`);
  if(testCase.name==='mobile-landscape'&&(!state.first||state.first.top>state.viewportHeight-24))throw new Error(`${testCase.name}: first transit route is pushed below the first fold ${JSON.stringify(state)}`);
  if(pageErrors.length)throw new Error(`${testCase.name}: page errors ${JSON.stringify(pageErrors)}`);
  await page.screenshot({path:`${OUT}/school-transit-${testCase.name}.png`,fullPage:false});
  await page.screenshot({path:`${OUT}/school-transit-${testCase.name}-full.png`,fullPage:true});
  await context.close();
}

{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage();const pageErrors=[],counters={bus:0,rail:0};page.on('pageerror',error=>pageErrors.push(String(error)));
  await fixture(page,counters);await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready');
  await page.locator('[data-flow-transit-nav]:visible').first().click();
  await page.locator('#transitDestinationEditBtn').click();await page.locator('#transitDestinationInput').fill('동대구역');await page.locator('.flow-transit-destination-submit').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-transit-route]').length===5&&document.querySelector('#transitSchoolName')?.textContent?.trim()==='동대구역');
  const custom=await inspect(page);const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-school-transit-destination-v1')||'null'));
  report['mobile-portrait-custom-destination']={...custom,counters:{...counters},stored,pageErrors:[...pageErrors]};
  if(counters.bus!==1||counters.rail!==1)throw new Error(`custom destination submit must directly locate and route once ${JSON.stringify(counters)}`);
  if(custom.destinationName!=='동대구역'||custom.destinationAddress!=='대구광역시 동구 동부로 149'||custom.destinationKind!=='직접 지정'||custom.destinationEditorOpen||!custom.locateVisible||custom.locateAction!=='이 목적지까지 경로 찾기'||!custom.resetVisible)throw new Error(`custom destination resolved state is unclear ${JSON.stringify(custom)}`);
  if(stored?.query!=='동대구역'||stored?.name!=='동대구역'||stored?.address!=='대구광역시 동구 동부로 149')throw new Error(`custom destination persistence is incomplete ${JSON.stringify(stored)}`);
  if(custom.scrollWidth>custom.clientWidth+1||pageErrors.length)throw new Error(`custom destination browser regression ${JSON.stringify({custom,pageErrors})}`);
  await page.screenshot({path:`${OUT}/school-transit-mobile-portrait-custom-destination.png`,fullPage:false});

  await page.locator('#transitDestinationEditBtn').click();await page.locator('#transitDestinationResetBtn').click();
  await page.waitForFunction(()=>document.querySelector('#transitSchoolName')?.textContent?.trim()==='정동고등학교'&&document.querySelectorAll('[data-transit-route]').length===5);
  const reset=await inspect(page);const storedAfterReset=await page.evaluate(()=>localStorage.getItem('flow-school-transit-destination-v1'));
  report['mobile-portrait-destination-reset']={...reset,counters:{...counters},storedAfterReset,pageErrors:[...pageErrors]};
  if(counters.bus!==2||counters.rail!==2)throw new Error(`school destination reset must reroute from the existing coordinates ${JSON.stringify(counters)}`);
  if(reset.destinationName!=='정동고등학교'||reset.destinationKind!=='학교'||reset.locateAction!=='학교까지 경로 찾기'||reset.destinationEditorOpen||storedAfterReset!==null)throw new Error(`school destination reset state is incomplete ${JSON.stringify(reset)}`);
  await page.screenshot({path:`${OUT}/school-transit-mobile-portrait-destination-reset.png`,fullPage:false});
  await context.close();
}

{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',geolocation:{longitude:128.696,latitude:35.876},permissions:['geolocation']});
  const page=await context.newPage();const pageErrors=[],counters={bus:0,rail:0};page.on('pageerror',error=>pageErrors.push(String(error)));
  await fixture(page,counters,{busFailure:true});await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready');
  await page.locator('[data-flow-transit-nav]:visible').first().click();await page.locator('#transitLocateBtn').click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-transit-route]').length===1);
  const state=await inspect(page);report['mobile-portrait-bus-failure-rail-fallback']={...state,counters,pageErrors};
  if(counters.bus!==1||counters.rail!==1)throw new Error(`bus-failure fallback must still request rail once ${JSON.stringify(counters)}`);
  if(state.routeCount!==1||!state.firstHasSubway||state.stateKind==='error')throw new Error(`bus-failure fallback must preserve the rail route ${JSON.stringify(state)}`);
  if(!state.summary.includes('버스 경로 대신 도시철도'))throw new Error(`bus-failure fallback summary is missing ${JSON.stringify(state)}`);
  if(state.scrollWidth>state.clientWidth+1||pageErrors.length)throw new Error(`bus-failure fallback browser regression ${JSON.stringify({state,pageErrors})}`);
  await page.screenshot({path:`${OUT}/school-transit-mobile-portrait-bus-failure-rail-fallback.png`,fullPage:false});
  await context.close();
}

{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',geolocation:{longitude:128.485925,latitude:35.955765},permissions:['geolocation']});
  const page=await context.newPage();const pageErrors=[],counters={bus:0,rail:0};page.on('pageerror',error=>pageErrors.push(String(error)));
  await fixture(page,counters,{outsideFailure:true});await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});await page.waitForFunction(()=>document.documentElement.dataset.flowTransit==='ready');
  await page.locator('[data-flow-transit-nav]:visible').first().click();await page.locator('#transitLocateBtn').click();
  await page.waitForFunction(()=>document.querySelector('#transitState')?.dataset.kind==='error');
  const state=await inspect(page);report['mobile-portrait-outside-daegu-cutoff']={...state,counters,pageErrors};
  if(counters.bus!==1||counters.rail!==0)throw new Error(`outside-Daegu cutoff must stop before rail fallback ${JSON.stringify(counters)}`);
  if(state.routeCount!==0||state.stateKind!=='error'||!state.state.includes('대구광역시 밖'))throw new Error(`outside-Daegu error state is incomplete ${JSON.stringify(state)}`);
  if(!state.serviceAreaLabel.includes('대구광역시'))throw new Error(`outside-Daegu view lost service-area label ${JSON.stringify(state)}`);
  if(state.scrollWidth>state.clientWidth+1||pageErrors.length)throw new Error(`outside-Daegu browser regression ${JSON.stringify({state,pageErrors})}`);
  await page.screenshot({path:`${OUT}/school-transit-mobile-portrait-outside-daegu-cutoff.png`,fullPage:false});
  await context.close();
}

await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));