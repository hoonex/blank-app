import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'browser-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});
const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청'},grade:2,className:'6'};
const cases=[
  {name:'current-mobile',viewport:{width:412,height:915},isMobile:true,hasTouch:true},
  {name:'current-wide-touch',viewport:{width:1536,height:960},isMobile:false,hasTouch:true},
];
const browser=await chromium.launch({headless:true});
for(const c of cases){
  const context=await browser.newContext({viewport:c.viewport,isMobile:c.isMobile,hasTouch:c.hasTouch,deviceScaleFactor:1,locale:'ko-KR',colorScheme:'light'});
  const page=await context.newPage();
  await page.addInitScript(({profile})=>{localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));localStorage.setItem('flow-school-theme-v3','light')},{profile});
  await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
  await page.waitForTimeout(2500);
  await page.screenshot({path:`${OUT}/${c.name}-today.png`,fullPage:true});
  await page.locator('[data-view="week"]:visible').first().click();
  await page.waitForFunction(()=>!document.querySelector('[data-view-panel="week"]')?.classList.contains('hidden'));
  await page.waitForTimeout(250);
  await page.screenshot({path:`${OUT}/${c.name}-week.png`,fullPage:true});
  await page.locator('[data-view="schedule"]:visible').first().click();
  await page.waitForFunction(()=>!document.querySelector('[data-view-panel="schedule"]')?.classList.contains('hidden'));
  await page.waitForTimeout(250);
  await page.screenshot({path:`${OUT}/${c.name}-schedule.png`,fullPage:true});
  await context.close();
}
await browser.close();
