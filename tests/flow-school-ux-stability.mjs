import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const BASE = process.env.FLOW_BASE_URL || 'http://127.0.0.1:4173';
const OUT = process.env.FLOW_TEST_OUT || 'flow-ux-stability-audit';
const SCHOOL = {
  officeCode:'D10',officeName:'대구광역시교육청',
  schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',
  location:'대구광역시',highSchoolType:'일반고',type:'사립'
};
const PROFILE = {school:SCHOOL,grade:'2',className:'6'};
const CASES = [
  {name:'phone-portrait',width:390,height:844,mobile:true},
  {name:'phone-landscape',width:844,height:390,mobile:true},
  {name:'tablet-portrait',width:768,height:1024,mobile:false},
  {name:'tablet-landscape',width:1024,height:768,mobile:false},
  {name:'desktop',width:1366,height:768,mobile:false},
  {name:'desktop-wide',width:1920,height:1080,mobile:false}
];
const fail = (name,message) => { throw new Error(name + ': ' + message); };
const json = (route,body) => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
function dataFor(url) {
  const today = url.searchParams.get('date') || '20261019';
  const row = Array.from({length:7},(_,i)=>({date:today,period:i+1,subject:'문학',grade:'2',className:'6'}));
  return {
    school:SCHOOL,selected:today,from:today,to:today,timetable:row,
    meals:[{date:today,type:'중식',dishes:['현미밥'],calories:'700 Kcal'}],
    events:[],scheduleMeta:{mode:'fixture',count:0}
  };
}
async function installFixtures(page){
  // Keep local UI tests deterministic when third-party font hosts are unavailable.
  await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({
    status:200,contentType:'text/css',body:''
  }));
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
  return page.route('**/functions/v1/school-data**',route=>{
    const u = new URL(route.request().url());
    const action = u.searchParams.get('action');
    if(action==='dashboard')return json(route,dataFor(u));
    if(action==='media')return json(route,{media:{hero:'',logo:''},homepage:''});
    if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});
    return json(route,{schools:[SCHOOL]});
  });
}
async function shown(page,id){
  await page.waitForFunction(selector=>{
    const el=document.querySelector(selector);
    return Boolean(el&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden'&&getComputedStyle(el).display!=='none');
  },'#'+id,{timeout:10000});
}
async function noOverflow(page,name){
  const geometry=await page.evaluate(()=>({
    width:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth
  }));
  if(geometry.scrollWidth>geometry.width+2)fail(name,JSON.stringify(geometry));
}
await mkdir(OUT,{recursive:true});
const browser = await chromium.launch({
  headless:true,
  ...(process.env.FLOW_BROWSER_EXECUTABLE?{executablePath:process.env.FLOW_BROWSER_EXECUTABLE}:{}),
  args:['--no-sandbox']
});
const errors=[];
try {
  for(const c of CASES){
    const context = await browser.newContext({
      viewport:{width:c.width,height:c.height},isMobile:c.mobile,
      hasTouch:c.mobile,locale:'ko-KR',timezoneId:'Asia/Seoul'
    });
    await context.addInitScript(p=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify(p))},PROFILE);
    const page=await context.newPage();
    page.setDefaultTimeout(11000);
    await installFixtures(page);
    page.on('pageerror',err=>errors.push(c.name+': '+err.message));
    await page.goto(BASE+'/school',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready');
    await shown(page,'schoolView');
    const settings=page.locator('#mobileSettingsBtn').isVisible().then(v=>v?'#mobileSettingsBtn':'#settingsBtn');
    await page.locator(await settings).click();
    await shown(page,'flowSchoolSettingsView');
    assert.equal(new URL(page.url()).searchParams.get('settings'),'1',c.name+' route missing');
    await noOverflow(page,c.name+' settings');
    await page.screenshot({path:`${OUT}/${c.name}-settings.png`,animations:'disabled'});
    await page.reload({waitUntil:'domcontentloaded'});
    await shown(page,'flowSchoolSettingsView');
    assert.equal(new URL(page.url()).searchParams.get('settings'),'1',c.name+' reload route missing');
    await page.goBack({waitUntil:'domcontentloaded'});
    await shown(page,'schoolView');
    assert.notEqual(new URL(page.url()).searchParams.get('settings'),'1',c.name+' back route');
    await page.goForward({waitUntil:'domcontentloaded'});
    await shown(page,'flowSchoolSettingsView');
    await page.locator('[data-view="school"]').filter({visible:true}).first().click();
    await shown(page,'schoolView');
    assert.notEqual(new URL(page.url()).searchParams.get('settings'),'1',c.name+' same-path nav');
    await page.reload({waitUntil:'domcontentloaded'});
    await shown(page,'schoolView');
    await page.goto(BASE+'/schedule',{waitUntil:'domcontentloaded'});
    await shown(page,'scheduleView');
    assert.equal(await page.locator('#prevMonth').getAttribute('aria-label'),'이전 달');
    assert.equal(await page.locator('#nextMonth').getAttribute('aria-label'),'다음 달');
    assert.equal(await page.locator('#monthPicker').getAttribute('aria-label'),'달력 월 선택');
    await noOverflow(page,c.name+' calendar');
    await page.screenshot({path:`${OUT}/${c.name}-calendar.png`,animations:'disabled'});
    console.log('PASS '+c.name+' settings reload/back/forward/same-route/calendar/overflow');
    await context.close();
  }
  assert.deepEqual(errors,[],'unhandled JavaScript errors');
  console.log('PASS ALL '+CASES.length+' responsive stability scenarios');
} finally {
  await browser.close();
}
