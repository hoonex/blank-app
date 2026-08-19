import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'browser-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청'},grade:2,className:'6'};
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true,locale:'ko-KR',colorScheme:'dark'});
const page=await context.newPage();
await page.addInitScript(({profile})=>{
  localStorage.setItem('flow-school-profile-v3',JSON.stringify(profile));
  localStorage.setItem('flow-school-theme-v3','light');
  localStorage.removeItem('flow-school-profile-v2');
},{profile});
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForSelector('#dashboard:not(.hidden)',{timeout:15000});
await page.waitForTimeout(1200);

const theme=await page.evaluate(()=>{
  const html=getComputedStyle(document.documentElement);
  const body=getComputedStyle(document.body);
  const top=document.querySelector('.mobile-topbar');
  const bottom=document.querySelector('.mobile-bottom-nav');
  return {
    dataTheme:document.documentElement.dataset.theme,
    themeMode:document.documentElement.dataset.themeMode,
    bgVar:html.getPropertyValue('--bg').trim(),
    surfaceVar:html.getPropertyValue('--surface').trim(),
    colorScheme:html.colorScheme,
    bodyBackground:body.backgroundColor,
    bodyColor:body.color,
    topBackground:top?getComputedStyle(top).backgroundColor:'',
    bottomBackground:bottom?getComputedStyle(bottom).backgroundColor:''
  };
});

function rgbLuma(value){
  const nums=(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  if(nums.length<3)return 0;
  return .2126*nums[0]+.7152*nums[1]+.0722*nums[2];
}
if(theme.dataTheme!=='light')throw new Error(`App theme is not light: ${JSON.stringify(theme)}`);
if(theme.bgVar.toLowerCase()!=='#f5f7fa')throw new Error(`Light --bg was overridden: ${JSON.stringify(theme)}`);
if(rgbLuma(theme.bodyBackground)<220)throw new Error(`Mobile light body is visually dark: ${JSON.stringify(theme)}`);
if(rgbLuma(theme.topBackground)<215)throw new Error(`Mobile light top bar is visually dark: ${JSON.stringify(theme)}`);
if(rgbLuma(theme.bottomBackground)<215)throw new Error(`Mobile light bottom nav is visually dark: ${JSON.stringify(theme)}`);

await page.screenshot({path:`${OUT}/mobile-light-on-dark-os.png`,fullPage:true});
await fs.writeFile(`${OUT}/mobile-light-report.json`,JSON.stringify(theme,null,2));
console.log(JSON.stringify(theme,null,2));
await browser.close();
