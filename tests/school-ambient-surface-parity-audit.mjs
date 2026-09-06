import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-ambient-surface-parity-audit';
const CASES=[
  {name:'mobile-portrait',width:390,height:844,isMobile:true,hasTouch:true},
  {name:'mobile-landscape',width:844,height:390,isMobile:true,hasTouch:true},
  {name:'tablet-portrait',width:768,height:1024,isMobile:false,hasTouch:true},
  {name:'tablet-landscape',width:1024,height:768,isMobile:false,hasTouch:true},
  {name:'desktop',width:1366,height:768,isMobile:false,hasTouch:false},
  {name:'large-desktop',width:1920,height:1080,isMobile:false,hasTouch:false},
];
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남녀공학',dayNight:'주간'};

const pad=value=>String(value).padStart(2,'0');
const ymd=(date=new Date())=>`${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}`;
const addDays=(value,days)=>{const date=new Date(Number(value.slice(0,4)),Number(value.slice(4,6))-1,Number(value.slice(6,8)),12);date.setDate(date.getDate()+days);return ymd(date)};
function dashboard(selected){
  const subjects=['자율·자치활동','선택과목','음악 감상과 비평','사진의 이해','선택과목','선택과목','영어Ⅱ'];
  return{
    school:SCHOOL,selected,from:addDays(selected,-3),to:addDays(selected,3),
    timetable:subjects.map((subject,index)=>({date:selected,period:index+1,subject,grade:'2',className:'6'})),
    meals:[{date:selected,type:'중식',dishes:['찰현미밥','한우설렁탕','골뱅이야채무침','서문시장삼각만두','깍두기','요거퐁당견과믹스'],calories:'873.1 Kcal',nutrition:'',origin:''}],
    events:[{date:addDays(selected,2),name:'2학기 전국 영어듣기능력평가',content:'',grade1:'N',grade2:'Y',grade3:'N',holidayType:''}],
    scheduleMeta:{mode:'fixture',count:1}
  };
}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixtures(page){
  await page.route('**/functions/v1/school-data**',route=>{
    const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';
    if(action==='dashboard')return json(route,dashboard((url.searchParams.get('date')||ymd()).replace(/-/g,'')));
    if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='place')return json(route,{provider:'kakao',place:{id:'fixture',name:SCHOOL.name,url:'https://place.map.kakao.com/fixture',address:SCHOOL.address,roadAddress:SCHOOL.address,x:'128.687',y:'35.875'}});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    if(action==='search')return json(route,{schools:[SCHOOL]});
    return json(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.route('**/functions/v1/flow-quest-event**',route=>route.fulfill({status:204,body:''}));
}
async function clickVisible(page,selector){
  const items=page.locator(selector);
  for(let index=0;index<await items.count();index++){
    const item=items.nth(index);
    if(await item.isVisible()){await item.click();return}
  }
  throw new Error(`No visible target: ${selector}`);
}
async function settleSurface(page){
  await page.addStyleTag({content:`
    html[data-flow-school-ui="v2"] #dashboard,
    html[data-flow-school-ui="v2"] #dashboard *,
    html[data-flow-school-ui="v2"] #dashboard *::before,
    html[data-flow-school-ui="v2"] #dashboard *::after{
      transition:none!important;
      animation:none!important;
    }
  `});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function readState(page){
  return page.evaluate(()=>{
    const root=document.documentElement;
    const visible=node=>{if(!node)return false;const style=getComputedStyle(node),rect=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&rect.width>0&&rect.height>0};
    const firstVisible=selector=>[...document.querySelectorAll(selector)].find(visible)||null;
    const signature=(node,pseudo=null)=>{
      if(!node||(!pseudo&&!visible(node)))return null;
      const style=getComputedStyle(node,pseudo);
      return{
        backgroundColor:style.backgroundColor,
        backgroundImage:style.backgroundImage,
        borderTopColor:style.borderTopColor,
        borderRightColor:style.borderRightColor,
        borderBottomColor:style.borderBottomColor,
        borderLeftColor:style.borderLeftColor,
        boxShadow:style.boxShadow,
        borderRadius:style.borderRadius,
        padding:style.padding,
        backdropFilter:style.backdropFilter||style.webkitBackdropFilter||''
      };
    };
    const today={
      statusCard:signature(firstVisible('#todayView .status-card:not(.flow-home-noise)')),
      timetableCard:signature(firstVisible('#todayView .timetable-card')),
      periodButton:signature(firstVisible('#todayView .period-button')),
      timetableToggle:signature(firstVisible('#todayView .timetable-mode-toggle')),
      timetableAction:signature(firstVisible('#todayView .timetable-actions>.neo-button')),
      mealCard:signature(firstVisible('#todayView .meal-card')),
      mealTab:signature(firstVisible('#todayView .meal-tab')),
      dish:signature(firstVisible('#todayView .dish')),
      allergyButton:signature(firstVisible('#todayView #allergyBtn')),
      topbar:signature(firstVisible('#dashboard .mobile-topbar')),
      schoolButton:signature(firstVisible('#dashboard .mobile-school-button')),
      bottomNav:signature(firstVisible('#bottomNav.mobile-bottom-nav')),
      bottomNavLens:signature(firstVisible('#bottomNav.mobile-bottom-nav'),'::before')
    };
    const schedule={
      calendarCard:signature(firstVisible('#scheduleView .calendar-card')),
      calendarDay:signature(firstVisible('#scheduleView .calendar-day:not(.muted)')),
      monthPicker:signature(firstVisible('#scheduleView .month-picker')),
      scheduleCard:signature(firstVisible('#scheduleView .content-card')),
      bottomNav:signature(firstVisible('#bottomNav.mobile-bottom-nav')),
      bottomNavLens:signature(firstVisible('#bottomNav.mobile-bottom-nav'),'::before')
    };
    return{
      ambient:root.dataset.flowAmbient||'',
      phase:root.dataset.flowAmbientPhase||'',
      scene:{
        rootBackground:getComputedStyle(root).backgroundImage,
        bodyBackground:getComputedStyle(document.body).backgroundImage,
        bodyBeforeOpacity:getComputedStyle(document.body,'::before').opacity,
        productMainBackground:getComputedStyle(document.querySelector('.product-main')).backgroundColor
      },
      today,schedule
    };
  });
}
function compactSurface(state){
  const prune=group=>Object.fromEntries(Object.entries(group).filter(([,value])=>value!==null));
  return{today:prune(state.today),schedule:prune(state.schedule)};
}
function assertSurfaceParity(name,off,on){
  const offSurface=compactSurface(off),onSurface=compactSurface(on);
  const offKeys=JSON.stringify(Object.fromEntries(Object.entries(offSurface).map(([group,items])=>[group,Object.keys(items)])));
  const onKeys=JSON.stringify(Object.fromEntries(Object.entries(onSurface).map(([group,items])=>[group,Object.keys(items)])));
  if(offKeys!==onKeys)throw new Error(`${name}: ambient toggle changed visible component inventory off=${offKeys} on=${onKeys}`);
  if(JSON.stringify(offSurface)!==JSON.stringify(onSurface)){
    const drift=[];
    for(const group of ['today','schedule'])for(const key of Object.keys(offSurface[group])){
      const before=offSurface[group][key],after=onSurface[group][key];
      if(JSON.stringify(before)!==JSON.stringify(after))drift.push({group,key,off:before,on:after});
    }
    throw new Error(`${name}: ambient restyled School components ${JSON.stringify(drift)}`);
  }
  if(off.scene.rootBackground!=='none'||off.scene.bodyBackground!=='none')throw new Error(`${name}: ambient OFF still paints the scene ${JSON.stringify(off.scene)}`);
  if(on.scene.rootBackground==='none'&&on.scene.bodyBackground==='none')throw new Error(`${name}: ambient ON no longer paints the scene ${JSON.stringify(on.scene)}`);
}
async function capture(browser,entry,ambient){
  const context=await browser.newContext({viewport:{width:entry.width,height:entry.height},isMobile:entry.isMobile,hasTouch:entry.hasTouch,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();page.setDefaultTimeout(12000);await fixtures(page);
  try{
    await page.addInitScript(({school,ambient})=>{
      localStorage.clear();
      localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));
      localStorage.setItem('flow-school-theme-v3','light');
      localStorage.setItem('flow-ambient-v1',ambient);
      localStorage.setItem('flow-motion-v1','off');
    },{school:SCHOOL,ambient});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});
    await page.locator('#dashboard:not(.hidden)').waitFor();
    await page.locator('#todayView .period-button').first().waitFor();
    await page.waitForFunction(expected=>document.documentElement.dataset.flowExperience==='ready'&&document.documentElement.dataset.flowAmbient===expected,ambient);
    await settleSurface(page);
    const before=await readState(page);
    await page.screenshot({path:`${OUT}/${entry.name}-${ambient}-today.png`,fullPage:false,animations:'disabled'});
    await clickVisible(page,'[data-view="schedule"]');
    await page.locator('#scheduleView:not(.hidden)').waitFor();
    await page.locator('#scheduleView .calendar-day').first().waitFor();
    await page.waitForTimeout(80);
    const schedule=await readState(page);
    await page.screenshot({path:`${OUT}/${entry.name}-${ambient}-schedule.png`,fullPage:false,animations:'disabled'});
    if(entry.name==='mobile-portrait')await page.screenshot({path:`${OUT}/${entry.name}-${ambient}-schedule-full.png`,fullPage:true,animations:'disabled'});
    return{...before,schedule:schedule.schedule};
  }finally{await context.close()}
}

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
for(const entry of CASES){
  try{
    const off=await capture(browser,entry,'off');
    const on=await capture(browser,entry,'on');
    assertSurfaceParity(entry.name,off,on);
    report.cases.push({name:entry.name,viewport:{width:entry.width,height:entry.height},off,on,pass:true});
    console.log(`${entry.name}: PASS`);
  }catch(error){
    const message=String(error?.stack||error);report.failures.push({name:entry.name,error:message});report.cases.push({name:entry.name,viewport:{width:entry.width,height:entry.height},pass:false,error:message});console.error(`${entry.name}: FAIL\n${message}`);break;
  }
}
await browser.close();
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length)process.exit(1);
console.log(`School ambient surface parity PASS: ${report.cases.length} viewports`);
