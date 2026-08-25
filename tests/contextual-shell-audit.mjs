import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||process.env.FLOW_BASE_URL||'http://127.0.0.1:4173/';
const OUT='contextual-shell-audit';
await mkdir(OUT,{recursive:true});

function rect(node){
  if(!node)return null;
  const r=node.getBoundingClientRect();
  return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
}

async function inspectSchool(page){
  return page.evaluate(()=>{
    const landing=document.querySelector('#landing');
    const shell=document.querySelector('#dashboard');
    const nav=document.querySelector('#bottomNav');
    const search=document.querySelector('.school-search-panel');
    const css=node=>node?getComputedStyle(node):null;
    const r=node=>{if(!node)return null;const x=node.getBoundingClientRect();return{left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}};
    return{
      landingDisplay:css(landing)?.display,
      shellDisplay:css(shell)?.display,
      shellHidden:shell?.classList.contains('hidden')||false,
      navDisplay:css(nav)?.display,
      navRect:r(nav),
      searchRect:r(search),
      clientWidth:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth,
    };
  });
}

async function inspectUniversity(page){
  return page.evaluate(()=>{
    const setup=document.querySelector('#setupView');
    const app=document.querySelector('#appView');
    const nav=document.querySelector('.bottom-nav');
    const search=document.querySelector('.search-card');
    const css=node=>node?getComputedStyle(node):null;
    const r=node=>{if(!node)return null;const x=node.getBoundingClientRect();return{left:x.left,right:x.right,top:x.top,bottom:x.bottom,width:x.width,height:x.height}};
    return{
      setupDisplay:css(setup)?.display,
      appDisplay:css(app)?.display,
      appHidden:app?.classList.contains('hidden')||false,
      navDisplay:css(nav)?.display,
      navRect:r(nav),
      searchRect:r(search),
      clientWidth:document.documentElement.clientWidth,
      scrollWidth:document.documentElement.scrollWidth,
    };
  });
}

function assertExclusiveShell(label,state,visibleKey,hiddenKey,hiddenFlag,navRect){
  if(state[visibleKey]==='none')throw new Error(`${label}: landing/setup disappeared ${JSON.stringify(state)}`);
  if(!state[hiddenFlag]||state[hiddenKey]!=='none')throw new Error(`${label}: hidden app shell was resurrected by responsive CSS ${JSON.stringify(state)}`);
  if(navRect&&(navRect.width>0||navRect.height>0))throw new Error(`${label}: navigation from hidden shell leaked into landing composition ${JSON.stringify(state)}`);
  if(state.scrollWidth>state.clientWidth+1)throw new Error(`${label}: horizontal overflow ${JSON.stringify(state)}`);
  if(!state.searchRect||state.searchRect.width<280)throw new Error(`${label}: primary landing control lost usable width ${JSON.stringify(state)}`);
}

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,locale:'ko-KR',timezoneId:'Asia/Seoul',colorScheme:'light'});
const page=await context.newPage();

await page.addInitScript(()=>localStorage.clear());
await page.goto(BASE,{waitUntil:'domcontentloaded'});
await page.waitForSelector('#landing');
await page.waitForTimeout(150);
const school=await inspectSchool(page);
assertExclusiveShell('school-landscape',school,'landingDisplay','shellDisplay','shellHidden',school.navRect);
await page.screenshot({path:`${OUT}/school-landscape-landing.png`,fullPage:false});

await page.goto(new URL('/university/',BASE).toString(),{waitUntil:'domcontentloaded'});
await page.waitForSelector('#setupView');
await page.waitForTimeout(150);
const university=await inspectUniversity(page);
assertExclusiveShell('university-landscape',university,'setupDisplay','appDisplay','appHidden',university.navRect);
await page.screenshot({path:`${OUT}/university-landscape-landing.png`,fullPage:false});

await writeFile(`${OUT}/report.json`,JSON.stringify({school,university},null,2));
await context.close();
await browser.close();
console.log(JSON.stringify({school,university},null,2));
