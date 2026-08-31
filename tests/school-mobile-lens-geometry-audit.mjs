import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_BASE_URL||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'school-mobile-lens-geometry-audit';
await fs.mkdir(OUT,{recursive:true});

const pad=value=>String(value).padStart(2,'0');
const seoulYmd=()=>{const date=new Date(Date.now()+9*60*60*1000);return`${date.getUTCFullYear()}${pad(date.getUTCMonth()+1)}${pad(date.getUTCDate())}`};
const today=seoulYmd();
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 용계동 54'},grade:2,className:'6'};
const dashboard={
  school:profile.school,selected:today,from:today,to:today,
  timetable:Array.from({length:7},(_,i)=>({date:today,period:i+1,subject:['자율·자치활동','문학','수학Ⅱ','영어Ⅱ','물리학','정보','체육'][i]})),
  meals:[{date:today,type:'중식',dishes:['현미밥','된장국'],calories:'812.4 Kcal',nutrition:'',origin:''}],
  events:[],scheduleMeta:{mode:'month',count:0},
};
const cases=[['compact-390',390,844],['galaxy-412',412,915],['wide-960',960,1536]];

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function installFixture(page){
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  await page.addInitScript(({profile})=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2','standard');
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },{profile});
}
async function geometry(page){
  return page.evaluate(()=>{
    const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
    const active=nav?.querySelector(':scope > .mobile-tab.active');
    if(!nav||!active)return null;
    const nr=nav.getBoundingClientRect(),ar=active.getBoundingClientRect(),ps=getComputedStyle(nav,'::before');
    const top=Number.parseFloat(ps.top),height=Number.parseFloat(ps.height),width=Number.parseFloat(ps.width);
    return{
      label:active.textContent.trim(),
      nav:{width:nr.width,height:nr.height},
      active:{top:ar.top-nr.top,left:ar.left-nr.left,width:ar.width,height:ar.height},
      lens:{top,height,width,bottom:top+height},
      vars:{top:getComputedStyle(nav).getPropertyValue('--flow-school-lens-top').trim(),height:getComputedStyle(nav).getPropertyValue('--flow-school-lens-height').trim()},
    };
  });
}
function assertLens(name,state){
  if(!state)throw new Error(`${name}: missing School bottom-nav geometry`);
  const topDelta=Math.abs(state.lens.top-state.active.top),heightDelta=Math.abs(state.lens.height-state.active.height);
  const coversLabel=state.lens.bottom>=state.active.top+state.active.height-1.5;
  if(topDelta>1.5||heightDelta>1.5||!coversLabel||state.lens.height<36){
    throw new Error(`${name}: active lens detached from tab box ${JSON.stringify({topDelta,heightDelta,coversLabel,state})}`);
  }
}

const browser=await chromium.launch({headless:true});
const report={};
for(const [name,width,height] of cases){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
  const page=await context.newPage();
  await installFixture(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolUi==='v2');
  await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurfaceCleanup==='ready');
  await page.waitForFunction(()=>{const nav=document.querySelector('#bottomNav');return nav&&getComputedStyle(nav).getPropertyValue('--flow-school-lens-height').trim()!==''},{timeout:5000});
  await page.waitForTimeout(120);

  const todayGeometry=await geometry(page);assertLens(`${name}/today`,todayGeometry);
  await page.screenshot({path:`${OUT}/${name}-today.png`,fullPage:false});

  await page.locator('#mobileSettingsBtn:visible').click();
  await page.waitForSelector('#flowSchoolSettingsView:not(.hidden)');
  await page.waitForTimeout(120);
  const settingsGeometry=await geometry(page);assertLens(`${name}/settings`,settingsGeometry);
  if(settingsGeometry.label!=='설정')throw new Error(`${name}: Settings did not become the active fourth tab ${JSON.stringify(settingsGeometry)}`);
  await page.screenshot({path:`${OUT}/${name}-settings.png`,fullPage:false});

  await page.locator('#bottomNav [data-view="today"]:visible').click();
  await page.waitForSelector('#todayView:not(.hidden)');
  await page.waitForTimeout(120);
  const returnedGeometry=await geometry(page);assertLens(`${name}/return`,returnedGeometry);
  if(returnedGeometry.label!=='오늘')throw new Error(`${name}: Today did not reactivate after Settings ${JSON.stringify(returnedGeometry)}`);

  report[name]={today:todayGeometry,settings:settingsGeometry,returned:returnedGeometry};
  await context.close();
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({ok:true,cases:Object.keys(report),contract:'lens follows rendered active tab box'},null,2));