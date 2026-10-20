import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'browser-audit-artifacts';
const browser=await chromium.launch({headless:true});
await fs.mkdir(OUT,{recursive:true});

const makeProfile=(schoolCode,homepage)=>({school:{officeCode:'D10',schoolCode,name:'테스트고등학교',kind:'고등학교',officeName:'대구광역시교육청',homepage,address:'대구광역시 테스트로 1'},grade:2,className:'1'});
const json=(route,body)=>route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});

async function wireSchoolData(page,{logo='',source=logo?'fixture-primary':'none',homepage='https://school.example'}){
  await page.route('**/functions/v1/school-data**',route=>{
    const url=new URL(route.request().url()),action=url.searchParams.get('action');
    if(action==='dashboard')return json(route,{school:{name:'테스트고등학교',officeName:'대구광역시교육청',kind:'고등학교',homepage,address:'대구광역시 테스트로 1'},timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}});
    if(action==='media')return json(route,{media:{hero:'',logo,logoSource:source},homepage});
    return json(route,{});
  });
}

const missContext=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
const missPage=await missContext.newPage();
let missRequests=0;
await wireSchoolData(missPage,{logo:''});
await missPage.route('**/functions/v1/school-logo**',route=>{missRequests+=1;return route.fulfill({status:204,headers:{'cache-control':'no-store'},body:''})});
await missPage.addInitScript(profile=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light')},makeProfile('7240101','https://school.example'));
await missPage.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await missPage.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
await missPage.waitForTimeout(5700);
const firstMiss=await missPage.evaluate(()=>JSON.parse(localStorage.getItem('flow-school-logo-fallback-v3:7240101')||'null'));
if(missRequests!==1||!Number(firstMiss?.missAt))throw new Error(`Confirmed logo miss was not cached after one request: ${JSON.stringify({missRequests,firstMiss})}`);
await missPage.reload({waitUntil:'domcontentloaded',timeout:30000});
await missPage.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
await missPage.waitForTimeout(5700);
if(missRequests!==1)throw new Error(`Negative cache did not suppress repeat logo request: ${missRequests}`);
await missContext.close();

const logoContext=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
const logoPage=await logoContext.newPage();
let primaryFallbackRequests=0;
const primaryLogo='data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" rx="14" fill="%23000"/%3E%3C/svg%3E';
await wireSchoolData(logoPage,{logo:primaryLogo});
await logoPage.route('**/functions/v1/school-logo**',route=>{primaryFallbackRequests+=1;return route.fulfill({status:204,body:''})});
await logoPage.addInitScript(profile=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light')},makeProfile('7240999','https://school.example'));
await logoPage.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await logoPage.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
/* Compact Today deliberately hides the legacy hero that owns #schoolLogo.
 * The fallback contract is data/loading state, not visibility of that retired
 * surface, so wait for the loaded marker without requiring a rendered box. */
await logoPage.waitForFunction(()=>document.querySelector('#schoolLogo')?.classList.contains('loaded'),null,{timeout:5000});
await logoPage.waitForTimeout(5400);
const primaryState=await logoPage.evaluate(()=>({loaded:document.querySelector('#schoolLogo')?.classList.contains('loaded')||false,src:document.querySelector('#schoolLogo')?.src||''}));
if(!primaryState.loaded||primaryFallbackRequests!==0)throw new Error(`Primary logo should suppress fallback: ${JSON.stringify({primaryFallbackRequests,primaryState})}`);
await logoPage.screenshot({path:`${OUT}/school-logo-fallback.png`,fullPage:true});
await logoContext.close();


const sharedIconContext=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
const sharedIconPage=await sharedIconContext.newPage();
await wireSchoolData(sharedIconPage,{logo:primaryLogo,source:'homepage-icon',homepage:'https://jeongdong.dge.hs.kr/jeongdongh/main.do'});
await sharedIconPage.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
await sharedIconPage.addInitScript(profile=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light')},makeProfile('7240110','https://jeongdong.dge.hs.kr/jeongdongh/main.do'));
await sharedIconPage.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await sharedIconPage.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
await sharedIconPage.waitForTimeout(800);
const genericIcon=await sharedIconPage.locator('#profileLogo').getAttribute('src');
if(genericIcon)throw new Error('Education-office/shared DGE favicon was presented as a school emblem: '+genericIcon);
await sharedIconContext.close();

const verifiedContext=await browser.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
const verifiedPage=await verifiedContext.newPage();
await wireSchoolData(verifiedPage,{logo:primaryLogo,source:'official-dge-symbol',homepage:'https://jeongdong.dge.hs.kr/jeongdongh/main.do'});
await verifiedPage.route('**/functions/v1/school-logo**',route=>route.fulfill({status:204,body:''}));
await verifiedPage.addInitScript(profile=>{localStorage.clear();localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light')},makeProfile('7240111','https://jeongdong.dge.hs.kr/jeongdongh/main.do'));
await verifiedPage.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await verifiedPage.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
await verifiedPage.waitForFunction(()=>document.querySelector('#profileLogo')?.classList.contains('loaded'),null,{timeout:7000});
const verifiedLogo=await verifiedPage.locator('#profileLogo').getAttribute('src');
if(!verifiedLogo?.startsWith('data:image/'))throw new Error('Verified school symbol was suppressed');
await verifiedContext.close();

const report={missRequests,negativeCache:true,primaryFallbackRequests,primaryState,genericFaviconSuppressed:!genericIcon,verifiedSchoolSymbol:!!verifiedLogo};
await fs.writeFile(`${OUT}/school-logo-fallback-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();