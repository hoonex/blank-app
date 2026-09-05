import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-bottom-nav-dark-audit';
const SCHOOL={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
const CASES=[
  {name:'phone-360',width:360,height:800,mobile:true,touch:true},
  {name:'phone-390',width:390,height:844,mobile:true,touch:true},
  {name:'phone-412',width:412,height:915,mobile:true,touch:true},
  {name:'phone-landscape',width:844,height:390,mobile:true,touch:true},
  {name:'tablet-portrait',width:768,height:1024,mobile:false,touch:true},
  {name:'tablet-landscape',width:1024,height:768,mobile:false,touch:true},
];
const pad=n=>String(n).padStart(2,'0');
const ymd=(d=new Date())=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
function dashboard(date){return{school:SCHOOL,selected:date,from:date,to:date,timetable:['문학','영어Ⅱ','수학Ⅱ','정보','스포츠 생활2','화학','진로활동'].map((subject,i)=>({date,period:i+1,subject,grade:'2',className:'6'})),meals:[{date,type:'중식',dishes:['현미밥','닭갈비','계란찜','배추김치']}],events:[],scheduleMeta:{mode:'fixture',count:0}}}
async function fixtures(page){
  await page.route('**/functions/v1/school-data**',route=>{const u=new URL(route.request().url()),action=u.searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard((u.searchParams.get('date')||ymd()).replace(/-/g,'')));if(action==='media')return json(route,{media:{},homepage:SCHOOL.homepage});if(action==='place')return json(route,{provider:'kakao',place:null});if(action==='classes')return json(route,{classes:['1','2','3','4','5','6']});if(action==='search')return json(route,{schools:[SCHOOL]});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
}
const num=v=>Number.parseFloat(v)||0;
const maxWhiteAlpha=value=>{let max=0;for(const m of String(value||'').matchAll(/rgba?\(\s*255\s*,\s*255\s*,\s*255(?:\s*,\s*([\d.]+))?\s*\)/g))max=Math.max(max,m[1]===undefined?1:Number(m[1]));return max};
function expected(c){
  if(c.height<=620&&c.width>c.height)return{navH:58,lensH:48,lensTop:5};
  if(c.width<=520)return{navH:56,lensH:44,lensTop:6};
  return{navH:60,lensH:48,lensTop:6};
}
async function state(page){return page.evaluate(()=>{
  const nav=document.querySelector('#bottomNav.mobile-bottom-nav'),tabs=[...nav.querySelectorAll(':scope > .mobile-tab')],copy=nav.querySelector(':scope > .flow-refraction-copy-lens'),top=document.querySelector('.mobile-topbar'),school=document.querySelector('.mobile-school-button'),pseudo=getComputedStyle(nav,'::before'),ns=getComputedStyle(nav),ts=getComputedStyle(top),ss=getComputedStyle(school),rs=getComputedStyle(document.documentElement),bs=getComputedStyle(document.body);
  const rect=node=>{const x=node.getBoundingClientRect();return{left:x.left,top:x.top,width:x.width,height:x.height,bottom:x.bottom,right:x.right}};
  return{
    theme:document.documentElement.dataset.theme||'',mode:document.documentElement.dataset.flowGlassMode||'',
    nav:{rect:rect(nav),background:ns.backgroundColor,border:ns.borderColor,shadow:ns.boxShadow,backdrop:ns.backdropFilter||ns.webkitBackdropFilter||'',radius:ns.borderRadius,corner:ns.cornerShape||''},
    geometry:{computedW:ns.getPropertyValue('--flow-nav-w').trim(),computedX:ns.getPropertyValue('--flow-nav-x').trim(),inlineW:nav.style.getPropertyValue('--flow-nav-w').trim(),inlineX:nav.style.getPropertyValue('--flow-nav-x').trim(),paddingLeft:ns.paddingLeft,paddingRight:ns.paddingRight,columnGap:ns.columnGap,gridTemplateColumns:ns.gridTemplateColumns,navTransition:ns.transition,pseudoTransition:pseudo.transition,navField:nav.dataset.flowNavField||'',refine:document.documentElement.dataset.flowSchoolRealDeviceRefine||''},
    lens:{top:pseudo.top,bottom:pseudo.bottom,height:pseudo.height,width:pseudo.width,background:pseudo.backgroundImage,shadow:pseudo.boxShadow,border:pseudo.borderColor,radius:pseudo.borderRadius,corner:pseudo.cornerShape||''},
    copy:copy?{rect:rect(copy),top:getComputedStyle(copy).top,bottom:getComputedStyle(copy).bottom,height:getComputedStyle(copy).height,width:getComputedStyle(copy).width}:null,
    tabs:tabs.map(node=>({rect:rect(node),color:getComputedStyle(node).color})),
    top:{background:ts.backgroundColor,backgroundImage:ts.backgroundImage,shadow:ts.boxShadow,border:ts.borderBottomColor,backdrop:ts.backdropFilter||ts.webkitBackdropFilter||''},
    school:{background:ss.backgroundColor,shadow:ss.boxShadow,border:ss.borderColor},
    ambient:{root:rs.backgroundImage,body:bs.backgroundImage}
  };
})}
function verifyGeometry(c,s){
  const e=expected(c),eps=1.25;
  if(Math.abs(s.nav.rect.height-e.navH)>eps)throw new Error(`${c.name}/${s.theme}/${s.mode}: nav height ${s.nav.rect.height} != ${e.navH}`);
  const heights=s.tabs.map(x=>x.rect.height),widths=s.tabs.map(x=>x.rect.width);
  if(heights.some(x=>Math.abs(x-e.lensH)>eps))throw new Error(`${c.name}/${s.theme}/${s.mode}: tab heights ${JSON.stringify(heights)} != ${e.lensH}`);
  if(Math.max(...widths)-Math.min(...widths)>1.25)throw new Error(`${c.name}/${s.theme}/${s.mode}: unequal tab widths ${JSON.stringify(widths)}`);
  if(Math.abs(num(s.lens.top)-e.lensTop)>eps||Math.abs(num(s.lens.height)-e.lensH)>eps)throw new Error(`${c.name}/${s.theme}/${s.mode}: follower geometry top=${s.lens.top} height=${s.lens.height}, expected ${e.lensTop}/${e.lensH}`);
  if(Math.abs(num(s.lens.width)-widths[0])>1.5)throw new Error(`${c.name}/${s.theme}/${s.mode}: follower width ${s.lens.width} != tab ${widths[0]} geometry=${JSON.stringify(s.geometry)}`);
  if(s.mode==='optical'&&s.copy){if(Math.abs(num(s.copy.top)-e.lensTop)>eps||Math.abs(num(s.copy.height)-e.lensH)>eps)throw new Error(`${c.name}/${s.theme}/${s.mode}: refraction copy top/height ${s.copy.top}/${s.copy.height}, expected ${e.lensTop}/${e.lensH}`);if(Math.abs(num(s.copy.width)-widths[0])>1.5)throw new Error(`${c.name}/${s.theme}/${s.mode}: refraction copy width ${s.copy.width} != tab ${widths[0]} geometry=${JSON.stringify(s.geometry)}`)}
  if(String(s.nav.corner).includes('squircle')||String(s.lens.corner).includes('squircle'))throw new Error(`${c.name}/${s.theme}/${s.mode}: squircle leaked into bottom nav`);
}
function verifyDark(c,s){
  if(s.theme!=='dark')return;
  const topWhite=maxWhiteAlpha(s.top.shadow),buttonWhite=maxWhiteAlpha(s.school.shadow),navWhite=maxWhiteAlpha(s.nav.shadow);
  if(topWhite>.24)throw new Error(`${c.name}/dark/${s.mode}: topbar white specular too bright (${topWhite}) ${s.top.shadow}`);
  if(buttonWhite>.22)throw new Error(`${c.name}/dark/${s.mode}: school button white specular too bright (${buttonWhite}) ${s.school.shadow}`);
  if(navWhite>.30)throw new Error(`${c.name}/dark/${s.mode}: nav white specular too bright (${navWhite}) ${s.nav.shadow}`);
}

await mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),cases:[],failures:[]};
for(const c of CASES)for(const theme of ['light','dark'])for(const mode of ['standard','optical']){
  const context=await browser.newContext({viewport:{width:c.width,height:c.height},isMobile:c.mobile,hasTouch:c.touch,deviceScaleFactor:1,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:theme});
  const page=await context.newPage();page.setDefaultTimeout(12000);await fixtures(page);
  const row={name:c.name,viewport:{width:c.width,height:c.height},theme,mode};
  try{
    await page.addInitScript(({school,theme,mode})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3',theme);localStorage.setItem('flow-glass-mode-v2',mode);localStorage.setItem('flow-ambient-v1','on')},{school:SCHOOL,theme,mode});
    await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.locator('#dashboard:not(.hidden)').waitFor();await page.locator('#timetable .period-button').first().waitFor();await page.waitForFunction(expected=>document.documentElement.dataset.flowGlassMode===expected,mode);await page.waitForTimeout(220);
    row.state=await state(page);
    await page.screenshot({path:`${OUT}/${c.name}-${theme}-${mode}.png`,fullPage:false,animations:'disabled'});
    verifyGeometry(c,row.state);verifyDark(c,row.state);row.pass=true;
  }catch(error){row.pass=false;row.error=error?.stack||String(error);report.failures.push({case:c.name,theme,mode,error:row.error});console.error(`${c.name}/${theme}/${mode}: FAIL\n${row.error}`)}finally{report.cases.push(row);await context.close()}
}
await writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));await browser.close();
if(report.failures.length)throw new Error(`School bottom-nav/dark audit found ${report.failures.length} failure(s): ${JSON.stringify(report.failures.map(x=>({case:x.case,theme:x.theme,mode:x.mode,error:x.error.split('\n')[0]})))}`);
console.log(`School bottom-nav/dark audit PASS: ${report.cases.length} combinations`);