import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-live-today-audit';
await fs.mkdir(OUT,{recursive:true});
const pad=v=>String(v).padStart(2,'0');
const kst=new Date(Date.now()+9*60*60*1000);
const selected=`${kst.getUTCFullYear()}${pad(kst.getUTCMonth()+1)}${pad(kst.getUTCDate())}`;
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const monthEvents={
  '202609':[
    {date:'20260902',name:'9월 전국연합학력평가',content:'1·2학년 전국연합학력평가',grade2:'Y'},
    {date:'20260909',name:'2학기 전국 영어듣기능력평가',content:'2학년 영어듣기능력평가',grade2:'Y'},
    {date:'20260915',name:'2학기 중간고사 1일차',content:'국어·수학',grade2:'Y'},
    {date:'20260916',name:'2학기 중간고사 2일차',content:'영어·과학',grade2:'Y'},
    {date:'20260917',name:'2학기 중간고사 3일차',content:'사회·정보',grade2:'Y'},
    {date:'20260923',name:'교과 수행평가',content:'수행평가 주간',grade2:'Y'},
  ],
  '202610':[{date:'20261020',name:'10월 전국연합학력평가',content:'경기도교육청 주관',grade2:'Y'}],
  '202611':[{date:'20261124',name:'2학기 기말고사',content:'2학년 기말고사',grade2:'Y'}],
  '202612':[{date:'20261215',name:'학업성취도평가',content:'2학년 학업성취도평가',grade2:'Y'}],
  '202701':[{date:'20270122',name:'겨울방학 평가',content:'방학 중 평가',grade2:'Y'}],
  '202702':[{date:'20270205',name:'학년말 평가',content:'2학년 학년말 평가',grade2:'Y'}],
};
function assert(value,message){if(!value)throw new Error(message)}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function dashboard(date=selected){const key=String(date).replace(/\D/g,'').slice(0,8)||selected,month=key.slice(0,6);return{school:profile.school,selected:key,from:key,to:key,timetable:Array.from({length:7},(_,i)=>({date:key,period:i+1,subject:['문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육','자율'][i]})),meals:[{date:key,type:'중식',dishes:['현미밥','된장국','제육볶음'],calories:'812 Kcal'}],events:monthEvents[month]||[],scheduleMeta:{mode:'fixture',count:(monthEvents[month]||[]).length}}}
async function fixture(page){
  const errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await page.route('**/functions/v1/school-data*',route=>{const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard(url.searchParams.get('date')||selected));if(action==='media')return json(route,{media:{}});if(action==='place')return json(route,{provider:'fixture',place:{id:'school',name:profile.school.name,address:profile.school.address}});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});return json(route,{})});
  await page.route('**/functions/v1/school-logo*',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({profile})=>{
    localStorage.clear();sessionStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','standard');localStorage.setItem('flow-school-transit-lab-v1','off');
    const now=new Date(),minuteOfDay=now.getHours()*60+now.getMinutes(),early=minuteOfDay<65,pad=value=>String(value).padStart(2,'0');
    const start=early?new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0):new Date(now.getTime()-65*60000),lesson=early?65:50,breakMinutes=early?0:10,expected=early?'1':'2';
    localStorage.setItem('flow-school-live-audit-expected-period',expected);localStorage.setItem('flow-school-bell-v1',JSON.stringify({start:`${pad(start.getHours())}:${pad(start.getMinutes())}`,lesson,break:breakMinutes,meal:'12:20',mealEnd:'13:10'}));
  },{profile});return errors;
}
async function state(page){return page.evaluate(()=>{
  const box=node=>{if(!node)return null;const r=node.getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
  const visible=node=>{if(!node)return false;const s=getComputedStyle(node),r=node.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
  const timetable=document.querySelector('#timetable'),rows=[...(timetable?.querySelectorAll('.period-button')||[])],dock=document.querySelector('#flowTodayDateDock'),hero=document.querySelector('#schoolHero'),school=document.querySelector('#mobileSchoolBtn'),toggle=document.querySelector('.timetable-mode-toggle'),today=toggle?.querySelector('[data-timetable-mode="today"]'),week=toggle?.querySelector('[data-timetable-mode="week"]'),deck=document.querySelector('#flowExamDeckV5'),stage=deck?.querySelector('.flow-exam-stage-v5'),sr=stage?.getBoundingClientRect();
  const cards=[...(stage?.querySelectorAll('.flow-exam-card-v5')||[])].map(node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node),visibleHeight=Math.max(0,Math.min(r.bottom,sr?.bottom||r.bottom)-Math.max(r.top,sr?.top||r.top));return{index:Number(node.dataset.examIndex),active:node.hasAttribute('data-active'),height:r.height,visible:visibleHeight,display:s.display,opacity:Number(s.opacity||1)}});
  return{surface:document.documentElement.dataset.flowSchoolSurface||'',runtime:document.documentElement.dataset.flowSchoolRuntimeV6||'',topbar:document.documentElement.dataset.flowTodayTopbar||'',mobileV5:document.documentElement.dataset.flowSchoolMobileV5||'',hero:box(hero),school:{box:box(school),visible:visible(school),text:school?.textContent?.replace(/\s+/g,' ').trim()||''},dock:{box:box(dock),visible:visible(dock),days:dock?.querySelectorAll('.flow-date-day-v5').length||0},dayStrip:document.querySelector('#dayStrip')?getComputedStyle(document.querySelector('#dayStrip')).display:null,times:[...(timetable?.querySelectorAll('.flow-period-time')||[])].map(node=>node.textContent),current:rows.filter(node=>node.classList.contains('flow-period-current')).map(node=>node.dataset.period),expected:localStorage.getItem('flow-school-live-audit-expected-period')||'',toggle:{today:box(today),week:box(week),weekRoute:week?.getAttribute('data-view')||'',todayPressed:today?.getAttribute('aria-pressed')||'',weekPressed:week?.getAttribute('aria-pressed')||''},mode:{weekly:document.body.classList.contains('flow-inline-week-active'),dailyDisplay:timetable?getComputedStyle(timetable).display:'',weekDisplay:document.querySelector('#inlineWeekTimetable')?getComputedStyle(document.querySelector('#inlineWeekTimetable')).display:'',legacyWeekVisible:visible(document.querySelector('#weekView')),path:location.pathname},deck:{box:box(deck),cards}};
})}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light',userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140 Mobile Safari/537.36'});
const page=await context.newPage(),errors=await fixture(page);page.setDefaultTimeout(12000);
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:20000});await page.locator('#dashboard:not(.hidden)').waitFor();
await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready'&&document.documentElement.dataset.flowSchoolRuntimeV6==='ready'&&document.documentElement.dataset.flowSchoolMobileV5==='ready');
await page.waitForFunction(()=>document.querySelector('#flowTodayDateDock')&&document.querySelectorAll('#flowTodayDateDock .flow-date-day-v5').length>=60&&document.querySelector('#flowExamDeckV5')&&document.querySelector('.timetable-mode-toggle [data-timetable-mode="week"]'));
await page.waitForTimeout(450);
let s=await state(page);
assert(s.surface==='ready'&&s.runtime==='ready'&&s.topbar==='ready'&&s.mobileV5==='ready',`School runtime not ready ${JSON.stringify(s)}`);
assert((s.hero?.height||0)<=1,`legacy School hero is visible ${JSON.stringify(s.hero)}`);
assert(s.school.visible&&s.school.box?.height>=44&&s.school.text.includes('정동고등학교')&&s.school.text.includes('2학년 6반'),`compact School selector missing ${JSON.stringify(s.school)}`);
assert(s.dock.visible&&s.dock.days>=60&&s.dock.box?.height<=60,`kinetic date deck missing ${JSON.stringify(s.dock)}`);
assert(s.dayStrip==='none',`duplicate day strip visible ${s.dayStrip}`);
assert(s.times.length===7&&s.times.every(text=>/^\d{2}:\d{2}–\d{2}:\d{2}/.test(text)),`period times missing ${JSON.stringify(s.times)}`);
assert(s.current.length===1&&s.current[0]===s.expected,`current period highlight incorrect ${JSON.stringify({current:s.current,expected:s.expected})}`);
assert(s.toggle.today&&s.toggle.week&&Math.abs(s.toggle.today.top-s.toggle.week.top)<=.75&&Math.abs(s.toggle.today.height-s.toggle.week.height)<=.75,`Today/Week controls are physically misaligned ${JSON.stringify(s.toggle)}`);
assert(!s.toggle.weekRoute,`inline Week still carries legacy route binding ${JSON.stringify(s.toggle)}`);
const shown=s.deck.cards.filter(card=>card.display!=='none'&&card.visible>0),active=shown.filter(card=>card.active),compact=shown.filter(card=>!card.active&&card.visible>=44),peek=shown.filter(card=>!card.active&&card.visible>0&&card.visible<24);
assert(s.deck.box?.height>0&&active.length===1&&active[0].index===0,`first exam is not active detailed card ${JSON.stringify(s.deck)}`);
assert(compact.length>=3&&peek.length>=1&&active[0].height>=compact[0].height+45,`exam deck hierarchy lost ${JSON.stringify({active,compact,peek})}`);
await page.screenshot({path:`${OUT}/phone-today.png`,fullPage:false});

await page.locator('.timetable-mode-toggle [data-timetable-mode="week"]').click();await page.waitForFunction(()=>document.body.classList.contains('flow-inline-week-active'));await page.waitForTimeout(80);s=await state(page);
assert(s.mode.weekly&&s.mode.dailyDisplay==='none'&&s.mode.weekDisplay!=='none'&&!s.mode.legacyWeekVisible&&s.mode.path!=='/week',`Today and Week are not mutually exclusive ${JSON.stringify(s.mode)}`);
assert(s.toggle.weekPressed==='true'&&s.toggle.todayPressed==='false',`Week pressed state incorrect ${JSON.stringify(s.toggle)}`);
await page.screenshot({path:`${OUT}/phone-week.png`,fullPage:false});

await page.locator('.timetable-mode-toggle [data-timetable-mode="today"]').click();await page.waitForFunction(()=>!document.body.classList.contains('flow-inline-week-active'));await page.waitForTimeout(80);s=await state(page);
assert(!s.mode.weekly&&s.mode.dailyDisplay!=='none'&&s.mode.weekDisplay==='none'&&!s.mode.legacyWeekVisible,`Today mode did not restore exclusively ${JSON.stringify(s.mode)}`);
assert(s.toggle.todayPressed==='true'&&s.toggle.weekPressed==='false',`Today pressed state incorrect ${JSON.stringify(s.toggle)}`);

await page.locator('#flowExamDeckV5').evaluate(node=>node.scrollTo({top:84,behavior:'auto'}));await page.waitForTimeout(160);s=await state(page);const promoted=s.deck.cards.find(card=>card.active);
assert(promoted?.index===1,`exam deck did not promote the second card smoothly ${JSON.stringify(s.deck)}`);
assert(errors.length===0,`School live Today browser errors ${JSON.stringify(errors)}`);
await context.close();await browser.close();
console.log(JSON.stringify({ok:true,todayWeek:'exclusive + aligned',examDeck:'v5 detailed/compact/peek + promotion',boot:'surface ready before geometry checks'},null,2));