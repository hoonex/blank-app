import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-settings-shell-parity-audit';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',location:'대구광역시',jurisdiction:'대구광역시동부교육지원청',type:'사립',postalCode:'41063',address:'대구광역시 동구 반야월북로 199',phone:'053-000-0000',homepage:'https://jungdong.dge.hs.kr'};
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
const rows=date=>['문학','영어Ⅱ','선택과목','선택과목','스포츠 생활2','선택과목','진로활동'].map((subject,i)=>({date,period:i+1,subject,grade:'2',className:'6'}));
function dashboard(selected){return{school:SCHOOL,selected,from:selected,to:selected,timetable:rows(selected),meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}}}
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function fixtures(page){
  await page.route('**/functions/v1/school-data**',async route=>{
    const u=new URL(route.request().url()),action=u.searchParams.get('action')||'search';
    if(action==='search')return json(route,{schools:[SCHOOL]});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6','7','8']});
    if(action==='media')return json(route,{media:{hero:'',logo:'',logoSource:'fixture'},homepage:SCHOOL.homepage});
    if(action==='place')return json(route,{provider:'fixture',place:null});
    if(action==='dashboard')return json(route,dashboard(u.searchParams.get('date')||ymd(new Date())));
    return json(route,{error:`unknown fixture ${action}`},404);
  });
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}
const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
async function shellGeometry(page){return page.evaluate(rect=>{
  const visible=e=>{if(!e)return false;const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0&&r.width>0&&r.height>0};
  const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return{left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height}};
  const top=document.querySelector('.mobile-topbar'),logo=top?.querySelector('.flow-logo'),school=top?.querySelector('.mobile-school-button'),settings=document.querySelector('#flowSchoolSettingsView'),nav=document.querySelector('#bottomNav');
  return{top:r(top),logo:r(logo),school:r(school),settings:r(settings),nav:r(nav),topVisible:visible(top),logoVisible:visible(logo),schoolVisible:visible(school),settingsVisible:visible(settings),settingsPosition:settings?getComputedStyle(settings).position:'',settingsOverflowY:settings?getComputedStyle(settings).overflowY:'',scrollY:window.scrollY,viewport:{width:innerWidth,height:innerHeight}};
},rect.toString())}
function close(a,b,tolerance=1.5){return Math.abs(a-b)<=tolerance}
function assert(condition,message,data){if(!condition)throw new Error(`${message}: ${JSON.stringify(data)}`)}

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
const page=await context.newPage();page.setDefaultTimeout(15000);await fixtures(page);
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.locator('.school-search-panel').waitFor();
await page.locator('#schoolSearch').fill('정동고');await page.locator('#schoolSearchBtn').click();await page.locator('#schoolResults [data-result-index]').first().click();
await page.locator('#setupDialog').waitFor({state:'visible'});await page.locator('#gradeRow [data-grade="2"]').click();await page.locator('#classRow [data-class="6"]').waitFor();await page.locator('#classRow [data-class="6"]').click();await page.locator('#setupSave').click();
await page.locator('#dashboard:not(.hidden)').waitFor();await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolGlobalShell==='v1');

await page.locator('#bottomNav [data-view="schedule"]').click();await page.locator('#scheduleView:not(.hidden)').waitFor();
await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(120);
const schedule=await shellGeometry(page);
assert(schedule.topVisible&&schedule.logoVisible&&schedule.schoolVisible,'Schedule shared topbar is incomplete',schedule);
await page.screenshot({path:`${OUT}/390x844-schedule-shell.png`,fullPage:false,animations:'disabled'});

await page.locator('#mobileSettingsBtn').click();await page.locator('#flowSchoolSettingsView:not(.hidden)').waitFor();
await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(160);
const settings=await shellGeometry(page);
assert(settings.topVisible&&settings.logoVisible&&settings.schoolVisible,'Settings must retain the complete shared topbar',settings);
assert(settings.settingsVisible,'Settings view must be visible',settings);
assert(settings.settingsPosition!=='fixed','Settings must be a normal document-flow destination, not a fixed overlay',settings);
assert(settings.settings.top>=settings.top.bottom-1,'Settings content must begin below the shared topbar instead of covering it',settings);
for(const key of ['top','logo','school']){
  const a=schedule[key],b=settings[key];
  assert(a&&b&&close(a.left,b.left)&&close(a.right,b.right)&&close(a.top,b.top)&&close(a.bottom,b.bottom),`Settings ${key} geometry drifted from Schedule`,{schedule:a,settings:b});
}
assert(settings.nav&&settings.nav.bottom<=settings.viewport.height+1,'Settings bottom nav must stay inside the viewport',settings);
await page.screenshot({path:`${OUT}/390x844-settings-shell.png`,fullPage:false,animations:'disabled'});
await writeFile(`${OUT}/report.json`,JSON.stringify({schedule,settings},null,2));
console.log(JSON.stringify({status:'ok',schedule,settings},null,2));
await context.close();await browser.close();
