import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE = process.env.FLOW_TEST_URL || 'http://127.0.0.1:4173/';
const OUT = process.env.FLOW_TEST_OUT || 'browser-audit-artifacts';
const profile = {school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청'},grade:2,className:'6'};
await fs.mkdir(OUT,{recursive:true});

const browser = await chromium.launch({headless:true});
const context = await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,locale:'ko-KR',colorScheme:'light'});
const page = await context.newPage();
const placeResponses=[];
const consoleErrors=[];
page.on('response',(response)=>{
  if(response.url().includes('/functions/v1/school-data')&&response.url().includes('action=place')) placeResponses.push({url:response.url(),status:response.status()});
});
page.on('console',(message)=>{if(message.type()==='error')consoleErrors.push(message.text())});

await page.addInitScript(({profile})=>{
  localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
  localStorage.setItem('flow-school-theme-v3','light');
  for(const key of Object.keys(localStorage)) if(key.startsWith('flow-school-kakao-place-v1:')) localStorage.removeItem(key);
},{profile});

await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
await page.locator('[data-view="school"]:visible').first().click();
await page.waitForSelector('#schoolInfoGrid .info-tile',{timeout:15000});
await page.waitForFunction(()=>{
  const link=document.querySelector('#mapLink');
  return link?.dataset.mapResolved==='true' && link.href.includes('place.map.kakao.com');
},{timeout:12000});

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
await fs.writeFile(`${OUT}/kakao-map-report.json`,JSON.stringify({result,placeResponses,consoleErrors},null,2));
console.log(JSON.stringify({result,placeResponses,consoleErrors},null,2));

if(result.provider!=='kakao'||result.resolved!=='true'||!result.href.includes('place.map.kakao.com')) throw new Error(`Kakao place link was not resolved: ${JSON.stringify(result)}`);
if(!placeResponses.some(x=>x.status===200)) throw new Error(`Kakao place Edge request did not succeed: ${JSON.stringify(placeResponses)}`);
if(consoleErrors.length) throw new Error(`Console errors: ${JSON.stringify(consoleErrors)}`);

await browser.close();
