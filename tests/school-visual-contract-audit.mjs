import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-visual-contract-audit';
const CASES=[
  {name:'phone-360',width:360,height:800,mobile:true,touch:true},
  {name:'phone-390',width:390,height:844,mobile:true,touch:true},
  {name:'phone-412',width:412,height:915,mobile:true,touch:true},
  {name:'phone-landscape',width:844,height:390,mobile:true,touch:true},
  {name:'tablet-portrait',width:768,height:1024,mobile:false,touch:true},
  {name:'tablet-landscape',width:1024,height:768,mobile:false,touch:true},
  {name:'desktop-1280',width:1280,height:800,mobile:false,touch:false},
  {name:'desktop-1366',width:1366,height:768,mobile:false,touch:false},
  {name:'desktop-1920',width:1920,height:1080,mobile:false,touch:false},
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
  return{school:SCHOOL,selected,from:ymd(monday),to:add(ymd(monday),4),timetable,meals:[{date:selected,type:'중식',dishes:['현미밥','닭갈비(5.6.15.)','계란찜(1.)','배추김치(9.)'],calories:'742 Kcal',nutrition:'탄수화물 90g\n단백질 32g',origin:'쌀 국내산\n닭고기 국내산'}],events:[{date:add(selected,2),name:'학급 행사',content:'학급별 행사',grade2:'Y'}],scheduleMeta:{mode:'fixture',count:1}};
}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixtures(page){
  await page.route('**/functions/v1/school-data**',route=>{const u=new URL(route.request().url()),action=u.searchParams.get('action')||'search';if(action==='dashboard')return json(route,dashboard((u.searchParams.get('date')||ymd(new Date())).replace(/-/g,'')));if(action==='media')return json(route,{media:{hero:'',logo:''},homepage:SCHOOL.homepage});if(action==='place')return json(route,{provider:'kakao',place:{id:'fixture',name:SCHOOL.name,url:'https://place.map.kakao.com/7240101',address:SCHOOL.address,roadAddress:SCHOOL.address,phone:SCHOOL.phone,x:'128.687',y:'35.875'}});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6','7','8']});if(action==='search')return json(route,{schools:[SCHOOL]});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}
async function clickVisible(page,selector){const items=page.locator(selector);for(let i=0;i<await items.count();i++){const item=items.nth(i);if(await item.isVisible()){await item.click();return item}}throw new Error(`No visible target: ${selector}`)}
const n=v=>Number.parseFloat(v)||0;
function expected(c){return c.width<700?{section:12,control:8,pad:15,inset:10}:c.width<=1180?{section:16,control:8,pad:18,inset:18}:{section:18,control:10,pad:18,inset:null}}
async function visualState(page,c,label){
  return page.evaluate(({width,label})=>{
    const root=document.documentElement,cs=(node,pseudo)=>node?getComputedStyle(node,pseudo):null,box=node=>node?(()=>{const r=node.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}})():null;
    const visible=node=>{if(!node)return false;const s=cs(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
    const firstVisible=selector=>[...document.querySelectorAll(selector)].find(visible)||null;
    const shapeSelectors=['.status-card','.timetable-card','.meal-card','.upcoming-card','.timetable-mode-toggle','.timetable-mode-toggle button','.flow-school-utility-action','#allergyBtn','.period-button','.period-no','.meal-tab','.dish','.flow-exam-card-v5','.mobile-school-button','#flowTodayDateDock .flow-date-focus','.mobile-tab','.calendar-card','.calendar-day','.info-tile','.flow-settings-card'];
    const shapes=[];
    for(const selector of shapeSelectors){for(const node of document.querySelectorAll(selector)){if(!visible(node))continue;const s=cs(node);shapes.push({selector,cornerShape:s.cornerShape||'',radius:s.borderRadius||''})}}
    const nav=firstVisible('#bottomNav'),today=document.querySelector('#todayView'),status=document.querySelector('#todayView .status-grid'),todayGrid=document.querySelector('#todayView .today-grid'),right=document.querySelector('#todayView .right-stack'),timetable=document.querySelector('#todayView .timetable-card'),meal=document.querySelector('#todayView .meal-card');
    const schedule=document.querySelector('#scheduleView .schedule-layout'),schoolGrid=document.querySelector('#schoolView .school-info-grid'),settings=document.querySelector('#flowSchoolSettingsView .flow-settings-stack');
    return{
      label,width,contract:root.dataset.flowSchoolVisualContract||'',ambient:root.dataset.flowAmbient||'',phase:root.dataset.flowAmbientPhase||'',
      tokens:{section:cs(document.body).getPropertyValue('--flow-school-section-gap').trim(),control:cs(document.body).getPropertyValue('--flow-school-control-gap').trim(),pad:cs(document.body).getPropertyValue('--flow-school-card-pad').trim(),inset:cs(document.body).getPropertyValue('--flow-school-page-inset').trim()},
      shapes,navShape:nav?{shape:cs(nav).cornerShape||'',radius:cs(nav).borderRadius,lensShape:cs(nav,'::before').cornerShape||'',lensRadius:cs(nav,'::before').borderRadius}:null,
      gaps:{status:status?cs(status).gap:'',today:todayGrid?cs(todayGrid).gap:'',right:right?cs(right).gap:'',schedule:schedule&&visible(schedule)?cs(schedule).gap:'',school:schoolGrid&&visible(schoolGrid)?cs(schoolGrid).gap:'',settings:settings&&visible(settings)?cs(settings).gap:''},
      padding:{today:today?{left:cs(today).paddingLeft,right:cs(today).paddingRight}:null,timetable:timetable?cs(timetable).padding:'',meal:meal?cs(meal).padding:''},
      boxes:{today:box(today),timetable:box(timetable),meal:box(meal)}
    }
  },{width:c.width,label});
}
function verify(c,state){
  const e=expected(c);if(state.contract!=='v7')throw new Error(`${c.name}/${state.label}: visual contract missing ${JSON.stringify(state)}`);if(state.ambient!=='on')throw new Error(`${c.name}/${state.label}: ambient unexpectedly off`);
  for(const item of state.shapes)if(String(item.cornerShape).includes('squircle'))throw new Error(`${c.name}/${state.label}: squircle leaked at ${item.selector} ${JSON.stringify(item)}`);
  if(state.navShape){if(String(state.navShape.shape).includes('squircle')||String(state.navShape.lensShape).includes('squircle'))throw new Error(`${c.name}/${state.label}: nav squircle leaked ${JSON.stringify(state.navShape)}`);if(c.width<1181&&n(state.navShape.radius)<24)throw new Error(`${c.name}/${state.label}: compact nav lost pill curvature ${JSON.stringify(state.navShape)}`)}
  if(n(state.tokens.section)!==e.section||n(state.tokens.control)!==e.control||n(state.tokens.pad)!==e.pad)throw new Error(`${c.name}/${state.label}: spacing tokens drifted expected=${JSON.stringify(e)} got=${JSON.stringify(state.tokens)}`);
  if(state.label==='today'){
    if(Math.abs(n(state.gaps.status)-e.control)>.25||Math.abs(n(state.gaps.today)-e.section)>.25||Math.abs(n(state.gaps.right)-e.section)>.25)throw new Error(`${c.name}: Today gaps inconsistent ${JSON.stringify(state.gaps)}`);
    if(Math.abs(n(state.padding.timetable)-e.pad)>.25||Math.abs(n(state.padding.meal)-e.pad)>.25)throw new Error(`${c.name}: Today card padding inconsistent ${JSON.stringify(state.padding)}`);
    if(c.width<1181&&(Math.abs(n(state.padding.today.left)-e.inset)>.25||Math.abs(n(state.padding.today.right)-e.inset)>.25))throw new Error(`${c.name}: Today outer inset asymmetric ${JSON.stringify(state.padding.today)}`);
  }
  if(state.label==='schedule'&&state.gaps.schedule&&Math.abs(n(state.gaps.schedule)-e.section)>.25)throw new Error(`${c.name}: Schedule gap drift ${state.gaps.schedule}`);
  if(state.label==='school'&&state.gaps.school&&Math.abs(n(state.gaps.school)-e.section)>.25)throw new Error(`${c.name}: School grid gap drift ${state.gaps.school}`);
  if(state.label==='settings'&&state.gaps.settings&&Math.abs(n(state.gaps.settings)-e.section)>.25)throw new Error(`${c.name}: Settings grid gap drift ${state.gaps.settings}`);
}
async function ambientProbe(page,c){
  const result=await page.evaluate(()=>{
    const root=document.documentElement,card=document.querySelector('#todayView .timetable-card'),top=[...document.querySelectorAll('.mobile-topbar')].find(x=>getComputedStyle(x).display!=='none'),nav=[...document.querySelectorAll('#bottomNav')].find(x=>getComputedStyle(x).display!=='none');
    const read=()=>({card:getComputedStyle(card).backgroundColor,top:top?getComputedStyle(top).backgroundColor:'',nav:nav?getComputedStyle(nav).backgroundColor:'',backdrop:getComputedStyle(document.body,'::before').opacity});
    const original={a:root.style.getPropertyValue('--flow-ambient-a'),b:root.style.getPropertyValue('--flow-ambient-b')};
    root.style.setProperty('--flow-ambient-a','#ffe5a6');root.style.setProperty('--flow-ambient-b','#e7efff');const warm=read();
    root.style.setProperty('--flow-ambient-a','#c8b8f4');root.style.setProperty('--flow-ambient-b','#b6c8f2');const cool=read();
    root.style.setProperty('--flow-ambient-a',original.a);root.style.setProperty('--flow-ambient-b',original.b);
    return{warm,cool};
  });
  if(result.warm.card===result.cool.card)throw new Error(`${c.name}: time palette does not reach card surface ${JSON.stringify(result)}`);
  if(c.width<1181&&result.warm.top===result.cool.top)throw new Error(`${c.name}: time palette does not reach top shell ${JSON.stringify(result)}`);
  if(c.width<1181&&result.warm.nav===result.cool.nav)throw new Error(`${c.name}: time palette does not reach bottom glass ${JSON.stringify(result)}`);
  if(n(result.warm.backdrop)>.7)throw new Error(`${c.name}: ambient backdrop is too dominant ${JSON.stringify(result)}`);
  return result;
}

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
for(const c of CASES){
  const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:c.mobile,hasTouch:c.touch,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});const page=await context.newPage();page.setDefaultTimeout(12000);await fixtures(page);
  const row={name:c.name,viewport:{width:c.width,height:c.height},states:{}};
  try{
    await page.addInitScript(school=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-ambient-v1','on')},SCHOOL);
    await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.locator('#timetable .period-button').first().waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolVisualContract==='v7'&&document.documentElement.dataset.flowExperience==='ready');
    row.states.today=await visualState(page,c,'today');verify(c,row.states.today);row.ambient=await ambientProbe(page,c);
    const week=page.locator('.timetable-mode-toggle [data-timetable-mode="week"],.timetable-mode-toggle [data-view="week"]').first();if(await week.count()){await week.click();await page.locator('#inlineWeekTimetable:not(.hidden)').waitFor();row.states.week=await visualState(page,c,'week');verify(c,row.states.week)}
    await clickVisible(page,'[data-view="schedule"]');await page.locator('#scheduleView:not(.hidden)').waitFor();row.states.schedule=await visualState(page,c,'schedule');verify(c,row.states.schedule);
    await clickVisible(page,'[data-view="school"]');await page.locator('#schoolView:not(.hidden)').waitFor();await page.locator('#schoolInfoGrid .info-tile').first().waitFor();row.states.school=await visualState(page,c,'school');verify(c,row.states.school);
    await clickVisible(page,'#settingsBtn,#mobileSettingsBtn');await page.locator('#flowSchoolSettingsView:not(.hidden)').waitFor();row.states.settings=await visualState(page,c,'settings');verify(c,row.states.settings);
    row.pass=true;
  }catch(error){row.pass=false;row.error=error?.stack||String(error);report.failures.push({case:c.name,error:row.error});console.error(`${c.name}: FAIL\n${row.error}`)}finally{report.cases.push(row);await context.close()}
}
await writeFile(`${OUT}/school-visual-contract-report.json`,JSON.stringify(report,null,2));await browser.close();if(report.failures.length)throw new Error(`School visual contract found ${report.failures.length} failure(s): ${JSON.stringify(report.failures.map(x=>({case:x.case,error:x.error.split('\n')[0]})))}`);console.log(`School visual contract PASS: ${CASES.length} viewports`);
