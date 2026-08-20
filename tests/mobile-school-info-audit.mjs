import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'browser-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',englishName:'Jeongdong High School',kind:'고등학교',officeName:'대구광역시교육청',address:'대구광역시 동구',phone:'053-000-0000'},grade:2,className:'6'};
const school={...profile.school,type:'공립',highSchoolType:'일반고',coed:'남녀공학',dayNight:'주간',founded:'19860301',anniversary:'0501',jurisdiction:'대구광역시교육청',location:'대구광역시',addressDetail:'테스트로 1',fax:'053-000-0001',highSchoolTrack:'일반계',homepage:'https://example.com'};
const today=()=>{const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ko-KR',colorScheme:'light'});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[];page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text())});page.on('pageerror',e=>pageErrors.push(String(e)));
await page.route('**/functions/v1/school-data*',async route=>{
  const u=new URL(route.request().url()),action=u.searchParams.get('action')||'';
  if(action==='dashboard')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({school,selected:today(),from:today(),to:today(),timetable:[],meals:[{date:today(),type:'중식',dishes:['밥'],calories:'700 Kcal',nutrition:'',origin:''}],events:[],scheduleMeta:{mode:'month',count:0}})});
  if(action==='media')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({media:{}})});
  return route.fulfill({status:200,contentType:'application/json',body:'{}'});
});
await page.addInitScript(({profile})=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light');localStorage.removeItem('flow-school-profile-v2')},{profile});
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForSelector('#dashboard:not(.hidden)',{timeout:10000});
await page.waitForTimeout(350);

await page.locator('[data-view="school"]:visible').first().click();
await page.waitForSelector('#rankCard:not([hidden])',{timeout:5000});
const layout=await page.evaluate(()=>{
  const card=document.querySelector('#rankCard'),fields=[...document.querySelectorAll('#rankCard .rank-field input')],grid=document.querySelector('#schoolInfoGrid');
  const cr=card.getBoundingClientRect();
  return {viewport:innerWidth,bodyScroll:document.documentElement.scrollWidth,card:{left:cr.left,right:cr.right,width:cr.width},inputs:fields.map(el=>{const r=el.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width}}),infoText:grid.textContent||'',infoTiles:grid.children.length,status:document.querySelector('#schoolInfoStatus')?.textContent||''};
});
if(layout.bodyScroll>layout.viewport+2)throw new Error(`School view overflows horizontally: ${JSON.stringify(layout)}`);
if(layout.inputs.some(x=>x.left<layout.card.left-1||x.right>layout.card.right+1||x.width<80))throw new Error(`Rank input escaped card: ${JSON.stringify(layout)}`);
for(const expected of ['공립','일반고','남녀공학','대구광역시교육청','일반계'])if(!layout.infoText.includes(expected))throw new Error(`School info missing ${expected}: ${JSON.stringify(layout)}`);
if(layout.infoTiles<8)throw new Error(`Too few school info tiles: ${JSON.stringify(layout)}`);

await page.locator('#mobileSettingsBtn').click();
await page.locator('#mealStart').fill('12:35');
await page.locator('#saveSettingsBtn').click();
const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('flow-school-bell-v1')||'{}'));
if(saved.meal!=='12:35')throw new Error(`Meal time was not persisted: ${JSON.stringify(saved)}`);
await page.locator('[data-view="today"]:visible').first().click();
await page.waitForTimeout(120);
const meal=await page.evaluate(()=>({quick:document.querySelector('#quickMealSub')?.textContent||'',footer:document.querySelector('#mealCal')?.textContent||''}));
if(!meal.quick.includes('12:35')||!meal.footer.includes('12:35'))throw new Error(`Configured meal time not rendered: ${JSON.stringify(meal)}`);
await page.screenshot({path:`${OUT}/mobile-school-info-mealtime.png`,fullPage:true});
const report={layout,saved,meal,consoleErrors,pageErrors};
await fs.writeFile(`${OUT}/mobile-school-info-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(consoleErrors.length||pageErrors.length)throw new Error(`Browser errors: ${JSON.stringify({consoleErrors,pageErrors})}`);
await browser.close();
