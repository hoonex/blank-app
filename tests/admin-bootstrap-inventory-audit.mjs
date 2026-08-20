import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const BASE=process.env.FLOW_TEST_BASE||'http://127.0.0.1:4173';
const OUT=process.env.FLOW_TEST_OUT||'admin-bootstrap-artifacts';
await fs.mkdir(OUT,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,locale:'ko-KR'});
const page=await context.newPage();
const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
let bootstrapCalls=0,loginCalls=0,overviewCalls=0;
const inventory=[
  {id:'neis',name:'NEIS 교육정보 API',group:'Runtime',via:'school-data',purpose:'학교정보 · 시간표 · 급식',state:'configured'},
  {id:'github-api',name:'GitHub API',group:'Operations',via:'hoonex/blank-app',purpose:'소스 · PR 관리',state:'connected'},
  {id:'vercel-rest',name:'Vercel REST API',group:'Operations',via:'vercel-rest-deploy',purpose:'production 배포',state:'connected'}
];
const overview={generatedAt:'2026-08-21T00:00:00Z',windowHours:24,inventory,activity:{totalEvents:12,uniqueAnonymous:3,registeredProfiles:1,topEvents:[],hourly:[]},probes:[]};
await context.route('https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-admin**',async route=>{
  const url=new URL(route.request().url());
  const action=url.searchParams.get('action');
  if(action==='bootstrap-password'){
    bootstrapCalls++;
    const body=route.request().postDataJSON();
    if(body?.token!=='test-setup-token-12345678901234567890'||body?.password!=='new-test-password')throw new Error(`Unexpected setup body: ${JSON.stringify(body)}`);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,loginName:'flowadmin'})});
  }
  if(action==='login'){
    loginCalls++;
    const body=route.request().postDataJSON();
    if(body?.username!=='flowadmin'||body?.password!=='new-test-password')throw new Error(`Unexpected login body: ${JSON.stringify(body)}`);
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'password-token',refresh_token:'password-refresh',expires_in:3600,user:{id:'admin-id',email:'owner@example.com'},admin:{loginName:'flowadmin'}})});
  }
  if(action==='overview'){
    overviewCalls++;
    if(route.request().headers().authorization!=='Bearer password-token')throw new Error('Overview missing bearer session');
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({admin:{id:'admin-id',loginName:'flowadmin'},overview})});
  }
  throw new Error(`Unexpected admin action: ${action}`);
});
await page.goto(`${BASE}/admin/?setup=test-setup-token-12345678901234567890`,{waitUntil:'domcontentloaded'});
if(!(await page.locator('#setupForm').isVisible()))throw new Error('One-time setup form is not visible');
if(await page.locator('#passwordForm').isVisible())throw new Error('Normal login must be hidden during setup');
if(await page.locator('#emailInput').count())throw new Error('Email login UI must not exist');
if(new URL(page.url()).searchParams.has('setup'))throw new Error('Setup token remained in visible URL');
await page.locator('#newPasswordInput').fill('new-test-password');
await page.locator('#confirmPasswordInput').fill('new-test-password');
await page.locator('#setupForm button[type="submit"]').click();
await page.waitForSelector('#dashboard:not(.hidden)');
if(bootstrapCalls!==1||loginCalls!==1||overviewCalls!==1)throw new Error(`Unexpected setup flow calls: ${JSON.stringify({bootstrapCalls,loginCalls,overviewCalls})}`);
const inventoryText=await page.locator('#inventoryList').textContent();
for(const name of ['NEIS 교육정보 API','GitHub API','Vercel REST API'])if(!inventoryText.includes(name))throw new Error(`Inventory missing ${name}`);
const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-admin-session-v2')||'null'));
if(stored?.accessToken!=='password-token'||stored?.refreshToken!=='password-refresh')throw new Error(`Persistent session missing: ${JSON.stringify(stored)}`);
await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#dashboard:not(.hidden)');
if(bootstrapCalls!==1||loginCalls!==1||overviewCalls!==2)throw new Error('Reopen should reuse persistent session without setup/login');
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);if(overflow>1)throw new Error(`Admin overflow ${overflow}px`);
await page.screenshot({path:`${OUT}/admin-bootstrap-inventory.png`,fullPage:true});
await fs.writeFile(`${OUT}/report.json`,JSON.stringify({bootstrapCalls,loginCalls,overviewCalls,overflow,errors},null,2));
if(errors.length)throw new Error(`Browser errors: ${JSON.stringify(errors)}`);
await browser.close();
