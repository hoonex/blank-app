import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT='optical-nav-layout-audit';
await mkdir(OUT,{recursive:true});

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function schoolFixtures(page){
  const school={officeCode:'D10',officeName:'대구광역시교육청',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',address:'대구광역시 동구 반야월북로 199',homepage:'https://jungdong.dge.hs.kr'};
  await page.route('**/functions/v1/school-data**',async route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,{school,selected:'20260824',from:'20260824',to:'20260824',timetable:[],meals:[],events:[],scheduleMeta:{mode:'fixture',count:0}});if(action==='media')return json(route,{media:{},homepage:school.homepage});if(action==='place')return json(route,{provider:'kakao',place:null});return json(route,{})});
  await page.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
  await page.addInitScript(({school})=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify({school,grade:2,className:'6'}));localStorage.setItem('flow-school-theme-v3','light');localStorage.setItem('flow-glass-mode-v2','optical')},{school});
}
async function universityFixtures(page){
  const university={id:'knu',name:'경북대학교',kind:'대학교',address:'대구광역시 북구 대학로 80',homepage:'https://www.knu.ac.kr'};
  await page.route('**/functions/v1/university-data**',route=>json(route,{school:university,metrics:{},partial:false,unavailable:[]}));
  await page.route('**/functions/v1/university-campus**',route=>json(route,{center:null,places:[],nearby:{dining:[],stores:[],cafes:[],food:[]}}));
  await page.addInitScript(({university})=>{localStorage.clear();localStorage.setItem('flow-university-profile-v1',JSON.stringify(university));localStorage.setItem('flow-university-timetable-v1',JSON.stringify({year:2026,semester:'2학기',subjects:[]}));localStorage.setItem('flow-university-theme-v1','light');localStorage.setItem('flow-glass-mode-v2','optical')},{university});
}
async function inspect(page,selector,expectedCount){
  await page.waitForFunction(({selector,expectedCount})=>{const nav=document.querySelector(selector);if(!nav||document.documentElement.dataset.flowRefractionCopy!=='true')return false;const items=[...nav.querySelectorAll(':scope > .mobile-tab,:scope > .bottom-item')].filter(node=>getComputedStyle(node).display!=='none');return items.length===expectedCount&&nav.querySelector(':scope > .flow-refraction-copy-lens')},{selector,expectedCount});
  return page.evaluate((selector)=>{
    const nav=document.querySelector(selector),nr=nav.getBoundingClientRect(),items=[...nav.querySelectorAll(':scope > .mobile-tab,:scope > .bottom-item')].filter(node=>getComputedStyle(node).display!=='none');
    const lens=nav.querySelector(':scope > .flow-refraction-copy-lens'),lr=lens.getBoundingClientRect(),pseudo=getComputedStyle(nav,'::before'),lensStyle=getComputedStyle(lens);
    return{nav:{left:nr.left,top:nr.top,width:nr.width,height:nr.height,grid:getComputedStyle(nav).gridTemplateColumns},items:items.map((node,index)=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{index,id:node.id||'',view:node.dataset.view||'',text:node.textContent.trim(),active:node.classList.contains('active'),left:r.left,top:r.top,width:r.width,height:r.height,order:s.order,gridColumn:s.gridColumnStart,gridRow:s.gridRowStart,borderTopWidth:s.borderTopWidth,borderTopStyle:s.borderTopStyle,appearance:s.appearance,backgroundColor:s.backgroundColor}}),lens:{left:lr.left,top:lr.top,width:lr.width,height:lr.height,transform:lensStyle.transform},rimTransform:pseudo.transform,restX:nav.style.getPropertyValue('--flow-refraction-rest-x')};
  },selector);
}
function validate(name,state,{count,first,last,requiredView=''}){
  if(state.items.length!==count)throw new Error(`${name}: wrong item count ${JSON.stringify(state)}`);
  if(first&&state.items[0].text!==first)throw new Error(`${name}: first item moved ${JSON.stringify(state)}`);
  if(last&&state.items.at(-1).text!==last)throw new Error(`${name}: last item moved ${JSON.stringify(state)}`);
  if(requiredView&&!state.items.some(item=>item.view===requiredView))throw new Error(`${name}: required destination ${requiredView} missing ${JSON.stringify(state)}`);
  const tops=state.items.map(x=>x.top),lefts=state.items.map(x=>x.left),topSpread=Math.max(...tops)-Math.min(...tops);
  if(topSpread>2||state.nav.height>72)throw new Error(`${name}: nav wrapped onto multiple rows ${JSON.stringify(state)}`);
  for(let i=1;i<lefts.length;i++)if(!(lefts[i]>lefts[i-1]+20))throw new Error(`${name}: tab order/geometry is not left-to-right ${JSON.stringify(state)}`);
  const active=state.items.find(x=>x.active);if(!active)throw new Error(`${name}: no active tab ${JSON.stringify(state)}`);
  const centerError=Math.abs((state.lens.left+state.lens.width/2)-(active.left+active.width/2));
  if(centerError>5)throw new Error(`${name}: optical copy lens is not aligned with active tab ${JSON.stringify({centerError,state})}`);
  if(state.lens.transform!==state.rimTransform)throw new Error(`${name}: optical content lens and visible rim disagree ${JSON.stringify(state)}`);
}
function validateUniversityButtonSkin(name,state,{requireAppearanceNone=false}={}){
  const bad=state.items.filter(item=>parseFloat(item.borderTopWidth)>0||item.borderTopStyle!=='none'||item.backgroundColor!=='rgba(0, 0, 0, 0)'||(requireAppearanceNone&&item.appearance!=='none'));
  if(bad.length)throw new Error(`${name}: native button chrome leaked into bottom nav ${JSON.stringify(bad)}`);
}

const browser=await chromium.launch({headless:true});
const schoolContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul'});const school=await schoolContext.newPage();await schoolFixtures(school);await school.goto(BASE,{waitUntil:'domcontentloaded'});await school.locator('#dashboard:not(.hidden)').waitFor();const schoolState=await inspect(school,'#bottomNav',5);validate('School Optical nav',schoolState,{count:5,first:'오늘',last:'설정',requiredView:'transit'});await school.screenshot({path:`${OUT}/school-optical-nav.png`,fullPage:false});await schoolContext.close();

const universityContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul'});const university=await universityContext.newPage();await universityFixtures(university);await university.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await university.locator('#appView:not(.hidden)').waitFor();const universityState=await inspect(university,'.bottom-nav',5);validate('University Optical nav',universityState,{count:5,first:'오늘',last:'설정'});validateUniversityButtonSkin('University portrait nav',universityState);await university.screenshot({path:`${OUT}/university-optical-nav.png`,fullPage:false});await universityContext.close();

const landscapeContext=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul'});const landscape=await landscapeContext.newPage();await universityFixtures(landscape);await landscape.goto(`${BASE}/university/`,{waitUntil:'domcontentloaded'});await landscape.locator('#appView:not(.hidden)').waitFor();const universityLandscapeState=await inspect(landscape,'.bottom-nav',5);validate('University landscape Optical nav',universityLandscapeState,{count:5,first:'오늘',last:'설정'});validateUniversityButtonSkin('University landscape nav',universityLandscapeState,{requireAppearanceNone:true});await landscape.screenshot({path:`${OUT}/university-landscape-optical-nav.png`,fullPage:false});await landscapeContext.close();

await browser.close();console.log(JSON.stringify({schoolState,universityState,universityLandscapeState},null,2));