import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-home-cleanup-audit/wide-portrait-destinations';
await fs.mkdir(OUT,{recursive:true});

const pad=value=>String(value).padStart(2,'0');
const seoulYmd=(days=0)=>{const date=new Date(Date.now()+9*60*60*1000+days*24*60*60*1000);return`${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}`};
const today=seoulYmd(0),tomorrow=seoulYmd(1);
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const dashboard={
  school:{...profile.school,homepage:'https://example.com',phone:'053-000-0000'},selected:today,from:today,to:tomorrow,
  timetable:Array.from({length:7},(_,i)=>({date:today,period:i+1,subject:['자율·자치활동','문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][i]})),
  meals:[{date:today,type:'중식',dishes:['현미밥','된장국','제육볶음'],calories:'812.4 Kcal',nutrition:'단백질 32g',origin:'쌀 국내산'}],
  events:[{date:tomorrow,name:'다가오는 행사',content:'앞으로 확인할 일정'}],scheduleMeta:{mode:'month',count:1},
};

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixture(page){
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  await page.addInitScript(({profile})=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');localStorage.setItem('flow-school-transit-lab-v1','off')},{profile});
}

const shown=node=>Boolean(node&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden'&&node.getBoundingClientRect().width>0&&node.getBoundingClientRect().height>0);
async function shellState(page){return page.evaluate(()=>({
  desktop:shown(document.querySelector('.desktop-sidebar')),
  topbar:shown(document.querySelector('.mobile-topbar')),
  bottom:shown(document.querySelector('#bottomNav')),
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
}))}
async function scheduleState(page){return page.evaluate(()=>{
  const box=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
  const header=document.querySelector('#scheduleView .view-header');
  const layout=document.querySelector('#scheduleView .schedule-layout');
  const cards=[...document.querySelectorAll('#scheduleView .schedule-layout>.content-card')];
  const day=document.querySelector('#scheduleView .calendar-day');
  const hs=header?getComputedStyle(header):null,ls=layout?getComputedStyle(layout):null,ds=day?getComputedStyle(day):null;
  return{headerFlex:hs?.flexDirection||'',header:box(header),layoutDisplay:ls?.display||'',layoutColumns:ls?.gridTemplateColumns||'',cards:cards.map(box),dayHeight:parseFloat(ds?.minHeight||'0')||0,eventLabelVisible:shown(document.querySelector('#scheduleView .calendar-event-label')),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
})}
async function schoolState(page){return page.evaluate(()=>{
  const box=node=>{const r=node?.getBoundingClientRect();return r?{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}:null};
  const header=document.querySelector('#schoolView .view-header');
  const grid=document.querySelector('#schoolView .school-info-grid');
  const actions=document.querySelector('#schoolView .school-actions');
  const profile=document.querySelector('#schoolView .profile-hero');
  const hs=header?getComputedStyle(header):null,gs=grid?getComputedStyle(grid):null,as=actions?getComputedStyle(actions):null;
  return{headerFlex:hs?.flexDirection||'',header:box(header),gridColumns:gs?.gridTemplateColumns||'',actionsDisplay:as?.display||'',actionsColumns:as?.gridTemplateColumns||'',profile:box(profile),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
})}
async function settingsState(page){return page.evaluate(()=>{
  const fields=[...document.querySelectorAll('#flowSchoolSettingsView .setting-fields')].filter(node=>shown(node));
  return{columns:fields.map(node=>getComputedStyle(node).gridTemplateColumns),overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
})}

const browser=await chromium.launch({headless:true});
const report={};
for(const testCase of [
  {name:'wide-tablet-portrait',width:960,height:1536,touch:true,portrait:true},
  {name:'tablet-landscape',width:1024,height:768,touch:true,portrait:false},
]){
  const {name,width,height,touch,portrait}=testCase;
  const context=await browser.newContext({viewport:{width,height},isMobile:touch,hasTouch:touch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage(),pageErrors=[],consoleErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text())});
  await fixture(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurfaceCleanup==='ready');

  const shell=await shellState(page);
  if(portrait){
    if(shell.desktop||!shell.topbar||!shell.bottom)throw new Error(`${name}: touch shell did not engage ${JSON.stringify(shell)}`);
  }else if(!shell.desktop||shell.bottom){
    throw new Error(`${name}: landscape desktop shell regressed ${JSON.stringify(shell)}`);
  }

  await page.locator('[data-view="schedule"]:visible').first().click();
  await page.waitForSelector('#scheduleView:not(.hidden)');
  await page.waitForTimeout(60);
  const schedule=await scheduleState(page);
  if(portrait){
    const stacked=schedule.cards.length>=2&&schedule.cards[1].top>=schedule.cards[0].bottom-1;
    if(schedule.headerFlex!=='column'||schedule.layoutDisplay!=='block'||!stacked||schedule.dayHeight>70||schedule.eventLabelVisible||schedule.overflow>1){
      throw new Error(`${name}: Schedule is not touch-first ${JSON.stringify(schedule)}`);
    }
  }else if(schedule.headerFlex==='column'||schedule.layoutDisplay==='block'||schedule.overflow>1){
    throw new Error(`${name}: Schedule landscape composition regressed ${JSON.stringify(schedule)}`);
  }
  await page.screenshot({path:`${OUT}/schedule-${name}.png`,fullPage:true});

  await page.locator('[data-view="school"]:visible').first().click();
  await page.waitForSelector('#schoolView:not(.hidden)');
  await page.waitForTimeout(60);
  const school=await schoolState(page);
  if(portrait){
    const twoColumns=school.gridColumns.trim().split(/\s+/).filter(Boolean).length===2;
    const twoActions=school.actionsColumns.trim().split(/\s+/).filter(Boolean).length===2;
    if(school.headerFlex!=='column'||!twoColumns||school.actionsDisplay!=='grid'||!twoActions||!school.profile||school.profile.height>215||school.overflow>1){
      throw new Error(`${name}: School profile is not touch-first ${JSON.stringify(school)}`);
    }
  }else if(school.headerFlex==='column'||school.actionsDisplay==='grid'||school.overflow>1){
    throw new Error(`${name}: School landscape composition regressed ${JSON.stringify(school)}`);
  }
  await page.screenshot({path:`${OUT}/school-${name}.png`,fullPage:true});

  await page.locator('#mobileSettingsBtn:visible,#settingsBtn:visible').first().click();
  await page.waitForSelector('#flowSchoolSettingsView:not(.hidden)');
  await page.waitForFunction(()=>document.querySelector('#flowSchoolSettingsView .setting-fields'));
  await page.waitForTimeout(40);
  const settings=await settingsState(page);
  if(portrait){
    const single=settings.columns.length>0&&settings.columns.every(value=>value.trim().split(/\s+/).filter(Boolean).length===1);
    if(!single||settings.overflow>1)throw new Error(`${name}: Settings fields are not touch-first ${JSON.stringify(settings)}`);
  }else if(settings.overflow>1){
    throw new Error(`${name}: Settings landscape overflow ${JSON.stringify(settings)}`);
  }
  await page.screenshot({path:`${OUT}/settings-${name}.png`,fullPage:true});

  if(pageErrors.length||consoleErrors.length)throw new Error(`${name}: browser errors ${JSON.stringify({pageErrors,consoleErrors})}`);
  report[name]={shell,schedule,school,settings,pageErrors,consoleErrors};
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({ok:true,widePortrait:'all-school-destinations-touch-first',landscape:'desktop-preserved'},null,2));
