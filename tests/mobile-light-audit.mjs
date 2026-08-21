import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const BASE=process.env.FLOW_TEST_URL||'http://127.0.0.1:4173/';
const OUT=process.env.FLOW_TEST_OUT||'browser-audit-artifacts';
await fs.mkdir(OUT,{recursive:true});

const canaryResponse=await fetch('https://eicwcohfrvhwimwevzkd.supabase.co/functions/v1/flow-site/?__edge_canary=1',{signal:AbortSignal.timeout(45000)});
if(!canaryResponse.ok)throw new Error(`Edge canary failed: ${canaryResponse.status}`);
const canary=await canaryResponse.json();
console.log(`FLOW_EDGE_CANARY ${JSON.stringify(canary)}`);
for(const [name,configured] of Object.entries(canary.configured||{}))if(!configured)throw new Error(`Missing Edge secret: ${name}`);
for(const name of ['kakao','neis','schoolInfo','major','finances','educationCondition'])if(!canary?.[name]?.ok)throw new Error(`Edge upstream probe failed: ${name} ${JSON.stringify(canary?.[name])}`);

const profile={school:{officeCode:'D10',schoolCode:'7240101',name:'정동고등학교',kind:'고등학교',officeName:'대구광역시교육청'},grade:2,className:'6'};
const browser=await chromium.launch({headless:true,args:['--force-dark-mode','--enable-features=WebContentsForceDark']});
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

async function readTheme(){
  return page.evaluate(()=>{
    const html=getComputedStyle(document.documentElement);
    const body=getComputedStyle(document.body);
    const top=document.querySelector('.mobile-topbar');
    const bottom=document.querySelector('.mobile-bottom-nav');
    return {
      dataTheme:document.documentElement.dataset.theme,
      themeMode:document.documentElement.dataset.themeMode,
      saved:localStorage.getItem('flow-school-theme-v3')||'',
      bgVar:html.getPropertyValue('--bg').trim(),
      surfaceVar:html.getPropertyValue('--surface').trim(),
      colorScheme:html.colorScheme,
      inlineColorScheme:document.documentElement.style.colorScheme,
      metaColorScheme:document.querySelector('meta[name="color-scheme"]')?.content||'',
      bodyBackground:body.backgroundColor,
      bodyColor:body.color,
      topBackground:top?getComputedStyle(top).backgroundColor:'',
      bottomBackground:bottom?getComputedStyle(bottom).backgroundColor:''
    };
  });
}
function isOnlyLight(value){return String(value).trim().split(/\s+/).sort().join(' ')==='light only'}
function rgbLuma(value){
  const nums=(value.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  if(nums.length<3)return 0;
  return .2126*nums[0]+.7152*nums[1]+.0722*nums[2];
}
function assertLight(theme,label){
  if(theme.dataTheme!=='light'||theme.themeMode!=='light'||theme.saved!=='light')throw new Error(`${label} app theme is not explicit light: ${JSON.stringify(theme)}`);
  if(theme.bgVar.toLowerCase()!=='#f5f7fa')throw new Error(`${label} light --bg was overridden: ${JSON.stringify(theme)}`);
  if(!isOnlyLight(theme.inlineColorScheme)||theme.metaColorScheme!=='only light'||!theme.colorScheme.includes('light'))throw new Error(`${label} light color-scheme contract failed: ${JSON.stringify(theme)}`);
  if(rgbLuma(theme.bodyBackground)<220)throw new Error(`${label} mobile light body is visually dark: ${JSON.stringify(theme)}`);
  if(rgbLuma(theme.topBackground)<215)throw new Error(`${label} mobile light top bar is visually dark: ${JSON.stringify(theme)}`);
  if(rgbLuma(theme.bottomBackground)<215)throw new Error(`${label} mobile light bottom nav is visually dark: ${JSON.stringify(theme)}`);
}

const initial=await readTheme();
assertLight(initial,'Initial');

await page.locator('#mobileSettingsBtn').click();
await page.locator('#themeSegment [data-theme-choice="dark"]').click();
await page.waitForTimeout(120);
const dark=await readTheme();
if(dark.dataTheme!=='dark'||dark.themeMode!=='dark'||dark.saved!=='dark'||dark.inlineColorScheme!=='dark'||dark.metaColorScheme!=='dark'||!dark.colorScheme.includes('dark'))throw new Error(`Dark transition failed before light regression check: ${JSON.stringify(dark)}`);

await page.locator('#themeSegment [data-theme-choice="light"]').click();
await page.waitForTimeout(120);
const liveLight=await readTheme();
assertLight(liveLight,'Dark-to-light live transition');
await page.locator('#settingsDialog .dialog-close').click();
await page.waitForTimeout(100);

await page.screenshot({path:`${OUT}/mobile-light-after-live-dark.png`,fullPage:true});
const report={initial,dark,liveLight};
await fs.writeFile(`${OUT}/mobile-light-report.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
