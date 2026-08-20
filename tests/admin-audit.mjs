import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const BASE=process.env.FLOW_TEST_BASE||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'admin-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});
const page=await context.newPage();
const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
let adminCalls=0,probeCalls=0,refreshCalls=0;
const overview={generatedAt:'2026-08-20T12:00:00Z',windowHours:24,activity:{totalEvents:148,uniqueAnonymous:37,registeredProfiles:6,topEvents:[{name:'school_page_view',count:72},{name:'school_tab_view',count:31}],hourly:[{hour:'2026-08-20T10:00:00Z',count:12},{hour:'2026-08-20T11:00:00Z',count:24}]},probes:[{checkedAt:'2026-08-20T11:59:00Z',service:'school-data',action:'search',status:200,durationMs:88,ok:true},{checkedAt:'2026-08-20T11:58:00Z',service:'university-data',action:'search',status:200,durationMs:144,ok:true}]};

await context.route('https://eicwcohfrvhwimwevzkd.supabase.co/auth/v1/token**', async route => {
  refreshCalls++;
  const body=route.request().postDataJSON();
  if(body?.refresh_token!=='magic-refresh')throw new Error(`Unexpected refresh token: ${JSON.stringify(body)}`);
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'refreshed-token',refresh_token:'rotated-refresh',expires_in:3600,user:{email:'owner@example.com'}})});
});
await context.route('https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-admin**', async route => {
  adminCalls++;
  const auth=route.request().headers().authorization||'';
  if(!['Bearer magic-token','Bearer refreshed-token'].includes(auth))throw new Error(`Unexpected admin authorization: ${auth}`);
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
if(await page.locator('#otpForm').count())throw new Error('Dead six-digit OTP UI should not be present');
if(!(await page.locator('#loginPanel').textContent()).includes('최초 한 번'))throw new Error('Persistent-session guidance is missing');

await page.goto(`${BASE}/admin/#access_token=magic-token&refresh_token=magic-refresh&expires_in=3600`,{waitUntil:'domcontentloaded'});
await page.waitForSelector('#dashboard:not(.hidden)');
const storedAfterLink=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-admin-session-v2')||'null'));
if(storedAfterLink?.accessToken!=='magic-token'||storedAfterLink?.refreshToken!=='magic-refresh')throw new Error(`Magic-link session was not persisted: ${JSON.stringify(storedAfterLink)}`);
if((await page.evaluate(()=>location.hash))!=='')throw new Error('Auth fragment was not cleared after session capture');
if((await page.locator('#totalEvents').textContent())?.trim()!=='148')throw new Error('Admin overview did not render aggregate data');

await page.reload({waitUntil:'domcontentloaded'});
await page.waitForSelector('#dashboard:not(.hidden)');
if(refreshCalls!==0)throw new Error(`Fresh persistent session should not refresh yet, got ${refreshCalls}`);

await page.evaluate(()=>{
  const s=JSON.parse(localStorage.getItem('flow-admin-session-v2'));
  s.expiresAt=Date.now()-1000;
  localStorage.setItem('flow-admin-session-v2',JSON.stringify(s));
});
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForSelector('#dashboard:not(.hidden)');
if(refreshCalls!==1)throw new Error(`Expired persistent session should refresh once, got ${refreshCalls}`);
const storedAfterRefresh=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-admin-session-v2')||'null'));
if(storedAfterRefresh?.accessToken!=='refreshed-token'||storedAfterRefresh?.refreshToken!=='rotated-refresh')throw new Error(`Rotated refresh session was not persisted: ${JSON.stringify(storedAfterRefresh)}`);

const secondPage=await context.newPage();
secondPage.on('console',m=>{if(m.type()==='error')errors.push(m.text())});secondPage.on('pageerror',e=>errors.push(e.message));
await secondPage.goto(`${BASE}/admin`,{waitUntil:'domcontentloaded'});
await secondPage.waitForSelector('#dashboard:not(.hidden)');
if(refreshCalls!==1)throw new Error(`Reopening admin should reuse persistent session without email/refresh churn, got ${refreshCalls} refresh calls`);
await secondPage.close();

const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
if(overflow>1)throw new Error(`Admin mobile layout overflowed by ${overflow}px`);
await page.locator('#probeBtn').click();await page.waitForFunction(()=>document.querySelector('#healthScore')?.textContent?.trim()==='2/3');
if(probeCalls!==1)throw new Error(`Manual API probe should call exactly once, got ${probeCalls}`);
if(adminCalls<5||adminCalls>6)throw new Error(`Unexpected admin request count: ${adminCalls}`);
await page.screenshot({path:`${OUT}/admin-mobile.png`,fullPage:true});
await fs.writeFile(`${OUT}/report.json`,JSON.stringify({adminCalls,probeCalls,refreshCalls,overflow,consoleErrors:errors,storedAfterRefresh},null,2));
if(errors.length)throw new Error(`Admin browser errors: ${JSON.stringify(errors)}`);
await browser.close();
