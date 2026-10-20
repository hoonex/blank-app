import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

// The real School app and API fixtures are mandatory: a forced-visible empty
// dashboard could pass an overflow check without testing actual composition.
const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'/tmp/flow-school-ratio-workspace';
await mkdir(OUT,{recursive:true});

const school={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',
  name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',
  location:'대구광역시',jurisdiction:'대구광역시교육청',type:'공립',coed:'남녀공학',
  highSchoolType:'일반고',dayNight:'주간',address:'대구광역시 동구 테스트로 1',
  phone:'053-000-0000',fax:'053-000-0001',founded:'19860301',anniversary:'19860301',addressDetail:'테스트로 1',highSchoolTrack:'일반계',
  homepage:'https://example.com'};
const selected=(()=>{const d=new Date();return ''+d.getFullYear()+
  String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')})();
const dashboard={school,selected,from:selected,to:selected,
  timetable:['수학Ⅱ','영어Ⅱ','문학','물리학','체육','한국사','정보']
    .map((subject,i)=>({date:selected,period:i+1,subject,grade:'2',className:'6'})),
  meals:[{date:selected,type:'중식',dishes:['현미밥','육개장','고등어구이','배추김치','사과'],
    calories:'787 Kcal'}],
  events:[{date:selected,name:'중간고사'},{date:selected,name:'학급 활동'}],
  scheduleMeta:{mode:'fixture',count:2}};
const cases=[
  {name:'phone-portrait',w:390,h:844,touch:true},
  {name:'phone-landscape',w:844,h:390,touch:true},
  {name:'portrait-wide',w:768,h:1024,touch:true},
  {name:'landscape-wide',w:1024,h:768,touch:true},
  {name:'desktop',w:1366,h:768,touch:false},
  {name:'large-desktop',w:1920,h:1080,touch:false},
  {name:'landscape-wide-mouse',w:1024,h:768,touch:false},
];
const assert=(value,message)=>{if(!value)throw Error(message)};
const close=(x,y,tol=2)=>Math.abs(x-y)<=tol;

async function fixtures(page){
  await page.route('**/functions/v1/school-data**',route=>{
    const action=new URL(route.request().url()).searchParams.get('action');
    const body=action==='dashboard'?dashboard:action==='media'?{media:{}}:
      action==='classes'?{classes:['1','2','3','4','5','6']}:{schools:[school]};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}
async function go(page,name){
  const item=page.locator(`[data-view="${name}"]:visible`).first();
  await item.click();
  const section=page.locator(`#${name}View:not(.hidden)`);
  await section.waitFor();
  await section.evaluate(node=>Promise.all(node.getAnimations({subtree:false}).map(animation=>animation.finished.catch(()=>{}))));
}
async function measure(page){
  return page.evaluate(()=>{
    const q=s=>document.querySelector(s);
    const rect=s=>{const n=q(s);if(!n)return null;const r=n.getBoundingClientRect();
      return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const side=q('#desktopSidebar'),nav=q('#bottomNav');
    return {client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,
      ratio:document.documentElement.dataset.flowRatioWorkspace,
      sideVisible:getComputedStyle(side).display!=='none',
      navVisible:getComputedStyle(nav).display!=='none',
      grid:rect('#todayView .today-grid'),tt:rect('#todayView .timetable-card'),
      meal:rect('#todayView .meal-card'),exams:rect('#todayView .upcoming-card'),
      right:rect('#todayView .right-stack'),schedule:rect('#scheduleView .schedule-layout'),
      calendar:rect('#scheduleView .calendar-card'),events:rect('#scheduleView .schedule-layout > .content-card:not(.calendar-card)'),
      facts:rect('#schoolInfoGrid'),groups:[...document.querySelectorAll('#schoolInfoGrid > .info-group')]
        .map(n=>{const r=n.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width}}),
      fields:q('#schoolInfoGrid')?.querySelectorAll('.info-tile').length||0
    };
  });
}
const browser=await chromium.launch({headless:true});
const results={generatedAt:new Date().toISOString(),cases:[]};
for(const c of cases){
  const ctx=await browser.newContext({viewport:{width:c.w,height:c.h},isMobile:false,
    hasTouch:c.touch,locale:'ko-KR',timezoneId:'Asia/Seoul'});
  const page=await ctx.newPage();page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await fixtures(page);
  await page.addInitScript(school=>{
    localStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
  },school);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:25000});
  await page.locator('#dashboard:not(.hidden)').waitFor();
  await page.waitForFunction(()=>document.documentElement.dataset.flowRatioWorkspace==='ready');
  await page.locator('#timetable .period-button').first().waitFor();

  const expectSide=c.w>=1181&&c.h>=681&&c.w/c.h>=1.25;
  const today=await measure(page);
  assert(today.scroll<=today.client,`${c.name}: horizontal overflow ${today.scroll-today.client}px`);
  assert(today.ratio==='ready',`${c.name}: new composition missing`);
  assert(today.sideVisible===expectSide&&today.navVisible!==expectSide,`${c.name}: navigation is not aspect-based ${JSON.stringify(today)}`);
  assert(today.tt&&today.meal&&today.exams,`${c.name}: missing live dashboard cards`);
  if(c.w>=541){
    assert(today.right&&today.meal.width>=300&&today.exams.width>=300,
      `${c.name}: right-hand cards are too narrow`);
    if(c.w>c.h){
      assert(today.right.left>today.tt.right+8&&close(today.right.top,today.tt.top,3),
        `${c.name}: landscape dashboard does not use two readable rails`);
      assert(close(today.meal.width,today.exams.width,2),
        `${c.name}: meal/exam widths diverged`);
    }else{
      assert(close(today.tt.width,today.grid.width,2)&&today.right.top>=today.tt.bottom+8,
        `${c.name}: portrait timetable is not full-width`);
    }
  }
  await page.screenshot({path:`${OUT}/${c.name}-today.png`,fullPage:false,animations:'disabled'});
  await go(page,'schedule');
  const schedule=await measure(page);
  assert(schedule.scroll<=schedule.client,`${c.name}: Schedule overflow`);
  if(c.w>c.h&&c.w>=541){
    assert(schedule.events&&schedule.calendar&&
      close(schedule.calendar.top,schedule.events.top,4)&&schedule.events.left>=schedule.calendar.right+8,
      `${c.name}: landscape calendar/events must share a row`);
  }
  await page.screenshot({path:`${OUT}/${c.name}-schedule.png`,fullPage:false,animations:'disabled'});
  await go(page,'school');await page.locator('#schoolInfoGrid .info-tile').first().waitFor();
  const info=await measure(page);
  assert(info.scroll<=info.client,`${c.name}: School overflow`);
  assert(info.groups.length===2&&info.fields===13,`${c.name}: school fields were lost`);
  if(c.w>=541){
    const [a,b]=info.groups;
    if(info.facts.width>=740)assert(close(a.top,b.top,4)&&b.left>=a.right+8,
      `${c.name}: available fact columns were not used`);
    else assert(b.top>=a.bottom+8,`${c.name}: fact groups do not stack when cramped`);
  }
  await page.screenshot({path:`${OUT}/${c.name}-school.png`,fullPage:false,animations:'disabled'});
  if(c.name==='desktop'||c.name==='large-desktop'){
    await page.screenshot({path:`${OUT}/${c.name}-school-full.png`,fullPage:true,animations:'disabled'});
  }
  assert(errors.length===0,`${c.name}: runtime errors ${JSON.stringify(errors)}`);
  results.cases.push({name:c.name,viewport:`${c.w}x${c.h}`,today,schedule,info,errorCount:errors.length});
  await ctx.close();
}
await browser.close();
const touch=results.cases.find(r=>r.name==='landscape-wide');
const mouse=results.cases.find(r=>r.name==='landscape-wide-mouse');
assert(touch.today.sideVisible===mouse.today.sideVisible&&
  close(touch.today.tt.width,mouse.today.tt.width,1)&&
  close(touch.today.meal.width,mouse.today.meal.width,1),
  'Identical viewport produces a device-dependent layout');
await writeFile(`${OUT}/report.json`,JSON.stringify(results,null,2));
console.log('Flow ratio workspace PASS: 7 viewport/device combinations; zero horizontal overflow; real School data and view transitions');
