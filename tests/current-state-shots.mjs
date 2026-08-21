import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'browser-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청'},grade:2,className:'6'};
const cases=[
  {name:'mobile-portrait',viewport:{width:390,height:844},isMobile:true,hasTouch:true},
  {name:'mobile-landscape',viewport:{width:844,height:390},isMobile:true,hasTouch:true},
  {name:'tablet-portrait',viewport:{width:768,height:1024},isMobile:false,hasTouch:true},
  {name:'tablet-landscape',viewport:{width:1024,height:768},isMobile:false,hasTouch:true},
  {name:'desktop-1366',viewport:{width:1366,height:768},isMobile:false,hasTouch:false},
  {name:'desktop-1920',viewport:{width:1920,height:1080},isMobile:false,hasTouch:false},
];

const browser=await chromium.launch({headless:true});
const report={generatedAt:new Date().toISOString(),base:BASE,cases:[]};

function watchErrors(page){
  const consoleErrors=[];
  const pageErrors=[];
  page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text())});
  page.on('pageerror',err=>pageErrors.push(String(err)));
  return {consoleErrors,pageErrors};
}

async function measure(page,selector){
  return await page.evaluate((selector)=>{
    const root=document.documentElement;
    const body=document.body;
    const target=document.querySelector(selector);
    const r=target?.getBoundingClientRect();
    return {
      clientWidth:root.clientWidth,
      scrollWidth:Math.max(root.scrollWidth,body?.scrollWidth||0),
      clientHeight:root.clientHeight,
      scrollHeight:Math.max(root.scrollHeight,body?.scrollHeight||0),
      target:r?{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}:null,
    };
  },selector);
}

function assertLayout(label,state){
  if(state.scrollWidth>state.clientWidth+2)throw new Error(`${label} horizontal overflow: ${JSON.stringify(state)}`);
  if(!state.target)throw new Error(`${label} target missing`);
  if(state.target.left<-2||state.target.right>state.clientWidth+2)throw new Error(`${label} target escapes viewport width: ${JSON.stringify(state)}`);
}

async function shot(page,path,fullPage){
  await page.screenshot({path:`${OUT}/${path}`,fullPage,animations:'disabled'});
}

for(const c of cases){
  const caseReport={name:c.name,viewport:c.viewport};

  const landingContext=await browser.newContext({viewport:c.viewport,isMobile:c.isMobile,hasTouch:c.hasTouch,deviceScaleFactor:1,locale:'ko-KR',colorScheme:'light'});
  const landingPage=await landingContext.newPage();
  const landingErrors=watchErrors(landingPage);

  await landingPage.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await landingPage.waitForSelector('.school-search-panel',{timeout:15000});
  await landingPage.evaluate(()=>document.fonts?.ready);
  const schoolLanding=await measure(landingPage,'.school-search-panel');
  assertLayout(`${c.name} School landing`,schoolLanding);
  await shot(landingPage,`${c.name}-school-landing-fold.png`,false);
  await shot(landingPage,`${c.name}-school-landing-full.png`,true);

  await landingPage.goto(new URL('university/',BASE).href,{waitUntil:'domcontentloaded',timeout:30000});
  await landingPage.waitForSelector('.search-card',{timeout:15000});
  await landingPage.evaluate(()=>document.fonts?.ready);
  const universityLanding=await measure(landingPage,'.search-card');
  assertLayout(`${c.name} University landing`,universityLanding);
  await shot(landingPage,`${c.name}-university-landing-fold.png`,false);
  await shot(landingPage,`${c.name}-university-landing-full.png`,true);

  if(landingErrors.pageErrors.length||landingErrors.consoleErrors.length){
    throw new Error(`${c.name} landing browser errors: ${JSON.stringify(landingErrors)}`);
  }
  caseReport.schoolLanding=schoolLanding;
  caseReport.universityLanding=universityLanding;
  await landingContext.close();

  const dashboardContext=await browser.newContext({viewport:c.viewport,isMobile:c.isMobile,hasTouch:c.hasTouch,deviceScaleFactor:1,locale:'ko-KR',colorScheme:'light'});
  await dashboardContext.addInitScript(({profile})=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light')},{profile});
  const page=await dashboardContext.newPage();
  const dashboardErrors=watchErrors(page);
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
  await page.waitForTimeout(2500);

  const today=await measure(page,'#dashboard');
  assertLayout(`${c.name} dashboard today`,today);
  await shot(page,`${c.name}-today-fold.png`,false);
  await shot(page,`${c.name}-today-full.png`,true);

  await page.locator('[data-view="week"]:visible').first().click();
  await page.waitForFunction(()=>!document.querySelector('[data-view-panel="week"]')?.classList.contains('hidden'));
  await page.waitForTimeout(250);
  const week=await measure(page,'[data-view-panel="week"]:not(.hidden)');
  assertLayout(`${c.name} dashboard week`,week);
  await shot(page,`${c.name}-week-full.png`,true);

  await page.locator('[data-view="schedule"]:visible').first().click();
  await page.waitForFunction(()=>!document.querySelector('[data-view-panel="schedule"]')?.classList.contains('hidden'));
  await page.waitForTimeout(250);
  const schedule=await measure(page,'[data-view-panel="schedule"]:not(.hidden)');
  assertLayout(`${c.name} dashboard schedule`,schedule);
  await shot(page,`${c.name}-schedule-full.png`,true);

  if(dashboardErrors.pageErrors.length||dashboardErrors.consoleErrors.length){
    throw new Error(`${c.name} dashboard browser errors: ${JSON.stringify(dashboardErrors)}`);
  }
  caseReport.dashboard={today,week,schedule};
  caseReport.errors={landing:landingErrors,dashboard:dashboardErrors};
  report.cases.push(caseReport);
  await dashboardContext.close();
}

await fs.writeFile(`${OUT}/responsive-viewport-report.json`,JSON.stringify(report,null,2));
await browser.close();
