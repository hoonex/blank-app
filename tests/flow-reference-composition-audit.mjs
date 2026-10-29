import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_REFERENCE_OUT||'flow-reference-audit';
const CASES=[
  ['phone-portrait',390,844,true],['phone-landscape',844,390,true],
  ['tablet-portrait',768,1024,true],['tablet-landscape',1024,768,true],
  ['desktop',1366,768,false],['large-desktop',1920,1080,false],
];
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jungdong High School',kind:'고등학교',location:'대구광역시',type:'사립',address:'대구광역시 동구 반야월북로 199',phone:'053-235-5800',homepage:'https://example.edu',highSchoolType:'일반고',highSchoolTrack:'일반계',coed:'남',dayNight:'주간'};
const ymd=(date=new Date())=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return p.year+p.month+p.day;};
const response=(route,body)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
async function setup(page){
  await page.addInitScript(school=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-school-transit-lab-v1','off');
    localStorage.setItem('flow-ambient-v1','on');
    localStorage.setItem('flow-glass-mode-v2','standard');
  },SCHOOL);
  await page.route('**/functions/v1/school-data**',route=>{
    const u=new URL(route.request().url()),action=u.searchParams.get('action')||'';
    if(action==='dashboard'){
      const date=u.searchParams.get('date')||ymd();
      return response(route,{school:SCHOOL,selected:date,from:date,to:date,
        timetable:Array.from({length:7},(_,i)=>({date,period:i+1,subject:['문학','영어Ⅱ','선택과목','스포츠 생활','정보','선택과목','진로활동'][i],grade:'2',className:'6'})),
        meals:[{date,type:'중식',dishes:['현미밥','국','김치'],calories:'780 Kcal',nutrition:'',origin:''}],
        events:[{date,name:'토요휴업일',content:'학교 일정',grade2:'Y'}],
        scheduleMeta:{mode:'fixture',count:1}});
    }
    if(action==='media')return response(route,{media:{},homepage:SCHOOL.homepage});
    if(action==='classes')return response(route,{classes:['1','2','3','4','5','6']});
    return response(route,{});
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.route('**/functions/v1/flow-quest-event**',route=>route.fulfill({status:204,body:''}));
}
async function getState(page,view){
  return page.evaluate(view=>{
    const q=s=>document.querySelector(s);
    const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const vis=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0};
    const selector={today:'#todayView',schedule:'#scheduleView',school:'#schoolView',settings:'#flowSchoolSettingsView'}[view];
    return {viewport:{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth},
      refLoaded:!!q('link[data-flow-school-reference-composition]')?.sheet,
      ready:document.documentElement.dataset.flowSchoolSurface,
      panel:rect(q(selector)),visible:vis(q(selector)),
      heroVisible:vis(q('#schoolView .profile-hero')),
      headerVisible:vis(q(selector+' > .view-header'))||vis(q(selector+' > .flow-settings-header')),
      header:rect(q(selector+' > .view-header')||q(selector+' > .flow-settings-header')),
      calendar:rect(q('#scheduleView .calendar-card')),
      eventList:rect(q('#scheduleView .schedule-layout>.content-card:last-child')),
      timetable:rect(q('#todayView .timetable-card')),meal:rect(q('#todayView .meal-card')),
      settingsCards:[...document.querySelectorAll('#flowSchoolSettingsView .flow-settings-card')].map(rect),
      infoCards:[...document.querySelectorAll('#schoolInfoGrid>.info-group')].map(rect),
      actions:[...document.querySelectorAll('#schoolView .school-actions .action-link')].filter(vis).length,
      nav:rect(q('#bottomNav'))};
  },view);
}
function verify(c,view,s){
  const [name,w,h]=c;
  if(s.ready!=='ready'||!s.refLoaded||!s.visible)throw new Error(name+' '+view+': not ready '+JSON.stringify(s));
  if(s.viewport.scrollWidth>s.viewport.clientWidth+2)throw new Error(name+' '+view+': horizontal overflow '+JSON.stringify(s.viewport));
  if(s.panel?.width<Math.min(280,w-30))throw new Error(name+' '+view+': collapsed content '+JSON.stringify(s.panel));
  if(['schedule','school','settings'].includes(view)&&(!s.headerVisible||!s.header||s.header.height>90))throw new Error(name+' '+view+': compact destination header missing or oversized '+JSON.stringify(s.header));
  if(view==='today'&&s.timetable&&s.meal&&w>=960&&w>h&&s.meal.left<=s.timetable.left+120)throw new Error(name+': timetable and meal not two-column');
  if(view==='schedule'&&s.calendar&&s.eventList&&w>=960&&w>h&&s.eventList.left<=s.calendar.left+120)throw new Error(name+': calendar and events not two-column');
  if(view==='school'&&(!s.heroVisible||s.actions<2||!s.infoCards.length))throw new Error(name+': school data or actions missing');
  if(view==='settings'&&s.settingsCards.length<4)throw new Error(name+': setting groups disappeared');
}
async function clickNav(page,view,desktop){
  const sel=view==='settings'?(desktop?'#settingsBtn':'#mobileSettingsBtn'):(desktop?'.side-nav':'#bottomNav')+' [data-view="'+view+'"]';
  const node=page.locator(sel).first();await node.waitFor({state:'visible'});await node.click();
  const panel={today:'#todayView',schedule:'#scheduleView',school:'#schoolView',settings:'#flowSchoolSettingsView'}[view];
  await page.locator(panel+':not(.hidden)').waitFor();
}
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[],failures=[];
for(const c of CASES){
  const [name,width,height,touch]=c,context=await browser.newContext({viewport:{width,height},hasTouch:touch,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul'}),page=await context.newPage();
  page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',error=>errors.push(String(error)));
  try{
    await setup(page);
    await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready');
    await page.waitForFunction(()=>!!document.querySelector('link[data-flow-school-reference-composition]')?.sheet);
    const desktop=width>=1181&&height>=681;
    for(const view of ['today','schedule','school','settings']){
      await clickNav(page,view,desktop);
      await page.waitForTimeout(100);
      const s=await getState(page,view);verify(c,view,s);
      await page.screenshot({path:OUT+'/'+name+'-'+view+'.png',animations:'disabled'});
      await page.screenshot({path:OUT+'/'+name+'-'+view+'-full.png',fullPage:true,animations:'disabled'});
      results.push({name,view,pass:true,details:s});
    }
    if(errors.length)throw new Error(name+': browser errors '+JSON.stringify(errors));
    console.log(name+': PASS');
  }catch(error){
    const message=String(error?.stack||error);failures.push({name,message});console.error(name+': '+message);
    try{await page.screenshot({path:OUT+'/'+name+'-failure.png',animations:'disabled'})}catch{}
  }finally{await context.close()}
}
await browser.close();
await writeFile(OUT+'/report.json',JSON.stringify({results,failures},null,2));
if(failures.length)process.exitCode=1;
console.log('Flow four-tab reference audit: '+results.length+' passed screens, '+failures.length+' failure cases');
