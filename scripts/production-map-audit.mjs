import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.FLOW_PRODUCTION_URL||'https://flow-student-blush.vercel.app';
const out='production-map-audit';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'ko-KR',isMobile:true,hasTouch:true,colorScheme:'light'});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[],failed=[];
page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
page.on('pageerror',err=>pageErrors.push(String(err)));
page.on('requestfailed',req=>failed.push({url:req.url(),error:req.failure()?.errorText||''}));

await page.addInitScript(()=>{
  const day=(new Date().getDay()+6)%7;
  const profile={name:'경북대학교',address:'대구광역시 북구 대학로 80',foundation:'국립',kind:'대학교',campus:'본교',region:'대구'};
  const timetable={source:'production-map-audit',year:2026,semester:'2학기',subjects:[
    {id:'a',name:'소프트웨어설계',professor:'테스트',credit:3,place:'IT대학 2호관',times:[{day,startMinutes:540,endMinutes:615,start:'09:00',end:'10:15',place:'IT대학 2호관'}]},
    {id:'b',name:'자료구조',professor:'테스트',credit:3,place:'공대9호관',times:[{day,startMinutes:630,endMinutes:705,start:'10:30',end:'11:45',place:'공대9호관'}]},
    {id:'c',name:'교양세미나',professor:'테스트',credit:2,place:'법과대학',times:[{day,startMinutes:780,endMinutes:855,start:'13:00',end:'14:15',place:'법과대학'}]}
  ]};
  localStorage.setItem('flow-university-profile-v1',JSON.stringify(profile));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify(timetable));
  localStorage.setItem('flow-university-theme-v1','light');
});

await page.goto(`${base}/university/campus`,{waitUntil:'domcontentloaded',timeout:30000});
await page.locator('#campusView:not(.hidden)').waitFor({timeout:15000});
await page.waitForFunction(()=>document.querySelector('#campusMapWrap')?.dataset.interactiveMap==='ready',{timeout:30000});
await page.waitForFunction(()=>document.querySelectorAll('.flow-campus-class-pin').length>=2,{timeout:20000});
await page.waitForFunction(()=>document.querySelectorAll('.flow-campus-route-time').length>=1,{timeout:25000});
await page.locator('#campusRouteList .campus-route').first().waitFor({timeout:20000});

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

await page.locator('#campusFilter [data-nearby="stores"]').click();
await page.waitForFunction(()=>document.querySelectorAll('.flow-campus-poi').length>=1,{timeout:15000});
const poiCount=await page.locator('.flow-campus-poi').count();
await page.screenshot({path:`${out}/mobile-interactive-campus.png`,fullPage:true});

await page.setViewportSize({width:1440,height:900});
await page.waitForTimeout(500);
await page.screenshot({path:`${out}/desktop-interactive-campus.png`,fullPage:true});

const report={...initial,poiCount,consoleErrors,pageErrors,failed:failed.filter(x=>!x.url.includes('dge.hs.kr'))};
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
if(poiCount<1)throw new Error('Nearby store markers were not rendered on the interactive map.');
if(consoleErrors.length||pageErrors.length)throw new Error(`Production browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);

await browser.close();
