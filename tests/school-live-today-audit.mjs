import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-live-today-audit';
await fs.mkdir(OUT,{recursive:true});
const pad=v=>String(v).padStart(2,'0');
const kst=new Date(Date.now()+9*60*60*1000);
const selected=`${kst.getUTCFullYear()}${pad(kst.getUTCMonth()+1)}${pad(kst.getUTCDate())}`;
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const dashboard={school:profile.school,selected,from:selected,to:selected,timetable:Array.from({length:7},(_,i)=>({date:selected,period:i+1,subject:['국어','문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][i]})),meals:[{date:selected,type:'중식',dishes:['현미밥','된장국'],calories:'812 Kcal'}],events:[{date:'20260902',name:'전국연합학력평가',content:'1,2학년 전국연합학력평가'},{date:'20260905',name:'토요휴업일',content:''},{date:'20260909',name:'영어듣기평가',content:'2학년 영어듣기평가'},{date:'20260912',name:'토요휴업일',content:''},{date:'20260915',name:'2학기 중간고사',content:'2학년 중간고사'}],scheduleMeta:{mode:'fixture',count:5}};
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function assert(value,message){if(!value)throw new Error(message)}
async function prepare(page){
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});if(action==='place')return json(route,{provider:'fixture',place:{id:'school',name:profile.school.name,address:profile.school.address}});return json(route,{})});
  await page.addInitScript(({profile})=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','optical');localStorage.setItem('flow-school-transit-lab-v1','off');const now=new Date(),start=new Date(now.getTime()-65*60000),pad=v=>String(v).padStart(2,'0');localStorage.setItem('flow-school-bell-v1',JSON.stringify({start:`${pad(start.getHours())}:${pad(start.getMinutes())}`,lesson:50,break:10,meal:'12:20',mealEnd:'13:10'}))},{profile});
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:15000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolUiStyles==='ready');
  await page.waitForFunction(()=>document.querySelector('#timetable')?.querySelectorAll('.flow-period-time').length===7,{timeout:10000});
  await page.waitForFunction(()=>document.querySelector('#eventList')?.querySelectorAll(':scope > .flow-exam-card').length===3,{timeout:10000});
  await page.waitForTimeout(500);return errors;
}
async function readState(page){return page.evaluate(()=>{
  const box=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
  const timetable=document.querySelector('#timetable'),eventList=document.querySelector('#eventList'),heroPanel=document.querySelector('#schoolHero');
  const compactSchool=document.querySelector('#mobileSchoolBtn'),desktopSchool=document.querySelector('#schoolNameTop'),dock=document.querySelector('#flowTodayDateDock'),topbar=document.querySelector('.mobile-topbar');
  const rows=[...(timetable?.querySelectorAll('.period-button')||[])],meal=document.querySelector('#todayView .meal-card'),upcoming=document.querySelector('#todayView .upcoming-card'),rightStack=document.querySelector('#todayView .right-stack');
  const rowRects=rows.map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{top:r.top,bottom:r.bottom,height:r.height,bg:s.backgroundColor,shadow:s.boxShadow,radius:s.borderRadius}});
  const examCards=[...(eventList?.querySelectorAll(':scope > .flow-exam-card')||[])].map(card=>{const r=card.getBoundingClientRect(),s=getComputedStyle(card);return{depth:card.dataset.depth,top:r.top,bottom:r.bottom,height:r.height,opacity:s.opacity,transform:s.transform}});
  const before=eventList?getComputedStyle(eventList,'::before'):null,dockRect=box(dock),heroRect=box(heroPanel),schoolRect=box(compactSchool),stackStyle=rightStack?getComputedStyle(rightStack):null;
  return{
    android:document.documentElement.dataset.flowAndroidStableGlass,topbarMode:document.documentElement.dataset.flowTodayTopbar,
    hero:{height:heroRect?.height||0,visible:!!heroRect&&heroRect.height>1},
    compactSchool:{text:[compactSchool?.querySelector('span')?.textContent,compactSchool?.querySelector('small')?.textContent].filter(Boolean).join(' · '),display:compactSchool?getComputedStyle(compactSchool).display:null,width:schoolRect?.width||0,height:schoolRect?.height||0},desktopSchool:desktopSchool?.textContent||'',
    dateDock:{display:dock?getComputedStyle(dock).display:null,width:dockRect?.width||0,height:dockRect?.height||0,insideTopbar:!!dock&&dock.parentElement===topbar,days:[...(dock?.querySelectorAll('.flow-date-day')||[])].map(node=>({iso:node.dataset.iso,offset:node.dataset.offset,active:node.dataset.active,text:node.textContent.trim()})),picker:document.querySelector('#datePicker')?.value||''},
    times:[...(timetable?.querySelectorAll('.flow-period-time')||[])].map(node=>node.textContent),current:[...(timetable?.querySelectorAll('.flow-period-current')||[])].map(node=>node.dataset.period),
    periodShapes:[...(timetable?.querySelectorAll('.period-no')||[])].map(node=>{const s=getComputedStyle(node),r=node.getBoundingClientRect();return{clip:s.clipPath,width:r.width,height:r.height,radius:s.borderRadius}}),rowRects,
    examTitle:document.querySelector('.upcoming-card .card-heading h2')?.textContent,exams:[...(eventList?.querySelectorAll(':scope > .flow-exam-card h3')||[])].map(node=>node.textContent),examText:eventList?.textContent||'',visible:eventList?.dataset.flowExamVisible,count:eventList?.dataset.flowExamCount,examCards,
    peek:before?{display:before.display,opacity:before.opacity,height:before.height}:{display:'none',opacity:'0',height:'0px'},
    utilities:{display:stackStyle?.display||'',columns:stackStyle?.gridTemplateColumns||'',stack:box(rightStack),meal:box(meal),upcoming:box(upcoming)},
    lens:document.querySelector('.mobile-bottom-nav>.flow-refraction-copy-lens')?getComputedStyle(document.querySelector('.mobile-bottom-nav>.flow-refraction-copy-lens')).display:null,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
  };
})}
function assertUnifiedState(state,{portrait=false,expectNearest=true,tabletUtilities=false}={}){
  assert(state.times.length===7&&state.times.every(text=>/^\d{2}:\d{2}–\d{2}:\d{2}/.test(text)),`period times missing ${JSON.stringify(state.times)}`);
  assert(state.current.length===1&&state.current[0]==='2',`current period highlight incorrect ${JSON.stringify(state.current)}`);
  assert(state.periodShapes.every(item=>String(item.clip||'none')==='none'&&Math.abs(item.width-item.height)<=1&&parseFloat(item.radius)>=9&&parseFloat(item.radius)<item.width/2),`period badges are not squircle cells ${JSON.stringify(state.periodShapes)}`);
  assert(state.rowRects.length===7&&state.rowRects.every((row,index)=>index===0||row.top-state.rowRects[index-1].bottom>=5),`timetable subjects are visually merged ${JSON.stringify(state.rowRects)}`);
  assert(state.rowRects.every(row=>row.bg!=='rgba(0, 0, 0, 0)'&&row.bg!=='transparent'&&row.shadow!=='none'),`timetable cells lost separated surfaces ${JSON.stringify(state.rowRects)}`);
  assert(state.examTitle==='다가오는 시험'&&state.exams.length===3&&state.visible==='3',`three-exam contract missing ${JSON.stringify(state)}`);
  assert(!state.examText.includes('토요휴업일'),`holiday leaked into exam stack ${state.examText}`);if(expectNearest)assert(state.exams[0].includes('전국연합'),`nearest exam missing ${JSON.stringify(state.exams)}`);
  assert(state.examCards.length===3&&state.examCards[0].height>state.examCards[1].height+25&&Math.abs(state.examCards[1].height-state.examCards[2].height)<=1,`exam hierarchy is not hero + two normal ${JSON.stringify(state.examCards)}`);
  assert(state.examCards[1].top-state.examCards[0].bottom>=8&&state.examCards[2].top-state.examCards[1].bottom>=8,`three visible exams overlap ${JSON.stringify(state.examCards)}`);
  assert(Number(state.count)>=4&&state.peek.display!=='none'&&parseFloat(state.peek.opacity)>0&&parseFloat(state.peek.height)<=24,`rear stack peek invalid ${JSON.stringify(state.peek)}`);
  if(tabletUtilities){const u=state.utilities;assert(u.display==='grid'&&u.meal&&u.upcoming&&Math.abs(u.meal.top-u.upcoming.top)<=3&&u.meal.right<=u.upcoming.left-8&&u.meal.width>=250&&u.upcoming.width>=250,`tablet meal/exam utilities are not a clean two-column row ${JSON.stringify(u)}`)}
  assert(state.overflow<=1,`horizontal overflow ${state.overflow}`);
  if(portrait){assert(state.topbarMode==='ready'&&state.hero.height<=1&&!state.hero.visible,`portrait still has oversized School hero ${JSON.stringify(state.hero)}`);assert(state.compactSchool.text.includes('정동고등학교')&&state.compactSchool.text.includes('2학년 6반')&&state.compactSchool.display!=='none'&&state.compactSchool.height>=44,`compact school selector missing ${JSON.stringify(state.compactSchool)}`);assert(state.dateDock.display!=='none'&&state.dateDock.insideTopbar&&state.dateDock.days.length===5&&state.dateDock.days.filter(day=>day.active==='true').length===1,`gesture date rail missing ${JSON.stringify(state.dateDock)}`);assert(state.android==='true'&&(state.lens===null||state.lens==='none'),`Android stable glass contract failed ${JSON.stringify({android:state.android,lens:state.lens})}`)}
}
async function dragDate(page,dx){const dock=page.locator('#flowTodayDateDock');const box=await dock.boundingBox();assert(box,'date dock geometry missing');await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2,{steps:9});await page.mouse.up();await page.waitForTimeout(360);return page.locator('#datePicker').inputValue()}

const browser=await chromium.launch({headless:true});
const portraitContext=await browser.newContext({viewport:{width:768,height:1024},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',userAgent:'Mozilla/5.0 (Linux; Android 14; SM-T735N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'});
const portrait=await portraitContext.newPage(),portraitErrors=await prepare(portrait);const state=await readState(portrait);assertUnifiedState(state,{portrait:true,tabletUtilities:true});assert(!portraitErrors.length,`portrait browser errors ${JSON.stringify(portraitErrors)}`);await portrait.screenshot({path:`${OUT}/portrait-initial.png`,fullPage:true});
await portrait.waitForTimeout(5000);const portraitStable=await readState(portrait);assertUnifiedState(portraitStable,{portrait:true,tabletUtilities:true});assert(JSON.stringify(portraitStable.exams)===JSON.stringify(state.exams),`exam stack changed without interaction after 5s`);await portrait.screenshot({path:`${OUT}/portrait-after-5s.png`,fullPage:true});
const originalDate=await portrait.locator('#datePicker').inputValue(),nextDate=await dragDate(portrait,-78);assert(nextDate!==originalDate,`left date gesture did not advance`);const returnedDate=await dragDate(portrait,78);assert(returnedDate===originalDate,`right date gesture did not magnet-snap back`);
await portrait.waitForFunction(value=>document.querySelector('#datePicker')?.value===value,originalDate,{timeout:5000});
await portrait.waitForFunction(()=>document.querySelector('#eventList')?.querySelectorAll(':scope > .flow-exam-card').length===3,{timeout:10000});
await portrait.waitForFunction(()=>{const card=document.querySelector('#eventList > .flow-exam-card[data-depth="0"]');return !!card&&card.getBoundingClientRect().height>0},{timeout:5000});
const stack=portrait.locator('#eventList').first();await stack.scrollIntoViewIfNeeded();await portrait.waitForTimeout(80);const stackBox=await stack.boundingBox();assert(stackBox,'exam stack missing geometry');
const stackGeometry=()=>stack.evaluate(el=>[...el.querySelectorAll(':scope > .flow-exam-card')].map(card=>({depth:card.dataset.depth,top:card.getBoundingClientRect().top,transition:getComputedStyle(card).transitionDuration,transform:getComputedStyle(card).transform})));
const beforeDrag=await stackGeometry();await portrait.mouse.move(stackBox.x+stackBox.width/2,stackBox.y+70);await portrait.mouse.down();await portrait.mouse.move(stackBox.x+stackBox.width/2,stackBox.y-10,{steps:8});const duringDrag=await stackGeometry();
assert(duringDrag.length===3&&duringDrag[0].top<beforeDrag[0].top-20&&duringDrag[1].top<beforeDrag[1].top-40&&duringDrag[2].top<beforeDrag[2].top-40,`exam stack did not follow drag ${JSON.stringify({beforeDrag,duringDrag})}`);assert(duringDrag.every(item=>String(item.transition).split(',').every(value=>parseFloat(value)===0)),`drag still has transition lag ${JSON.stringify(duringDrag)}`);await portrait.mouse.up();await portrait.waitForTimeout(320);
const after=await portrait.locator('#eventList > .flow-exam-card[data-depth="0"] h3').textContent();assert(after&&after!==state.exams[0],`exam stack did not magnet-snap ${after}`);await portrait.waitForTimeout(1000);const snappedStable=await readState(portrait);assertUnifiedState(snappedStable,{portrait:true,expectNearest:false,tabletUtilities:true});assert(snappedStable.exams[0]===after,`snapped exam did not remain stable`);await portrait.screenshot({path:`${OUT}/portrait-after-drag.png`,fullPage:true});await portraitContext.close();

const landscapeContext=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',userAgent:'Mozilla/5.0 (Linux; Android 14; SM-T735N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'}),landscape=await landscapeContext.newPage();const landscapeErrors=await prepare(landscape),landscapeState=await readState(landscape);assertUnifiedState(landscapeState);assert(landscapeState.hero.height<=120,`landscape retained oversized School hero ${JSON.stringify(landscapeState.hero)}`);assert(landscapeState.desktopSchool==='정동고등학교'||landscapeState.compactSchool.text.includes('정동고등학교'),`landscape School identity missing`);assert(!landscapeErrors.length,`landscape browser errors ${JSON.stringify(landscapeErrors)}`);await landscape.screenshot({path:`${OUT}/landscape.png`,fullPage:true});
await fs.writeFile(`${OUT}/report.json`,JSON.stringify({state,portraitStable,originalDate,nextDate,returnedDate,beforeDrag,duringDrag,after,snappedStable,landscapeState,portraitErrors,landscapeErrors},null,2));await landscapeContext.close();await browser.close();console.log(JSON.stringify({ok:true,currentPeriod:state.current[0],exams:state.exams,after,dateGesture:{originalDate,nextDate,returnedDate},tabletUtilities:state.utilities,landscapeHeroHeight:landscapeState.hero.height},null,2));
