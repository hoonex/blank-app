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
const cases=[
  {name:'compact-390',width:390,height:844,modes:['standard','optical']},
  {name:'galaxy-412',width:412,height:915,modes:['standard','optical']},
  {name:'wide-960',width:960,height:1536,modes:['standard']},
];
const stableSamples=[120,650,1600,4500];

function json(route,body,status=200){return route.fulfill({status,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)})}
async function installFixture(page,glassMode){
  await page.route('**/functions/v1/school-data*',route=>{const action=new URL(route.request().url()).searchParams.get('action')||'';if(action==='dashboard')return json(route,dashboard);if(action==='media')return json(route,{media:{}});return json(route,{})});
  await page.addInitScript(({profile,glassMode})=>{
    localStorage.clear();sessionStorage.clear();
    localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
    localStorage.setItem('flow-school-theme-v3','light');
    localStorage.setItem('flow-glass-mode-v2',glassMode);
    localStorage.setItem('flow-school-transit-lab-v1','off');
  },{profile,glassMode});
}
async function geometry(page){
  return page.evaluate(()=>{
    const nav=document.querySelector('#bottomNav.mobile-bottom-nav');
    const active=nav?.querySelector(':scope > .mobile-tab.active');
    if(!nav||!active)return null;
    const nr=nav.getBoundingClientRect(),ar=active.getBoundingClientRect(),ps=getComputedStyle(nav,'::before');
    const copy=nav.querySelector(':scope > .flow-refraction-copy-lens');
    const cr=copy?.getBoundingClientRect();
    const top=Number.parseFloat(ps.top),height=Number.parseFloat(ps.height),width=Number.parseFloat(ps.width);
    return{
      label:active.textContent.trim(),
      mode:document.documentElement.dataset.flowGlassMode||localStorage.getItem('flow-glass-mode-v2')||'',
      nav:{top:nr.top,width:nr.width,height:nr.height},
      active:{top:ar.top-nr.top,left:ar.left-nr.left,width:ar.width,height:ar.height},
      lens:{top,height,width,bottom:top+height},
      copy:cr?{top:cr.top-nr.top,left:cr.left-nr.left,width:cr.width,height:cr.height}:null,
      vars:{top:getComputedStyle(nav).getPropertyValue('--flow-school-lens-top').trim(),height:getComputedStyle(nav).getPropertyValue('--flow-school-lens-height').trim()},
      viewport:{innerHeight:window.innerHeight,visualHeight:window.visualViewport?.height||window.innerHeight},
    };
  });
}
function assertLens(name,state,expectedLabel){
  if(!state)throw new Error(`${name}: missing School bottom-nav geometry`);
  if(state.label!==expectedLabel)throw new Error(`${name}: active tab changed unexpectedly ${JSON.stringify(state)}`);
  const topDelta=Math.abs(state.lens.top-state.active.top),heightDelta=Math.abs(state.lens.height-state.active.height);
  const coversLabel=state.lens.bottom>=state.active.top+state.active.height-1.5;
  if(topDelta>1.5||heightDelta>1.5||!coversLabel||state.lens.height<36){
    throw new Error(`${name}: active lens detached from tab box ${JSON.stringify({topDelta,heightDelta,coversLabel,state})}`);
  }
  if(state.copy){
    const copyTopDelta=Math.abs(state.copy.top-state.active.top),copyHeightDelta=Math.abs(state.copy.height-state.active.height);
    if(copyTopDelta>1.5||copyHeightDelta>1.5)throw new Error(`${name}: Optical copy lens detached ${JSON.stringify({copyTopDelta,copyHeightDelta,state})}`);
  }
}
async function sampleStable(page,label,expectedLabel){
  const samples=[];
  let elapsed=0;
  for(const target of stableSamples){
    await page.waitForTimeout(Math.max(0,target-elapsed));
    elapsed=target;
    const state=await geometry(page);
    assertLens(`${label}@${target}ms`,state,expectedLabel);
    samples.push({atMs:target,...state});
  }
  return samples;
}

const browser=await chromium.launch({headless:true});
const report={};
for(const testCase of cases){
  for(const glassMode of testCase.modes){
    const name=`${testCase.name}-${glassMode}`;
    const context=await browser.newContext({viewport:{width:testCase.width,height:testCase.height},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
    const page=await context.newPage();
    await installFixture(page,glassMode);
    await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolUi==='v2');
    await page.waitForFunction(()=>document.documentElement.dataset.flowSchoolSurfaceCleanup==='ready');
    await page.waitForFunction(()=>{const nav=document.querySelector('#bottomNav');return nav&&getComputedStyle(nav).getPropertyValue('--flow-school-lens-height').trim()!==''},{timeout:5000});

    const todaySamples=await sampleStable(page,`${name}/today`,'오늘');
    await page.screenshot({path:`${OUT}/${name}-today-5s.png`,fullPage:false});

    await page.locator('#mobileSettingsBtn:visible').click();
    await page.waitForSelector('#flowSchoolSettingsView:not(.hidden)');
    const settingsSamples=await sampleStable(page,`${name}/settings`,'설정');
    await page.screenshot({path:`${OUT}/${name}-settings-5s.png`,fullPage:false});

    await page.locator('#bottomNav [data-view="today"]:visible').click();
    await page.waitForSelector('#todayView:not(.hidden)');
    const returnedSamples=await sampleStable(page,`${name}/return`,'오늘');

    const resized=[];
    if(testCase.width<=412){
      const compactHeight=Math.max(640,testCase.height-120);
      await page.setViewportSize({width:testCase.width,height:compactHeight});
      resized.push(...await sampleStable(page,`${name}/addressbar-collapse`,'오늘'));
      await page.setViewportSize({width:testCase.width,height:testCase.height});
      resized.push(...await sampleStable(page,`${name}/addressbar-expand`,'오늘'));
      await page.screenshot({path:`${OUT}/${name}-after-resize-5s.png`,fullPage:false});
    }

    report[name]={today:todaySamples,settings:settingsSamples,returned:returnedSamples,resized};
    await context.close();
  }
}
await browser.close();
await fs.writeFile(`${OUT}/report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({ok:true,cases:Object.keys(report),contract:'lens remains bound to active tab for 4.5s across Standard/Optical and viewport changes'},null,2));
