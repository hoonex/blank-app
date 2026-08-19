import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
await mkdir('university-audit',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},locale:'ko-KR',timezoneId:'Asia/Seoul',isMobile:true,hasTouch:true,colorScheme:'light'});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[],requests=[];
page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});
page.on('pageerror',e=>pageErrors.push(String(e)));
await page.route('**/functions/v1/university-campus*',async route=>{
  const url=new URL(route.request().url()),action=url.searchParams.get('action');
  requests.push(action||'');
  if(action==='campus')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({center:{x:'128.6100',y:'35.8900'},places:[
    {raw:'IT대학1호관',resolved:true,confidence:90,place:{name:'경북대학교 IT대학1호관',x:'128.6090',y:'35.8890',url:'https://place.map.kakao.com/1'}},
    {raw:'공대9호관',resolved:true,confidence:90,place:{name:'경북대학교 공대9호관',x:'128.6150',y:'35.8920',url:'https://place.map.kakao.com/2'}}
  ],nearby:{dining:[],stores:[],cafes:[],food:[]}})});
  if(action==='route')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({route:{status:'OK',time:420,distance:520,landingUrl:'https://map.kakao.com/link/to/test'}})});
  return route.fulfill({status:404,contentType:'application/json',body:'{}'});
});
await page.addInitScript(()=>{
  const RealDate=Date,fixed=new RealDate('2026-08-20T07:15:00+09:00').valueOf();
  class FixedDate extends RealDate{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}}
  FixedDate.parse=RealDate.parse;FixedDate.UTC=RealDate.UTC;
  Object.defineProperty(window,'Date',{value:FixedDate,configurable:true});
  sessionStorage.setItem('flow-dashboard-campus-test','1');
  localStorage.setItem('flow-university-profile-v1',JSON.stringify({id:'knu',name:'경북대학교',address:'대구광역시 북구 대학로 80',region:'대구'}));
  localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[
    {name:'자료구조',times:[{day:3,start:'06:30',end:'07:05',startMinutes:390,endMinutes:425,place:'IT대학1호관'}]},
    {name:'운영체제',times:[{day:3,start:'08:00',end:'09:30',startMinutes:480,endMinutes:570,place:'공대9호관'}]}
  ]}));
  localStorage.removeItem('flow-university-dashboard-v1');
});
await page.goto(`${base}/university/`,{waitUntil:'domcontentloaded'});
await page.locator('#widgetDashboard').waitFor({timeout:10000});
await page.locator('[data-widget-id="campus"]').waitFor({state:'visible'});
await page.waitForFunction(()=>document.querySelector('[data-widget-id="campus"]')?.dataset.campusEta==='7',{timeout:10000});
const state=await page.evaluate(()=>{const widget=document.querySelector('[data-widget-id="campus"]');return{title:widget?.querySelector('#widgetCampusLiveTitle')?.textContent?.trim(),meta:widget?.querySelector('#widgetCampusLiveMeta')?.textContent?.trim(),button:widget?.querySelector('#widgetCampusBtn')?.textContent?.trim(),eta:widget?.dataset.campusEta,distance:widget?.dataset.campusDistance,leave:widget?.dataset.campusLeave,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}});
if(state.title!=='공대9호관')throw new Error(`Unexpected campus title: ${JSON.stringify(state)}`);
for(const expected of ['도보 7분','520m','07:50 출발 권장'])if(!state.meta?.includes(expected))throw new Error(`Campus ETA missing ${expected}: ${JSON.stringify(state)}`);
if(state.button!=='경로 자세히')throw new Error(`Campus CTA not upgraded: ${JSON.stringify(state)}`);
if(state.scrollWidth>state.clientWidth+3)throw new Error(`Campus widget caused horizontal overflow: ${JSON.stringify(state)}`);
if(requests.filter(x=>x==='campus').length!==1||requests.filter(x=>x==='route').length!==1)throw new Error(`Unexpected campus request count: ${JSON.stringify(requests)}`);
await page.screenshot({path:'university-audit/mobile-dashboard-campus.png',fullPage:true});
await page.waitForTimeout(1300);
const after=await page.evaluate(()=>({title:document.querySelector('#widgetCampusLiveTitle')?.textContent?.trim(),meta:document.querySelector('#widgetCampusLiveMeta')?.textContent?.trim()}));
if(after.title!==state.title||after.meta!==state.meta)throw new Error(`Campus widget changed while idle: ${JSON.stringify({state,after})}`);
const report={state,after,requests,consoleErrors,pageErrors};
await writeFile('university-audit/dashboard-campus-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||pageErrors.length)throw new Error(`Browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
await browser.close();
