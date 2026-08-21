import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'browser-audit-artifacts';
const browser=await chromium.launch({headless:true});
await fs.mkdir(OUT,{recursive:true});

const makeProfile=(schoolCode,homepage)=>({school:{officeCode:'D10',schoolCode,name:'테스트고등학교',kind:'고등학교',officeName:'대구광역시교육청',homepage,address:'대구광역시 테스트로 1'},grade:2,className:'1'});
const json=(route,body)=>route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify(body)});

async function wireSchoolData(page,{logo=''}){
  await page.route('**/functions/v1/school-data**',route=>{
    const url=new URL(route.request().url()),action=url.searchParams.get('action');
    if(action==='dashboard')return json(route,{school:{name:'테스트고등학교',officeName:'대구광역시교육청',kind:'고등학교',homepage:'https://school.example',address:'대구광역시 테스트로 1'},timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}});
    if(action==='media')return json(route,{media:{hero:'',logo,logoSource:logo?'fixture-primary':'none'},homepage:'https://school.example'});
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
await logoPage.waitForSelector('#schoolLogo.loaded',{timeout:5000});
await logoPage.waitForTimeout(5400);
const primaryState=await logoPage.evaluate(()=>({loaded:document.querySelector('#schoolLogo')?.classList.contains('loaded')||false,src:document.querySelector('#schoolLogo')?.src||''}));
if(!primaryState.loaded||primaryFallbackRequests!==0)throw new Error(`Primary logo should suppress fallback: ${JSON.stringify({primaryFallbackRequests,primaryState})}`);
await logoPage.screenshot({path:`${OUT}/school-logo-fallback.png`,fullPage:true});
await logoContext.close();

const report={missRequests,negativeCache:true,primaryFallbackRequests,primaryState};
await fs.writeFile(`${OUT}/school-logo-fallback-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
