import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-home-cleanup-audit';
await fs.mkdir(OUT,{recursive:true});

const pad=value=>String(value).padStart(2,'0');
const seoulYmd=(days=0)=>{const date=new Date(Date.now()+9*60*60*1000+days*24*60*60*1000);return`${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}`};
const today=seoulYmd(0),yesterday=seoulYmd(-1),tomorrow=seoulYmd(1);
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const dashboard={
  school:profile.school,selected:today,from:yesterday,to:tomorrow,
  timetable:Array.from({length:7},(_,i)=>({date:today,period:i+1,subject:['자율·자치활동','문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][i]})),
  meals:[{date:today,type:'중식',dishes:['현미밥','된장국','제육볶음'],calories:'812.4 Kcal',nutrition:'단백질 32g',origin:'쌀 국내산'}],
  events:[{date:yesterday,name:'지난 행사',content:'이미 끝난 일정'},{date:tomorrow,name:'다가오는 행사',content:'앞으로 확인할 일정'}],
  scheduleMeta:{mode:'month',count:2},
};
const cases=[
  ['mobile-portrait',390,844,true],['mobile-landscape',844,390,true],['tablet-portrait',768,1024,true],
  ['tablet-landscape',1024,768,true],['desktop-1366',1366,768,false],['desktop-1920',1920,1080,false],
];
const transitAsset=/\/school-transit(?:-map|-focus|-today)?\.(?:js|css)(?:\?|$)/;
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page){
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  await page.addInitScript(({profile})=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');localStorage.setItem('flow-school-transit-lab-v1','off')},{profile});
}
async function homeState(page){return page.evaluate(()=>{
  const shown=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
  const visibleStatus=[...document.querySelectorAll('#todayView .status-card')].filter(shown);
  return{
    status:visibleStatus.map(node=>node.querySelector('.status-label')?.textContent?.trim()||''),
    statusRects:visibleStatus.map(node=>{const rect=node.getBoundingClientRect();return{label:node.querySelector('.status-label')?.textContent?.trim()||'',left:rect.left,top:rect.top,width:rect.width,height:rect.height}}),
    lessons:shown(document.querySelector('#quickLessons')?.closest('.status-card')),meal:shown(document.querySelector('#quickMeal')?.closest('.status-card')),
    transitSurface:document.documentElement.dataset.flowTransitSurface||'',transitNav:[...document.querySelectorAll('[data-flow-transit-nav]')].some(shown),transitView:Boolean(document.querySelector('#transitView')),
    bottom:[...document.querySelectorAll('#bottomNav>*')].filter(shown).map(node=>node.textContent.trim()),
    mealFooter:document.querySelector('#mealCal')?.textContent?.trim()||'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  }
})}
async function scheduleState(page){return page.evaluate(()=>{
  const shown=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&!node.hidden);
  const rows=[...document.querySelectorAll('#scheduleGrid .schedule-row')];const pastDay=document.querySelector('.calendar-day.flow-past-day');
  return{heading:document.querySelector('#scheduleGrid')?.closest('.content-card')?.querySelector('.card-heading h2')?.textContent?.trim()||'',rows:rows.map(node=>({text:node.textContent.trim(),visible:shown(node)})),pastMarked:Boolean(pastDay),pastDot:Boolean(pastDay?.querySelector('.calendar-dot')&&getComputedStyle(pastDay.querySelector('.calendar-dot')).display!=='none'),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}
})}
async function settingsState(page){return page.evaluate(()=>{const panel=document.querySelector('#flowSchoolSettingsView');return{start:panel?.querySelector('[data-flow-bell="start"]')?.value||'',lesson:panel?.querySelector('[data-flow-bell="lesson"]')?.value||'',break:panel?.querySelector('[data-flow-bell="break"]')?.value||'',meal:panel?.querySelector('[data-flow-bell="meal"]')?.value||'',mealEnd:panel?.querySelector('[data-flow-bell="mealEnd"]')?.value||'',summary:panel?.querySelector('.flow-bell-summary strong')?.textContent?.trim()||'',overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}})}

const browser=await chromium.launch({headless:true});const report={};
for(const [name,width,height,isMobile] of cases){
  const context=await browser.newContext({viewport:{width,height},isMobile,hasTouch:isMobile,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});const page=await context.newPage(),pageErrors=[],consoleErrors=[],transitRequests=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});page.on('request',request=>{const url=request.url();if(transitAsset.test(url))transitRequests.push(url)});await fixture(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurfaceCleanup==='ready');await page.waitForFunction(()=>document.querySelector('#mealCal')?.textContent?.includes('12:20–13:10'),null,{timeout:5000});
  const home=await homeState(page);
  if(home.status.join('|')!=='지금|다음 일정'||home.lessons||home.meal)throw new Error(`${name}: redundant Today cards remain ${JSON.stringify(home)}`);
  if(width<=900){
    const [nowCard,nextCard]=home.statusRects;
    const sameRow=nowCard&&nextCard&&Math.abs(nowCard.top-nextCard.top)<=2&&nowCard.left<nextCard.left;
    const balanced=nowCard&&nextCard&&Math.abs(nowCard.width-nextCard.width)<=4;
    const compact=nowCard&&nextCard&&Math.max(nowCard.height,nextCard.height)<=145;
    if(!sameRow||!balanced||!compact)throw new Error(`${name}: Today status cards are not a compact side-by-side pair ${JSON.stringify(home.statusRects)}`);
  }
  if(home.transitSurface!=='dormant'||home.transitNav||home.transitView)throw new Error(`${name}: production Transit surface remains ${JSON.stringify(home)}`);
  if(transitRequests.length)throw new Error(`${name}: dormant production Transit assets were requested ${JSON.stringify(transitRequests)}`);
  if(width<=900&&home.bottom.join('|')!=='오늘|일정|학교|설정')throw new Error(`${name}: mobile nav is not four destinations ${JSON.stringify(home.bottom)}`);
  if(!home.mealFooter.includes('12:20–13:10')||home.overflow>1)throw new Error(`${name}: Today meal window/overflow failed ${JSON.stringify(home)}`);
  await page.screenshot({path:`${OUT}/home-${name}.png`,fullPage:false});await page.screenshot({path:`${OUT}/home-${name}-full.png`,fullPage:true});

  await page.locator('[data-view="schedule"]:visible').first().click();await page.waitForSelector('#scheduleView:not(.hidden)');await page.waitForTimeout(60);const schedule=await scheduleState(page);
  const past=schedule.rows.find(row=>row.text.includes('지난 행사')),future=schedule.rows.find(row=>row.text.includes('다가오는 행사'));
  if(schedule.heading!=='남은 일정'||!past||past.visible||!future||!future.visible||!schedule.pastMarked||schedule.pastDot||schedule.overflow>1)throw new Error(`${name}: Schedule cleanup failed ${JSON.stringify(schedule)}`);

  await page.locator('#mobileSettingsBtn:visible,#settingsBtn:visible').first().click();await page.waitForSelector('#flowSchoolSettingsView:not(.hidden)');await page.waitForFunction(()=>document.querySelector('#flowSchoolSettingsView [data-flow-bell="mealEnd"]'));await page.waitForTimeout(30);let settings=await settingsState(page);
  if(settings.start!=='08:30'||settings.lesson!=='50'||settings.break!=='10'||settings.meal!=='12:20'||settings.mealEnd!=='13:10'||!settings.summary.includes('급식 12:20–13:10'))throw new Error(`${name}: settings defaults/preview failed ${JSON.stringify(settings)}`);
  await page.locator('#flowSchoolSettingsView [data-flow-bell="meal"]').fill('12:15');await page.locator('#flowSchoolSettingsView [data-flow-bell="mealEnd"]').fill('13:05');await page.waitForFunction(()=>document.querySelector('#flowSchoolSettingsView .flow-bell-summary strong')?.textContent?.includes('급식 12:15–13:05'));settings=await settingsState(page);
  if(!settings.summary.includes('1교시 08:30')||!settings.summary.includes('수업 50분')||!settings.summary.includes('쉬는 시간 10분')||settings.overflow>1)throw new Error(`${name}: settings live summary failed ${JSON.stringify(settings)}`);
  await page.locator('#flowSchoolSettingsView [data-flow-save-school]').click();await page.waitForFunction(()=>{try{const cfg=JSON.parse(localStorage.getItem('flow-school-bell-v1')||'{}');return cfg.meal==='12:15'&&cfg.mealEnd==='13:05'}catch{return false}});const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-school-bell-v1')||'{}'));
  if(saved.start!=='08:30'||saved.lesson!==50||saved.break!==10||saved.meal!=='12:15'||saved.mealEnd!=='13:05')throw new Error(`${name}: settings persistence failed ${JSON.stringify(saved)}`);
  await page.screenshot({path:`${OUT}/settings-${name}.png`,fullPage:false});await page.screenshot({path:`${OUT}/settings-${name}-full.png`,fullPage:true});

  await page.locator('#bottomNav [data-view="today"]:visible,.side-nav [data-view="today"]:visible').first().click();await page.waitForSelector('#todayView:not(.hidden)');await page.waitForFunction(()=>document.querySelector('#mealCal')?.textContent?.includes('12:15–13:05'));const after=await homeState(page);
  if(transitRequests.length)throw new Error(`${name}: dormant Transit assets loaded after navigation ${JSON.stringify(transitRequests)}`);
  if(pageErrors.length||consoleErrors.length)throw new Error(`${name}: browser errors ${JSON.stringify({pageErrors,consoleErrors})}`);
  report[name]={home,schedule,settings,saved,after,transitRequests,pageErrors,consoleErrors};await context.close();
}
await browser.close();await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,viewports:Object.keys(report),todayCards:['지금','다음 일정'],todayStatusLayout:'compact-side-by-side',transit:'dormant',transitRequests:0,mealWindow:true},null,2));
