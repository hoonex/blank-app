import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = process.env.FLOW_TEST_URL || 'http://127.0.0.1:4173/';
const OUT = process.env.FLOW_TEST_OUT || 'browser-audit-artifacts';
const profile = {school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구 반야월북로 199'},grade:2,className:'6'};
const school = {...profile.school,type:'사립',highSchoolType:'일반고',coed:'남녀공학',dayNight:'주간',founded:'19830301',anniversary:'19830301',jurisdiction:'대구광역시동부교육지원청',location:'대구광역시',addressDetail:'',phone:'053-000-0000',fax:'053-000-0001',highSchoolTrack:'일반계',homepage:'https://jungdong.dge.hs.kr'};
const today=()=>{const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`};
await fs.mkdir(OUT,{recursive:true});

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,locale:'ko-KR',colorScheme:'light'});
const page = await context.newPage();
const placeResponses=[];
const placeFixtureRequests=[];
const consoleErrors=[];

await page.route('**/functions/v1/school-data**',async(route)=>{
  const url=new URL(route.request().url()),action=url.searchParams.get('action')||'';
  if(action==='dashboard')return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify({school,selected:today(),from:today(),to:today(),timetable:[],meals:[],events:[],scheduleMeta:{mode:'month',count:0}})});
  if(action==='media')return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:JSON.stringify({media:{},homepage:school.homepage})});
  if(action!=='place')return route.fulfill({status:200,contentType:'application/json; charset=utf-8',body:'{}'});
  const name=url.searchParams.get('name')||'',address=url.searchParams.get('address')||'';
  placeFixtureRequests.push({name,address});
  return route.fulfill({
    status:200,
    contentType:'application/json; charset=utf-8',
    headers:{'x-flow-test-fixture':'kakao-place'},
    body:JSON.stringify({provider:'kakao',place:{id:'fixture-7240101',name:'정동고등학교',url:'https://place.map.kakao.com/fixture-7240101',address,roadAddress:address,x:'128.687',y:'35.875',distance:'0'}})
  });
});
page.on('response',async(response)=>{
  if(!response.url().includes('/functions/v1/school-data')||!response.url().includes('action=place')) return;
  const body=await response.json().catch(()=>null);
  placeResponses.push({url:response.url(),status:response.status(),fixture:response.headers()['x-flow-test-fixture']==='kakao-place',body});
});
page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text())});

await page.addInitScript(({profile})=>{
  localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
  localStorage.setItem('flow-school-theme-v3','light');
  localStorage.removeItem('flow-school-profile-v2');
  for(const key of Object.keys(localStorage)) if(key.startsWith('flow-school-kakao-place-v1:')) localStorage.removeItem(key);
},{profile});

await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
await page.locator('[data-view="school"]:visible').first().click();
await page.waitForSelector('#schoolInfoGrid .info-tile',{timeout:15000});
await page.waitForFunction(()=>document.querySelector('#mapLink')?.dataset.mapResolved==='true',{timeout:8000});

const result=await page.evaluate(()=>{
  const link=document.querySelector('#mapLink');
  const addressTile=[...document.querySelectorAll('#schoolInfoGrid .info-tile')].find(tile=>tile.querySelector('span')?.textContent?.trim()==='주소');
  return{
    school:document.querySelector('#profileName')?.textContent?.trim()||'',
    address:addressTile?.querySelector('strong')?.textContent?.trim()||'',
    href:link?.href||'',
    provider:link?.dataset.mapProvider||'',
    resolved:link?.dataset.mapResolved||''
  };
});

await page.screenshot({path:`${OUT}/kakao-school-map.png`,fullPage:true});
await fs.writeFile(`${OUT}/kakao-map-report.json`,JSON.stringify({result,placeResponses,placeFixtureRequests,consoleErrors},null,2));
console.log(JSON.stringify({result,placeResponses,placeFixtureRequests,consoleErrors},null,2));

if(placeFixtureRequests.length!==1||!placeResponses.some(x=>x.status===200&&x.fixture)) throw new Error(`Kakao place fixture did not exercise the Edge contract: ${JSON.stringify({placeFixtureRequests,placeResponses})}`);
if(placeFixtureRequests[0]?.address!==profile.school.address) throw new Error(`Kakao place fixture did not receive the school address: ${JSON.stringify(placeFixtureRequests)}`);
if(result.provider!=='kakao'||result.resolved!=='true'||!result.href.includes('place.map.kakao.com')) throw new Error(`Kakao place link was not resolved from fixture: ${JSON.stringify(result)}`);
if(consoleErrors.length) throw new Error(`Console errors: ${JSON.stringify(consoleErrors)}`);

await browser.close();