import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const BASE=process.env.FLOW_TEST_BASE||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'admin-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});
const page=await context.newPage();
const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
let adminCalls=0,probeCalls=0;
const overview={generatedAt:'2026-08-20T12:00:00Z',windowHours:24,activity:{totalEvents:148,uniqueAnonymous:37,registeredProfiles:6,topEvents:[{name:'school_page_view',count:72},{name:'school_tab_view',count:31}],hourly:[{hour:'2026-08-20T10:00:00Z',count:12},{hour:'2026-08-20T11:00:00Z',count:24}]},probes:[{checkedAt:'2026-08-20T11:59:00Z',service:'school-data',action:'search',status:200,durationMs:88,ok:true},{checkedAt:'2026-08-20T11:58:00Z',service:'university-data',action:'search',status:200,durationMs:144,ok:true}]};
await page.route('https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-admin**', async route => {
  adminCalls++;
  const url=new URL(route.request().url());
  if(url.searchParams.get('action')==='probe'){
    probeCalls++;
    const probeOverview={...overview,probes:[
      {checkedAt:'2026-08-20T12:01:00Z',service:'school-data',action:'search',status:200,durationMs:76,ok:true},
      {checkedAt:'2026-08-20T12:01:00Z',service:'university-data',action:'search',status:429,durationMs:201,ok:false},
      {checkedAt:'2026-08-20T12:01:00Z',service:'university-campus',action:'campus',status:200,durationMs:330,ok:true}
    ]};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[],overview:probeOverview})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({admin:{id:'admin-id',email:'owner@example.com'},overview})});
});
await page.goto(`${BASE}/admin`,{waitUntil:'domcontentloaded'});
if(await page.locator('#loginPanel.hidden').count())throw new Error('Admin login should be visible without a session');
if(!(await page.locator('#dashboard').evaluate(el=>el.classList.contains('hidden'))))throw new Error('Admin data became visible before authentication');
await page.evaluate(()=>sessionStorage.setItem('flow-admin-session-v1',JSON.stringify({token:'test-token',email:'owner@example.com'})));
await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#dashboard:not(.hidden)');
if((await page.locator('#totalEvents').textContent())?.trim()!=='148')throw new Error('Admin overview did not render aggregate data');
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
if(overflow>1)throw new Error(`Admin mobile layout overflowed by ${overflow}px`);
await page.locator('#probeBtn').click();await page.waitForFunction(()=>document.querySelector('#healthScore')?.textContent?.trim()==='2/3');
if(probeCalls!==1)throw new Error(`Manual API probe should call exactly once, got ${probeCalls}`);
if(adminCalls<2||adminCalls>3)throw new Error(`Unexpected admin request count: ${adminCalls}`);
await page.screenshot({path:`${OUT}/admin-mobile.png`,fullPage:true});
await fs.writeFile(`${OUT}/report.json`,JSON.stringify({adminCalls,probeCalls,overflow,consoleErrors:errors},null,2));
if(errors.length)throw new Error(`Admin browser errors: ${JSON.stringify(errors)}`);
await browser.close();
