import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-spacing-system-audit';
const CASES=[
  {name:'mobile-portrait',width:390,height:844,mobile:true,touch:true},
  {name:'mobile-landscape',width:844,height:390,mobile:true,touch:true},
  {name:'tablet-portrait',width:768,height:1024,mobile:false,touch:true},
  {name:'tablet-landscape',width:1024,height:768,mobile:false,touch:true},
  {name:'desktop',width:1366,height:768,mobile:false,touch:false},
  {name:'large-desktop',width:1920,height:1080,mobile:false,touch:false},
];
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',jurisdiction:'대구광역시동부교육지원청',type:'사립',postalCode:'41063',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr',coed:'남녀공학',highSchoolType:'일반고',highSchoolTrack:'일반계',dayNight:'주간',founded:'19830301',anniversary:'19830301'};
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
const parse=v=>new Date(+v.slice(0,4),+v.slice(4,6)-1,+v.slice(6,8),12);
const add=(v,n)=>{const d=parse(v);d.setDate(d.getDate()+n);return ymd(d)};
function rows(date){return['문학','영어Ⅱ','수학Ⅱ','정보','스포츠 생활2','화학','진로활동'].map((subject,i)=>({date,period:i+1,subject,grade:'2',className:'6'}))}
function dashboard(selected){
  const d=parse(selected),day=d.getDay(),monday=new Date(d);monday.setDate(d.getDate()+(day===0?-6:1-day));
  const timetable=[];for(let i=0;i<5;i++){const x=new Date(monday);x.setDate(monday.getDate()+i);timetable.push(...rows(ymd(x)))}
  if(!timetable.some(row=>row.date===selected))timetable.push(...rows(selected));
  return{school:SCHOOL,selected,from:ymd(monday),to:add(ymd(monday),4),timetable,meals:[{date:selected,type:'중식',dishes:['현미밥','닭갈비(5.6.15.)','계란찜(1.)','배추김치(9.)'],calories:'742 Kcal'}],events:[{date:add(selected,2),name:'학급 행사',content:'학급별 행사',grade2:'Y'},{date:add(selected,7),name:'진로 체험',content:'진로 체험 활동',grade2:'Y'}],scheduleMeta:{mode:'fixture',count:2}};
}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixtures(page){
  await page.route('**/functions/v1/school-data**',route=>{const u=new URL(route.request().url()),action=u.searchParams.get('action')||'search';if(action==='dashboard')return json(route,dashboard((u.searchParams.get('date')||ymd(new Date())).replace(/-/g,'')));if(action==='media')return json(route,{media:{hero:'',logo:''},homepage:SCHOOL.homepage});if(action==='place')return json(route,{provider:'kakao',place:{id:'fixture',name:SCHOOL.name,url:'https://place.map.kakao.com/7240101',address:SCHOOL.address,roadAddress:SCHOOL.address,phone:SCHOOL.phone,x:'128.687',y:'35.875'}});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6','7','8']});if(action==='search')return json(route,{schools:[SCHOOL]});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.route('https://t1.kakaocdn.net/kas/static/ba.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
}
async function clickVisible(page,selector){const items=page.locator(selector);for(let i=0;i<await items.count();i++){const item=items.nth(i);if(await item.isVisible()){await item.click();return item}}throw new Error(`No visible target: ${selector}`)}
const num=v=>Number.parseFloat(v)||0;
const close=(a,b,t=.75)=>Math.abs(a-b)<=t;
function assert(value,message){if(!value)throw new Error(message)}
async function state(page,label){
  return page.evaluate(label=>{
    const q=s=>document.querySelector(s),cs=n=>n?getComputedStyle(n):null,box=n=>{if(!n)return null;const r=n.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const dash=q('#dashboard'),d=cs(dash),today=q('#todayView'),status=q('#todayView .status-grid'),todayGrid=q('#todayView .today-grid'),right=q('#todayView .right-stack'),tt=q('#todayView .timetable-card'),meal=q('#todayView .meal-card'),up=q('#todayView .upcoming-card');
    const schedule=q('#scheduleView'),layout=q('#scheduleView .schedule-layout'),calendar=q('#scheduleView .calendar-card'),eventCard=q('#scheduleView .schedule-layout>.content-card:not(.calendar-card)'),calendarGrid=q('#calendarGrid');
    const school=q('#schoolView'),profile=q('#schoolView .profile-hero'),info=q('#schoolView .school-info-grid'),actions=q('#schoolView .school-actions');
    const settings=q('#flowSchoolSettingsView'),stack=q('#flowSchoolSettingsView .flow-settings-stack'),settingsCard=q('#flowSchoolSettingsView .flow-settings-card');
    const props=n=>{const s=cs(n);return n&&s?{display:s.display,gap:s.gap,rowGap:s.rowGap,columnGap:s.columnGap,marginTop:s.marginTop,marginBottom:s.marginBottom,paddingLeft:s.paddingLeft,paddingRight:s.paddingRight,padding:s.padding}:null};
    return{label,spacing:document.documentElement.dataset.flowSchoolSpacingSystem||'',tokens:{section:d.getPropertyValue('--flow-school-section-gap').trim(),control:d.getPropertyValue('--flow-school-control-gap').trim(),card:d.getPropertyValue('--flow-school-card-pad').trim(),page:d.getPropertyValue('--flow-school-page-inset').trim(),dense:d.getPropertyValue('--flow-school-dense-gap').trim()},root:{client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth},today:{view:props(today),status:props(status),grid:props(todayGrid),right:props(right),tt:props(tt),meal:props(meal),boxes:{status:box(status),grid:box(todayGrid),tt:box(tt),right:box(right),meal:box(meal),up:box(up)}},schedule:{view:props(schedule),layout:props(layout),calendar:props(calendar),calendarGrid:props(calendarGrid),boxes:{calendar:box(calendar),event:box(eventCard)}},school:{view:props(school),info:props(info),actions:props(actions),boxes:{profile:box(profile),info:box(info),actions:box(actions)}},settings:{view:props(settings),stack:props(stack),card:props(settingsCard)}};
  },label);
}
function verifyBase(c,s){
  assert(s.spacing==='v1',`${c.name}/${s.label}: spacing system missing`);
  assert(s.root.scroll<=s.root.client+2,`${c.name}/${s.label}: horizontal overflow ${JSON.stringify(s.root)}`);
  const section=num(s.tokens.section),control=num(s.tokens.control),card=num(s.tokens.card),page=num(s.tokens.page),dense=Math.max(4,control-2);
  assert(section>0&&control>0&&card>0&&page>0,`${c.name}/${s.label}: missing tokens ${JSON.stringify(s.tokens)}`);
  assert(s.tokens.dense.length>0,`${c.name}/${s.label}: dense spacing token missing ${JSON.stringify(s.tokens)}`);
  return{section,control,card,page,dense};
}
function verifyToday(c,s){
  const t=verifyBase(c,s),x=s.today;
  assert(close(num(x.status.gap),t.control),`${c.name}: status gap ${x.status.gap} != ${t.control}`);
  assert(close(num(x.grid.gap),t.section),`${c.name}: today grid gap ${x.grid.gap} != ${t.section}`);
  assert(close(num(x.right.gap),t.section),`${c.name}: right stack gap ${x.right.gap} != ${t.section}`);
  assert(close(num(x.tt.padding),t.card)&&close(num(x.meal.padding),t.card),`${c.name}: Today card padding drift ${JSON.stringify({tt:x.tt.padding,meal:x.meal.padding,token:t.card})}`);
  assert(close(num(x.status.marginBottom),t.section),`${c.name}: status-to-content margin ${x.status.marginBottom} != ${t.section}`);
  if(c.width<=820){
    assert(x.grid.display==='grid',`${c.name}: Today stack is not grid ${JSON.stringify({grid:x.grid.display,right:x.right.display})}`);
    if(c.width<=520)assert(x.right.display==='flex',`${c.name}: phone utility stack must stay flex ${JSON.stringify(x.right)}`);
    else assert(x.right.display==='grid',`${c.name}: tablet utility stack must stay grid ${JSON.stringify(x.right)}`);
    assert(close(x.boxes.grid.top-x.boxes.status.bottom,t.section,1),`${c.name}: rendered status→Today gap mismatch ${JSON.stringify({actual:x.boxes.grid.top-x.boxes.status.bottom,token:t.section})}`);
    assert(close(x.boxes.right.top-x.boxes.tt.bottom,t.section,1),`${c.name}: rendered timetable→right-stack gap mismatch ${JSON.stringify({actual:x.boxes.right.top-x.boxes.tt.bottom,token:t.section})}`);
    if(c.width<=520)assert(close(x.boxes.up.top-x.boxes.meal.bottom,t.section,1),`${c.name}: rendered meal→upcoming vertical gap mismatch ${JSON.stringify({actual:x.boxes.up.top-x.boxes.meal.bottom,token:t.section})}`);
    else assert(close(x.boxes.up.left-x.boxes.meal.right,t.section,1),`${c.name}: rendered meal→upcoming horizontal gap mismatch ${JSON.stringify({actual:x.boxes.up.left-x.boxes.meal.right,token:t.section})}`);
  }
  if(c.width<=1180){assert(close(num(x.view.paddingLeft),t.page)&&close(num(x.view.paddingRight),t.page),`${c.name}: Today rail inset drift ${JSON.stringify(x.view)}`)}
  return t;
}
function verifySchedule(c,s,t,todayLeft){
  verifyBase(c,s);const x=s.schedule;
  assert(close(num(x.layout.gap),t.section),`${c.name}: schedule layout gap ${x.layout.gap} != ${t.section}`);
  assert(close(num(x.calendarGrid.rowGap),t.dense,.4)&&close(num(x.calendarGrid.columnGap),t.dense,.4),`${c.name}: calendar dense gap mismatch ${JSON.stringify(x.calendarGrid)}`);
  assert(close(num(x.calendar.padding),t.card),`${c.name}: calendar card padding ${x.calendar.padding} != ${t.card}`);
  if(c.width<=1120){assert(x.layout.display==='grid',`${c.name}: schedule reverted to block; gap would be inert`);assert(close(x.boxes.event.top-x.boxes.calendar.bottom,t.section,1),`${c.name}: rendered calendar→events gap mismatch ${JSON.stringify({actual:x.boxes.event.top-x.boxes.calendar.bottom,token:t.section})}`)}
  if(c.width<=1180){assert(close(num(x.view.paddingLeft),t.page)&&close(num(x.view.paddingRight),t.page),`${c.name}: Schedule rail inset drift ${JSON.stringify(x.view)}`);assert(close(x.boxes.calendar.left,todayLeft,1.25),`${c.name}: Today/Schedule left rail diverged ${JSON.stringify({todayLeft,scheduleLeft:x.boxes.calendar.left})}`)}
}
function verifySchool(c,s,t,todayLeft){
  verifyBase(c,s);const x=s.school;
  assert(close(num(x.info.gap),t.section),`${c.name}: school info gap ${x.info.gap} != ${t.section}`);
  assert(close(num(x.actions.gap),t.section),`${c.name}: school action gap ${x.actions.gap} != ${t.section}`);
  assert(close(num(x.info.marginTop),t.section),`${c.name}: school info section margin ${x.info.marginTop} != ${t.section}`);
  assert(close(num(x.actions.marginTop),t.section),`${c.name}: school actions section margin ${x.actions.marginTop} != ${t.section}`);
  assert(close(x.boxes.info.top-x.boxes.profile.bottom,t.section,1),`${c.name}: rendered profile→info gap mismatch ${JSON.stringify({actual:x.boxes.info.top-x.boxes.profile.bottom,token:t.section})}`);
  if(c.width<=1180){assert(close(num(x.view.paddingLeft),t.page)&&close(num(x.view.paddingRight),t.page),`${c.name}: School rail inset drift ${JSON.stringify(x.view)}`);assert(close(x.boxes.profile.left,todayLeft,1.25),`${c.name}: Today/School left rail diverged ${JSON.stringify({todayLeft,schoolLeft:x.boxes.profile.left})}`)}
}
function verifySettings(c,s,t){verifyBase(c,s);assert(close(num(s.settings.stack.gap),t.section),`${c.name}: settings stack gap ${s.settings.stack.gap} != ${t.section}`);if(s.settings.card)assert(close(num(s.settings.card.padding),t.card),`${c.name}: settings card padding ${s.settings.card.padding} != ${t.card}`)}

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
for(const c of CASES){
  const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:c.mobile,hasTouch:c.touch,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});const page=await context.newPage();page.setDefaultTimeout(12000);await fixtures(page);const row={name:c.name,viewport:{width:c.width,height:c.height},states:{}};
  try{
    await page.addInitScript(school=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-school-transit-lab-v1','off')},SCHOOL);
    await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.locator('#timetable .period-button').first().waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSpacingSystem==='v1'&&document.documentElement.dataset.flowSchoolSurface==='ready');await page.waitForTimeout(100);
    row.states.today=await state(page,'today');const tokens=verifyToday(c,row.states.today);const todayLeft=row.states.today.today.boxes.tt.left;await page.screenshot({path:`${OUT}/${c.name}-today.png`,fullPage:false,animations:'disabled'});
    await clickVisible(page,'[data-view="schedule"]');await page.locator('#scheduleView:not(.hidden)').waitFor();row.states.schedule=await state(page,'schedule');verifySchedule(c,row.states.schedule,tokens,todayLeft);await page.screenshot({path:`${OUT}/${c.name}-schedule.png`,fullPage:false,animations:'disabled'});
    await clickVisible(page,'[data-view="school"]');await page.locator('#schoolView:not(.hidden)').waitFor();await page.locator('#schoolInfoGrid .info-tile').first().waitFor();row.states.school=await state(page,'school');verifySchool(c,row.states.school,tokens,todayLeft);
    await clickVisible(page,'#settingsBtn,#mobileSettingsBtn');await page.locator('#flowSchoolSettingsView:not(.hidden)').waitFor();row.states.settings=await state(page,'settings');verifySettings(c,row.states.settings,tokens);row.pass=true;
  }catch(error){row.pass=false;row.error=error?.stack||String(error);report.failures.push({case:c.name,error:row.error});console.error(`${c.name}: FAIL\n${row.error}`)}finally{report.cases.push(row);await context.close()}
}
await writeFile(`${OUT}/school-spacing-system-report.json`,JSON.stringify(report,null,2));await browser.close();if(report.failures.length)throw new Error(`School spacing system found ${report.failures.length} failure(s): ${JSON.stringify(report.failures.map(x=>({case:x.case,error:x.error.split('\n')[0]})))}`);console.log(`School spacing system PASS: ${CASES.length} viewports`);
