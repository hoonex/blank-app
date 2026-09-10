import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const BASE=process.env.FLOW_TEST_BASE||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'admin-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});
const page=await context.newPage();
const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
let adminCalls=0,probeCalls=0,refreshCalls=0,passwordCalls=0;
const overview={generatedAt:'2026-08-20T12:00:00Z',windowHours:24,activity:{totalEvents:148,uniqueAnonymous:37,registeredProfiles:6,topEvents:[{name:'school_page_view',count:72},{name:'school_tab_view',count:31}],hourly:[{hour:'2026-08-20T10:00:00Z',count:12},{hour:'2026-08-20T11:00:00Z',count:24}]},probes:[{checkedAt:'2026-08-20T11:59:00Z',service:'school-data',action:'search',status:200,durationMs:88,ok:true},{checkedAt:'2026-08-20T11:58:00Z',service:'university-data',action:'search',status:200,durationMs:144,ok:true}]};

await context.route('https://eicwcohfrvhwimwevzkd.supabase.co/auth/v1/token**', async route => {
  const url=new URL(route.request().url());
  const body=route.request().postDataJSON();
  if(url.searchParams.get('grant_type')==='refresh_token'){
    refreshCalls++;
    if(body?.refresh_token!=='password-refresh')throw new Error(`Unexpected refresh token: ${JSON.stringify(body)}`);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'refreshed-token',refresh_token:'rotated-refresh',expires_in:3600,user:{email:'owner@example.com'}})});
  }
  throw new Error(`Unexpected direct auth grant: ${route.request().url()}`);
});
await context.route('https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-admin**', async route => {
  adminCalls++;
  const url=new URL(route.request().url());
  if(url.searchParams.get('action')==='login'){
    passwordCalls++;
    const body=route.request().postDataJSON();
    if(body?.username!=='flowadmin'||body?.password!=='test-password')throw new Error(`Unexpected admin login body: ${JSON.stringify(body)}`);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'password-token',refresh_token:'password-refresh',expires_in:3600,user:{id:'admin-id',email:'owner@example.com'},admin:{loginName:'flowadmin'}})});
  }
  const auth=route.request().headers().authorization||'';
  if(!['Bearer password-token','Bearer refreshed-token'].includes(auth))throw new Error(`Unexpected admin authorization: ${auth}`);
  if(url.searchParams.get('action')==='probe'){
    probeCalls++;
    const probeOverview={...overview,probes:[
      {checkedAt:'2026-08-20T12:01:00Z',service:'school-data',action:'search',status:200,durationMs:76,ok:true},
      {checkedAt:'2026-08-20T12:01:00Z',service:'university-data',action:'search',status:429,durationMs:201,ok:false},
      {checkedAt:'2026-08-20T12:01:00Z',service:'university-campus',action:'campus',status:200,durationMs:330,ok:true}
    ]};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({results:[],overview:probeOverview})});
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({admin:{id:'admin-id',loginName:'flowadmin'},overview})});
});

await page.goto(`${BASE}/admin`,{waitUntil:'domcontentloaded'});
if(await page.locator('#loginPanel.hidden').count())throw new Error('Admin login should be visible without a session');
if(!(await page.locator('#dashboard').evaluate(el=>el.classList.contains('hidden'))))throw new Error('Admin data became visible before authentication');
if(await page.locator('#otpForm').count())throw new Error('Dead OTP UI should not be present');
if(await page.locator('#emailForm').count())throw new Error('Magic-link login form should not be primary admin auth anymore');
if(!(await page.locator('#loginPanel').textContent()).includes('비밀번호'))throw new Error('Password login guidance is missing');
if(await page.locator('#emailInput').count())throw new Error('Admin email input must not be exposed');
if(!(await page.locator('#loginPanel').textContent()).includes('관리자 아이디'))throw new Error('Admin username guidance is missing');

await page.locator('#usernameInput').fill('flowadmin');
await page.locator('#passwordInput').fill('test-password');
await page.locator('#passwordForm button[type="submit"]').click();
await page.waitForSelector('#dashboard:not(.hidden)');
if(passwordCalls!==1)throw new Error(`Password login should call exactly once, got ${passwordCalls}`);
const storedAfterLogin=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-admin-session-v2')||'null'));
if(storedAfterLogin?.accessToken!=='password-token'||storedAfterLogin?.refreshToken!=='password-refresh')throw new Error(`Password session was not persisted: ${JSON.stringify(storedAfterLogin)}`);
if((await page.locator('#totalEvents').textContent())?.trim()!=='148')throw new Error('Admin overview did not render aggregate data');

await page.reload({waitUntil:'domcontentloaded'});
await page.waitForSelector('#dashboard:not(.hidden)');
if(passwordCalls!==1||refreshCalls!==0)throw new Error(`Fresh persisted session should not re-login or refresh: password=${passwordCalls} refresh=${refreshCalls}`);

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
if(passwordCalls!==1||refreshCalls!==1)throw new Error(`Reopening admin should reuse session: password=${passwordCalls} refresh=${refreshCalls}`);
await secondPage.close();

const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
if(overflow>1)throw new Error(`Admin mobile layout overflowed by ${overflow}px`);
await page.locator('#probeBtn').click();await page.waitForFunction(()=>document.querySelector('#healthScore')?.textContent?.trim()==='2/3');
if(probeCalls!==1)throw new Error(`Manual API probe should call exactly once, got ${probeCalls}`);
if(adminCalls<5||adminCalls>6)throw new Error(`Unexpected admin request count: ${adminCalls}`);

/* Release history + wireframe interaction coverage. The feature is part of the
   authenticated Admin dashboard, but remains client-only and must not create new
   backend calls. */
await page.waitForSelector('#releases');await page.waitForSelector('#wireframes');
if(await page.locator('.section-nav a[href="#releases"]').count()!==1||await page.locator('.section-nav a[href="#wireframes"]').count()!==1)throw new Error('Admin release/wireframe nav links are missing');
if(await page.locator('.release-card').count()<3)throw new Error('Admin release history should expose at least three version states');
if(await page.locator('.wireframe-node').count()<12)throw new Error('Admin wireframe map is missing expected screen nodes');
await page.setViewportSize({width:1440,height:900});
await page.locator('#wireframeVersion').selectOption('2026.09.10.1');
await page.waitForFunction(()=>document.querySelectorAll('.wireframe-node.is-changed').length>=2);
const changedNodes=await page.locator('.wireframe-node.is-changed').count();
await page.locator('[data-node="school-transit-desktop"]').click();
if(!((await page.locator('#wireframeInspector').textContent())||'').includes('School · Transit'))throw new Error('Wireframe node inspector did not render selected screen');
const world=page.locator('#wireframeWorld');const beforeZoom=await world.getAttribute('style');
await page.locator('#wireframeZoomIn').click();await page.waitForTimeout(80);const afterZoom=await world.getAttribute('style');
if(beforeZoom===afterZoom)throw new Error('Wireframe zoom control did not change the canvas transform');
const box=await page.locator('#wireframeViewport').boundingBox();
if(!box)throw new Error('Wireframe viewport has no layout box');
const beforePan=await world.getAttribute('style');await page.mouse.move(box.x+80,box.y+80);await page.mouse.down();await page.mouse.move(box.x+155,box.y+125,{steps:5});await page.mouse.up();await page.waitForTimeout(80);const afterPan=await world.getAttribute('style');
if(beforePan===afterPan)throw new Error('Wireframe drag pan did not change the canvas transform');
await page.locator('#wireframeFit').click();await page.waitForTimeout(80);
const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
if(desktopOverflow>1)throw new Error(`Admin desktop layout overflowed by ${desktopOverflow}px`);

/* Final visual proof must show the whole map, not a release-filtered fragment. */
await page.locator('#wireframeVersion').selectOption('all');
await page.locator('#wireframePlatform').selectOption('all');
await page.locator('#wireframeFit').click();await page.waitForTimeout(120);
const routeVisual=await page.evaluate(()=>{
  const edges=[...document.querySelectorAll('.wireframe-edge')];
  return{
    zones:document.querySelectorAll('.wireframe-zone').length,
    edges:edges.length,
    labels:document.querySelectorAll('.wireframe-edge-label').length,
    missingMarkers:edges.filter(edge=>!edge.getAttribute('marker-end')).length,
    kinds:[...new Set(edges.map(edge=>edge.dataset.kind))].sort(),
    zoom:(document.querySelector('#wireframeZoomReadout')?.textContent||'').trim()
  };
});
if(routeVisual.zones!==4)throw new Error(`Expected four visible UI map zones, got ${routeVisual.zones}`);
if(routeVisual.edges<12||routeVisual.labels!==routeVisual.edges)throw new Error(`Wireframe route labels are incomplete: ${JSON.stringify(routeVisual)}`);
if(routeVisual.missingMarkers)throw new Error(`Wireframe routes missing arrowheads: ${routeVisual.missingMarkers}`);
if(routeVisual.kinds.join(',')!=='data,nav,responsive,runtime')throw new Error(`Wireframe route type legend is incomplete: ${JSON.stringify(routeVisual.kinds)}`);
await page.locator('#wireframes').screenshot({path:`${OUT}/admin-wireframe-all.png`});
await page.screenshot({path:`${OUT}/admin-desktop-release-wireframes.png`,fullPage:true});
await page.setViewportSize({width:390,height:844});

await page.screenshot({path:`${OUT}/admin-mobile.png`,fullPage:true});
await fs.writeFile(`${OUT}/report.json`,JSON.stringify({adminCalls,probeCalls,passwordCalls,refreshCalls,overflow,desktopOverflow,changedNodes,routeVisual,consoleErrors:errors,storedAfterRefresh},null,2));
if(errors.length)throw new Error(`Admin browser errors: ${JSON.stringify(errors)}`);
await browser.close();
