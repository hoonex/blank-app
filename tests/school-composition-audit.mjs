import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'browser-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구',phone:'053-000-0000'},grade:2,className:'6'};
const school={...profile.school,type:'공립',highSchoolType:'일반고',coed:'남녀공학',dayNight:'주간',founded:'19860301',anniversary:'0501',jurisdiction:'대구광역시교육청',location:'대구광역시',addressDetail:'테스트로 1',fax:'053-000-0001',highSchoolTrack:'일반계',homepage:'https://example.com'};
const nowDate=()=>{const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`};
const selected=nowDate();
const dashboard={
  school,selected,from:selected,to:selected,
  timetable:[{date:selected,period:1,subject:'수학Ⅱ'},{date:selected,period:2,subject:'영어Ⅱ'}],
  meals:[{date:selected,type:'중식',dishes:['밥','미역국'],calories:'700 Kcal',nutrition:'',origin:''}],
  events:[{date:selected,name:'학급 활동'}],scheduleMeta:{mode:'month',count:1},
};

const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:true,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:true,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];

function response(route,body){return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function installFixture(page){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action')||'';
    if(action==='dashboard')return response(route,dashboard);
    if(action==='media')return response(route,{media:{}});
    return response(route,{});
  });
  await page.addInitScript(({profile})=>{
    localStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
  },{profile});
}
async function openView(page,view){
  await page.locator(`[data-view="${view}"]:visible`).first().click();
  await page.waitForFunction(v=>{
    const panel=document.querySelector(`[data-view-panel="${v}"]`);
    return panel&&!panel.classList.contains('hidden');
  },view);
  await page.waitForTimeout(80);
}
async function inspectVisibleHierarchy(page){
  return page.evaluate(()=>{
    const active=[...document.querySelectorAll('.product-main .view')].filter(v=>!v.classList.contains('hidden')&&getComputedStyle(v).display!=='none');
    const visibleKickers=active.flatMap(view=>[...view.querySelectorAll('.section-kicker')]).filter(node=>{
      const r=node.getBoundingClientRect(),s=getComputedStyle(node);
      return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;
    }).map(node=>node.textContent.trim()).filter(Boolean);
    return{visibleKickers,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
  });
}
async function inspectSchedule(page){
  return page.evaluate(()=>{
    const rect=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const layout=document.querySelector('#scheduleView .schedule-layout');
    const calendar=layout?.querySelector('.calendar-card');
    const eventsCard=calendar?.nextElementSibling||null;
    const firstRow=document.querySelector('#scheduleGrid .schedule-row');
    const days=[...document.querySelectorAll('#scheduleView .calendar-day')];
    const dayHeights=days.map(node=>node.getBoundingClientRect().height);
    const headControls=[...document.querySelectorAll('#scheduleView .calendar-head button')];
    const controlHeights=headControls.map(node=>node.getBoundingClientRect().height);
    return{
      layout:rect(layout),calendar:rect(calendar),eventsCard:rect(eventsCard),firstRow:rect(firstRow),
      minDayHeight:dayHeights.length?Math.min(...dayHeights):0,
      maxDayHeight:dayHeights.length?Math.max(...dayHeights):0,
      minHeadControlHeight:controlHeights.length?Math.min(...controlHeights):0,
      viewportHeight:innerHeight,
    };
  });
}
async function inspectInfo(page){
  return page.evaluate(()=>{
    const grid=document.querySelector('#schoolInfoGrid'),tiles=[...grid.children],last=tiles.at(-1);
    const r=node=>{const x=node.getBoundingClientRect();return{left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height,cx:x.left+x.width/2}};
    return{grid:r(grid),last:r(last),count:tiles.length,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth};
  });
}

const browser=await chromium.launch({headless:true});
const report={};
for(const testCase of cases){
  const context=await browser.newContext({viewport:testCase.viewport,isMobile:testCase.isMobile,hasTouch:testCase.hasTouch,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(String(error)));
  await installFixture(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>[...document.styleSheets].some(sheet=>String(sheet.href||'').includes('school-polish.css')));
  await page.waitForTimeout(180);

  const views={};
  for(const view of ['today','schedule','school']){
    await openView(page,view);
    const hierarchy=await inspectVisibleHierarchy(page);
    if(hierarchy.visibleKickers.length)throw new Error(`${testCase.name}/${view}: redundant product kicker visible ${JSON.stringify(hierarchy.visibleKickers)}`);
    if(hierarchy.scrollWidth>hierarchy.clientWidth+1)throw new Error(`${testCase.name}/${view}: horizontal overflow ${JSON.stringify(hierarchy)}`);
    views[view]=hierarchy;
    if(view==='schedule'){
      const schedule=await inspectSchedule(page);
      views[view]={...hierarchy,schedule};
      if(testCase.name==='mobile-landscape'){
        if(!schedule.calendar||!schedule.eventsCard||schedule.eventsCard.left<schedule.calendar.right-2||Math.abs(schedule.eventsCard.top-schedule.calendar.top)>4){
          throw new Error(`${testCase.name}/schedule: calendar and event context should share the landscape row ${JSON.stringify(schedule)}`);
        }
        if(schedule.minDayHeight<43.4||schedule.maxDayHeight>44.6){
          throw new Error(`${testCase.name}/schedule: landscape day targets should remain 44px ${JSON.stringify(schedule)}`);
        }
        if(schedule.minHeadControlHeight<43.4){
          throw new Error(`${testCase.name}/schedule: month controls lost touch target size ${JSON.stringify(schedule)}`);
        }
        if(!schedule.firstRow||schedule.firstRow.top>schedule.viewportHeight-16){
          throw new Error(`${testCase.name}/schedule: event context is still pushed below the first fold ${JSON.stringify(schedule)}`);
        }
      }
      await page.screenshot({path:`${OUT}/school-composition-${testCase.name}-schedule.png`,fullPage:false});
    }
  }

  await page.waitForSelector('#rankCard:not([hidden])');
  const info=await inspectInfo(page);
  if(info.count!==13)throw new Error(`${testCase.name}/school: fixture should render 13 profile tiles ${JSON.stringify(info)}`);
  if(info.scrollWidth>info.clientWidth+1)throw new Error(`${testCase.name}/school: horizontal overflow ${JSON.stringify(info)}`);
  const centerDelta=Math.abs(info.last.cx-info.grid.cx);
  if(testCase.viewport.width<=520){
    if(info.last.width<info.grid.width*.94)throw new Error(`${testCase.name}/school: final tile should own the single-column row ${JSON.stringify(info)}`);
  }else if(centerDelta>4){
    throw new Error(`${testCase.name}/school: incomplete final row is visually stranded ${JSON.stringify({centerDelta,info})}`);
  }
  await page.screenshot({path:`${OUT}/school-composition-${testCase.name}-info.png`,fullPage:true});
  report[testCase.name]={views,info,pageErrors};
  if(pageErrors.length)throw new Error(`${testCase.name}: page errors ${JSON.stringify(pageErrors)}`);
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/school-composition-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
