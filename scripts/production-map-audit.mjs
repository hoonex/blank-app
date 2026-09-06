import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.FLOW_PRODUCTION_URL||'https://blank-app.agfvrd.workers.dev';
const out='production-map-audit';
const PROFILE_KEY='flow-university-profile-v1';
const TIMETABLE_KEY='flow-university-timetable-v1';
const profile=Object.freeze({
  id:'0000005',
  name:'경북대학교',
  address:'대구광역시 북구 대학로 80',
  surveyYear:'2025'
});
await mkdir(out,{recursive:true});
if(!profile.id||!profile.name||!profile.address)throw new Error(`Production map fixture is incomplete: ${JSON.stringify(profile)}`);

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true,colorScheme:'light',geolocation:{latitude:35.8888,longitude:128.6103},permissions:['geolocation']});
const page=await context.newPage();
await page.clock.setFixedTime(new Date('2026-08-20T09:20:00+09:00'));
const consoleErrors=[],pageErrors=[],failed=[],routeRequests=[],httpErrors=[];
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
page.on('pageerror',err=>pageErrors.push(String(err)));
page.on('requestfailed',req=>failed.push({url:req.url(),error:req.failure()?.errorText||''}));
page.on('response',res=>{if(res.status()>=400)httpErrors.push({url:res.url(),status:res.status()})});
page.on('request',req=>{if(req.method()==='POST'&&req.url().includes('/functions/v1/university-campus')&&req.url().includes('action=route'))routeRequests.push(req.url())});

await page.addInitScript(({profile,profileKey,timetableKey})=>{
  const day=(new Date().getDay()+6)%7;
  const timetable={source:'production-map-audit',year:2026,semester:'2학기',subjects:[
    {id:'a',name:'소프트웨어설계',professor:'테스트',credit:3,place:'IT대학 2호관',times:[{day,startMinutes:540,endMinutes:615,start:'09:00',end:'10:15',place:'IT대학 2호관'}]},
    {id:'b',name:'자료구조',professor:'테스트',credit:3,place:'공대9호관',times:[{day,startMinutes:630,endMinutes:705,start:'10:30',end:'11:45',place:'공대9호관'}]},
    {id:'c',name:'교양세미나',professor:'테스트',credit:2,place:'법과대학',times:[{day,startMinutes:780,endMinutes:855,start:'13:00',end:'14:15',place:'법과대학'}]}
  ]};
  localStorage.setItem(profileKey,JSON.stringify(profile));
  localStorage.setItem(timetableKey,JSON.stringify(timetable));
  localStorage.setItem('flow-university-theme-v1','light');
},{profile,profileKey:PROFILE_KEY,timetableKey:TIMETABLE_KEY});

async function diagnostic(stage,error){
  const state=await page.evaluate(({profileKey,timetableKey})=>({
    href:location.href,
    path:location.pathname,
    readyState:document.readyState,
    profileRaw:localStorage.getItem(profileKey),
    timetableRaw:localStorage.getItem(timetableKey),
    setupClass:document.querySelector('#setupView')?.className||'',
    appClass:document.querySelector('#appView')?.className||'',
    campusExists:Boolean(document.querySelector('#campusView')),
    campusClass:document.querySelector('#campusView')?.className||'',
    campusPanel:document.querySelector('#campusView')?.dataset.panel||'',
    activeViews:[...document.querySelectorAll('[data-view].active')].map(x=>x.dataset.view||x.textContent?.trim()||''),
    scripts:[...document.scripts].map(x=>x.src).filter(Boolean),
    moduleResources:performance.getEntriesByType('resource').map(x=>x.name).filter(x=>/\/university\/(?:university|campus|campus-interactive|poi-icons)\.js(?:\?|$)/.test(x)),
  }),{profileKey:PROFILE_KEY,timetableKey:TIMETABLE_KEY}).catch(e=>({evaluateError:String(e)}));
  const payload={
    stage,
    error:String(error?.stack||error||''),
    state,
    consoleErrors,
    pageErrors,
    httpErrors,
    failed:failed.filter(x=>!x.url.includes('dge.hs.kr')),
  };
  await writeFile(`${out}/diagnostic.json`,JSON.stringify(payload,null,2));
  await page.screenshot({path:`${out}/diagnostic.png`,fullPage:true}).catch(()=>{});
  console.error(`Production campus diagnostic (${stage}): ${JSON.stringify(payload,null,2)}`);
  return payload;
}

async function assertFixturePresent(){
  const fixture=await page.evaluate(({profileKey,timetableKey})=>({
    profile:localStorage.getItem(profileKey),
    timetable:localStorage.getItem(timetableKey),
  }),{profileKey:PROFILE_KEY,timetableKey:TIMETABLE_KEY});
  if(!fixture.profile||!fixture.timetable)throw new Error(`Production campus fixture did not survive navigation: ${JSON.stringify(fixture)}`);
}

async function waitForCampusView(){
  try{
    await page.locator('#campusView:not(.hidden)').waitFor({timeout:15000});
  }catch(error){
    await diagnostic('campus-view-visible',error);
    throw error;
  }
}

async function openCampus(){
  await page.goto(`${base}/university/campus`,{waitUntil:'domcontentloaded',timeout:30000});
  await assertFixturePresent().catch(async error=>{await diagnostic('fixture-after-navigation',error);throw error});
  await waitForCampusView();
  try{
    await page.waitForFunction(()=>document.querySelector('#campusMapWrap')?.dataset.interactiveMap==='ready',{timeout:30000});
  }catch(firstError){
    await page.reload({waitUntil:'domcontentloaded',timeout:30000});
    await assertFixturePresent().catch(async error=>{await diagnostic('fixture-after-reload',error);throw error});
    await waitForCampusView();
    await page.waitForFunction(()=>document.querySelector('#campusMapWrap')?.dataset.interactiveMap==='ready',{timeout:30000}).catch(async()=>{await diagnostic('interactive-map-ready',firstError);throw firstError});
  }
}

await openCampus();
await page.waitForFunction(()=>document.querySelectorAll('.flow-campus-class-pin').length>=2,{timeout:20000});
await page.waitForFunction(()=>document.querySelectorAll('.flow-campus-route-time').length>=1,{timeout:25000});
await page.locator('#campusRouteList .campus-route').first().waitFor({timeout:20000});
await page.waitForFunction(()=>Number(getComputedStyle(document.querySelector('.campus-interactive-map')).opacity)>=.9,{timeout:4000});

const initial=await page.evaluate(()=>({
  path:location.pathname,
  sdk:Boolean(window.kakao?.maps?.Map),
  interactive:document.querySelector('#campusMapWrap')?.dataset.interactiveMap||'',
  markerCount:document.querySelectorAll('.flow-campus-marker').length,
  markerGroups:[...document.querySelectorAll('.flow-campus-class-pin')].map(x=>({number:x.querySelector('.flow-campus-marker')?.textContent?.trim()||'',course:x.querySelector('.flow-campus-course-label')?.textContent?.trim()||'',display:getComputedStyle(x).display,background:getComputedStyle(x).backgroundColor})),
  courseLabels:[...document.querySelectorAll('.flow-campus-course-label')].map(x=>x.textContent.trim()),
  routeTimeLabels:[...document.querySelectorAll('.flow-campus-route-time')].map(x=>x.textContent.trim()),
  routeCount:document.querySelectorAll('#campusRouteList .campus-route').length,
  routeTexts:[...document.querySelectorAll('#campusRouteList .campus-route')].map(x=>x.textContent.replace(/\s+/g,' ').trim()),
  mapOpacity:getComputedStyle(document.querySelector('.campus-interactive-map')).opacity,
  fallbackOpacity:document.querySelector('#campusMapWrap>img')?getComputedStyle(document.querySelector('#campusMapWrap>img')).opacity:null,
  badge:document.querySelector('.campus-map-badge')?.textContent?.trim()||'',
  bodyBackground:getComputedStyle(document.body).backgroundColor
}));

const routeRequestsBeforeCurrent=routeRequests.length;
await page.locator('#currentRouteBtn').click();
await page.locator('#campusCurrentResult:not(.hidden)').filter({hasText:'현재 위치'}).waitFor({timeout:20000});
await page.locator('.flow-campus-current-location').waitFor({timeout:15000});
await page.locator('.flow-campus-route-time.is-current').waitFor({timeout:15000});
await page.waitForTimeout(250);
const currentRoute=await page.evaluate(()=>({
  locationCount:document.querySelectorAll('.flow-campus-current-location').length,
  locationLabel:document.querySelector('.flow-campus-current-location')?.textContent?.replace(/\s+/g,' ').trim()||'',
  routeLabel:document.querySelector('.flow-campus-route-time.is-current')?.textContent?.replace(/\s+/g,' ').trim()||'',
  result:document.querySelector('#campusCurrentResult')?.textContent?.replace(/\s+/g,' ').trim()||''
}));
const routeRequestsAfterCurrent=routeRequests.length;

await page.locator('#campusFilter [data-nearby="stores"]').click();
await page.waitForFunction(()=>document.querySelectorAll('.flow-campus-poi').length>=1,{timeout:15000});
await page.waitForFunction(()=>document.querySelectorAll('#campusNearbyList .campus-poi-badge').length>=1,{timeout:15000});
const poiUi=await page.evaluate(()=>({
  map:[...document.querySelectorAll('.flow-campus-poi')].map(x=>({brand:x.dataset.poiBrand||'',kind:x.dataset.poiKind||'',hasSvg:Boolean(x.querySelector('svg')),text:x.textContent.trim(),label:x.getAttribute('aria-label')||''})),
  list:[...document.querySelectorAll('#campusNearbyList .campus-poi-badge')].map(x=>({brand:x.dataset.poiBrand||'',kind:x.dataset.poiKind||'',hasSvg:Boolean(x.querySelector('svg')),text:x.textContent.trim()})),
  storeNames:[...document.querySelectorAll('#campusNearbyList .campus-nearby strong')].map(x=>x.textContent.trim())
}));
const poiCount=poiUi.map.length;
await page.screenshot({path:`${out}/mobile-interactive-campus.png`,fullPage:true});
await page.setViewportSize({width:1440,height:900});
await page.waitForTimeout(500);
await page.screenshot({path:`${out}/desktop-interactive-campus.png`,fullPage:true});

const firstPartyHttpErrors=httpErrors.filter(x=>x.url.startsWith(base)||x.url.includes('.supabase.co/functions/v1/'));
const report={fixtureProfile:{id:profile.id,name:profile.name,surveyYear:profile.surveyYear,source:'deterministic-production-profile'},...initial,currentRoute,routeRequestsBeforeCurrent,routeRequestsAfterCurrent,currentRouteRequestDelta:routeRequestsAfterCurrent-routeRequestsBeforeCurrent,poiCount,poiUi,httpErrors,firstPartyHttpErrors,consoleErrors,pageErrors,failed:failed.filter(x=>!x.url.includes('dge.hs.kr'))};
await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));

if(initial.path!=='/university/campus')throw new Error(`Unexpected path: ${initial.path}`);
if(!initial.sdk)throw new Error('Kakao Web Map SDK did not initialize on production domain.');
if(initial.interactive!=='ready')throw new Error(`Interactive map not ready: ${initial.interactive}`);
if(initial.markerCount<2)throw new Error(`Too few class markers: ${initial.markerCount}`);
if(initial.markerGroups.length<2||initial.markerGroups.some(x=>!x.number||!x.course||!['inline-flex','flex'].includes(x.display)))throw new Error(`Class number/course grouping regressed: ${JSON.stringify(initial.markerGroups)}`);
if(initial.courseLabels.length<2||!initial.courseLabels.some(x=>x.includes('자료구조')))throw new Error(`Course labels are missing: ${JSON.stringify(initial.courseLabels)}`);
if(initial.routeTimeLabels.length<1||!initial.routeTimeLabels.some(x=>x.includes('분')&&x.includes('·')))throw new Error(`Centered route badges with time + distance are missing: ${JSON.stringify(initial.routeTimeLabels)}`);
if(initial.routeCount<1)throw new Error('No Kakao walking route was rendered for consecutive class buildings.');
if(Number(initial.mapOpacity)<0.9)throw new Error(`Interactive map is not visible: opacity ${initial.mapOpacity}`);
if(initial.fallbackOpacity!==null&&Number(initial.fallbackOpacity)>0.1)throw new Error(`Static fallback remained visible: opacity ${initial.fallbackOpacity}`);
if(currentRoute.locationCount!==1||!currentRoute.locationLabel.includes('현재 위치'))throw new Error(`Current location marker missing: ${JSON.stringify(currentRoute)}`);
if(!currentRoute.routeLabel.includes('현재')||!currentRoute.routeLabel.includes('분'))throw new Error(`Current walking route badge missing: ${JSON.stringify(currentRoute)}`);
if(!currentRoute.result.includes('현재 위치')||!currentRoute.result.includes('출발 권장'))throw new Error(`Current route result missing: ${JSON.stringify(currentRoute)}`);
if(routeRequestsAfterCurrent-routeRequestsBeforeCurrent!==1)throw new Error(`Current route should reuse one route response on the map, request delta=${routeRequestsAfterCurrent-routeRequestsBeforeCurrent}`);
if(poiCount<1)throw new Error('Nearby store markers were not rendered on the interactive map.');
if(poiUi.map.some(x=>!x.brand&&!x.kind&&!x.hasSvg))throw new Error(`Map POI lost brand/category identity: ${JSON.stringify(poiUi.map)}`);
if(!poiUi.list.length||poiUi.list.some(x=>!x.brand&&!x.kind&&!x.hasSvg))throw new Error(`Nearby list POI lost brand/category identity: ${JSON.stringify(poiUi.list)}`);
if(firstPartyHttpErrors.length||pageErrors.length)throw new Error(`Production app HTTP/page errors: ${JSON.stringify({firstPartyHttpErrors,pageErrors,consoleErrors})}`);
if(consoleErrors.length)throw new Error(`Production browser console errors: ${JSON.stringify(consoleErrors)}`);

await browser.close();
