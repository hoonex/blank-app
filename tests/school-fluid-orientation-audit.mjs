import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'school-fluid-orientation-audit';
const SCHOOL={officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',officeName:'대구광역시교육청',type:'공립',highSchoolType:'일반고',coed:'남녀공학',dayNight:'주간'};
const profile={school:SCHOOL,grade:2,className:'6'};
const cases=[
  {name:'phone-portrait',width:390,height:844,touch:true,columns:1,composition:'stack',rail:false},
  {name:'phone-landscape',width:844,height:390,touch:true,columns:2,composition:'split',rail:false},
  {name:'portrait-768',width:768,height:1024,touch:true,columns:1,composition:'stack',rail:false},
  {name:'landscape-1024',width:1024,height:768,touch:true,columns:2,composition:'split',rail:false},
  {name:'portrait-1024',width:1024,height:1366,touch:false,columns:1,composition:'stack',rail:false},
  {name:'landscape-1130-mouse',width:1130,height:700,touch:false,columns:2,composition:'split',rail:false},
  {name:'landscape-1130-touch',width:1130,height:700,touch:true,columns:2,composition:'split',rail:false},
  {name:'landscape-1366-mouse',width:1366,height:768,touch:false,columns:2,composition:'rail',rail:true},
  {name:'landscape-1366-touch',width:1366,height:768,touch:true,columns:2,composition:'rail',rail:true},
  {name:'landscape-1920',width:1920,height:1080,touch:false,columns:2,composition:'rail',rail:true}
];
const ymd=()=>{const d=new Date();return ''+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')};
const data=()=>({school:SCHOOL,selected:ymd(),from:ymd(),to:ymd(),timetable:[1,2,3,4,5,6].map(i=>({date:ymd(),period:i,subject:['국어','수학','영어','화학','한국사','음악'][i-1]})),meals:[{date:ymd(),type:'중식',dishes:['잡곡밥','국','반찬']}],events:[{date:ymd(),name:'학교 행사'}],scheduleMeta:{mode:'fixture',count:1}});
const assert=(x,msg)=>{if(!x)throw Error(msg)};
const box=n=>n?.getBoundingClientRect();
async function install(page){
  await page.route('**/functions/v1/school-data*',route=>{
    const action=new URL(route.request().url()).searchParams.get('action');
    const response=action==='dashboard'?data():action==='media'?{media:{}}:{classes:['1','2','3','4','5','6']};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.route('**/functions/v1/school-logo*',r=>r.fulfill({status:204,body:''}));
  await page.addInitScript(p=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(p));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },profile);
}
async function measure(page){
return page.evaluate(()=>{
 const get=s=>document.querySelector(s),r=n=>{const x=n?.getBoundingClientRect();return x?{left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}:null};
 const show=n=>{if(!n)return false;const x=n.getBoundingClientRect(),c=getComputedStyle(n);return c.display!=='none'&&c.visibility!=='hidden'&&x.width>0&&x.height>0};
 const root=document.documentElement,sidebar=get('#desktopSidebar'),nav=get('#bottomNav'),header=get('.mobile-topbar'),today=get('#todayView .today-grid'),main=get('.product-main'),tt=get('#todayView .timetable-card'),right=get('#todayView .right-stack'),periods=get('#timetable'),now=get('#todayView .status-grid');
 return{
  mode:root.dataset.flowSchoolLayout,orientation:root.dataset.flowSchoolOrientation,composition:root.dataset.flowSchoolComposition,
  viewport:{width:innerWidth,height:innerHeight,overflow:root.scrollWidth-root.clientWidth},
  sidebar:show(sidebar),sidebarRect:r(sidebar),nav:show(nav),header:show(header),main:r(main),
  today:r(today),todayColumns:getComputedStyle(today).gridTemplateColumns.split(' ').filter(Boolean).length,
  todayGap:getComputedStyle(today).gap,sectionGap:getComputedStyle(get('#dashboard')).getPropertyValue('--flow-school-section-gap').trim(),
  timetable:r(tt),context:r(right),contextColumns:getComputedStyle(right).gridTemplateColumns.split(' ').filter(Boolean).length,
  lessonColumns:getComputedStyle(periods).gridTemplateColumns.split(' ').filter(Boolean).length,
  status:r(now),pageErrors:root.dataset.flowSchoolSurface
 };
});
}
await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={cases:[],failures:[],generatedAt:new Date().toISOString()};
for(const c of cases){
 const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:c.width<521,hasTouch:c.touch,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul'});
 const page=await context.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await install(page);await page.goto(BASE,{waitUntil:'domcontentloaded'});
  await page.locator('#dashboard:not(.hidden)').waitFor();
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSpacingSystem==='v1'&&document.documentElement.dataset.flowSchoolResponsiveContract==='v2');
  await page.waitForTimeout(190);
  const s=await measure(page);
  assert(s.composition===c.composition,`${c.name} composition: ${JSON.stringify(s)}`);
  assert(s.orientation===(c.width>c.height?'landscape':'portrait'),`${c.name} orientation incorrect`);
  assert(s.todayColumns===c.columns,`${c.name} content track count incorrect: ${JSON.stringify(s)}`);
  assert(s.viewport.overflow<=2,`${c.name} horizontal overflow: ${JSON.stringify(s.viewport)}`);
  assert(s.sidebar===c.rail&&s.header!==c.rail&&s.nav!==c.rail,`${c.name} navigation shell depends on device instead of room: ${JSON.stringify(s)}`);
  assert(s.today&&s.timetable&&s.context&&s.timetable.width>=300,`${c.name} missing readable content ${JSON.stringify(s)}`);
  if(c.columns===1){
   assert(s.context.top>=s.timetable.bottom+7&&Math.abs(s.context.left-s.timetable.left)<=2,`${c.name} portrait stack misaligned`);
  }else{
   assert(s.timetable.width>=390&&s.context.width>=280&&s.context.left>=s.timetable.right+7,`${c.name} split columns too narrow`);
  }
  if(c.rail){
   assert(s.sidebarRect.width>=218&&s.sidebarRect.width<=260,`${c.name} rail should be fluid width`);
   assert(s.lessonColumns===2,`${c.name} roomy landscape timetable not two columns`);
  }
  assert(errors.length===0,`${c.name} page errors: ${JSON.stringify(errors)}`);
  await page.screenshot({path:`${OUT}/${c.name}-today.png`,fullPage:false,animations:'disabled'});
  const button=page.locator((c.rail?'#desktopSidebar ':'#bottomNav ')+'[data-view="school"]:visible').first();
  await button.click();await page.locator('#schoolView:not(.hidden)').waitFor();await page.screenshot({path:`${OUT}/${c.name}-school.png`,fullPage:false,animations:'disabled'});
  const stat={name:c.name,pass:true,...s};report.cases.push(stat);
 }catch(e){const error=String(e.stack||e);report.failures.push({name:c.name,error});report.cases.push({name:c.name,pass:false,error});console.error(c.name+' FAIL '+error.slice(0,500))}
 await context.close();
}
const variants=report.cases.filter(c=>c.name==='landscape-1366-mouse'||c.name==='landscape-1366-touch');
if(variants.length===2&&variants.every(v=>v.pass)){
 const [m,t]=variants;
 if(Math.abs(m.sidebarRect.width-t.sidebarRect.width)>1||Math.abs(m.timetable.width-t.timetable.width)>1){report.failures.push({name:'pointer-parity',error:'Same 1366x768 surface produced different layout from touch capability'})}
}
await browser.close();
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
if(report.failures.length)throw Error(`Fluid orientation audit failed ${report.failures.length} case(s)`);
console.log(`Fluid orientation audit PASS: ${cases.length} surfaces + pointer parity`);
