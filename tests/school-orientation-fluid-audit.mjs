import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'flow-orientation-layout-audit';
const BINARY=process.env.FLOW_BROWSER_EXECUTABLE;
const INDEX_HTML=await readFile(new URL('../index.html',import.meta.url),'utf8');
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',location:'대구광역시',highSchoolType:'일반고',type:'사립'};
const CASES=[
  {name:'phone-portrait',width:390,height:844,mobile:true,today:1,right:1,calendar:1,info:2},
  {name:'phone-landscape',width:844,height:390,mobile:true,today:1,right:2,calendar:2,info:2},
  {name:'tablet-portrait',width:768,height:1024,mobile:false,today:1,right:2,calendar:1,info:2},
  {name:'tablet-landscape',width:1024,height:768,mobile:false,today:1,right:2,calendar:2,info:3},
  {name:'short-wide',width:1024,height:580,mobile:false,today:1,right:2,calendar:2,info:3},
  {name:'large-portrait',width:1200,height:1600,mobile:false,today:1,right:2,calendar:1,info:3},
  {name:'desktop',width:1366,height:768,mobile:false,today:2,right:1,calendar:2,info:4},
  {name:'wide-desktop',width:1920,height:1080,mobile:false,today:2,right:1,calendar:2,info:4}
];
function fixture(date='20261019'){
 const subjects=['문학','수학Ⅱ','물리학','영어Ⅱ','정보','체육','진로활동'];
 let timetable=[];for(let d=0;d<5;d++){const when=new Date(2026,9,19+d,12);let key=''+when.getFullYear()+String(when.getMonth()+1).padStart(2,'0')+String(when.getDate()).padStart(2,'0');for(let i=0;i<7;i++)timetable.push({date:key,period:i+1,subject:subjects[i],grade:'2',className:'6'});}
 return {school:SCHOOL,selected:date,from:'20261019',to:'20261023',timetable,meals:[{date,type:'중식',dishes:['현미밥','오므라이스'],calories:'680 Kcal'}],events:[{date:'20261020',name:'학급 행사',content:'학급 행사'}],scheduleMeta:{mode:'fixture',count:1}};
}
async function routes(page){
 await page.route(url=>url.origin===new URL(BASE).origin&&['/week','/schedule','/school'].includes(url.pathname),route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:INDEX_HTML}));
 await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await page.route('https://fonts.gstatic.com/**',r=>r.abort());
 await page.route('**/functions/v1/school-logo**',r=>r.fulfill({status:204,body:''}));
 await page.route('**/functions/v1/school-data**',r=>{
  const u=new URL(r.request().url()),action=u.searchParams.get('action');
  const body=action==='dashboard'?fixture(u.searchParams.get('date')||'20261019'):action==='media'?{media:{hero:'',logo:''},homepage:''}:action==='classes'?{classes:['1','2','3','4','5','6']}:action==='place'?{}:{schools:[SCHOOL]};
  return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
}
const rows=[];
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true,...(BINARY?{executablePath:BINARY}:{}),args:['--no-sandbox']});
try{
 for(const c of CASES){
  const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:c.mobile,hasTouch:c.mobile,deviceScaleFactor:1,serviceWorkers:'block',locale:'ko-KR',timezoneId:'Asia/Seoul'});
  await context.addInitScript(s=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify({school:s,grade:'2',className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-school-transit-lab-v1','off');},SCHOOL);
  const page=await context.newPage();await routes(page);page.setDefaultTimeout(13000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
   await page.locator('#dashboard:not(.hidden)').waitFor();
   await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSpacingSystem==='v1' && document.documentElement.dataset.flowSchoolSurface==='ready');
   await page.waitForTimeout(120);
   const tokens=await page.evaluate(()=>{const probe=document.createElement('div');probe.style.cssText='position:absolute;inset:auto auto auto -10000px;display:grid;gap:var(--flow-school-section-gap);column-gap:var(--flow-school-control-gap);padding:var(--flow-school-card-pad);margin-left:var(--flow-school-page-inset)';document.querySelector('#dashboard').append(probe);const s=getComputedStyle(probe);const t={'page-inset':parseFloat(s.marginLeft),'section-gap':parseFloat(s.rowGap),'control-gap':parseFloat(s.columnGap),'card-pad':parseFloat(s.paddingTop)};probe.remove();return t;});
   const day=await page.evaluate(()=>{
    const el=s=>document.querySelector(s),cs=s=>getComputedStyle(el(s)),rect=s=>el(s).getBoundingClientRect();
    const gridCount=s=>cs(s).gridTemplateColumns.split(' ').filter(Boolean).length;
    return {today:gridCount('#todayView .today-grid'),right:gridCount('#todayView .right-stack'),status:gridCount('#todayView .status-grid'),
      x:rect('#todayView .timetable-card').x,y:rect('#todayView .timetable-card').y,
      rightX:rect('#todayView .right-stack').x,rightY:rect('#todayView .right-stack').y,
      gap:parseFloat(cs('#todayView .today-grid').gap),scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth};
   });
   assert.equal(day.today,c.today,c.name+' Today cols');
   assert.equal(day.right,c.right,c.name+' utility cols');
   assert.equal(day.status,2,c.name+' two summary cards fill available columns');
   assert.ok(day.gap>=9&&day.gap<26,c.name+' Today gap');
   assert.ok(day.scroll<=day.client+2,c.name+' Today horizontal overflow');
   await page.screenshot({path:OUT+'/'+c.name+'-today.png',animations:'disabled'});
   await page.locator('[data-view="schedule"]:visible').first().click();
   await page.locator('#scheduleView:not(.hidden)').waitFor();
   const schedule=await page.evaluate(()=>{const e=document.querySelector('#scheduleView .schedule-layout'),s=getComputedStyle(e);return {cols:s.gridTemplateColumns.split(' ').filter(Boolean).length,gap:parseFloat(s.gap),scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}});
   assert.equal(schedule.cols,c.calendar,c.name+' calendar cols');
   assert.ok(Math.abs(schedule.gap-tokens['section-gap'])<2,c.name+' calendar gap');
   assert.ok(schedule.scroll<=schedule.client+2,c.name+' calendar overflow');
   await page.screenshot({path:OUT+'/'+c.name+'-schedule.png',animations:'disabled'});
   await page.locator('[data-view="school"]:visible').first().click();
   await page.locator('#schoolInfoGrid .info-tile').first().waitFor();
   const info=await page.evaluate(()=>{const e=document.querySelector('#schoolInfoGrid'),s=getComputedStyle(e);return {cols:s.gridTemplateColumns.split(' ').filter(Boolean).length,gap:parseFloat(s.gap),scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}});
   assert.equal(info.cols,c.info,c.name+' info cols');
   assert.ok(Math.abs(info.gap-tokens['section-gap'])<2,c.name+' info gap');
   assert.ok(info.scroll<=info.client+2,c.name+' info overflow');
   await page.screenshot({path:OUT+'/'+c.name+'-school.png',animations:'disabled'});
   await page.goto(BASE+'/week',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurface==='ready');
   const weekVisible=await page.locator('#weekView').isVisible();
   let week={skipped:'Compact School navigation does not expose Week'};
   if(weekVisible){
     await page.locator('#weekTable .week-cell').first().waitFor({state:'attached'});
     week=await page.evaluate(()=>{const table=document.querySelector('#weekTable'),a=document.querySelector('#weekView .week-table-wrap')||table.parentElement;return {internalScroll:a.scrollWidth>a.clientWidth+2,weekWidth:table.getBoundingClientRect().width,overflow:getComputedStyle(a).overflowX,scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}});
     assert.ok(week.weekWidth>=739,c.name+' week table minimum '+JSON.stringify(week));
     assert.ok(week.scroll<=week.client+2,c.name+' week page overflow');
     await page.screenshot({path:OUT+'/'+c.name+'-week.png',animations:'disabled'});
   }
   assert.deepEqual(errors,[],c.name+' runtime errors');
   rows.push({name:c.name,viewport:c.width+'x'+c.height,orientation:c.width>=c.height?'landscape':'portrait',tokens,day,schedule,info,week});
   console.log('PASS '+c.name+' tokens/Today/Schedule/School/Week/overflow/no JS errors');
  }catch(e){console.error('FAIL '+c.name+': '+e.stack);throw e;}finally{await context.close()}
 }
 const get=name=>rows.find(x=>x.name===name);
 assert.ok(get('wide-desktop').tokens['section-gap']>get('phone-portrait').tokens['section-gap']+3,'global gap must grow with available space');
 assert.ok(get('short-wide').tokens['section-gap']<get('tablet-landscape').tokens['section-gap']-1,'short landscape should be denser');
 await writeFile(OUT+'/metrics.json',JSON.stringify(rows,null,2));
 console.log('PASS ALL '+CASES.length+' orientation-oriented viewport cases');
}finally{await browser.close()}
