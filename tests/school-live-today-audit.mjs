import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-live-today-audit';
await fs.mkdir(OUT,{recursive:true});
const pad=value=>String(value).padStart(2,'0');
const kst=new Date(Date.now()+9*60*60*1000);
const selected=`${kst.getUTCFullYear()}${pad(kst.getUTCMonth()+1)}${pad(kst.getUTCDate())}`;
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const requestedDashboardDates=[];
const eventsByMonth={
  '202609':[
    {date:'20260902',name:'전국연합학력평가',content:'1,2학년 전국연합학력평가',grade2:'Y'},
    {date:'20260905',name:'토요휴업일',content:'',grade2:'Y'},
    {date:'20260909',name:'영어듣기평가',content:'2학년 영어듣기평가',grade2:'Y'},
    {date:'20260915',name:'2학기 중간고사',content:'2학년 중간고사',grade2:'Y'},
  ],
  '202610':[
    {date:'20261007',name:'2학기 수행평가',content:'교과별 수행평가 주간',grade2:'Y'},
    {date:'20261020',name:'전국연합학력평가',content:'1,2학년 전국연합학력평가',grade2:'Y'},
  ],
  '202611':[{date:'20261124',name:'2학기 기말고사',content:'2학년 기말고사',grade2:'Y'}],
  '202612':[{date:'20261215',name:'학업성취도평가',content:'2학년 학업성취도평가',grade2:'Y'}],
  '202701':[{date:'20270108',name:'겨울방학',content:'',grade2:'Y'}],
  '202702':[{date:'20270205',name:'학년말 평가',content:'2학년 학년말 평가',grade2:'Y'}],
};
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function assert(value,message){if(!value)throw new Error(message)}
function dashboardFor(date){
  const key=String(date||selected).replace(/\D/g,'').slice(0,8)||selected,month=key.slice(0,6);
  return{school:profile.school,selected:key,from:key,to:key,timetable:Array.from({length:7},(_,i)=>({date:key,period:i+1,subject:['선택과목','문학','음악 감상과 비평','선택과목','스포츠 생활2','동아리활동','선택과목'][i]})),meals:[{date:key,type:'중식',dishes:['현미밥','된장국','갈릭치킨마요','배추김치'],calories:'933.2 Kcal'}],events:eventsByMonth[month]||[],scheduleMeta:{mode:'fixture',count:(eventsByMonth[month]||[]).length}};
}
async function prepare(page){
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.route('**/functions/v1/school-data*',route=>{
    const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';
    if(action==='dashboard'){const date=url.searchParams.get('date')||selected;requestedDashboardDates.push(date);return json(route,dashboardFor(date))}
    if(action==='media')return json(route,{media:{}});
    if(action==='place')return json(route,{provider:'fixture',place:{id:'school',name:profile.school.name,address:profile.school.address}});
    return json(route,{});
  });
  await page.addInitScript(({profile})=>{
    localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','optical');localStorage.setItem('flow-school-transit-lab-v1','off');
    const now=new Date(),start=new Date(now.getTime()-65*60000),pad=value=>String(value).padStart(2,'0');localStorage.setItem('flow-school-bell-v1',JSON.stringify({start:`${pad(start.getHours())}:${pad(start.getMinutes())}`,lesson:50,break:10,meal:'12:20',mealEnd:'13:10'}));
  },{profile});
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolUiStyles==='ready');
  await page.waitForFunction(()=>document.querySelector('#timetable')?.querySelectorAll('.flow-period-time').length===7,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('#flowTodayDateDock')&&document.querySelector('#flowExamFeedV3')?.querySelectorAll('[data-flow-exam-item]').length===3,{timeout:10000});
  await page.waitForTimeout(450);return errors;
}
async function readState(page){return page.evaluate(()=>{
  const box=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
  const visible=node=>{if(!node)return false;const style=getComputedStyle(node),r=node.getBoundingClientRect();return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0&&r.width>0&&r.height>0};
  const timetable=document.querySelector('#timetable'),rows=[...(timetable?.querySelectorAll('.period-button')||[])],dock=document.querySelector('#flowTodayDateDock'),school=document.querySelector('#mobileSchoolBtn'),hero=document.querySelector('#schoolHero'),feed=document.querySelector('#flowExamFeedV3');
  const dateDays=[...(dock?.querySelectorAll('.flow-date-day')||[])].filter(visible).map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{active:node.dataset.active,offset:node.dataset.offset,iso:node.dataset.iso,width:r.width,height:r.height,radius:s.borderRadius,text:node.textContent.trim()}});
  const rowRects=rows.map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{top:r.top,bottom:r.bottom,height:r.height,bg:s.backgroundColor,shadow:s.boxShadow,radius:s.borderRadius}});
  const periodShapes=[...(timetable?.querySelectorAll('.period-no')||[])].map(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return{clip:s.clipPath,width:r.width,height:r.height,radius:s.borderRadius}});
  const items=[...(feed?.querySelectorAll('[data-flow-exam-item]')||[])].map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{kind:node.className,top:r.top,bottom:r.bottom,height:r.height,radius:s.borderRadius,title:node.querySelector('h3,.flow-exam-row-copy strong')?.textContent||'',detail:node.querySelector('p,.flow-exam-row-copy small')?.textContent||''}});
  const actions=[...document.querySelectorAll('#todayView .timetable-actions button')].filter(visible).map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{width:r.width,height:r.height,radius:s.borderRadius,text:node.textContent.trim()}});
  const meal=document.querySelector('#todayView .meal-card'),upcoming=document.querySelector('#todayView .upcoming-card'),oldEvents=document.querySelector('#eventList'),lens=document.querySelector('.mobile-bottom-nav>.flow-refraction-copy-lens');
  return{
    topbarMode:document.documentElement.dataset.flowTodayTopbar,android:document.documentElement.dataset.flowAndroidStableGlass,
    hero:box(hero),school:{box:box(school),display:school?getComputedStyle(school).display:null,text:school?.textContent?.replace(/\s+/g,' ').trim()||''},
    dock:{box:box(dock),display:dock?getComputedStyle(dock).display:null,days:dateDays,picker:document.querySelector('#datePicker')?.value||''},dayStrip:document.querySelector('#dayStrip')?getComputedStyle(document.querySelector('#dayStrip')).display:null,
    times:[...(timetable?.querySelectorAll('.flow-period-time')||[])].map(node=>node.textContent),current:rows.filter(node=>node.classList.contains('flow-period-current')).map(node=>node.dataset.period),rowRects,periodShapes,actions,
    exams:{visible:Number(feed?.dataset.flowExamVisible||0),total:Number(feed?.dataset.flowExamTotal||0),exhausted:feed?.dataset.flowExamExhausted||'false',items,text:feed?.textContent||'',oldDisplay:oldEvents?getComputedStyle(oldEvents).display:null},
    utilities:{meal:box(meal),upcoming:box(upcoming)},lens:lens?getComputedStyle(lens).display:null,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,scrollHeight:document.documentElement.scrollHeight
  };
})}
function assertSquircle(shape,label){const radius=parseFloat(shape.radius)||0,short=Math.min(shape.width,shape.height);assert(radius>=8&&radius<short/2-1,`${label} is not a squircle ${JSON.stringify(shape)}`)}
function assertBase(state,{dateCount,tabletUtilities=false}={}){
  assert(state.topbarMode==='ready',`Today date deck mode missing ${state.topbarMode}`);
  assert((state.hero?.height||0)<=1,`old blue School hero is still visible ${JSON.stringify(state.hero)}`);
  assert(state.school.display!=='none'&&state.school.box?.height>=44&&state.school.text.includes('정동고등학교')&&state.school.text.includes('2학년 6반'),`compact School selector missing ${JSON.stringify(state.school)}`);
  assert(state.dock.display!=='none'&&state.dock.box?.width>=180&&state.dock.days.length===dateCount,`date deck density incorrect ${JSON.stringify(state.dock)}`);
  const active=state.dock.days.find(day=>day.active==='true'),near=state.dock.days.find(day=>day.offset==='1')||state.dock.days.find(day=>day.offset==='-1');assert(active&&near&&active.height>=near.height+5,`selected date is not magnified ${JSON.stringify(state.dock.days)}`);assertSquircle(active,'active date');
  assert(state.dayStrip==='none',`redundant weekday strip is still visible ${state.dayStrip}`);
  assert(state.times.length===7&&state.times.every(text=>/^\d{2}:\d{2}–\d{2}:\d{2}/.test(text)),`period times missing ${JSON.stringify(state.times)}`);
  assert(state.current.length===1&&state.current[0]==='2',`current period highlight incorrect ${JSON.stringify(state.current)}`);
  assert(state.rowRects.length===7&&state.rowRects.every((row,index)=>index===0||row.top-state.rowRects[index-1].bottom>=5),`timetable cells are visually merged ${JSON.stringify(state.rowRects)}`);
  assert(state.rowRects.every(row=>row.bg!=='transparent'&&row.bg!=='rgba(0, 0, 0, 0)'&&row.shadow!=='none'),`timetable cells lost independent surfaces ${JSON.stringify(state.rowRects)}`);
  assert(state.periodShapes.every(item=>String(item.clip||'none')==='none'&&Math.abs(item.width-item.height)<=1),`period badge circle clipping returned ${JSON.stringify(state.periodShapes)}`);state.periodShapes.forEach((shape,index)=>assertSquircle(shape,`period ${index+1}`));
  state.actions.forEach((shape,index)=>assertSquircle(shape,`toolbar control ${index+1}`));
  assert(state.exams.visible===3&&state.exams.items.length===3,`initial exam feed must show exactly three ${JSON.stringify(state.exams)}`);
  assert(state.exams.oldDisplay==='none',`legacy overlapping exam stack remained visible ${state.exams.oldDisplay}`);
  assert(!state.exams.text.includes('토요휴업일'),`holiday leaked into exam feed ${state.exams.text}`);
  assert(state.exams.items[0].kind.includes('flow-exam-feature-v3')&&state.exams.items[0].height>=state.exams.items[1].height+30,`first exam is not the detailed hero ${JSON.stringify(state.exams.items)}`);
  assert(state.exams.items[1].top-state.exams.items[0].bottom>=7&&state.exams.items[2].top-state.exams.items[1].bottom>=7,`first three exams overlap ${JSON.stringify(state.exams.items)}`);
  assert(state.overflow<=1,`horizontal overflow ${state.overflow}`);
  if(tabletUtilities){const{meal,upcoming}=state.utilities;assert(meal&&upcoming&&Math.abs(meal.top-upcoming.top)<=3&&meal.right<=upcoming.left-10&&meal.width>=250&&upcoming.width>=250,`tablet meal/exam row is not balanced ${JSON.stringify(state.utilities)}`)}
}
async function dragDate(page,dx){
  const dock=page.locator('#flowTodayDateDock'),picker=page.locator('#datePicker'),before=await picker.inputValue(),box=await dock.boundingBox();assert(box,'date deck geometry missing');const x=box.x+box.width/2,y=box.y+Math.min(40,box.height/2);
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y,{steps:8});const during=await picker.inputValue();assert(during===before,`date committed before gesture release ${before} -> ${during}`);await page.mouse.up();await page.waitForFunction(previous=>document.querySelector('#datePicker')?.value!==previous,before,{timeout:3000});return{before,after:await picker.inputValue()};
}
async function revealToEnd(page){
  const feed=page.locator('#flowExamFeedV3');let rounds=0;
  while(rounds<12){
    const before=Number(await feed.getAttribute('data-flow-exam-visible')||0),done=(await feed.getAttribute('data-flow-exam-exhausted'))==='true';if(done)break;
    await page.evaluate(()=>window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
    await page.waitForFunction(previous=>{const feed=document.querySelector('#flowExamFeedV3');return Number(feed?.dataset.flowExamVisible||0)>previous||feed?.dataset.flowExamExhausted==='true'},before,{timeout:5000});
    await page.waitForTimeout(120);rounds++;
  }
  return{visible:Number(await feed.getAttribute('data-flow-exam-visible')||0),total:Number(await feed.getAttribute('data-flow-exam-total')||0),exhausted:(await feed.getAttribute('data-flow-exam-exhausted'))==='true',rounds};
}

const browser=await chromium.launch({headless:true});
const portraitContext=await browser.newContext({viewport:{width:768,height:1024},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',userAgent:'Mozilla/5.0 (Linux; Android 14; SM-T735N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'});
const portrait=await portraitContext.newPage(),portraitErrors=await prepare(portrait),initial=await readState(portrait);assertBase(initial,{dateCount:7,tabletUtilities:true});assert(initial.android==='true'&&(initial.lens===null||initial.lens==='none'),`Android Optical stability regressed ${JSON.stringify({android:initial.android,lens:initial.lens})}`);assert(!portraitErrors.length,`portrait browser errors ${JSON.stringify(portraitErrors)}`);await portrait.screenshot({path:`${OUT}/portrait-initial.png`,fullPage:true});
await portrait.waitForTimeout(5000);const stable=await readState(portrait);assertBase(stable,{dateCount:7,tabletUtilities:true});assert(stable.exams.visible===3&&JSON.stringify(stable.exams.items.map(item=>item.title))===JSON.stringify(initial.exams.items.map(item=>item.title)),`exam feed changed before user scroll`);await portrait.screenshot({path:`${OUT}/portrait-after-5s.png`,fullPage:true});
const forward=await dragDate(portrait,-66);assert(forward.after!==forward.before,`left gesture did not advance date`);const back=await dragDate(portrait,66);assert(back.after===forward.before,`right gesture did not return one day ${JSON.stringify({forward,back})}`);await portrait.waitForFunction(value=>document.querySelector('#datePicker')?.value===value,forward.before,{timeout:3000});await portrait.waitForFunction(()=>document.querySelector('#flowExamFeedV3')?.querySelectorAll('[data-flow-exam-item]').length===3,{timeout:5000});
const progressive=await revealToEnd(portrait);assert(progressive.exhausted&&progressive.visible===progressive.total&&progressive.total>=7,`progressive exam feed did not reach the academic-year end ${JSON.stringify(progressive)}`);assert(requestedDashboardDates.some(date=>String(date).startsWith('202610'))&&requestedDashboardDates.some(date=>String(date).startsWith('202702')),`future exam months were not lazily fetched ${JSON.stringify(requestedDashboardDates)}`);const expanded=await readState(portrait);assert(expanded.exams.items.length===progressive.total&&expanded.exams.items[0].kind.includes('flow-exam-feature-v3'),`expanded feed hierarchy broke ${JSON.stringify(expanded.exams)}`);await portrait.screenshot({path:`${OUT}/portrait-expanded-exams.png`,fullPage:true});await portraitContext.close();

const landscapeContext=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',userAgent:'Mozilla/5.0 (Linux; Android 14; SM-T735N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'}),landscape=await landscapeContext.newPage(),landscapeErrors=await prepare(landscape),landscapeState=await readState(landscape);assertBase(landscapeState,{dateCount:7,tabletUtilities:true});assert(landscapeState.dock.box?.width>=500,`landscape date deck collapsed back to tiny control ${JSON.stringify(landscapeState.dock.box)}`);assert(!landscapeErrors.length,`landscape browser errors ${JSON.stringify(landscapeErrors)}`);await landscape.screenshot({path:`${OUT}/landscape.png`,fullPage:true});await landscapeContext.close();

const phoneContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',userAgent:'Mozilla/5.0 (Linux; Android 14; SM-S931N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36'}),phone=await phoneContext.newPage(),phoneErrors=await prepare(phone),phoneState=await readState(phone);assertBase(phoneState,{dateCount:3});assert(phoneState.dock.box?.width>=120,`phone date deck disappeared ${JSON.stringify(phoneState.dock.box)}`);assert(!phoneErrors.length,`phone browser errors ${JSON.stringify(phoneErrors)}`);await phone.screenshot({path:`${OUT}/phone.png`,fullPage:false});await phoneContext.close();

await fs.writeFile(`${OUT}/report.json`,JSON.stringify({initial,stable,forward,back,progressive,expanded,landscapeState,phoneState,requestedDashboardDates},null,2));
await browser.close();
console.log(JSON.stringify({status:'PASS',initialExams:initial.exams.items.map(item=>item.title),progressive,requestedDashboardDates},null,2));
