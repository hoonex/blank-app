import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-home-cleanup-audit';
await fs.mkdir(OUT,{recursive:true});

const pad=value=>String(value).padStart(2,'0');
const ymd=date=>`${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}`;
const offsetDate=days=>{const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()+days);return date};
const today=ymd(offsetDate(0)),yesterday=ymd(offsetDate(-1)),tomorrow=ymd(offsetDate(1));
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const timetable=Array.from({length:7},(_,index)=>({date:today,period:index+1,subject:['자율·자치활동','문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][index]}));
const meals=[{date:today,type:'중식',dishes:['현미밥','된장국','제육볶음'],calories:'812.4 Kcal',nutrition:'단백질 32g',origin:'쌀 국내산'}];
const events=[{date:yesterday,name:'지난 행사',content:'이미 끝난 일정'},{date:tomorrow,name:'다가오는 행사',content:'앞으로 확인할 일정'}];
const dashboard={school:profile.school,selected:today,from:yesterday,to:tomorrow,timetable,meals,events,scheduleMeta:{mode:'month',count:events.length}};
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page){
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  await page.addInitScript(({profile})=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },{profile});
}
async function inspectHome(page){return page.evaluate(()=>{
  const visible=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
  const statusCards=[...document.querySelectorAll('#todayView .status-card')];
  const bottom=[...document.querySelectorAll('#bottomNav>*')].filter(visible).map(node=>node.textContent.trim());
  return{
    cleanupReady:document.documentElement.dataset.flowSchoolSurfaceCleanup||'',
    transitSurface:document.documentElement.dataset.flowTransitSurface||'',
    visibleStatus:statusCards.filter(visible).map(card=>card.querySelector('.status-label')?.textContent?.trim()||''),
    lessonsVisible:visible(document.querySelector('#quickLessons')?.closest('.status-card')),
    mealQuickVisible:visible(document.querySelector('#quickMeal')?.closest('.status-card')),
    transitNavVisible:[...document.querySelectorAll('[data-flow-transit-nav]')].some(visible),
    transitViewExists:Boolean(document.querySelector('#transitView')),
    bottom,
    mealFooter:document.querySelector('#mealCal')?.textContent?.trim()||'',
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  };
})}
async function inspectSchedule(page){return page.evaluate(()=>{
  const rows=[...document.querySelectorAll('#scheduleGrid .schedule-row')];
  const visible=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&!node.hidden);
  const pastDay=document.querySelector('.calendar-day.flow-past-day');
  return{
    heading:document.querySelector('#scheduleGrid')?.closest('.content-card')?.querySelector('.card-heading h2')?.textContent?.trim()||'',
    rows:rows.map(row=>({text:row.textContent.trim(),visible:visible(row)})),
    pastCalendarMarked:Boolean(pastDay),
    pastCalendarDotVisible:Boolean(pastDay?.querySelector('.calendar-dot')&&getComputedStyle(pastDay.querySelector('.calendar-dot')).display!=='none'),
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  };
})}
async function inspectSettings(page){return page.evaluate(()=>{
  const panel=document.querySelector('#flowSchoolSettingsView');
  const summary=panel?.querySelector('.flow-bell-summary strong')?.textContent?.trim()||'';
  return{
    visible:Boolean(panel&&!panel.classList.contains('hidden')),
    mealStart:panel?.querySelector('[data-flow-bell="meal"]')?.value||'',
    mealEnd:panel?.querySelector('[data-flow-bell="mealEnd"]')?.value||'',
    bellStart:panel?.querySelector('[data-flow-bell="start"]')?.value||'',
    lesson:panel?.querySelector('[data-flow-bell="lesson"]')?.value||'',
    breakMinutes:panel?.querySelector('[data-flow-bell="break"]')?.value||'',
    summary,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  };
})}

const browser=await chromium.launch({headless:true});
const report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage(),pageErrors=[],consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  await fixture(page);
  await page.goto(`${BASE}/home`,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurfaceCleanup==='ready');
  await page.waitForFunction(()=>document.querySelectorAll('#timetable [data-period]').length===7);
  await page.waitForTimeout(80);

  const home=await inspectHome(page);
  if(home.cleanupReady!=='ready'||home.lessonsVisible||home.mealQuickVisible)throw new Error(`${testCase.name}: redundant Today quick cards remain ${JSON.stringify(home)}`);
  if(home.visibleStatus.join('|')!=='지금|다음 일정')throw new Error(`${testCase.name}: Today should expose only now + next event ${JSON.stringify(home.visibleStatus)}`);
  if(home.transitSurface!=='dormant'||home.transitNavVisible||home.transitViewExists)throw new Error(`${testCase.name}: Transit is still exposed in the School production surface ${JSON.stringify(home)}`);
  if(testCase.viewport.width<=900&&home.bottom.join('|')!=='오늘|일정|학교|설정')throw new Error(`${testCase.name}: mobile nav should have four user destinations ${JSON.stringify(home.bottom)}`);
  if(!home.mealFooter.includes('12:20–13:10'))throw new Error(`${testCase.name}: meal window is not visible on the meal card ${JSON.stringify(home.mealFooter)}`);
  if(home.overflow>1)throw new Error(`${testCase.name}: Today horizontal overflow ${home.overflow}`);
  await page.screenshot({path:`${OUT}/home-${testCase.name}.png`,fullPage:false});
  await page.screenshot({path:`${OUT}/home-${testCase.name}-full.png`,fullPage:true});

  await page.locator('[data-view="schedule"]:visible').first().click();
  await page.waitForSelector('#scheduleView:not(.hidden)');
  await page.waitForTimeout(40);
  const schedule=await inspectSchedule(page);
  const past=schedule.rows.find(row=>row.text.includes('지난 행사')),future=schedule.rows.find(row=>row.text.includes('다가오는 행사'));
  if(schedule.heading!=='남은 일정'||!past||past.visible||!future||!future.visible)throw new Error(`${testCase.name}: past Schedule filtering failed ${JSON.stringify(schedule)}`);
  if(!schedule.pastCalendarMarked||schedule.pastCalendarDotVisible)throw new Error(`${testCase.name}: past calendar event markers remain ${JSON.stringify(schedule)}`);
  if(schedule.overflow>1)throw new Error(`${testCase.name}: Schedule horizontal overflow ${schedule.overflow}`);

  await page.locator('#mobileSettingsBtn:visible,#settingsBtn:visible').first().click();
  await page.waitForSelector('#flowSchoolSettingsView:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#flowSchoolSettingsView [data-flow-bell="mealEnd"]'));
  await page.waitForTimeout(30);
  let settings=await inspectSettings(page);
  if(!settings.visible||settings.mealStart!=='12:20'||settings.mealEnd!=='13:10'||!settings.summary.includes('1교시 08:30')||!settings.summary.includes('급식 12:20–13:10'))throw new Error(`${testCase.name}: settings preview/defaults are incomplete ${JSON.stringify(settings)}`);
  await page.locator('#flowSchoolSettingsView [data-flow-bell="meal"]').fill('12:15');
  await page.locator('#flowSchoolSettingsView [data-flow-bell="mealEnd"]').fill('13:05');
  await page.waitForFunction(()=>document.querySelector('#flowSchoolSettingsView .flow-bell-summary strong')?.textContent?.includes('급식 12:15–13:05'));
  settings=await inspectSettings(page);
  if(!settings.summary.includes('수업 50분')||!settings.summary.includes('쉬는 시간 10분')||!settings.summary.includes('급식 12:15–13:05'))throw new Error(`${testCase.name}: live settings summary failed ${JSON.stringify(settings)}`);
  await page.locator('#flowSchoolSettingsView [data-flow-save-school]').click();
  await page.waitForFunction(()=>{try{const value=JSON.parse(localStorage.getItem('flow-school-bell-v1')||'{}');return value.meal==='12:15'&&value.mealEnd==='13:05'}catch{return false}});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-school-bell-v1')||'{}'));
  if(saved.meal!=='12:15'||saved.mealEnd!=='13:05'||saved.start!=='08:30'||saved.lesson!==50||saved.break!==10)throw new Error(`${testCase.name}: settings persistence failed ${JSON.stringify(saved)}`);
  if(settings.overflow>1)throw new Error(`${testCase.name}: Settings horizontal overflow ${settings.overflow}`);
  await page.screenshot({path:`${OUT}/settings-${testCase.name}.png`,fullPage:false});
  await page.screenshot({path:`${OUT}/settings-${testCase.name}-full.png`,fullPage:true});

  await page.locator('#bottomNav [data-view="today"]:visible,.side-nav [data-view="today"]:visible').first().click();
  await page.waitForSelector('#todayView:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#mealCal')?.textContent?.includes('12:15–13:05'));
  const afterSave=await inspectHome(page);
  if(!afterSave.mealFooter.includes('12:15–13:05'))throw new Error(`${testCase.name}: saved meal window did not update Today ${JSON.stringify(afterSave)}`);
  if(pageErrors.length||consoleErrors.length)throw new Error(`${testCase.name}: browser errors ${JSON.stringify({pageErrors,consoleErrors})}`);
  report[testCase.name]={home,schedule,settings,saved,afterSave,pageErrors,consoleErrors};
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({ok:true,viewports:Object.keys(report),todayCards:['지금','다음 일정'],transit:'dormant',mealWindow:true},null,2));
